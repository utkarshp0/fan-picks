# Fan Picks AI Handoff

Last updated: 2026-06-03.

This file is the first thing a future AI assistant should read before changing
Fan Picks. It captures the product intent, current architecture, data model,
decisions already made, and known next steps.

## Handoff Maintenance Rule

This file must be updated whenever meaningful code or product behavior changes.
Future AI assistants should treat handoff updates as part of the definition of
done, alongside lint/build/test verification.

Update this file when changing:

- Auth/session behavior
- Supabase schema, RLS, migrations, or data source-of-truth rules
- Routes/navigation
- Pool, bet, prediction, lock, or audit behavior
- Reusable UI interaction patterns, such as async action loading states
- Deployment/environment requirements
- Known risks, caveats, or next steps

If a change only adjusts visual styling or fixes a tiny typo and does not affect
future development context, the final response should explicitly say no handoff
update was needed.

## Current Product Goal

Fan Picks is a friendly sports prediction pool app, not a gambling product.
Users should be able to:

1. Sign up or login with a simple username and password.
2. See their pools.
3. Create a pool for a supported tournament.
4. Choose default bets and add custom bets.
5. Share an invite code.
6. Join or leave pools.
7. Save and lock predictions before the lock date.
8. Reopen accidentally locked picks before the lock date.
9. See transparent audit events for pool creation, joins, leaves, bet changes,
   prediction field changes, draft saves, and locked picks.

Avoid adding casino, odds, money, payout, wager, or sportsbook language.

## Important User Preferences

- Keep the app simple. No phase banners, no internal roadmap labels in the UI.
- Navigation must be real pages, not one-page scrolling sections.
- Left sidebar should remain.
- Top-level pages are:
  - `/championships`
  - `/championships/create`
  - `/championships/join`
- Pool detail pages are:
  - `/championships/[championshipId]/predictions`
  - `/championships/[championshipId]/participants`
  - `/championships/[championshipId]/audit`
  - `/championships/[championshipId]/rules`
- Current Pool nav appears only inside a pool route.
- Account control belongs at the top of the sidebar and should read like
  profile/login/logout, not "guest profile" or "change user".

## Current Stack

- Next.js App Router, Next 16.2.6
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase:
  - Supabase Auth for username/password sessions
  - Postgres tables for profiles, pools, participants, bets, predictions, and
    audit events
- Vercel is the intended hosting target.

## Local Project Paths

The active app project is:

`C:\QA\fan-picks`

There is also an almost-empty git folder at:

`C:\Users\UtkarshAshokPatil\Documents\fan-picks`

Do not confuse these. All app work so far has been in `C:\QA\fan-picks`.

## Environment

Required `.env.local` variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BIG_BALLS_DATA_API_KEY=
BIG_BALLS_DATA_BASE_URL=https://api.bigballsdata.com
BIG_BALLS_DATA_SYNC_LEAGUES=fifa-world-cup-2026:wc2026
```

`SUPABASE_SERVICE_ROLE_KEY` and `BIG_BALLS_DATA_API_KEY` are server-only. Never
expose them in browser code, logs, docs, screenshots, or commits. Both were
pasted during development; rotate them before production launch.

## Auth Decision

The app previously had a temporary custom `app_accounts` table and custom
password hashing. That is legacy now.

Current production direction:

- Supabase Auth is the auth source of truth.
- UI still asks for username + password.
- Username is mapped to an internal auth email:
  `username@fanpicks.local`
- Supabase Auth stores/verifies passwords and maintains sessions.
- Logout should always replace the current URL with `/championships` so private
  pool detail URLs are not left in the browser address bar after auth is gone.
- `profiles` stores app-facing identity:
  - `id` equals Supabase Auth user ID
  - `display_name`
  - `handle`
  - timestamps

Relevant files:

- `src/lib/auth-identity.ts`
- `src/lib/account-auth.ts`
- `src/lib/server-account-auth.ts`
- `src/components/auth/guest-session-provider.tsx`
- `src/components/auth/login-screen.tsx`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/login/route.ts`

`/api/auth/signup` uses the service role key to create Supabase Auth users with
email already confirmed. `/api/auth/login` is intentionally retired and returns
410 because login now happens via `supabase.auth.signInWithPassword` in the
browser client.

## Data Source Of Truth

Supabase should be treated as production source of truth.

Browser local storage is only a cache for the current UI. Do not add background
logic that publishes old local browser data back to Supabase on refresh.

Important current behavior:

- `refreshChampionshipsFromSupabase()` fetches remote pools and writes the local
  cache.
- It no longer auto-publishes local pools to Supabase.
- Pool creation, joining, leaving, custom bets, audit events, prediction drafts,
  prediction versions, locks, and fingerprints are persisted to Supabase.
- Prediction lock/unlock is enforced by server routes, not direct browser
  updates, so the authenticated user and lock date can be validated centrally.
- Sports data from Big Balls Data is also cached in Supabase. The browser reads
  cached `sports_*` rows and never calls the provider directly.

Relevant files:

- `src/lib/championship-store.ts`
- `src/lib/pool-supabase.ts`
- `src/lib/server-prediction-locks.ts`
- `src/types/championship.ts`

## Prediction Lock Business Rule

- Users can save drafts until they lock picks or the lock date passes.
- Locking picks makes the latest saved prediction version official and writes a
  fingerprint plus `prediction_locked` audit event.
- If a user locks accidentally, they may reopen picks only before the lock date.
- Reopening clears `locked_at`, `locked_version_id`, and `fingerprint`, changes
  participant status back to draft/unlocked, and writes a
  `prediction_unlocked` audit event.
- After the lock date passes, picks cannot be edited or reopened. If the user
  never clicked Lock, the latest saved draft is treated as final by date.
- Lock/unlock routes require the Supabase Auth access token and only operate on
  the logged-in user's own submission.
- Bet `selectionCount` is enforced in the checkbox UI, in
  `savePredictionDraft`, and again in the server lock route. Do not silently
  slice extra selections; reject them with a clear message.

## Pool Bet Editing Rule

- Pool creators can add or remove bets from a draft list on the Bets page before
  the lock date.
- Add/remove does not persist immediately. The creator must click `Save pool`.
- Removed tournament default bets appear in a `Default bets` add-back section
  so creators can restore them to the draft.
- Participants cannot edit the pool bet list.
- Bet edits are blocked after the lock date.
- Bet edits are also blocked once any participant has locked picks.
- Removing a bet keeps at least one bet in the pool and hides the removed bet
  from future prediction forms.
- `Save pool` writes `bet_added` or `bet_removed` audit events and syncs the
  active `pool_bets` list to Supabase.
- Bet list sync goes through `/api/pool-bets/sync`, which uses the
  service role after validating the Supabase Auth user is the pool creator.
- If server sync fails, the app rolls back the optimistic local change.

## Sports Data Integration

Big Balls Data is the selected football data provider.

Current implementation:

- `src/lib/big-balls-data.ts` calls Big Balls Data from the server and
  normalizes provider matches. FIFA World Cup 2026 uses Big Balls'
  `/v1/wc2026/matches` endpoint, which returns 72 matches and 48 teams as of
  2026-06-03.
- `src/app/api/sports/sync/route.ts` requires a logged-in Supabase Auth bearer
  token, then syncs configured leagues.
- `src/lib/server-sports-data.ts` writes normalized data with the service role.
- `src/app/api/sports/tournaments/route.ts` returns cached tournament snapshots.
- `src/lib/sports-data-client.ts` fetches cached tournaments for React screens
  and enriches default templates with synced team choices.
- `src/components/championship/championship-create-panel.tsx` automatically
  checks cached tournament data after login and runs sports sync in the
  background when the selected tournament has no cached teams. There should not
  be a normal user-facing `Refresh sports data` button.
- `src/components/championship/prediction-board.tsx` also reads cached teams so
  existing pools can use synced choices if their stored bet does not already
  include choices.

Provider config:

- `BIG_BALLS_DATA_BASE_URL` defaults to `https://api.bigballsdata.com`.
- `BIG_BALLS_DATA_SYNC_LEAGUES` is comma-separated:
  `tournamentId:providerLeague:name:season`.
- Current default is `fifa-world-cup-2026:wc2026`.

Important design rule: do not call Big Balls Data from client components or
prediction forms. Always sync into Supabase first and let app features read
from the cached sports tables. Sports sync should feel automatic to normal
users, not like an admin/manual refresh step. This protects quota and keeps
existing pools stable if the provider response shape changes.

## Supabase SQL

Run these for a clean deployment:

- `supabase/schema.sql`
- `supabase/pool-bets-migration.sql`
- `supabase/sports-data-migration.sql`

`pool-bets-migration.sql` includes a delete policy, but bet add/remove no
longer depends on browser-side delete permission because the app uses the
server sync route.

Legacy file:

- `supabase/account-login-migration.sql`

The legacy file is only from the temporary custom-auth implementation. Do not
base new auth work on `app_accounts`.

## Current Tables Used

- `profiles`
- `championships`
- `participants`
- `prediction_submissions`
- `prediction_versions`
- `audit_events`
- `pool_bets`
- `sports_tournaments`
- `sports_teams`
- `sports_fixtures`
- `sports_sync_runs`
- Supabase Auth internal user tables

Important relationships:

- `profiles.id` should match Supabase Auth user ID.
- `participants.profile_id` points to `profiles.id`.
- `prediction_submissions.profile_id` points to `profiles.id`.
- `prediction_versions` are nested via:
  `prediction_versions!prediction_versions_submission_id_fkey(*)`

Do not change this nested select unless you also check the Supabase FK names.

## Product Vocabulary

Use:

- Pool
- Tournament
- Bets
- Picks
- Predictions
- Invite code
- Audit log
- Lock date

Avoid:

- Championship as primary user-facing language, unless still present in code
  paths/types.
- Phase labels.
- Guest profile.
- Wager, odds, money, payout, gambling copy.

The route and type names still use `championship` internally for historical
reasons. It is acceptable to keep code names until a focused cleanup is planned.

## Known Data/Testing Notes

- `Utkarsh` / `utkarsh` may already be reserved in `profiles` from earlier
  testing. Use a new username or clean the legacy profile row in Supabase.
- `app_accounts` may exist in Supabase if the legacy migration was run. It is
  no longer used.
- The app has been tested locally at `http://localhost:3001`.
- The current browser automation in Codex sometimes cannot type into fields due
  to a virtual clipboard limitation; use API checks or manual browser testing if
  that occurs.

## Verification Commands

Run from `C:\QA\fan-picks`:

```bash
npm run lint
npm test
npm run build
```

Local dev server usually runs on:

```bash
npm run dev -- --port 3001
```

Quick Supabase Auth smoke test from Node can use the anon key and
`supabase.auth.signInWithPassword` with `username@fanpicks.local`.

## Current Known Risks

- RLS policies are broad from MVP development. Before public production, review
  row-level security with real Supabase Auth user IDs.
- Service role key was pasted during development. Rotate it before launch.
- Supabase backups/PITR should be enabled before inviting real users.
- The UI still uses local cache for responsiveness; remote sync failure should
  be surfaced more clearly to users in future work.
- There are no automated end-to-end tests yet.
- Lock/reopen currently has a manual test guide but no automated E2E coverage.
- Big Balls Data live sync has a unit-tested normalizer and has been manually
  smoke-tested against `/v1/wc2026/matches` locally. Production still needs a
  browser check after deploy.
- API quota should be protected with scheduled/background sync later; the
  current MVP runs automatic sync from Create Pool only when cached teams are
  missing.

## Recommended Next Work

1. Review and tighten Supabase RLS policies for authenticated users.
2. Add E2E tests for signup, login, create pool, join pool, save picks, lock
   picks, reopen picks before deadline, reject reopen after deadline, audit
   visibility, and second-browser login.
3. Add user-facing sync error states when Supabase writes fail.
4. Add a small admin/testing script to clean test users/profiles safely.
5. Deploy to Vercel with rotated service role key.
6. Enable Supabase backups/PITR and test a restore.
7. Run the sports data migration and verify Big Balls Data sync with the
   production API key.

## Change Log

Keep this short and newest-first. Record changes that affect future AI context.

- 2026-06-03: Fixed logout URL cleanup so private pool URLs are replaced with
  `/championships`, and added a lightweight Node test for the rule.
- 2026-06-03: Added Big Balls Data sports sync, Supabase `sports_*` cache
  tables, `/api/sports/sync`, `/api/sports/tournaments`, provider-backed team
  choices for Create Pool and Picks, and unit tests for sports normalization.
- 2026-06-03: Switched FIFA World Cup sync to Big Balls `/v1/wc2026/matches`,
  removed the normal user-facing refresh button, and made Create Pool
  automatically sync missing tournament teams in the background.
- 2026-06-03: Fixed bet removal persistence by adding the missing
  server-side `pool_bets` sync route, rolling back failed optimistic changes,
  and cleaning up the Add Bet choices layout.
- 2026-06-03: Added a Default Bets add-back section and simplified the Custom
  Bet form layout on the Bets page.
- 2026-06-03: Changed Bets page editing to draft changes plus explicit
  `Save pool`; Add/Remove no longer persists immediately.
- 2026-06-03: Added creator-only bet add/remove controls on the Bets page,
  blocked after lock date or after any participant locks picks.
- 2026-06-03: Upgraded route-transition feedback to a full-app loader overlay
  with top progress, while keeping secondary link/tab spinners.

- 2026-06-03: Added reusable loading states to the shared Button and wired
  auth, pool, leave, save, lock, and reopen actions to show active feedback.
- 2026-06-03: Added AI handoff maintenance rule so future code changes update
  the handoff/docs as part of completion.
- 2026-06-03: Fixed multi-select bet enforcement so users cannot select or lock
  more than the required number of picks, such as 5 teams for a Top 4 bet.
- 2026-06-03: Fixed checkbox uncheck crash by capturing the checked state before
  React state updates in `PredictionBoard`.
- 2026-06-03: Added server-enforced prediction lock/unlock business rule:
  accidental unlock before deadline, no edits/unlock after deadline.
- 2026-06-03: Switched auth direction from custom `app_accounts` password auth
  to Supabase Auth with username-to-internal-email mapping.
- 2026-06-03: Added Supabase persistence for prediction drafts, versions,
  locked picks, fingerprints, and audit events.
- 2026-06-03: Removed automatic publishing of old local browser pool cache to
  Supabase during refresh.

## Design Constraints For Future AI

- Keep the app dense, simple, and functional.
- Do not turn it into a marketing landing page.
- Do not add nested cards inside cards.
- Cards should be subtle with small radii.
- Use lucide icons for buttons where possible.
- Text must fit on mobile and desktop.
- Test navigation as real pages.
- Use the shared `Button` `loading` and `loadingLabel` props for async actions
  so users get consistent spinner/shine feedback and double-submit protection.
- Navigation links in the app shell and pool tabs should show pending feedback
  with a full-app overlay, top progress strip, and secondary link/tab spinner
  while route transitions are in flight.
- After meaningful frontend changes, run lint/build and test in the browser.
