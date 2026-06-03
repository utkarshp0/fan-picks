"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Clock3,
  Radio,
  Shield,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import type { LiveScoresSnapshot, SportsFixture } from "@/types/sports-data";

const refreshMs = 60_000;

export function LiveScoresPage() {
  const [snapshot, setSnapshot] = useState<LiveScoresSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadScores() {
      try {
        const response = await fetch("/api/live-scores", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Live scores are unavailable right now.");
        }

        const nextSnapshot = (await response.json()) as LiveScoresSnapshot;

        if (isMounted) {
          setSnapshot(nextSnapshot);
          setMessage("");
        }
      } catch (error) {
        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Live scores are unavailable right now.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadScores();
    const timer = window.setInterval(() => void loadScores(), refreshMs);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const featuredMatch =
    snapshot?.live[0] ?? snapshot?.upcoming[0] ?? snapshot?.completed[0] ?? null;
  const dateChips = useMemo(
    () => getDateChips(snapshot?.fixtures ?? []),
    [snapshot?.fixtures],
  );

  return (
    <AppShell>
      <div className="mx-auto grid max-w-7xl gap-5">
        <section className="overflow-hidden rounded-lg border border-border bg-[radial-gradient(circle_at_top_left,rgba(24,195,126,0.18),transparent_38%),linear-gradient(135deg,#111a1f,#121016_58%,#090a0d)] p-4 shadow-2xl shadow-black/20 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex min-h-[380px] flex-col justify-between rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-accent">
                    {snapshot?.tournamentName ?? "FIFA World Cup 2026"}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-5xl">
                    Live Scores
                  </h1>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3 py-2 text-sm text-muted">
                  <Radio
                    aria-hidden
                    className="h-4 w-4 text-accent"
                  />
                  {snapshot?.live.length ?? 0} live
                </div>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-2">
                {dateChips.map((chip) => (
                  <div
                    className="grid min-h-16 place-items-center rounded-full border border-white/10 bg-background/45 px-2 text-center"
                    key={chip.key}
                  >
                    <span className="text-[10px] uppercase text-muted">
                      {chip.dayName}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {chip.day}
                    </span>
                  </div>
                ))}
              </div>

              {featuredMatch ? (
                <HeroScoreCard fixture={featuredMatch} />
              ) : (
                <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-background/40 p-5 text-sm text-muted">
                  {isLoading
                    ? "Loading tournament matches..."
                    : "No World Cup fixtures are available yet."}
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <ScoreStatCard
                icon={Trophy}
                label="Fixtures"
                value={String(snapshot?.fixtures.length ?? 0)}
              />
              <ScoreStatCard
                icon={Shield}
                label="Upcoming"
                value={String(snapshot?.upcoming.length ?? 0)}
              />
              <ScoreStatCard
                icon={Sparkles}
                label="Source"
                value={formatSource(snapshot?.source)}
              />
            </div>
          </div>
        </section>

        {message ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            {message}
          </p>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
            <SectionTitle
              count={snapshot?.live.length ?? 0}
              title="Live match"
            />
            {snapshot?.live.length ? (
              <div className="grid gap-3">
                {snapshot.live.map((fixture) => (
                  <CompactMatchCard fixture={fixture} key={fixture.id} />
                ))}
              </div>
            ) : (
              <EmptyState text="No matches are live right now." />
            )}
          </section>

          <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
            <SectionTitle
              count={snapshot?.completed.length ?? 0}
              title="Completed"
            />
            {snapshot?.completed.length ? (
              <div className="grid gap-3">
                {snapshot.completed.slice(0, 6).map((fixture) => (
                  <CompactMatchCard fixture={fixture} key={fixture.id} />
                ))}
              </div>
            ) : (
              <EmptyState text="Completed results will appear here." />
            )}
          </section>
        </div>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <SectionTitle
            count={snapshot?.upcoming.length ?? 0}
            title="Upcoming"
          />
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot?.upcoming.length ? (
              snapshot.upcoming.map((fixture) => (
                <UpcomingCard fixture={fixture} key={fixture.id} />
              ))
            ) : (
              <EmptyState text="Upcoming fixtures will appear after tournament data syncs." />
            )}
          </div>
        </section>

        <p className="text-xs text-muted">
          Scores update from the server cache. During live matches the app checks
          for fresh data automatically.
        </p>
      </div>
    </AppShell>
  );
}

function HeroScoreCard({ fixture }: { fixture: SportsFixture }) {
  const homeLogo = getTeamLogo(fixture, "home");
  const awayLogo = getTeamLogo(fixture, "away");

  return (
    <div className="mt-6 rounded-[28px] border border-white/15 bg-[linear-gradient(135deg,rgba(229,244,252,0.16),rgba(255,255,255,0.04))] p-4 shadow-xl shadow-black/20">
      <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {formatStatus(fixture)}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamBlock logoUrl={homeLogo} name={fixture.homeTeamName} />
        <ScorePill fixture={fixture} />
        <TeamBlock logoUrl={awayLogo} name={fixture.awayTeamName} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/45 px-3 py-3 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <Clock3 aria-hidden className="h-4 w-4 text-accent" />
          {formatKickoff(fixture.kickoffUtc)}
        </span>
        <Badge variant={isLiveFixture(fixture) ? "accent" : "muted"}>
          {fixture.status}
        </Badge>
      </div>
    </div>
  );
}

function CompactMatchCard({ fixture }: { fixture: SportsFixture }) {
  return (
    <article className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <TeamLine fixture={fixture} side="home" />
        <ScorePill fixture={fixture} compact />
        <TeamLine fixture={fixture} side="away" align="right" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{formatKickoff(fixture.kickoffUtc)}</span>
        <span>{formatStatus(fixture)}</span>
      </div>
    </article>
  );
}

function UpcomingCard({ fixture }: { fixture: SportsFixture }) {
  return (
    <article className="rounded-lg border border-border bg-surface-raised p-4">
      <p className="text-xs text-muted">{formatKickoff(fixture.kickoffUtc)}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamLine fixture={fixture} side="home" />
        <div className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
          vs
        </div>
        <TeamLine fixture={fixture} side="away" align="right" />
      </div>
    </article>
  );
}

function TeamBlock({ logoUrl, name }: { logoUrl?: string; name: string }) {
  return (
    <div className="grid justify-items-center gap-2 text-center">
      <TeamLogo logoUrl={logoUrl} name={name} size="lg" />
      <p className="max-w-28 text-sm font-semibold leading-tight text-foreground">
        {name}
      </p>
    </div>
  );
}

function TeamLine({
  align = "left",
  fixture,
  side,
}: {
  align?: "left" | "right";
  fixture: SportsFixture;
  side: "home" | "away";
}) {
  const name = side === "home" ? fixture.homeTeamName : fixture.awayTeamName;
  const logoUrl = getTeamLogo(fixture, side);

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "right" ? "justify-end text-right" : ""
      }`}
    >
      {align === "right" ? null : <TeamLogo logoUrl={logoUrl} name={name} />}
      <span className="truncate text-sm font-semibold text-foreground">
        {name}
      </span>
      {align === "right" ? <TeamLogo logoUrl={logoUrl} name={name} /> : null}
    </div>
  );
}

function TeamLogo({
  logoUrl,
  name,
  size = "sm",
}: {
  logoUrl?: string;
  name: string;
  size?: "sm" | "lg";
}) {
  const className =
    size === "lg"
      ? "h-14 w-14 rounded-full border border-white/20 bg-white object-cover p-1"
      : "h-9 w-9 rounded-full border border-border bg-white object-cover p-1";

  if (logoUrl) {
    return (
      <Image
        alt=""
        className={className}
        height={size === "lg" ? 56 : 36}
        src={logoUrl}
        unoptimized
        width={size === "lg" ? 56 : 36}
      />
    );
  }

  return (
    <div
      className={`${className} grid place-items-center bg-accent text-sm font-semibold text-accent-foreground`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function ScorePill({
  compact = false,
  fixture,
}: {
  compact?: boolean;
  fixture: SportsFixture;
}) {
  const hasScore =
    typeof fixture.homeScore === "number" || typeof fixture.awayScore === "number";

  return (
    <div
      className={`rounded-xl border border-white/15 bg-white px-4 py-2 text-center font-semibold text-black shadow-lg shadow-black/10 ${
        compact ? "min-w-16 text-base" : "min-w-28 text-2xl"
      }`}
    >
      {hasScore
        ? `${fixture.homeScore ?? 0} - ${fixture.awayScore ?? 0}`
        : formatShortTime(fixture.kickoffUtc)}
    </div>
  );
}

function ScoreStatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <div className="grid h-9 w-9 place-items-center rounded-md bg-accent/10 text-accent">
          <Icon aria-hidden className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SectionTitle({ count, title }: { count: number; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <Badge variant={count > 0 ? "accent" : "muted"}>{count}</Badge>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">
      {text}
    </div>
  );
}

function getTeamLogo(fixture: SportsFixture, side: "home" | "away") {
  const raw = fixture.raw as {
    home_team?: { flag_url?: string; logo_url?: string; logo?: string };
    away_team?: { flag_url?: string; logo_url?: string; logo?: string };
  };
  const team = side === "home" ? raw.home_team : raw.away_team;

  return team?.flag_url ?? team?.logo_url ?? team?.logo;
}

function isLiveFixture(fixture: SportsFixture) {
  const status = fixture.status.toLowerCase();

  return status.includes("live") || status.includes("play") || status === "1h" || status === "2h";
}

function formatStatus(fixture: SportsFixture) {
  if (isLiveFixture(fixture)) {
    return "Live";
  }

  return fixture.status === "upcoming" || fixture.status === "scheduled"
    ? "Upcoming"
    : fixture.status;
}

function formatKickoff(value?: string) {
  if (!value) {
    return "Time TBD";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortTime(value?: string) {
  if (!value) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSource(source?: LiveScoresSnapshot["source"]) {
  if (source === "big-balls-data") {
    return "Big Balls";
  }

  if (source === "worldcup26") {
    return "Fallback";
  }

  return "Cache";
}

function getDateChips(fixtures: SportsFixture[]) {
  const upcomingDates = fixtures
    .map((fixture) => fixture.kickoffUtc)
    .filter(Boolean)
    .slice(0, 7) as string[];
  const dates = upcomingDates.length
    ? upcomingDates
    : Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index);
        return date.toISOString();
      });

  return dates.map((value) => {
    const date = new Date(value);

    return {
      key: value,
      day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date),
      dayName: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
    };
  });
}
