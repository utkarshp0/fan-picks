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
                      {latestPicks[bet.id]?.length ?? 0}/{bet.selectionCount}
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
      <CheckboxGrid
        defaultValues={defaultValues}
        key={`${bet.id}:${defaultValues.join("|")}`}
        maxSelections={bet.selectionCount}
        name={bet.id}
        options={getBetOptions(bet, teamOptions)}
      />
    );
  }

  if (bet.type === "choice" || bet.type === "single-team") {
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
};

function CheckboxGrid({
  defaultValues,
  maxSelections,
  name,
  options,
}: CheckboxGridProps) {
  const [selectedValues, setSelectedValues] = useState(defaultValues);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <label
          className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted"
          key={option}
        >
          <input
            className="h-4 w-4 accent-[var(--accent)]"
            checked={selectedValues.includes(option)}
            disabled={
              !selectedValues.includes(option) &&
              selectedValues.length >= maxSelections
            }
            name={name}
            onChange={(event) => {
              const isChecked = event.currentTarget.checked;

              setSelectedValues((currentValues) => {
                if (!isChecked) {
                  return currentValues.filter((value) => value !== option);
                }

                if (currentValues.length >= maxSelections) {
                  return currentValues;
                }

                return [...currentValues, option];
              });
            }}
            type="checkbox"
            value={option}
          />
          {option}
        </label>
      ))}
    </div>
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
