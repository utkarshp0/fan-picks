import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message: "Login uses Supabase Auth in the browser.",
    },
    { status: 410 },
  );
}
