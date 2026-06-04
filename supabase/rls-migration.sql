-- RLS tightening migration
-- Run this against the existing database AFTER schema.sql and pool-bets-migration.sql.
-- Replaces the open "using (true)" MVP policies with auth.uid()-scoped ones.
--
-- Access pattern summary (from pool-supabase.ts):
--   Browser client (anon key + user JWT):
--     - SELECT championships, participants, prediction_submissions,
--             prediction_versions, audit_events, pool_bets
--     - INSERT/UPSERT championships (pool create)
--     - INSERT/UPSERT pool_bets (pool create initial bets only)
--     - INSERT/UPSERT participants (create, join, draft save)
--     - UPDATE participants.left_at (leave)
--     - INSERT/UPSERT prediction_submissions (draft save)
--     - INSERT/UPSERT prediction_versions (draft save)
--     - INSERT/UPSERT audit_events (create, join, leave, draft save)
--     - UPSERT profiles (sync own profile)
--   Service role (bypasses RLS — used by API routes):
--     - lock/unlock: UPDATE prediction_submissions, UPDATE participants
--     - bet sync: DELETE + INSERT pool_bets
--     - signup: INSERT profiles via admin.createUser + INSERT profiles row

-- ============================================================
-- Drop all existing policies
-- ============================================================

drop policy if exists "profiles readable"                         on public.profiles;
drop policy if exists "profiles insertable"                       on public.profiles;
drop policy if exists "profiles updatable"                        on public.profiles;

drop policy if exists "public championships readable"             on public.championships;
drop policy if exists "championships insertable"                  on public.championships;

drop policy if exists "participants readable"                     on public.participants;
drop policy if exists "participants insertable"                   on public.participants;
drop policy if exists "participants updatable"                    on public.participants;

drop policy if exists "prediction submissions readable"           on public.prediction_submissions;
drop policy if exists "prediction submissions insertable"         on public.prediction_submissions;
drop policy if exists "prediction submissions updatable"          on public.prediction_submissions;

drop policy if exists "prediction versions readable"             on public.prediction_versions;
drop policy if exists "prediction versions insertable"           on public.prediction_versions;

drop policy if exists "audit events readable"                     on public.audit_events;
drop policy if exists "audit events insertable"                   on public.audit_events;

drop policy if exists "pool bets readable"                        on public.pool_bets;
drop policy if exists "pool bets insertable"                      on public.pool_bets;
drop policy if exists "pool bets updatable"                       on public.pool_bets;
drop policy if exists "pool bets deletable"                       on public.pool_bets;

-- ============================================================
-- profiles
-- ============================================================

-- Any authenticated user can read profiles (needed for participant display).
create policy "profiles: authenticated users can read"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Users can only insert their own profile row.
-- The signup API route uses the service role (bypasses RLS) so this
-- covers the browser upsert in syncPoolProfile().
create policy "profiles: users can insert own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- Users can only update their own profile.
create policy "profiles: users can update own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- championships
-- ============================================================

-- All pools are stored with is_public = true (hardcoded in createSupabasePool).
-- Any authenticated user can read all championships so that invite-code
-- lookup works before the user has joined. The invite code itself is the
-- access mechanism; championship rows contain no sensitive picks.
create policy "championships: authenticated users can read"
  on public.championships
  for select
  to authenticated
  using (true);

-- Only the creator can insert, and created_by must match their own user id.
create policy "championships: users can create as themselves"
  on public.championships
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- ============================================================
-- RLS helper functions
-- ============================================================

-- SECURITY DEFINER avoids recursive participants policies when checking
-- whether the current user belongs to a pool. Do not replace these policies
-- with direct subqueries against public.participants from inside a
-- participants policy.
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

-- ============================================================
-- participants
-- ============================================================

-- Users can see participants in any pool they are (or were) part of.
create policy "participants: readable by pool members"
  on public.participants
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_championship_member(championship_id)
  );

-- Users can insert their own participant row.
create policy "participants: users can insert own"
  on public.participants
  for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Users can upsert/update their own participant row (join refresh, leave, draft status).
create policy "participants: users can update own"
  on public.participants
  for update
  to authenticated
  using  (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============================================================
-- prediction_submissions
-- ============================================================

-- Participants in a pool can read all submissions in that pool.
-- Pick visibility before/after lock date is enforced in the UI layer.
create policy "prediction submissions: readable by pool participants"
  on public.prediction_submissions
  for select
  to authenticated
  using (public.is_championship_member(championship_id));

-- Users can insert their own submission.
create policy "prediction submissions: users can insert own"
  on public.prediction_submissions
  for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Users can update their own submission only while it is not locked.
-- The lock/unlock API routes use the service role and bypass this.
create policy "prediction submissions: users can update own when unlocked"
  on public.prediction_submissions
  for update
  to authenticated
  using  (profile_id = auth.uid() and locked_at is null)
  with check (profile_id = auth.uid());

-- ============================================================
-- prediction_versions
-- ============================================================

-- Participants in a pool can read all versions in that pool.
create policy "prediction versions: readable by pool participants"
  on public.prediction_versions
  for select
  to authenticated
  using (public.is_submission_in_member_pool(submission_id));

-- Users can insert versions only for their own unlocked submission.
create policy "prediction versions: users can insert own"
  on public.prediction_versions
  for insert
  to authenticated
  with check (
    submission_id in (
      select id
      from   public.prediction_submissions
      where  profile_id = auth.uid()
      and    locked_at is null
    )
  );

-- ============================================================
-- audit_events
-- ============================================================

-- Participants in a pool (including those who have left) can read its audit log.
create policy "audit events: readable by pool participants"
  on public.audit_events
  for select
  to authenticated
  using (public.is_championship_member(championship_id));

-- Any participant can write audit events for pools they are part of.
-- ignoreDuplicates is used in the app so duplicate inserts are harmless.
create policy "audit events: insertable by pool participants"
  on public.audit_events
  for insert
  to authenticated
  with check (public.is_championship_member(championship_id));

-- ============================================================
-- pool_bets
-- ============================================================

-- Participants can read bets for pools they belong to.
create policy "pool bets: readable by pool participants"
  on public.pool_bets
  for select
  to authenticated
  using (public.is_championship_member(championship_id));

-- The browser client inserts initial bets during pool creation (createSupabasePool).
-- At that point the championship row already exists with created_by = auth.uid().
-- Post-creation bet editing goes through the service role (/api/pool-bets/sync),
-- which bypasses RLS, so no UPDATE or DELETE policy is needed here.
create policy "pool bets: creator can insert on pool creation"
  on public.pool_bets
  for insert
  to authenticated
  with check (
    championship_id in (
      select id
      from   public.championships
      where  created_by = auth.uid()
    )
  );
