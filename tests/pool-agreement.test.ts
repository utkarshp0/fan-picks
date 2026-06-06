import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  createAgreementPreviewModel,
  createPoolAgreementId,
  getFinalPredictionVersion,
} from "../src/lib/pool-agreement";
import { createPoolAgreementPdf } from "../src/lib/server-pool-agreement";
import type {
  AuditEvent,
  Championship,
  PredictionCategory,
  PredictionSubmission,
} from "../src/types/championship";

afterEach(() => {
  delete process.env.FAN_PICKS_TEST_NOW;
});

const championBet: PredictionCategory = {
  id: "champion",
  name: "Champion",
  prompt: "Pick the tournament winner.",
  scoringNote: "Bragging rights.",
  selectionCount: 1,
  source: "default",
  type: "single-team",
};

const topFourBet: PredictionCategory = {
  id: "top-4",
  name: "Top 4 teams",
  prompt: "Pick semifinalists.",
  scoringNote: "One point each.",
  selectionCount: 4,
  source: "default",
  type: "multi-team",
};

function makeChampionship(
  overrides: Partial<Championship> = {},
): Championship {
  return {
    auditLog: [
      makeAuditEvent("pool_created"),
      makeAuditEvent("participant_joined"),
      makeAuditEvent("prediction_draft_saved"),
      makeAuditEvent("prediction_locked"),
    ],
    bets: [championBet, topFourBet],
    createdAt: "2026-06-01T10:00:00.000Z",
    creatorProfileId: "profile-creator",
    id: "pool-1",
    inviteCode: "FP-TEST1",
    isPublic: false,
    lockDate: "2026-06-10",
    name: "Office Pool",
    participants: [
      {
        displayName: "Asha",
        handle: "asha",
        id: "participant-1",
        joinedAt: "2026-06-01T10:00:00.000Z",
        lockedStatus: "locked",
        profileId: "profile-creator",
        role: "creator",
        submissionStatus: "submitted",
      },
      {
        displayName: "Dev",
        handle: "dev",
        id: "participant-2",
        joinedAt: "2026-06-02T10:00:00.000Z",
        lockedStatus: "unlocked",
        profileId: "profile-dev",
        role: "participant",
        submissionStatus: "draft",
      },
      {
        displayName: "Left User",
        handle: "left",
        id: "participant-3",
        joinedAt: "2026-06-03T10:00:00.000Z",
        leftAt: "2026-06-04T10:00:00.000Z",
        lockedStatus: "unlocked",
        profileId: "profile-left",
        role: "participant",
        submissionStatus: "draft",
      },
    ],
    predictions: [
      makeSubmission({
        lockedVersionId: "v1",
        profileId: "profile-creator",
        versions: [
          {
            createdAt: "2026-06-05T10:00:00.000Z",
            id: "v1",
            picks: {
              champion: ["Brazil"],
              "top-4": ["Brazil", "Argentina", "France", "England"],
            },
            versionNumber: 1,
          },
          {
            createdAt: "2026-06-06T10:00:00.000Z",
            id: "v2",
            picks: {
              champion: ["France"],
              "top-4": ["Brazil", "Argentina", "France", "Spain"],
            },
            versionNumber: 2,
          },
        ],
      }),
      makeSubmission({
        profileId: "profile-dev",
        versions: [
          {
            createdAt: "2026-06-06T10:00:00.000Z",
            id: "v3",
            picks: {
              champion: ["Argentina"],
              "top-4": ["Argentina", "Germany", "Spain", "Uruguay"],
            },
            versionNumber: 1,
          },
        ],
      }),
    ],
    slug: "office-pool",
    startDate: "2026-06-11",
    status: "open",
    templateId: "fifa-world-cup-2026",
    tournamentId: "fifa-world-cup-2026",
    ...overrides,
  };
}

function makeSubmission(
  overrides: Partial<PredictionSubmission> = {},
): PredictionSubmission {
  return {
    displayName: "Asha",
    id: "submission-1",
    participantId: "participant-1",
    profileId: "profile-creator",
    versions: [],
    ...overrides,
  };
}

function makeAuditEvent(type: AuditEvent["type"]): AuditEvent {
  return {
    actorName: "Asha",
    details: type,
    id: `audit-${type}`,
    label: type,
    timestamp: "2026-06-01T10:00:00.000Z",
    type,
  };
}

describe("pool agreement rules", () => {
  test("creates a recognizable agreement id from invite code and lock date", () => {
    assert.equal(createPoolAgreementId("FP-ABC123", "2026-06-10"), "FPA-FP-ABC123-20260610");
  });

  test("draft agreements hide every participant's picks", () => {
    process.env.FAN_PICKS_TEST_NOW = "2026-06-10T18:29:58.000Z";

    const agreement = createAgreementPreviewModel({
      championship: makeChampionship(),
      generatedAt: "2026-06-10T18:00:00.000Z",
      tournamentName: "FIFA World Cup 2026",
    });

    assert.equal(agreement.status, "draft");
    assert.equal(agreement.isSealed, false);
    assert.deepEqual(agreement.picks, []);
  });

  test("sealed agreements include active participants' final saved picks", () => {
    process.env.FAN_PICKS_TEST_NOW = "2026-06-10T18:30:00.000Z";

    const agreement = createAgreementPreviewModel({
      championship: makeChampionship(),
      generatedAt: "2026-06-10T18:30:00.000Z",
      tournamentName: "FIFA World Cup 2026",
    });

    assert.equal(agreement.status, "sealed");
    assert.equal(agreement.isSealed, true);
    assert.equal(agreement.picks.length, 4);
    assert.equal(
      agreement.picks.find(
        (pick) => pick.profileId === "profile-creator" && pick.betId === "champion",
      )?.selectedOptions[0],
      "Brazil",
      "locked submissions use the locked version, not a later draft",
    );
    assert.equal(
      agreement.picks.find(
        (pick) => pick.profileId === "profile-dev" && pick.betId === "champion",
      )?.selectedOptions[0],
      "Argentina",
      "unlocked submissions use latest saved draft after deadline",
    );
    assert.equal(
      agreement.picks.some((pick) => pick.profileId === "profile-left"),
      false,
      "left participants are not included in recorded picks",
    );
  });

  test("participants include left users for transparency but mark them left", () => {
    process.env.FAN_PICKS_TEST_NOW = "2026-06-10T18:30:00.000Z";

    const agreement = createAgreementPreviewModel({
      championship: makeChampionship(),
      generatedAt: "2026-06-10T18:30:00.000Z",
      tournamentName: "FIFA World Cup 2026",
    });

    assert.equal(agreement.participants.length, 3);
    assert.equal(
      agreement.participants.find((participant) => participant.profileId === "profile-left")?.status,
      "left",
    );
  });

  test("fingerprint changes when sealed picks change", () => {
    process.env.FAN_PICKS_TEST_NOW = "2026-06-10T18:30:00.000Z";

    const first = createAgreementPreviewModel({
      championship: makeChampionship(),
      generatedAt: "2026-06-10T18:30:00.000Z",
      tournamentName: "FIFA World Cup 2026",
    });
    const second = createAgreementPreviewModel({
      championship: makeChampionship({
        predictions: [
          makeSubmission({
            profileId: "profile-dev",
            versions: [
              {
                createdAt: "2026-06-06T10:00:00.000Z",
                id: "changed",
                picks: { champion: ["Germany"], "top-4": ["Germany"] },
                versionNumber: 1,
              },
            ],
          }),
        ],
      }),
      generatedAt: "2026-06-10T18:30:00.000Z",
      tournamentName: "FIFA World Cup 2026",
    });

    assert.notEqual(first.fingerprint, second.fingerprint);
  });

  test("getFinalPredictionVersion prefers locked version over latest draft", () => {
    const submission = makeChampionship().predictions[0];
    const version = getFinalPredictionVersion(submission);

    assert.equal(version?.id, "v1");
  });

  test("agreement PDF keeps the default agreement layout to two pages", async () => {
    process.env.FAN_PICKS_TEST_NOW = "2026-06-10T18:30:00.000Z";

    const agreement = createAgreementPreviewModel({
      championship: makeChampionship(),
      generatedAt: "2026-06-10T18:30:00.000Z",
      tournamentName: "FIFA World Cup 2026",
    });
    const pdf = await createPoolAgreementPdf(agreement);
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;

    assert.equal(pageCount, 2);
  });
});
