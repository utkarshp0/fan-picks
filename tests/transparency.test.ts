import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getEventTone,
  getIntegrityChecks,
  getIntegrityScore,
  getSubmissionForParticipant,
  hasNoPostLockVersions,
} from "../src/lib/transparency";
import type {
  AuditEvent,
  Championship,
  ChampionshipParticipant,
  PredictionSubmission,
} from "../src/types/championship";

// --- Fixtures ---

function makeParticipant(overrides: Partial<ChampionshipParticipant> = {}): ChampionshipParticipant {
  return {
    id: "p1",
    profileId: "profile-1",
    displayName: "Alice",
    handle: "alice",
    role: "creator",
    joinedAt: "2026-06-01T10:00:00Z",
    submissionStatus: "not_started",
    lockedStatus: "unlocked",
    ...overrides,
  };
}

function makeAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "e1",
    type: "pool_created",
    label: "Pool created",
    actorName: "Alice",
    timestamp: "2026-06-01T10:00:00Z",
    details: "Pool was created.",
    ...overrides,
  };
}

function makeSubmission(overrides: Partial<PredictionSubmission> = {}): PredictionSubmission {
  return {
    id: "s1",
    participantId: "p1",
    profileId: "profile-1",
    displayName: "Alice",
    versions: [],
    ...overrides,
  };
}

function makeChampionship(overrides: Partial<Championship> = {}): Championship {
  return {
    id: "c1",
    tournamentId: "fifa-world-cup-2026",
    templateId: "fifa-world-cup-2026",
    name: "Test Pool",
    slug: "test-pool",
    inviteCode: "INVITE123",
    status: "open",
    startDate: "2026-06-11",
    lockDate: "2026-06-10",
    isPublic: false,
    createdAt: "2026-06-01T00:00:00Z",
    creatorProfileId: "profile-1",
    bets: [],
    participants: [],
    predictions: [],
    auditLog: [],
    ...overrides,
  };
}

// --- getEventTone ---

describe("getEventTone", () => {
  test("prediction_locked → accent", () => {
    assert.equal(getEventTone("prediction_locked"), "accent");
  });

  test("prediction_unlocked → accent", () => {
    assert.equal(getEventTone("prediction_unlocked"), "accent");
  });

  test("participant_joined → accent", () => {
    assert.equal(getEventTone("participant_joined"), "accent");
  });

  test("pool_created → accent", () => {
    assert.equal(getEventTone("pool_created"), "accent");
  });

  test("prediction_draft_saved → warning", () => {
    assert.equal(getEventTone("prediction_draft_saved"), "warning");
  });

  test("invite_created → warning", () => {
    assert.equal(getEventTone("invite_created"), "warning");
  });

  test("participant_left → muted", () => {
    assert.equal(getEventTone("participant_left"), "muted");
  });

  test("bet_added → muted", () => {
    assert.equal(getEventTone("bet_added"), "muted");
  });

  test("bet_removed → muted", () => {
    assert.equal(getEventTone("bet_removed"), "muted");
  });

  test("prediction_field_changed → muted", () => {
    assert.equal(getEventTone("prediction_field_changed"), "muted");
  });
});

// --- hasNoPostLockVersions ---

describe("hasNoPostLockVersions", () => {
  test("returns true when submission is not locked", () => {
    const submission = makeSubmission({
      versions: [{ id: "v1", versionNumber: 1, picks: {}, createdAt: "2026-06-09T10:00:00Z" }],
    });
    assert.equal(hasNoPostLockVersions(submission), true);
  });

  test("returns true when locked and no versions exist after lock time", () => {
    const submission = makeSubmission({
      lockedAt: "2026-06-09T12:00:00Z",
      lockedVersionId: "v1",
      versions: [{ id: "v1", versionNumber: 1, picks: {}, createdAt: "2026-06-09T11:00:00Z" }],
    });
    assert.equal(hasNoPostLockVersions(submission), true);
  });

  test("returns true when locked and another version was created at the same time as lock", () => {
    const submission = makeSubmission({
      lockedAt: "2026-06-09T12:00:00Z",
      lockedVersionId: "v1",
      versions: [
        { id: "v1", versionNumber: 1, picks: {}, createdAt: "2026-06-09T12:00:00Z" },
      ],
    });
    assert.equal(hasNoPostLockVersions(submission), true);
  });

  test("returns false when a version was created after the lock time", () => {
    const submission = makeSubmission({
      lockedAt: "2026-06-09T12:00:00Z",
      lockedVersionId: "v1",
      versions: [
        { id: "v1", versionNumber: 1, picks: {}, createdAt: "2026-06-09T11:00:00Z" },
        { id: "v2", versionNumber: 2, picks: {}, createdAt: "2026-06-09T13:00:00Z" },
      ],
    });
    assert.equal(hasNoPostLockVersions(submission), false);
  });

  test("returns false when lockedVersionId is not found in versions", () => {
    const submission = makeSubmission({
      lockedAt: "2026-06-09T12:00:00Z",
      lockedVersionId: "v-missing",
      versions: [{ id: "v1", versionNumber: 1, picks: {}, createdAt: "2026-06-09T11:00:00Z" }],
    });
    assert.equal(hasNoPostLockVersions(submission), false);
  });

  test("returns true when locked with no lockedVersionId", () => {
    const submission = makeSubmission({
      lockedAt: undefined,
      lockedVersionId: undefined,
      versions: [],
    });
    assert.equal(hasNoPostLockVersions(submission), true);
  });
});

// --- getIntegrityChecks ---

describe("getIntegrityChecks", () => {
  test("all checks fail for an empty pool", () => {
    const pool = makeChampionship();
    const checks = getIntegrityChecks(pool);
    assert.equal(checks.length, 5);
    // No participants, no picks, no audit events
    assert.equal(checks[0].passed, false); // Pool members tracked
    assert.equal(checks[1].passed, false); // Participants tracked
    assert.equal(checks[2].passed, false); // Picks locked
    assert.equal(checks[3].passed, false); // Audit trail (needs >= 4)
    assert.equal(checks[4].passed, true);  // No post-lock changes (no predictions = trivially true)
  });

  test("pool members tracked passes when at least one active participant exists", () => {
    const pool = makeChampionship({
      participants: [makeParticipant({ joinedAt: "2026-06-01T10:00:00Z" })],
    });
    const checks = getIntegrityChecks(pool);
    assert.equal(checks[0].passed, true);
  });

  test("pool members tracked fails when participant has left", () => {
    const pool = makeChampionship({
      participants: [makeParticipant({ joinedAt: "2026-06-01T10:00:00Z", leftAt: "2026-06-02T10:00:00Z" })],
    });
    const checks = getIntegrityChecks(pool);
    assert.equal(checks[0].passed, false);
  });

  test("picks locked passes when at least one submission is locked", () => {
    const pool = makeChampionship({
      predictions: [makeSubmission({ lockedAt: "2026-06-09T12:00:00Z" })],
    });
    const checks = getIntegrityChecks(pool);
    assert.equal(checks[2].passed, true);
  });

  test("audit trail passes when there are 4 or more audit events", () => {
    const events = Array.from({ length: 4 }, (_, i) =>
      makeAuditEvent({ id: `e${i}` }),
    );
    const pool = makeChampionship({ auditLog: events });
    const checks = getIntegrityChecks(pool);
    assert.equal(checks[3].passed, true);
  });

  test("audit trail fails when there are fewer than 4 audit events", () => {
    const pool = makeChampionship({
      auditLog: [makeAuditEvent(), makeAuditEvent({ id: "e2" }), makeAuditEvent({ id: "e3" })],
    });
    const checks = getIntegrityChecks(pool);
    assert.equal(checks[3].passed, false);
  });

  test("no post-lock changes fails when a version was created after lock", () => {
    const submission = makeSubmission({
      lockedAt: "2026-06-09T12:00:00Z",
      lockedVersionId: "v1",
      versions: [
        { id: "v1", versionNumber: 1, picks: {}, createdAt: "2026-06-09T11:00:00Z" },
        { id: "v2", versionNumber: 2, picks: {}, createdAt: "2026-06-09T13:00:00Z" },
      ],
    });
    const pool = makeChampionship({ predictions: [submission] });
    const checks = getIntegrityChecks(pool);
    assert.equal(checks[4].passed, false);
  });
});

// --- getIntegrityScore ---

describe("getIntegrityScore", () => {
  test("returns 0 for an empty pool with no participants or events", () => {
    const pool = makeChampionship();
    assert.equal(getIntegrityScore(pool), 20); // only "no post-lock changes" passes
  });

  test("returns 100 when all checks pass", () => {
    const events = Array.from({ length: 4 }, (_, i) => makeAuditEvent({ id: `e${i}` }));
    const submission = makeSubmission({
      lockedAt: "2026-06-09T12:00:00Z",
      lockedVersionId: "v1",
      versions: [{ id: "v1", versionNumber: 1, picks: {}, createdAt: "2026-06-09T11:00:00Z" }],
    });
    const pool = makeChampionship({
      participants: [makeParticipant()],
      predictions: [submission],
      auditLog: events,
    });
    assert.equal(getIntegrityScore(pool), 100);
  });

  test("returns a percentage rounded to the nearest integer", () => {
    // 3 out of 5 checks passing = 60%
    const events = Array.from({ length: 4 }, (_, i) => makeAuditEvent({ id: `e${i}` }));
    const pool = makeChampionship({
      participants: [makeParticipant()],
      auditLog: events,
      // no locked predictions → picks locked = false, no post-lock = true
    });
    const score = getIntegrityScore(pool);
    // pool members tracked: true, participants tracked: true, picks locked: false,
    // audit trail: true, no post-lock: true → 4/5 = 80
    assert.equal(score, 80);
  });
});

// --- getSubmissionForParticipant ---

describe("getSubmissionForParticipant", () => {
  test("finds submission matching the participant's profileId", () => {
    const participant = makeParticipant({ profileId: "profile-1" });
    const submission = makeSubmission({ profileId: "profile-1" });
    const pool = makeChampionship({ predictions: [submission] });
    const result = getSubmissionForParticipant(participant, pool);
    assert.equal(result?.id, "s1");
  });

  test("returns undefined when no submission matches the participant", () => {
    const participant = makeParticipant({ profileId: "profile-2" });
    const submission = makeSubmission({ profileId: "profile-1" });
    const pool = makeChampionship({ predictions: [submission] });
    const result = getSubmissionForParticipant(participant, pool);
    assert.equal(result, undefined);
  });

  test("returns undefined when pool has no predictions", () => {
    const participant = makeParticipant();
    const pool = makeChampionship({ predictions: [] });
    const result = getSubmissionForParticipant(participant, pool);
    assert.equal(result, undefined);
  });
});
