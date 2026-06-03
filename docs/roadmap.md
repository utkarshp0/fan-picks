# Roadmap

This roadmap is intentionally practical. It is not shown in the app UI.

## Completed

- Multi-page app structure with real route navigation.
- Sidebar with top account area and logout.
- Supabase Auth signup/login/logout.
- Username/password UX mapped to Supabase Auth internal emails.
- Pool list, create pool, join pool pages.
- Pool detail pages for Picks, Participants, Audit Log, and Bets.
- Default tournament bets plus creator-defined custom bets.
- Creator-only add/remove controls for pool bets before lock.
- Invite-code joining.
- Leave pool soft-delete via `left_at`.
- Supabase persistence for pools, participants, pool bets, audit events,
  prediction drafts, prediction versions, locked picks, and fingerprints.
- Server-enforced lock/reopen behavior for accidental locks before deadline.
- Reusable async button loading states for auth, pool, and pick actions.
- Route-transition loading feedback for app navigation and pool tabs.
- Automatic Big Balls Data server sync into Supabase `sports_*` cache tables.
- Provider-backed team choices on Create Pool and Picks.
- Data-safety documentation.

## Next

- Tighten Supabase RLS for authenticated users.
- Add E2E tests for auth and pool flows.
- Add E2E tests for lock/reopen before and after deadline.
- Add user-facing remote sync error states.
- Add deployment instructions for Vercel.
- Add a safe test-data cleanup script.
- Manually smoke test Big Balls Data sync after running
  `supabase/sports-data-migration.sql` in Supabase.
- Review mobile layout for every page.

## Later

- Admin or creator-only controls for editing pool metadata before first join.
- Better custom bet builder.
- Match-based bets backed by synced fixtures and kickoff-specific locks.
- Scoring/results after tournaments finish.
- Public read-only share pages after lock.
- Optional social login if username/password becomes a barrier.
