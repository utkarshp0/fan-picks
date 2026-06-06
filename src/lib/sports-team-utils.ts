const placeholderTeamPatterns = [
  /^group\s+[a-z]\s+(winner|2nd place|second place)$/i,
  /^(winner|2nd place|second place|runner[-\s]?up)\s+group\s+[a-z]$/i,
  /^third\s+place\s+group/i,
  /^best\s+third/i,
];

export function isPlaceholderSportsTeamName(value: string) {
  const normalized = normalizeTeamChoice(value);

  return placeholderTeamPatterns.some((pattern) => pattern.test(normalized));
}

export function filterRealSportsTeamNames(values: string[]) {
  const seen = new Set<string>();

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !isPlaceholderSportsTeamName(value))
    .filter((value) => {
      const key = normalizeTeamChoice(value).toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function normalizeTeamChoice(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
