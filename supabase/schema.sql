create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  handle text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.championships (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  name text not null,
  slug text not null unique,
  invite_code text not null unique,
  status text not null default 'open',
  start_date date not null,
  lock_date date not null,
  is_public boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  handle text not null,
  role text not null default 'participant',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  rules_accepted_at timestamptz,
  signed_at timestamptz,
  submission_status text not null default 'not_started',
  locked_status text not null default 'unlocked',
  unique (championship_id, profile_id)
);

create table if not exists public.prediction_submissions (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  locked_version_id uuid,
  locked_at timestamptz,
  fingerprint text,
  last_edited_at timestamptz,
  unique (championship_id, profile_id)
);

create table if not exists public.prediction_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.prediction_submissions(id) on delete cascade,
  version_number integer not null,
  picks jsonb not null,
  created_at timestamptz not null default now(),
  unique (submission_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prediction_submissions_locked_version_fk'
  ) then
    alter table public.prediction_submissions
      add constraint prediction_submissions_locked_version_fk
      foreign key (locked_version_id)
      references public.prediction_versions(id)
      deferrable initially deferred;
  end if;
end $$;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  type text not null,
  label text not null,
  actor_name text not null,
  details text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sports_tournaments (
  id text primary key,
  provider text not null,
  provider_league_id text not null,
  sport text not null,
  league text not null,
  name text not null,
  season text not null,
  start_date date not null,
  end_date date,
  match_count integer not null default 0,
  team_count integer not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_league_id, season)
);

create table if not exists public.sports_teams (
  id text primary key,
  tournament_id text not null references public.sports_tournaments(id) on delete cascade,
  provider_team_id text not null,
  name text not null,
  short_name text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, provider_team_id)
);

create table if not exists public.sports_fixtures (
  id text primary key,
  tournament_id text not null references public.sports_tournaments(id) on delete cascade,
  provider_match_id text not null,
  sport text not null,
  league text not null,
  home_team_name text not null,
  away_team_name text not null,
  home_team_id text references public.sports_teams(id) on delete set null,
  away_team_id text references public.sports_teams(id) on delete set null,
  kickoff_utc timestamptz,
  status text not null,
  home_score integer,
  away_score integer,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, provider_match_id)
);

create table if not exists public.sports_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.championships enable row level security;
alter table public.participants enable row level security;
alter table public.prediction_submissions enable row level security;
alter table public.prediction_versions enable row level security;
alter table public.audit_events enable row level security;
alter table public.sports_tournaments enable row level security;
alter table public.sports_teams enable row level security;
alter table public.sports_fixtures enable row level security;
alter table public.sports_sync_runs enable row level security;

create policy "profiles readable" on public.profiles
  for select using (true);

create policy "profiles insertable" on public.profiles
  for insert with check (true);

create policy "profiles updatable" on public.profiles
  for update using (true);

create policy "public championships readable" on public.championships
  for select using (is_public = true);

create policy "championships insertable" on public.championships
  for insert with check (true);

create policy "participants readable" on public.participants
  for select using (true);

create policy "participants insertable" on public.participants
  for insert with check (true);

create policy "participants updatable" on public.participants
  for update using (true);

create policy "prediction submissions readable" on public.prediction_submissions
  for select using (true);

create policy "prediction submissions insertable" on public.prediction_submissions
  for insert with check (true);

create policy "prediction submissions updatable" on public.prediction_submissions
  for update using (locked_at is null);

create policy "prediction versions readable" on public.prediction_versions
  for select using (true);

create policy "prediction versions insertable" on public.prediction_versions
  for insert with check (true);

create policy "audit events readable" on public.audit_events
  for select using (true);

create policy "audit events insertable" on public.audit_events
  for insert with check (true);

create policy "sports tournaments readable" on public.sports_tournaments
  for select using (true);

create policy "sports teams readable" on public.sports_teams
  for select using (true);

create policy "sports fixtures readable" on public.sports_fixtures
  for select using (true);

create policy "sports sync runs readable" on public.sports_sync_runs
  for select using (true);
