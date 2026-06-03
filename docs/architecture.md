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

The Supabase adapter is `src/lib/pool-supabase.ts`.

It owns database reads/writes:

- Fetch pools with participants, bets, predictions, versions, audit events.
- Create pools.
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

## Audit

Audit events are generated in `src/lib/championship-store.ts` and persisted by
`src/lib/pool-supabase.ts`.

Important audit types are defined in `src/types/championship.ts`.

Lock-related audit types:

- `prediction_locked`
- `prediction_unlocked`

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
