import { createHash } from "node:crypto";

import { isPastPoolLockDate } from "@/lib/app-clock";
import type {
  Championship,
  PredictionSubmission,
} from "@/types/championship";
import type {
  PoolAgreementAuditEvent,
  PoolAgreementAuditSummary,
  PoolAgreementModel,
  PoolAgreementParticipant,
  PoolAgreementPickRow,
  PoolAgreementStatus,
} from "@/types/pool-agreement";

export function getPoolAgreementStatus(lockDate: string): PoolAgreementStatus {
  return isPastPoolLockDate(lockDate) ? "sealed" : "draft";
}

export function createPoolAgreementId(inviteCode: string, lockDate: string) {
  return `FPA-${inviteCode}-${lockDate.replaceAll("-", "")}`;
}

export function getFinalPredictionVersion(submission: PredictionSubmission) {
  if (submission.lockedVersionId) {
    return (
      submission.versions.find(
        (version) => version.id === submission.lockedVersionId,
      ) ?? submission.versions.at(-1)
    );
  }

  return submission.versions.at(-1);
}

export function buildAgreementPicks(
  championship: Pick<Championship, "bets" | "participants" | "predictions">,
  status: PoolAgreementStatus,
): PoolAgreementPickRow[] {
  if (status !== "sealed") {
    return [];
  }

  const submissionsByProfileId = new Map(
    championship.predictions.map((submission) => [submission.profileId, submission]),
  );
  const activeParticipants = championship.participants.filter(
    (participant) => !participant.leftAt,
  );
  const rows: PoolAgreementPickRow[] = [];

  for (const participant of activeParticipants) {
    const submission = submissionsByProfileId.get(participant.profileId);
    const finalVersion = submission ? getFinalPredictionVersion(submission) : undefined;

    for (const bet of championship.bets) {
      rows.push({
        betId: bet.id,
        betName: bet.name,
        participantName: participant.displayName,
        profileId: participant.profileId,
        selectedOptions: finalVersion?.picks[bet.id]?.filter(Boolean) ?? [],
      });
    }
  }

  return rows;
}

export function buildAgreementParticipants(
  championship: Pick<Championship, "creatorProfileId" | "participants">,
): PoolAgreementParticipant[] {
  return championship.participants.map((participant) => ({
    displayName: participant.displayName,
    handle: participant.handle,
    joinedAt: participant.joinedAt,
    leftAt: participant.leftAt,
    profileId: participant.profileId,
    role:
      participant.profileId === championship.creatorProfileId
        ? "creator"
        : participant.role,
    status: participant.leftAt ? "left" : "active",
  }));
}

export function buildAgreementAuditSummary({
  auditLog,
  predictions,
  poolCreatedAt,
}: {
  auditLog: PoolAgreementAuditEvent[];
  predictions: PredictionSubmission[];
  poolCreatedAt: string;
}): PoolAgreementAuditSummary {
  return {
    betChanges: auditLog.filter(
      (event) => event.type === "bet_added" || event.type === "bet_removed",
    ).length,
    participantsJoined: auditLog.filter(
      (event) => event.type === "participant_joined",
    ).length,
    participantsLeft: auditLog.filter(
      (event) => event.type === "participant_left",
    ).length,
    pickVersionsSaved: predictions.reduce(
      (total, submission) => total + submission.versions.length,
      0,
    ),
    poolCreatedAt,
    predictionLocks: auditLog.filter(
      (event) => event.type === "prediction_locked",
    ).length,
    predictionReopens: auditLog.filter(
      (event) => event.type === "prediction_unlocked",
    ).length,
    totalAuditEvents: auditLog.length,
  };
}

export function createAgreementFingerprint(
  snapshot: Omit<PoolAgreementModel, "fingerprint" | "generatedAt">,
) {
  return createHash("sha256")
    .update(JSON.stringify(stableSortAgreementSnapshot(snapshot)))
    .digest("hex");
}

export function createAgreementPreviewModel({
  championship,
  generatedAt,
  tournamentName,
}: {
  championship: Championship;
  generatedAt: string;
  tournamentName: string;
}): PoolAgreementModel {
  const status = getPoolAgreementStatus(championship.lockDate);
  const agreementWithoutFingerprint = {
    agreementId: createPoolAgreementId(
      championship.inviteCode,
      championship.lockDate,
    ),
    auditSummary: buildAgreementAuditSummary({
      auditLog: championship.auditLog,
      poolCreatedAt: championship.createdAt,
      predictions: championship.predictions,
    }),
    bets: championship.bets,
    inviteCode: championship.inviteCode,
    isSealed: status === "sealed",
    lockDate: championship.lockDate,
    participants: buildAgreementParticipants(championship),
    picks: buildAgreementPicks(championship, status),
    poolId: championship.id,
    poolName: championship.name,
    sealedAt: status === "sealed" ? generatedAt : undefined,
    status,
    tournamentName,
  };

  return {
    ...agreementWithoutFingerprint,
    fingerprint: createAgreementFingerprint(agreementWithoutFingerprint),
    generatedAt,
  };
}

function stableSortAgreementSnapshot(
  snapshot: Omit<PoolAgreementModel, "fingerprint" | "generatedAt">,
) {
  return {
    ...snapshot,
    auditSummary: { ...snapshot.auditSummary },
    bets: [...snapshot.bets].sort((a, b) => a.id.localeCompare(b.id)),
    participants: [...snapshot.participants].sort((a, b) =>
      a.profileId.localeCompare(b.profileId),
    ),
    picks: [...snapshot.picks].sort((a, b) =>
      `${a.profileId}:${a.betId}`.localeCompare(`${b.profileId}:${b.betId}`),
    ),
  };
}
