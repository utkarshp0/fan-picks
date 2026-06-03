# Fan Picks

For fans who back their opinions.

Fan Picks is a transparency-first sports prediction challenge platform. The MVP
stack is intentionally simple and free to operate:

- Next.js App Router
- TypeScript
- TailwindCSS
- shadcn-style UI utilities
- Supabase-ready client foundation
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
```

The service-role key is server-only. Do not prefix it with `NEXT_PUBLIC_`, and
do not paste it into client code.

Run these SQL files in Supabase before using the app with real users:

```bash
supabase/schema.sql
supabase/pool-bets-migration.sql
```

Production login and signup use Supabase Auth. The app keeps the username and
display name in `profiles`, while Supabase Auth stores passwords and sessions.
`SUPABASE_SERVICE_ROLE_KEY` is used only by the server signup route to create
username/password users without email verification.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `npm run dev` starts the local app.
- `npm run build` creates a production build.
- `npm run lint` runs ESLint.

## Production Checklist

1. Run all Supabase SQL files listed above.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` to the hosting provider.
3. Confirm Supabase Auth email/password provider is enabled.
4. Run `npm run lint` and `npm run build`.
5. Sign up with a test account in one browser.
6. Login with the same account in a second browser.
7. Create a pool, copy its invite code, and join from the second browser.
8. Save picks from both users and confirm the audit page shows both histories.

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

## Phase 1 Status

Complete:

- App shell with desktop rail and mobile bottom navigation
- Responsive dashboard foundation
- Reusable UI primitives
- Seeded FIFA World Cup 2026 template data
- Loading and error states
- PWA manifest and app icon

## Phase 2 Status

Complete:

- Anonymous guest session created automatically in the browser
- Editable local guest profile
- No email, OTP, password, or account recovery flow
- Designed to migrate later to Supabase anonymous auth when keys are connected

## Phase 3 Status

Complete:

- Local championship creation from the FIFA World Cup 2026 template
- Automatic invite code and slug generation
- Creator added as first participant from the anonymous profile
- Championship detail view with Overview, Rules, Participants, Predictions,
  Audit Log, and Results tabs
- Local audit events for championship creation, creator join, rules generation,
  and invite creation

## Phase 4 Status

Complete:

- Invite card with championship URL, invite code, and copy action
- Join-by-code form for anonymous guests
- Rules acceptance gate before joining
- Typed-name digital signature capture
- Participant statuses for role, signed, submission, and lock state
- Audit events for participant joins, rules acceptance, and signatures

## Phase 5 Status

Complete:

- Prediction draft form for all seeded World Cup 2026 categories
- Version history created on every draft save
- Final prediction lock with immutable post-lock UI
- SHA256 fingerprint generation for locked picks
- Audit events for draft saves and locked predictions
- Hidden-before-lock participant prediction display

## Phase 6 Status

Complete:

- Filterable public audit timeline
- Transparency dashboard inside the championship page
- Integrity score derived from actual local championship state
- Prediction version history for every participant
- Fingerprint verification surface for locked submissions
- Public last-edited visibility per participant

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
