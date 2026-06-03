import type { LucideIcon } from "lucide-react";

export type ChampionshipStatus = "open" | "locked" | "completed";

export type BetType =
  | "single-team"
  | "multi-team"
  | "single-player"
  | "choice"
  | "number"
  | "text";

export type PredictionCategoryType = BetType;

export type PredictionCategory = {
  id: string;
  name: string;
  type: BetType;
  prompt: string;
  selectionCount: number;
  scoringNote: string;
  choices?: string[];
  source: "default" | "custom";
};

export type ChampionshipTemplate = {
  id: string;
  name: string;
  season: string;
  description: string;
  startDate: string;
  lockDate: string;
  defaultBets: PredictionCategory[];
};

export type ChampionshipParticipant = {
  id: string;
  profileId: string;
  displayName: string;
  handle: string;
  role: "creator" | "participant";
  joinedAt: string;
  leftAt?: string;
  submissionStatus: "not_started" | "draft" | "submitted";
  lockedStatus: "unlocked" | "locked";
};

export type AuditEvent = {
  id: string;
  type:
    | "pool_created"
    | "invite_created"
    | "participant_joined"
    | "participant_left"
    | "bet_added"
    | "bet_removed"
    | "prediction_field_changed"
    | "prediction_draft_saved"
    | "prediction_locked"
    | "prediction_unlocked";
  label: string;
  actorName: string;
  timestamp: string;
  details: string;
};

export type PredictionPicks = Record<string, string[]>;

export type PredictionVersion = {
  id: string;
  versionNumber: number;
  picks: PredictionPicks;
  createdAt: string;
};

export type PredictionSubmission = {
  id: string;
  participantId: string;
  profileId: string;
  displayName: string;
  versions: PredictionVersion[];
  lockedVersionId?: string;
  lockedAt?: string;
  fingerprint?: string;
  lastEditedAt?: string;
};

export type Championship = {
  id: string;
  tournamentId: string;
  templateId: string;
  name: string;
  slug: string;
  inviteCode: string;
  status: ChampionshipStatus;
  startDate: string;
  lockDate: string;
  isPublic: boolean;
  createdAt: string;
  creatorProfileId: string;
  bets: PredictionCategory[];
  participants: ChampionshipParticipant[];
  predictions: PredictionSubmission[];
  auditLog: AuditEvent[];
};

export type CreateChampionshipInput = {
  name: string;
  tournamentId: string;
  tournamentName?: string;
  startDate: string;
  lockDate: string;
  defaultBetIds: string[];
  defaultBets?: PredictionCategory[];
  customBets: Array<Pick<PredictionCategory, "name" | "prompt" | "type" | "selectionCount" | "choices">>;
};

export type JoinChampionshipInput = {
  inviteCode: string;
};

export type IntegritySignal = {
  label: string;
  status: "verified" | "pending";
};

export type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};
