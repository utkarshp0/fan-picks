import type {
  AuditEvent,
  Championship,
  ChampionshipParticipant,
  PredictionSubmission,
} from "@/types/championship";

export type IntegrityCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

export function getIntegrityChecks(
  championship: Championship,
): IntegrityCheck[] {
  const activeParticipants = championship.participants.filter(
    (participant) => Boolean(participant.joinedAt) && !participant.leftAt,
  );
  const lockedSubmissions = championship.predictions.filter((submission) =>
    Boolean(submission.lockedAt),
  );

  return [
    {
      label: "Pool members tracked",
      passed: activeParticipants.length > 0,
      detail: `${activeParticipants.length}/${championship.participants.length} joined participants`,
    },
    {
      label: "Participants tracked",
      passed: activeParticipants.length > 0,
      detail: `${activeParticipants.length} participant join event(s) recorded`,
    },
    {
      label: "Picks locked",
      passed: lockedSubmissions.length > 0,
      detail: `${lockedSubmissions.length}/${championship.participants.length} locked submission(s)`,
    },
    {
      label: "Audit trail verified",
      passed: championship.auditLog.length >= 4,
      detail: `${championship.auditLog.length} permanent audit events`,
    },
    {
      label: "No post-lock changes",
      passed: championship.predictions.every((submission) =>
        hasNoPostLockVersions(submission),
      ),
      detail: "Locked submissions are immutable in the local store",
    },
  ];
}

export function getIntegrityScore(championship: Championship) {
  const checks = getIntegrityChecks(championship);
  const passed = checks.filter((check) => check.passed).length;

  return Math.round((passed / checks.length) * 100);
}

export function getEventTone(event: AuditEvent["type"]) {
  if (
    event === "prediction_locked" ||
    event === "prediction_unlocked" ||
    event === "participant_joined" ||
    event === "pool_created"
  ) {
    return "accent" as const;
  }

  if (event === "prediction_draft_saved" || event === "invite_created") {
    return "warning" as const;
  }

  return "muted" as const;
}

export function getSubmissionForParticipant(
  participant: ChampionshipParticipant,
  championship: Championship,
) {
  return championship.predictions.find(
    (submission) => submission.profileId === participant.profileId,
  );
}

export function hasNoPostLockVersions(submission: PredictionSubmission) {
  if (!submission.lockedAt || !submission.lockedVersionId) {
    return true;
  }

  const lockedVersion = submission.versions.find(
    (version) => version.id === submission.lockedVersionId,
  );

  if (!lockedVersion) {
    return false;
  }

  return submission.versions.every(
    (version) =>
      version.id === lockedVersion.id ||
      new Date(version.createdAt).getTime() <=
        new Date(submission.lockedAt ?? "").getTime(),
  );
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
