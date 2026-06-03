"use client";

import { FormEvent } from "react";
import { RotateCcw, ShieldCheck, UserRound } from "lucide-react";

import { useGuestSession } from "@/components/auth/guest-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";

export function AnonymousProfilePanel() {
  const { isReady, profile, resetProfile, updateProfile } = useGuestSession();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    updateProfile({
      displayName: String(formData.get("displayName") ?? ""),
      handle: String(formData.get("handle") ?? ""),
    });
  }

  if (!isReady || !profile) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4" id="profile">
        <SectionHeading
          description="A guest identity is created automatically on this device. No email, OTP, or password required."
          eyebrow="Anonymous access"
          title="Guest profile"
        />
        <div className="mt-5 h-11 animate-pulse rounded-md bg-surface-raised" />
        <div className="mt-3 h-11 animate-pulse rounded-md bg-surface-raised" />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4" id="profile">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          description="A guest identity is created automatically on this device. No email, OTP, or password required."
          eyebrow="Anonymous access"
          title="Guest profile"
        />
        <Badge variant="accent">Active</Badge>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
          {profile.avatarInitials || <UserRound aria-hidden className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.displayName}</p>
          <p className="truncate text-sm text-muted">@{profile.handle}</p>
        </div>
      </div>

      <form
        className="mt-5 grid gap-3"
        key={`${profile.id}-${profile.lastSeenAt}`}
        onSubmit={handleSubmit}
      >
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Display name</span>
          <input
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
            defaultValue={profile.displayName}
            maxLength={40}
            name="displayName"
            placeholder="Arun"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Handle</span>
          <input
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
            defaultValue={profile.handle}
            maxLength={24}
            name="handle"
            placeholder="arun"
          />
        </label>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Button type="submit">
            <ShieldCheck aria-hidden className="h-4 w-4" />
            Save profile
          </Button>
          <Button onClick={resetProfile} type="button" variant="secondary">
            <RotateCcw aria-hidden className="h-4 w-4" />
            New guest
          </Button>
        </div>
      </form>

      <p className="mt-4 text-xs leading-5 text-muted">
        Guest ID: {profile.id.slice(0, 8)}...{profile.id.slice(-6)}
      </p>
    </section>
  );
}
