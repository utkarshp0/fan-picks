import type { NormalizedSportsSync, SportsLeagueSyncConfig } from "@/lib/big-balls-data";
import { normalizeBigBallsMatches } from "@/lib/big-balls-data";

type WorldCup26Team = {
  id?: string | number;
  team_id?: string | number;
  name?: string;
  flag_url?: string;
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
