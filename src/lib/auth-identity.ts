export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function usernameToAuthEmail(username: string) {
  return `${normalizeUsername(username)}@fanpicks.local`;
}

export function normalizeDisplayName(value: string | undefined, username: string) {
  const cleanValue = value?.trim();

  if (cleanValue) {
    return cleanValue.slice(0, 40);
  }

  return normalizeUsername(username) || "Fan";
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
