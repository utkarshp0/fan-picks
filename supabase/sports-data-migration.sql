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

create index if not exists sports_teams_tournament_id_idx
  on public.sports_teams(tournament_id);

create index if not exists sports_fixtures_tournament_id_idx
  on public.sports_fixtures(tournament_id);

create index if not exists sports_fixtures_kickoff_utc_idx
  on public.sports_fixtures(kickoff_utc);

alter table public.sports_tournaments enable row level security;
alter table public.sports_teams enable row level security;
alter table public.sports_fixtures enable row level security;
alter table public.sports_sync_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sports_tournaments'
      and policyname = 'sports tournaments readable'
  ) then
    create policy "sports tournaments readable" on public.sports_tournaments
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sports_teams'
      and policyname = 'sports teams readable'
  ) then
    create policy "sports teams readable" on public.sports_teams
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sports_fixtures'
      and policyname = 'sports fixtures readable'
  ) then
    create policy "sports fixtures readable" on public.sports_fixtures
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sports_sync_runs'
      and policyname = 'sports sync runs readable'
  ) then
    create policy "sports sync runs readable" on public.sports_sync_runs
      for select using (true);
  end if;
end $$;
