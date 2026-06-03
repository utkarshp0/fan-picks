"use client";

import { useState } from "react";

import { AuditTimeline } from "@/components/championship/audit-timeline";
import { PredictionBoard } from "@/components/championship/prediction-board";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Championship } from "@/types/championship";

const tabs = [
  "Picks",
  "Participants",
  "Audit Log",
  "Bets",
] as const;

type ChampionshipDetailProps = {
  championship: Championship | null;
};

export function ChampionshipDetail({ championship }: ChampionshipDetailProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Picks");

  if (!championship) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <SectionHeading
          description="Create your first championship to unlock the MVP detail view."
          title="No pool yet"
        />
        <div className="mt-5 grid min-h-40 place-items-center rounded-lg border border-dashed border-border bg-background px-4 text-center">
          <p className="max-w-sm text-sm leading-6 text-muted">
            The pool page will show bets, participants, picks, audit events,
            and results after creation.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{championship.status}</Badge>
            <Badge variant="muted">{championship.inviteCode}</Badge>
          </div>
          <h3 className="mt-4 text-2xl font-semibold leading-8">
            {championship.name}
          </h3>
          <p className="mt-2 max-w-2xl break-all text-sm leading-6 text-muted">
            Share code: {championship.inviteCode}
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border border-border bg-surface-raised p-3 text-sm sm:min-w-64">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Start</span>
            <span>{formatDate(championship.startDate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Lock</span>
            <span>{formatDate(championship.lockDate)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="flex min-w-max gap-2 border-b border-border pb-2">
          {tabs.map((tab) => (
            <button
              className={`min-h-10 rounded-md px-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:bg-surface-raised hover:text-foreground"
              }`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">{renderTab(activeTab, championship)}</div>
    </section>
  );
}

function renderTab(
  activeTab: (typeof tabs)[number],
  championship: Championship,
) {
  if (activeTab === "Bets") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {championship.bets.map((category) => (
          <article
            className="rounded-lg border border-border bg-surface-raised p-4"
            key={category.id}
          >
            <h4 className="font-semibold">{category.name}</h4>
            <p className="mt-2 text-sm text-muted">{category.prompt}</p>
            <p className="mt-4 text-sm leading-6 text-muted">
              {category.scoringNote}
            </p>
          </article>
        ))}
      </div>
    );
  }

  if (activeTab === "Participants") {
    const participants = championship.participants.filter(
      (participant) => !participant.leftAt,
    );

    return (
      <div className="grid gap-3">
        {participants.map((participant) => (
          <div
            className="grid gap-4 rounded-lg border border-border bg-surface-raised p-4 lg:grid-cols-[1fr_360px]"
            key={participant.id}
          >
            <div>
              <p className="font-medium">{participant.displayName}</p>
              <p className="text-sm text-muted">@{participant.handle}</p>
              <p className="mt-2 text-xs text-muted">
                Joined {formatDateTime(participant.joinedAt)}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Status label="Role" value={participant.role} tone="accent" />
              <Status
                label="Joined"
                value={participant.joinedAt ? "Yes" : "Pending"}
                tone={participant.joinedAt ? "accent" : "warning"}
              />
              <Status
                label="Submission"
                value={participant.submissionStatus.replace("_", " ")}
                tone="muted"
              />
              <Status
                label="Locked"
                value={participant.lockedStatus}
                tone={participant.lockedStatus === "locked" ? "accent" : "muted"}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === "Picks") {
    return <PredictionBoard championship={championship} />;
  }

  if (activeTab === "Audit Log") {
    return <AuditTimeline championship={championship} />;
  }

  return null;
}

type StatusProps = {
  label: string;
  tone: "accent" | "muted" | "warning";
  value: string;
};

function Status({ label, tone, value }: StatusProps) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border bg-background px-3">
      <span className="text-xs text-muted">{label}</span>
      <Badge variant={tone}>{value}</Badge>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
