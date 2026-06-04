import { NextResponse, type NextRequest } from "next/server";

import { leaveMatchPickRoom } from "@/lib/server-match-picks";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const result = await leaveMatchPickRoom(accessToken ?? "", roomId);

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
