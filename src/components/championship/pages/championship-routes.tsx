"use client";

import { FormEvent, useState } from "react";
import { ListPlus, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { AuditTimeline } from "@/components/championship/audit-timeline";
import { useGuestSession } from "@/components/auth/guest-session-provider";
import { PredictionBoard } from "@/components/championship/prediction-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getChampionshipTemplate } from "@/data/templates";
import { savePoolBets } from "@/lib/championship-store";
import type { BetType, Championship, PredictionCategory } from "@/types/championship";

export function PredictionsRoute({ championship }: { championship: Championship }) {
  return <PredictionBoard championship={championship} />;
}

export function ParticipantsRoute({
  championship,
}: {
  championship: Championship;
}) {
  const participants = championship.participants.filter(
    (participant) => !participant.leftAt,
  );

  return (
    <section className="grid gap-3">
      {participants.map((participant) => (
        <div
          className="grid gap-4 rounded-lg border border-border bg-surface p-4 lg:grid-cols-[1fr_360px]"
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
    </section>
  );
}

export function AuditRoute({ championship }: { championship: Championship }) {
  return <AuditTimeline championship={championship} />;
}

export function RulesRoute({ championship }: { championship: Championship }) {
  const { profile } = useGuestSession();
  const tournament = getChampionshipTemplate(championship.tournamentId);
  const [draftBets, setDraftBets] = useState(championship.bets);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isCreator = profile?.id === championship.creatorProfileId;
  const lockDatePassed = isPastLockDate(championship.lockDate);
  const hasLockedPicks = championship.predictions.some(
    (submission) => submission.lockedAt,
  );
  const canEditBets = isCreator && !lockDatePassed && !hasLockedPicks;
  const hasUnsavedChanges = !areBetsEqual(championship.bets, draftBets);
  const availableDefaultBets = tournament.defaultBets.filter(
    (bet) => !draftBets.some((draftBet) => draftBet.id === bet.id),
  );

  function handleAddBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      setMessage("Login first.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const choices = String(formData.get("choices") ?? "")
      .split(/\r?\n|,/)
      .map((choice) => choice.trim())
      .filter(Boolean);

    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
      setMessage("Enter a bet name.");
      return;
    }

    const bet: PredictionCategory = {
      id: createDraftBetId(draftBets, name),
      name,
      prompt: String(formData.get("prompt") ?? "").trim() || name,
      type: String(formData.get("type") ?? "text") as BetType,
      selectionCount: Math.max(1, Number(formData.get("selectionCount") ?? 1)),
      choices,
      scoringNote: "Creator-defined bet. Score manually after the tournament.",
      source: "custom",
    };

    setDraftBets((currentBets) => [...currentBets, bet]);
    setMessage("Bet added to draft. Save pool to publish changes.");
    event.currentTarget.reset();
  }

  function handleRemoveBet(betId: string) {
    if (!profile) {
      setMessage("Login first.");
      return;
    }

    if (draftBets.length <= 1) {
      setMessage("A pool needs at least one bet.");
      return;
    }

    setDraftBets((currentBets) => currentBets.filter((bet) => bet.id !== betId));
    setMessage("Bet removed from draft. Save pool to publish changes.");
  }

  function handleAddDefaultBet(bet: PredictionCategory) {
    setDraftBets((currentBets) => [...currentBets, bet]);
    setMessage(`${bet.name} added back to draft. Save pool to publish changes.`);
  }

  async function handleSavePool() {
    if (!profile) {
      setMessage("Login first.");
      return;
    }

    if (!hasUnsavedChanges) {
      setMessage("No pool changes to save.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await savePoolBets(championship.id, profile, draftBets);
      setMessage(result.message);

      if (result.championship) {
        setDraftBets(result.championship.bets);
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscardChanges() {
    setDraftBets(championship.bets);
    setMessage("Draft changes discarded.");
  }

  const editStatus = getBetEditStatus({
    canEditBets,
    hasLockedPicks,
    isCreator,
    lockDatePassed,
  });

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeading
            description={`${championship.name} is a private pool for ${tournament.name}. These are the active bets for this pool.`}
            title="Bets"
          />
          <Badge variant={canEditBets ? "accent" : "muted"}>
            {canEditBets
              ? hasUnsavedChanges
                ? "Unsaved changes"
                : "Editable"
              : "Read only"}
          </Badge>
        </div>
        <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted">
          {editStatus}
        </p>

        {canEditBets ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={!hasUnsavedChanges}
              loading={isSaving}
              loadingLabel="Saving pool"
              onClick={() => void handleSavePool()}
            >
              <Save aria-hidden className="h-4 w-4" />
              Save pool
            </Button>
            <Button
              disabled={!hasUnsavedChanges || isSaving}
              onClick={handleDiscardChanges}
              variant="secondary"
            >
              <RotateCcw aria-hidden className="h-4 w-4" />
              Discard changes
            </Button>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {draftBets.map((category) => (
            <article
              className="rounded-lg border border-border bg-surface-raised p-4"
              key={category.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{category.name}</h3>
                    <Badge variant={category.source === "custom" ? "warning" : "muted"}>
                      {category.source}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{category.prompt}</p>
                </div>
                {canEditBets ? (
                  <Button
                    className="min-h-9 px-3"
                    disabled={draftBets.length <= 1 || isSaving}
                    onClick={() => handleRemoveBet(category.id)}
                    variant="ghost"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-muted">
                <p>{category.scoringNote}</p>
                <p>
                  Pick count:{" "}
                  <span className="font-medium text-foreground">
                    {category.selectionCount}
                  </span>
                </p>
                {category.choices?.length ? (
                  <p>Choices: {category.choices.join(", ")}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {message ? (
          <p className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            {message}
          </p>
        ) : null}
      </section>

      {canEditBets ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading
            description="Add back any tournament default bets you removed from this draft."
            title="Default bets"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {availableDefaultBets.length > 0 ? (
              availableDefaultBets.map((bet) => (
                <article
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4"
                  key={bet.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{bet.name}</h3>
                      <Badge variant="muted">default</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted">{bet.prompt}</p>
                  </div>
                  <Button
                    className="self-start"
                    disabled={isSaving}
                    onClick={() => handleAddDefaultBet(bet)}
                    variant="secondary"
                  >
                    <ListPlus aria-hidden className="h-4 w-4" />
                    Add to draft
                  </Button>
                </article>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-border bg-background p-3 text-sm text-muted">
                All default bets are already in this draft.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {canEditBets ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading
            description="Add or remove bets, review the draft list, then save the pool once."
            title="Custom bet"
          />
          <form className="mt-5 grid gap-4" onSubmit={handleAddBet}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Bet name
                <input
                  className="min-h-11 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-accent"
                  name="name"
                  placeholder="Most goals by team"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Type
                <select
                  className="min-h-11 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-accent"
                  defaultValue="text"
                  name="type"
                >
                  <option value="single-team">Single team</option>
                  <option value="multi-team">Multiple teams</option>
                  <option value="single-player">Single player</option>
                  <option value="choice">Choice</option>
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium">
              Prompt
              <input
                className="min-h-11 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-accent"
                name="prompt"
                placeholder="Which team will score the most goals?"
              />
            </label>

            <label className="grid max-w-44 gap-2 text-sm font-medium">
              Picks required
              <input
                className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none focus:border-accent"
                defaultValue={1}
                min={1}
                name="selectionCount"
                type="number"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Choices
              <textarea
                className="min-h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-accent"
                name="choices"
                placeholder="Optional. Separate choices with commas or new lines."
              />
            </label>

            <Button disabled={isSaving} type="submit">
              <Plus aria-hidden className="h-4 w-4" />
              Add to draft
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isPastLockDate(value: string) {
  if (!value) {
    return false;
  }

  return Date.now() >= new Date(`${value}T23:59:59`).getTime();
}

function getBetEditStatus({
  canEditBets,
  hasLockedPicks,
  isCreator,
  lockDatePassed,
}: {
  canEditBets: boolean;
  hasLockedPicks: boolean;
  isCreator: boolean;
  lockDatePassed: boolean;
}) {
  if (canEditBets) {
    return "You can add or remove bets until the lock date, as long as nobody has locked picks.";
  }

  if (!isCreator) {
    return "Only the pool creator can add or remove bets.";
  }

  if (lockDatePassed) {
    return "The lock date has passed, so bets are locked for everyone.";
  }

  if (hasLockedPicks) {
    return "Someone has locked picks, so bets are locked for everyone.";
  }

  return "Bets are currently read only.";
}

function areBetsEqual(
  previousBets: PredictionCategory[],
  nextBets: PredictionCategory[],
) {
  return JSON.stringify(previousBets) === JSON.stringify(nextBets);
}

function createDraftBetId(bets: PredictionCategory[], value: string) {
  const baseId = `custom-${slugify(value) || Date.now()}`;
  const existingIds = new Set(bets.map((bet) => bet.id));
  let nextId = baseId;
  let suffix = 2;

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
