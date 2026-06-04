-- Match Picks migration
-- One room = one fixture + one pick question. This migration creates new
-- tables only; it does not alter or delete existing pool data.

create table if not exists public.match_pick_rooms (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.sports_tournaments(id) on delete cascade,
  fixture_id text not null references public.sports_fixtures(id) on delete cascade,
  pick_type text not null check (pick_type in ('winner', 'exact_score', 'both_teams_score')),
  name text not null,
  invite_code text not null unique,
  status text not null default 'open' check (status in ('open', 'locked', 'finished', 'scored', 'cancelled')),
  kickoff_at timestamptz not null,
  lock_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.match_pick_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.match_pick_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  handle text not null,
  role text not null default 'participant' check (role in ('creator', 'participant')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (room_id, profile_id)
);

create table if not exists public.match_pick_submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.match_pick_rooms(id) on delete cascade,
  participant_id uuid not null references public.match_pick_participants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  locked_version_id uuid,
  locked_at timestamptz,
  fingerprint text,
  result_status text not null default 'pending' check (result_status in ('pending', 'correct', 'incorrect', 'void')),
  last_edited_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, profile_id)
);

create table if not exists public.match_pick_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.match_pick_submissions(id) on delete cascade,
  version_number integer not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  unique (submission_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_pick_submissions_locked_version_fk'
  ) then
    alter table public.match_pick_submissions
      add constraint match_pick_submissions_locked_version_fk
      foreign key (locked_version_id)
      references public.match_pick_versions(id)
      deferrable initially deferred;
  end if;
end $$;

create table if not exists public.match_pick_audit_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.match_pick_rooms(id) on delete cascade,
  type text not null,
  label text not null,
  actor_name text not null,
  details text not null,
  created_at timestamptz not null default now()
);

alter table public.match_pick_rooms enable row level security;
alter table public.match_pick_participants enable row level security;
alter table public.match_pick_submissions enable row level security;
alter table public.match_pick_versions enable row level security;
alter table public.match_pick_audit_events enable row level security;

create or replace function public.is_match_pick_room_member(check_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_pick_participants p
    where p.room_id = check_room_id
      and p.profile_id = auth.uid()
  );
$$;

create or replace function public.is_match_pick_submission_visible(check_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_pick_submissions s
    join public.match_pick_rooms r
      on r.id = s.room_id
    join public.match_pick_participants p
      on p.room_id = s.room_id
    where s.id = check_submission_id
      and p.profile_id = auth.uid()
      and (s.profile_id = auth.uid() or now() >= r.lock_at)
  );
$$;

revoke all on function public.is_match_pick_room_member(uuid) from public;
revoke all on function public.is_match_pick_submission_visible(uuid) from public;
grant execute on function public.is_match_pick_room_member(uuid) to authenticated, service_role;
grant execute on function public.is_match_pick_submission_visible(uuid) to authenticated, service_role;

drop policy if exists "match pick rooms readable by members" on public.match_pick_rooms;
drop policy if exists "match pick participants readable by members" on public.match_pick_participants;
drop policy if exists "match pick submissions readable after lock" on public.match_pick_submissions;
drop policy if exists "match pick versions readable after lock" on public.match_pick_versions;
drop policy if exists "match pick audit readable by members" on public.match_pick_audit_events;

create policy "match pick rooms readable by members"
  on public.match_pick_rooms
  for select
  to authenticated
  using (created_by = auth.uid() or public.is_match_pick_room_member(id));

create policy "match pick participants readable by members"
  on public.match_pick_participants
  for select
  to authenticated
  using (profile_id = auth.uid() or public.is_match_pick_room_member(room_id));

create policy "match pick submissions readable after lock"
  on public.match_pick_submissions
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or (
      public.is_match_pick_room_member(room_id)
      and room_id in (
        select id from public.match_pick_rooms where now() >= lock_at
      )
    )
  );

create policy "match pick versions readable after lock"
  on public.match_pick_versions
  for select
  to authenticated
  using (public.is_match_pick_submission_visible(submission_id));

create policy "match pick audit readable by members"
  on public.match_pick_audit_events
  for select
  to authenticated
  using (public.is_match_pick_room_member(room_id));
