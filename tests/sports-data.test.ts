import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeBigBallsMatches } from "../src/lib/big-balls-data";
import { enrichTemplatesWithSportsData } from "../src/lib/sports-data-client";
import { worldCup2026Template } from "../src/data/templates";

describe("Big Balls Data sports sync", () => {
  it("normalizes matches into tournament teams and fixtures", () => {
    const syncedAt = "2026-06-03T10:00:00.000Z";
    const snapshot = normalizeBigBallsMatches(
      {
        tournamentId: "fifa-world-cup-2026",
        league: "wc2026",
      },
      [
        {
          id: "match-1",
          sport: "football",
          league: "wc2026",
          home_team: { id: "arg", name: "Argentina" },
          away_team: { id: "usa", name: "USA" },
          kickoff_utc: "2026-06-11T20:00:00Z",
          status: "scheduled",
        },
        {
          id: "match-2",
          sport: "football",
          league: "wc2026",
          home_team: { id: "mex", name: "Mexico" },
          away_team: { id: "arg", name: "Argentina" },
          kickoff_utc: "2026-06-12T20:00:00Z",
          status: "scheduled",
        },
      ],
      syncedAt,
    );

    assert.equal(snapshot.tournament.id, "fifa-world-cup-2026");
    assert.equal(snapshot.tournament.startDate, "2026-06-11");
    assert.equal(snapshot.fixtures.length, 2);
    assert.deepEqual(
      snapshot.teams.map((team) => team.name),
      ["Argentina", "Mexico", "USA"],
    );
  });

  it("injects synced team choices into team-based default bets", () => {
    const [template] = enrichTemplatesWithSportsData(
      [worldCup2026Template],
      [
        {
          id: "fifa-world-cup-2026",
          provider: "big-balls-data",
          providerLeagueId: "wc2026",
          sport: "football",
          league: "wc2026",
          name: "FIFA World Cup 2026",
          season: "2026",
          startDate: "2026-06-11",
          matchCount: 1,
          teamCount: 2,
          teams: [
            {
              id: "fifa-world-cup-2026:arg",
              tournamentId: "fifa-world-cup-2026",
              providerTeamId: "arg",
              name: "Argentina",
            },
            {
              id: "fifa-world-cup-2026:usa",
              tournamentId: "fifa-world-cup-2026",
              providerTeamId: "usa",
              name: "USA",
            },
          ],
          fixtures: [],
        },
      ],
    );

    assert.deepEqual(
      template.defaultBets.find((bet) => bet.id === "top-4-teams")?.choices,
      ["Argentina", "USA"],
    );
    assert.equal(
      template.defaultBets.find((bet) => bet.id === "golden-boot")?.choices,
      undefined,
    );
  });
});
