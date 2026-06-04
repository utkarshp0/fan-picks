"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Clock3,
  MapPin,
  Radio,
  Shield,
  Timer,
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
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState("");

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
          setSelectedDate((currentDate) =>
            currentDate || getFirstFixtureDate(nextSnapshot.fixtures),
          );
          setSelectedFixtureId((currentId) =>
            currentId || nextSnapshot.live[0]?.id || nextSnapshot.upcoming[0]?.id || "",
          );
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
    snapshot?.fixtures.find((fixture) => fixture.id === selectedFixtureId) ??
    snapshot?.live[0] ??
    snapshot?.upcoming[0] ??
    snapshot?.completed[0] ??
    null;
  const dateChips = useMemo(
    () => getDateChips(snapshot?.fixtures ?? []),
    [snapshot?.fixtures],
  );
  const selectedDateFixtures = useMemo(
    () =>
      (snapshot?.fixtures ?? []).filter(
        (fixture) => getDateKey(fixture.kickoffUtc) === selectedDate,
      ),
    [selectedDate, snapshot?.fixtures],
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
                  <button
                    className={`grid min-h-16 place-items-center rounded-full border px-2 text-center transition-colors ${
                      selectedDate === chip.key
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-white/10 bg-background/45 text-foreground hover:border-accent/60"
                    }`}
                    key={chip.key}
                    onClick={() => setSelectedDate(chip.key)}
                    type="button"
                  >
                    <span
                      className={`text-[10px] uppercase ${
                        selectedDate === chip.key ? "text-accent-foreground/80" : "text-muted"
                      }`}
                    >
                      {chip.dayName}
                    </span>
                    <span className="text-sm font-semibold">
                      {chip.day}
                    </span>
                    <span
                      className={`text-[10px] ${
                        selectedDate === chip.key ? "text-accent-foreground/75" : "text-muted"
                      }`}
                    >
                      {chip.count}
                    </span>
                  </button>
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

            <div className="grid gap-4 lg:grid-rows-2">
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
              count={selectedDateFixtures.length}
              title={formatSelectedDate(selectedDate)}
            />
            {selectedDateFixtures.length ? (
              <div className="grid gap-3">
                {selectedDateFixtures.map((fixture) => (
                  <CompactMatchCard
                    fixture={fixture}
                    isSelected={fixture.id === selectedFixtureId}
                    key={fixture.id}
                    onSelect={() => setSelectedFixtureId(fixture.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState text="No matches are scheduled for this date." />
            )}
          </section>

          <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
            <SectionTitle count={featuredMatch ? 1 : 0} title="Match details" />
            {featuredMatch ? <MatchDetailCard fixture={featuredMatch} /> : <EmptyState text="Select a match to see details." />}
          </section>
        </div>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <SectionTitle
            count={snapshot?.fixtures.length ?? 0}
            title="All tournament fixtures"
          />
          <div className="grid gap-3 lg:grid-cols-3">
            {snapshot?.fixtures.length ? (
              snapshot.fixtures.map((fixture) => (
                <UpcomingCard
                  fixture={fixture}
                  isSelected={fixture.id === selectedFixtureId}
                  key={fixture.id}
                  onSelect={() => {
                    setSelectedFixtureId(fixture.id);
                    setSelectedDate(getDateKey(fixture.kickoffUtc));
                  }}
                />
              ))
            ) : (
              <EmptyState text="Upcoming fixtures will appear after tournament data syncs." />
            )}
          </div>
        </section>

        <p className="text-xs text-muted">
          Scores update automatically during live matches.
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
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

function CompactMatchCard({
  fixture,
  isSelected = false,
  onSelect,
}: {
  fixture: SportsFixture;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      className={`rounded-lg border bg-surface-raised p-4 text-left transition-colors ${
        isSelected ? "border-accent" : "border-border hover:border-accent/50"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <TeamLine fixture={fixture} side="home" />
        <ScorePill fixture={fixture} compact />
        <TeamLine fixture={fixture} side="away" align="right" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{formatKickoff(fixture.kickoffUtc)}</span>
        <span>{formatStatus(fixture)}</span>
      </div>
    </button>
  );
}

function UpcomingCard({
  fixture,
  isSelected = false,
  onSelect,
}: {
  fixture: SportsFixture;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      className={`rounded-lg border bg-surface-raised p-4 text-left transition-colors ${
        isSelected ? "border-accent" : "border-border hover:border-accent/50"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <TeamLine fixture={fixture} side="home" />
        <ScorePill fixture={fixture} compact />
        <TeamLine fixture={fixture} side="away" align="right" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{formatKickoff(fixture.kickoffUtc)}</span>
        <span>{formatStatus(fixture)}</span>
      </div>
    </button>
  );
}

function MatchDetailCard({ fixture }: { fixture: SportsFixture }) {
  const raw = fixture.raw as {
    group?: string;
    venue?: string;
    matchday?: string | number | null;
  };
  const details = [
    { icon: Clock3, label: "Kickoff", value: formatKickoff(fixture.kickoffUtc) },
    { icon: Trophy, label: "Group", value: raw.group ? `Group ${raw.group}` : "TBD" },
    { icon: MapPin, label: "Venue", value: raw.venue ?? "Venue TBD" },
    { icon: Timer, label: "Status", value: formatStatus(fixture) },
  ];

  return (
    <div className="grid gap-4">
      <div className="rounded-[28px] border border-border bg-[linear-gradient(180deg,rgba(219,238,247,0.12),rgba(255,255,255,0.03))] p-4">
        <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {formatStatus(fixture)}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <TeamBlock logoUrl={getTeamLogo(fixture, "home")} name={fixture.homeTeamName} />
          <ScorePill fixture={fixture} />
          <TeamBlock logoUrl={getTeamLogo(fixture, "away")} name={fixture.awayTeamName} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {details.map((detail) => (
          <div
            className="rounded-lg border border-border bg-background p-3"
            key={detail.label}
          >
            <div className="flex items-center gap-2 text-xs text-muted">
              <detail.icon aria-hidden className="h-4 w-4 text-accent" />
              {detail.label}
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {detail.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="grid grid-cols-3 rounded-full bg-surface p-1 text-center text-xs text-muted">
          <span className="rounded-full bg-accent px-3 py-2 font-semibold text-accent-foreground">
            Summary
          </span>
          <span className="px-3 py-2">Statistics</span>
          <span className="px-3 py-2">Timeline</span>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-muted">
          <p>
            {fixture.homeTeamName} vs {fixture.awayTeamName}
          </p>
          <p>
            Match statistics and timeline events will populate here when the live
            provider includes them.
          </p>
        </div>
      </div>
    </div>
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
      className={`flex min-w-0 items-center gap-2 overflow-hidden ${
        align === "right" ? "justify-end text-right" : ""
      }`}
    >
      {align === "right" ? null : <TeamLogo logoUrl={logoUrl} name={name} />}
      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
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
      ? "h-14 w-14 shrink-0 rounded-full border border-white/20 bg-white object-cover p-1"
      : "h-9 w-9 shrink-0 rounded-full border border-border bg-white object-cover p-1";

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
        compact ? "w-24 text-base" : "min-w-28 text-2xl"
      }`}
    >
      <span className="block whitespace-nowrap">
        {hasScore
          ? `${fixture.homeScore ?? 0} - ${fixture.awayScore ?? 0}`
          : formatShortTime(fixture.kickoffUtc)}
      </span>
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

function getFirstFixtureDate(fixtures: SportsFixture[]) {
  return getDateKey(fixtures.find((fixture) => fixture.kickoffUtc)?.kickoffUtc);
}

function getDateKey(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatSelectedDate(value: string) {
  if (!value) {
    return "Selected date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
  }).format(new Date(`${value}T00:00:00`));
}

function getDateChips(fixtures: SportsFixture[]) {
  const countsByDate = new Map<string, number>();

  for (const fixture of fixtures) {
    const key = getDateKey(fixture.kickoffUtc);

    if (key) {
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }
  }

  const dates = Array.from(countsByDate.keys()).sort();
  const fallbackDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });

  return (dates.length ? dates : fallbackDates).map((value) => {
    const date = new Date(`${value}T00:00:00`);

    return {
      key: value,
      count: countsByDate.get(value) ?? 0,
      day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date),
      dayName: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
    };
  });
}
