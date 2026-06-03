"use client";

import Link from "next/link";
import { Copy, Plus, QrCode } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/app-shell";
import { useGuestSession } from "@/components/auth/guest-session-provider";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getChampionshipTemplate } from "@/data/templates";
import { leaveChampionship, useChampionships } from "@/lib/championship-store";
import type { Championship } from "@/types/championship";

export function ChampionshipListPage() {
  const championships = useChampionships();
  const { profile } = useGuestSession();
  const [message, setMessage] = useState("");
  const [leavingPoolId, setLeavingPoolId] = useState("");
  const myChampionships = championships.filter((championship) =>
    championship.participants.some(
      (participant) => participant.profileId === profile?.id && !participant.leftAt,
    ),
  );

  async function handleLeave(championship: Championship) {
    if (!profile) {
      return;
    }

    setLeavingPoolId(championship.id);
    try {
      const result = await leaveChampionship(championship.id, profile);
      setMessage(result.message);
    } finally {
      setLeavingPoolId("");
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <section className="rounded-lg border border-border bg-surface p-5 sm:p-6">
          <p className="text-sm font-medium text-accent">
            Welcome, {profile?.displayName}
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
            Make a prediction pool for your group.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            Pick an upcoming tournament, choose a few bets, share the invite
            code, and let everyone save their picks before the lock date.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground"
              href="/championships/create"
            >
              <Plus aria-hidden className="h-4 w-4" />
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
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading
            description="Pools you created or joined. Leaving a pool removes it from this list."
            title="My pools"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {myChampionships.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background p-3 text-sm leading-6 text-muted">
                No pools yet. Create one for your group or join with an invite code.
              </p>
            ) : (
              myChampionships.map((championship) => {
                const tournament = getChampionshipTemplate(championship.tournamentId);

                return (
                  <article
                    className="rounded-lg border border-border bg-surface-raised p-4"
                    key={championship.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{championship.name}</h3>
                        <p className="mt-1 text-sm text-muted">
                          {tournament.name}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {
                            championship.participants.filter(
                              (participant) => !participant.leftAt,
                            ).length
                          }{" "}
                          participant(s) · {championship.bets.length} bet(s)
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted">
                        <Copy aria-hidden className="h-3.5 w-3.5" />
                        {championship.inviteCode}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Link
                        className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground"
                        href={`/championships/${championship.id}/predictions`}
                      >
                        Open
                      </Link>
                      <Button
                        loading={leavingPoolId === championship.id}
                        loadingLabel="Leaving pool"
                        onClick={() => handleLeave(championship)}
                        variant="secondary"
                      >
                        Leave
                      </Button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          {message ? (
            <p className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
              {message}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading
            description="No deposits, odds, payouts, or real-money betting. This is built for office pools, WhatsApp groups, and bragging rights."
            title="Friendly by design"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Info label="1" title="Create" text="Pick a tournament and the bets your group cares about." />
            <Info label="2" title="Invite" text="Share one short code with friends, family, or coworkers." />
            <Info label="3" title="Pick" text="Everyone saves picks before lock; changes are audited." />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Info({ label, text, title }: { label: string; text: string; title: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
        {label}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}
