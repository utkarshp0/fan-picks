import { MatchPickRoomPage } from "@/components/match-picks/match-picks-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return <MatchPickRoomPage roomId={roomId} tab="picks" />;
}
