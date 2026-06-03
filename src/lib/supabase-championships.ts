"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { getChampionshipTemplate } from "@/data/templates";
import type {
  AuditEvent,
  Championship,
  ChampionshipParticipant,
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
  championship_id: string;
  profile_id: string;
  display_name: string;
  handle: string;
  role: ChampionshipParticipant["role"];
  joined_at: string;
  left_at?: string | null;
  rules_accepted_at?: string | null;
  signed_at?: string | null;
  submission_status: ChampionshipParticipant["submissionStatus"];
  locked_status: ChampionshipParticipant["lockedStatus"];
};

type DbPredictionSubmission = {
  id: string;
  championship_id: string;
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
  submission_id: string;
  version_number: number;
  picks: Record<string, string[]>;
  created_at: string;
};

type DbAuditEvent = {
  id: string;
  championship_id: string;
  type: AuditEvent["type"] | string;
  label: string;
  actor_name: string;
  details: string;
  created_at: string;
};

export function canUseSupabase() {
  return isSupabaseConfigured();
}

export async function syncProfileToSupabase(profile: AnonymousProfile) {
  if (!canUseSupabase()) {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  await supabase.from("profiles").upsert({
    id: profile.id,
    display_name: profile.displayName,
    handle: profile.handle,
    created_at: profile.createdAt,
    last_seen_at: new Date().toISOString(),
  });
}

export async function fetchSupabaseChampionships() {
  if (!canUseSupabase()) {
    return null;
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("championships")
    .select(
      "*, participants(*), prediction_submissions(*, prediction_versions!prediction_versions_submission_id_fkey(*)), audit_events(*)",
    )
    .eq("is_public", true)
    .not("created_by", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase championships fetch failed", error.message);
    return null;
  }

  return (data as DbChampionship[]).map(mapChampionshipFromDb);
}

export async function createSupabaseChampionship(
  championship: Championship,
  creator: AnonymousProfile,
) {
  if (!canUseSupabase()) {
    return null;
  }

  const supabase = createSupabaseBrowserClient();
  await syncProfileToSupabase(creator);

  const { data, error } = await supabase
    .from("championships")
    .insert({
      template_id: championship.templateId,
      name: championship.name,
      slug: championship.slug,
      invite_code: championship.inviteCode,
      status: championship.status,
      start_date: championship.startDate,
      lock_date: championship.lockDate,
      is_public: championship.isPublic,
      created_by: creator.id,
      created_at: championship.createdAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn("Supabase championship create failed", error?.message);
    return null;
  }

  const remoteChampionshipId = data.id as string;
  const participant = championship.participants[0];

  if (participant) {
    await upsertSupabaseParticipant(remoteChampionshipId, participant);
  }

  await insertSupabaseAuditEvents(remoteChampionshipId, championship.auditLog);

  return remoteChampionshipId;
}

export async function joinSupabaseChampionship(
  championshipId: string,
  participant: ChampionshipParticipant,
  events: AuditEvent[],
  profile: AnonymousProfile,
) {
  if (!canUseSupabase()) {
    return false;
  }

  await syncProfileToSupabase(profile);
  await upsertSupabaseParticipant(championshipId, participant);
  await insertSupabaseAuditEvents(championshipId, events);
  return true;
}

export async function leaveSupabaseChampionship(
  championshipId: string,
  profileId: string,
  events: AuditEvent[],
) {
  if (!canUseSupabase()) {
    return false;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("participants")
    .update({ left_at: new Date().toISOString() })
    .eq("championship_id", championshipId)
    .eq("profile_id", profileId);

  if (error) {
    console.warn("Supabase leave failed", error.message);
    return false;
  }

  await insertSupabaseAuditEvents(championshipId, events);
  return true;
}

export async function saveSupabasePredictionVersion(
  championshipId: string,
  submission: PredictionSubmission,
  version: PredictionVersion,
  participant: ChampionshipParticipant,
  events: AuditEvent[],
) {
  if (!canUseSupabase()) {
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
        last_edited_at: submission.lastEditedAt,
      },
      { onConflict: "championship_id,profile_id" },
    )
    .select("id")
    .single();

  if (error || !data) {
    console.warn("Supabase prediction save failed", error?.message);
    return false;
  }

  await supabase.from("prediction_versions").insert({
    id: version.id,
    submission_id: data.id,
    version_number: version.versionNumber,
    picks: version.picks,
    created_at: version.createdAt,
  });

  await supabase
    .from("participants")
    .update({ submission_status: "draft" })
    .eq("id", participant.id);

  await insertSupabaseAuditEvents(championshipId, events);
  return true;
}

export async function lockSupabasePrediction(
  championshipId: string,
  submission: PredictionSubmission,
  participant: ChampionshipParticipant,
  events: AuditEvent[],
) {
  if (!canUseSupabase()) {
    return false;
  }

  const supabase = createSupabaseBrowserClient();
  await supabase
    .from("prediction_submissions")
    .update({
      locked_version_id: submission.lockedVersionId,
      locked_at: submission.lockedAt,
      fingerprint: submission.fingerprint,
      last_edited_at: submission.lastEditedAt,
    })
    .eq("id", submission.id);

  await supabase
    .from("participants")
    .update({ submission_status: "submitted", locked_status: "locked" })
    .eq("id", participant.id);

  await insertSupabaseAuditEvents(championshipId, events);
  return true;
}

async function upsertSupabaseParticipant(
  championshipId: string,
  participant: ChampionshipParticipant,
) {
  const supabase = createSupabaseBrowserClient();
  await supabase.from("participants").upsert(
    {
      id: participant.id,
      championship_id: championshipId,
      profile_id: participant.profileId,
      display_name: participant.displayName,
      handle: participant.handle,
      role: participant.role,
      joined_at: participant.joinedAt,
      left_at: null,
      submission_status: participant.submissionStatus,
      locked_status: participant.lockedStatus,
    },
    { onConflict: "championship_id,profile_id" },
  );
}

async function insertSupabaseAuditEvents(
  championshipId: string,
  events: AuditEvent[],
) {
  if (events.length === 0) {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  await supabase.from("audit_events").insert(
    events.map((event) => ({
      id: event.id,
      championship_id: championshipId,
      type: event.type,
      label: event.label,
      actor_name: event.actorName,
      details: event.details,
      created_at: event.timestamp,
    })),
  );
}

function mapChampionshipFromDb(championship: DbChampionship): Championship {
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
    bets: tournament.defaultBets,
    participants: (championship.participants ?? [])
      .filter((participant) => !participant.left_at)
      .map(mapParticipantFromDb),
    predictions: (championship.prediction_submissions ?? []).map(
      mapPredictionFromDb,
    ),
    auditLog: (championship.audit_events ?? [])
      .map(mapAuditEventFromDb)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
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
    submissionStatus: participant.submission_status,
    lockedStatus: participant.locked_status,
  };
}

function mapPredictionFromDb(
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

function mapAuditEventFromDb(event: DbAuditEvent): AuditEvent {
  return {
    id: event.id,
    type: normalizeAuditEventType(event.type),
    label: event.label,
    actorName: event.actor_name,
    timestamp: event.created_at,
    details: event.details,
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

  if (type === "championship_created" || type === "creator_joined") {
    return "pool_created";
  }

  if (type === "rules_generated") {
    return "bet_added";
  }

  return "prediction_draft_saved";
}
