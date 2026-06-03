import { NextResponse } from "next/server";

import { fetchSportsTournamentSnapshots } from "@/lib/server-sports-data";

export async function GET() {
  const tournaments = await fetchSportsTournamentSnapshots();

  return NextResponse.json({ tournaments });
}
