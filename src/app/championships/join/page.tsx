import type { Metadata } from "next";

import { JoinPoolPage } from "@/components/championship/pages/join-pool-page";
import { getShareImageUrl } from "@/lib/share-metadata";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}): Promise<Metadata> {
  const { code } = await searchParams;
  const title = code ? "Join this Fan Picks pool" : "Join a Fan Picks pool";
  const description = code
    ? "Login or sign up to join the pool, make your picks, and keep every change transparent."
    : "Use your invite code to join a friendly Fan Picks pool.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [getShareImageUrl("pool")],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [getShareImageUrl("pool")],
    },
  };
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return <JoinPoolPage initialInviteCode={code ?? ""} />;
}
