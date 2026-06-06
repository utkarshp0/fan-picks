# Architecture

Fan Picks is a Next.js App Router app backed by Supabase. This document gives
future contributors a map of where important behavior lives.

## App Shell And Routing

The main shell is `src/components/app/app-shell.tsx`.

- If there is no profile/session, it renders `LoginScreen`.
- If authenticated, it renders the sidebar and page content.
- Logout clears auth/profile state and replaces the current URL with
  `/championships` so private pool URLs are not left in the address bar.
- Top-level navigation:
  - Pools: `/championships`
  - Match Picks: `/match-picks`
  - Live Scores: `/live-scores`
  - Create Pool: `/championships/create`
  - Join Pool: `/championships/join`
- Pool-specific navigation appears only for `/championships/[id]/*` routes.

Routes live under `src/app/championships`.

## Auth Flow

The user sees username/password auth.

Under the hood:

1. Signup posts to `/api/auth/signup`.
2. The server route uses `SUPABASE_SERVICE_ROLE_KEY` to create a Supabase Auth
   user with an internal email like `username@fanpicks.local`.
3. The route creates a matching row in `profiles`.
4. The client immediately logs in with `supabase.auth.signInWithPassword`.
5. Session hydration reads the current Supabase Auth user and loads `profiles`.

Core files:

- `src/lib/auth-identity.ts`
- `src/lib/account-auth.ts`
- `src/lib/server-account-auth.ts`
- `src/lib/supabase.ts`
- `src/lib/supabase-server.ts`
- `src/components/auth/guest-session-provider.tsx`

## Pool Flow

The pool store is `src/lib/championship-store.ts`.

It owns UI-facing actions:

- `refreshChampionshipsFromSupabase`
- `createChampionship`
- `joinChampionshipByCode`
- `leaveChampionship`
- `savePredictionDraft`
- `lockPrediction`
- `addPoolBet`
- `removePoolBet`

Pool invite helpers also live in `src/lib/championship-store.ts`:

- `getPoolInvitePath`
- `createPoolInviteMessage`

Pool invite links use `/championships/join?code=...`. The join page receives
the code from the route, pre-fills the form, and auto-joins logged-in users.
If a logged-out user opens the link, `AppShell` shows an invite-aware
login/signup message before the join page continues after auth.

The Supabase adapter is `src/lib/pool-supabase.ts`.

It owns database reads/writes:

- Fetch pools with participants, bets, predictions, versions, audit events.
- Create pools through `POST /api/pools/create`. The server validates the
  Supabase Auth user and writes the pool, creator participant, bets, and audit
  events with the service role. If any required write fails, the new pool row is
  removed so an orphan pool cannot later disappear from `My pools`.
- Upsert participants.
- Soft-leave participants.
- Replace the active pool bet list.
- Save prediction submissions and versions.
- Lock predictions.
- Insert/upsert audit events.

## Tournament Templates

Tournament/bet defaults live in `src/data/templates.ts`.

The current product intent is to offer a small number of major tournaments and
let pool creators add custom bets.

Sports data is not read directly from a third-party API in React. Big Balls
Data is integrated as a server-side source and cached in Supabase:

- `src/lib/big-balls-data.ts` calls Big Balls Data with the server-only
  `BIG_BALLS_DATA_API_KEY`. FIFA World Cup 2026 uses the dedicated
  `/v1/wc2026/matches` endpoint; generic football leagues use match endpoints
  as fallback.
- `src/app/api/sports/sync/route.ts` validates a Supabase Auth session before
  spending API quota.
- `src/lib/server-sports-data.ts` writes normalized rows to
  `sports_tournaments`, `sports_teams`, `sports_fixtures`, and
  `sports_sync_runs`.
- `src/app/api/sports/tournaments/route.ts` returns cached tournament snapshots
  to the browser.
- `src/lib/sports-data-client.ts` enriches template defaults with synced team
  choices.

Create Pool automatically checks cached tournament data. If the selected
tournament is missing teams, the app syncs in the background after login. Once
data is synced, team-based default bets use the cached team list from Supabase
instead of stale local arrays. Existing pools can also use cached team choices
on the prediction page when their stored bet does not already include choices.

## Live Scores

Live Scores is intentionally separate from prediction and pool logic.

Core files:

- `src/app/live-scores/page.tsx`
- `src/components/live-scores/live-scores-page.tsx`
- `src/app/api/live-scores/route.ts`
- `src/lib/server-live-scores.ts`
- `src/lib/worldcup26-fallback.ts`

Behavior:

- The browser reads `/api/live-scores`.
- The server reads cached `sports_fixtures` first.
- Cached data is considered fresh for about 10 minutes.
- If cache is missing or stale, the server refreshes from Big Balls Data.
- Big Balls remains the primary verified provider for World Cup 2026.
- `worldcup26.ir` fallback is supported through optional `WORLDCUP26_API_URL`,
  but it is not enabled by default because the public docs page did not expose a
  stable JSON endpoint during implementation.
- The UI polls the app server every 60 seconds. It never calls provider APIs
  from the browser.

The page currently displays live, upcoming, and completed fixtures. The
live-score API returns the full cached fixture set for the tournament; the page
handles date filtering on the client with date chips, keeps an all-fixtures
section available, and updates an inline Match Details panel when a fixture is
selected.

## Match Picks

Match Picks are separate from Pools. One Match Pick room is one fixture plus one
question type. There is no points leaderboard in the MVP; each room simply
declares who got that one question right.

Core files:

- `src/components/match-picks/match-picks-pages.tsx`
- `src/lib/match-pick-rules.ts`
- `src/lib/server-match-picks.ts`
- `src/lib/match-picks-client.ts`
- `src/types/match-picks.ts`
- `supabase/match-picks-migration.sql`

Routes:

- `/match-picks`
- `/match-picks/create`
- `/match-picks/join`
- `/match-picks/[roomId]/picks`
- `/match-picks/[roomId]/participants`
- `/match-picks/[roomId]/audit`
- `/match-picks/[roomId]/results`

API routes:

- `GET /api/match-picks/fixtures`
- `GET /api/match-picks/rooms`
- `POST /api/match-picks/rooms`
- `POST /api/match-picks/join`
- `GET /api/match-picks/[roomId]`
- `POST /api/match-picks/[roomId]/leave`
- `POST /api/match-picks/[roomId]/save`
- `POST /api/match-picks/[roomId]/score`

Behavior:

- Create shows only fixtures in the next three days. If none exist, it falls
  back to the next six upcoming fixtures.
- All kickoff and lock wording is displayed in IST.
- Lock time is calculated server-side as fixture kickoff minus two hours.
- Save is rejected server-side after `lock_at`.
- Other participants' picks are hidden until `lock_at`.
- Leaving a Match Pick room sets the active participant row's `left_at`, keeps
  history intact, writes a `participant_left` audit event, and removes the room
  from that user's active list.
- Room invites use a shareable `/match-picks/join?code=...` link. The room
  header exposes the raw code, full link, ready-to-copy message, and native
  share action where supported. The Join page prefills from the `code` query
  parameter and auto-joins logged-in users. Logged-out users see an
  invite-aware auth message first.
- Winner and exact-score labels use actual team names, never Home/Away wording
  in the UI.
- Default question types are Winner, Exact score, and Both teams score.
- Results use the synced fixture final score and witty winner copy.

Pool creators can add or remove bets in a draft list on the Bets page before
the lock date, as long as nobody has locked picks. Participants cannot edit
bets. Removed tournament defaults appear in a Default Bets add-back section.
Add/remove does not persist immediately; `Save pool` writes `bet_added` or
`bet_removed` audit events and syncs the active `pool_bets` list to Supabase
through `/api/pool-bets/sync`. The server route uses the service role after
validating the logged-in user is the pool creator, the lock date has not passed,
and nobody has locked picks. If sync fails, the UI rolls back the optimistic
local change and shows an error message.

## Prediction Locking

Prediction UI is `src/components/championship/prediction-board.tsx`.

Rules:

- Picks can be saved until locked or until the lock date passes.
- Locking creates a fingerprint using SHA-256.
- Locked picks should not be editable.
- Locked picks can be reopened only before the lock date, for accidental locks.
- After the lock date passes, picks cannot be edited or reopened.
- Before lock, users can see their own picks; other users' picks stay hidden.

### Lock Time Source

Lock-sensitive server code must use `src/lib/app-clock.ts`, not raw
`new Date()` or `Date.now()`.

- Production uses the real server clock.
- Local/test/staging may set `FAN_PICKS_TEST_NOW` to simulate before/after lock
  behavior without waiting for real dates.
- Pool `lockDate` values are date-only product dates and are evaluated at the
  end of that date in IST.
- Match Pick `lock_at` values are exact timestamps calculated as kickoff minus
  two hours.

The browser may disable buttons for good UX, but every write endpoint must
repeat the lock check server-side.

Lock/unlock persistence is server-enforced:

- `src/app/api/predictions/lock/route.ts`
- `src/app/api/predictions/unlock/route.ts`
- `src/lib/server-prediction-locks.ts`

The server validates the Supabase Auth token, confirms the participant belongs
to the logged-in user, checks the lock date, and writes the submission,
participant status, fingerprint, and audit event.

Selection limits are enforced before persistence:

- Checkbox UI disables additional choices after `selectionCount`.
- `savePredictionDraft` rejects over-limit picks.
- Server lock rejects any latest version that does not have exactly the required
  number of picks for each bet.

## Lock Test Data

Reusable lock-test users and scenario IDs live in
`src/data/lock-test-scenarios.ts`.

Run this only against local/staging/test Supabase projects unless you
intentionally want test data in production:

```bash
npm run seed:lock-test-data
```

The seed creates/updates two Supabase Auth users:

- `lock-test-asha`
- `lock-test-dev`

It also creates active, past-lock, and scored scenarios for Pools and Match
Picks so manual QA can verify save, lock, reopen, reveal, and scoring behavior
without waiting for real tournament dates.

## Audit

Audit events are generated in `src/lib/championship-store.ts` and persisted by
`src/lib/pool-supabase.ts`.

Important audit types are defined in `src/types/championship.ts`.

Lock-related audit types:

- `prediction_locked`
- `prediction_unlocked`

## Share Previews

Pool and Match Pick join pages define Open Graph and Twitter metadata for rich
platform previews. Both use `/api/share-image?kind=pool|match`, implemented in
`src/app/api/share-image/route.tsx`, to generate a branded 1200x630 image for
WhatsApp, X/Twitter, Slack, and similar link unfurlers.

`src/lib/share-metadata.ts` resolves the app base URL from
`NEXT_PUBLIC_APP_URL`, `VERCEL_URL`, or `https://fan-picks.vercel.app`.

## Brand Assets

The reusable product mark lives in
`src/components/brand/fan-picks-mark.tsx`. Use it for app chrome, auth, loading
states, and other branded surfaces.

`public/icon.svg` mirrors the same mark for favicon/PWA usage.
`src/app/api/share-image/route.tsx` uses a matching mark inside generated
Open Graph preview images.

The tournament visual asset lives at
`public/brand/world-cup-stadium-night.png`. It is an AI-generated,
logo-free stadium scene used as controlled background texture for Live Scores
and Match Picks. Keep real player/captain imagery out of the UI unless a
licensed and reliable data source is added.

Trophy icons should still be used when the UI means pool, tournament, or
competition. They should not be used as the Fan Picks product logo.

## UI Interaction Pattern

Async actions should use the shared `Button` loading API:

- `loading`
- `loadingLabel`

This gives users a consistent spinner, disabled state, and subtle shine effect
while auth, pool, prediction, lock, and unlock actions are running.

Route navigation has separate feedback:

- A full-app overlay appears while a route transition is pending.
- The overlay includes the Fan Picks mark, spinner, and top progress strip.
- App shell links and pool detail tabs keep a smaller secondary spinner on the
  pending destination.

## Data Safety

See `docs/production-data-safety.md`.
