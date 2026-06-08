"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  EyeOff,
  Fingerprint,
  LockKeyhole,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";

import { useGuestSession } from "@/components/auth/guest-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { worldCupTeams } from "@/data/prediction-options";
import {
  lockPrediction,
  savePredictionDraft,
  unlockPrediction,
} from "@/lib/championship-store";
import { fetchSportsTournaments } from "@/lib/sports-data-client";
import { filterRealSportsTeamNames } from "@/lib/sports-team-utils";
import {
  getTeamDisplayInfo,
  getTeamInitials,
  teamMatchesSearch,
  teamRegions,
  type TeamRegion,
} from "@/lib/team-display";
import { cn } from "@/lib/utils";
import type {
  Championship,
  PredictionCategory,
  PredictionPicks,
} from "@/types/championship";

type PredictionBoardProps = {
  championship: Championship;
};

export function PredictionBoard({ championship }: PredictionBoardProps) {
  const { profile } = useGuestSession();
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "save" | "lock" | "unlock" | null
  >(null);
  const [sportsTeamOptions, setSportsTeamOptions] = useState<string[]>([]);
  const participant = profile
    ? championship.participants.find(
        (item) => item.profileId === profile.id && !item.leftAt,
      )
    : null;
  const submission = profile
    ? championship.predictions.find((item) => item.profileId === profile.id)
    : null;
  const latestVersion = submission?.versions.at(-1);
  const latestPicks = latestVersion?.picks ?? {};
  const lockDatePassed = isPastLockDate(championship.lockDate);
  const isLocked = Boolean(submission?.lockedAt) || lockDatePassed;
  const canReopen = Boolean(submission?.lockedAt) && !lockDatePassed;
  const teamOptions = useMemo(
    () => sportsTeamOptions.length > 0 ? sportsTeamOptions : worldCupTeams,
    [sportsTeamOptions],
  );

  useEffect(() => {
    let isMounted = true;

    fetchSportsTournaments()
      .then((tournaments) => {
        const tournament = tournaments.find(
          (item) => item.id === championship.tournamentId,
        );

        if (isMounted) {
          setSportsTeamOptions(
            filterRealSportsTeamNames(
              tournament?.teams.map((team) => team.name) ?? [],
            ),
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setSportsTeamOptions([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [championship.tournamentId]);

  function collectPicks(form: HTMLFormElement) {
    const formData = new FormData(form);

    return Object.fromEntries(
      championship.bets.map((bet) => [
        bet.id,
        formData
          .getAll(bet.id)
          .map(String)
          .map((value) => value.trim())
          .filter(Boolean)
      ]),
    ) as PredictionPicks;
  }

  function validatePickLimits(picks: PredictionPicks) {
    const overLimitBet = championship.bets.find(
      (bet) => (picks[bet.id]?.length ?? 0) > bet.selectionCount,
    );

    if (!overLimitBet) {
      return "";
    }

    return `${overLimitBet.name} allows ${overLimitBet.selectionCount} pick(s).`;
  }

  function validateLockedPicks(picks: PredictionPicks) {
    return championship.bets.every(
      (bet) => picks[bet.id]?.length === bet.selectionCount,
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      setMessage("Enter your name first.");
      return;
    }

    const picks = collectPicks(event.currentTarget);
    const limitMessage = validatePickLimits(picks);

    if (limitMessage) {
      setMessage(limitMessage);
      return;
    }

    setPendingAction("save");
    try {
      const result = await savePredictionDraft(championship.id, profile, picks);
      setMessage(result.message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleLock(form: HTMLFormElement) {
    if (!profile) {
      setMessage("Enter your name first.");
      return;
    }

    const picks = collectPicks(form);
    const limitMessage = validatePickLimits(picks);

    if (limitMessage) {
      setMessage(limitMessage);
      return;
    }

    if (!validateLockedPicks(picks)) {
      setMessage("Complete every bet before locking.");
      return;
    }

    setPendingAction("lock");
    try {
      const draftResult = await savePredictionDraft(
        championship.id,
        profile,
        picks,
      );

      if (!draftResult.championship) {
        setMessage(draftResult.message);
        return;
      }

      const lockResult = await lockPrediction(championship.id, profile);
      setMessage(lockResult.message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnlock() {
    if (!profile) {
      setMessage("Login first.");
      return;
    }

    setPendingAction("unlock");
    try {
      const result = await unlockPrediction(championship.id, profile);
      setMessage(result.message);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border bg-surface-raised p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeading
            description="Save drafts until the lock date. Locked picks can be reopened before the deadline if you made a mistake."
            title="My picks"
          />
          <Badge variant={isLocked ? "accent" : "warning"}>
            {isLocked ? "Locked" : "Editable"}
          </Badge>
        </div>

        {!participant ? (
          <div className="mt-5 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Join this pool before submitting picks.
          </div>
        ) : (
          <form className="mt-5 grid gap-4" onSubmit={handleSave}>
            <fieldset className="grid gap-3" disabled={isLocked}>
              {championship.bets.map((bet) => (
                <div
                  className="rounded-lg border border-border bg-background p-3"
                  key={bet.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{bet.name}</p>
                        <Badge variant={bet.source === "custom" ? "warning" : "muted"}>
                          {bet.source}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">{bet.prompt}</p>
                    </div>
                    <Badge variant="muted">
                      {bet.selectionCount} pick
                      {bet.selectionCount === 1 ? "" : "s"} required
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <BetInput
                      bet={bet}
                      defaultValues={latestPicks[bet.id] ?? []}
                      teamOptions={teamOptions}
                    />
                  </div>
                </div>
              ))}
            </fieldset>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                disabled={isLocked || pendingAction !== null}
                loading={pendingAction === "save"}
                loadingLabel="Saving picks"
                type="submit"
                variant="secondary"
              >
                <Save aria-hidden className="h-4 w-4" />
                Save picks
              </Button>
              {canReopen ? (
                <Button
                  disabled={pendingAction !== null}
                  loading={pendingAction === "unlock"}
                  loadingLabel="Reopening picks"
                  onClick={() => void handleUnlock()}
                  type="button"
                >
                  <RotateCcw aria-hidden className="h-4 w-4" />
                  Reopen picks
                </Button>
              ) : (
                <Button
                  disabled={isLocked || pendingAction !== null}
                  loading={pendingAction === "lock"}
                  loadingLabel="Locking picks"
                  onClick={(event) => {
                    if (event.currentTarget.form) {
                      void handleLock(event.currentTarget.form);
                    }
                  }}
                  type="button"
                >
                  <LockKeyhole aria-hidden className="h-4 w-4" />
                  Lock picks
                </Button>
              )}
            </div>
          </form>
        )}

        {message ? (
          <p className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            {message}
          </p>
        ) : null}

        {lockDatePassed && !submission?.lockedAt ? (
          <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            The lock date has passed, so picks can no longer be edited.
          </p>
        ) : null}

        {submission?.fingerprint ? (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-border bg-background p-3">
            <Fingerprint aria-hidden className="mt-1 h-4 w-4 text-accent" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Pick fingerprint</p>
              <p className="mt-1 break-all font-mono text-xs text-muted">
                {submission.fingerprint}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <PredictionVisibility championship={championship} />
    </div>
  );
}

function BetInput({
  bet,
  defaultValues,
  teamOptions,
}: {
  bet: PredictionCategory;
  defaultValues: string[];
  teamOptions: string[];
}) {
  if (bet.type === "multi-team") {
    return (
      <TeamChoicePicker
        defaultValues={defaultValues}
        key={`${bet.id}:${defaultValues.join("|")}`}
        maxSelections={bet.selectionCount}
        name={bet.id}
        options={getBetOptions(bet, teamOptions)}
        selectionMode="multiple"
      />
    );
  }

  if (bet.type === "choice" || bet.type === "single-team") {
    const options = getBetOptions(bet, teamOptions);

    if (bet.type === "single-team" || options.length > 8) {
      return (
        <TeamChoicePicker
          defaultValues={defaultValues}
          key={`${bet.id}:${defaultValues.join("|")}`}
          maxSelections={1}
          name={bet.id}
          options={options}
          selectionMode="single"
        />
      );
    }

    return (
      <select
        className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
        defaultValue={defaultValues[0] ?? ""}
        name={bet.id}
      >
        <option value="">Select</option>
        {getBetOptions(bet, teamOptions).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (bet.type === "number") {
    return (
      <input
        className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
        defaultValue={defaultValues[0] ?? ""}
        min={0}
        name={bet.id}
        placeholder="Enter a number"
        type="number"
      />
    );
  }

  return (
    <input
      className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
      defaultValue={defaultValues[0] ?? ""}
      name={bet.id}
      placeholder={bet.type === "single-player" ? "Enter player name" : "Enter pick"}
      type="text"
    />
  );
}

function getBetOptions(bet: PredictionCategory, teamOptions: string[]) {
  if (bet.type === "single-team" || bet.type === "multi-team") {
    const cleanChoices = filterRealSportsTeamNames(bet.choices ?? []);

    return cleanChoices.length ? cleanChoices : teamOptions;
  }

  return bet.choices?.filter(Boolean) ?? teamOptions;
}

function PredictionVisibility({ championship }: PredictionBoardProps) {
  const { profile } = useGuestSession();
  const revealPredictions =
    championship.status === "locked" ||
    championship.status === "completed" ||
    isPastLockDate(championship.lockDate);
  const activeParticipants = championship.participants.filter(
    (participant) => !participant.leftAt,
  );

  return (
    <section className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          description="Before lock, everyone sees status and timestamps. Picks stay hidden except your own."
          title="Pool picks"
        />
        <Badge variant={revealPredictions ? "accent" : "warning"}>
          {revealPredictions ? "Revealed" : "Hidden"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3">
        {activeParticipants.map((participant) => {
          const submission = championship.predictions.find(
            (item) => item.profileId === participant.profileId,
          );
          const canSeePicks =
            revealPredictions || participant.profileId === profile?.id;
          const lockedVersion =
            submission?.versions.find(
              (version) => version.id === submission.lockedVersionId,
            ) ?? submission?.versions.at(-1);

          return (
            <article
              className="rounded-lg border border-border bg-background p-4"
              key={participant.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{participant.displayName}</p>
                  <p className="mt-1 text-sm text-muted">
                    {submission?.lastEditedAt
                      ? `Last edited ${formatDateTime(submission.lastEditedAt)}`
                      : "No saved picks"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      participant.submissionStatus === "submitted"
                        ? "accent"
                        : "muted"
                    }
                  >
                    {participant.submissionStatus.replace("_", " ")}
                  </Badge>
                  <Badge
                    variant={
                      participant.lockedStatus === "locked" ? "accent" : "warning"
                    }
                  >
                    {participant.lockedStatus}
                  </Badge>
                </div>
              </div>

              {submission && lockedVersion && canSeePicks ? (
                <PredictionSummary
                  bets={championship.bets}
                  picks={lockedVersion.picks}
                />
              ) : (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-sm text-muted">
                  <EyeOff aria-hidden className="h-4 w-4 text-warning" />
                  Picks hidden
                </div>
              )}

              {submission?.fingerprint ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck aria-hidden className="h-4 w-4 text-accent" />
                  {submission.fingerprint.slice(0, 18)}...
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

type CheckboxGridProps = {
  defaultValues: string[];
  maxSelections: number;
  name: string;
  options: string[];
  selectionMode: "multiple" | "single";
};

function TeamChoicePicker({
  defaultValues,
  maxSelections,
  name,
  options,
  selectionMode,
}: CheckboxGridProps) {
  const [selectedValues, setSelectedValues] = useState(defaultValues);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRegion, setActiveRegion] = useState<TeamRegion | "All">("All");
  const selectedSet = useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  );
  const availableRegions = useMemo(
    () =>
      teamRegions.filter((region) =>
        options.some((option) => getTeamDisplayInfo(option).region === region),
      ),
    [options],
  );
  const filteredOptions = useMemo(
    () =>
      options.filter((option) => {
        const region = getTeamDisplayInfo(option).region;
        const matchesRegion = activeRegion === "All" || region === activeRegion;

        return matchesRegion && teamMatchesSearch(option, searchQuery);
      }),
    [activeRegion, options, searchQuery],
  );
  const selectionLimitReached = selectedValues.length >= maxSelections;

  function toggleSelection(option: string) {
    setSelectedValues((currentValues) => {
      const isSelected = currentValues.includes(option);

      if (isSelected) {
        return currentValues.filter((value) => value !== option);
      }

      if (selectionMode === "single") {
        return [option];
      }

      if (currentValues.length >= maxSelections) {
        return currentValues;
      }

      return [...currentValues, option];
    });
  }

  return (
    <div className="grid gap-3">
      {selectedValues.map((value) => (
        <input key={value} name={name} type="hidden" value={value} />
      ))}

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              Selected {selectedValues.length}/{maxSelections}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedValues.length > 0 ? (
                selectedValues.map((value) => (
                  <button
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3 text-sm font-medium text-foreground"
                    key={value}
                    onClick={() => toggleSelection(value)}
                    type="button"
                  >
                    <TeamFlag name={value} size="sm" />
                    {value}
                    <span className="text-muted" aria-hidden>
                      x
                    </span>
                  </button>
                ))
              ) : (
                <span className="rounded-full border border-dashed border-border px-3 py-2 text-sm text-muted">
                  Pick {maxSelections === 1 ? "one team" : `${maxSelections} teams`}
                </span>
              )}
            </div>
          </div>

          <input
            className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent lg:max-w-xs"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search teams"
            type="search"
            value={searchQuery}
          />
        </div>

        {availableRegions.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(["All", ...availableRegions] as Array<TeamRegion | "All">).map(
              (region) => (
                <button
                  className={cn(
                    "min-h-9 shrink-0 rounded-full border px-3 text-sm transition",
                    activeRegion === region
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background text-muted hover:border-accent/70 hover:text-foreground",
                  )}
                  key={region}
                  onClick={() => setActiveRegion(region)}
                  type="button"
                >
                  {region}
                </button>
              ),
            )}
          </div>
        ) : null}
      </div>

      <div className="grid max-h-[34rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
        {filteredOptions.map((option) => {
          const isSelected = selectedSet.has(option);
          const isDisabled =
            selectionMode === "multiple" && !isSelected && selectionLimitReached;

          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-lg border px-3 text-left text-sm transition",
                isSelected
                  ? "border-accent bg-accent/12 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_40%,transparent)]"
                  : "border-border bg-surface text-muted hover:border-accent/70 hover:text-foreground",
                isDisabled && "cursor-not-allowed opacity-45 hover:border-border hover:text-muted",
              )}
              disabled={isDisabled}
              key={option}
              onClick={() => toggleSelection(option)}
              type="button"
            >
              <TeamFlag name={option} />
              <span className="min-w-0 flex-1 truncate font-medium">{option}</span>
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs",
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border text-transparent",
                )}
                aria-hidden
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      {filteredOptions.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">
          No teams match that search.
        </div>
      ) : null}

      {selectionMode === "multiple" && selectionLimitReached ? (
        <p className="text-xs text-muted">
          Remove one selected team before choosing another.
        </p>
      ) : null}
    </div>
  );
}

function TeamFlag({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const { flagCode } = getTeamDisplayInfo(name);

  return (
    <span
      aria-label={`${name} flag`}
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-surface-soft text-[0.62rem] font-semibold text-foreground shadow-sm",
        size === "sm" ? "h-6 w-6" : "h-8 w-8",
      )}
      style={
        flagCode
          ? {
              backgroundImage: `url(https://flagcdn.com/w80/${flagCode}.png)`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      {flagCode ? null : getTeamInitials(name)}
    </span>
  );
}

function PredictionSummary({
  bets,
  picks,
}: {
  bets: PredictionCategory[];
  picks: PredictionPicks;
}) {
  return (
    <div className="mt-4 grid gap-2">
      {bets.map((bet) => (
        <div
          className="rounded-md border border-border bg-surface p-3"
          key={bet.id}
        >
          <p className="text-xs text-muted">{bet.name}</p>
          <p className="mt-1 text-sm font-medium">
            {picks[bet.id]?.join(", ") || "No pick"}
          </p>
        </div>
      ))}
    </div>
  );
}

function isPastLockDate(value: string) {
  if (!value) {
    return false;
  }

  return Date.now() >= new Date(`${value}T23:59:59`).getTime();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
