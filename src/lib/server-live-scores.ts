import {
  fetchBigBallsLeagueMatches,
  getSportsLeagueSyncConfig,
  normalizeBigBallsMatches,
} from "@/lib/big-balls-data";
import {
  fetchSportsTournamentSnapshots,
  recordSportsSyncFailure,
  syncSportsDataSnapshot,
} from "@/lib/server-sports-data";
import { fetchWorldCup26FallbackSnapshot } from "@/lib/worldcup26-fallback";
import type {
  LiveScoresSnapshot,
  SportsFixture,
  SportsTournamentSnapshot,
} from "@/types/sports-data";

const defaultTournamentId = "fifa-world-cup-2026";
const staleMinutes = 10;

export async function getLiveScoresSnapshot(
  tournamentId = defaultTournamentId,
): Promise<LiveScoresSnapshot> {
  const cached = await getCachedTournament(tournamentId);

  if (cached && !isCacheStale(cached)) {
    return buildLiveScoresSnapshot(cached, "cache", false);
  }

  const refreshed = await refreshLiveScores(tournamentId).catch(async (error) => {
    await recordSportsSyncFailure({
      message: error instanceof Error ? error.message : "Live score refresh failed.",
      tournamentId,
      feature: "live-scores",
    });

    return null;
  });

  if (refreshed) {
    return buildLiveScoresSnapshot(refreshed.snapshot, refreshed.source, false);
  }

  if (cached) {
    return buildLiveScoresSnapshot(cached, "cache", true);
  }

  return {
    tournamentId,
    tournamentName: "FIFA World Cup 2026",
    source: "cache",
    stale: true,
    live: [],
    upcoming: [],
    completed: [],
    fixtures: [],
  };
}

async function refreshLiveScores(tournamentId: string) {
  const config = getSportsLeagueSyncConfig().find(
    (item) => item.tournamentId === tournamentId,
  );

  if (!config) {
    return null;
  }

  const syncedAt = new Date().toISOString();

  try {
    const matches = await fetchBigBallsLeagueMatches(config);
    const snapshot = normalizeBigBallsMatches(config, matches, syncedAt);

    await syncSportsDataSnapshot(config, snapshot);
    return {
      snapshot: {
        ...snapshot.tournament,
        teams: snapshot.teams,
        fixtures: snapshot.fixtures,
      },
      source: "big-balls-data" as const,
    };
  } catch (error) {
    const fallbackSnapshot = await fetchWorldCup26FallbackSnapshot(
      config,
      syncedAt,
    );

    if (!fallbackSnapshot) {
      throw error;
    }

    await syncSportsDataSnapshot(config, fallbackSnapshot);
    return {
      snapshot: {
        ...fallbackSnapshot.tournament,
        teams: fallbackSnapshot.teams,
        fixtures: fallbackSnapshot.fixtures,
      },
      source: "worldcup26" as const,
    };
  }
}

async function getCachedTournament(tournamentId: string) {
  const tournaments = await fetchSportsTournamentSnapshots();

  return tournaments.find((tournament) => tournament.id === tournamentId) ?? null;
}

function buildLiveScoresSnapshot(
  tournament: SportsTournamentSnapshot,
  source: LiveScoresSnapshot["source"],
  stale: boolean,
): LiveScoresSnapshot {
  const sortedFixtures = tournament.fixtures
    .slice()
    .sort(compareFixturesByDate);

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    source,
    lastSyncedAt: tournament.lastSyncedAt,
    nextRefreshAt: tournament.lastSyncedAt
      ? new Date(
          new Date(tournament.lastSyncedAt).getTime() + staleMinutes * 60_000,
        ).toISOString()
      : undefined,
    stale,
    live: sortedFixtures.filter(isLiveFixture),
    upcoming: sortedFixtures.filter(isUpcomingFixture),
    completed: sortedFixtures.filter(isCompletedFixture).reverse(),
    fixtures: sortedFixtures,
  };
}

function isCacheStale(tournament: SportsTournamentSnapshot) {
  if (!tournament.lastSyncedAt || tournament.fixtures.length === 0) {
    return true;
  }

  const syncedAt = new Date(tournament.lastSyncedAt).getTime();

  return Date.now() - syncedAt > staleMinutes * 60_000;
}

function isLiveFixture(fixture: SportsFixture) {
  const status = fixture.status.toLowerCase();

  return (
    status.includes("live") ||
    status.includes("in_play") ||
    status.includes("in play") ||
    status.includes("1h") ||
    status.includes("2h") ||
    status.includes("half")
  );
}

function isCompletedFixture(fixture: SportsFixture) {
  const status = fixture.status.toLowerCase();

  return (
    status.includes("finished") ||
    status.includes("full") ||
    status === "ft" ||
    status === "completed"
  );
}

function isUpcomingFixture(fixture: SportsFixture) {
  return !isLiveFixture(fixture) && !isCompletedFixture(fixture);
}

function compareFixturesByDate(a: SportsFixture, b: SportsFixture) {
  const aTime = a.kickoffUtc ? new Date(a.kickoffUtc).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.kickoffUtc ? new Date(b.kickoffUtc).getTime() : Number.MAX_SAFE_INTEGER;

  return aTime - bTime;
}
