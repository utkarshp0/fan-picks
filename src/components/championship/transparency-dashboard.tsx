"use client";

import {
  Activity,
  CheckCircle2,
  Fingerprint,
  History,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  formatDateTime,
  getIntegrityChecks,
  getIntegrityScore,
  getSubmissionForParticipant,
  hasNoPostLockVersions,
} from "@/lib/transparency";
import type { Championship } from "@/types/championship";

type TransparencyDashboardProps = {
  championship: Championship;
};

export function TransparencyDashboard({
  championship,
}: TransparencyDashboardProps) {
  const score = getIntegrityScore(championship);
  const checks = getIntegrityChecks(championship);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border bg-surface-raised p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            description="Integrity is calculated from joins, locks, audit events, and immutable version checks."
            title="Transparency dashboard"
          />
          <div className="grid min-h-24 min-w-28 place-items-center rounded-lg border border-accent/40 bg-accent/10 px-4">
            <p className="text-4xl font-semibold text-accent">{score}%</p>
            <p className="text-xs text-muted">Integrity</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <div
              className="flex min-h-20 items-start gap-3 rounded-lg border border-border bg-background p-3"
              key={check.label}
            >
              {check.passed ? (
                <CheckCircle2
                  aria-hidden
                  className="mt-1 h-5 w-5 shrink-0 text-accent"
                />
              ) : (
                <XCircle
                  aria-hidden
                  className="mt-1 h-5 w-5 shrink-0 text-warning"
                />
              )}
              <div>
                <p className="font-medium">{check.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {check.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-raised p-4">
        <SectionHeading
          description="Every draft is preserved. The locked version is marked and can be verified against the fingerprint."
          title="Prediction version history"
        />
        <div className="mt-5 grid gap-3">
          {championship.participants.map((participant) => {
            const submission = getSubmissionForParticipant(
              participant,
              championship,
            );

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
                        : "No prediction versions yet"}
                    </p>
                  </div>
                  <Badge
                    variant={submission?.lockedAt ? "accent" : "warning"}
                  >
                    {submission?.lockedAt ? "Locked" : "Unlocked"}
                  </Badge>
                </div>

                {submission ? (
                  <div className="mt-4 grid gap-2">
                    {submission.versions.map((version) => (
                      <div
                        className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-surface px-3"
                        key={version.id}
                      >
                        <div className="flex items-center gap-2">
                          <History
                            aria-hidden
                            className="h-4 w-4 text-accent"
                          />
                          <div>
                            <p className="text-sm font-medium">
                              Version {version.versionNumber}
                            </p>
                            <p className="text-xs text-muted">
                              {formatDateTime(version.createdAt)}
                            </p>
                          </div>
                        </div>
                        {version.id === submission.lockedVersionId ? (
                          <Badge variant="accent">Locked version</Badge>
                        ) : (
                          <Badge variant="muted">Draft</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-raised p-4">
        <SectionHeading
          description="Fingerprints prove the locked version has a stable integrity marker."
          title="Fingerprint verification"
        />
        <div className="mt-5 grid gap-3">
          {championship.predictions.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background p-3 text-sm text-muted">
              No prediction fingerprints yet.
            </p>
          ) : (
            championship.predictions.map((submission) => (
              <div
                className="rounded-lg border border-border bg-background p-4"
                key={submission.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{submission.displayName}</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted">
                      {submission.fingerprint ?? "Not locked yet"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      submission.fingerprint &&
                      hasNoPostLockVersions(submission)
                        ? "accent"
                        : "warning"
                    }
                  >
                    {submission.fingerprint ? "Verified" : "Pending"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-raised p-4">
        <SectionHeading
          description="Last-edited visibility is public for every participant."
          title="Participant edit visibility"
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {championship.participants.map((participant) => {
            const submission = getSubmissionForParticipant(
              participant,
              championship,
            );

            return (
              <div
                className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-border bg-background px-3"
                key={participant.id}
              >
                <div>
                  <p className="text-sm font-medium">{participant.displayName}</p>
                  <p className="mt-1 text-xs text-muted">
                    {submission?.lastEditedAt
                      ? formatDateTime(submission.lastEditedAt)
                      : "No edits yet"}
                  </p>
                </div>
                {submission?.fingerprint ? (
                  <Fingerprint aria-hidden className="h-4 w-4 text-accent" />
                ) : (
                  <Activity aria-hidden className="h-4 w-4 text-warning" />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function IntegritySummary({ championship }: TransparencyDashboardProps) {
  const score = getIntegrityScore(championship);
  const checks = getIntegrityChecks(championship);

  return (
    <div className="grid gap-3 md:grid-cols-[180px_1fr]">
      <div className="grid min-h-32 place-items-center rounded-lg border border-accent/40 bg-accent/10 p-4">
        <ShieldCheck aria-hidden className="h-6 w-6 text-accent" />
        <p className="text-4xl font-semibold text-accent">{score}%</p>
        <p className="text-xs text-muted">Integrity score</p>
      </div>
      <div className="grid gap-2">
        {checks.map((check) => (
          <div
            className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-3"
            key={check.label}
          >
            <span className="text-sm text-muted">{check.label}</span>
            <Badge variant={check.passed ? "accent" : "warning"}>
              {check.passed ? "Verified" : "Pending"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
