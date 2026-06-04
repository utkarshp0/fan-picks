import { createHash } from "node:crypto";

import type {
  MatchPickAnswer,
  MatchPickResultStatus,
  MatchPickRoomStatus,
  MatchPickType,
} from "@/types/match-picks";
import type { SportsFixture } from "@/types/sports-data";

export const matchPickLockOffsetMs = 2 * 60 * 60 * 1000;
export const matchPickTypes: MatchPickType[] = [
  "winner",
  "exact_score",
  "both_teams_score",
];

export function getMatchPickTypeLabel(type: MatchPickType) {
  if (type === "winner") {
    return "Winner";
  }

  if (type === "exact_score") {
    return "Exact score";
  }

  return "Both teams score";
}

export function getMatchPickPrompt(type: MatchPickType, fixture: SportsFixture) {
  if (type === "winner") {
    return `Who wins: ${fixture.homeTeamName}, draw, or ${fixture.awayTeamName}?`;
  }

  if (type === "exact_score") {
    return `Predict the final score for ${fixture.homeTeamName} vs ${fixture.awayTeamName}.`;
  }

  return `Will both ${fixture.homeTeamName} and ${fixture.awayTeamName} score?`;
}

export function createMatchPickRoomName(
  fixture: SportsFixture,
  type: MatchPickType,
) {
  return `${fixture.homeTeamName} vs ${fixture.awayTeamName} - ${getMatchPickTypeLabel(type)}`;
}

export function getMatchPickLockAt(kickoffUtc: string) {
  return new Date(new Date(kickoffUtc).getTime() - matchPickLockOffsetMs)
    .toISOString();
}

export function isPastMatchPickLock(lockAt: string, now = new Date()) {
  return now.getTime() >= new Date(lockAt).getTime();
}

export function getComputedMatchPickStatus(
  fixture: SportsFixture,
  lockAt: string,
  storedStatus: MatchPickRoomStatus,
  now = new Date(),
): MatchPickRoomStatus {
  if (storedStatus === "cancelled" || storedStatus === "scored") {
    return storedStatus;
  }

  if (isCompletedFixture(fixture)) {
    return "finished";
  }

  if (isPastMatchPickLock(lockAt, now)) {
    return "locked";
  }

  return "open";
}

export function validateMatchPickAnswer(
  type: MatchPickType,
  answer: unknown,
) {
  const normalized = normalizeMatchPickAnswer(answer);

  if (!normalized || normalized.type !== type) {
    return { answer: null, message: "Choose a valid pick." };
  }

  if (normalized.type === "exact_score") {
    if (!Number.isInteger(normalized.home) || !Number.isInteger(normalized.away)) {
      return { answer: null, message: "Enter whole-number scores." };
    }

    if (normalized.home < 0 || normalized.away < 0) {
      return { answer: null, message: "Scores cannot be negative." };
    }

    if (normalized.home > 30 || normalized.away > 30) {
      return { answer: null, message: "Scores look too high. Check the numbers." };
    }
  }

  return { answer: normalized, message: "" };
}

export function normalizeMatchPickAnswer(answer: unknown): MatchPickAnswer | null {
  if (!answer || typeof answer !== "object") {
    return null;
  }

  const input = answer as Partial<MatchPickAnswer> & Record<string, unknown>;

  if (
    input.type === "winner" &&
    (input.value === "home" || input.value === "draw" || input.value === "away")
  ) {
    return { type: "winner", value: input.value };
  }

  if (input.type === "both_teams_score" && (input.value === "yes" || input.value === "no")) {
    return { type: "both_teams_score", value: input.value };
  }

  if (input.type === "exact_score") {
    return {
      type: "exact_score",
      away: Number(input.away),
      home: Number(input.home),
    };
  }

  return null;
}

export function evaluateMatchPickAnswer(
  type: MatchPickType,
  answer: MatchPickAnswer | null | undefined,
  fixture: SportsFixture,
): MatchPickResultStatus {
  if (!answer || answer.type !== type) {
    return "pending";
  }

  if (!isCompletedFixture(fixture)) {
    return "pending";
  }

  if (typeof fixture.homeScore !== "number" || typeof fixture.awayScore !== "number") {
    return "void";
  }

  if (type === "winner" && answer.type === "winner") {
    const outcome =
      fixture.homeScore > fixture.awayScore
        ? "home"
        : fixture.homeScore < fixture.awayScore
          ? "away"
          : "draw";

    return answer.value === outcome ? "correct" : "incorrect";
  }

  if (type === "exact_score" && answer.type === "exact_score") {
    return answer.home === fixture.homeScore && answer.away === fixture.awayScore
      ? "correct"
      : "incorrect";
  }

  if (type === "both_teams_score" && answer.type === "both_teams_score") {
    const bothScored = fixture.homeScore > 0 && fixture.awayScore > 0;

    return answer.value === (bothScored ? "yes" : "no") ? "correct" : "incorrect";
  }

  return "pending";
}

export function getFixtureOutcomeLabel(fixture: SportsFixture) {
  if (!isCompletedFixture(fixture)) {
    return "Awaiting final result";
  }

  if (typeof fixture.homeScore !== "number" || typeof fixture.awayScore !== "number") {
    return "Result unavailable";
  }

  return `${fixture.homeTeamName} ${fixture.homeScore} - ${fixture.awayScore} ${fixture.awayTeamName}`;
}

export function createMatchPickFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function getWinnerMessage(winners: string[], type: MatchPickType) {
  if (winners.length === 0) {
    return "Nobody got this one. Football chose chaos.";
  }

  if (winners.length === 1) {
    if (type === "exact_score") {
      return `${winners[0]} nailed the exact score. That was suspiciously clean.`;
    }

    return `${winners[0]} called it. The receipts are glowing.`;
  }

  if (winners.length === 2) {
    return `${winners[0]} and ${winners[1]} got it right. Shared glory, double noise.`;
  }

  return `${winners.slice(0, -1).join(", ")}, and ${winners.at(-1)} got it right. The room has receipts.`;
}

export function isCompletedFixture(fixture: SportsFixture) {
  const status = fixture.status.toLowerCase();

  return (
    status.includes("finished") ||
    status.includes("full") ||
    status === "ft" ||
    status === "completed"
  );
}
