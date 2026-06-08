import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canLeaveMatchPickRoom,
  createMatchPickInviteMessage,
  createMatchPickRoomName,
  evaluateMatchPickAnswer,
  getComputedMatchPickStatus,
  getMatchPickInvitePath,
  getMatchPickLockAt,
  getWinnerMessage,
  isPastMatchPickLock,
  validateMatchPickAnswer,
} from "../src/lib/match-pick-rules";
import { matchPickRoomSelect } from "../src/lib/server-match-picks";
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

const room = {
  id: "room-1",
  auditLog: [],
  createdAt: "2026-06-01T00:00:00.000Z",
  creatorProfileId: "profile-1",
  fixture,
  fixtureId: fixture.id,
  inviteCode: "MP-ABC123",
  kickoffAt: "2026-06-11T19:00:00.000Z",
  lockAt: "2026-06-11T17:00:00.000Z",
  name: "Mexico vs South Africa - Winner",
  participants: [
    {
      id: "participant-1",
      displayName: "Utkarsh",
      handle: "utkarsh",
      joinedAt: "2026-06-01T00:00:00.000Z",
      profileId: "profile-1",
      role: "creator" as const,
    },
    {
      id: "participant-2",
      displayName: "Mahi",
      handle: "mahi",
      joinedAt: "2026-06-01T00:00:00.000Z",
      leftAt: "2026-06-02T00:00:00.000Z",
      profileId: "profile-2",
      role: "participant" as const,
    },
  ],
  pickType: "winner" as const,
  status: "open" as const,
  submissions: [],
  tournamentId: fixture.tournamentId,
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

  it("computes Match Pick room status before and after lock", () => {
    const lockAt = "2026-06-11T17:00:00.000Z";
    const upcomingFixture = { ...fixture, status: "upcoming" };

    assert.equal(
      getComputedMatchPickStatus(
        upcomingFixture,
        lockAt,
        "open",
        new Date("2026-06-11T16:59:59.000Z"),
      ),
      "open",
    );
    assert.equal(
      getComputedMatchPickStatus(
        upcomingFixture,
        lockAt,
        "open",
        new Date("2026-06-11T17:00:00.000Z"),
      ),
      "locked",
    );
  });

  it("finished fixtures override lock status", () => {
    assert.equal(
      getComputedMatchPickStatus(
        fixture,
        "2026-06-11T17:00:00.000Z",
        "open",
        new Date("2026-06-11T18:00:00.000Z"),
      ),
      "finished",
    );
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

  it("uses the explicit submission versions relationship in room reload queries", () => {
    assert.match(
      matchPickRoomSelect,
      /match_pick_versions!match_pick_versions_submission_id_fkey\(\*\)/,
    );
  });

  it("only allows active participants to leave a Match Pick room", () => {
    assert.equal(canLeaveMatchPickRoom(room, "profile-1"), true);
    assert.equal(canLeaveMatchPickRoom(room, "profile-2"), false);
    assert.equal(canLeaveMatchPickRoom(room, "unknown-profile"), false);
    assert.equal(canLeaveMatchPickRoom(room, undefined), false);
  });

  it("builds a shareable Match Pick invite path", () => {
    assert.equal(
      getMatchPickInvitePath("MP-ABC 123"),
      "/match-picks/join?code=MP-ABC+123&preview=v2",
    );
  });

  it("builds a friendly Match Pick invite message", () => {
    const message = createMatchPickInviteMessage({
      inviteCode: room.inviteCode,
      inviteUrl: "https://fan-picks.vercel.app/match-picks/join?code=MP-ABC123",
      lockLabel: "11 Jun 2026, 10:30 pm IST",
      roomName: room.name,
    });

    assert.match(message, /Join my Fan Picks Match Pick: Mexico vs South Africa - Winner/);
    assert.match(message, /Make your pick before 11 Jun 2026, 10:30 pm IST/);
    assert.match(message, /Invite code: MP-ABC123/);
    assert.match(message, /https:\/\/fan-picks\.vercel\.app\/match-picks\/join\?code=MP-ABC123/);
  });
});
