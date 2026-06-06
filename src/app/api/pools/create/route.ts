import { NextResponse, type NextRequest } from "next/server";

import { createPoolOnServer } from "@/lib/server-pools";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const result = await createPoolOnServer(accessToken ?? "", {
    championship: body.championship,
    creator: body.creator,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status,
  });
}
