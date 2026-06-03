export type SportsDataSource = "big-balls-data" | "manual";

export type SportsTournament = {
  id: string;
  provider: SportsDataSource;
  providerLeagueId: string;
  sport: string;
  league: string;
  name: string;
  season: string;
  startDate: string;
  endDate?: string;
  matchCount: number;
  teamCount: number;
  lastSyncedAt?: string;
};

export type SportsTeam = {
  id: string;
  tournamentId: string;
  providerTeamId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
};

export type SportsFixture = {
  id: string;
  tournamentId: string;
  providerMatchId: string;
  sport: string;
  league: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId?: string;
  awayTeamId?: string;
  kickoffUtc?: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  raw: Record<string, unknown>;
  lastSyncedAt?: string;
};

export type SportsTournamentSnapshot = SportsTournament & {
  teams: SportsTeam[];
  fixtures: SportsFixture[];
};

export type SportsSyncResult = {
  syncedAt: string;
  tournaments: Array<{
    tournamentId: string;
    league: string;
    matches: number;
    teams: number;
  }>;
};
