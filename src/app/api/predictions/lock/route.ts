import { NextResponse, type NextRequest } from "next/server";

import { lockPredictionOnServer } from "@/lib/server-prediction-locks";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "");
  const result = await lockPredictionOnServer(
    accessToken ?? "",
    String(body.championshipId ?? ""),
  );

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
