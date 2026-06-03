import { NextResponse, type NextRequest } from "next/server";

import { signUpAccount } from "@/lib/server-account-auth";
import { isSupabaseServerConfigured } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      {
        message:
          "Server auth is not configured. Add SUPABASE_SERVICE_ROLE_KEY before using production signup.",
      },
      { status: 503 },
    );
  }

  const body = await request.json();
  const result = await signUpAccount({
    username: String(body.username ?? ""),
    password: String(body.password ?? ""),
    displayName: String(body.displayName ?? ""),
  });

  return NextResponse.json(result, {
    status: result.profile ? 200 : 400,
  });
}
