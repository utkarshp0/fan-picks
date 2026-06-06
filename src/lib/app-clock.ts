const testNowEnvKey = "FAN_PICKS_TEST_NOW";

export function getAppNow() {
  const override = process.env[testNowEnvKey];

  if (override) {
    const parsed = new Date(override);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${testNowEnvKey} must be a valid date/time.`);
    }

    return parsed;
  }

  return new Date();
}

export function getAppNowIso() {
  return getAppNow().toISOString();
}

export function isPastPoolLockDate(value: string, now = getAppNow()) {
  return now.getTime() >= getPoolLockDeadline(value).getTime();
}

export function isAppClockOverridden() {
  return Boolean(process.env[testNowEnvKey]);
}

function getPoolLockDeadline(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(`${value}T23:59:59`);
  }

  // Pool lock dates are product dates shown in IST. End of day IST is 18:29:59 UTC.
  return new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
}
