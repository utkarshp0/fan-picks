# Fan Picks AI Handoff

Last updated: 2026-06-06.

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
10. Preview and download a funny parchment-style Pool Agreement that seals
    after the lock date and records all active participants' final picks.
11. Create separate Match Pick rooms for one fixture and one prediction
    question, invite friends, and reveal correct users after the fixture result.

Avoid adding casino, odds, money, payout, wager, or sportsbook language.

## Important User Preferences

- Keep the app simple. No phase banners, no internal roadmap labels in the UI.
- Navigation must be real pages, not one-page scrolling sections.
- Left sidebar should remain.
- Top-level pages are:
  - `/championships`
  - `/match-picks`
  - `/live-scores`
  - `/championships/create`
  - `/championships/join`
- Match Pick pages are:
  - `/match-picks/create`
  - `/match-picks/join`
  - `/match-picks/[roomId]/picks`
  - `/match-picks/[roomId]/participants`
  - `/match-picks/[roomId]/audit`
  - `/match-picks/[roomId]/results`
- Pool detail pages are:
  - `/championships/[championshipId]/predictions`
  - `/championships/[championshipId]/participants`
  - `/championships/[championshipId]/audit`
  - `/championships/[championshipId]/rules`
  - `/championships/[championshipId]/agreement`
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
WORLDCUP26_API_URL=
FAN_PICKS_TEST_NOW=
```

`SUPABASE_SERVICE_ROLE_KEY` and `BIG_BALLS_DATA_API_KEY` are server-only. Never
expose them in browser code, logs, docs, screenshots, or commits. Both were
pasted during development; rotate them before production launch.

`FAN_PICKS_TEST_NOW` is optional and must not be set in production. It exists
only for local/staging/test runs that need to simulate before/after lock time.

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
- Pool creation goes through `POST /api/pools/create`. The server validates the
  Supabase Auth user, then writes the pool, creator participant, pool bets, and
  audit events with the service role. If any required write fails, it deletes
  the new pool row and returns an error so the UI does not show a fake-created
  pool that later disappears.
- Pool creation, joining, leaving, custom bets, audit events, prediction drafts,
  prediction versions, locks, and fingerprints are persisted to Supabase.
- Pool invite links use `/championships/join?code=...`. Logged-in users who
  open an invite link auto-join the pool. Logged-out users see an invite-aware
  login/signup message, then the join page continues with the code after auth.
- Prediction lock/unlock is enforced by server routes, not direct browser
  updates, so the authenticated user and lock date can be validated centrally.
- Pool Agreement preview/PDF is also server-derived. The browser calls
  `GET /api/pools/[championshipId]/agreement`, which validates the Supabase Auth
  user, verifies active pool membership, reloads the pool from Supabase with the
  service role, and builds the agreement model/PDF from that server snapshot.
  Do not build agreement PDFs from browser local storage or client cache.
- The Pool Agreement PDF starts with a deliberate two-page layout: page one is
  the agreement terms, page two starts with participant signatures and then
  shows recorded picks/audit summary. Larger pools must paginate signatures,
  recorded pick rows, and audit sections onto styled parchment continuation
  pages. Avoid letting PDFKit text flow past the parchment border, because that
  can auto-create a blank white overflow page.
- Sports data from Big Balls Data is also cached in Supabase. The browser reads
  cached `sports_*` rows and never calls the provider directly.
- World Cup 2026 sync uses Big Balls for fixtures/live scores and
  `worldcup26.ir/get/teams` for the qualified 48-team list when available.
  The endpoint can be overridden with `WORLDCUP26_TEAMS_API_URL`.
- Provider placeholder teams from future knockout fixtures, such as
  `Group E Winner`, `Group B 2nd Place`, or `THIRD PLACE GROUP ...`, are
  filtered by `src/lib/sports-team-utils.ts`. They can remain as fixture labels
  but must not become selectable pool prediction choices.

Relevant files:

- `src/lib/app-clock.ts`
- `src/lib/championship-store.ts`
- `src/lib/pool-supabase.ts`
- `src/lib/pool-agreement.ts`
- `src/lib/server-pool-agreement.ts`
- `src/lib/server-pools.ts`
- `src/lib/server-prediction-locks.ts`
- `src/lib/server-match-picks.ts`
- `src/lib/server-live-scores.ts`
- `src/types/championship.ts`
- `src/types/match-picks.ts`

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
- Lock-sensitive server code must use `src/lib/app-clock.ts`; do not use raw
  `new Date()`/`Date.now()` for lock decisions. Pool lock dates are interpreted
  as end-of-day IST. Match Pick locks are exact timestamps.

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

## Pool Agreement

The Pool Agreement is a friendly, parchment-style downloadable PDF for each
pool. It is intentionally not a legal contract; it is a funny receipt for
bragging rights and transparent picks.

Routes and files:

- UI route: `/championships/[championshipId]/agreement`
- API route: `GET /api/pools/[championshipId]/agreement`
- JSON preview: `GET /api/pools/[championshipId]/agreement`
- PDF download: `GET /api/pools/[championshipId]/agreement?format=pdf`
- Pure rules/model: `src/lib/pool-agreement.ts`
- Server fetch/PDF renderer: `src/lib/server-pool-agreement.ts`
- Client fetch/download helper: `src/lib/pool-agreement-client.ts`
- Tests: `tests/pool-agreement.test.ts`
- The agreement API explicitly uses `runtime = "nodejs"` because PDFKit needs a
  Node runtime on Vercel.
- The PDF renderer imports `pdfkit/js/pdfkit.standalone.js`, not `pdfkit`.
  The standalone build embeds the standard `.afm` font metrics in JS. The
  normal Node build tries to read `node_modules/pdfkit/js/data/Helvetica.afm` at
  runtime, which can fail in Vercel serverless bundles.
- `next.config.ts` still includes `node_modules/pdfkit/js/data/**/*` in output
  file tracing as extra defense, but the standalone import is the primary fix.

Rules:

- Only active pool participants can preview or download the agreement.
- The agreement always has a visible preview page.
- Before the pool lock deadline it is `draft`.
- Draft agreements show pool details, participants, clauses, identifiers, and
  audit summary, but do not reveal any participant picks.
- After the pool lock deadline it is `sealed`.
- Sealed agreements include every active participant's selected option(s) per
  bet.
- If a participant locked picks before the deadline, the locked version is used.
- If a participant never manually locked but has a saved draft when the deadline
  passes, the latest saved draft is used as final.
- Left participants can appear in the Parties section as `left` for
  transparency, but their picks are not included in the recorded picks schedule.
- Pool lock dates are interpreted as end-of-day IST through `app-clock.ts`.
- Agreement identity includes:
  - Invite code
  - Agreement ID: `FPA-{inviteCode}-{lockDate YYYYMMDD}`
  - SHA-256 fingerprint over the stable agreement snapshot
- The PDF includes an audit summary, not the full audit event log. The full log
  remains on the Audit Log page.
- The preview/PDF includes a "Hereby Agreed" attestation section so it reads
  like an actual friendly agreement, not only a certificate.

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

## Live Scores

Live Scores is a standalone display feature. Match Picks read the same cached
fixture data, but live-score provider/source/cache details should stay out of
the product UI.

Current implementation:

- Top-level route: `/live-scores`.
- Server route: `/api/live-scores`.
- UI: `src/components/live-scores/live-scores-page.tsx`.
- Server service: `src/lib/server-live-scores.ts`.
- Primary provider: Big Balls Data.
- Optional fallback adapter: `src/lib/worldcup26-fallback.ts`.
- The browser polls the app server every 60 seconds.
- The server reads `sports_fixtures` from Supabase first.
- Cached live-score data is treated as fresh for about 10 minutes.
- If cache is missing or stale, the server refreshes from Big Balls Data.
- If Big Balls fails and `WORLDCUP26_API_URL` is configured, the fallback
  adapter tries that URL and normalizes a World Cup match feed.

Important caveat: `worldcup26.ir` advertised a free API, but its public docs
page did not expose a stable JSON endpoint during implementation and obvious
`/api/*` routes returned 404. The fallback is implemented but disabled unless
`WORLDCUP26_API_URL` is set to a verified endpoint.

The Live Scores UI is inspired by the provided mobile score app screenshots:
score-first hero card, date chips, rounded match cards, live/upcoming/completed
sections, and no manual provider refresh button. Do not show provider/source or
cache metadata in the product UI; that belongs in logs/debugging only. The API
should return the full cached fixture set for the selected tournament, not a
small preview cap. The UI filters by selected local date on the client, shows a
full tournament fixture list, and updates an inline Match Details panel when a
match card is selected.

## Match Picks

Match Picks are a separate top-level feature from Pools. Keep them separate.

Product rules:

- UI wording should say Match Picks / Match Pick room, not Match Bets.
- One Match Pick room equals one fixture plus one pick type.
- There is no point system or leaderboard in the MVP.
- Each room declares correct users for that one question after the final result.
- The three default pick types are Winner, Exact score, and Both teams score.
- Winner choices must show the real team names plus Draw, not Home/Away.
- Exact score inputs must show the real team names, not Home score/Away score.
- Create should show fixtures from the next three days only. If none are inside
  that window, show the next six upcoming fixtures.
- Show all kickoff and lock times in IST.
- Server lock rule is `lock_at = kickoff_at - 2 hours`.
- Saves after `lock_at` are rejected on the server.
- Other participants' picks stay hidden until `lock_at`.
- Match Pick room headers show an invite panel with a shareable
  `/match-picks/join?code=...` link, the raw invite code, a ready-to-copy
  message, and native share support where available. The Join page prefills the
  invite code from the `code` query parameter and auto-joins logged-in users.
  Logged-out users see an invite-aware login/signup message before continuing.
- Pool and Match Pick join links emit Open Graph/Twitter metadata with a
  generated branded preview image from `/api/share-image`, so platforms such as
  WhatsApp and X/Twitter can render a rich card instead of only a plain URL.
- Invite preview images are code-specific and versioned through
  `src/lib/share-metadata.ts`. Keep explicit width/height/type/alt metadata and
  a banner-style generated image so WhatsApp does not fall back to plain text.
- App-generated invite links include `preview=v2` because WhatsApp can cache
  the page URL itself.
- Match Picks and Live Scores use a logo-free generated stadium artwork from
  `public/brand/world-cup-stadium-night.png` plus stylized team spotlight cards
  for visual polish. Do not introduce real player/captain photos unless the app
  has a licensed, reliable source for those images.
- Pool prediction team choices use `src/lib/team-display.ts` for flag/region
  presentation only. Saved picks remain plain team names, and validation still
  comes from the existing selection-count rules.
- Results are scored from synced `sports_fixtures`, not user input.
- Winner copy should be light and funny, for example:
  `Nobody got this one. Football chose chaos.`

Core files:

- `src/components/match-picks/match-picks-pages.tsx`
- `src/data/lock-test-scenarios.ts`
- `src/lib/match-pick-rules.ts`
- `src/lib/match-picks-client.ts`
- `src/lib/server-match-picks.ts`
- `src/types/match-picks.ts`
- `tests/match-picks.test.ts`
- `tests/app-clock.test.ts`
- `tests/lock-test-scenarios.test.ts`
- `supabase/match-picks-migration.sql`

Routes:

- `/match-picks`
- `/match-picks/create`
- `/match-picks/join`
- `/match-picks/[roomId]/picks`
- `/match-picks/[roomId]/participants`
- `/match-picks/[roomId]/audit`
- `/match-picks/[roomId]/results`

API:

- `GET /api/match-picks/fixtures`
- `GET /api/match-picks/rooms`
- `POST /api/match-picks/rooms`
- `POST /api/match-picks/join`
- `GET /api/match-picks/[roomId]`
- `POST /api/match-picks/[roomId]/leave`
- `POST /api/match-picks/[roomId]/save`
- `POST /api/match-picks/[roomId]/score`

Leaving a Match Pick room soft-updates the current user's
`match_pick_participants.left_at`, keeps room history/submissions intact, writes
a `participant_left` audit event, and removes the room from that user's active
Match Picks list.

## Supabase SQL

Run these for a clean deployment:

- `supabase/schema.sql`
- `supabase/pool-bets-migration.sql`
- `supabase/sports-data-migration.sql`
- `supabase/match-picks-migration.sql`
- `supabase/rls-migration.sql`
- `supabase/pool-creator-participant-backfill.sql`

If production shows `infinite recursion detected in policy for relation
"participants"`, run:

- `supabase/rls-recursion-fix.sql`

That hotfix only replaces RLS helper functions/policies. It does not delete app
data.

`pool-bets-migration.sql` includes a delete policy, but bet add/remove no
longer depends on browser-side delete permission because the app uses the
server sync route.

`pool-creator-participant-backfill.sql` repairs historical orphaned pools where
`championships.created_by` exists but the creator participant row was never
persisted. It does not modify pools where the creator has a participant row with
`left_at`.

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
- `match_pick_rooms`
- `match_pick_participants`
- `match_pick_submissions`
- `match_pick_versions`
- `match_pick_audit_events`
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
- Reusable lock-test users are defined in
  `src/data/lock-test-scenarios.ts`:
  - `lock-test-asha`
  - `lock-test-dev`
- Run `npm run seed:lock-test-data` only against local/staging/test Supabase
  projects unless test data is intentionally wanted in production. It creates
  active, past-lock, and scored Pool/Match Pick scenarios tied to those two
  users.
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
npm run seed:lock-test-data
```

Local dev server usually runs on:

```bash
npm run dev -- --port 3001
```

Quick Supabase Auth smoke test from Node can use the anon key and
`supabase.auth.signInWithPassword` with `username@fanpicks.local`.

## Current Known Risks

- RLS policies now use `SECURITY DEFINER` helper functions for pool membership
  checks. Do not reintroduce direct `public.participants` subqueries inside the
  `participants` SELECT policy, or Supabase can raise infinite recursion.
- Service role key was pasted during development. Rotate it before launch.
- Supabase backups/PITR should be enabled before inviting real users.
- The UI still uses local cache for responsiveness; remote sync failure should
  be surfaced more clearly to users in future work.
- There are no automated end-to-end tests yet.
- Lock/reopen has deterministic unit coverage through `FAN_PICKS_TEST_NOW` and
  seedable manual test data, but there are still no browser E2E tests.
- Big Balls Data live sync has a unit-tested normalizer and has been manually
  smoke-tested against `/v1/wc2026/matches` locally. The local
  `/api/live-scores` route returned 72 fixtures, 72 upcoming, 0 live, and
  source `big-balls-data` on 2026-06-03.
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

- 2026-06-06: Replaced the trophy-style product logo with a reusable Fan Picks
  brand mark in `src/components/brand/fan-picks-mark.tsx`, mirrored it in
  `public/icon.svg`, wired it into app chrome/auth/loading states, and updated
  generated share preview imagery.
- 2026-06-06: Added `src/lib/app-clock.ts` with `FAN_PICKS_TEST_NOW` support,
  standardized pool lock dates as end-of-day IST, wired server pool/Match Pick
  lock checks to the shared clock, and added reusable lock-test users/scenarios
  plus seed command `npm run seed:lock-test-data`.
- 2026-06-06: Added a logo-free generated World Cup-style stadium visual asset
  and applied it to Live Scores and Match Picks with richer fixture cards and
  stylized team spotlight visuals.
- 2026-06-06: Fixed pool creation integrity by routing creates through
  `POST /api/pools/create`, requiring an active creator participant before
  success, cleaning up failed partial creates, showing create errors in the UI,
  and adding `supabase/pool-creator-participant-backfill.sql` for historical
  orphaned creator pools.
- 2026-06-06: Added rich invite links for Pools and Match Picks with
  `/championships/join?code=...` and `/match-picks/join?code=...`, auto-join
  for logged-in users, invite-aware auth messaging, Open Graph/Twitter metadata,
  and generated branded share preview images.
- 2026-06-06: Added friendlier Match Picks invites with shareable join links,
  join-code query prefill, ready-to-copy invite messages, and native share
  fallback behavior.
- 2026-06-06: Added Match Picks leave flow with
  `POST /api/match-picks/[roomId]/leave`, sidebar/list and room-header Leave
  buttons, soft-leave participant persistence, and `participant_left` audit
  events.
- 2026-06-06: Added Pool Agreement preview/download with a parchment-style PDF,
  server-only Supabase source data, draft/sealed rules, Agreement ID/fingerprint,
  recorded picks schedule after lock, audit summary, route
  `/championships/[championshipId]/agreement`, API
  `/api/pools/[championshipId]/agreement`, and unit tests.
- 2026-06-06: Hardened Pool Agreement PDF download for Vercel by forcing the
  agreement API to Node.js runtime and added a "Hereby Agreed" participant
  attestation section to the preview/PDF.
- 2026-06-06: Switched agreement PDF generation to
  `pdfkit/js/pdfkit.standalone.js` so Vercel does not need to open PDFKit `.afm`
  font metric files from the serverless filesystem at runtime.
- 2026-06-06: Fixed agreement PDF pagination by moving participant signatures to
  the second parchment page and adding a page-count regression test.
- 2026-06-07: Hardened agreement PDF pagination for larger pools so every
  participant signature and recorded pick row continues onto styled parchment
  pages when content exceeds one page.
- 2026-06-04: Added separate Match Picks MVP with one fixture plus one question
  per room, next-three-days fixture creation, IST lock wording, two-hours-before
  kickoff server lock, invite/join, save, audit, and result scoring.
- 2026-06-04: Added `supabase/rls-recursion-fix.sql` and updated
  `rls-migration.sql` to replace recursive participant membership policies with
  `SECURITY DEFINER` helper functions.
- 2026-06-04: Removed Live Scores source/cache metadata from the UI and
  tightened match-card layout so mobile score pills and long team names do not
  collide.
- 2026-06-03: Added standalone Live Scores page, `/api/live-scores`,
  cache-first server live-score service, Big Balls primary refresh, optional
  `worldcup26.ir` fallback adapter via `WORLDCUP26_API_URL`, and sidebar nav.
- 2026-06-03: Fixed Live Scores browsing so all cached World Cup fixtures are
  returned, date chips filter matches, and selecting a fixture updates an inline
  match details panel.
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
- Use `src/components/brand/fan-picks-mark.tsx` as the Fan Picks brand mark in
  app chrome, auth, loading states, and branded surfaces. `public/icon.svg`
  mirrors that mark for favicon/PWA usage. Use trophy icons only when the icon
  means tournament/pool, not as the product logo.
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
