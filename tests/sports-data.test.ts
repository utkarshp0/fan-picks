import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeBigBallsMatches } from "../src/lib/big-balls-data";
import { enrichTemplatesWithSportsData } from "../src/lib/sports-data-client";
import { worldCup2026Template } from "../src/data/templates";
import { filterRealSportsTeamNames } from "../src/lib/sports-team-utils";
import {
  fetchWorldCup26QualifiedTeams,
  normalizeWorldCup26Teams,
  withWorldCup26QualifiedTeams,
} from "../src/lib/worldcup26-fallback";

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

  it("normalizes World Cup match fields from Big Balls wc2026 endpoint", () => {
    const snapshot = normalizeBigBallsMatches(
      {
        tournamentId: "fifa-world-cup-2026",
        league: "wc2026",
      },
      [
        {
          match_id: "match-1",
          group: "A",
          home_team: {
            id: "mex",
            name: "Mexico",
            flag_url: "https://flagcdn.com/w80/mx.png",
          },
          away_team: {
            id: "usa",
            name: "United States",
            flag_url: "https://flagcdn.com/w80/us.png",
          },
          scheduled_at: "2026-06-11T19:00:00Z",
          status: "upcoming",
        },
      ],
      "2026-06-03T10:00:00.000Z",
    );

    assert.equal(snapshot.fixtures[0].providerMatchId, "match-1");
    assert.equal(snapshot.fixtures[0].kickoffUtc, "2026-06-11T19:00:00Z");
    assert.deepEqual(
      snapshot.teams.map((team) => team.name),
      ["Mexico", "United States"],
    );
    assert.equal(
      snapshot.teams.find((team) => team.name === "Mexico")?.logoUrl,
      "https://flagcdn.com/w80/mx.png",
    );
  });

  it("keeps knockout placeholder names out of synced tournament team choices", () => {
    const snapshot = normalizeBigBallsMatches(
      {
        tournamentId: "fifa-world-cup-2026",
        league: "wc2026",
      },
      [
        {
          match_id: "match-1",
          home_team: { id: "mex", name: "Mexico" },
          away_team: { id: "group-e-winner", name: "Group E Winner" },
          scheduled_at: "2026-06-11T19:00:00Z",
          status: "upcoming",
        },
        {
          match_id: "match-2",
          home_team: { id: "third-place", name: "THIRD PLACE GROUP C/D/F/G/H" },
          away_team: { id: "fra", name: "France" },
          scheduled_at: "2026-06-12T19:00:00Z",
          status: "upcoming",
        },
      ],
      "2026-06-03T10:00:00.000Z",
    );

    assert.equal(snapshot.fixtures.length, 2);
    assert.deepEqual(
      snapshot.teams.map((team) => team.name),
      ["France", "Mexico"],
    );
  });

  it("normalizes WorldCup26 qualified teams from the dedicated teams endpoint", () => {
    const teams = normalizeWorldCup26Teams("fifa-world-cup-2026", [
      {
        id: "37",
        team_id: "legacy-37",
        name_en: "Argentina",
        fifa_code: "ARG",
        flag: "https://example.test/arg.png",
      },
      {
        id: "16",
        name_en: "Turkey",
        fifa_code: "TUR",
        flag: "https://example.test/tur.png",
      },
      {
        id: "placeholder",
        name_en: "Group E Winner",
      },
      {
        team_id: "12",
        name: "France",
        fifa_code: "FRA",
        flag_url: "https://example.test/fra.png",
      },
    ]);

    assert.deepEqual(
      teams.map((team) => ({
        name: team.name,
        providerTeamId: team.providerTeamId,
        shortName: team.shortName,
      })),
      [
        { name: "Argentina", providerTeamId: "37", shortName: "ARG" },
        { name: "France", providerTeamId: "12", shortName: "FRA" },
        { name: "Turkey", providerTeamId: "16", shortName: "TUR" },
      ],
    );
  });

  it("uses dedicated WorldCup26 teams instead of fixture-derived teams", () => {
    const snapshot = normalizeBigBallsMatches(
      {
        tournamentId: "fifa-world-cup-2026",
        league: "wc2026",
      },
      [
        {
          match_id: "match-1",
          home_team: { id: "mex", name: "Mexico" },
          away_team: { id: "group-e-winner", name: "Group E Winner" },
          scheduled_at: "2026-06-11T19:00:00Z",
          status: "upcoming",
        },
      ],
      "2026-06-03T10:00:00.000Z",
    );
    const qualifiedTeams = normalizeWorldCup26Teams("fifa-world-cup-2026", [
      { team_id: "37", name_en: "Argentina" },
      { team_id: "12", name_en: "France" },
    ]);
    const merged = withWorldCup26QualifiedTeams(snapshot, qualifiedTeams);

    assert.deepEqual(
      merged.teams.map((team) => team.name),
      ["Argentina", "France"],
    );
    assert.equal(merged.tournament.teamCount, 2);
    assert.equal(merged.fixtures[0].homeTeamName, "Mexico");
    assert.equal(merged.fixtures[0].awayTeamName, "Group E Winner");
  });

  it("rejects WorldCup26 team sync results that are not exactly 48 teams", async () => {
    const originalFetch = globalThis.fetch;
    const originalTeamsUrl = process.env.WORLDCUP26_TEAMS_API_URL;

    process.env.WORLDCUP26_TEAMS_API_URL = "https://example.test/teams";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          teams: [{ id: "1", name_en: "Mexico", fifa_code: "MEX" }],
        }),
        { status: 200 },
      );

    try {
      await assert.rejects(
        () =>
          fetchWorldCup26QualifiedTeams({
            tournamentId: "fifa-world-cup-2026",
            league: "wc2026",
          }),
        /expected 48/,
      );
    } finally {
      globalThis.fetch = originalFetch;

      if (originalTeamsUrl === undefined) {
        delete process.env.WORLDCUP26_TEAMS_API_URL;
      } else {
        process.env.WORLDCUP26_TEAMS_API_URL = originalTeamsUrl;
      }
    }
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
            {
              id: "fifa-world-cup-2026:group-b-2nd-place",
              tournamentId: "fifa-world-cup-2026",
              providerTeamId: "group-b-2nd-place",
              name: "Group B 2nd Place",
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

  it("filters placeholder team names from existing pool bet choices", () => {
    assert.deepEqual(
      filterRealSportsTeamNames([
        "Argentina",
        "Group A 2nd Place",
        "GROUP I SECOND PLACE",
        "THIRD PLACE GROUP A/B/C/D/F",
        "France",
        "France",
      ]),
      ["Argentina", "France"],
    );
  });
});
