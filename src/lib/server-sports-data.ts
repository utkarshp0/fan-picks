import { createSupabaseServiceClient, isSupabaseServerConfigured } from "@/lib/supabase-server";
import { isPlaceholderSportsTeamName } from "@/lib/sports-team-utils";
import type {
  NormalizedSportsSync,
  SportsLeagueSyncConfig,
} from "@/lib/big-balls-data";
import type {
  SportsFixture,
  SportsTeam,
  SportsTournament,
  SportsTournamentSnapshot,
} from "@/types/sports-data";

type DbSportsTournament = {
  id: string;
  provider: string;
  provider_league_id: string;
  sport: string;
  league: string;
  name: string;
  season: string;
  start_date: string;
  end_date?: string | null;
  match_count: number;
  team_count: number;
  last_synced_at?: string | null;
};

type DbSportsTeam = {
  id: string;
  tournament_id: string;
  provider_team_id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
};

type DbSportsFixture = {
  id: string;
  tournament_id: string;
  provider_match_id: string;
  sport: string;
  league: string;
  home_team_name: string;
  away_team_name: string;
  home_team_id?: string | null;
  away_team_id?: string | null;
  kickoff_utc?: string | null;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
  raw: Record<string, unknown>;
  last_synced_at?: string | null;
};

export function canUseSportsDataSupabase() {
  return isSupabaseServerConfigured();
}

export async function fetchSportsTournamentSnapshots() {
  if (!canUseSportsDataSupabase()) {
    return [] as SportsTournamentSnapshot[];
  }

  const supabase = createSupabaseServiceClient();
  const { data: tournamentRows, error } = await supabase
    .from("sports_tournaments")
    .select("*")
    .order("start_date", { ascending: true });

  if (error || !tournamentRows) {
    return [];
  }

  const tournamentIds = (tournamentRows as DbSportsTournament[]).map(
    (row) => row.id,
  );
  const [teamsByTournament, fixturesByTournament] = await Promise.all([
    fetchSportsTeamsByTournamentId(tournamentIds),
    fetchSportsFixturesByTournamentId(tournamentIds),
  ]);

  return (tournamentRows as DbSportsTournament[]).map((row) => ({
    ...mapSportsTournamentFromDb(row),
    teams: teamsByTournament.get(row.id) ?? [],
    fixtures: fixturesByTournament.get(row.id) ?? [],
  }));
}

export async function syncSportsDataSnapshot(
  config: SportsLeagueSyncConfig,
  snapshot: NormalizedSportsSync,
) {
  if (!canUseSportsDataSupabase()) {
    throw new Error("Supabase server client is not configured.");
  }

  const supabase = createSupabaseServiceClient();

  const { error: tournamentError } = await supabase
    .from("sports_tournaments")
    .upsert(mapSportsTournamentToDb(snapshot.tournament), { onConflict: "id" });

  if (tournamentError) {
    throw new Error(tournamentError.message);
  }

  if (snapshot.teams.length > 0) {
    const { error: deleteTeamError } = await supabase
      .from("sports_teams")
      .delete()
      .eq("tournament_id", snapshot.tournament.id);

    if (deleteTeamError) {
      throw new Error(deleteTeamError.message);
    }

    const { error: teamError } = await supabase
      .from("sports_teams")
      .upsert(snapshot.teams.map(mapSportsTeamToDb), { onConflict: "id" });

    if (teamError) {
      throw new Error(teamError.message);
    }
  }

  if (snapshot.fixtures.length > 0) {
    const { error: fixtureError } = await supabase
      .from("sports_fixtures")
      .upsert(snapshot.fixtures.map(mapSportsFixtureToDb), { onConflict: "id" });

    if (fixtureError) {
      throw new Error(fixtureError.message);
    }
  }

  await supabase.from("sports_sync_runs").insert({
    provider: "big-balls-data",
    status: "success",
    details: {
      tournamentId: config.tournamentId,
      league: config.league,
      fixtures: snapshot.fixtures.length,
      teams: snapshot.teams.length,
    },
  });
}

export async function recordSportsSyncFailure(details: Record<string, unknown>) {
  if (!canUseSportsDataSupabase()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  await supabase.from("sports_sync_runs").insert({
    provider: "big-balls-data",
    status: "failed",
    details,
  });
}

async function fetchSportsTeamsByTournamentId(tournamentIds: string[]) {
  const teamsByTournamentId = new Map<string, SportsTeam[]>();

  if (tournamentIds.length === 0) {
    return teamsByTournamentId;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sports_teams")
    .select("*")
    .in("tournament_id", tournamentIds)
    .order("name", { ascending: true });

  if (error || !data) {
    return teamsByTournamentId;
  }

  for (const row of data as DbSportsTeam[]) {
    if (isPlaceholderSportsTeamName(row.name)) {
      continue;
    }

    const current = teamsByTournamentId.get(row.tournament_id) ?? [];
    current.push(mapSportsTeamFromDb(row));
    teamsByTournamentId.set(row.tournament_id, current);
  }

  return teamsByTournamentId;
}

async function fetchSportsFixturesByTournamentId(tournamentIds: string[]) {
  const fixturesByTournamentId = new Map<string, SportsFixture[]>();

  if (tournamentIds.length === 0) {
    return fixturesByTournamentId;
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sports_fixtures")
    .select("*")
    .in("tournament_id", tournamentIds)
    .order("kickoff_utc", { ascending: true });

  if (error || !data) {
    return fixturesByTournamentId;
  }

  for (const row of data as DbSportsFixture[]) {
    const current = fixturesByTournamentId.get(row.tournament_id) ?? [];
    current.push(mapSportsFixtureFromDb(row));
    fixturesByTournamentId.set(row.tournament_id, current);
  }

  return fixturesByTournamentId;
}

function mapSportsTournamentToDb(tournament: SportsTournament) {
  return {
    id: tournament.id,
    provider: tournament.provider,
    provider_league_id: tournament.providerLeagueId,
    sport: tournament.sport,
    league: tournament.league,
    name: tournament.name,
    season: tournament.season,
    start_date: tournament.startDate,
    end_date: tournament.endDate ?? null,
    match_count: tournament.matchCount,
    team_count: tournament.teamCount,
    last_synced_at: tournament.lastSyncedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

function mapSportsTeamToDb(team: SportsTeam) {
  return {
    id: team.id,
    tournament_id: team.tournamentId,
    provider_team_id: team.providerTeamId,
    name: team.name,
    short_name: team.shortName ?? null,
    logo_url: team.logoUrl ?? null,
    updated_at: new Date().toISOString(),
  };
}

function mapSportsFixtureToDb(fixture: SportsFixture) {
  return {
    id: fixture.id,
    tournament_id: fixture.tournamentId,
    provider_match_id: fixture.providerMatchId,
    sport: fixture.sport,
    league: fixture.league,
    home_team_name: fixture.homeTeamName,
    away_team_name: fixture.awayTeamName,
    home_team_id: fixture.homeTeamId ?? null,
    away_team_id: fixture.awayTeamId ?? null,
    kickoff_utc: fixture.kickoffUtc ?? null,
    status: fixture.status,
    home_score: fixture.homeScore ?? null,
    away_score: fixture.awayScore ?? null,
    raw: fixture.raw,
    last_synced_at: fixture.lastSyncedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

function mapSportsTournamentFromDb(row: DbSportsTournament): SportsTournament {
  return {
    id: row.id,
    provider: row.provider === "big-balls-data" ? "big-balls-data" : "manual",
    providerLeagueId: row.provider_league_id,
    sport: row.sport,
    league: row.league,
    name: row.name,
    season: row.season,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    matchCount: row.match_count,
    teamCount: row.team_count,
    lastSyncedAt: row.last_synced_at ?? undefined,
  };
}

function mapSportsTeamFromDb(row: DbSportsTeam): SportsTeam {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    providerTeamId: row.provider_team_id,
    name: row.name,
    shortName: row.short_name ?? undefined,
    logoUrl: row.logo_url ?? undefined,
  };
}

function mapSportsFixtureFromDb(row: DbSportsFixture): SportsFixture {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    providerMatchId: row.provider_match_id,
    sport: row.sport,
    league: row.league,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    homeTeamId: row.home_team_id ?? undefined,
    awayTeamId: row.away_team_id ?? undefined,
    kickoffUtc: row.kickoff_utc ?? undefined,
    status: row.status,
    homeScore: row.home_score ?? undefined,
    awayScore: row.away_score ?? undefined,
    raw: row.raw,
    lastSyncedAt: row.last_synced_at ?? undefined,
  };
}
