"use client";

import { UserRound } from "lucide-react";

import { useGuestSession } from "@/components/auth/guest-session-provider";

export function ProfileChip() {
  const { isReady, profile } = useGuestSession();

  if (!isReady || !profile) {
    return (
      <div className="hidden h-11 w-32 animate-pulse rounded-md bg-surface-raised sm:block" />
    );
  }

  return (
    <div className="hidden min-h-11 items-center gap-3 rounded-md border border-border bg-surface-raised px-3 sm:flex">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
        {profile.avatarInitials || <UserRound aria-hidden className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {profile.displayName}
        </p>
        <p className="truncate text-xs text-muted">@{profile.handle}</p>
      </div>
    </div>
  );
}
