import { MatchPickJoinPage } from "@/components/match-picks/match-picks-pages";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return <MatchPickJoinPage initialInviteCode={code ?? ""} />;
}
