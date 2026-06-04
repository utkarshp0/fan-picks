import type { SportsFixture } from "@/types/sports-data";

export type MatchPickType = "winner" | "exact_score" | "both_teams_score";

export type MatchPickRoomStatus =
  | "open"
  | "locked"
  | "finished"
  | "scored"
  | "cancelled";

export type MatchPickResultStatus = "pending" | "correct" | "incorrect" | "void";

export type MatchPickAnswer =
  | {
      type: "winner";
      value: "home" | "draw" | "away";
    }
  | {
      type: "exact_score";
      away: number;
      home: number;
    }
  | {
      type: "both_teams_score";
      value: "yes" | "no";
    };

export type MatchPickParticipant = {
  id: string;
  profileId: string;
  displayName: string;
  handle: string;
  role: "creator" | "participant";
  joinedAt: string;
  leftAt?: string;
};

export type MatchPickVersion = {
  id: string;
  answer: MatchPickAnswer;
  createdAt: string;
  versionNumber: number;
};

export type MatchPickSubmission = {
  id: string;
  participantId: string;
  profileId: string;
  displayName: string;
  versions: MatchPickVersion[];
  fingerprint?: string;
  lastEditedAt?: string;
  lockedAt?: string;
  lockedVersionId?: string;
  resultStatus: MatchPickResultStatus;
};

export type MatchPickAuditEvent = {
  id: string;
  actorName: string;
  createdAt: string;
  details: string;
  label: string;
  type:
    | "room_created"
    | "invite_created"
    | "participant_joined"
    | "participant_left"
    | "pick_changed"
    | "pick_saved"
    | "pick_locked"
    | "room_scored";
};

export type MatchPickRoom = {
  id: string;
  auditLog: MatchPickAuditEvent[];
  createdAt: string;
  creatorProfileId: string;
  fixture: SportsFixture;
  fixtureId: string;
  inviteCode: string;
  kickoffAt: string;
  lockAt: string;
  name: string;
  participants: MatchPickParticipant[];
  pickType: MatchPickType;
  resultSummary?: MatchPickResultSummary;
  status: MatchPickRoomStatus;
  submissions: MatchPickSubmission[];
  tournamentId: string;
};

export type MatchPickResultSummary = {
  correctProfileIds: string[];
  message: string;
  outcomeLabel: string;
  winners: string[];
};

export type MatchPickFixtureOption = {
  fixture: SportsFixture;
  kickoffLabel: string;
  lockLabel: string;
};
