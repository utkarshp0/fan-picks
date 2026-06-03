import { NextResponse, type NextRequest } from "next/server";

import { syncPoolBetsOnServer } from "@/lib/server-pool-bets";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  const result = await syncPoolBetsOnServer(
    accessToken ?? "",
    String(body.championshipId ?? ""),
    body.bets,
    body.events,
  );

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
