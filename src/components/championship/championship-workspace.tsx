"use client";

import { useState } from "react";

import { ChampionshipCreatePanel } from "@/components/championship/championship-create-panel";
import { ChampionshipDetail } from "@/components/championship/championship-detail";
import { JoinChampionshipPanel } from "@/components/championship/join-championship-panel";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  getSelectedChampionship,
  useChampionships,
} from "@/lib/championship-store";
import type { Championship } from "@/types/championship";

export function ChampionshipWorkspace() {
  const championships = useChampionships();
  const [selectedId, setSelectedId] = useState("");
  const selectedChampionship =
    championships.find((championship) => championship.id === selectedId) ??
    getSelectedChampionship(championships);

  function handleCreated(championship: Championship) {
    setSelectedId(championship.id);
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[380px_1fr]" id="championships">
      <div className="space-y-4">
        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading
            description="Choose a championship to view rules, make predictions, or check the audit log."
            title="My championships"
          />
          <div className="mt-4 grid gap-2">
            {championships.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background p-3 text-sm leading-6 text-muted">
                No championships yet.
              </p>
            ) : (
              championships.map((championship) => (
                <button
                  className={`min-h-14 rounded-md border px-3 text-left transition-colors ${
                    selectedChampionship?.id === championship.id
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface-raised hover:border-muted"
                  }`}
                  key={championship.id}
                  onClick={() => setSelectedId(championship.id)}
                  type="button"
                >
                  <span className="block truncate text-sm font-medium">
                    {championship.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {championship.inviteCode}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <ChampionshipCreatePanel onCreated={handleCreated} />

        <JoinChampionshipPanel
          defaultInviteCode={selectedChampionship?.inviteCode}
          onJoined={handleCreated}
        />
      </div>

      <ChampionshipDetail championship={selectedChampionship} />
    </section>
  );
}
