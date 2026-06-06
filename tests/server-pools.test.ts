import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCreatedPoolPayload } from "../src/lib/server-pools";
import type { Championship } from "../src/types/championship";
import type { AnonymousProfile } from "../src/types/profile";

const creator: AnonymousProfile = {
  avatarInitials: "UT",
  createdAt: "2026-06-06T00:00:00.000Z",
  displayName: "Utkarsh",
  handle: "utkarshp0",
  id: "profile-1",
  lastSeenAt: "2026-06-06T00:00:00.000Z",
};

function makePool(overrides: Partial<Championship> = {}): Championship {
  return {
    auditLog: [],
    bets: [
      {
        id: "winner",
        name: "Winner",
        prompt: "Pick the winner.",
        scoringNote: "One pick.",
        selectionCount: 1,
        source: "default",
        type: "single-team",
      },
    ],
    createdAt: "2026-06-06T00:00:00.000Z",
    creatorProfileId: creator.id,
    id: "pool-1",
    inviteCode: "FP-ABC123",
    isPublic: false,
    lockDate: "2026-06-10",
    name: "FIFA World Cup 2026 Friends Pool",
    participants: [
      {
        displayName: creator.displayName,
        handle: creator.handle,
        id: "participant-1",
        joinedAt: "2026-06-06T00:00:00.000Z",
        lockedStatus: "unlocked",
        profileId: creator.id,
        role: "creator",
        submissionStatus: "not_started",
      },
    ],
    predictions: [],
    slug: "fifa-world-cup-2026-friends-pool-fp-abc123",
    startDate: "2026-06-11",
    status: "open",
    templateId: "fifa-world-cup-2026",
    tournamentId: "fifa-world-cup-2026",
    ...overrides,
  };
}

describe("validateCreatedPoolPayload", () => {
  it("accepts a pool that includes the logged-in creator as an active participant", () => {
    assert.equal(validateCreatedPoolPayload({ championship: makePool(), creator }, creator.id), "");
  });

  it("rejects a pool without a creator participant row", () => {
    const message = validateCreatedPoolPayload(
      { championship: makePool({ participants: [] }), creator },
      creator.id,
    );

    assert.match(message, /active creator participant/i);
  });

  it("rejects a creator participant that is already marked as left", () => {
    const pool = makePool({
      participants: [
        {
          ...makePool().participants[0],
          leftAt: "2026-06-06T01:00:00.000Z",
        },
      ],
    });
    const message = validateCreatedPoolPayload({ championship: pool, creator }, creator.id);

    assert.match(message, /cannot be marked as left/i);
  });

  it("rejects a payload where the creator does not match the auth user", () => {
    const message = validateCreatedPoolPayload(
      { championship: makePool(), creator },
      "different-user",
    );

    assert.match(message, /does not match/i);
  });
});
