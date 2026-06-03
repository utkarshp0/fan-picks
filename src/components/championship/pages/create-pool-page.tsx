"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { ChampionshipCreatePanel } from "@/components/championship/championship-create-panel";
import type { Championship } from "@/types/championship";

export function CreatePoolPage() {
  const router = useRouter();

  function openCreatedPool(championship: Championship) {
    router.push(`/championships/${championship.id}/predictions`);
  }

  return (
    <AppShell>
      <div className="grid gap-5">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-3xl font-semibold leading-tight text-foreground">
            Create pool
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Choose a tournament, keep the default bets you want, add any custom
            bets, then share the invite code with your group.
          </p>
        </section>
        <ChampionshipCreatePanel onCreated={openCreatedPool} />
      </div>
    </AppShell>
  );
}
