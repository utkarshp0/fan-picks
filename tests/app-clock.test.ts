import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  getAppNow,
  getAppNowIso,
  isAppClockOverridden,
  isPastPoolLockDate,
} from "../src/lib/app-clock";
import { isPastMatchPickLock } from "../src/lib/match-pick-rules";

afterEach(() => {
  delete process.env.FAN_PICKS_TEST_NOW;
});

describe("app clock", () => {
  test("uses real time when no override is configured", () => {
    delete process.env.FAN_PICKS_TEST_NOW;

    assert.equal(isAppClockOverridden(), false);
    assert.ok(Math.abs(Date.now() - getAppNow().getTime()) < 1_000);
  });

  test("uses FAN_PICKS_TEST_NOW when configured", () => {
    process.env.FAN_PICKS_TEST_NOW = "2026-06-11T20:00:00.000Z";

    assert.equal(isAppClockOverridden(), true);
    assert.equal(getAppNowIso(), "2026-06-11T20:00:00.000Z");
  });

  test("simulates pool lock dates without waiting for real dates", () => {
    process.env.FAN_PICKS_TEST_NOW = "2026-06-10T18:29:58.000Z";
    assert.equal(isPastPoolLockDate("2026-06-10"), false);

    process.env.FAN_PICKS_TEST_NOW = "2026-06-10T18:29:59.999Z";
    assert.equal(isPastPoolLockDate("2026-06-10"), true);
  });

  test("simulates Match Pick lock times without waiting for kickoff", () => {
    const lockAt = "2026-06-11T17:00:00.000Z";

    process.env.FAN_PICKS_TEST_NOW = "2026-06-11T16:59:59.000Z";
    assert.equal(isPastMatchPickLock(lockAt, getAppNow()), false);

    process.env.FAN_PICKS_TEST_NOW = "2026-06-11T17:00:00.000Z";
    assert.equal(isPastMatchPickLock(lockAt, getAppNow()), true);
  });

  test("rejects invalid test time values loudly", () => {
    process.env.FAN_PICKS_TEST_NOW = "not-a-date";

    assert.throws(() => getAppNow(), /FAN_PICKS_TEST_NOW/);
  });
});
