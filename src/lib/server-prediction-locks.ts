import { createHash, randomUUID } from "node:crypto";

import { getChampionshipTemplate } from "@/data/templates";
import { getAppNowIso, isPastPoolLockDate } from "@/lib/app-clock";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import type { PredictionCategory } from "@/types/championship";
import type { AuditEvent } from "@/types/championship";

type LockActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; status: number };

type AuthenticatedContext = {
  userId: string;
};

type ChampionshipRow = {
  id: string;
  name: string;
  template_id: string;
  lock_date: string;
};

type ParticipantRow = {
  id: string;
  display_name: string;
};

type SubmissionRow = {
  id: string;
  locked_at?: string | null;
  locked_version_id?: string | null;
};

type VersionRow = {
  id: string;
  version_number: number;
  picks: Record<string, string[]>;
};

export async function lockPredictionOnServer(
  accessToken: string,
  championshipId: string,
): Promise<LockActionResult> {
  const context = await authenticate(accessToken);

  if (!context.ok) {
    return context;
  }

  const supabase = createSupabaseServiceClient();
  const resolved = await resolvePredictionContext(championshipId, context.userId);

  if (!resolved.ok) {
    return resolved;
  }

  const { championship, participant, submission } = resolved;

  if (isPastLockDate(championship.lock_date)) {
    return {
      ok: false,
      message: "The lock date has passed. Saved picks are already final.",
      status: 400,
    };
  }

  if (submission.locked_at) {
    return { ok: true, message: "Picks are already locked." };
  }

  const { data: versions, error: versionsError } = await supabase
    .from("prediction_versions")
    .select("id, version_number, picks")
    .eq("submission_id", submission.id)
    .order("version_number", { ascending: false })
    .limit(1);

  if (versionsError) {
    return { ok: false, message: versionsError.message, status: 400 };
  }

  const latestVersion = (versions?.[0] ?? null) as VersionRow | null;

  if (!latestVersion) {
    return {
      ok: false,
      message: "Save picks before locking.",
      status: 400,
    };
  }

  const bets = await getBetsForChampionship(championship.id, championship.template_id);
  const pickValidationMessage = validateLockPicks(bets, latestVersion.picks);

  if (pickValidationMessage) {
    return {
      ok: false,
      message: pickValidationMessage,
      status: 400,
    };
  }

  const lockedAt = getAppNowIso();
  const fingerprint = createPredictionFingerprint({
    championshipId,
    participantId: participant.id,
    versionId: latestVersion.id,
    picks: latestVersion.picks,
    lockedAt,
  });
  const { error: updateError } = await supabase
    .from("prediction_submissions")
    .update({
      locked_version_id: latestVersion.id,
      locked_at: lockedAt,
      fingerprint,
      last_edited_at: lockedAt,
    })
    .eq("id", submission.id);

  if (updateError) {
    return { ok: false, message: updateError.message, status: 400 };
  }

  await supabase
    .from("participants")
    .update({ submission_status: "submitted", locked_status: "locked" })
    .eq("id", participant.id);

  await insertAuditEvent(championshipId, {
    type: "prediction_locked",
    actorName: participant.display_name,
    label: "Picks locked",
    details: `${participant.display_name} locked version ${latestVersion.version_number}.`,
  });

  return { ok: true, message: "Picks locked." };
}

export async function unlockPredictionOnServer(
  accessToken: string,
  championshipId: string,
): Promise<LockActionResult> {
  const context = await authenticate(accessToken);

  if (!context.ok) {
    return context;
  }

  const supabase = createSupabaseServiceClient();
  const resolved = await resolvePredictionContext(championshipId, context.userId);

  if (!resolved.ok) {
    return resolved;
  }

  const { championship, participant, submission } = resolved;

  if (isPastLockDate(championship.lock_date)) {
    return {
      ok: false,
      message: "The lock date has passed. Locked picks cannot be reopened.",
      status: 400,
    };
  }

  if (!submission.locked_at) {
    return { ok: true, message: "Picks are already editable." };
  }

  const { error: updateError } = await supabase
    .from("prediction_submissions")
    .update({
      locked_version_id: null,
      locked_at: null,
      fingerprint: null,
      last_edited_at: getAppNowIso(),
    })
    .eq("id", submission.id);

  if (updateError) {
    return { ok: false, message: updateError.message, status: 400 };
  }

  await supabase
    .from("participants")
    .update({ submission_status: "draft", locked_status: "unlocked" })
    .eq("id", participant.id);

  await insertAuditEvent(championshipId, {
    type: "prediction_unlocked",
    actorName: participant.display_name,
    label: "Picks reopened",
    details: `${participant.display_name} reopened locked picks before the lock date.`,
  });

  return { ok: true, message: "Picks reopened. You can edit until the lock date." };
}

async function authenticate(
  accessToken: string,
): Promise<({ ok: true } & AuthenticatedContext) | { ok: false; message: string; status: number }> {
  if (!accessToken) {
    return { ok: false, message: "Login required.", status: 401 };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { ok: false, message: "Login required.", status: 401 };
  }

  return { ok: true, userId: data.user.id };
}

async function resolvePredictionContext(championshipId: string, profileId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: championship, error: championshipError } = await supabase
    .from("championships")
    .select("id, name, template_id, lock_date")
    .eq("id", championshipId)
    .maybeSingle();

  if (championshipError) {
    return { ok: false as const, message: championshipError.message, status: 400 };
  }

  if (!championship) {
    return { ok: false as const, message: "Pool not found.", status: 404 };
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, display_name")
    .eq("championship_id", championshipId)
    .eq("profile_id", profileId)
    .is("left_at", null)
    .maybeSingle();

  if (participantError) {
    return { ok: false as const, message: participantError.message, status: 400 };
  }

  if (!participant) {
    return {
      ok: false as const,
      message: "Join this pool before changing locked picks.",
      status: 403,
    };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("prediction_submissions")
    .select("id, locked_at, locked_version_id")
    .eq("championship_id", championshipId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (submissionError) {
    return { ok: false as const, message: submissionError.message, status: 400 };
  }

  if (!submission) {
    return { ok: false as const, message: "Save picks before locking.", status: 400 };
  }

  return {
    ok: true as const,
    championship: championship as ChampionshipRow,
    participant: participant as ParticipantRow,
    submission: submission as SubmissionRow,
  };
}

async function getBetsForChampionship(
  championshipId: string,
  templateId: string,
) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("pool_bets")
    .select(
      "bet_id, name, type, prompt, selection_count, scoring_note, choices, source, sort_order",
    )
    .eq("championship_id", championshipId)
    .order("sort_order", { ascending: true });

  if (data?.length) {
    return data.map((row) => ({
      id: row.bet_id as string,
      name: row.name as string,
      type: row.type as PredictionCategory["type"],
      prompt: row.prompt as string,
      selectionCount: row.selection_count as number,
      scoringNote: row.scoring_note as string,
      choices: (row.choices as string[] | null) ?? undefined,
      source: row.source as PredictionCategory["source"],
    }));
  }

  return getChampionshipTemplate(templateId).defaultBets;
}

export function validateLockPicks(
  bets: PredictionCategory[],
  picks: Record<string, string[]>,
) {
  const invalidBet = bets.find(
    (bet) => (picks[bet.id]?.filter(Boolean).length ?? 0) !== bet.selectionCount,
  );

  if (!invalidBet) {
    return "";
  }

  return `${invalidBet.name} requires exactly ${invalidBet.selectionCount} pick(s).`;
}

async function insertAuditEvent(
  championshipId: string,
  event: Pick<AuditEvent, "type" | "actorName" | "label" | "details">,
) {
  const supabase = createSupabaseServiceClient();
  await supabase.from("audit_events").insert({
    id: randomUUID(),
    championship_id: championshipId,
    type: event.type,
    label: event.label,
    actor_name: event.actorName,
    details: event.details,
    created_at: getAppNowIso(),
  });
}

function createPredictionFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function isPastLockDate(value: string) {
  return isPastPoolLockDate(value);
}
