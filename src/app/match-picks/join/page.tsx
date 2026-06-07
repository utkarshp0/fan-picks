import type { Metadata } from "next";

import { MatchPickJoinPage } from "@/components/match-picks/match-picks-pages";
import { createShareImageMetadata } from "@/lib/share-metadata";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}): Promise<Metadata> {
  const { code } = await searchParams;
  const title = code ? "Join this Fan Picks Match Pick" : "Join a Fan Picks Match Pick";
  const description = code
    ? "Login or sign up to join this one-match prediction room before the lock time."
    : "Use your invite code to join a friendly one-match prediction room.";
  const image = createShareImageMetadata("match", code);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [image],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return <MatchPickJoinPage initialInviteCode={code ?? ""} />;
}
