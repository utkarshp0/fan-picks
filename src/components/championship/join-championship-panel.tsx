"use client";

import { FormEvent, useState } from "react";
import { LogIn, QrCode } from "lucide-react";

import { useGuestSession } from "@/components/auth/guest-session-provider";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { joinChampionshipByCode } from "@/lib/championship-store";
import type { Championship } from "@/types/championship";

type JoinChampionshipPanelProps = {
  defaultInviteCode?: string;
  onJoined?: (championship: Championship) => void;
};

export function JoinChampionshipPanel({
  defaultInviteCode = "",
  onJoined,
}: JoinChampionshipPanelProps) {
  const { profile } = useGuestSession();
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning">(
    "success",
  );
  const [isJoining, setIsJoining] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      setMessage("Enter your name before joining.");
      setMessageTone("warning");
      return;
    }

    setIsJoining(true);
    try {
      const formData = new FormData(event.currentTarget);
      const result = await joinChampionshipByCode(
        {
          inviteCode: String(formData.get("inviteCode") ?? ""),
        },
        profile,
      );

      setMessage(result.message);
      setMessageTone(result.status === "not_found" ? "warning" : "success");

      if (result.championship) {
        onJoined?.(result.championship);
      }
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4" id="join">
      <SectionHeading
        description="Use the code your friend shared. You can leave later."
        title="Join pool"
      />

      <form
        className="mt-5 grid gap-4"
        key={defaultInviteCode}
        onSubmit={handleSubmit}
      >
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">Invite code</span>
          <input
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
            defaultValue={defaultInviteCode}
            name="inviteCode"
            placeholder="FP-ABC123"
            required
          />
        </label>

        <div className="rounded-lg border border-border bg-surface-raised p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <QrCode aria-hidden className="h-4 w-4 text-accent" />
            What happens next
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            You will see the pool&apos;s bets, make your picks, and lock them
            before the deadline.
          </p>
        </div>

        <Button
          disabled={!profile}
          loading={isJoining}
          loadingLabel="Joining pool"
          type="submit"
        >
          <LogIn aria-hidden className="h-4 w-4" />
          Join pool
        </Button>
      </form>

      {message ? (
        <p
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            messageTone === "success"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <LogIn aria-hidden className="h-4 w-4" />
        No email, password, money, odds, or payouts.
      </div>
    </section>
  );
}
