create table if not exists public.pool_bets (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null references public.championships(id) on delete cascade,
  bet_id text not null,
  name text not null,
  type text not null,
  prompt text not null,
  selection_count integer not null default 1,
  scoring_note text not null default '',
  choices jsonb,
  source text not null default 'default',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (championship_id, bet_id)
);

alter table public.pool_bets enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pool_bets'
      and policyname = 'pool bets readable'
  ) then
    create policy "pool bets readable" on public.pool_bets
      for select using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pool_bets'
      and policyname = 'pool bets insertable'
  ) then
    create policy "pool bets insertable" on public.pool_bets
      for insert with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pool_bets'
      and policyname = 'pool bets updatable'
  ) then
    create policy "pool bets updatable" on public.pool_bets
      for update using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pool_bets'
      and policyname = 'pool bets deletable'
  ) then
    create policy "pool bets deletable" on public.pool_bets
      for delete using (true);
  end if;
end $$;
