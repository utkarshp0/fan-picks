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

alter table public.profiles enable row level security;
alter table public.championships enable row level security;
alter table public.participants enable row level security;
alter table public.prediction_submissions enable row level security;
alter table public.prediction_versions enable row level security;
alter table public.audit_events enable row level security;

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
