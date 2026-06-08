const placeholderTeamPatterns = [
  /^group\s+[a-z]\s+(winner|2nd place|second place)$/i,
  /^(winner|2nd place|second place|runner[-\s]?up)\s+group\s+[a-z]$/i,
  /^third\s+place\s+group/i,
  /^best\s+third/i,
];

const canonicalTeamNames: Record<string, string> = {
  "congo dr": "Democratic Republic of the Congo",
  "dr congo": "Democratic Republic of the Congo",
  "democratic republic of congo": "Democratic Republic of the Congo",
  "democratic republic of the congo": "Democratic Republic of the Congo",
  "ir iran": "Iran",
  "ivory coast": "Cote d'Ivoire",
  "cote d ivoire": "Cote d'Ivoire",
  "cote divoire": "Cote d'Ivoire",
  czechia: "Czech Republic",
  turkiye: "Turkey",
  "türkiye": "Turkey",
};

export function isPlaceholderSportsTeamName(value: string) {
  const normalized = normalizeTeamChoice(value);

  return placeholderTeamPatterns.some((pattern) => pattern.test(normalized));
}

export function canonicalizeSportsTeamName(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  const key = normalizeTeamChoice(trimmed).toLowerCase();

  return canonicalTeamNames[key] ?? trimmed;
}

export function filterRealSportsTeamNames(values: string[]) {
  const seen = new Set<string>();

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !isPlaceholderSportsTeamName(value))
    .map(canonicalizeSportsTeamName)
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
