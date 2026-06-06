import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  lockTestScenarioIds,
  lockTestUsers,
} from "../src/data/lock-test-scenarios";

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type SeedUser = (typeof lockTestUsers)[number] & { id: string };

const now = "2026-06-01T09:00:00.000Z";
const lockedAt = "2026-06-02T09:00:00.000Z";

async function main() {
  const users = await seedUsers();

  await seedSportsFixtures();
  await seedPools(users);
  await seedMatchPickRooms(users);

  console.log("Seeded Fan Picks lock test users and scenarios:");
  for (const user of users) {
    console.log(`- ${user.username} / ${user.password}`);
  }
}

async function seedUsers() {
  const created: SeedUser[] = [];

  for (const testUser of lockTestUsers) {
    const existing = await findAuthUserByEmail(testUser.email);
    const user =
      existing ??
      (
        await supabase.auth.admin.createUser({
          email: testUser.email,
          email_confirm: true,
          password: testUser.password,
          user_metadata: {
            display_name: testUser.displayName,
            username: testUser.username,
          },
        })
      ).data.user;

    if (!user) {
      throw new Error(`Could not create ${testUser.email}.`);
    }

    await supabase.auth.admin.updateUserById(user.id, {
      password: testUser.password,
      user_metadata: {
        display_name: testUser.displayName,
        username: testUser.username,
      },
    });

    await assertOk(
      supabase.from("profiles").upsert(
        {
          id: user.id,
          display_name: testUser.displayName,
          handle: testUser.handle,
          created_at: now,
          last_seen_at: now,
        },
        { onConflict: "id" },
      ),
      `profile upsert for ${testUser.username}`,
    );

    created.push({ ...testUser, id: user.id });
  }

  return created;
}

async function findAuthUserByEmail(email: string) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const match = data.users.find((user) => user.email === email);

    if (match) {
      return match;
    }

    if (data.users.length < 100) {
      return null;
    }

    page += 1;
  }
}

async function seedSportsFixtures() {
  await assertOk(
    supabase.from("sports_tournaments").upsert(
      {
        id: lockTestScenarioIds.tournament,
        provider: "fan-picks-test",
        provider_league_id: "lock-test",
        sport: "football",
        league: "Fan Picks Lock Test Cup",
        name: "Fan Picks Lock Test Cup",
        season: "2026",
        start_date: "2026-06-01",
        end_date: "2026-06-12",
        match_count: 3,
        team_count: 6,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: "id" },
    ),
    "sports tournament upsert",
  );

  await assertOk(
    supabase.from("sports_fixtures").upsert(
      [
        {
          id: lockTestScenarioIds.activeFixture,
          tournament_id: lockTestScenarioIds.tournament,
          provider_match_id: "lock-test-active",
          sport: "football",
          league: "Fan Picks Lock Test Cup",
          home_team_name: "Clock City",
          away_team_name: "Future FC",
          kickoff_utc: "2099-06-11T19:00:00.000Z",
          status: "upcoming",
          raw: { testScenario: "before-lock" },
          last_synced_at: now,
          updated_at: now,
        },
        {
          id: lockTestScenarioIds.lockedFixture,
          tournament_id: lockTestScenarioIds.tournament,
          provider_match_id: "lock-test-locked",
          sport: "football",
          league: "Fan Picks Lock Test Cup",
          home_team_name: "Deadline United",
          away_team_name: "Late FC",
          kickoff_utc: "2026-06-05T12:00:00.000Z",
          status: "upcoming",
          raw: { testScenario: "after-lock" },
          last_synced_at: now,
          updated_at: now,
        },
        {
          id: lockTestScenarioIds.scoredFixture,
          tournament_id: lockTestScenarioIds.tournament,
          provider_match_id: "lock-test-scored",
          sport: "football",
          league: "Fan Picks Lock Test Cup",
          home_team_name: "Receipt Rovers",
          away_team_name: "Chaos Athletic",
          kickoff_utc: "2026-06-04T12:00:00.000Z",
          status: "finished",
          home_score: 2,
          away_score: 1,
          raw: { testScenario: "scored" },
          last_synced_at: now,
          updated_at: now,
        },
      ],
      { onConflict: "id" },
    ),
    "sports fixture upsert",
  );
}

async function seedPools(users: SeedUser[]) {
  const [creator, friend] = users;
  const pools = [
    {
      id: lockTestScenarioIds.activePool,
      inviteCode: "FP-LOCK-ACTIVE",
      lockDate: "2099-12-31",
      name: "Lock Test Active Pool",
      slug: "lock-test-active-pool",
      status: "open",
    },
    {
      id: lockTestScenarioIds.lockedPool,
      inviteCode: "FP-LOCK-PAST",
      lockDate: "2026-06-01",
      name: "Lock Test Past Pool",
      slug: "lock-test-past-pool",
      status: "locked",
    },
  ];

  await assertOk(
    supabase.from("championships").upsert(
      pools.map((pool) => ({
        id: pool.id,
        template_id: "fifa-world-cup-2026",
        name: pool.name,
        slug: pool.slug,
        invite_code: pool.inviteCode,
        status: pool.status,
        start_date: "2026-06-11",
        lock_date: pool.lockDate,
        is_public: false,
        created_by: creator.id,
        created_at: now,
      })),
      { onConflict: "id" },
    ),
    "pool upsert",
  );

  const participants = pools.flatMap((pool, poolIndex) =>
    [creator, friend].map((user, userIndex) => ({
      id: fixedUuid(1, poolIndex, userIndex),
      championship_id: pool.id,
      profile_id: user.id,
      display_name: user.displayName,
      handle: user.handle,
      role: userIndex === 0 ? "creator" : "participant",
      joined_at: now,
      left_at: null,
      rules_accepted_at: now,
      signed_at: now,
      submission_status: pool.id === lockTestScenarioIds.lockedPool ? "submitted" : "draft",
      locked_status: pool.id === lockTestScenarioIds.lockedPool ? "locked" : "unlocked",
    })),
  );

  await assertOk(
    supabase.from("participants").upsert(participants, {
      onConflict: "championship_id,profile_id",
    }),
    "pool participant upsert",
  );

  await assertOk(
    supabase.from("pool_bets").upsert(
      pools.map((pool) => ({
        championship_id: pool.id,
        bet_id: "champion",
        name: "Champion",
        type: "single-team",
        prompt: "Pick the tournament winner.",
        selection_count: 1,
        scoring_note: "Test lock scenario bet.",
        choices: ["Clock City", "Future FC", "Deadline United", "Late FC"],
        source: "default",
        sort_order: 0,
      })),
      { onConflict: "championship_id,bet_id" },
    ),
    "pool bet upsert",
  );

  for (const [poolIndex, pool] of pools.entries()) {
    for (const [userIndex, user] of users.entries()) {
      const participantId = fixedUuid(1, poolIndex, userIndex);
      const submissionId = fixedUuid(2, poolIndex, userIndex);
      const versionId = fixedUuid(3, poolIndex, userIndex);
      const isLocked = pool.id === lockTestScenarioIds.lockedPool;

      await assertOk(
        supabase.from("prediction_submissions").upsert(
          {
            id: submissionId,
            championship_id: pool.id,
            participant_id: participantId,
            profile_id: user.id,
            display_name: user.displayName,
            locked_version_id: null,
            locked_at: null,
            fingerprint: null,
            last_edited_at: now,
          },
          { onConflict: "championship_id,profile_id" },
        ),
        "prediction submission upsert",
      );

      await assertOk(
        supabase.from("prediction_versions").upsert(
          {
            id: versionId,
            submission_id: submissionId,
            version_number: 1,
            picks: { champion: [userIndex === 0 ? "Clock City" : "Future FC"] },
            created_at: now,
          },
          { onConflict: "submission_id,version_number" },
        ),
        "prediction version upsert",
      );

      if (isLocked) {
        await assertOk(
          supabase
            .from("prediction_submissions")
            .update({
              locked_version_id: versionId,
              locked_at: lockedAt,
              fingerprint: `test-fingerprint-${poolIndex}-${userIndex}`,
            })
            .eq("id", submissionId),
          "prediction submission lock update",
        );
      }
    }
  }
}

async function seedMatchPickRooms(users: SeedUser[]) {
  const [creator, friend] = users;
  const rooms = [
    {
      fixtureId: lockTestScenarioIds.activeFixture,
      id: lockTestScenarioIds.activeMatchPickRoom,
      inviteCode: "MP-LOCKACTIVE",
      kickoffAt: "2099-06-11T19:00:00.000Z",
      lockAt: "2099-06-11T17:00:00.000Z",
      name: "Clock City vs Future FC - Winner",
      status: "open",
    },
    {
      fixtureId: lockTestScenarioIds.lockedFixture,
      id: lockTestScenarioIds.lockedMatchPickRoom,
      inviteCode: "MP-LOCKPAST",
      kickoffAt: "2026-06-05T12:00:00.000Z",
      lockAt: "2026-06-05T10:00:00.000Z",
      name: "Deadline United vs Late FC - Winner",
      status: "open",
    },
    {
      fixtureId: lockTestScenarioIds.scoredFixture,
      id: lockTestScenarioIds.scoredMatchPickRoom,
      inviteCode: "MP-LOCKSCORE",
      kickoffAt: "2026-06-04T12:00:00.000Z",
      lockAt: "2026-06-04T10:00:00.000Z",
      name: "Receipt Rovers vs Chaos Athletic - Winner",
      status: "finished",
    },
  ];

  await assertOk(
    supabase.from("match_pick_rooms").upsert(
      rooms.map((room) => ({
        id: room.id,
        tournament_id: lockTestScenarioIds.tournament,
        fixture_id: room.fixtureId,
        pick_type: "winner",
        name: room.name,
        invite_code: room.inviteCode,
        status: room.status,
        kickoff_at: room.kickoffAt,
        lock_at: room.lockAt,
        created_by: creator.id,
        created_at: now,
      })),
      { onConflict: "id" },
    ),
    "match pick room upsert",
  );

  const participants = rooms.flatMap((room, roomIndex) =>
    [creator, friend].map((user, userIndex) => ({
      id: fixedUuid(4, roomIndex, userIndex),
      room_id: room.id,
      profile_id: user.id,
      display_name: user.displayName,
      handle: user.handle,
      role: userIndex === 0 ? "creator" : "participant",
      joined_at: now,
      left_at: null,
    })),
  );

  await assertOk(
    supabase.from("match_pick_participants").upsert(participants, {
      onConflict: "room_id,profile_id",
    }),
    "match pick participant upsert",
  );

  for (const [roomIndex, room] of rooms.entries()) {
    for (const [userIndex, user] of users.entries()) {
      const submissionId = fixedUuid(5, roomIndex, userIndex);
      const versionId = fixedUuid(6, roomIndex, userIndex);
      const isLocked = room.id !== lockTestScenarioIds.activeMatchPickRoom;

      await assertOk(
        supabase.from("match_pick_submissions").upsert(
          {
            id: submissionId,
            room_id: room.id,
            participant_id: fixedUuid(4, roomIndex, userIndex),
            profile_id: user.id,
            display_name: user.displayName,
            locked_version_id: null,
            locked_at: null,
            fingerprint: null,
            result_status: "pending",
            last_edited_at: now,
            updated_at: now,
          },
          { onConflict: "room_id,profile_id" },
        ),
        "match pick submission upsert",
      );

      await assertOk(
        supabase.from("match_pick_versions").upsert(
          {
            id: versionId,
            submission_id: submissionId,
            version_number: 1,
            answer: {
              type: "winner",
              value: userIndex === 0 ? "home" : "away",
            },
            created_at: now,
          },
          { onConflict: "submission_id,version_number" },
        ),
        "match pick version upsert",
      );

      if (isLocked) {
        await assertOk(
          supabase
            .from("match_pick_submissions")
            .update({
              locked_version_id: versionId,
              locked_at: lockedAt,
              fingerprint: `test-match-fingerprint-${roomIndex}-${userIndex}`,
            })
            .eq("id", submissionId),
          "match pick submission lock update",
        );
      }
    }
  }
}

async function assertOk<T>(
  promise: PromiseLike<{ error: { message: string } | null } & T>,
  label: string,
) {
  const result = await promise;

  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
}

function fixedUuid(group: number, scenario: number, user: number) {
  return `00000000-0000-4000-8000-${String(group).padStart(4, "0")}${String(scenario).padStart(4, "0")}${String(user).padStart(4, "0")}`;
}

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
