"use client";

import { useMemo, useState } from "react";
import { Activity, Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatDateTime, getEventTone } from "@/lib/transparency";
import type { AuditEvent, Championship } from "@/types/championship";

type AuditTimelineProps = {
  championship: Championship;
};

const filters = [
  { label: "All", value: "all" },
  { label: "Created", value: "pool_created" },
  { label: "Joined", value: "participant_joined" },
  { label: "Left", value: "participant_left" },
  { label: "Bets", value: "bet_added" },
  { label: "Picks", value: "prediction_draft_saved" },
  { label: "Fields", value: "prediction_field_changed" },
  { label: "Locks", value: "prediction_locked" },
  { label: "Reopened", value: "prediction_unlocked" },
] as const;

export function AuditTimeline({ championship }: AuditTimelineProps) {
  const [activeFilter, setActiveFilter] =
    useState<(typeof filters)[number]["value"]>("all");
  const visibleEvents = useMemo(() => {
    const events = [...championship.auditLog].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    if (activeFilter === "all") {
      return events;
    }

    return events.filter((event) => event.type === activeFilter);
  }, [activeFilter, championship.auditLog]);

  return (
    <section className="rounded-lg border border-border bg-surface-raised p-4" id="audit">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          description="Permanent timeline for pool setup, joins, leaves, bet changes, pick changes, and locks."
          title="Audit log"
        />
        <div className="flex items-center gap-2 text-sm text-muted">
          <Filter aria-hidden className="h-4 w-4" />
          {visibleEvents.length} event(s)
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
              activeFilter === filter.value
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-background text-muted hover:text-foreground"
            }`}
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        {visibleEvents.map((event) => (
          <AuditEventCard event={event} key={event.id} />
        ))}
      </div>
    </section>
  );
}

function AuditEventCard({ event }: { event: AuditEvent }) {
  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface text-accent">
          <Activity aria-hidden className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">{event.label}</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {event.details}
              </p>
            </div>
            <Badge variant={getEventTone(event.type)}>
              {event.type.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="mt-3 text-xs text-muted">
            {event.actorName} · {formatDateTime(event.timestamp)}
          </p>
        </div>
      </div>
    </article>
  );
}
