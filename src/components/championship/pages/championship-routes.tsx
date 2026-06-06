"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Download,
  FileText,
  ListPlus,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ScrollText,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { AuditTimeline } from "@/components/championship/audit-timeline";
import { useGuestSession } from "@/components/auth/guest-session-provider";
import { PredictionBoard } from "@/components/championship/prediction-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getChampionshipTemplate } from "@/data/templates";
import { savePoolBets } from "@/lib/championship-store";
import {
  downloadPoolAgreementPdf,
  fetchPoolAgreement,
} from "@/lib/pool-agreement-client";
import type { BetType, Championship, PredictionCategory } from "@/types/championship";
import type {
  PoolAgreementModel,
  PoolAgreementPickRow,
} from "@/types/pool-agreement";

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

export function AgreementRoute({
  championship,
}: {
  championship: Championship;
}) {
  const [agreement, setAgreement] = useState<PoolAgreementModel | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  async function loadAgreement() {
    setIsLoading(true);
    const result = await fetchPoolAgreement(championship.id);

    if (result.ok) {
      setAgreement(result.agreement);
      setMessage("");
    } else {
      setAgreement(null);
      setMessage(result.message);
    }

    setIsLoading(false);
  }

  async function handleDownload() {
    setIsDownloading(true);
    const result = await downloadPoolAgreementPdf(championship.id);
    setMessage(result.message);
    setIsDownloading(false);
  }

  useEffect(() => {
    let isCancelled = false;

    void fetchPoolAgreement(championship.id).then((result) => {
      if (isCancelled) {
        return;
      }

      if (result.ok) {
        setAgreement(result.agreement);
        setMessage("");
      } else {
        setAgreement(null);
        setMessage(result.message);
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [championship.id]);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            description="Preview the friendly agreement anytime. After the pool lock date, it seals with everyone’s recorded picks from Supabase."
            title="Pool Agreement"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isLoading}
              loading={isLoading}
              loadingLabel="Refreshing"
              onClick={() => void loadAgreement()}
              variant="secondary"
            >
              <RefreshCw aria-hidden className="h-4 w-4" />
              Refresh preview
            </Button>
            <Button
              disabled={!agreement || isDownloading}
              loading={isDownloading}
              loadingLabel="Preparing PDF"
              onClick={() => void handleDownload()}
            >
              <Download aria-hidden className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
        {message ? (
          <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            {message}
          </p>
        ) : null}
      </section>

      {agreement ? (
        <AgreementPreview agreement={agreement} />
      ) : (
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="h-5 w-44 animate-pulse rounded bg-surface-raised" />
          <div className="mt-4 h-56 animate-pulse rounded-lg bg-surface-raised" />
        </section>
      )}
    </div>
  );
}

function AgreementPreview({
  agreement,
}: {
  agreement: PoolAgreementModel;
}) {
  const activeParticipants = agreement.participants.filter(
    (participant) => participant.status === "active",
  );

  return (
    <section className="overflow-hidden rounded-lg border border-[#8b7355] bg-[#efe3ce] text-[#17120d] shadow-[0_18px_80px_rgba(0,0,0,0.22)]">
      <div className="border-b border-[#8b7355]/50 bg-[#5a321f] px-5 py-4 text-[#fff8e8]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e2c28a]">
              {agreement.status === "sealed" ? "Sealed agreement" : "Draft preview"}
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight">
              The Official Fan Picks Agreement
            </h2>
          </div>
          <div className="rounded-full border-2 border-[#e2c28a] px-5 py-4 text-center font-black uppercase text-[#e2c28a]">
            {agreement.status}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-[#b19877] bg-[#f8eedc] p-5">
          <p className="font-serif text-lg leading-8">
            This Agreement is entered into by the undersigned Participants, each
            bringing confidence, selective memory, and a dangerous amount of
            tournament opinions.
          </p>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <AgreementFact label="Pool" value={agreement.poolName} />
            <AgreementFact label="Tournament" value={agreement.tournamentName} />
            <AgreementFact label="Invite code" value={agreement.inviteCode} />
            <AgreementFact label="Agreement ID" value={agreement.agreementId} />
            <AgreementFact
              label="Lock date"
              value={`${formatDate(agreement.lockDate)} IST`}
            />
            <AgreementFact
              label="Fingerprint"
              value={`${agreement.fingerprint.slice(0, 18)}...`}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#b19877] bg-[#f8eedc] p-5">
          <div className="flex items-center gap-2">
            <ScrollText aria-hidden className="h-5 w-5 text-[#8b5c2f]" />
            <h3 className="text-lg font-black">Parties involved</h3>
          </div>
          <div className="mt-4 grid gap-2">
            {agreement.participants.map((participant, index) => (
              <div
                className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-md border border-[#d0b894] bg-[#efe3ce] px-3 py-2 text-sm"
                key={participant.profileId}
              >
                <span className="font-bold text-[#8b5c2f]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{participant.displayName}</strong>{" "}
                  <span className="text-[#6f5c48]">@{participant.handle}</span>
                </span>
                <Badge
                  variant={participant.status === "active" ? "accent" : "muted"}
                >
                  {participant.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 border-t border-[#b19877] p-5 lg:grid-cols-2">
        {agreementClauses.map((clause, index) => (
          <article
            className="rounded-lg border border-[#b19877] bg-[#f8eedc] p-4"
            key={clause.title}
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8b5c2f]">
              Clause {index + 1}
            </p>
            <h3 className="mt-2 text-lg font-black">{clause.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#3f3429]">
              {clause.body}
            </p>
          </article>
        ))}
      </div>

      <div className="border-t border-[#b19877] p-5">
        <div className="rounded-lg border border-[#b19877] bg-[#f8eedc] p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8b5c2f]">
            Hereby agreed
          </p>
          <h3 className="mt-2 text-lg font-black">Participant attestation</h3>
          <p className="mt-2 text-sm leading-6 text-[#3f3429]">
            The undersigned participants hereby agree that this pool, its lock
            date, saved picks, and audit log form the official friendship
            record. After sealing, selective memory may be admired for
            creativity, but it shall not be accepted as evidence.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {activeParticipants.map((participant) => (
              <div
                className="rounded-md border border-[#d0b894] bg-[#efe3ce] p-3"
                key={participant.profileId}
              >
                <p className="font-serif text-xl font-semibold italic">
                  {participant.displayName}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8b5c2f]">
                  @{participant.handle} · {agreement.isSealed ? "sealed" : "draft"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 border-t border-[#b19877] p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#b19877] bg-[#f8eedc] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="h-5 w-5 text-[#8b5c2f]" />
            <h3 className="text-lg font-black">Audit summary</h3>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <AgreementFact
              label="Total audit events"
              value={String(agreement.auditSummary.totalAuditEvents)}
            />
            <AgreementFact
              label="Pick versions saved"
              value={String(agreement.auditSummary.pickVersionsSaved)}
            />
            <AgreementFact
              label="Prediction locks"
              value={String(agreement.auditSummary.predictionLocks)}
            />
            <AgreementFact
              label="Prediction reopens"
              value={String(agreement.auditSummary.predictionReopens)}
            />
            <AgreementFact
              label="Bet changes"
              value={String(agreement.auditSummary.betChanges)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#b19877] bg-[#f8eedc] p-5">
          <div className="flex items-center gap-2">
            <FileText aria-hidden className="h-5 w-5 text-[#8b5c2f]" />
            <h3 className="text-lg font-black">Recorded picks schedule</h3>
          </div>
          {agreement.isSealed ? (
            <RecordedPicksTable
              bets={agreement.bets}
              participants={activeParticipants}
              picks={agreement.picks}
            />
          ) : (
            <p className="mt-4 rounded-md border border-[#d0b894] bg-[#efe3ce] p-4 text-sm leading-6 text-[#3f3429]">
              Draft agreements do not reveal picks. Once the pool lock date
              passes, this schedule seals with every active participant’s saved
              selections from Supabase.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-[#b19877] px-5 py-4 text-xs leading-5 text-[#6f5c48]">
        Friendly document only. No deposits, odds, payouts, courtrooms, or
        dramatic chair-spinning objections. Generated {formatDateTime(agreement.generatedAt)} IST.
      </div>
    </section>
  );
}

function AgreementFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d0b894] bg-[#efe3ce] px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b5c2f]">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  );
}

function RecordedPicksTable({
  bets,
  participants,
  picks,
}: {
  bets: PredictionCategory[];
  participants: PoolAgreementModel["participants"];
  picks: PoolAgreementPickRow[];
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-[#d0b894]">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-[#dfc49a] text-xs uppercase tracking-[0.12em] text-[#3f3429]">
          <tr>
            <th className="px-3 py-2">Bet</th>
            <th className="px-3 py-2">Participant</th>
            <th className="px-3 py-2">Selected option(s)</th>
          </tr>
        </thead>
        <tbody>
          {bets.flatMap((bet) =>
            participants.map((participant) => {
              const pick = picks.find(
                (row) =>
                  row.betId === bet.id &&
                  row.profileId === participant.profileId,
              );

              return (
                <tr
                  className="border-t border-[#d0b894] bg-[#f8eedc]"
                  key={`${bet.id}-${participant.profileId}`}
                >
                  <td className="px-3 py-2 font-semibold">{bet.name}</td>
                  <td className="px-3 py-2">{participant.displayName}</td>
                  <td className="px-3 py-2">
                    {pick?.selectedOptions.length
                      ? pick.selectedOptions.join(", ")
                      : "No saved pick"}
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}

const agreementClauses = [
  {
    title: "Purpose of Agreement",
    body: "This document records the pool, the participants, and the sacred predictions before hindsight starts doing push-ups.",
  },
  {
    title: "Lock Date",
    body: "After the lock date, picks cannot be edited, rescued, spiritually reinterpreted, or renamed as the plan all along.",
  },
  {
    title: "Audit Log",
    body: "The audit log is the official memory of the group and outranks screenshots, voice notes, and suspiciously confident retellings.",
  },
  {
    title: "Bragging Rights",
    body: "The winner may brag with style. The group may roll their eyes, but the sealed record remains unbeaten.",
  },
  {
    title: "Vibes Clause",
    body: "If someone wins entirely on vibes, the parties agree to respect the vibes and pretend it was analysis.",
  },
  {
    title: "No Money Drama",
    body: "Fan Picks is for predictions, friendship, and harmless chaos. No odds, deposits, payouts, or spreadsheet debt collectors.",
  },
];

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${value}T00:00:00+05:30`));
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
