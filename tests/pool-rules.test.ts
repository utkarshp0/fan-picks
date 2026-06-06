import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  areBetsEqual,
  createPoolInviteMessage,
  createUniqueBetId,
  dedupeBets,
  getBetEditBlockMessage,
  getPoolInvitePath,
  getPredictionFieldChangeEvents,
  normalizeInviteCode,
  omitPick,
  validatePickLimits,
  validateRequiredPicks,
} from "../src/lib/championship-store";
import type {
  Championship,
  PredictionCategory,
  PredictionSubmission,
} from "../src/types/championship";

// --- fixtures ---

function makeBet(overrides: Partial<PredictionCategory> = {}): PredictionCategory {
  return {
    id: "champion",
    name: "Champion",
    type: "single-team",
    prompt: "Pick the winner.",
    selectionCount: 1,
    scoringNote: "",
    source: "default",
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
    inviteCode: "FP-ABC123",
    status: "open",
    startDate: "2026-06-11",
    lockDate: "2099-12-31", // far future by default so lock date has not passed
    isPublic: false,
    createdAt: "2026-06-01T00:00:00Z",
    creatorProfileId: "creator-profile",
    bets: [makeBet()],
    participants: [],
    predictions: [],
    auditLog: [],
    ...overrides,
  };
}

const singleBet = makeBet({ id: "champion", name: "Champion", selectionCount: 1 });
const multiBet = makeBet({ id: "top-4", name: "Top 4 teams", type: "multi-team", selectionCount: 4 });

// =============================================================================
// validatePickLimits — enforced on every draft save
// Rule: fail if any bet has MORE than selectionCount non-empty picks
// =============================================================================

describe("validatePickLimits", () => {
  test("returns empty string when all bets are within their limits", () => {
    assert.equal(validatePickLimits([singleBet], { champion: ["Brazil"] }), "");
  });

  test("returns empty string when picks are exactly at the limit", () => {
    const picks = { "top-4": ["Brazil", "Argentina", "France", "England"] };
    assert.equal(validatePickLimits([multiBet], picks), "");
  });

  test("returns empty string when a bet has zero picks (under-selection is allowed on draft)", () => {
    assert.equal(validatePickLimits([singleBet], { champion: [] }), "");
  });

  test("returns empty string when a bet has no picks entry at all", () => {
    assert.equal(validatePickLimits([singleBet], {}), "");
  });

  test("fails when picks exceed selectionCount", () => {
    const picks = { "top-4": ["Brazil", "Argentina", "France", "England", "Spain"] }; // 5 > 4
    const msg = validatePickLimits([multiBet], picks);
    assert.ok(msg.includes("Top 4 teams"), `expected bet name in: "${msg}"`);
    assert.ok(msg.includes("4"), `expected limit in: "${msg}"`);
  });

  test("fails for single bet when 2 picks are provided", () => {
    const msg = validatePickLimits([singleBet], { champion: ["Brazil", "Argentina"] });
    assert.ok(msg.includes("Champion"));
    assert.ok(msg.includes("1"));
  });

  test("ignores empty-string entries when counting (filter(Boolean))", () => {
    // ["", "Brazil", ""] → 1 non-empty pick → exactly at limit for selectionCount 1
    assert.equal(validatePickLimits([singleBet], { champion: ["", "Brazil", ""] }), "");
  });

  test("returns empty string for an empty bets array", () => {
    assert.equal(validatePickLimits([], {}), "");
  });

  test("only reports the first over-limit bet when multiple are present", () => {
    const picks = {
      champion: ["Brazil", "Argentina"],      // 2 > 1
      "top-4": ["Brazil", "Argentina", "France", "England", "Spain"], // 5 > 4
    };
    const msg = validatePickLimits([singleBet, multiBet], picks);
    // The first bet checked is singleBet (champion)
    assert.ok(msg.length > 0);
  });
});

// =============================================================================
// validateRequiredPicks — enforced only at lock time
// Rule: fail if any bet does NOT have exactly selectionCount non-empty picks
// =============================================================================

describe("validateRequiredPicks", () => {
  test("returns empty string when all bets have exactly the required count", () => {
    const picks = { champion: ["Brazil"] };
    assert.equal(validateRequiredPicks([singleBet], picks), "");
  });

  test("fails when a bet has zero picks (not enough for lock)", () => {
    const msg = validateRequiredPicks([singleBet], { champion: [] });
    assert.ok(msg.includes("Champion"), `expected bet name in: "${msg}"`);
  });

  test("fails when a bet has no picks entry at all", () => {
    const msg = validateRequiredPicks([singleBet], {});
    assert.ok(msg.includes("Champion"));
  });

  test("fails when picks are fewer than required", () => {
    const picks = { "top-4": ["Brazil", "Argentina"] }; // 2 of 4 required
    const msg = validateRequiredPicks([multiBet], picks);
    assert.ok(msg.includes("Top 4 teams"));
  });

  test("fails when picks are MORE than required (unlike validatePickLimits)", () => {
    const picks = { champion: ["Brazil", "Argentina"] }; // 2 for selectionCount 1
    const msg = validateRequiredPicks([singleBet], picks);
    assert.ok(msg.includes("Champion"), `expected error for over-selection at lock: "${msg}"`);
  });

  test("returns empty string when multi-pick bet has exactly the right count", () => {
    const picks = { "top-4": ["Brazil", "Argentina", "France", "England"] };
    assert.equal(validateRequiredPicks([multiBet], picks), "");
  });

  test("fails on the first incomplete bet, not all of them", () => {
    const picks = {
      champion: [], // incomplete
      "top-4": ["Brazil", "Argentina", "France", "England"], // complete
    };
    const msg = validateRequiredPicks([singleBet, multiBet], picks);
    assert.ok(msg.includes("Champion"));
  });

  test("returns empty for an empty bets array", () => {
    assert.equal(validateRequiredPicks([], {}), "");
  });

  test("error message uses 'Complete X before locking' phrasing", () => {
    const msg = validateRequiredPicks([singleBet], {});
    assert.match(msg, /Complete.*before locking/);
  });
});

// =============================================================================
// Key distinction: validatePickLimits vs validateRequiredPicks
// During draft save: only over-limit is rejected (zero picks is fine)
// During lock: exact count required (both under AND over are rejected)
// =============================================================================

describe("draft vs lock validation distinction", () => {
  test("under-selection passes draft save guard but fails lock guard", () => {
    const picks = { champion: [] }; // 0 picks for selectionCount 1
    assert.equal(validatePickLimits([singleBet], picks), "");       // draft: OK
    assert.notEqual(validateRequiredPicks([singleBet], picks), ""); // lock: rejected
  });

  test("over-selection fails both draft save and lock guards", () => {
    const picks = { champion: ["Brazil", "Argentina"] }; // 2 > selectionCount 1
    assert.notEqual(validatePickLimits([singleBet], picks), "");    // draft: rejected
    assert.notEqual(validateRequiredPicks([singleBet], picks), ""); // lock: rejected
  });

  test("exact selection passes both guards", () => {
    const picks = { champion: ["Brazil"] };
    assert.equal(validatePickLimits([singleBet], picks), "");       // draft: OK
    assert.equal(validateRequiredPicks([singleBet], picks), "");    // lock: OK
  });
});

// =============================================================================
// getBetEditBlockMessage — protects bet add/remove/save actions
// =============================================================================

describe("getBetEditBlockMessage", () => {
  test("returns empty string when creator edits before lock date with no locked submissions", () => {
    const pool = makeChampionship({ creatorProfileId: "creator-profile" });
    assert.equal(getBetEditBlockMessage(pool, "creator-profile"), "");
  });

  test("blocks non-creator users", () => {
    const pool = makeChampionship({ creatorProfileId: "creator-profile" });
    const msg = getBetEditBlockMessage(pool, "someone-else");
    assert.ok(msg.includes("creator"), `expected creator message in: "${msg}"`);
  });

  test("blocks creator after lock date has passed", () => {
    const pool = makeChampionship({
      creatorProfileId: "creator-profile",
      lockDate: "2020-01-01", // clearly in the past
    });
    const msg = getBetEditBlockMessage(pool, "creator-profile");
    assert.ok(msg.includes("lock date"), `expected lock date message in: "${msg}"`);
  });

  test("blocks creator when any participant has locked picks", () => {
    const pool = makeChampionship({
      creatorProfileId: "creator-profile",
      predictions: [makeSubmission({ lockedAt: "2026-06-09T12:00:00Z" })],
    });
    const msg = getBetEditBlockMessage(pool, "creator-profile");
    assert.ok(msg.includes("locked picks"), `expected locked picks message in: "${msg}"`);
  });

  test("blocks non-creator even if lock date is in future", () => {
    const pool = makeChampionship({
      creatorProfileId: "creator-profile",
      lockDate: "2099-12-31",
    });
    const msg = getBetEditBlockMessage(pool, "participant-profile");
    assert.ok(msg.length > 0);
  });

  test("creator with a past-lock-date pool cannot edit even with no locked submissions", () => {
    const pool = makeChampionship({
      creatorProfileId: "creator-profile",
      lockDate: "2020-01-01",
      predictions: [],
    });
    const msg = getBetEditBlockMessage(pool, "creator-profile");
    assert.ok(msg.length > 0);
  });
});

// =============================================================================
// getPredictionFieldChangeEvents — audit events when picks change
// =============================================================================

describe("getPredictionFieldChangeEvents", () => {
  const ts = "2026-06-09T10:00:00Z";

  test("returns empty array when no picks changed", () => {
    const bets = [singleBet];
    const picks = { champion: ["Brazil"] };
    const events = getPredictionFieldChangeEvents(bets, picks, picks, "Alice", ts);
    assert.equal(events.length, 0);
  });

  test("returns one event per changed bet", () => {
    const bets = [singleBet, multiBet];
    const prev = { champion: ["Brazil"], "top-4": ["Brazil", "Argentina", "France", "England"] };
    const next = { champion: ["France"], "top-4": ["Brazil", "Argentina", "France", "England"] };
    const events = getPredictionFieldChangeEvents(bets, prev, next, "Alice", ts);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "prediction_field_changed");
  });

  test("generates a 'set to' event when a bet has no previous pick", () => {
    const bets = [singleBet];
    const prev = {};
    const next = { champion: ["Brazil"] };
    const events = getPredictionFieldChangeEvents(bets, prev, next, "Alice", ts);
    assert.equal(events.length, 1);
    assert.ok(events[0].details.includes("set"), `expected 'set' in details: "${events[0].details}"`);
    assert.ok(events[0].details.includes("Brazil"));
  });

  test("generates a 'changed from X to Y' event when pick is changed", () => {
    const bets = [singleBet];
    const prev = { champion: ["Brazil"] };
    const next = { champion: ["France"] };
    const events = getPredictionFieldChangeEvents(bets, prev, next, "Alice", ts);
    assert.equal(events.length, 1);
    assert.ok(events[0].details.includes("Brazil"), `expected old value in: "${events[0].details}"`);
    assert.ok(events[0].details.includes("France"), `expected new value in: "${events[0].details}"`);
  });

  test("generates a 'changed to empty' event when pick is cleared", () => {
    const bets = [singleBet];
    const prev = { champion: ["Brazil"] };
    const next = { champion: [] };
    const events = getPredictionFieldChangeEvents(bets, prev, next, "Alice", ts);
    assert.equal(events.length, 1);
    assert.ok(events[0].details.includes("empty"), `expected 'empty' in: "${events[0].details}"`);
  });

  test("returns an event for each bet that changed", () => {
    const bets = [singleBet, multiBet];
    const prev = { champion: ["Brazil"], "top-4": ["A", "B", "C", "D"] };
    const next = { champion: ["France"], "top-4": ["A", "B", "C", "E"] };
    const events = getPredictionFieldChangeEvents(bets, prev, next, "Alice", ts);
    assert.equal(events.length, 2);
  });

  test("events have the correct type, actorName, and timestamp", () => {
    const bets = [singleBet];
    const events = getPredictionFieldChangeEvents(bets, {}, { champion: ["Brazil"] }, "Alice", ts);
    assert.equal(events[0].type, "prediction_field_changed");
    assert.equal(events[0].actorName, "Alice");
    assert.equal(events[0].timestamp, ts);
  });

  test("returns empty array when bets list is empty", () => {
    const events = getPredictionFieldChangeEvents([], {}, {}, "Alice", ts);
    assert.equal(events.length, 0);
  });
});

// =============================================================================
// normalizeInviteCode — used to match invite codes case/whitespace-insensitively
// =============================================================================

describe("normalizeInviteCode", () => {
  test("uppercases the code", () => {
    assert.equal(normalizeInviteCode("fp-abc123"), "FP-ABC123");
  });

  test("trims leading and trailing whitespace", () => {
    assert.equal(normalizeInviteCode("  FP-ABC123  "), "FP-ABC123");
  });

  test("removes all internal whitespace", () => {
    assert.equal(normalizeInviteCode("FP ABC 123"), "FPABC123");
  });

  test("handles already-normalized code unchanged", () => {
    assert.equal(normalizeInviteCode("FP-ABC123"), "FP-ABC123");
  });

  test("handles empty string", () => {
    assert.equal(normalizeInviteCode(""), "");
  });
});

describe("pool invite links", () => {
  test("builds a shareable pool invite path", () => {
    assert.equal(
      getPoolInvitePath("FP-ABC 123"),
      "/championships/join?code=FP-ABC%20123",
    );
  });

  test("builds a friendly pool invite message", () => {
    const message = createPoolInviteMessage({
      inviteCode: "FP-ABC123",
      inviteUrl: "https://fan-picks.vercel.app/championships/join?code=FP-ABC123",
      lockLabel: "10 Jun 2026",
      poolName: "World Cup Office Pool",
    });

    assert.match(message, /Join my Fan Picks pool: World Cup Office Pool/);
    assert.match(message, /Make your picks before 10 Jun 2026/);
    assert.match(message, /Invite code: FP-ABC123/);
    assert.match(message, /https:\/\/fan-picks\.vercel\.app\/championships\/join\?code=FP-ABC123/);
  });
});

// =============================================================================
// dedupeBets — prevents duplicate bets when building pool bets list
// =============================================================================

describe("dedupeBets", () => {
  test("returns empty array for empty input", () => {
    assert.deepEqual(dedupeBets([]), []);
  });

  test("returns same items when there are no duplicates", () => {
    const bets = [
      makeBet({ id: "champion" }),
      makeBet({ id: "top-4", name: "Top 4" }),
    ];
    assert.equal(dedupeBets(bets).length, 2);
  });

  test("removes duplicate bet IDs, keeping the first occurrence", () => {
    const bets = [
      makeBet({ id: "champion", name: "First" }),
      makeBet({ id: "champion", name: "Duplicate" }),
    ];
    const result = dedupeBets(bets);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "First");
  });

  test("keeps all unique bets even when there are some duplicates", () => {
    const bets = [
      makeBet({ id: "a", name: "A" }),
      makeBet({ id: "b", name: "B" }),
      makeBet({ id: "a", name: "A-dup" }),
      makeBet({ id: "c", name: "C" }),
    ];
    const result = dedupeBets(bets);
    assert.equal(result.length, 3);
    assert.deepEqual(result.map((b) => b.id), ["a", "b", "c"]);
  });
});

// =============================================================================
// areBetsEqual — change detection to avoid unnecessary saves
// =============================================================================

describe("areBetsEqual", () => {
  test("returns true for identical bets in the same order", () => {
    const bets = [makeBet({ id: "champion" })];
    assert.equal(areBetsEqual(bets, bets), true);
  });

  test("returns false when bets have different ids", () => {
    const a = [makeBet({ id: "champion" })];
    const b = [makeBet({ id: "winner" })];
    assert.equal(areBetsEqual(a, b), false);
  });

  test("returns false when bets are in different order (order matters)", () => {
    const bet1 = makeBet({ id: "a", name: "A" });
    const bet2 = makeBet({ id: "b", name: "B" });
    assert.equal(areBetsEqual([bet1, bet2], [bet2, bet1]), false);
  });

  test("returns true for two empty arrays", () => {
    assert.equal(areBetsEqual([], []), true);
  });

  test("returns false when one array is longer", () => {
    const a = [makeBet({ id: "champion" })];
    const b = [makeBet({ id: "champion" }), makeBet({ id: "top-4", name: "Top 4" })];
    assert.equal(areBetsEqual(a, b), false);
  });
});

// =============================================================================
// omitPick — used when a bet is removed from pool to clean up prediction picks
// =============================================================================

describe("omitPick", () => {
  test("removes the specified bet's picks from the map", () => {
    const picks = { champion: ["Brazil"], "top-4": ["A", "B", "C", "D"] };
    const result = omitPick(picks, "champion");
    assert.equal("champion" in result, false);
    assert.ok("top-4" in result);
  });

  test("does not mutate the original picks object", () => {
    const picks = { champion: ["Brazil"] };
    omitPick(picks, "champion");
    assert.ok("champion" in picks, "original picks should be unchanged");
  });

  test("returns the same picks when betId is not present", () => {
    const picks = { champion: ["Brazil"] };
    const result = omitPick(picks, "missing-bet");
    assert.deepEqual(result, picks);
  });

  test("handles empty picks map", () => {
    const result = omitPick({}, "champion");
    assert.deepEqual(result, {});
  });
});

// =============================================================================
// createUniqueBetId — ensures no duplicate bet IDs when creator adds custom bets
// =============================================================================

describe("createUniqueBetId", () => {
  test("generates custom-{slug} for a new bet name with no conflicts", () => {
    const result = createUniqueBetId([], "My Pick");
    assert.equal(result, "custom-my-pick");
  });

  test("appends -2 when the base slug already exists", () => {
    const existing = [makeBet({ id: "custom-my-pick" })];
    const result = createUniqueBetId(existing, "My Pick");
    assert.equal(result, "custom-my-pick-2");
  });

  test("increments suffix until a unique id is found", () => {
    const existing = [
      makeBet({ id: "custom-my-pick" }),
      makeBet({ id: "custom-my-pick-2" }),
    ];
    const result = createUniqueBetId(existing, "My Pick");
    assert.equal(result, "custom-my-pick-3");
  });

  test("handles name with special characters (slugified)", () => {
    const result = createUniqueBetId([], "Top 4 Teams!");
    assert.equal(result, "custom-top-4-teams");
  });
});
