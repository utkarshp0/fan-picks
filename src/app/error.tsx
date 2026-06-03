"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-danger">
          Something broke
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Fan Picks needs a reload.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The app shell caught an unexpected error before anything sensitive was
          changed.
        </p>
        <Button className="mt-5" onClick={reset} variant="secondary">
          <RotateCcw aria-hidden className="h-4 w-4" />
          Try again
        </Button>
      </section>
    </main>
  );
}
