import type { ChampionshipTemplate } from "@/types/championship";
import type { SportsTournamentSnapshot, SportsSyncResult } from "@/types/sports-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export async function fetchSportsTournaments() {
  const response = await fetch("/api/sports/tournaments", {
    cache: "no-store",
  });

  if (!response.ok) {
    return [] as SportsTournamentSnapshot[];
  }

  const payload = (await response.json()) as {
    tournaments?: SportsTournamentSnapshot[];
  };

  return payload.tournaments ?? [];
}

export async function syncSportsTournaments() {
  const headers: HeadersInit = {};

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  const response = await fetch("/api/sports/sync", {
    headers,
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | SportsSyncResult
    | { message?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && "message" in payload ? payload.message : undefined;

    throw new Error(message ?? "Sports data sync failed.");
  }

  return payload as SportsSyncResult;
}

export function enrichTemplatesWithSportsData(
  templates: ChampionshipTemplate[],
  sportsTournaments: SportsTournamentSnapshot[],
) {
  return templates.map((template) => {
    const sportsTournament = sportsTournaments.find(
      (tournament) => tournament.id === template.id,
    );
    const teamChoices =
      sportsTournament?.teams.map((team) => team.name).filter(Boolean) ?? [];

    if (!sportsTournament || teamChoices.length === 0) {
      return template;
    }

    return {
      ...template,
      startDate: sportsTournament.startDate || template.startDate,
      lockDate: getLockDateBefore(sportsTournament.startDate) || template.lockDate,
      description: `${sportsTournament.matchCount} synced fixture(s), ${sportsTournament.teamCount} team(s). Last synced ${formatDateTime(sportsTournament.lastSyncedAt)}.`,
      defaultBets: template.defaultBets.map((bet) =>
        bet.type === "single-team" || bet.type === "multi-team"
          ? { ...bet, choices: teamChoices }
          : bet,
      ),
    };
  });
}

function getLockDateBefore(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

function formatDateTime(value?: string) {
  if (!value) {
    return "never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
