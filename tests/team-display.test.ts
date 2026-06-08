import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getTeamDisplayInfo,
  getTeamInitials,
  teamMatchesSearch,
} from "../src/lib/team-display";

describe("team display metadata", () => {
  it("maps World Cup team names to flag codes", () => {
    assert.equal(getTeamDisplayInfo("Brazil").flagCode, "br");
    assert.equal(getTeamDisplayInfo("United States").flagCode, "us");
    assert.equal(getTeamDisplayInfo("IR Iran").flagCode, "ir");
    assert.equal(getTeamDisplayInfo("Czech Republic").flagCode, "cz");
    assert.equal(getTeamDisplayInfo("Congo DR").flagCode, "cd");
  });

  it("normalizes accents when matching metadata", () => {
    assert.equal(getTeamDisplayInfo("Curaçao").flagCode, "cw");
    assert.equal(getTeamDisplayInfo("Türkiye").flagCode, "tr");
  });

  it("groups known teams into picker regions", () => {
    assert.equal(getTeamDisplayInfo("Morocco").region, "Africa");
    assert.equal(getTeamDisplayInfo("Argentina").region, "Americas");
    assert.equal(getTeamDisplayInfo("Japan").region, "Asia/Oceania");
    assert.equal(getTeamDisplayInfo("England").region, "Europe");
  });

  it("searches team names with normalized input", () => {
    assert.equal(teamMatchesSearch("South Korea", "south"), true);
    assert.equal(teamMatchesSearch("Curaçao", "curacao"), true);
    assert.equal(teamMatchesSearch("South Korea", "brazil"), false);
  });

  it("falls back to initials for unknown teams", () => {
    assert.equal(getTeamInitials("Mystery Nation"), "MN");
  });
});
