-- RLS recursion hotfix
-- Run this in Supabase SQL Editor if the app shows:
--   infinite recursion detected in policy for relation "participants"
--
-- This migration does not delete app data. It only replaces recursive policies
-- with SECURITY DEFINER membership helpers so policies can check membership
-- without re-entering the participants RLS policy.

create or replace function public.is_championship_member(check_championship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants p
    where p.championship_id = check_championship_id
      and p.profile_id = auth.uid()
  );
$$;

create or replace function public.is_submission_in_member_pool(check_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.prediction_submissions ps
    join public.participants p
      on p.championship_id = ps.championship_id
    where ps.id = check_submission_id
      and p.profile_id = auth.uid()
  );
$$;

revoke all on function public.is_championship_member(uuid) from public;
revoke all on function public.is_submission_in_member_pool(uuid) from public;
grant execute on function public.is_championship_member(uuid) to authenticated, service_role;
grant execute on function public.is_submission_in_member_pool(uuid) to authenticated, service_role;

drop policy if exists "participants: readable by pool members" on public.participants;
drop policy if exists "prediction submissions: readable by pool participants" on public.prediction_submissions;
drop policy if exists "prediction versions: readable by pool participants" on public.prediction_versions;
drop policy if exists "audit events: readable by pool participants" on public.audit_events;
drop policy if exists "audit events: insertable by pool participants" on public.audit_events;
drop policy if exists "pool bets: readable by pool participants" on public.pool_bets;

create policy "participants: readable by pool members"
  on public.participants
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_championship_member(championship_id)
  );

create policy "prediction submissions: readable by pool participants"
  on public.prediction_submissions
  for select
  to authenticated
  using (public.is_championship_member(championship_id));

create policy "prediction versions: readable by pool participants"
  on public.prediction_versions
  for select
  to authenticated
  using (public.is_submission_in_member_pool(submission_id));

create policy "audit events: readable by pool participants"
  on public.audit_events
  for select
  to authenticated
  using (public.is_championship_member(championship_id));

create policy "audit events: insertable by pool participants"
  on public.audit_events
  for insert
  to authenticated
  with check (public.is_championship_member(championship_id));

create policy "pool bets: readable by pool participants"
  on public.pool_bets
  for select
  to authenticated
  using (public.is_championship_member(championship_id));
