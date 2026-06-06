import { createSupabaseServiceClient, isSupabaseServerConfigured } from "@/lib/supabase-server";
import type { Championship, ChampionshipParticipant } from "@/types/championship";
import type { AnonymousProfile } from "@/types/profile";

type ActionResult<T = unknown> =
  | ({ ok: true; message: string } & T)
  | { ok: false; message: string; status: number };

type CreatePoolInput = {
  championship: Championship;
  creator: AnonymousProfile;
};

export function validateCreatedPoolPayload(input: CreatePoolInput, userId: string) {
  const { championship, creator } = input;

  if (!championship?.id) {
    return "Pool payload is missing an id.";
  }

  if (creator.id !== userId || championship.creatorProfileId !== userId) {
    return "Pool creator does not match the logged-in user.";
  }

  const creatorParticipant = getCreatorParticipant(championship, userId);

  if (!creatorParticipant) {
    return "Pool creation requires an active creator participant.";
  }

  if (creatorParticipant.leftAt) {
    return "Creator participant cannot be marked as left during pool creation.";
  }

  if (!championship.bets.length) {
    return "Create at least one bet before creating the pool.";
  }

  return "";
}

export async function createPoolOnServer(
  accessToken: string,
  input: CreatePoolInput,
): Promise<ActionResult<{ championship: Championship }>> {
  if (!isSupabaseServerConfigured()) {
    return { ok: false, message: "Supabase server is not configured.", status: 503 };
  }

  const supabase = createSupabaseServiceClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return { ok: false, message: "Login required.", status: 401 };
  }

  const validationMessage = validateCreatedPoolPayload(input, user.id);

  if (validationMessage) {
    return { ok: false, message: validationMessage, status: 400 };
  }

  const { championship, creator } = input;
  const creatorParticipant = getCreatorParticipant(championship, user.id);

  if (!creatorParticipant) {
    return {
      ok: false,
      message: "Pool creation requires an active creator participant.",
      status: 400,
    };
  }

  const profileResult = await upsertProfile(creator);

  if (!profileResult.ok) {
    return profileResult;
  }

  let championshipInserted = false;

  try {
    const { error: championshipError } = await supabase.from("championships").insert({
      id: championship.id,
      template_id: championship.tournamentId,
      name: championship.name,
      slug: championship.slug,
      invite_code: championship.inviteCode,
      status: championship.status,
      start_date: championship.startDate,
      lock_date: championship.lockDate,
      is_public: true,
      created_by: user.id,
      created_at: championship.createdAt,
    });

    if (championshipError) {
      return {
        ok: false,
        message: `Pool could not be created: ${championshipError.message}`,
        status: 400,
      };
    }

    championshipInserted = true;

    const participantResult = await insertCreatorParticipant(
      championship.id,
      creatorParticipant,
    );

    if (!participantResult.ok) {
      throw new Error(participantResult.message);
    }

    const betResult = await insertPoolBets(championship);

    if (!betResult.ok) {
      throw new Error(betResult.message);
    }

    const auditResult = await insertAuditEvents(championship);

    if (!auditResult.ok) {
      throw new Error(auditResult.message);
    }

    return {
      ok: true,
      championship: { ...championship, isPublic: true },
      message: "Pool created.",
    };
  } catch (error) {
    if (championshipInserted) {
      await supabase.from("championships").delete().eq("id", championship.id);
    }

    return {
      ok: false,
      message:
        error instanceof Error
          ? `Pool creation failed before membership was saved: ${error.message}`
          : "Pool creation failed before membership was saved.",
      status: 500,
    };
  }
}

async function upsertProfile(profile: AnonymousProfile): Promise<ActionResult> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("profiles").upsert({
    id: profile.id,
    display_name: profile.displayName,
    handle: profile.handle,
    created_at: profile.createdAt,
    last_seen_at: new Date().toISOString(),
  });

  if (error) {
    return {
      ok: false,
      message: `Profile could not be synced: ${error.message}`,
      status: 400,
    };
  }

  return { ok: true, message: "Profile synced." };
}

async function insertCreatorParticipant(
  championshipId: string,
  participant: ChampionshipParticipant,
): Promise<ActionResult> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("participants").insert({
    id: participant.id,
    championship_id: championshipId,
    profile_id: participant.profileId,
    display_name: participant.displayName,
    handle: participant.handle,
    role: "creator",
    joined_at: participant.joinedAt,
    left_at: null,
    submission_status: participant.submissionStatus,
    locked_status: participant.lockedStatus,
  });

  if (error) {
    return {
      ok: false,
      message: `Creator membership could not be saved: ${error.message}`,
      status: 400,
    };
  }

  return { ok: true, message: "Creator membership saved." };
}

async function insertPoolBets(championship: Championship): Promise<ActionResult> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("pool_bets").insert(
    championship.bets.map((bet, index) => ({
      championship_id: championship.id,
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

  if (error) {
    return {
      ok: false,
      message: `Pool bets could not be saved: ${error.message}`,
      status: 400,
    };
  }

  return { ok: true, message: "Pool bets saved." };
}

async function insertAuditEvents(championship: Championship): Promise<ActionResult> {
  if (championship.auditLog.length === 0) {
    return { ok: true, message: "No audit events to save." };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("audit_events").insert(
    championship.auditLog.map((event) => ({
      id: event.id,
      championship_id: championship.id,
      type: event.type,
      label: event.label,
      actor_name: event.actorName,
      details: event.details,
      created_at: event.timestamp,
    })),
  );

  if (error) {
    return {
      ok: false,
      message: `Audit events could not be saved: ${error.message}`,
      status: 400,
    };
  }

  return { ok: true, message: "Audit events saved." };
}

function getCreatorParticipant(championship: Championship, userId: string) {
  return championship.participants.find(
    (participant) =>
      participant.profileId === userId && participant.role === "creator",
  );
}
