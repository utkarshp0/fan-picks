import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createMatchPickRoomName,
  evaluateMatchPickAnswer,
  getMatchPickLockAt,
  getWinnerMessage,
  isPastMatchPickLock,
  validateMatchPickAnswer,
} from "../src/lib/match-pick-rules";
import type { SportsFixture } from "../src/types/sports-data";

const fixture: SportsFixture = {
  id: "fixture-1",
  tournamentId: "fifa-world-cup-2026",
  providerMatchId: "provider-1",
  sport: "football",
  league: "FIFA World Cup 2026",
  homeTeamName: "Mexico",
  awayTeamName: "South Africa",
  kickoffUtc: "2026-06-11T19:00:00.000Z",
  status: "finished",
  homeScore: 2,
  awayScore: 1,
  raw: {},
};

describe("Match Picks rules", () => {
  it("locks two hours before kickoff", () => {
    assert.equal(getMatchPickLockAt("2026-06-11T19:00:00.000Z"), "2026-06-11T17:00:00.000Z");
  });

  it("treats picks as editable before lock and locked at lock time", () => {
    const lockAt = "2026-06-11T17:00:00.000Z";

    assert.equal(isPastMatchPickLock(lockAt, new Date("2026-06-11T16:59:59.000Z")), false);
    assert.equal(isPastMatchPickLock(lockAt, new Date("2026-06-11T17:00:00.000Z")), true);
  });

  it("uses team names in room titles", () => {
    assert.equal(
      createMatchPickRoomName(fixture, "winner"),
      "Mexico vs South Africa - Winner",
    );
  });

  it("validates a winner answer", () => {
    const result = validateMatchPickAnswer("winner", {
      type: "winner",
      value: "home",
    });

    assert.deepEqual(result.answer, { type: "winner", value: "home" });
    assert.equal(result.message, "");
  });

  it("rejects an answer that does not match the room pick type", () => {
    const result = validateMatchPickAnswer("winner", {
      away: 1,
      home: 2,
      type: "exact_score",
    });

    assert.equal(result.answer, null);
    assert.equal(result.message, "Choose a valid pick.");
  });

  it("rejects negative exact scores", () => {
    const result = validateMatchPickAnswer("exact_score", {
      away: 1,
      home: -1,
      type: "exact_score",
    });

    assert.equal(result.answer, null);
    assert.equal(result.message, "Scores cannot be negative.");
  });

  it("evaluates a correct winner pick", () => {
    assert.equal(
      evaluateMatchPickAnswer("winner", { type: "winner", value: "home" }, fixture),
      "correct",
    );
  });

  it("evaluates an incorrect exact score pick", () => {
    assert.equal(
      evaluateMatchPickAnswer(
        "exact_score",
        { away: 0, home: 2, type: "exact_score" },
        fixture,
      ),
      "incorrect",
    );
  });

  it("evaluates both teams score", () => {
    assert.equal(
      evaluateMatchPickAnswer(
        "both_teams_score",
        { type: "both_teams_score", value: "yes" },
        fixture,
      ),
      "correct",
    );
  });

  it("returns witty winner copy for no winners and exact-score winners", () => {
    assert.equal(
      getWinnerMessage([], "winner"),
      "Nobody got this one. Football chose chaos.",
    );
    assert.equal(
      getWinnerMessage(["Utkarsh"], "exact_score"),
      "Utkarsh nailed the exact score. That was suspiciously clean.",
    );
  });
});
