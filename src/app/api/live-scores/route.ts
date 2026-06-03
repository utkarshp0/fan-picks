import { NextResponse } from "next/server";

import { getLiveScoresSnapshot } from "@/lib/server-live-scores";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tournamentId =
    url.searchParams.get("tournamentId") ?? "fifa-world-cup-2026";
  const snapshot = await getLiveScoresSnapshot(tournamentId);

  return NextResponse.json(snapshot);
}
