import type { ChampionshipTemplate, IntegritySignal } from "@/types/championship";

export const worldCup2026Template: ChampionshipTemplate = {
  id: "fifa-world-cup-2026",
  name: "FIFA World Cup 2026",
  season: "2026",
  startDate: "2026-06-11",
  lockDate: "2026-06-10",
  description:
    "Football pool for friends, offices, and family groups during the 2026 World Cup.",
  defaultBets: [
    {
      id: "top-4-teams",
      name: "Top 4 teams",
      type: "multi-team",
      prompt: "Pick the 4 teams you think will reach the semifinals.",
      selectionCount: 4,
      scoringNote: "One point for each correct semifinalist.",
      source: "default",
    },
    {
      id: "champion",
      name: "Champion",
      type: "single-team",
      prompt: "Pick the tournament winner.",
      selectionCount: 1,
      scoringNote: "Five points for the correct champion.",
      source: "default",
    },
    {
      id: "golden-boot",
      name: "Golden Boot winner",
      type: "single-player",
      prompt: "Pick the player who will finish as top scorer.",
      selectionCount: 1,
      scoringNote: "Three points for the correct player.",
      source: "default",
    },
    {
      id: "most-team-goals",
      name: "Most goals by team",
      type: "single-team",
      prompt: "Pick the team that will score the most goals.",
      selectionCount: 1,
      scoringNote: "Three points for the correct team.",
      source: "default",
    },
    {
      id: "first-giant-out",
      name: "First giant eliminated",
      type: "choice",
      prompt: "Choose the major team you think will be eliminated first.",
      selectionCount: 1,
      scoringNote: "Two points for the correct pick.",
      choices: ["Brazil", "Argentina", "France", "England", "Spain", "Germany"],
      source: "default",
    },
  ],
};

export const womensT20WorldCup2026Template: ChampionshipTemplate = {
  id: "womens-t20-world-cup-2026",
  name: "ICC Women's T20 World Cup 2026",
  season: "2026",
  startDate: "2026-06-12",
  lockDate: "2026-06-11",
  description:
    "Cricket pool for the biggest Women's T20 tournament, with simple picks and bragging rights.",
  defaultBets: [
    {
      id: "champion",
      name: "Champion",
      type: "choice",
      prompt: "Pick the tournament winner.",
      selectionCount: 1,
      scoringNote: "Five points for the correct champion.",
      choices: ["Australia", "England", "India", "New Zealand", "South Africa", "Sri Lanka"],
      source: "default",
    },
    {
      id: "runner-up",
      name: "Runner-up",
      type: "choice",
      prompt: "Pick the finalist that does not win.",
      selectionCount: 1,
      scoringNote: "Three points for the correct runner-up.",
      choices: ["Australia", "England", "India", "New Zealand", "South Africa", "Sri Lanka"],
      source: "default",
    },
    {
      id: "top-run-scorer",
      name: "Top run scorer",
      type: "single-player",
      prompt: "Pick the player who scores the most runs.",
      selectionCount: 1,
      scoringNote: "Three points for the correct player.",
      source: "default",
    },
    {
      id: "top-wicket-taker",
      name: "Top wicket taker",
      type: "single-player",
      prompt: "Pick the player who takes the most wickets.",
      selectionCount: 1,
      scoringNote: "Three points for the correct player.",
      source: "default",
    },
    {
      id: "player-of-tournament",
      name: "Player of the tournament",
      type: "single-player",
      prompt: "Pick the official player of the tournament.",
      selectionCount: 1,
      scoringNote: "Four points for the correct player.",
      source: "default",
    },
  ],
};

export const championshipTemplates = [
  worldCup2026Template,
  womensT20WorldCup2026Template,
];

export function getChampionshipTemplate(templateId: string) {
  return (
    championshipTemplates.find((template) => template.id === templateId) ??
    worldCup2026Template
  );
}

export const integritySignals: IntegritySignal[] = [
  { label: "Invite-only pool", status: "verified" },
  { label: "Picks lock by date", status: "verified" },
  { label: "Field changes audited", status: "verified" },
  { label: "Custom bets supported", status: "verified" },
  { label: "No money handled", status: "verified" },
];

export const recentActivity = [
  "Pool created",
  "Tournament selected",
  "Bets selected",
  "Invite shared",
];
