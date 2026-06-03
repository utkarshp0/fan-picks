-- Legacy migration from the temporary custom-auth implementation.
-- Supabase Auth is now the production auth source, so new deployments do not
-- need this table. Keep this file only for existing local/dev databases that
-- already created `app_accounts`.

create extension if not exists "pgcrypto";

create table if not exists public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_accounts'
      and column_name = 'password_salt'
  ) then
    alter table public.app_accounts
      alter column password_salt drop not null;
  end if;
end $$;

alter table public.app_accounts enable row level security;

drop policy if exists "app accounts readable" on public.app_accounts;
drop policy if exists "app accounts insertable" on public.app_accounts;
