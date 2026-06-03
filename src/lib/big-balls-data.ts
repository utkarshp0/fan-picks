import type { SportsFixture, SportsTeam, SportsTournament } from "@/types/sports-data";

const defaultBaseUrl = "https://api.bigballsdata.com";
const provider = "big-balls-data" as const;

type BigBallsTeam = {
  id?: string;
  name?: string;
  short_name?: string;
  shortName?: string;
  abbreviation?: string;
  flag_url?: string;
  logo_url?: string;
  logoUrl?: string;
};

type BigBallsMatch = {
  id?: string;
  match_id?: string;
  sport?: string;
  league?: string;
  group?: string;
  venue?: string;
  home?: string | BigBallsTeam;
  away?: string | BigBallsTeam;
  home_team?: string | BigBallsTeam;
  away_team?: string | BigBallsTeam;
  homeTeam?: string | BigBallsTeam;
  awayTeam?: string | BigBallsTeam;
  kickoff_utc?: string;
  kickoffUtc?: string;
  start_time?: string;
  scheduled_at?: string;
  status?: string;
  score?: { home?: number; away?: number } | null;
  scores?: { home?: number; away?: number; value?: { home?: number; away?: number } } | null;
};

export type SportsLeagueSyncConfig = {
  tournamentId: string;
  league: string;
  fallbackLeagues?: string[];
  name?: string;
  season?: string;
};

export type NormalizedSportsSync = {
  tournament: SportsTournament;
  teams: SportsTeam[];
  fixtures: SportsFixture[];
};

export function getSportsLeagueSyncConfig() {
  const raw =
    process.env.BIG_BALLS_DATA_SYNC_LEAGUES?.trim() ??
    "fifa-world-cup-2026:wc2026";

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [tournamentId, league, name, season] = entry.split(":");

      return {
        tournamentId,
        league,
        fallbackLeagues: getFallbackLeagues(tournamentId, league),
        name,
        season,
      };
    })
    .filter((entry) => entry.tournamentId && entry.league);
}

export async function fetchBigBallsLeagueMatches(
  config: SportsLeagueSyncConfig,
) {
  const apiKey = process.env.BIG_BALLS_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing BIG_BALLS_DATA_API_KEY.");
  }

  if (config.tournamentId === "fifa-world-cup-2026") {
    return fetchBigBallsWorldCupMatches(apiKey);
  }

  const leagues = [config.league, ...(config.fallbackLeagues ?? [])].filter(
    (league, index, values) => league && values.indexOf(league) === index,
  );
  const errors: string[] = [];
  let lastSuccessfulMatches: BigBallsMatch[] | null = null;

  for (const league of leagues) {
    try {
      const matches = await fetchBigBallsStoredMatches(apiKey, league);

      lastSuccessfulMatches = matches;

      if (matches.length > 0) {
        return matches;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (lastSuccessfulMatches) {
    return lastSuccessfulMatches;
  }

  throw new Error(errors.at(-1) ?? "Big Balls Data sync failed.");
}

async function fetchBigBallsStoredMatches(apiKey: string, league: string) {
  const baseUrl = process.env.BIG_BALLS_DATA_BASE_URL ?? defaultBaseUrl;
  const url = new URL("/v1/stored/matches", baseUrl);

  url.searchParams.set("sport", "football");
  url.searchParams.set("league", league);
  url.searchParams.set("limit", "250");

  const response = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const detail = errorText ? ` ${errorText.slice(0, 240)}` : "";

    throw new Error(
      `Big Balls Data sync failed with ${response.status}.${detail}`,
    );
  }

  const payload = (await response.json()) as {
    data?: BigBallsMatch[] | Record<string, BigBallsMatch>;
  };

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && typeof payload.data === "object") {
    return Object.values(payload.data);
  }

  return [];
}

async function fetchBigBallsWorldCupMatches(apiKey: string) {
  const baseUrl = process.env.BIG_BALLS_DATA_BASE_URL ?? defaultBaseUrl;
  const url = new URL("/v1/wc2026/matches", baseUrl);

  url.searchParams.set("limit", "250");

  const response = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const detail = errorText ? ` ${errorText.slice(0, 240)}` : "";

    throw new Error(
      `Big Balls World Cup sync failed with ${response.status}.${detail}`,
    );
  }

  const payload = (await response.json()) as {
    data?: { matches?: BigBallsMatch[] };
  };

  return payload.data?.matches ?? [];
}

function getFallbackLeagues(tournamentId: string, league: string) {
  if (tournamentId !== "fifa-world-cup-2026") {
    return [];
  }

  return [
    "fifa-world-cup-2026",
    "world-cup-2026",
    "fifa-world-cup",
    "world-cup",
    "wc2026",
  ].filter((candidate) => candidate !== league);
}

export function normalizeBigBallsMatches(
  config: SportsLeagueSyncConfig,
  matches: BigBallsMatch[],
  syncedAt: string,
): NormalizedSportsSync {
  const teamsById = new Map<string, SportsTeam>();
  const fixtures = matches.flatMap((match) => {
    const home = normalizeTeam(match.home ?? match.home_team ?? match.homeTeam);
    const away = normalizeTeam(match.away ?? match.away_team ?? match.awayTeam);
    const providerMatchId = String(match.id ?? match.match_id ?? "");

    if (!providerMatchId || !home.name || !away.name) {
      return [];
    }

    const homeTeam = toSportsTeam(config.tournamentId, home);
    const awayTeam = toSportsTeam(config.tournamentId, away);

    teamsById.set(homeTeam.id, homeTeam);
    teamsById.set(awayTeam.id, awayTeam);

    return [
      {
        id: `${config.tournamentId}:${providerMatchId}`,
        tournamentId: config.tournamentId,
        providerMatchId,
        sport: match.sport ?? "football",
        league: match.league ?? config.league,
        homeTeamName: homeTeam.name,
        awayTeamName: awayTeam.name,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        kickoffUtc:
          match.kickoff_utc ??
          match.kickoffUtc ??
          match.start_time ??
          match.scheduled_at,
        status: match.status ?? "scheduled",
        homeScore: getScoreValue(match, "home"),
        awayScore: getScoreValue(match, "away"),
        raw: match as Record<string, unknown>,
        lastSyncedAt: syncedAt,
      },
    ];
  });
  const teams = Array.from(teamsById.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const dates = fixtures
    .map((fixture) => fixture.kickoffUtc)
    .filter(Boolean)
    .sort() as string[];

  return {
    tournament: {
      id: config.tournamentId,
      provider,
      providerLeagueId: config.league,
      sport: fixtures[0]?.sport ?? "football",
      league: fixtures[0]?.league ?? config.league,
      name: config.name ?? getFriendlyTournamentName(config.tournamentId),
      season: config.season ?? getSeasonFromDates(dates) ?? "2026",
      startDate: dates[0]?.slice(0, 10) ?? "2026-06-11",
      endDate: dates.at(-1)?.slice(0, 10),
      matchCount: fixtures.length,
      teamCount: teams.length,
      lastSyncedAt: syncedAt,
    },
    teams,
    fixtures,
  };
}

function normalizeTeam(value: string | BigBallsTeam | undefined) {
  if (typeof value === "string") {
    return {
      id: value,
      name: value,
    };
  }

  return {
    id: value?.id ?? value?.short_name ?? value?.shortName ?? value?.name,
    name: value?.name ?? "",
    shortName: value?.short_name ?? value?.shortName ?? value?.abbreviation,
    logoUrl: value?.logo_url ?? value?.logoUrl ?? value?.flag_url,
  };
}

function toSportsTeam(
  tournamentId: string,
  team: ReturnType<typeof normalizeTeam>,
): SportsTeam {
  const providerTeamId = slugify(team.id ?? team.name);

  return {
    id: `${tournamentId}:${providerTeamId}`,
    tournamentId,
    providerTeamId,
    name: team.name,
    shortName: team.shortName,
    logoUrl: team.logoUrl,
  };
}

function getScoreValue(match: BigBallsMatch, side: "home" | "away") {
  return match.score?.[side] ?? match.scores?.value?.[side] ?? match.scores?.[side];
}

function getFriendlyTournamentName(tournamentId: string) {
  if (tournamentId === "fifa-world-cup-2026") {
    return "FIFA World Cup 2026";
  }

  return tournamentId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getSeasonFromDates(dates: string[]) {
  return dates[0]?.slice(0, 4);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
