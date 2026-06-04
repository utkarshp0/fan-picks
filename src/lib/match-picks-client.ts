"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import type {
  MatchPickAnswer,
  MatchPickFixtureOption,
  MatchPickRoom,
  MatchPickType,
} from "@/types/match-picks";

type ApiResult<T> =
  | ({ ok: true; message: string } & T)
  | { ok: false; message: string; status?: number };

export async function fetchMatchPickFixtures() {
  const response = await fetch("/api/match-picks/fixtures", {
    cache: "no-store",
  });
  const result = (await response.json()) as {
    fixtures?: MatchPickFixtureOption[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(result.message ?? "Could not load fixtures.");
  }

  return result.fixtures ?? [];
}

export async function fetchMatchPickRooms() {
  return authedRequest<{ rooms: MatchPickRoom[] }>("/api/match-picks/rooms");
}

export async function fetchMatchPickRoom(roomId: string) {
  return authedRequest<{ room: MatchPickRoom }>(`/api/match-picks/${roomId}`);
}

export async function createMatchPickRoom(input: {
  fixtureId: string;
  pickType: MatchPickType;
}) {
  return authedRequest<{ room: MatchPickRoom }>("/api/match-picks/rooms", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function joinMatchPickRoom(inviteCode: string) {
  return authedRequest<{ room: MatchPickRoom }>("/api/match-picks/join", {
    body: JSON.stringify({ inviteCode }),
    method: "POST",
  });
}

export async function saveMatchPickAnswer(roomId: string, answer: MatchPickAnswer) {
  return authedRequest<{ room: MatchPickRoom }>(`/api/match-picks/${roomId}/save`, {
    body: JSON.stringify({ answer }),
    method: "POST",
  });
}

export async function scoreMatchPickRoom(roomId: string) {
  return authedRequest<{ room: MatchPickRoom }>(`/api/match-picks/${roomId}/score`, {
    method: "POST",
  });
}

async function authedRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const result = (await response.json()) as ApiResult<T>;

  return result;
}
