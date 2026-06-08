"use client";

import { getChampionshipTemplate } from "@/data/templates";
import {
  guestProfileChangeEvent,
  guestProfileStorageKey,
} from "@/components/auth/guest-session-provider";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type {
  AuditEvent,
  Championship,
  ChampionshipParticipant,
  PredictionCategory,
  PredictionSubmission,
  PredictionVersion,
} from "@/types/championship";
import type { AnonymousProfile } from "@/types/profile";

type DbChampionship = {
  id: string;
  template_id: string;
  name: string;
  slug: string;
  invite_code: string;
  status: Championship["status"] | "draft";
  start_date: string;
  lock_date: string;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  participants?: DbParticipant[];
  prediction_submissions?: DbPredictionSubmission[];
  audit_events?: DbAuditEvent[];
};

type DbParticipant = {
  id: string;
  profile_id: string;
  display_name: string;
  handle: string;
  role: ChampionshipParticipant["role"];
  joined_at: string;
  left_at?: string | null;
  submission_status: ChampionshipParticipant["submissionStatus"];
  locked_status: ChampionshipParticipant["lockedStatus"];
};

type DbAuditEvent = {
  id: string;
  type: AuditEvent["type"] | string;
  label: string;
  actor_name: string;
  details: string;
  created_at: string;
};

type DbPredictionSubmission = {
  id: string;
  participant_id: string;
  profile_id: string;
  display_name: string;
  locked_version_id?: string | null;
  locked_at?: string | null;
  fingerprint?: string | null;
  last_edited_at?: string | null;
  prediction_versions?: DbPredictionVersion[];
};

type DbPredictionVersion = {
  id: string;
  version_number: number;
  picks: Record<string, string[]>;
  created_at: string;
};

type DbPoolBet = {
  id: string;
  championship_id: string;
  bet_id: string;
  name: string;
  type: PredictionCategory["type"];
  prompt: string;
  selection_count: number;
  scoring_note: string;
  choices?: string[] | null;
  source: PredictionCategory["source"];
  sort_order: number;
};

type CreatePoolResult =
  | { ok: true; championship: Championship; message: string }
  | { ok: false; message: string };

export function canUsePoolSupabase() {
  return isSupabaseConfigured();
}

async function getRequiredAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? "";
}

function handleUnauthorizedResponse(status: number) {
  if (status !== 401 || typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(guestProfileStorageKey);
  window.dispatchEvent(new Event(guestProfileChangeEvent));
}

export async function syncPoolProfile(profile: AnonymousProfile) {
  if (!canUsePoolSupabase()) {
    return false;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("profiles").upsert({
    id: profile.id,
    display_name: profile.displayName,
    handle: profile.handle,
    created_at: profile.createdAt,
    last_seen_at: new Date().toISOString(),
  });

  return !error;
}

export async function fetchSupabasePools() {
  if (!canUsePoolSupabase()) {
    return null;
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("championships")
    .select(
      "*, participants(*), prediction_submissions(*, prediction_versions!prediction_versions_submission_id_fkey(*)), audit_events(*)",
    )
    .not("created_by", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase pool fetch failed", error.message);
    return null;
  }

  const rows = data as DbChampionship[];
  const betsByChampionshipId = await fetchPoolBetsByChampionshipId(
    rows.map((row) => row.id),
  );

  return rows.map((row) =>
    mapPoolFromDb(row, betsByChampionshipId.get(row.id) ?? null),
  );
}

export async function createSupabasePool(
  championship: Championship,
  creator: AnonymousProfile,
): Promise<CreatePoolResult> {
  if (!canUsePoolSupabase()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const accessToken = await getRequiredAccessToken();

  if (!accessToken) {
    handleUnauthorizedResponse(401);
    return { ok: false, message: "Login required." };
  }

  const response = await fetch("/api/pools/create", {
    body: JSON.stringify({ championship, creator }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result = (await response.json()) as
    | { ok: true; championship: Championship; message: string }
    | { ok: false; message: string; status?: number };

  if (!response.ok || !result.ok) {
    handleUnauthorizedResponse(response.status);
    console.warn("Supabase pool create failed", result.message);
    return { ok: false, message: result.message };
  }

  return { ok: true, championship: result.championship, message: result.message };
}

export async function joinSupabasePool(
  championshipId: string,
  participant: ChampionshipParticipant,
  profile: AnonymousProfile,
  events: AuditEvent[],
) {
  if (!canUsePoolSupabase()) {
    return false;
  }

  await syncPoolProfile(profile);
  await upsertParticipant(championshipId, participant);
  await insertAuditEvents(championshipId, events);
  return true;
}

export async function leaveSupabasePool(
  championshipId: string,
  profileId: string,
  events: AuditEvent[],
) {
  if (!canUsePoolSupabase()) {
    return false;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("participants")
    .update({ left_at: new Date().toISOString() })
    .eq("championship_id", championshipId)
    .eq("profile_id", profileId);

  if (error) {
    console.warn("Supabase pool leave failed", error.message);
    return false;
  }

  await insertAuditEvents(championshipId, events);
  return true;
}

export async function saveSupabasePredictionDraft(
  championshipId: string,
  submission: PredictionSubmission,
  version: PredictionVersion,
  participant: ChampionshipParticipant,
  events: AuditEvent[],
) {
  if (!canUsePoolSupabase()) {
    return false;
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("prediction_submissions")
    .upsert(
      {
        id: submission.id,
        championship_id: championshipId,
        participant_id: participant.id,
        profile_id: participant.profileId,
        display_name: participant.displayName,
        locked_version_id: submission.lockedVersionId ?? null,
        locked_at: submission.lockedAt ?? null,
        fingerprint: submission.fingerprint ?? null,
        last_edited_at: submission.lastEditedAt ?? null,
      },
      { onConflict: "championship_id,profile_id" },
    )
    .select("id")
    .single();

  if (error || !data) {
    console.warn("Supabase prediction draft save failed", error?.message);
    return false;
  }

  const { error: versionError } = await supabase
    .from("prediction_versions")
    .upsert(
      {
        id: version.id,
        submission_id: data.id as string,
        version_number: version.versionNumber,
        picks: version.picks,
        created_at: version.createdAt,
      },
      {
        ignoreDuplicates: true,
        onConflict: "submission_id,version_number",
      },
    );

  if (versionError) {
    console.warn("Supabase prediction version save failed", versionError.message);
    return false;
  }

  await upsertParticipant(championshipId, {
    ...participant,
    submissionStatus: "draft",
  });
  await insertAuditEvents(championshipId, events);
  return true;
}

export async function lockSupabasePrediction(championshipId: string) {
  if (!canUsePoolSupabase()) {
    return false;
  }

  const accessToken = await getRequiredAccessToken();

  if (!accessToken) {
    handleUnauthorizedResponse(401);
    return false;
  }

  const response = await fetch("/api/predictions/lock", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ championshipId }),
  });

  if (!response.ok) {
    handleUnauthorizedResponse(response.status);
    const result = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    console.warn("Supabase prediction lock failed", result?.message ?? response.statusText);
    return false;
  }

  return true;
}

export async function unlockSupabasePrediction(championshipId: string) {
  if (!canUsePoolSupabase()) {
    return false;
  }

  const accessToken = await getRequiredAccessToken();

  if (!accessToken) {
    handleUnauthorizedResponse(401);
    return false;
  }

  const response = await fetch("/api/predictions/unlock", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ championshipId }),
  });

  if (!response.ok) {
    handleUnauthorizedResponse(response.status);
    const result = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    console.warn(
      "Supabase prediction unlock failed",
      result?.message ?? response.statusText,
    );
    return false;
  }

  return true;
}

export async function syncSupabasePoolBets(
  championshipId: string,
  bets: PredictionCategory[],
  events: AuditEvent[],
) {
  if (!canUsePoolSupabase()) {
    return false;
  }

  const accessToken = await getRequiredAccessToken();

  if (!accessToken) {
    handleUnauthorizedResponse(401);
    return false;
  }

  const response = await fetch("/api/pool-bets/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bets, championshipId, events }),
  });

  if (!response.ok) {
    handleUnauthorizedResponse(response.status);
    const result = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    console.warn("Supabase pool bets sync failed", result?.message ?? response.statusText);
    return false;
  }

  return true;
}

async function fetchPoolBetsByChampionshipId(championshipIds: string[]) {
  const betsByChampionshipId = new Map<string, PredictionCategory[]>();

  if (championshipIds.length === 0 || !canUsePoolSupabase()) {
    return betsByChampionshipId;
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("pool_bets")
    .select("*")
    .in("championship_id", championshipIds)
    .order("sort_order", { ascending: true });

  if (error) {
    if (!isMissingPoolBetsTable(error.message)) {
      console.warn("Supabase pool bets fetch failed", error.message);
    }
    return betsByChampionshipId;
  }

  for (const row of data as DbPoolBet[]) {
    const current = betsByChampionshipId.get(row.championship_id) ?? [];
    current.push(mapBetFromDb(row));
    betsByChampionshipId.set(row.championship_id, current);
  }

  return betsByChampionshipId;
}

async function upsertParticipant(
  championshipId: string,
  participant?: ChampionshipParticipant,
) {
  if (!participant || !canUsePoolSupabase()) {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("participants").upsert(
    {
      id: participant.id,
      championship_id: championshipId,
      profile_id: participant.profileId,
      display_name: participant.displayName,
      handle: participant.handle,
      role: participant.role,
      joined_at: participant.joinedAt,
      left_at: participant.leftAt ?? null,
      submission_status: participant.submissionStatus,
      locked_status: participant.lockedStatus,
    },
    { onConflict: "championship_id,profile_id" },
  );

  if (error) {
    console.warn("Supabase participant save failed", error.message);
  }
}

async function insertAuditEvents(championshipId: string, events: AuditEvent[]) {
  if (events.length === 0 || !canUsePoolSupabase()) {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("audit_events")
    .upsert(
      events.map((event) => ({
        id: event.id,
        championship_id: championshipId,
        type: event.type,
        label: event.label,
        actor_name: event.actorName,
        details: event.details,
        created_at: event.timestamp,
      })),
      { ignoreDuplicates: true, onConflict: "id" },
    );

  if (error) {
    console.warn("Supabase audit save failed", error.message);
  }
}

function mapPoolFromDb(
  championship: DbChampionship,
  remoteBets: PredictionCategory[] | null,
): Championship {
  const tournament = getChampionshipTemplate(championship.template_id);

  return {
    id: championship.id,
    tournamentId: championship.template_id,
    templateId: championship.template_id,
    name: championship.name,
    slug: championship.slug,
    inviteCode: championship.invite_code,
    status: championship.status === "draft" ? "open" : championship.status,
    startDate: championship.start_date,
    lockDate: championship.lock_date,
    isPublic: championship.is_public,
    createdAt: championship.created_at,
    creatorProfileId: championship.created_by ?? "system",
    bets: remoteBets?.length ? remoteBets : tournament.defaultBets,
    participants: (championship.participants ?? []).map(mapParticipantFromDb),
    predictions: (championship.prediction_submissions ?? []).map(
      mapPredictionSubmissionFromDb,
    ),
    auditLog: (championship.audit_events ?? [])
      .map(mapAuditEventFromDb)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
  };
}

function mapPredictionSubmissionFromDb(
  submission: DbPredictionSubmission,
): PredictionSubmission {
  return {
    id: submission.id,
    participantId: submission.participant_id,
    profileId: submission.profile_id,
    displayName: submission.display_name,
    versions: (submission.prediction_versions ?? [])
      .map(mapPredictionVersionFromDb)
      .sort((a, b) => a.versionNumber - b.versionNumber),
    lockedVersionId: submission.locked_version_id ?? undefined,
    lockedAt: submission.locked_at ?? undefined,
    fingerprint: submission.fingerprint ?? undefined,
    lastEditedAt: submission.last_edited_at ?? undefined,
  };
}

function mapPredictionVersionFromDb(
  version: DbPredictionVersion,
): PredictionVersion {
  return {
    id: version.id,
    versionNumber: version.version_number,
    picks: version.picks,
    createdAt: version.created_at,
  };
}

function mapParticipantFromDb(participant: DbParticipant): ChampionshipParticipant {
  return {
    id: participant.id,
    profileId: participant.profile_id,
    displayName: participant.display_name,
    handle: participant.handle,
    role: participant.role,
    joinedAt: participant.joined_at,
    leftAt: participant.left_at ?? undefined,
    submissionStatus: participant.submission_status,
    lockedStatus: participant.locked_status,
  };
}

function mapBetFromDb(row: DbPoolBet): PredictionCategory {
  return {
    id: row.bet_id,
    name: row.name,
    type: row.type,
    prompt: row.prompt,
    selectionCount: row.selection_count,
    scoringNote: row.scoring_note,
    choices: row.choices ?? undefined,
    source: row.source,
  };
}

function mapAuditEventFromDb(event: DbAuditEvent): AuditEvent {
  return {
    id: event.id,
    type: normalizeAuditEventType(event.type),
    label: event.label,
    actorName: event.actor_name,
    details: event.details,
    timestamp: event.created_at,
  };
}

function normalizeAuditEventType(type: string): AuditEvent["type"] {
  if (
    type === "pool_created" ||
    type === "invite_created" ||
    type === "participant_joined" ||
    type === "participant_left" ||
    type === "bet_added" ||
    type === "bet_removed" ||
    type === "prediction_field_changed" ||
    type === "prediction_draft_saved" ||
    type === "prediction_locked" ||
    type === "prediction_unlocked"
  ) {
    return type;
  }

  return "pool_created";
}

function isMissingPoolBetsTable(message: string) {
  return message.includes("pool_bets") && message.includes("schema cache");
}
