"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, QrCode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Championship } from "@/types/championship";

type InviteCardProps = {
  championship: Championship;
};

export function InviteCard({ championship }: InviteCardProps) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `fanpicks.app/championship/${championship.slug}`;

  async function copyInvite() {
    const text = `${championship.name}\n${inviteUrl}\nInvite code: ${championship.inviteCode}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface-raised p-4" id="invites">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          description="Share this code with fans so they can join the championship."
          title="Invite"
        />
        <Badge variant="accent">Ready</Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px]">
        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs text-muted">Championship URL</p>
            <p className="mt-1 break-all text-sm font-medium">{inviteUrl}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs text-muted">Invite code</p>
            <p className="mt-1 text-2xl font-semibold">{championship.inviteCode}</p>
          </div>
        </div>

        <div className="grid min-h-28 place-items-center rounded-md border border-border bg-background">
          <QrCode aria-hidden className="h-14 w-14 text-accent" />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button onClick={copyInvite} variant="secondary">
          {copied ? (
            <Check aria-hidden className="h-4 w-4" />
          ) : (
            <Copy aria-hidden className="h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy invite"}
        </Button>
        <Button variant="secondary">
          <MessageCircle aria-hidden className="h-4 w-4" />
          Share later
        </Button>
      </div>
    </section>
  );
}
