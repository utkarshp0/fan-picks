import { NextResponse, type NextRequest } from "next/server";

import { scoreMatchPickRoom } from "@/lib/server-match-picks";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const result = await scoreMatchPickRoom(accessToken ?? "", roomId);

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
