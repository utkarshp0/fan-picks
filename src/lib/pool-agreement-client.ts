"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { PoolAgreementModel } from "@/types/pool-agreement";

type AgreementApiResult =
  | { ok: true; agreement: PoolAgreementModel }
  | { ok: false; message: string; status?: number };

export async function fetchPoolAgreement(championshipId: string) {
  return authedAgreementRequest(`/api/pools/${championshipId}/agreement`);
}

export async function downloadPoolAgreementPdf(championshipId: string) {
  const token = await getAccessToken();
  const response = await fetch(
    `/api/pools/${championshipId}/agreement?format=pdf`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    return {
      ok: false as const,
      message: result?.message ?? "Could not download agreement.",
    };
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? "fan-picks-agreement.pdf";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  return { ok: true as const, message: "Agreement downloaded." };
}

async function authedAgreementRequest(
  url: string,
): Promise<AgreementApiResult> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const result = (await response.json()) as AgreementApiResult;

  return result;
}

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? "";
}
