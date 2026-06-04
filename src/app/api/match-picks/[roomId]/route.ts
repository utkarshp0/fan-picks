import { NextResponse, type NextRequest } from "next/server";

import { getMatchPickRoom } from "@/lib/server-match-picks";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const result = await getMatchPickRoom(accessToken ?? "", roomId);

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
