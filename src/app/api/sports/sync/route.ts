import { NextResponse } from "next/server";

import {
  fetchBigBallsLeagueMatches,
  getSportsLeagueSyncConfig,
  normalizeBigBallsMatches,
} from "@/lib/big-balls-data";
import {
  recordSportsSyncFailure,
  syncSportsDataSnapshot,
} from "@/lib/server-sports-data";
import { createSupabaseServiceClient, isSupabaseServerConfigured } from "@/lib/supabase-server";
import {
  fetchWorldCup26QualifiedTeams,
  withWorldCup26QualifiedTeams,
} from "@/lib/worldcup26-fallback";
import type { SportsSyncResult } from "@/types/sports-data";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!isSupabaseServerConfigured() || !accessToken) {
    return NextResponse.json({ message: "Login required." }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ message: "Login required." }, { status: 401 });
  }

  const syncedAt = new Date().toISOString();
  const tournaments: SportsSyncResult["tournaments"] = [];

  try {
    for (const config of getSportsLeagueSyncConfig()) {
      const matches = await fetchBigBallsLeagueMatches(config);
      const matchSnapshot = normalizeBigBallsMatches(config, matches, syncedAt);
      const qualifiedTeams = await fetchWorldCup26QualifiedTeams(config).catch(
        async (teamError) => {
          await recordSportsSyncFailure({
            message:
              teamError instanceof Error
                ? teamError.message
                : "WorldCup26 teams sync failed.",
            syncedAt,
            tournamentId: config.tournamentId,
            source: "worldcup26-teams",
          });

          return null;
        },
      );
      const snapshot = withWorldCup26QualifiedTeams(
        matchSnapshot,
        qualifiedTeams,
      );

      await syncSportsDataSnapshot(config, snapshot);
      tournaments.push({
        tournamentId: snapshot.tournament.id,
        league: snapshot.tournament.league,
        matches: snapshot.fixtures.length,
        teams: snapshot.teams.length,
      });
    }

    return NextResponse.json({ syncedAt, tournaments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sports sync failed.";

    await recordSportsSyncFailure({ message, syncedAt });

    return NextResponse.json({ message }, { status: 500 });
  }
}
