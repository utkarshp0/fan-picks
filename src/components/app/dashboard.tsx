"use client";

import { QrCode, Trophy } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app/app-shell";
import { LoginScreen } from "@/components/auth/login-screen";
import { ChampionshipWorkspace } from "@/components/championship/championship-workspace";
import { useGuestSession } from "@/components/auth/guest-session-provider";
import { useChampionships } from "@/lib/championship-store";

export function Dashboard() {
  const championships = useChampionships();
  const { profile, resetProfile } = useGuestSession();

  if (!profile) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-accent">
                Welcome, {profile.displayName}
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
                Choose a championship and make your picks.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                Every saved change is written to the championship audit log so
                everyone who joined can see what changed and when.
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground"
                href="/championships/create"
              >
                <Trophy aria-hidden className="h-4 w-4" />
                Create pool
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
                href="/championships/join"
              >
                <QrCode aria-hidden className="h-4 w-4" />
                Join with code
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-muted">Active championships</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-4xl font-semibold">{championships.length}</p>
              <div className="grid h-11 w-11 place-items-center rounded-md bg-surface-raised text-accent">
                <Trophy aria-hidden className="h-5 w-5" />
              </div>
            </div>
            <button
              className="mt-5 min-h-10 text-sm font-medium text-muted transition-colors hover:text-foreground"
              onClick={resetProfile}
              type="button"
            >
              Change user
            </button>
          </div>
        </section>

        <section className="grid gap-4">
          <ChampionshipWorkspace />
        </section>
      </div>
    </AppShell>
  );
}
