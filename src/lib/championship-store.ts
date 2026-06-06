"use client";

import { useSyncExternalStore } from "react";

import { getChampionshipTemplate } from "@/data/templates";
import {
  createSupabasePool,
  fetchSupabasePools,
  joinSupabasePool,
  leaveSupabasePool,
  lockSupabasePrediction,
  saveSupabasePredictionDraft,
  syncSupabasePoolBets,
  unlockSupabasePrediction,
} from "@/lib/pool-supabase";
import type {
  AuditEvent,
  Championship,
  ChampionshipParticipant,
  CreateChampionshipInput,
  JoinChampionshipInput,
  PredictionCategory,
  PredictionPicks,
  PredictionSubmission,
  PredictionVersion,
} from "@/types/championship";
import type { AnonymousProfile } from "@/types/profile";

const storageKey = "fan-picks:pools:v1";
const championshipChangeEvent = "fan-picks:pool-change";
const emptyChampionships: Championship[] = [];
let cachedChampionships: Championship[] | null = null;

export function useChampionships() {
  return useSyncExternalStore(
    subscribeToChampionships,
    getChampionshipSnapshot,
    getServerChampionshipSnapshot,
  );
}

export async function refreshChampionshipsFromSupabase() {
  const remoteChampionships = await fetchSupabasePools();

  if (!remoteChampionships) {
    return false;
  }

  mergeAndWriteChampionships(remoteChampionships);
  return true;
}

export async function createChampionship(
  input: CreateChampionshipInput,
  creator: AnonymousProfile,
) {
  const now = new Date().toISOString();
  const tournament = getChampionshipTemplate(input.tournamentId);
  const tournamentName = input.tournamentName?.trim() || tournament.name;
  const name = input.name.trim() || `${tournamentName} Pool`;
  const inviteCode = createInviteCode();
  const availableDefaultBets = input.defaultBets?.length
    ? input.defaultBets
    : tournament.defaultBets;
  const selectedDefaultBets = availableDefaultBets.filter((bet) =>
    input.defaultBetIds.includes(bet.id),
  );
  const customBets = input.customBets
    .filter((bet) => bet.name.trim())
    .map((bet) => ({
      id: createSlugId(bet.name),
      name: bet.name.trim(),
      prompt: bet.prompt.trim() || bet.name.trim(),
      type: bet.type,
      selectionCount: Math.max(1, Number(bet.selectionCount) || 1),
      choices: bet.choices?.filter(Boolean),
      scoringNote: "Creator-defined bet. Score manually after the tournament.",
      source: "custom" as const,
    }));
  const bets = dedupeBets([...selectedDefaultBets, ...customBets]);
  const creatorParticipant: ChampionshipParticipant = {
    id: createId(),
    profileId: creator.id,
    displayName: creator.displayName,
    handle: creator.handle,
    role: "creator",
    joinedAt: now,
    submissionStatus: "not_started",
    lockedStatus: "unlocked",
  };

  const championship: Championship = {
    id: createId(),
    tournamentId: tournament.id,
    templateId: tournament.id,
    name,
    slug: `${slugify(name)}-${inviteCode.toLowerCase()}`,
    inviteCode,
    status: "open",
    startDate: input.startDate || tournament.startDate,
    lockDate: input.lockDate || tournament.lockDate,
    isPublic: false,
    createdAt: now,
    creatorProfileId: creator.id,
    bets,
    participants: [creatorParticipant],
    predictions: [],
    auditLog: [
      createAuditEvent("pool_created", creator.displayName, now, {
        label: "Pool created",
        details: `${creator.displayName} created ${name} for ${tournamentName}.`,
      }),
      createAuditEvent("invite_created", creator.displayName, now, {
        label: "Invite code created",
        details: `Invite code ${inviteCode} is ready to share.`,
      }),
      ...bets.map((bet) =>
        createAuditEvent("bet_added", creator.displayName, now, {
          label: "Bet added",
          details: `${bet.name} was added to the pool.`,
        }),
      ),
    ],
  };

  writeChampionships([championship, ...getChampionshipSnapshot()]);
  await createSupabasePool(championship, creator);
  await refreshChampionshipsFromSupabase();

  return (
    getChampionshipSnapshot().find((item) => item.id === championship.id) ??
    championship
  );
}

export async function joinChampionship(
  championshipId: string,
  profile: AnonymousProfile,
) {
  const championships = getChampionshipSnapshot();
  const championship = championships.find((item) => item.id === championshipId);

  if (!championship) {
    return { championship: null, message: "Pool not found." };
  }

  return addOrRestoreParticipant(championship, championships, profile);
}

export async function joinChampionshipByCode(
  input: JoinChampionshipInput,
  profile: AnonymousProfile,
) {
  const inviteCode = normalizeInviteCode(input.inviteCode);
  let championships = getChampionshipSnapshot();
  let championship = championships.find(
    (item) => normalizeInviteCode(item.inviteCode) === inviteCode,
  );

  if (!championship) {
    await refreshChampionshipsFromSupabase();
    championships = getChampionshipSnapshot();
    championship = championships.find(
      (item) => normalizeInviteCode(item.inviteCode) === inviteCode,
    );
  }

  if (!championship) {
    return {
      championship: null,
      message: "No pool found for that invite code.",
      status: "not_found" as const,
    };
  }

  return addOrRestoreParticipant(championship, championships, profile);
}

export async function leaveChampionship(
  championshipId: string,
  profile: AnonymousProfile,
) {
  const championships = getChampionshipSnapshot();
  const championship = championships.find((item) => item.id === championshipId);

  if (!championship) {
    return { championship: null, message: "Pool not found." };
  }

  const participant = championship.participants.find(
    (item) => item.profileId === profile.id && !item.leftAt,
  );

  if (!participant) {
    return { championship, message: "You are not in this pool." };
  }

  const now = new Date().toISOString();
  const leaveEvent = createAuditEvent("participant_left", profile.displayName, now, {
    label: "Participant left",
    details: `${profile.displayName} left ${championship.name}.`,
  });
  const nextChampionship = {
    ...championship,
    participants: championship.participants.map((item) =>
      item.id === participant.id ? { ...item, leftAt: now } : item,
    ),
    auditLog: [...championship.auditLog, leaveEvent],
  };

  writeChampionships(
    championships.map((item) =>
      item.id === nextChampionship.id ? nextChampionship : item,
    ),
  );
  await leaveSupabasePool(championshipId, profile.id, [leaveEvent]);
  await refreshChampionshipsFromSupabase();

  return {
    championship:
      getChampionshipSnapshot().find((item) => item.id === nextChampionship.id) ??
      nextChampionship,
    message: "Left pool.",
  };
}

export async function savePredictionDraft(
  championshipId: string,
  profile: AnonymousProfile,
  picks: PredictionPicks,
) {
  const championships = getChampionshipSnapshot();
  const championship = championships.find((item) => item.id === championshipId);

  if (!championship) {
    return { championship: null, message: "Pool not found." };
  }

  const participant = getActiveParticipant(championship, profile.id);

  if (!participant) {
    return { championship, message: "Join this pool before saving picks." };
  }

  const existingSubmission = championship.predictions.find(
    (submission) => submission.profileId === profile.id,
  );

  if (existingSubmission?.lockedAt) {
    return { championship, message: "Locked picks cannot be edited." };
  }

  if (isPastLockDate(championship.lockDate)) {
    return { championship, message: "The lock date has passed." };
  }

  const limitMessage = validatePickLimits(championship.bets, picks);

  if (limitMessage) {
    return { championship, message: limitMessage };
  }

  const now = new Date().toISOString();
  const versionNumber = (existingSubmission?.versions.length ?? 0) + 1;
  const previousPicks = existingSubmission?.versions.at(-1)?.picks ?? {};
  const fieldChangeEvents = getPredictionFieldChangeEvents(
    championship.bets,
    previousPicks,
    picks,
    participant.displayName,
    now,
  );
  const nextVersion: PredictionVersion = {
    id: createId(),
    versionNumber,
    picks,
    createdAt: now,
  };
  const nextSubmission: PredictionSubmission = existingSubmission
    ? {
        ...existingSubmission,
        displayName: participant.displayName,
        versions: [...existingSubmission.versions, nextVersion],
        lastEditedAt: now,
      }
    : {
        id: createId(),
        participantId: participant.id,
        profileId: profile.id,
        displayName: participant.displayName,
        versions: [nextVersion],
        lastEditedAt: now,
      };
  const draftEvent = createAuditEvent(
    "prediction_draft_saved",
    participant.displayName,
    now,
    {
      label: "Picks saved",
      details: `${participant.displayName} saved pick version ${versionNumber}.`,
    },
  );
  const nextChampionship = {
    ...championship,
    participants: championship.participants.map((item) =>
      item.id === participant.id
        ? { ...item, submissionStatus: "draft" as const }
        : item,
    ),
    predictions: existingSubmission
      ? championship.predictions.map((submission) =>
          submission.id === existingSubmission.id ? nextSubmission : submission,
        )
      : [...championship.predictions, nextSubmission],
    auditLog: [...championship.auditLog, ...fieldChangeEvents, draftEvent],
  };

  writeChampionships(
    championships.map((item) =>
      item.id === nextChampionship.id ? nextChampionship : item,
    ),
  );
  const didSync = await saveSupabasePredictionDraft(
    championshipId,
    nextSubmission,
    nextVersion,
    participant,
    [...fieldChangeEvents, draftEvent],
  );

  if (didSync) {
    await refreshChampionshipsFromSupabase();
  }

  return {
    championship:
      getChampionshipSnapshot().find((item) => item.id === nextChampionship.id) ??
      nextChampionship,
    message: `Saved version ${versionNumber}.`,
  };
}

export async function lockPrediction(
  championshipId: string,
  profile: AnonymousProfile,
) {
  const championships = getChampionshipSnapshot();
  const championship = championships.find((item) => item.id === championshipId);

  if (!championship) {
    return { championship: null, message: "Pool not found." };
  }

  const participant = getActiveParticipant(championship, profile.id);

  if (!participant) {
    return { championship, message: "Join this pool before locking picks." };
  }

  const submission = championship.predictions.find(
    (item) => item.profileId === profile.id,
  );
  const latestVersion = submission?.versions.at(-1);

  if (!submission || !latestVersion) {
    return { championship, message: "Save picks before locking." };
  }

  if (submission.lockedAt) {
    return { championship, message: "Picks are already locked." };
  }

  if (isPastLockDate(championship.lockDate)) {
    return { championship, message: "The lock date has passed." };
  }

  const limitMessage = validatePickLimits(championship.bets, latestVersion.picks);

  if (limitMessage) {
    return { championship, message: limitMessage };
  }

  const completionMessage = validateRequiredPicks(
    championship.bets,
    latestVersion.picks,
  );

  if (completionMessage) {
    return { championship, message: completionMessage };
  }

  const now = new Date().toISOString();
  const fingerprint = await createPredictionFingerprint({
    championshipId,
    participantId: participant.id,
    versionId: latestVersion.id,
    picks: latestVersion.picks,
    lockedAt: now,
  });
  const nextSubmission = {
    ...submission,
    lockedVersionId: latestVersion.id,
    lockedAt: now,
    fingerprint,
    lastEditedAt: now,
  };
  const lockEvent = createAuditEvent("prediction_locked", participant.displayName, now, {
    label: "Picks locked",
    details: `${participant.displayName} locked version ${latestVersion.versionNumber}.`,
  });
  const nextChampionship = {
    ...championship,
    participants: championship.participants.map((item) =>
      item.id === participant.id
        ? {
            ...item,
            submissionStatus: "submitted" as const,
            lockedStatus: "locked" as const,
          }
        : item,
    ),
    predictions: championship.predictions.map((item) =>
      item.id === submission.id ? nextSubmission : item,
    ),
    auditLog: [...championship.auditLog, lockEvent],
  };

  writeChampionships(
    championships.map((item) =>
      item.id === nextChampionship.id ? nextChampionship : item,
    ),
  );
  const didSync = await lockSupabasePrediction(championshipId);

  if (didSync) {
    await refreshChampionshipsFromSupabase();
  }

  return {
    championship:
      getChampionshipSnapshot().find((item) => item.id === nextChampionship.id) ??
      nextChampionship,
    message: "Picks locked.",
  };
}

export async function unlockPrediction(
  championshipId: string,
  profile: AnonymousProfile,
) {
  const championships = getChampionshipSnapshot();
  const championship = championships.find((item) => item.id === championshipId);

  if (!championship) {
    return { championship: null, message: "Pool not found." };
  }

  const participant = getActiveParticipant(championship, profile.id);

  if (!participant) {
    return { championship, message: "Join this pool before reopening picks." };
  }

  const submission = championship.predictions.find(
    (item) => item.profileId === profile.id,
  );

  if (!submission?.lockedAt) {
    return { championship, message: "Picks are already editable." };
  }

  if (isPastLockDate(championship.lockDate)) {
    return {
      championship,
      message: "The lock date has passed. Locked picks cannot be reopened.",
    };
  }

  const didSync = await unlockSupabasePrediction(championshipId);

  if (!didSync) {
    return {
      championship,
      message: "Could not reopen picks. Try again before the lock date.",
    };
  }

  await refreshChampionshipsFromSupabase();

  return {
    championship:
      getChampionshipSnapshot().find((item) => item.id === championshipId) ??
      championship,
    message: "Picks reopened. You can edit until the lock date.",
  };
}

export async function savePoolBets(
  championshipId: string,
  profile: AnonymousProfile,
  nextBets: PredictionCategory[],
) {
  const championships = getChampionshipSnapshot();
  const championship = championships.find((item) => item.id === championshipId);

  if (!championship) {
    return { championship: null, message: "Pool not found." };
  }

  const editableMessage = getBetEditBlockMessage(championship, profile.id);

  if (editableMessage) {
    return { championship, message: editableMessage };
  }

  if (nextBets.length === 0) {
    return { championship, message: "A pool needs at least one bet." };
  }

  const normalizedBets = nextBets.map((bet) => ({
    ...bet,
    name: bet.name.trim(),
    prompt: bet.prompt.trim() || bet.name.trim(),
    selectionCount: Math.max(1, Number(bet.selectionCount) || 1),
    choices: bet.choices?.map((choice) => choice.trim()).filter(Boolean),
  }));
  const invalidBet = normalizedBets.find((bet) => !bet.id || !bet.name);

  if (invalidBet) {
    return { championship, message: "Every bet needs a name." };
  }

  const now = new Date().toISOString();
  const previousBetIds = new Set(championship.bets.map((bet) => bet.id));
  const nextBetIds = new Set(normalizedBets.map((bet) => bet.id));
  const addedEvents = normalizedBets
    .filter((bet) => !previousBetIds.has(bet.id))
    .map((bet) =>
      createAuditEvent("bet_added", profile.displayName, now, {
        label: "Bet added",
        details: `${profile.displayName} added ${bet.name}.`,
      }),
    );
  const removedEvents = championship.bets
    .filter((bet) => !nextBetIds.has(bet.id))
    .map((bet) =>
      createAuditEvent("bet_removed", profile.displayName, now, {
        label: "Bet removed",
        details: `${profile.displayName} removed ${bet.name}.`,
      }),
    );
  const events = [...addedEvents, ...removedEvents];

  if (events.length === 0 && areBetsEqual(championship.bets, normalizedBets)) {
    return { championship, message: "No pool changes to save." };
  }

  const nextChampionship = {
    ...championship,
    bets: normalizedBets,
    predictions: championship.predictions.map((submission) => ({
      ...submission,
      versions: submission.versions.map((version) => ({
        ...version,
        picks: Object.fromEntries(
          Object.entries(version.picks).filter(([betId]) => nextBetIds.has(betId)),
        ),
      })),
    })),
    auditLog: [...championship.auditLog, ...events],
  };

  writeChampionships(
    championships.map((item) =>
      item.id === nextChampionship.id ? nextChampionship : item,
    ),
  );
  const didSync = await syncSupabasePoolBets(
    championshipId,
    normalizedBets,
    events,
  );

  if (!didSync) {
    writeChampionships(championships);

    return {
      championship,
      message: "Pool changes were not saved because the server could not sync.",
    };
  }

  await refreshChampionshipsFromSupabase();

  return {
    championship:
      getChampionshipSnapshot().find((item) => item.id === nextChampionship.id) ??
      nextChampionship,
    message: "Pool saved.",
  };
}

export async function addPoolBet(
  championshipId: string,
  profile: AnonymousProfile,
  input: Pick<
    PredictionCategory,
    "name" | "prompt" | "type" | "selectionCount" | "choices"
  >,
) {
  const championships = getChampionshipSnapshot();
  const championship = championships.find((item) => item.id === championshipId);

  if (!championship) {
    return { championship: null, message: "Pool not found." };
  }

  const editableMessage = getBetEditBlockMessage(championship, profile.id);

  if (editableMessage) {
    return { championship, message: editableMessage };
  }

  const betName = input.name.trim();

  if (!betName) {
    return { championship, message: "Enter a bet name." };
  }

  const now = new Date().toISOString();
  const bet: PredictionCategory = {
    id: createUniqueBetId(championship.bets, betName),
    name: betName,
    prompt: input.prompt.trim() || betName,
    type: input.type,
    selectionCount: Math.max(1, Number(input.selectionCount) || 1),
    choices: input.choices?.map((choice) => choice.trim()).filter(Boolean),
    scoringNote: "Creator-defined bet. Score manually after the tournament.",
    source: "custom",
  };
  const addEvent = createAuditEvent("bet_added", profile.displayName, now, {
    label: "Bet added",
    details: `${profile.displayName} added ${bet.name}.`,
  });
  const nextChampionship = {
    ...championship,
    bets: [...championship.bets, bet],
    auditLog: [...championship.auditLog, addEvent],
  };

  writeChampionships(
    championships.map((item) =>
      item.id === nextChampionship.id ? nextChampionship : item,
    ),
  );
  const didSync = await syncSupabasePoolBets(
    championshipId,
    nextChampionship.bets,
    [addEvent],
  );

  if (!didSync) {
    writeChampionships(championships);

    return {
      championship,
      message:
        "Bet was not added because the server could not sync it.",
    };
  }

  await refreshChampionshipsFromSupabase();

  return {
    championship:
      getChampionshipSnapshot().find((item) => item.id === nextChampionship.id) ??
      nextChampionship,
    message: "Bet added.",
  };
}

export async function removePoolBet(
  championshipId: string,
  profile: AnonymousProfile,
  betId: string,
) {
  const championships = getChampionshipSnapshot();
  const championship = championships.find((item) => item.id === championshipId);

  if (!championship) {
    return { championship: null, message: "Pool not found." };
  }

  const editableMessage = getBetEditBlockMessage(championship, profile.id);

  if (editableMessage) {
    return { championship, message: editableMessage };
  }

  if (championship.bets.length <= 1) {
    return { championship, message: "A pool needs at least one bet." };
  }

  const bet = championship.bets.find((item) => item.id === betId);

  if (!bet) {
    return { championship, message: "Bet not found." };
  }

  const now = new Date().toISOString();
  const removeEvent = createAuditEvent("bet_removed", profile.displayName, now, {
    label: "Bet removed",
    details: `${profile.displayName} removed ${bet.name}.`,
  });
  const nextChampionship = {
    ...championship,
    bets: championship.bets.filter((item) => item.id !== betId),
    predictions: championship.predictions.map((submission) => ({
      ...submission,
      versions: submission.versions.map((version) => ({
        ...version,
        picks: omitPick(version.picks, betId),
      })),
    })),
    auditLog: [...championship.auditLog, removeEvent],
  };

  writeChampionships(
    championships.map((item) =>
      item.id === nextChampionship.id ? nextChampionship : item,
    ),
  );
  const didSync = await syncSupabasePoolBets(
    championshipId,
    nextChampionship.bets,
    [removeEvent],
  );

  if (!didSync) {
    writeChampionships(championships);

    return {
      championship,
      message:
        "Bet was not removed because the server could not sync it.",
    };
  }

  await refreshChampionshipsFromSupabase();

  return {
    championship:
      getChampionshipSnapshot().find((item) => item.id === nextChampionship.id) ??
      nextChampionship,
    message: "Bet removed.",
  };
}

async function addOrRestoreParticipant(
  championship: Championship,
  championships: Championship[],
  profile: AnonymousProfile,
) {
  const now = new Date().toISOString();
  const participantIndex = championship.participants.findIndex(
    (participant) => participant.profileId === profile.id,
  );
  const nextParticipants = [...championship.participants];
  const participant: ChampionshipParticipant = {
    id:
      participantIndex >= 0
        ? nextParticipants[participantIndex].id
        : createId(),
    profileId: profile.id,
    displayName: profile.displayName,
    handle: profile.handle,
    role:
      participantIndex >= 0
        ? nextParticipants[participantIndex].role
        : "participant",
    joinedAt:
      participantIndex >= 0 ? nextParticipants[participantIndex].joinedAt : now,
    submissionStatus:
      participantIndex >= 0
        ? nextParticipants[participantIndex].submissionStatus
        : "not_started",
    lockedStatus:
      participantIndex >= 0
        ? nextParticipants[participantIndex].lockedStatus
        : "unlocked",
  };

  if (participantIndex >= 0) {
    nextParticipants[participantIndex] = participant;
  } else {
    nextParticipants.push(participant);
  }

  const joinEvent = createAuditEvent(
    "participant_joined",
    profile.displayName,
    now,
    {
      label: "Participant joined",
      details: `${profile.displayName} joined ${championship.name}.`,
    },
  );
  const nextChampionship = {
    ...championship,
    participants: nextParticipants,
    auditLog:
      participantIndex >= 0
        ? championship.auditLog
        : [...championship.auditLog, joinEvent],
  };

  writeChampionships(
    championships.map((item) =>
      item.id === nextChampionship.id ? nextChampionship : item,
    ),
  );
  await joinSupabasePool(championship.id, participant, profile, [
    ...(participantIndex >= 0 ? [] : [joinEvent]),
  ]);
  await refreshChampionshipsFromSupabase();

  return {
    championship:
      getChampionshipSnapshot().find((item) => item.id === nextChampionship.id) ??
      nextChampionship,
    message: `${profile.displayName} joined ${nextChampionship.name}.`,
    status: participantIndex >= 0 ? ("updated" as const) : ("joined" as const),
  };
}

export function getSelectedChampionship(championships: Championship[]) {
  return championships[0] ?? null;
}

function subscribeToChampionships(onStoreChange: () => void) {
  const handleStorageChange = () => {
    cachedChampionships = null;
    onStoreChange();
  };

  window.addEventListener(championshipChangeEvent, onStoreChange);
  window.addEventListener("storage", handleStorageChange);
  void refreshChampionshipsFromSupabase();

  return () => {
    window.removeEventListener(championshipChangeEvent, onStoreChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function getChampionshipSnapshot() {
  if (cachedChampionships) {
    return cachedChampionships;
  }

  cachedChampionships = readStoredChampionships();
  return cachedChampionships;
}

function getServerChampionshipSnapshot() {
  return emptyChampionships;
}

function readStoredChampionships() {
  try {
    const rawChampionships = localStorage.getItem(storageKey);

    if (!rawChampionships) {
      return [];
    }

    return normalizeChampionships(JSON.parse(rawChampionships) as Championship[]);
  } catch {
    return [] as Championship[];
  }
}

function normalizeChampionships(championships: Championship[]) {
  return championships.map((championship) => {
    const tournament = getChampionshipTemplate(
      championship.tournamentId ?? championship.templateId,
    );

    return {
      ...championship,
      tournamentId: championship.tournamentId ?? championship.templateId,
      templateId: championship.templateId ?? championship.tournamentId,
      bets: championship.bets?.length ? championship.bets : tournament.defaultBets,
      participants: (championship.participants ?? []).map((participant) => ({
        ...participant,
        submissionStatus: participant.submissionStatus ?? "not_started",
        lockedStatus: participant.lockedStatus ?? "unlocked",
      })),
      predictions: championship.predictions ?? [],
      auditLog: championship.auditLog ?? [],
    };
  });
}

function getActiveParticipant(championship: Championship, profileId: string) {
  return championship.participants.find(
    (participant) => participant.profileId === profileId && !participant.leftAt,
  );
}

export function getBetEditBlockMessage(championship: Championship, profileId: string) {
  if (championship.creatorProfileId !== profileId) {
    return "Only the pool creator can edit bets.";
  }

  if (isPastLockDate(championship.lockDate)) {
    return "The lock date has passed. Bets cannot be changed.";
  }

  if (championship.predictions.some((submission) => submission.lockedAt)) {
    return "Someone has locked picks. Bets cannot be changed now.";
  }

  return "";
}

export function omitPick(picks: PredictionPicks, betId: string) {
  const nextPicks = { ...picks };

  delete nextPicks[betId];

  return nextPicks;
}

async function createPredictionFingerprint(payload: unknown) {
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedPayload);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function writeChampionships(championships: Championship[]) {
  cachedChampionships = championships;
  localStorage.setItem(storageKey, JSON.stringify(championships));
  window.dispatchEvent(new Event(championshipChangeEvent));
}

function mergeAndWriteChampionships(remoteChampionships: Championship[]) {
  const localChampionships = readStoredChampionships();
  const remoteIds = new Set(remoteChampionships.map((championship) => championship.id));
  const mergedChampionships = [
    ...remoteChampionships,
    ...localChampionships.filter((championship) => !remoteIds.has(championship.id)),
  ];

  writeChampionships(mergedChampionships);
}

function createAuditEvent(
  type: AuditEvent["type"],
  actorName: string,
  timestamp: string,
  event: Pick<AuditEvent, "label" | "details">,
) {
  return {
    id: createId(),
    type,
    actorName,
    timestamp,
    ...event,
  };
}

function createInviteCode() {
  return `FP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function getPoolInvitePath(inviteCode: string) {
  return `/championships/join?code=${encodeURIComponent(inviteCode)}`;
}

export function createPoolInviteMessage({
  inviteCode,
  inviteUrl,
  lockLabel,
  poolName,
}: {
  inviteCode: string;
  inviteUrl: string;
  lockLabel: string;
  poolName: string;
}) {
  return [
    `Join my Fan Picks pool: ${poolName}`,
    `Make your picks before ${lockLabel}.`,
    `Invite code: ${inviteCode}`,
    inviteUrl,
  ].join("\n");
}

function isPastLockDate(value: string) {
  if (!value) {
    return false;
  }

  return Date.now() >= new Date(`${value}T23:59:59`).getTime();
}

export function getPredictionFieldChangeEvents(
  bets: PredictionCategory[],
  previousPicks: PredictionPicks,
  nextPicks: PredictionPicks,
  actorName: string,
  timestamp: string,
) {
  return bets.flatMap((bet) => {
    const previousValue = formatPickValue(previousPicks[bet.id]);
    const nextValue = formatPickValue(nextPicks[bet.id]);

    if (previousValue === nextValue) {
      return [];
    }

    return [
      createAuditEvent("prediction_field_changed", actorName, timestamp, {
        label: `${bet.name} changed`,
        details: previousValue
          ? `${actorName} changed ${bet.name} from ${previousValue} to ${nextValue || "empty"}.`
          : `${actorName} set ${bet.name} to ${nextValue || "empty"}.`,
      }),
    ];
  });
}

export function validatePickLimits(bets: PredictionCategory[], picks: PredictionPicks) {
  const overLimitBet = bets.find(
    (bet) => (picks[bet.id]?.filter(Boolean).length ?? 0) > bet.selectionCount,
  );

  if (!overLimitBet) {
    return "";
  }

  return `${overLimitBet.name} allows ${overLimitBet.selectionCount} pick(s).`;
}

export function validateRequiredPicks(
  bets: PredictionCategory[],
  picks: PredictionPicks,
) {
  const incompleteBet = bets.find(
    (bet) => (picks[bet.id]?.filter(Boolean).length ?? 0) !== bet.selectionCount,
  );

  if (!incompleteBet) {
    return "";
  }

  return `Complete ${incompleteBet.name} before locking.`;
}

function formatPickValue(value: string[] | undefined) {
  return value?.filter(Boolean).join(", ") ?? "";
}

export function dedupeBets(bets: PredictionCategory[]) {
  const seen = new Set<string>();

  return bets.filter((bet) => {
    const key = bet.id;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function areBetsEqual(
  previousBets: PredictionCategory[],
  nextBets: PredictionCategory[],
) {
  return JSON.stringify(previousBets) === JSON.stringify(nextBets);
}

function createSlugId(value: string) {
  return `custom-${slugify(value) || createId()}`;
}

export function createUniqueBetId(bets: PredictionCategory[], value: string) {
  const baseId = createSlugId(value);
  let nextId = baseId;
  let suffix = 2;
  const existingIds = new Set(bets.map((bet) => bet.id));

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
