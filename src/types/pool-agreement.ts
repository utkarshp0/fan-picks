import type { AuditEvent, PredictionCategory } from "@/types/championship";

export type PoolAgreementStatus = "draft" | "sealed";

export type PoolAgreementParticipant = {
  displayName: string;
  handle: string;
  joinedAt: string;
  leftAt?: string;
  profileId: string;
  role: "creator" | "participant";
  status: "active" | "left";
};

export type PoolAgreementPickRow = {
  betId: string;
  betName: string;
  participantName: string;
  profileId: string;
  selectedOptions: string[];
};

export type PoolAgreementAuditSummary = {
  betChanges: number;
  participantsJoined: number;
  participantsLeft: number;
  pickVersionsSaved: number;
  poolCreatedAt: string;
  predictionLocks: number;
  predictionReopens: number;
  totalAuditEvents: number;
};

export type PoolAgreementModel = {
  agreementId: string;
  auditSummary: PoolAgreementAuditSummary;
  bets: PredictionCategory[];
  fingerprint: string;
  generatedAt: string;
  inviteCode: string;
  isSealed: boolean;
  lockDate: string;
  participants: PoolAgreementParticipant[];
  picks: PoolAgreementPickRow[];
  poolId: string;
  poolName: string;
  sealedAt?: string;
  status: PoolAgreementStatus;
  tournamentName: string;
};

export type PoolAgreementResult =
  | { ok: true; agreement: PoolAgreementModel }
  | { ok: false; message: string; status: number };

export type PoolAgreementAuditEvent = Pick<
  AuditEvent,
  "type" | "timestamp"
>;
