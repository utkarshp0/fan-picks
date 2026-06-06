import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  lockTestClock,
  lockTestScenarioIds,
  lockTestUsers,
} from "../src/data/lock-test-scenarios";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("lock test scenarios", () => {
  test("defines exactly two reusable test users", () => {
    assert.equal(lockTestUsers.length, 2);
    assert.deepEqual(
      lockTestUsers.map((user) => user.username),
      ["lock-test-asha", "lock-test-dev"],
    );
  });

  test("test users use Fan Picks local auth emails and non-empty passwords", () => {
    for (const user of lockTestUsers) {
      assert.match(user.email, /@fanpicks\.local$/);
      assert.ok(user.password.length >= 12);
      assert.ok(user.displayName.startsWith("Lock Test"));
      assert.ok(user.handle.startsWith("lock-test-"));
    }
  });

  test("pool and Match Pick room IDs are valid UUIDs for Supabase tables", () => {
    assert.match(lockTestScenarioIds.activePool, uuidPattern);
    assert.match(lockTestScenarioIds.lockedPool, uuidPattern);
    assert.match(lockTestScenarioIds.activeMatchPickRoom, uuidPattern);
    assert.match(lockTestScenarioIds.lockedMatchPickRoom, uuidPattern);
    assert.match(lockTestScenarioIds.scoredMatchPickRoom, uuidPattern);
  });

  test("test clock checkpoints move from before lock to exact lock to after all locks", () => {
    assert.ok(
      new Date(lockTestClock.beforeActiveLocks).getTime() <
        new Date(lockTestClock.exactMatchLock).getTime(),
    );
    assert.ok(
      new Date(lockTestClock.exactMatchLock).getTime() <
        new Date(lockTestClock.afterAllLocks).getTime(),
    );
  });
});
