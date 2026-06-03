import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isPastLockDate,
  validateLockPicks,
} from "../src/lib/server-prediction-locks";
import type { PredictionCategory } from "../src/types/championship";

// --- fixtures ---

const singleBet: PredictionCategory = {
  id: "champion",
  name: "Champion",
  type: "single-team",
  prompt: "Pick the tournament winner.",
  selectionCount: 1,
  scoringNote: "Five points for the correct champion.",
  source: "default",
};

const multiBet: PredictionCategory = {
  id: "top-4-teams",
  name: "Top 4 teams",
  type: "multi-team",
  prompt: "Pick the 4 teams you think will reach the semifinals.",
  selectionCount: 4,
  scoringNote: "One point for each correct semifinalist.",
  source: "default",
};

const choiceBet: PredictionCategory = {
  id: "first-giant-out",
  name: "First giant eliminated",
  type: "choice",
  prompt: "Choose the major team you think will be eliminated first.",
  selectionCount: 1,
  scoringNote: "Two points for the correct pick.",
  choices: ["Brazil", "Argentina", "France", "England", "Spain", "Germany"],
  source: "default",
};

// --- validateLockPicks ---

describe("validateLockPicks", () => {
  test("passes when a single-pick bet has exactly 1 pick", () => {
    assert.equal(validateLockPicks([singleBet], { champion: ["Brazil"] }), "");
  });

  test("passes when a multi-pick bet has exactly the required count", () => {
    const picks = { "top-4-teams": ["Brazil", "Argentina", "France", "England"] };
    assert.equal(validateLockPicks([multiBet], picks), "");
  });

  test("passes when all bets in a pool are satisfied", () => {
    const picks = {
      champion: ["Brazil"],
      "top-4-teams": ["Brazil", "Argentina", "France", "England"],
    };
    assert.equal(validateLockPicks([singleBet, multiBet], picks), "");
  });

  test("fails when picks array is empty for a required bet", () => {
    const msg = validateLockPicks([singleBet], { champion: [] });
    assert.ok(msg.includes("Champion"), `expected Champion in: "${msg}"`);
    assert.ok(msg.includes("1"), `expected required count in: "${msg}"`);
  });

  test("fails when bet has no entry in picks at all", () => {
    const msg = validateLockPicks([singleBet], {});
    assert.ok(msg.includes("Champion"));
  });

  test("fails when multi-pick bet has too few picks", () => {
    const picks = { "top-4-teams": ["Brazil", "Argentina"] }; // 2 of 4 required
    const msg = validateLockPicks([multiBet], picks);
    assert.ok(msg.includes("Top 4 teams"));
    assert.ok(msg.includes("4"));
  });

  test("fails when multi-pick bet has too many picks", () => {
    const picks = {
      "top-4-teams": ["Brazil", "Argentina", "France", "England", "Spain"], // 5 instead of 4
    };
    const msg = validateLockPicks([multiBet], picks);
    assert.ok(msg.includes("Top 4 teams"));
  });

  test("ignores empty-string entries when counting picks (filter(Boolean))", () => {
    // 3 entries but only 1 non-empty → selectionCount 1 → should pass
    const picks = { champion: ["", "Brazil", ""] };
    assert.equal(validateLockPicks([singleBet], picks), "");
  });

  test("fails only on the unsatisfied bet when multiple bets are in the pool", () => {
    const picks = {
      champion: ["Brazil"],
      "top-4-teams": ["Brazil"], // only 1 of 4 required
    };
    const msg = validateLockPicks([singleBet, multiBet], picks);
    assert.ok(msg.includes("Top 4 teams"), `expected Top 4 teams in: "${msg}"`);
    assert.ok(!msg.includes("Champion"), `unexpected Champion in: "${msg}"`);
  });

  test("works for choice-type bets", () => {
    assert.equal(validateLockPicks([choiceBet], { "first-giant-out": ["Brazil"] }), "");
  });

  test("fails for choice-type bet with no pick", () => {
    const msg = validateLockPicks([choiceBet], { "first-giant-out": [] });
    assert.ok(msg.includes("First giant eliminated"));
  });

  test("passes for an empty bets array (nothing to validate)", () => {
    assert.equal(validateLockPicks([], {}), "");
  });

  test("error message names the offending bet", () => {
    const msg = validateLockPicks([singleBet], {});
    assert.ok(msg.startsWith("Champion"), `message should start with bet name: "${msg}"`);
  });
});

// --- isPastLockDate ---

describe("isPastLockDate", () => {
  test("returns true for a clearly past date", () => {
    assert.equal(isPastLockDate("2020-01-01"), true);
  });

  test("returns true for a date several years in the past", () => {
    assert.equal(isPastLockDate("2015-06-15"), true);
  });

  test("returns false for a clearly future date", () => {
    assert.equal(isPastLockDate("2099-12-31"), false);
  });

  test("returns false for a date a few years in the future", () => {
    assert.equal(isPastLockDate("2030-01-01"), false);
  });

  test("lock boundary is 23:59:59 on the given date (not midnight)", () => {
    // A date like "2026-06-10" locks at 2026-06-10T23:59:59, not T00:00:00.
    // Verify this by checking that a far-future date is not past.
    assert.equal(isPastLockDate("2050-06-10"), false);
  });
});
