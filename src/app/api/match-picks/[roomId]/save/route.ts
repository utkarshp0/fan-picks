import { NextResponse, type NextRequest } from "next/server";

import { saveMatchPickAnswer } from "@/lib/server-match-picks";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const body = await request.json();
  const result = await saveMatchPickAnswer(accessToken ?? "", roomId, body.answer);

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
