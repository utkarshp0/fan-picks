import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  championshipTemplates,
  getChampionshipTemplate,
  integritySignals,
  womensT20WorldCup2026Template,
  worldCup2026Template,
} from "../src/data/templates";

describe("championshipTemplates array", () => {
  test("contains exactly 2 templates", () => {
    assert.equal(championshipTemplates.length, 2);
  });

  test("first template is the FIFA World Cup 2026", () => {
    assert.equal(championshipTemplates[0].id, "fifa-world-cup-2026");
  });

  test("second template is the ICC Women's T20 World Cup 2026", () => {
    assert.equal(championshipTemplates[1].id, "womens-t20-world-cup-2026");
  });
});

describe("worldCup2026Template", () => {
  test("has the correct id", () => {
    assert.equal(worldCup2026Template.id, "fifa-world-cup-2026");
  });

  test("has a name", () => {
    assert.ok(worldCup2026Template.name.length > 0);
  });

  test("has 2026 season", () => {
    assert.equal(worldCup2026Template.season, "2026");
  });

  test("lockDate is strictly before startDate", () => {
    const lock = new Date(worldCup2026Template.lockDate);
    const start = new Date(worldCup2026Template.startDate);
    assert.ok(lock < start, `lockDate ${worldCup2026Template.lockDate} should be before startDate ${worldCup2026Template.startDate}`);
  });

  test("has at least one default bet", () => {
    assert.ok(worldCup2026Template.defaultBets.length > 0);
  });

  test("includes a Top 4 teams bet with selectionCount 4", () => {
    const bet = worldCup2026Template.defaultBets.find((b) => b.id === "top-4-teams");
    assert.ok(bet, "top-4-teams bet not found");
    assert.equal(bet!.selectionCount, 4);
    assert.equal(bet!.type, "multi-team");
  });

  test("includes a Champion bet with selectionCount 1", () => {
    const bet = worldCup2026Template.defaultBets.find((b) => b.id === "champion");
    assert.ok(bet, "champion bet not found");
    assert.equal(bet!.selectionCount, 1);
  });

  test("choice-type bet has a non-empty choices array", () => {
    const choiceBets = worldCup2026Template.defaultBets.filter((b) => b.type === "choice");
    for (const bet of choiceBets) {
      assert.ok(Array.isArray(bet.choices) && bet.choices.length > 0, `${bet.name} must have choices`);
    }
  });
});

describe("womensT20WorldCup2026Template", () => {
  test("has the correct id", () => {
    assert.equal(womensT20WorldCup2026Template.id, "womens-t20-world-cup-2026");
  });

  test("lockDate is strictly before startDate", () => {
    const lock = new Date(womensT20WorldCup2026Template.lockDate);
    const start = new Date(womensT20WorldCup2026Template.startDate);
    assert.ok(lock < start);
  });

  test("has at least one default bet", () => {
    assert.ok(womensT20WorldCup2026Template.defaultBets.length > 0);
  });

  test("all choice-type bets have at least 2 choices", () => {
    const choiceBets = womensT20WorldCup2026Template.defaultBets.filter((b) => b.type === "choice");
    for (const bet of choiceBets) {
      assert.ok(
        Array.isArray(bet.choices) && bet.choices.length >= 2,
        `${bet.name} must have at least 2 choices`,
      );
    }
  });
});

describe("all templates — shared structural rules", () => {
  for (const template of championshipTemplates) {
    test(`${template.id}: required fields are present`, () => {
      assert.ok(template.id);
      assert.ok(template.name);
      assert.ok(template.season);
      assert.ok(template.startDate);
      assert.ok(template.lockDate);
      assert.ok(template.description);
    });

    test(`${template.id}: every bet has required fields`, () => {
      for (const bet of template.defaultBets) {
        assert.ok(bet.id, `bet is missing id`);
        assert.ok(bet.name, `${bet.id} is missing name`);
        assert.ok(bet.type, `${bet.id} is missing type`);
        assert.ok(bet.prompt, `${bet.id} is missing prompt`);
        assert.ok(bet.selectionCount >= 1, `${bet.id} selectionCount must be >= 1`);
        assert.ok(bet.source === "default" || bet.source === "custom", `${bet.id} has invalid source`);
      }
    });
  }
});

describe("getChampionshipTemplate", () => {
  test("returns the World Cup template when given its id", () => {
    const t = getChampionshipTemplate("fifa-world-cup-2026");
    assert.equal(t.id, "fifa-world-cup-2026");
  });

  test("returns the Women's T20 template when given its id", () => {
    const t = getChampionshipTemplate("womens-t20-world-cup-2026");
    assert.equal(t.id, "womens-t20-world-cup-2026");
  });

  test("falls back to World Cup template for unknown id", () => {
    const t = getChampionshipTemplate("does-not-exist");
    assert.equal(t.id, "fifa-world-cup-2026");
  });

  test("falls back to World Cup template for empty string", () => {
    const t = getChampionshipTemplate("");
    assert.equal(t.id, "fifa-world-cup-2026");
  });
});

describe("integritySignals", () => {
  test("has 5 signals", () => {
    assert.equal(integritySignals.length, 5);
  });

  test("all signals are verified", () => {
    for (const signal of integritySignals) {
      assert.equal(signal.status, "verified", `${signal.label} is not verified`);
    }
  });

  test("each signal has a non-empty label", () => {
    for (const signal of integritySignals) {
      assert.ok(signal.label.length > 0);
    }
  });
});
