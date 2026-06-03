import { LoaderCircle, Trophy } from "lucide-react";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-accent/10">
        <div className="h-full w-1/3 animate-[route-progress_1s_ease-in-out_infinite] rounded-r-full bg-accent shadow-[0_0_18px_rgba(24,195,126,0.65)]" />
      </div>
      <div className="grid w-full max-w-xs place-items-center gap-4 rounded-lg border border-border bg-surface p-6 text-center shadow-2xl shadow-black/40">
        <div className="relative grid h-16 w-16 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Trophy aria-hidden className="h-7 w-7" />
          <span className="absolute -inset-2 rounded-xl border border-accent/35 animate-[loader-ring_1.2s_ease-out_infinite]" />
        </div>
        <div>
          <p className="text-sm font-semibold">Loading Fan Picks</p>
          <p className="mt-1 text-xs text-muted">Getting the next page ready</p>
        </div>
        <LoaderCircle aria-hidden className="h-5 w-5 animate-spin text-accent" />
      </div>
    </main>
  );
}
