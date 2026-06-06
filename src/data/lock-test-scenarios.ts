export const lockTestUsers = [
  {
    displayName: "Lock Test Asha",
    email: "lock-test-asha@fanpicks.local",
    handle: "lock-test-asha",
    password: "FanPicksTest!2026A",
    username: "lock-test-asha",
  },
  {
    displayName: "Lock Test Dev",
    email: "lock-test-dev@fanpicks.local",
    handle: "lock-test-dev",
    password: "FanPicksTest!2026D",
    username: "lock-test-dev",
  },
] as const;

export const lockTestScenarioIds = {
  activeFixture: "test-fixture-lock-active",
  activeMatchPickRoom: "00000000-0000-4000-8000-000000000201",
  activePool: "00000000-0000-4000-8000-000000000101",
  lockedFixture: "test-fixture-lock-past",
  lockedMatchPickRoom: "00000000-0000-4000-8000-000000000202",
  lockedPool: "00000000-0000-4000-8000-000000000102",
  scoredFixture: "test-fixture-lock-scored",
  scoredMatchPickRoom: "00000000-0000-4000-8000-000000000203",
  tournament: "fan-picks-lock-test-cup",
} as const;

export const lockTestClock = {
  afterAllLocks: "2026-06-11T20:00:00.000Z",
  beforeActiveLocks: "2026-06-10T10:00:00.000Z",
  exactMatchLock: "2026-06-11T17:00:00.000Z",
} as const;
