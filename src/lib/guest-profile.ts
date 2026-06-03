import type { AnonymousProfile, ProfileDraft } from "@/types/profile";

export function createAnonymousProfile(displayName = "Fan"): AnonymousProfile {
  const id = getStableId();
  const suffix = id.slice(-5).toUpperCase();
  const cleanName = displayName.trim() || "Fan";

  return {
    id,
    displayName: cleanName,
    handle: `guest-${suffix.toLowerCase()}`,
    avatarInitials: getInitials(cleanName),
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
}

export function updateAnonymousProfile(
  profile: AnonymousProfile,
  draft: ProfileDraft,
): AnonymousProfile {
  const displayName = draft.displayName.trim() || profile.displayName;
  const handle = normalizeHandle(draft.handle) || profile.handle;

  return {
    ...profile,
    displayName,
    handle,
    avatarInitials: getInitials(displayName),
    lastSeenAt: new Date().toISOString(),
  };
}

export function normalizeHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

function getStableId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
