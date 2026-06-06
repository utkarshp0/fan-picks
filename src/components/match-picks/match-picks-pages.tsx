"use client";

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  LogOut,
  ListChecks,
  Lock,
  Plus,
  QrCode,
  Save,
  Share2,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { announceRouteStart } from "@/components/app/app-shell";
import { AppShell } from "@/components/app/app-shell";
import { useGuestSession } from "@/components/auth/guest-session-provider";
import { Button } from "@/components/ui/button";
import {
  createMatchPickRoom,
  fetchMatchPickFixtures,
  fetchMatchPickRoom,
  fetchMatchPickRooms,
  joinMatchPickRoom,
  leaveMatchPickRoom,
  saveMatchPickAnswer,
  scoreMatchPickRoom,
} from "@/lib/match-picks-client";
import {
  canLeaveMatchPickRoom,
  createMatchPickInviteMessage,
  getMatchPickInvitePath,
} from "@/lib/match-pick-rules";
import { cn } from "@/lib/utils";
import type {
  MatchPickAnswer,
  MatchPickFixtureOption,
  MatchPickRoom,
  MatchPickType,
} from "@/types/match-picks";

type RoomTab = "picks" | "participants" | "audit" | "results";

const pickTypes: Array<{ description: string; label: string; value: MatchPickType }> = [
  {
    description: "Pick the team name or draw.",
    label: "Winner",
    value: "winner",
  },
  {
    description: "Predict both team scores.",
    label: "Exact score",
    value: "exact_score",
  },
  {
    description: "Choose whether both teams score.",
    label: "Both teams score",
    value: "both_teams_score",
  },
];

export function MatchPicksListPage() {
  const { profile } = useGuestSession();
  const [rooms, setRooms] = useState<MatchPickRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leavingRoomId, setLeavingRoomId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRooms() {
      const result = await fetchMatchPickRooms();

      if (!isMounted) {
        return;
      }

      if (result.ok) {
        setRooms(result.rooms);
        setMessage("");
      } else {
        setMessage(result.message);
      }

      setIsLoading(false);
    }

    void loadRooms();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeRooms = rooms.filter((room) => room.status !== "scored");
  const completedRooms = rooms.filter((room) => room.status === "scored");
  async function handleLeave(roomId: string) {
    setLeavingRoomId(roomId);
    setMessage("");

    const result = await leaveMatchPickRoom(roomId);

    setLeavingRoomId("");

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setRooms((currentRooms) => currentRooms.filter((room) => room.id !== roomId));
    setMessage(result.message);
  }

  return (
    <AppShell>
      <div className="mx-auto grid max-w-6xl gap-5">
        <PageHero
          action={
            <div className="flex flex-wrap gap-2">
              <ActionLink href="/match-picks/create" icon={Plus} label="Create Match Pick" />
              <ActionLink href="/match-picks/join" icon={QrCode} label="Join with code" />
            </div>
          }
          eyebrow="Friendly one-match rooms"
          title="Match Picks"
        >
          Create a one-question room for an upcoming fixture, invite friends,
          and lock everyone&apos;s pick two hours before kickoff.
        </PageHero>

        {message ? <Notice tone={message.includes("Left") ? "success" : "warning"}>{message}</Notice> : null}

        <RoomSection
          emptyText={isLoading ? "Loading rooms..." : "No active Match Picks yet."}
          leavingRoomId={leavingRoomId}
          onLeave={handleLeave}
          profileId={profile?.id}
          rooms={activeRooms}
          title="Active Match Picks"
        />
        <RoomSection
          emptyText="Completed rooms will appear here after matches are scored."
          leavingRoomId={leavingRoomId}
          onLeave={handleLeave}
          profileId={profile?.id}
          rooms={completedRooms}
          title="Completed"
        />
      </div>
    </AppShell>
  );
}

export function MatchPickCreatePage() {
  const router = useRouter();
  const [fixtures, setFixtures] = useState<MatchPickFixtureOption[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [pickType, setPickType] = useState<MatchPickType>("winner");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadFixtures() {
      try {
        const nextFixtures = await fetchMatchPickFixtures();

        if (!isMounted) {
          return;
        }

        setFixtures(nextFixtures);
        setSelectedFixtureId(nextFixtures[0]?.fixture.id ?? "");
        setMessage("");
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Could not load fixtures.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadFixtures();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreate() {
    if (!selectedFixtureId) {
      setMessage("Choose a fixture.");
      return;
    }

    setIsCreating(true);
    setMessage("");

    const result = await createMatchPickRoom({
      fixtureId: selectedFixtureId,
      pickType,
    });

    setIsCreating(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const href = `/match-picks/${result.room.id}/picks`;
    announceRouteStart(href);
    router.push(href);
  }

  return (
    <AppShell>
      <div className="mx-auto grid max-w-6xl gap-5">
        <PageHero eyebrow="Next 3 days" title="Create Match Pick">
          Pick one upcoming fixture and one question. If there are no fixtures in
          the next three days, Fan Picks shows the next few available matches.
        </PageHero>

        {message ? <Notice tone="warning">{message}</Notice> : null}

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <SectionTitle count={fixtures.length} title="Upcoming fixtures" />
          {fixtures.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {fixtures.map((item) => (
                <FixtureSelectCard
                  item={item}
                  isSelected={item.fixture.id === selectedFixtureId}
                  key={item.fixture.id}
                  onSelect={() => setSelectedFixtureId(item.fixture.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState text={isLoading ? "Loading fixtures..." : "No upcoming fixtures found."} />
          )}
        </section>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <SectionTitle count={1} title="Pick question" />
          <div className="grid gap-3 md:grid-cols-3">
            {pickTypes.map((item) => (
              <button
                className={cn(
                  "rounded-lg border bg-surface-raised p-4 text-left transition-colors",
                  pickType === item.value
                    ? "border-accent"
                    : "border-border hover:border-accent/60",
                )}
                key={item.value}
                onClick={() => setPickType(item.value)}
                type="button"
              >
                <p className="font-semibold text-foreground">{item.label}</p>
                <p className="mt-2 text-sm text-muted">{item.description}</p>
              </button>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={!selectedFixtureId}
            loading={isCreating}
            loadingLabel="Creating room"
            onClick={handleCreate}
          >
            <Plus aria-hidden className="h-4 w-4" />
            Create Match Pick
          </Button>
        </section>
      </div>
    </AppShell>
  );
}

export function MatchPickJoinPage({
  initialInviteCode = "",
}: {
  initialInviteCode?: string;
}) {
  const router = useRouter();
  const hasAutoJoined = useRef(false);
  const [inviteCode, setInviteCode] = useState(initialInviteCode.toUpperCase());
  const [isJoining, setIsJoining] = useState(false);
  const [message, setMessage] = useState("");

  const joinWithCode = useCallback(async (code: string) => {
    setIsJoining(true);
    setMessage("");

    const result = await joinMatchPickRoom(code);

    setIsJoining(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const href = `/match-picks/${result.room.id}/picks`;
    announceRouteStart(href);
    router.push(href);
  }, [router]);

  useEffect(() => {
    if (!initialInviteCode || hasAutoJoined.current) {
      return;
    }

    hasAutoJoined.current = true;
    void joinWithCode(initialInviteCode);
  }, [initialInviteCode, joinWithCode]);

  async function handleJoin() {
    await joinWithCode(inviteCode);
  }

  return (
    <AppShell>
      <div className="mx-auto grid max-w-4xl gap-5">
        <PageHero eyebrow="Invite code" title="Join Match Pick">
          Paste the code your friend shared. This joins only that one match room.
        </PageHero>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Invite code
            <input
              className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground outline-none focus:border-accent"
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="MP-ABC123"
              value={inviteCode}
            />
          </label>
          <Button
            loading={isJoining}
            loadingLabel="Joining room"
            onClick={handleJoin}
          >
            <QrCode aria-hidden className="h-4 w-4" />
            Join Match Pick
          </Button>
          {message ? <Notice tone="warning">{message}</Notice> : null}
        </section>
      </div>
    </AppShell>
  );
}

export function MatchPickRoomPage({
  roomId,
  tab,
}: {
  roomId: string;
  tab: RoomTab;
}) {
  const router = useRouter();
  const { profile } = useGuestSession();
  const [room, setRoom] = useState<MatchPickRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRoom() {
      const result = await fetchMatchPickRoom(roomId);

      if (!isMounted) {
        return;
      }

      if (result.ok) {
        setRoom(result.room);
        setMessage("");
      } else {
        setMessage(result.message);
      }

      setIsLoading(false);
    }

    void loadRoom();

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  async function handleSave(answer: MatchPickAnswer) {
    setIsSaving(true);
    setMessage("");
    const result = await saveMatchPickAnswer(roomId, answer);
    setIsSaving(false);

    if (result.ok) {
      setRoom(result.room);
      setMessage(result.message);
    } else {
      setMessage(result.message);
    }
  }

  async function handleScore() {
    setIsScoring(true);
    setMessage("");
    const result = await scoreMatchPickRoom(roomId);
    setIsScoring(false);

    if (result.ok) {
      setRoom(result.room);
      setMessage(result.message);
    } else {
      setMessage(result.message);
    }
  }

  async function handleLeave() {
    setIsLeaving(true);
    setMessage("");

    const result = await leaveMatchPickRoom(roomId);

    setIsLeaving(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const href = "/match-picks";
    announceRouteStart(href);
    router.push(href);
  }

  if (!room) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl">
          <EmptyState text={isLoading ? "Loading Match Pick..." : message || "Room not found."} />
        </div>
      </AppShell>
    );
  }

  const ownSubmission = room.submissions.find(
    (submission) => submission.profileId === profile?.id,
  );
  const latestAnswer = ownSubmission?.versions.at(-1)?.answer;
  const isLocked = new Date() >= new Date(room.lockAt);

  return (
    <AppShell>
      <div className="mx-auto grid max-w-6xl gap-5">
        <RoomHeader
          canLeave={canLeaveMatchPickRoom(room, profile?.id)}
          isLeaving={isLeaving}
          onLeave={handleLeave}
          room={room}
        />
        <RoomTabs roomId={room.id} selectedTab={tab} />

        {message ? <Notice tone={message.includes("saved") ? "success" : "warning"}>{message}</Notice> : null}

        {tab === "picks" ? (
          <PicksPanel
            answer={latestAnswer}
            isLocked={isLocked}
            isSaving={isSaving}
            key={`${room.id}-${ownSubmission?.versions.at(-1)?.id ?? room.pickType}`}
            onSave={handleSave}
            room={room}
          />
        ) : null}
        {tab === "participants" ? <ParticipantsPanel room={room} /> : null}
        {tab === "audit" ? <AuditPanel room={room} /> : null}
        {tab === "results" ? (
          <ResultsPanel
            isScoring={isScoring}
            onScore={handleScore}
            room={room}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function RoomHeader({
  canLeave,
  isLeaving,
  onLeave,
  room,
}: {
  canLeave: boolean;
  isLeaving: boolean;
  onLeave: () => void;
  room: MatchPickRoom;
}) {
  const [inviteFeedback, setInviteFeedback] = useState("");
  const invitePath = getMatchPickInvitePath(room.inviteCode);
  const inviteUrl = getAbsoluteAppUrl(invitePath);
  const inviteMessage = createMatchPickInviteMessage({
    inviteCode: room.inviteCode,
    inviteUrl,
    lockLabel: formatIst(room.lockAt),
    roomName: room.name,
  });

  async function copyInvite(value: string, feedback: string) {
    await navigator.clipboard?.writeText(value);
    setInviteFeedback(feedback);
  }

  async function shareInvite() {
    if (navigator.share) {
      try {
        await navigator.share({
          text: inviteMessage,
          title: room.name,
          url: inviteUrl,
        });
        setInviteFeedback("Invite shared.");
        return;
      } catch {
        // The user can cancel native sharing; fall back to keeping the invite available.
      }
    }

    await copyInvite(inviteMessage, "Invite message copied.");
  }

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <BadgeText>{room.status}</BadgeText>
          <h1 className="mt-3 text-2xl font-semibold text-foreground sm:text-4xl">
            {room.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {getPickTypeLabel(room.pickType)} room for one match.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground hover:border-accent"
            onClick={() => void copyInvite(room.inviteCode, "Invite code copied.")}
            type="button"
          >
            <Clipboard aria-hidden className="h-4 w-4" />
            {room.inviteCode}
          </button>
          {canLeave ? (
            <Button
              loading={isLeaving}
              loadingLabel="Leaving"
              onClick={onLeave}
              variant="secondary"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              Leave
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile icon={CalendarDays} label="Kickoff" value={formatIst(room.kickoffAt)} />
        <InfoTile icon={Lock} label="Picks lock" value={formatIst(room.lockAt)} />
        <InfoTile icon={Trophy} label="Fixture" value={`${room.fixture.homeTeamName} vs ${room.fixture.awayTeamName}`} />
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-background p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Invite friends</p>
            <p className="mt-1 text-sm text-muted">
              Share the link or message. The link opens Join Match Pick with the code filled in.
            </p>
          </div>
          {inviteFeedback ? <BadgeText>{inviteFeedback}</BadgeText> : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-xs text-muted">Invite link</p>
            <p className="mt-1 break-all text-sm font-semibold text-foreground">{inviteUrl}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <Button
              onClick={() => void copyInvite(inviteUrl, "Invite link copied.")}
              variant="secondary"
            >
              <Copy aria-hidden className="h-4 w-4" />
              Copy link
            </Button>
            <Button
              onClick={() => void copyInvite(inviteMessage, "Invite message copied.")}
              variant="secondary"
            >
              <Clipboard aria-hidden className="h-4 w-4" />
              Copy message
            </Button>
            <Button onClick={() => void shareInvite()}>
              <Share2 aria-hidden className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface-raised p-3 text-sm leading-6 text-muted">
          <p className="font-semibold text-foreground">Message preview</p>
          <p className="mt-2 whitespace-pre-line">{inviteMessage}</p>
        </div>
      </div>
    </section>
  );
}

function PicksPanel({
  answer,
  isLocked,
  isSaving,
  onSave,
  room,
}: {
  answer?: MatchPickAnswer;
  isLocked: boolean;
  isSaving: boolean;
  onSave: (answer: MatchPickAnswer) => void;
  room: MatchPickRoom;
}) {
  const [draft, setDraft] = useState<MatchPickAnswer>(
    answer ?? getEmptyAnswer(room.pickType),
  );

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
      <SectionTitle count={isLocked ? 0 : 1} title="Your pick" />
      <Notice tone={isLocked ? "warning" : "success"}>
        {isLocked
          ? `Locked at ${formatIst(room.lockAt)}. Picks are visible to participants.`
          : `Editable until ${formatIst(room.lockAt)}.`}
      </Notice>
      {room.pickType === "winner" && draft.type === "winner" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: room.fixture.homeTeamName, value: "home" as const },
            { label: "Draw", value: "draw" as const },
            { label: room.fixture.awayTeamName, value: "away" as const },
          ].map((option) => (
            <button
              className={cn(
                "min-h-16 rounded-lg border bg-surface-raised p-3 text-sm font-semibold transition-colors",
                draft.value === option.value
                  ? "border-accent text-accent"
                  : "border-border text-foreground hover:border-accent/60",
              )}
              disabled={isLocked}
              key={option.value}
              onClick={() => setDraft({ type: "winner", value: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {room.pickType === "exact_score" && draft.type === "exact_score" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreInput
            disabled={isLocked}
            label={`${room.fixture.homeTeamName} score`}
            onChange={(home) => setDraft({ ...draft, home })}
            value={draft.home}
          />
          <ScoreInput
            disabled={isLocked}
            label={`${room.fixture.awayTeamName} score`}
            onChange={(away) => setDraft({ ...draft, away })}
            value={draft.away}
          />
        </div>
      ) : null}
      {room.pickType === "both_teams_score" && draft.type === "both_teams_score" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Yes", value: "yes" as const },
            { label: "No", value: "no" as const },
          ].map((option) => (
            <button
              className={cn(
                "min-h-16 rounded-lg border bg-surface-raised p-3 text-sm font-semibold transition-colors",
                draft.value === option.value
                  ? "border-accent text-accent"
                  : "border-border text-foreground hover:border-accent/60",
              )}
              disabled={isLocked}
              key={option.value}
              onClick={() => setDraft({ type: "both_teams_score", value: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <Button
        disabled={isLocked}
        loading={isSaving}
        loadingLabel="Saving pick"
        onClick={() => onSave(draft)}
      >
        <Save aria-hidden className="h-4 w-4" />
        Save pick
      </Button>
    </section>
  );
}

function ParticipantsPanel({ room }: { room: MatchPickRoom }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
      <SectionTitle count={room.participants.length} title="Participants" />
      <div className="grid gap-3">
        {room.participants.map((participant) => (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised p-3"
            key={participant.id}
          >
            <div>
              <p className="font-semibold text-foreground">{participant.displayName}</p>
              <p className="text-xs text-muted">@{participant.handle}</p>
            </div>
            <BadgeText>{participant.role}</BadgeText>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuditPanel({ room }: { room: MatchPickRoom }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
      <SectionTitle count={room.auditLog.length} title="Audit" />
      <div className="grid gap-3">
        {room.auditLog.map((event) => (
          <div
            className="rounded-lg border border-border bg-surface-raised p-3"
            key={event.id}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-foreground">{event.label}</p>
              <span className="text-xs text-muted">{formatIst(event.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{event.details}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultsPanel({
  isScoring,
  onScore,
  room,
}: {
  isScoring: boolean;
  onScore: () => void;
  room: MatchPickRoom;
}) {
  const submissions = room.submissions;

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
      <SectionTitle count={submissions.length} title="Results" />
      {room.resultSummary ? (
        <div className="rounded-lg border border-accent/50 bg-accent/10 p-4">
          <p className="text-sm text-accent">{room.resultSummary.outcomeLabel}</p>
          <p className="mt-2 text-xl font-semibold text-foreground">
            {room.resultSummary.message}
          </p>
        </div>
      ) : (
        <EmptyState text="Results will appear after the match is finished." />
      )}
      <div className="grid gap-3">
        {submissions.map((submission) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised p-3"
            key={submission.id}
          >
            <div>
              <p className="font-semibold text-foreground">{submission.displayName}</p>
              <p className="text-sm text-muted">
                {formatAnswer(submission.versions.at(-1)?.answer, room)}
              </p>
            </div>
            <BadgeText>{submission.resultStatus}</BadgeText>
          </div>
        ))}
      </div>
      <Button
        loading={isScoring}
        loadingLabel="Checking result"
        onClick={onScore}
        variant="secondary"
      >
        <CheckCircle2 aria-hidden className="h-4 w-4" />
        Check final result
      </Button>
    </section>
  );
}

function RoomSection({
  emptyText,
  leavingRoomId,
  onLeave,
  profileId,
  rooms,
  title,
}: {
  emptyText: string;
  leavingRoomId: string;
  onLeave: (roomId: string) => void;
  profileId?: string;
  rooms: MatchPickRoom[];
  title: string;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-4">
      <SectionTitle count={rooms.length} title={title} />
      {rooms.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {rooms.map((room) => (
            <RoomCard
              canLeave={canLeaveMatchPickRoom(room, profileId)}
              isLeaving={leavingRoomId === room.id}
              key={room.id}
              onLeave={onLeave}
              room={room}
            />
          ))}
        </div>
      ) : (
        <EmptyState text={emptyText} />
      )}
    </section>
  );
}

function RoomCard({
  canLeave,
  isLeaving,
  onLeave,
  room,
}: {
  canLeave: boolean;
  isLeaving: boolean;
  onLeave: (roomId: string) => void;
  room: MatchPickRoom;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <BadgeText>{room.status}</BadgeText>
          <h3 className="mt-3 text-lg font-semibold text-foreground">{room.name}</h3>
          <p className="mt-1 text-sm text-muted">{formatIst(room.kickoffAt)}</p>
        </div>
        <BadgeText>{room.inviteCode}</BadgeText>
      </div>
      <div className={cn("grid gap-2", canLeave && "sm:grid-cols-2")}>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground"
          href={`/match-picks/${room.id}/picks`}
        >
          Open
        </Link>
        {canLeave ? (
          <Button
            loading={isLeaving}
            loadingLabel="Leaving"
            onClick={() => onLeave(room.id)}
            variant="secondary"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Leave
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FixtureSelectCard({
  isSelected,
  item,
  onSelect,
}: {
  isSelected: boolean;
  item: MatchPickFixtureOption;
  onSelect: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-lg border bg-surface-raised p-4 text-left transition-colors",
        isSelected ? "border-accent" : "border-border hover:border-accent/60",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <TeamName name={item.fixture.homeTeamName} />
        <span className="rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground">
          vs
        </span>
        <TeamName align="right" name={item.fixture.awayTeamName} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
        <span className="inline-flex items-center gap-2">
          <Clock3 aria-hidden className="h-4 w-4 text-accent" />
          {item.kickoffLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <Lock aria-hidden className="h-4 w-4 text-accent" />
          Locks {item.lockLabel}
        </span>
      </div>
    </button>
  );
}

function RoomTabs({ roomId, selectedTab }: { roomId: string; selectedTab: RoomTab }) {
  const tabs: Array<{ href: string; icon: typeof Trophy; label: string; tab: RoomTab }> = [
    { href: `/match-picks/${roomId}/picks`, icon: Trophy, label: "Picks", tab: "picks" },
    { href: `/match-picks/${roomId}/participants`, icon: Users, label: "Participants", tab: "participants" },
    { href: `/match-picks/${roomId}/audit`, icon: Activity, label: "Audit", tab: "audit" },
    { href: `/match-picks/${roomId}/results`, icon: ListChecks, label: "Results", tab: "results" },
  ];

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-border pb-2">
      {tabs.map((item) => (
        <Link
          className={cn(
            "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted",
            selectedTab === item.tab && "bg-accent text-accent-foreground",
          )}
          href={item.href}
          key={item.tab}
        >
          <item.icon aria-hidden className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function PageHero({
  action,
  children,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{children}</p>
        </div>
        {action}
      </div>
    </section>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface-raised px-3 text-sm font-semibold text-foreground hover:border-accent"
      href={href}
    >
      <Icon aria-hidden className="h-4 w-4" />
      {label}
    </Link>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="inline-flex items-center gap-2 text-xs text-muted">
        <Icon aria-hidden className="h-4 w-4 text-accent" />
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ScoreInput({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      <input
        className="min-h-12 rounded-md border border-border bg-background px-3 text-foreground outline-none focus:border-accent"
        disabled={disabled}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

function SectionTitle({ count, title }: { count: number; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <BadgeText>{String(count)}</BadgeText>
    </div>
  );
}

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "warning";
}) {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "success"
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {children}
    </p>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">
      {text}
    </div>
  );
}

function BadgeText({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
      {children}
    </span>
  );
}

function TeamName({
  align = "left",
  name,
}: {
  align?: "left" | "right";
  name: string;
}) {
  return (
    <span
      className={cn(
        "min-w-0 truncate text-sm font-semibold text-foreground",
        align === "right" && "text-right",
      )}
    >
      {name}
    </span>
  );
}

function getEmptyAnswer(type: MatchPickType): MatchPickAnswer {
  if (type === "exact_score") {
    return { type, away: 0, home: 0 };
  }

  if (type === "both_teams_score") {
    return { type, value: "yes" };
  }

  return { type, value: "home" };
}

function getPickTypeLabel(type: MatchPickType) {
  if (type === "exact_score") return "Exact score";
  if (type === "both_teams_score") return "Both teams score";
  return "Winner";
}

function formatAnswer(answer: MatchPickAnswer | undefined, room: MatchPickRoom) {
  if (!answer) {
    return "No pick saved";
  }

  if (answer.type === "winner") {
    if (answer.value === "home") return room.fixture.homeTeamName;
    if (answer.value === "away") return room.fixture.awayTeamName;
    return "Draw";
  }

  if (answer.type === "both_teams_score") {
    return answer.value === "yes" ? "Both teams score: Yes" : "Both teams score: No";
  }

  return `${room.fixture.homeTeamName} ${answer.home} - ${answer.away} ${room.fixture.awayTeamName}`;
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

function getAbsoluteAppUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
}
