import type { NormalizedSportsSync, SportsLeagueSyncConfig } from "@/lib/big-balls-data";
import { normalizeBigBallsMatches } from "@/lib/big-balls-data";
import { isPlaceholderSportsTeamName } from "@/lib/sports-team-utils";
import type { SportsTeam } from "@/types/sports-data";

type WorldCup26Team = {
  id?: string | number;
  team_id?: string | number;
  name?: string;
  name_en?: string;
  fifa_code?: string;
  flag_url?: string;
  flag?: string;
  logo?: string;
};

type WorldCup26Match = {
  id?: string | number;
  match_id?: string | number;
  home_team?: WorldCup26Team | string;
  away_team?: WorldCup26Team | string;
  homeTeam?: WorldCup26Team | string;
  awayTeam?: WorldCup26Team | string;
  scheduled_at?: string;
  kickoff_utc?: string;
  start_time?: string;
  status?: string;
  home_score?: number;
  away_score?: number;
  scores?: { home?: number; away?: number; score?: string };
};

export async function fetchWorldCup26FallbackSnapshot(
  config: SportsLeagueSyncConfig,
  syncedAt: string,
): Promise<NormalizedSportsSync | null> {
  const feedUrl = process.env.WORLDCUP26_API_URL;

  if (!feedUrl) {
    return null;
  }

  const response = await fetch(feedUrl, { next: { revalidate: 0 } });

  if (!response.ok) {
    throw new Error(`worldcup26 fallback failed with ${response.status}.`);
  }

  const payload = (await response.json()) as
    | WorldCup26Match[]
    | { data?: unknown; matches?: WorldCup26Match[]; fixtures?: WorldCup26Match[] };
  const matches = extractMatches(payload);

  if (matches.length === 0) {
    return null;
  }

  return normalizeBigBallsMatches(
    {
      ...config,
      league: config.league || "wc2026",
    },
    matches.map(mapFallbackMatch),
    syncedAt,
  );
}

export async function fetchWorldCup26QualifiedTeams(
  config: SportsLeagueSyncConfig,
): Promise<SportsTeam[] | null> {
  if (config.tournamentId !== "fifa-world-cup-2026") {
    return null;
  }

  const teamsUrl =
    process.env.WORLDCUP26_TEAMS_API_URL ?? "https://worldcup26.ir/get/teams";
  const response = await fetch(teamsUrl, { next: { revalidate: 0 } });

  if (!response.ok) {
    throw new Error(`worldcup26 teams sync failed with ${response.status}.`);
  }

  const payload = (await response.json()) as
    | WorldCup26Team[]
    | { data?: unknown; teams?: WorldCup26Team[] };
  const teams = extractTeams(payload);

  if (teams.length === 0) {
    return null;
  }

  return normalizeWorldCup26Teams(config.tournamentId, teams);
}

export function normalizeWorldCup26Teams(
  tournamentId: string,
  teams: WorldCup26Team[],
) {
  const teamsById = new Map<string, SportsTeam>();

  for (const team of teams) {
    const name = String(team.name_en ?? team.name ?? "").trim();

    if (!name || isPlaceholderSportsTeamName(name)) {
      continue;
    }

    const providerTeamId = slugify(
      String(team.team_id ?? team.id ?? team.fifa_code ?? name),
    );

    if (!providerTeamId) {
      continue;
    }

    teamsById.set(`${tournamentId}:${providerTeamId}`, {
      id: `${tournamentId}:${providerTeamId}`,
      tournamentId,
      providerTeamId,
      name,
      shortName: team.fifa_code,
      logoUrl: team.flag_url ?? team.flag ?? team.logo,
    });
  }

  return Array.from(teamsById.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function withWorldCup26QualifiedTeams(
  snapshot: NormalizedSportsSync,
  teams: SportsTeam[] | null,
): NormalizedSportsSync {
  if (!teams?.length) {
    return snapshot;
  }

  return {
    ...snapshot,
    tournament: {
      ...snapshot.tournament,
      teamCount: teams.length,
    },
    teams,
  };
}

function extractMatches(
  payload:
    | WorldCup26Match[]
    | { data?: unknown; matches?: WorldCup26Match[]; fixtures?: WorldCup26Match[] },
) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.matches)) {
    return payload.matches;
  }

  if (Array.isArray(payload.fixtures)) {
    return payload.fixtures;
  }

  if (Array.isArray(payload.data)) {
    return payload.data as WorldCup26Match[];
  }

  if (
    payload.data &&
    typeof payload.data === "object" &&
    Array.isArray((payload.data as { matches?: unknown }).matches)
  ) {
    return (payload.data as { matches: WorldCup26Match[] }).matches;
  }

  return [];
}

function extractTeams(
  payload: WorldCup26Team[] | { data?: unknown; teams?: WorldCup26Team[] },
) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.teams)) {
    return payload.teams;
  }

  if (Array.isArray(payload.data)) {
    return payload.data as WorldCup26Team[];
  }

  if (
    payload.data &&
    typeof payload.data === "object" &&
    Array.isArray((payload.data as { teams?: unknown }).teams)
  ) {
    return (payload.data as { teams: WorldCup26Team[] }).teams;
  }

  return [];
}

function mapFallbackMatch(match: WorldCup26Match) {
  const parsedScore = parseScore(match.scores?.score);

  return {
    match_id: String(match.match_id ?? match.id ?? ""),
    home_team: mapFallbackTeam(match.home_team ?? match.homeTeam),
    away_team: mapFallbackTeam(match.away_team ?? match.awayTeam),
    scheduled_at: match.scheduled_at ?? match.kickoff_utc ?? match.start_time,
    status: match.status,
    score: {
      home: match.home_score ?? match.scores?.home ?? parsedScore.home,
      away: match.away_score ?? match.scores?.away ?? parsedScore.away,
    },
  };
}

function mapFallbackTeam(value: WorldCup26Team | string | undefined) {
  if (typeof value === "string") {
    return { id: value, name: value };
  }

  return {
    id: String(value?.id ?? value?.team_id ?? value?.name ?? ""),
    name: value?.name ?? "",
    flag_url: value?.flag_url ?? value?.logo,
  };
}

function parseScore(value?: string) {
  const [home, away] = value?.split("-").map((part) => Number(part.trim())) ?? [];

  return {
    home: Number.isFinite(home) ? home : undefined,
    away: Number.isFinite(away) ? away : undefined,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
