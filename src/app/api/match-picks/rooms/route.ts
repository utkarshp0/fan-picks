import { NextResponse, type NextRequest } from "next/server";

import {
  createMatchPickRoom,
  listMatchPickRooms,
} from "@/lib/server-match-picks";

export async function GET(request: NextRequest) {
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const result = await listMatchPickRooms(accessToken ?? "");

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}

export async function POST(request: NextRequest) {
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const body = await request.json();
  const result = await createMatchPickRoom(accessToken ?? "", {
    fixtureId: body.fixtureId,
    pickType: body.pickType,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
