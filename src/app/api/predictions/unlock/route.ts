import { NextResponse, type NextRequest } from "next/server";

import { unlockPredictionOnServer } from "@/lib/server-prediction-locks";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  const result = await unlockPredictionOnServer(
    accessToken ?? "",
    String(body.championshipId ?? ""),
  );

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
