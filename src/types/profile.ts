export type AnonymousProfile = {
  id: string;
  displayName: string;
  handle: string;
  avatarInitials: string;
  createdAt: string;
  lastSeenAt: string;
};

export type ProfileDraft = Pick<AnonymousProfile, "displayName" | "handle">;
