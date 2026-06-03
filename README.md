# Fan Picks

For fans who back their opinions.

Fan Picks is a transparency-first sports prediction challenge platform. The MVP
stack is intentionally simple and free to operate:

- Next.js App Router
- TypeScript
- TailwindCSS
- shadcn-style UI utilities
- Supabase-ready client foundation
- Big Balls Data sports-data sync, cached in Supabase
- Vercel-ready deployment target

## Product Guardrails

- This is not a gambling or betting platform.
- Predictions are hidden before lock and immutable after lock.
- Auditability, signatures, timestamps, and prediction fingerprints are core to
  the product.
- Major UI and infrastructure steps should be approved before implementation.

## Getting Started

Create `.env.local` when Supabase is configured:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BIG_BALLS_DATA_API_KEY=
BIG_BALLS_DATA_BASE_URL=https://api.bigballsdata.com
BIG_BALLS_DATA_SYNC_LEAGUES=fifa-world-cup-2026:wc2026
```

The service-role key and Big Balls Data key are server-only. Do not prefix them
with `NEXT_PUBLIC_`, and do not paste them into client code.

Run these SQL files in Supabase before using the app with real users:

```bash
supabase/schema.sql
supabase/pool-bets-migration.sql
supabase/sports-data-migration.sql
```

Production login and signup use Supabase Auth. The app keeps the username and
display name in `profiles`, while Supabase Auth stores passwords and sessions.
`SUPABASE_SERVICE_ROLE_KEY` is used only by the server signup route to create
username/password users without email verification.

Sports data is synced through `/api/sports/sync` after login. The route calls
Big Balls Data from the server, writes normalized tournaments, teams, fixtures,
and sync history to Supabase, and the browser reads only the cached data.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `npm run dev` starts the local app.
- `npm run build` creates a production build.
- `npm run lint` runs ESLint.
- `npm test` runs Node tests.

## Production Checklist

1. Run all Supabase SQL files listed above.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` to the hosting provider.
3. Confirm Supabase Auth email/password provider is enabled.
4. Run `npm run lint` and `npm run build`.
5. Run `npm test`.
6. Sign up with a test account in one browser.
7. Click `Refresh sports data` on Create Pool and confirm teams/fixtures sync.
8. Login with the same account in a second browser.
9. Create a pool, copy its invite code, and join from the second browser.
10. Save picks from both users and confirm the audit page shows both histories.

See `docs/production-data-safety.md` for the data retention, backup, and
pre-launch verification checklist.
See `docs/lock-testing-guide.md` for the prediction lock/reopen test plan.

## AI Handoff

If continuing this project in another AI coding tool, start with
`AI_HANDOFF.md`. It captures the latest product decisions, architecture,
Supabase Auth setup, data model, known risks, and next steps.

## Default Design Recommendation

Dark-first, mobile-first, premium sports platform inspired by OneFootball,
Apple Wallet, and Linear. Avoid casino aesthetics, neon clutter, and gambling
language.

## Current App

Complete:

- Username/password signup and login backed by Supabase Auth
- Sidebar navigation with separate pages for Pools, Create Pool, Join Pool, and
  pool-specific Picks, Participants, Audit Log, and Bets pages
- Pool creation for supported tournaments
- Big Balls Data sync into Supabase for tournament teams and fixtures
- Invite-code join flow
- Creator-editable pool bets before lock
- Prediction drafts, locks, reopen-before-deadline, fingerprints, and audit log
- Loading states for async actions and route transitions

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
