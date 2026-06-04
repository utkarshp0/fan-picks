import { NextResponse, type NextRequest } from "next/server";

import { joinMatchPickRoom } from "@/lib/server-match-picks";

export async function POST(request: NextRequest) {
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const body = await request.json();
  const result = await joinMatchPickRoom(
    accessToken ?? "",
    String(body.inviteCode ?? ""),
  );

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
