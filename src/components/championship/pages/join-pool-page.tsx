"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { JoinChampionshipPanel } from "@/components/championship/join-championship-panel";
import type { Championship } from "@/types/championship";

export function JoinPoolPage({
  initialInviteCode = "",
}: {
  initialInviteCode?: string;
}) {
  const router = useRouter();

  function openJoinedPool(championship: Championship) {
    router.push(`/championships/${championship.id}/predictions`);
  }

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-3xl font-semibold leading-tight text-foreground">
            Join pool
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Enter the invite code your friend shared. Once joined, this pool
            appears in My pools and gets its own Picks, Participants, Audit, and
            Bets pages.
          </p>
        </section>
        <JoinChampionshipPanel
          autoJoin={Boolean(initialInviteCode)}
          defaultInviteCode={initialInviteCode}
          onJoined={openJoinedPool}
        />
      </div>
    </AppShell>
  );
}
