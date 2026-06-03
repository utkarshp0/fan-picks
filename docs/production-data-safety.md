# Production Data Safety

Fan Picks should treat Supabase as the source of truth in production. Browser
storage is only a cache for the current session.

## App Safeguards

- Login uses Supabase Auth sessions.
- Signup creates Supabase Auth users through a server route.
- User-facing account data is stored in `profiles`, not browser local storage.
- Pool creation, joins, leaves, custom bets, audit events, prediction drafts,
  prediction versions, locked picks, and fingerprints are written to Supabase.
- Pool refresh reads from Supabase and no longer auto-publishes stale local
  browser pools back to production.
- Participants use `left_at` instead of hard delete.
- Audit events use immutable inserts/upserts by event ID.

## Supabase Safeguards

- Enable Supabase database backups before inviting real users.
- Enable Point-in-Time Recovery if losing a day of data is unacceptable.
- Reference: https://supabase.com/docs/guides/platform/backups
- Test restore into a separate project before relying on backups.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and rotate it if it is exposed.
- Never run destructive SQL in production without a fresh backup or restore
  point.

## Pre-Launch Verification

1. Sign up in Browser A.
2. Login with the same account in Browser B.
3. Create a pool in Browser A.
4. Join the pool with invite code in Browser B.
5. Save picks from both browsers.
6. Refresh both browsers and confirm picks remain.
7. Lock picks and confirm fingerprints remain after refresh.
8. Confirm Audit Log shows create, join, field changes, saves, and locks.
