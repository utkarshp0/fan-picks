import { createSupabaseServiceClient } from "@/lib/supabase-server";
import type { AuditEvent, PredictionCategory } from "@/types/championship";

type PoolBetSyncResult =
  | { ok: true; message: string }
  | { ok: false; message: string; status: number };

type ChampionshipRow = {
  id: string;
  created_by: string | null;
  lock_date: string;
};

type SubmissionLockRow = {
  locked_at?: string | null;
};

export async function syncPoolBetsOnServer(
  accessToken: string,
  championshipId: string,
  betsInput: unknown,
  eventsInput: unknown,
): Promise<PoolBetSyncResult> {
  const context = await authenticate(accessToken);

  if (!context.ok) {
    return context;
  }

  const bets = normalizeBets(betsInput);

  if (bets.length === 0) {
    return {
      ok: false,
      message: "A pool needs at least one bet.",
      status: 400,
    };
  }

  const supabase = createSupabaseServiceClient();
  const { data: championship, error: championshipError } = await supabase
    .from("championships")
    .select("id, created_by, lock_date")
    .eq("id", championshipId)
    .maybeSingle();

  if (championshipError) {
    return { ok: false, message: championshipError.message, status: 400 };
  }

  if (!championship) {
    return { ok: false, message: "Pool not found.", status: 404 };
  }

  const pool = championship as ChampionshipRow;

  if (pool.created_by !== context.userId) {
    return {
      ok: false,
      message: "Only the pool creator can edit bets.",
      status: 403,
    };
  }

  if (isPastLockDate(pool.lock_date)) {
    return {
      ok: false,
      message: "The lock date has passed. Bets cannot be changed.",
      status: 400,
    };
  }

  const { data: lockedSubmissions, error: submissionError } = await supabase
    .from("prediction_submissions")
    .select("locked_at")
    .eq("championship_id", championshipId)
    .not("locked_at", "is", null)
    .limit(1);

  if (submissionError) {
    return { ok: false, message: submissionError.message, status: 400 };
  }

  if ((lockedSubmissions as SubmissionLockRow[] | null)?.length) {
    return {
      ok: false,
      message: "Someone has locked picks. Bets cannot be changed now.",
      status: 400,
    };
  }

  const { error: deleteError } = await supabase
    .from("pool_bets")
    .delete()
    .eq("championship_id", championshipId);

  if (deleteError) {
    return { ok: false, message: deleteError.message, status: 400 };
  }

  const { error: insertError } = await supabase.from("pool_bets").insert(
    bets.map((bet, index) => ({
      championship_id: championshipId,
      bet_id: bet.id,
      name: bet.name,
      type: bet.type,
      prompt: bet.prompt,
      selection_count: bet.selectionCount,
      scoring_note: bet.scoringNote,
      choices: bet.choices ?? null,
      source: bet.source,
      sort_order: index,
    })),
  );

  if (insertError) {
    return { ok: false, message: insertError.message, status: 400 };
  }

  const events = normalizeEvents(eventsInput);

  if (events.length > 0) {
    const { error: auditError } = await supabase.from("audit_events").upsert(
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

    if (auditError) {
      return { ok: false, message: auditError.message, status: 400 };
    }
  }

  return { ok: true, message: "Bets synced." };
}

async function authenticate(
  accessToken: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; message: string; status: number }
> {
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

function normalizeBets(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => item as Partial<PredictionCategory>)
    .filter((item) => item.id && item.name && item.type)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      type: item.type as PredictionCategory["type"],
      prompt: String(item.prompt ?? item.name),
      selectionCount: Math.max(1, Number(item.selectionCount) || 1),
      scoringNote: String(item.scoringNote ?? ""),
      choices: Array.isArray(item.choices)
        ? item.choices.map(String).filter(Boolean)
        : undefined,
      source: item.source === "default" ? "default" : "custom",
    }));
}

function normalizeEvents(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => item as Partial<AuditEvent>)
    .filter(
      (item) =>
        item.id &&
        item.type &&
        item.label &&
        item.actorName &&
        item.details &&
        item.timestamp,
    )
    .map((item) => ({
      id: String(item.id),
      type: item.type as AuditEvent["type"],
      label: String(item.label),
      actorName: String(item.actorName),
      details: String(item.details),
      timestamp: String(item.timestamp),
    }));
}

function isPastLockDate(value: string) {
  return Date.now() >= new Date(`${value}T23:59:59`).getTime();
}
