"use client";

import { FormEvent, useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2, Trophy } from "lucide-react";

import { useGuestSession } from "@/components/auth/guest-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { championshipTemplates, getChampionshipTemplate } from "@/data/templates";
import { createChampionship } from "@/lib/championship-store";
import type { BetType, Championship } from "@/types/championship";

type ChampionshipCreatePanelProps = {
  onCreated?: (championship: Championship) => void;
};

type CustomBetDraft = {
  id: string;
  name: string;
  prompt: string;
  type: BetType;
  selectionCount: number;
  choicesText: string;
};

export function ChampionshipCreatePanel({
  onCreated,
}: ChampionshipCreatePanelProps) {
  const { profile } = useGuestSession();
  const [tournamentId, setTournamentId] = useState(championshipTemplates[0].id);
  const [selectedBetIds, setSelectedBetIds] = useState(
    championshipTemplates[0].defaultBets.map((bet) => bet.id),
  );
  const [startDate, setStartDate] = useState(championshipTemplates[0].startDate);
  const [lockDate, setLockDate] = useState(championshipTemplates[0].lockDate);
  const [customBets, setCustomBets] = useState<CustomBetDraft[]>([]);
  const [createdName, setCreatedName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const tournament = getChampionshipTemplate(tournamentId);
  const defaultName = `${tournament.name} Friends Pool`;

  const allDefaultBetIds = useMemo(
    () => tournament.defaultBets.map((bet) => bet.id),
    [tournament.defaultBets],
  );

  function handleTournamentChange(nextTournamentId: string) {
    const nextTournament = getChampionshipTemplate(nextTournamentId);
    setTournamentId(nextTournamentId);
    setStartDate(nextTournament.startDate);
    setLockDate(nextTournament.lockDate);
    setSelectedBetIds(nextTournament.defaultBets.map((bet) => bet.id));
  }

  function toggleBet(betId: string) {
    setSelectedBetIds((current) =>
      current.includes(betId)
        ? current.filter((id) => id !== betId)
        : [...current, betId],
    );
  }

  function addCustomBet() {
    setCustomBets((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "",
        prompt: "",
        type: "text",
        selectionCount: 1,
        choicesText: "",
      },
    ]);
  }

  function updateCustomBet(id: string, patch: Partial<CustomBetDraft>) {
    setCustomBets((current) =>
      current.map((bet) => (bet.id === id ? { ...bet, ...patch } : bet)),
    );
  }

  function removeCustomBet(id: string) {
    setCustomBets((current) => current.filter((bet) => bet.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      return;
    }

    setIsCreating(true);
    const formData = new FormData(event.currentTarget);
    try {
      const championship = await createChampionship(
        {
          name: String(formData.get("name") ?? ""),
          tournamentId,
          startDate: String(formData.get("startDate") ?? ""),
          lockDate: String(formData.get("lockDate") ?? ""),
          defaultBetIds: selectedBetIds,
          customBets: customBets.map((bet) => ({
            name: bet.name,
            prompt: bet.prompt,
            type: bet.type,
            selectionCount: bet.selectionCount,
            choices: bet.choicesText
              .split(",")
              .map((choice) => choice.trim())
              .filter(Boolean),
          })),
        },
        profile,
      );

      setCreatedName(championship.name);
      onCreated?.(championship);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section
      className="rounded-lg border border-border bg-surface p-4"
      id="create-championship"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          description="Pick a tournament, keep the default bets you like, and add your own group questions."
          title="Create pool"
        />
        <Badge variant="accent">Friends</Badge>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Pool name</span>
          <input
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
            defaultValue={defaultName}
            key={defaultName}
            maxLength={64}
            name="name"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Tournament</span>
          <select
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
            onChange={(event) => handleTournamentChange(event.target.value)}
            value={tournamentId}
          >
            {championshipTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <DateSelectField
            label="Tournament starts"
            name="startDate"
            onChange={setStartDate}
            value={startDate}
          />

          <DateSelectField
            label="Picks lock"
            name="lockDate"
            onChange={setLockDate}
            value={lockDate}
          />
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-background text-accent">
                <Trophy aria-hidden className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{tournament.name}</p>
                <p className="text-xs leading-5 text-muted">
                  {tournament.description}
                </p>
              </div>
            </div>
            <CalendarClock aria-hidden className="h-4 w-4 text-warning" />
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Default bets</p>
            <button
              className="text-xs text-muted hover:text-foreground"
              onClick={() =>
                setSelectedBetIds(
                  selectedBetIds.length === allDefaultBetIds.length
                    ? []
                    : allDefaultBetIds,
                )
              }
              type="button"
            >
              {selectedBetIds.length === allDefaultBetIds.length
                ? "Clear all"
                : "Select all"}
            </button>
          </div>

          {tournament.defaultBets.map((bet) => (
            <label
              className="flex gap-3 rounded-md border border-border bg-background p-3"
              key={bet.id}
            >
              <input
                checked={selectedBetIds.includes(bet.id)}
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
                onChange={() => toggleBet(bet.id)}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {bet.name}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted">
                  {bet.prompt}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Custom bets</p>
            <Button onClick={addCustomBet} type="button" variant="secondary">
              <Plus aria-hidden className="h-4 w-4" />
              Add bet
            </Button>
          </div>

          {customBets.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background p-3 text-sm text-muted">
              Optional. Add one if your group has its own prediction question.
            </p>
          ) : null}

          {customBets.map((bet) => (
            <div
              className="grid gap-3 rounded-lg border border-border bg-background p-3"
              key={bet.id}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Custom bet</p>
                <button
                  className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted hover:text-foreground"
                  onClick={() => removeCustomBet(bet.id)}
                  type="button"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <input
                className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
                onChange={(event) =>
                  updateCustomBet(bet.id, { name: event.target.value })
                }
                placeholder="Most goals scored by a team"
                value={bet.name}
              />
              <input
                className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
                onChange={(event) =>
                  updateCustomBet(bet.id, { prompt: event.target.value })
                }
                placeholder="What should people predict?"
                value={bet.prompt}
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <select
                  className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
                  onChange={(event) =>
                    updateCustomBet(bet.id, {
                      type: event.target.value as BetType,
                    })
                  }
                  value={bet.type}
                >
                  <option value="text">Free text</option>
                  <option value="number">Number</option>
                  <option value="choice">Choice list</option>
                  <option value="single-team">Single team</option>
                  <option value="multi-team">Multiple teams</option>
                  <option value="single-player">Single player</option>
                </select>
                <input
                  className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
                  min={1}
                  onChange={(event) =>
                    updateCustomBet(bet.id, {
                      selectionCount: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={bet.selectionCount}
                />
              </div>
              {bet.type === "choice" ? (
                <input
                  className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
                  onChange={(event) =>
                    updateCustomBet(bet.id, { choicesText: event.target.value })
                  }
                  placeholder="Comma-separated options"
                  value={bet.choicesText}
                />
              ) : null}
            </div>
          ))}
        </div>

        <Button
          disabled={!profile || selectedBetIds.length + customBets.length === 0}
          loading={isCreating}
          loadingLabel="Creating pool"
          type="submit"
        >
          <Plus aria-hidden className="h-4 w-4" />
          Create pool
        </Button>
      </form>

      {createdName ? (
        <p className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {createdName} is ready.
        </p>
      ) : null}
    </section>
  );
}

function DateSelectField({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const { day, month, year } = parseDateValue(value);
  const dayCount = getDaysInMonth(year, month);
  const years = getYearOptions(year);

  function updateDate(next: Partial<{ day: number; month: number; year: number }>) {
    const nextYear = next.year ?? year;
    const nextMonth = next.month ?? month;
    const maxDay = getDaysInMonth(nextYear, nextMonth);
    const nextDay = Math.min(next.day ?? day, maxDay);

    onChange(formatDateValue(nextYear, nextMonth, nextDay));
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <input name={name} type="hidden" value={value} />
      <div className="grid gap-2 sm:grid-cols-[1fr_86px_100px]">
        <select
          aria-label={`${label} month`}
          className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
          onChange={(event) => updateDate({ month: Number(event.target.value) })}
          value={month}
        >
          {months.map((monthLabel, index) => (
            <option key={monthLabel} value={index + 1}>
              {monthLabel}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} day`}
          className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
          onChange={(event) => updateDate({ day: Number(event.target.value) })}
          value={day}
        >
          {Array.from({ length: dayCount }, (_, index) => index + 1).map(
            (dayOption) => (
              <option key={dayOption} value={dayOption}>
                {dayOption}
              </option>
            ),
          )}
        </select>
        <select
          aria-label={`${label} year`}
          className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
          onChange={(event) => updateDate({ year: Number(event.target.value) })}
          value={year}
        >
          {years.map((yearOption) => (
            <option key={yearOption} value={yearOption}>
              {yearOption}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return {
    day: day || 1,
    month: month || 1,
    year: year || new Date().getFullYear(),
  };
}

function formatDateValue(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getYearOptions(year: number) {
  return Array.from({ length: 6 }, (_, index) => year - 1 + index);
}
