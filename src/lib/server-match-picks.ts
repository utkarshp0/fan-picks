import { randomUUID } from "node:crypto";

import {
  createMatchPickFingerprint,
  createMatchPickRoomName,
  evaluateMatchPickAnswer,
  getComputedMatchPickStatus,
  getFixtureOutcomeLabel,
  getMatchPickLockAt,
  getWinnerMessage,
  isPastMatchPickLock,
  matchPickTypes,
  normalizeMatchPickAnswer,
  validateMatchPickAnswer,
} from "@/lib/match-pick-rules";
import { getAppNow, getAppNowIso } from "@/lib/app-clock";
import { createSupabaseServiceClient } from "@/lib/supabase-server";
import type {
  MatchPickAnswer,
  MatchPickAuditEvent,
  MatchPickFixtureOption,
  MatchPickParticipant,
  MatchPickResultSummary,
  MatchPickRoom,
  MatchPickRoomStatus,
  MatchPickSubmission,
  MatchPickType,
  MatchPickVersion,
} from "@/types/match-picks";
import type { SportsFixture } from "@/types/sports-data";

type ActionResult<T = unknown> =
  | ({ ok: true; message: string } & T)
  | { ok: false; message: string; status: number };

type AuthContext = {
  displayName: string;
  handle: string;
  userId: string;
};

type DbFixture = {
  away_score?: number | null;
  away_team_id?: string | null;
  away_team_name: string;
  home_score?: number | null;
  home_team_id?: string | null;
  home_team_name: string;
  id: string;
  kickoff_utc?: string | null;
  last_synced_at?: string | null;
  league: string;
  provider_match_id: string;
  raw: Record<string, unknown>;
  sport: string;
  status: string;
  tournament_id: string;
};

type DbRoom = {
  created_at: string;
  created_by: string;
  fixture_id: string;
  id: string;
  invite_code: string;
  kickoff_at: string;
  lock_at: string;
  name: string;
  pick_type: MatchPickType;
  status: MatchPickRoomStatus;
  tournament_id: string;
  sports_fixtures?: DbFixture | null;
  match_pick_participants?: DbParticipant[];
  match_pick_submissions?: DbSubmission[];
  match_pick_audit_events?: DbAuditEvent[];
};

type DbParticipant = {
  display_name: string;
  handle: string;
  id: string;
  joined_at: string;
  left_at?: string | null;
  profile_id: string;
  role: "creator" | "participant";
};

type DbSubmission = {
  display_name: string;
  fingerprint?: string | null;
  id: string;
  last_edited_at?: string | null;
  locked_at?: string | null;
  locked_version_id?: string | null;
  participant_id: string;
  profile_id: string;
  result_status: "pending" | "correct" | "incorrect" | "void";
  match_pick_versions?: DbVersion[];
};

type DbVersion = {
  answer: MatchPickAnswer;
  created_at: string;
  id: string;
  version_number: number;
};

type DbAuditEvent = {
  actor_name: string;
  created_at: string;
  details: string;
  id: string;
  label: string;
  type: MatchPickAuditEvent["type"] | string;
};

export async function getUpcomingMatchPickFixtures(
  tournamentId = "fifa-world-cup-2026",
  now = getAppNow(),
): Promise<MatchPickFixtureOption[]> {
  const supabase = createSupabaseServiceClient();
  const nowIso = now.toISOString();
  const until = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const baseQuery = () =>
    supabase
      .from("sports_fixtures")
      .select("*")
      .eq("tournament_id", tournamentId)
      .not("kickoff_utc", "is", null)
      .gte("kickoff_utc", nowIso)
      .order("kickoff_utc", { ascending: true });
  const { data, error } = await baseQuery().lte("kickoff_utc", until);

  if (error) {
    throw new Error(error.message);
  }

  let fixtures = (data ?? []) as DbFixture[];

  if (fixtures.length === 0) {
    const fallback = await baseQuery().limit(6);

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    fixtures = (fallback.data ?? []) as DbFixture[];
  }

  return fixtures.map((fixture) => {
    const mapped = mapFixtureFromDb(fixture);

    return {
      fixture: mapped,
      kickoffLabel: formatIst(mapped.kickoffUtc),
      lockLabel: mapped.kickoffUtc ? formatIst(getMatchPickLockAt(mapped.kickoffUtc)) : "TBD",
    };
  });
}

export async function listMatchPickRooms(accessToken: string) {
  const auth = await authenticate(accessToken);

  if (!auth.ok) {
    return auth;
  }

  const supabase = createSupabaseServiceClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("match_pick_participants")
    .select("room_id")
    .eq("profile_id", auth.userId)
    .is("left_at", null);

  if (membershipError) {
    return { ok: false as const, message: membershipError.message, status: 400 };
  }

  const roomIds = [...new Set((memberships ?? []).map((row) => row.room_id as string))];

  if (roomIds.length === 0) {
    return { ok: true as const, message: "Rooms loaded.", rooms: [] as MatchPickRoom[] };
  }

  const rooms = await fetchRoomsByIds(roomIds, auth.userId);

  return { ok: true as const, message: "Rooms loaded.", rooms };
}

export async function getMatchPickRoom(accessToken: string, roomId: string) {
  const auth = await authenticate(accessToken);

  if (!auth.ok) {
    return auth;
  }

  const room = await fetchRoomById(roomId, auth.userId);

  if (!room) {
    return { ok: false as const, message: "Match Pick room not found.", status: 404 };
  }

  if (!room.participants.some((participant) => participant.profileId === auth.userId && !participant.leftAt)) {
    return { ok: false as const, message: "Join this room first.", status: 403 };
  }

  return { ok: true as const, message: "Room loaded.", room };
}

export async function createMatchPickRoom(
  accessToken: string,
  input: { fixtureId?: string; pickType?: string },
): Promise<ActionResult<{ room: MatchPickRoom }>> {
  const auth = await authenticate(accessToken);

  if (!auth.ok) {
    return auth;
  }

  const pickType = input.pickType as MatchPickType;

  if (!matchPickTypes.includes(pickType)) {
    return { ok: false, message: "Choose a valid pick type.", status: 400 };
  }

  const supabase = createSupabaseServiceClient();
  const { data: fixtureRow, error: fixtureError } = await supabase
    .from("sports_fixtures")
    .select("*")
    .eq("id", String(input.fixtureId ?? ""))
    .maybeSingle();

  if (fixtureError) {
    return { ok: false, message: fixtureError.message, status: 400 };
  }

  if (!fixtureRow) {
    return { ok: false, message: "Choose an upcoming fixture.", status: 404 };
  }

  const fixture = mapFixtureFromDb(fixtureRow as DbFixture);

  if (!fixture.kickoffUtc) {
    return { ok: false, message: "This fixture does not have a kickoff time yet.", status: 400 };
  }

  const lockAt = getMatchPickLockAt(fixture.kickoffUtc);

  if (isPastMatchPickLock(lockAt, getAppNow())) {
    return { ok: false, message: "This match is already locked.", status: 400 };
  }

  const now = getAppNowIso();
  const roomId = randomUUID();
  const participantId = randomUUID();
  const inviteCode = createInviteCode();
  const name = createMatchPickRoomName(fixture, pickType);

  const { error: roomError } = await supabase.from("match_pick_rooms").insert({
    id: roomId,
    tournament_id: fixture.tournamentId,
    fixture_id: fixture.id,
    pick_type: pickType,
    name,
    invite_code: inviteCode,
    status: "open",
    kickoff_at: fixture.kickoffUtc,
    lock_at: lockAt,
    created_by: auth.userId,
    created_at: now,
  });

  if (roomError) {
    return { ok: false, message: roomError.message, status: 400 };
  }

  const { error: participantError } = await supabase
    .from("match_pick_participants")
    .insert({
      id: participantId,
      room_id: roomId,
      profile_id: auth.userId,
      display_name: auth.displayName,
      handle: auth.handle,
      role: "creator",
      joined_at: now,
    });

  if (participantError) {
    return { ok: false, message: participantError.message, status: 400 };
  }

  await insertAuditEvents(roomId, [
    createAuditEvent("room_created", auth.displayName, `${auth.displayName} created ${name}.`, now),
    createAuditEvent("invite_created", auth.displayName, `Invite code ${inviteCode} is ready to share.`, now),
  ]);

  const room = await fetchRoomById(roomId, auth.userId);

  if (!room) {
    return { ok: false, message: "Room created but could not be loaded.", status: 400 };
  }

  return { ok: true, message: "Match Pick room created.", room };
}

export async function joinMatchPickRoom(
  accessToken: string,
  inviteCodeInput: string,
): Promise<ActionResult<{ room: MatchPickRoom }>> {
  const auth = await authenticate(accessToken);

  if (!auth.ok) {
    return auth;
  }

  const inviteCode = normalizeInviteCode(inviteCodeInput);
  const supabase = createSupabaseServiceClient();
  const { data: roomRow, error } = await supabase
    .from("match_pick_rooms")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message, status: 400 };
  }

  if (!roomRow) {
    return { ok: false, message: "No Match Pick room found for that code.", status: 404 };
  }

  const roomId = roomRow.id as string;
  const now = getAppNowIso();
  const { data: existing } = await supabase
    .from("match_pick_participants")
    .select("id, role")
    .eq("room_id", roomId)
    .eq("profile_id", auth.userId)
    .maybeSingle();
  const participantId = (existing?.id as string | undefined) ?? randomUUID();

  const { error: participantError } = await supabase
    .from("match_pick_participants")
    .upsert(
      {
        id: participantId,
        room_id: roomId,
        profile_id: auth.userId,
        display_name: auth.displayName,
        handle: auth.handle,
        role: (existing?.role as string | undefined) ?? "participant",
        joined_at: now,
        left_at: null,
      },
      { onConflict: "room_id,profile_id" },
    );

  if (participantError) {
    return { ok: false, message: participantError.message, status: 400 };
  }

  if (!existing) {
    await insertAuditEvents(roomId, [
      createAuditEvent("participant_joined", auth.displayName, `${auth.displayName} joined this Match Pick room.`, now),
    ]);
  }

  const room = await fetchRoomById(roomId, auth.userId);

  if (!room) {
    return { ok: false, message: "Room joined but could not be loaded.", status: 400 };
  }

  return { ok: true, message: `${auth.displayName} joined ${room.name}.`, room };
}

export async function leaveMatchPickRoom(
  accessToken: string,
  roomId: string,
): Promise<ActionResult> {
  const auth = await authenticate(accessToken);

  if (!auth.ok) {
    return auth;
  }

  const supabase = createSupabaseServiceClient();
  const { data: participant, error: participantFetchError } = await supabase
    .from("match_pick_participants")
    .select("id")
    .eq("room_id", roomId)
    .eq("profile_id", auth.userId)
    .is("left_at", null)
    .maybeSingle();

  if (participantFetchError) {
    return { ok: false, message: participantFetchError.message, status: 400 };
  }

  if (!participant) {
    return { ok: false, message: "You are not in this Match Pick room.", status: 404 };
  }

  const now = getAppNowIso();
  const { error: participantUpdateError } = await supabase
    .from("match_pick_participants")
    .update({ left_at: now })
    .eq("id", participant.id as string);

  if (participantUpdateError) {
    return { ok: false, message: participantUpdateError.message, status: 400 };
  }

  await insertAuditEvents(roomId, [
    createAuditEvent("participant_left", auth.displayName, `${auth.displayName} left this Match Pick room.`, now),
  ]);

  return { ok: true, message: "Left Match Pick room." };
}

export async function saveMatchPickAnswer(
  accessToken: string,
  roomId: string,
  answerInput: unknown,
): Promise<ActionResult<{ room: MatchPickRoom }>> {
  const auth = await authenticate(accessToken);

  if (!auth.ok) {
    return auth;
  }

  const room = await fetchRoomById(roomId, auth.userId, { includeHidden: true });

  if (!room) {
    return { ok: false, message: "Match Pick room not found.", status: 404 };
  }

  const participant = room.participants.find(
    (item) => item.profileId === auth.userId && !item.leftAt,
  );

  if (!participant) {
    return { ok: false, message: "Join this room before saving picks.", status: 403 };
  }

  if (isPastMatchPickLock(room.lockAt, getAppNow())) {
    return {
      ok: false,
      message: `Picks locked at ${formatIst(room.lockAt)}.`,
      status: 400,
    };
  }

  const validation = validateMatchPickAnswer(room.pickType, answerInput);

  if (!validation.answer) {
    return { ok: false, message: validation.message, status: 400 };
  }

  const supabase = createSupabaseServiceClient();
  const now = getAppNowIso();
  const existingSubmission = room.submissions.find(
    (submission) => submission.profileId === auth.userId,
  );
  const submissionId = existingSubmission?.id ?? randomUUID();
  const versionNumber = (existingSubmission?.versions.length ?? 0) + 1;
  const versionId = randomUUID();
  const fingerprint = createMatchPickFingerprint({
    answer: validation.answer,
    roomId,
    versionId,
    versionNumber,
  });

  const { error: submissionError } = await supabase
    .from("match_pick_submissions")
    .upsert(
      {
        id: submissionId,
        room_id: roomId,
        participant_id: participant.id,
        profile_id: auth.userId,
        display_name: auth.displayName,
        fingerprint,
        result_status: "pending",
        last_edited_at: now,
        updated_at: now,
      },
      { onConflict: "room_id,profile_id" },
    );

  if (submissionError) {
    return { ok: false, message: submissionError.message, status: 400 };
  }

  const { error: versionError } = await supabase
    .from("match_pick_versions")
    .insert({
      id: versionId,
      submission_id: submissionId,
      version_number: versionNumber,
      answer: validation.answer,
      created_at: now,
    });

  if (versionError) {
    return { ok: false, message: versionError.message, status: 400 };
  }

  await insertAuditEvents(roomId, [
    createAuditEvent("pick_saved", auth.displayName, `${auth.displayName} saved pick version ${versionNumber}.`, now),
    ...(hasAnswerChanged(existingSubmission?.versions.at(-1)?.answer, validation.answer)
      ? [createAuditEvent("pick_changed", auth.displayName, `${auth.displayName} changed their ${room.name} pick.`, now)]
      : []),
  ]);

  const updatedRoom = await fetchRoomById(roomId, auth.userId);

  if (!updatedRoom) {
    return { ok: false, message: "Pick saved but room could not be loaded.", status: 400 };
  }

  return { ok: true, message: "Pick saved.", room: updatedRoom };
}

export async function scoreMatchPickRoom(
  accessToken: string,
  roomId: string,
): Promise<ActionResult<{ room: MatchPickRoom }>> {
  const auth = await authenticate(accessToken);

  if (!auth.ok) {
    return auth;
  }

  const room = await fetchRoomById(roomId, auth.userId, { includeHidden: true });

  if (!room) {
    return { ok: false, message: "Match Pick room not found.", status: 404 };
  }

  if (!room.participants.some((participant) => participant.profileId === auth.userId && !participant.leftAt)) {
    return { ok: false, message: "Join this room first.", status: 403 };
  }

  if (room.status !== "finished" && room.status !== "scored") {
    return { ok: false, message: "The match is not finished yet.", status: 400 };
  }

  const supabase = createSupabaseServiceClient();
  const now = getAppNowIso();
  const updates = room.submissions.map((submission) => ({
    id: submission.id,
    result_status: evaluateMatchPickAnswer(
      room.pickType,
      submission.versions.at(-1)?.answer,
      room.fixture,
    ),
    scored_at: now,
    updated_at: now,
  }));

  if (updates.length > 0) {
    const { error } = await supabase
      .from("match_pick_submissions")
      .upsert(updates, { onConflict: "id" });

    if (error) {
      return { ok: false, message: error.message, status: 400 };
    }
  }

  await supabase
    .from("match_pick_rooms")
    .update({ status: "scored" })
    .eq("id", roomId);
  await insertAuditEvents(roomId, [
    createAuditEvent("room_scored", auth.displayName, `${room.name} was scored from the final result.`, now),
  ]);

  const updatedRoom = await fetchRoomById(roomId, auth.userId);

  if (!updatedRoom) {
    return { ok: false, message: "Room scored but could not be loaded.", status: 400 };
  }

  return { ok: true, message: "Room scored.", room: updatedRoom };
}

async function authenticate(
  accessToken: string,
): Promise<
  | ({ ok: true } & AuthContext)
  | { ok: false; message: string; status: number }
> {
  if (!accessToken) {
    return { ok: false, message: "Login required.", status: 401 };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return { ok: false, message: "Login required.", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    ok: true,
    displayName: String(profile?.display_name ?? data.user.user_metadata?.display_name ?? "Fan"),
    handle: String(profile?.handle ?? data.user.user_metadata?.username ?? "fan"),
    userId: data.user.id,
  };
}

async function fetchRoomsByIds(roomIds: string[], viewerProfileId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("match_pick_rooms")
    .select(matchPickRoomSelect)
    .in("id", roomIds)
    .order("kickoff_at", { ascending: true });

  if (error || !data) {
    return [] as MatchPickRoom[];
  }

  return (data as DbRoom[]).map((row) => mapRoomFromDb(row, viewerProfileId));
}

async function fetchRoomById(
  roomId: string,
  viewerProfileId: string,
  options: { includeHidden?: boolean } = {},
) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("match_pick_rooms")
    .select(matchPickRoomSelect)
    .eq("id", roomId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRoomFromDb(data as DbRoom, viewerProfileId, options);
}

export const matchPickRoomSelect =
  "*, sports_fixtures(*), match_pick_participants(*), match_pick_submissions(*, match_pick_versions!match_pick_versions_submission_id_fkey(*)), match_pick_audit_events(*)";

function mapRoomFromDb(
  row: DbRoom,
  viewerProfileId: string,
  options: { includeHidden?: boolean } = {},
): MatchPickRoom {
  const fixture = mapFixtureFromDb(row.sports_fixtures as DbFixture);
  const status = getComputedMatchPickStatus(fixture, row.lock_at, row.status);
  const canSeeAllSubmissions =
    options.includeHidden || isPastMatchPickLock(row.lock_at, getAppNow());
  const submissions = (row.match_pick_submissions ?? [])
    .filter((submission) => canSeeAllSubmissions || submission.profile_id === viewerProfileId)
    .map(mapSubmissionFromDb);
  const resultSummary = buildResultSummary(row.pick_type, fixture, submissions);

  return {
    id: row.id,
    auditLog: (row.match_pick_audit_events ?? [])
      .map(mapAuditEventFromDb)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    createdAt: row.created_at,
    creatorProfileId: row.created_by,
    fixture,
    fixtureId: row.fixture_id,
    inviteCode: row.invite_code,
    kickoffAt: row.kickoff_at,
    lockAt: row.lock_at,
    name: row.name,
    participants: (row.match_pick_participants ?? []).map(mapParticipantFromDb),
    pickType: row.pick_type,
    resultSummary,
    status,
    submissions,
    tournamentId: row.tournament_id,
  };
}

function buildResultSummary(
  pickType: MatchPickType,
  fixture: SportsFixture,
  submissions: MatchPickSubmission[],
): MatchPickResultSummary | undefined {
  if (!submissions.length) {
    return undefined;
  }

  const evaluated = submissions.map((submission) => ({
    displayName: submission.displayName,
    profileId: submission.profileId,
    status:
      submission.resultStatus === "pending"
        ? evaluateMatchPickAnswer(pickType, submission.versions.at(-1)?.answer, fixture)
        : submission.resultStatus,
  }));
  const winners = evaluated
    .filter((item) => item.status === "correct")
    .map((item) => item.displayName);

  return {
    correctProfileIds: evaluated
      .filter((item) => item.status === "correct")
      .map((item) => item.profileId),
    message: getWinnerMessage(winners, pickType),
    outcomeLabel: getFixtureOutcomeLabel(fixture),
    winners,
  };
}

function mapFixtureFromDb(row: DbFixture): SportsFixture {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    providerMatchId: row.provider_match_id,
    sport: row.sport,
    league: row.league,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    homeTeamId: row.home_team_id ?? undefined,
    awayTeamId: row.away_team_id ?? undefined,
    kickoffUtc: row.kickoff_utc ?? undefined,
    status: row.status,
    homeScore: row.home_score ?? undefined,
    awayScore: row.away_score ?? undefined,
    raw: row.raw,
    lastSyncedAt: row.last_synced_at ?? undefined,
  };
}

function mapParticipantFromDb(row: DbParticipant): MatchPickParticipant {
  return {
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name,
    handle: row.handle,
    role: row.role,
    joinedAt: row.joined_at,
    leftAt: row.left_at ?? undefined,
  };
}

function mapSubmissionFromDb(row: DbSubmission): MatchPickSubmission {
  return {
    id: row.id,
    participantId: row.participant_id,
    profileId: row.profile_id,
    displayName: row.display_name,
    versions: (row.match_pick_versions ?? [])
      .map(mapVersionFromDb)
      .sort((a, b) => a.versionNumber - b.versionNumber),
    fingerprint: row.fingerprint ?? undefined,
    lastEditedAt: row.last_edited_at ?? undefined,
    lockedAt: row.locked_at ?? undefined,
    lockedVersionId: row.locked_version_id ?? undefined,
    resultStatus: row.result_status,
  };
}

function mapVersionFromDb(row: DbVersion): MatchPickVersion {
  return {
    id: row.id,
    answer: normalizeMatchPickAnswer(row.answer) ?? row.answer,
    createdAt: row.created_at,
    versionNumber: row.version_number,
  };
}

function mapAuditEventFromDb(row: DbAuditEvent): MatchPickAuditEvent {
  return {
    id: row.id,
    actorName: row.actor_name,
    createdAt: row.created_at,
    details: row.details,
    label: row.label,
    type: normalizeAuditType(row.type),
  };
}

function normalizeAuditType(type: string): MatchPickAuditEvent["type"] {
  if (
    type === "room_created" ||
    type === "invite_created" ||
    type === "participant_joined" ||
    type === "participant_left" ||
    type === "pick_changed" ||
    type === "pick_saved" ||
    type === "pick_locked" ||
    type === "room_scored"
  ) {
    return type;
  }

  return "pick_saved";
}

function createAuditEvent(
  type: MatchPickAuditEvent["type"],
  actorName: string,
  details: string,
  createdAt: string,
) {
  return {
    id: randomUUID(),
    type,
    label: getAuditLabel(type),
    actor_name: actorName,
    details,
    created_at: createdAt,
  };
}

async function insertAuditEvents(
  roomId: string,
  events: ReturnType<typeof createAuditEvent>[],
) {
  if (!events.length) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  await supabase.from("match_pick_audit_events").insert(
    events.map((event) => ({
      ...event,
      room_id: roomId,
    })),
  );
}

function getAuditLabel(type: MatchPickAuditEvent["type"]) {
  if (type === "room_created") return "Room created";
  if (type === "invite_created") return "Invite created";
  if (type === "participant_joined") return "Participant joined";
  if (type === "participant_left") return "Participant left";
  if (type === "pick_changed") return "Pick changed";
  if (type === "pick_locked") return "Pick locked";
  if (type === "room_scored") return "Room scored";
  return "Pick saved";
}

function createInviteCode() {
  return `MP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function hasAnswerChanged(
  previous: MatchPickAnswer | undefined,
  next: MatchPickAnswer,
) {
  return JSON.stringify(previous ?? null) !== JSON.stringify(next);
}

function formatIst(value?: string) {
  if (!value) {
    return "TBD";
  }

  return `${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value))} IST`;
}
