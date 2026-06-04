import { NextResponse } from "next/server";

import { getUpcomingMatchPickFixtures } from "@/lib/server-match-picks";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tournamentId =
    url.searchParams.get("tournamentId") ?? "fifa-world-cup-2026";

  try {
    const fixtures = await getUpcomingMatchPickFixtures(tournamentId);

    return NextResponse.json({ fixtures });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not load upcoming fixtures.",
      },
      { status: 400 },
    );
  }
}
