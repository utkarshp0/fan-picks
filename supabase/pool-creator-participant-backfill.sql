-- Backfill creator participant rows for pools that were created but never got
-- their creator membership persisted.
--
-- Safe behavior:
-- - Inserts only when championships.created_by is set.
-- - Inserts only when no participant row exists for that creator in that pool.
-- - Does not change pools where the creator has a participant row with left_at;
--   those are treated as intentional leaves/history.
-- - Does not delete data.

insert into public.participants (
  championship_id,
  profile_id,
  display_name,
  handle,
  role,
  joined_at,
  left_at,
  submission_status,
  locked_status
)
select
  c.id,
  c.created_by,
  p.display_name,
  p.handle,
  'creator',
  c.created_at,
  null,
  'not_started',
  'unlocked'
from public.championships c
join public.profiles p
  on p.id = c.created_by
where c.created_by is not null
  and not exists (
    select 1
    from public.participants existing
    where existing.championship_id = c.id
      and existing.profile_id = c.created_by
  );
