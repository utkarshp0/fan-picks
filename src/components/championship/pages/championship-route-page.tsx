"use client";

import Link from "next/link";
import { CalendarClock, Check, Copy, LoaderCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { MouseEvent } from "react";

import { announceRouteStart, AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getChampionshipTemplate } from "@/data/templates";
import { useChampionships } from "@/lib/championship-store";
import {
  AuditRoute,
  ParticipantsRoute,
  PredictionsRoute,
  RulesRoute,
} from "@/components/championship/pages/championship-routes";
import type { Championship } from "@/types/championship";

type ChampionshipPageName = "predictions" | "participants" | "audit" | "rules";

type ChampionshipRoutePageProps = {
  championshipId: string;
  page: ChampionshipPageName;
};

const pageTabs: Array<{ label: string; path: ChampionshipPageName }> = [
  { label: "Picks", path: "predictions" },
  { label: "Participants", path: "participants" },
  { label: "Audit Log", path: "audit" },
  { label: "Bets", path: "rules" },
];

export function ChampionshipRoutePage({
  championshipId,
  page,
}: ChampionshipRoutePageProps) {
  const championships = useChampionships();
  const pathname = usePathname();
  const [pendingTabHref, setPendingTabHref] = useState("");
  const visiblePendingTabHref =
    pendingTabHref === pathname ? "" : pendingTabHref;
  const championship = championships.find((item) => item.id === championshipId);

  function handleTabNavigate(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (
      href === pathname ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    setPendingTabHref(href);
    announceRouteStart(href);
  }

  if (!championship) {
    return (
      <AppShell>
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-2xl font-semibold">Pool not found</h2>
          <p className="mt-2 text-sm text-muted">
            Go back to pools and choose an active one.
          </p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground"
            href="/championships"
          >
            View pools
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="grid gap-5">
        <ChampionshipHeader championship={championship} />

        <nav
          aria-label="Championship pages"
          className="flex gap-2 overflow-x-auto border-b border-border pb-2"
        >
          {pageTabs.map((tab) => (
            <PoolTabLink
              active={page === tab.path}
              href={`/championships/${championship.id}/${tab.path}`}
              key={tab.path}
              label={tab.label}
              loading={
                visiblePendingTabHref ===
                `/championships/${championship.id}/${tab.path}`
              }
              onNavigate={handleTabNavigate}
            />
          ))}
        </nav>

        {renderPage(page, championship)}
      </div>
    </AppShell>
  );
}

function PoolTabLink({
  active,
  href,
  label,
  loading,
  onNavigate,
}: {
  active: boolean;
  href: string;
  label: string;
  loading: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <Link
      className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted hover:bg-surface-raised hover:text-foreground"
      } ${loading ? "bg-accent/10 text-accent" : ""}`}
      href={href}
      onClick={(event) => onNavigate(event, href)}
    >
      {loading ? (
        <LoaderCircle aria-hidden className="h-4 w-4 animate-spin text-accent" />
      ) : null}
      {label}
    </Link>
  );
}

function ChampionshipHeader({ championship }: { championship: Championship }) {
  const [copied, setCopied] = useState(false);
  const tournament = getChampionshipTemplate(championship.tournamentId);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${championship.name}\nInvite code: ${championship.inviteCode}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{championship.status}</Badge>
            <Badge variant="muted">{championship.inviteCode}</Badge>
          </div>
          <h2 className="mt-4 text-2xl font-semibold leading-8">
            {championship.name}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {tournament.name} · {championship.bets.length} bet(s)
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
          <Button onClick={copyInvite} variant="secondary">
            {copied ? (
              <Check aria-hidden className="h-4 w-4" />
            ) : (
              <Copy aria-hidden className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy invite"}
          </Button>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-muted">
        <CalendarClock aria-hidden className="h-4 w-4 text-accent" />
        Picks lock after the lock date.
      </div>
    </section>
  );
}

function renderPage(page: ChampionshipPageName, championship: Championship) {
  if (page === "participants") {
    return <ParticipantsRoute championship={championship} />;
  }

  if (page === "audit") {
    return <AuditRoute championship={championship} />;
  }

  if (page === "rules") {
    return <RulesRoute championship={championship} />;
  }

  return <PredictionsRoute championship={championship} />;
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
