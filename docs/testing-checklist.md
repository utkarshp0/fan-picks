# Testing Checklist

Run this before handing the app to real users.

## Commands

```bash
npm run lint
npm test
npm run build
```

## AI Handoff

After meaningful changes, confirm the handoff docs were updated:

- `AI_HANDOFF.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/testing-checklist.md`
- `docs/production-data-safety.md`

If no handoff update is needed, note the reason in the final response.

## Auth

1. Sign up with a new username.
2. Logout.
3. Login with the same username/password.
4. Try wrong password and confirm a friendly error.
5. Try an existing username on signup and confirm a friendly error.
6. Login from a second browser/profile.
7. Confirm auth buttons show a loading state and block double submits.
8. Logout from a pool detail URL and confirm the browser URL changes to
   `/championships`.

## Pools

1. Create a pool from a supported tournament.
2. Include at least one default bet.
3. Add one custom bet.
4. Confirm the new pool appears on `/championships`.
5. Copy the invite code.
6. Join from a second user.
7. Leave and confirm it no longer appears as active for that user.
8. Confirm create, join, and leave actions show a loading state and block double
   submits.
9. Confirm sidebar/mobile navigation shows the full-app loading overlay, top
   progress strip, and pending-link spinner when moving between pool pages.
10. As the pool creator, add a custom bet from the Bets page before lock and
    confirm it only appears in the draft list until `Save pool` is clicked.
11. As the pool creator, remove a bet before lock and confirm it only disappears
    from the draft list until `Save pool` is clicked.
12. Confirm removed tournament default bets appear in the Default Bets add-back
    section and can be added back to the draft.
13. Click `Discard changes` and confirm the original bet list returns.
14. Click `Save pool` and confirm added/removed bets are reflected on Picks.
15. As a participant, confirm the add/remove bet controls are not available.
16. After a participant locks picks or after the lock date passes, confirm bets
    are read-only.
17. Refresh after removing a bet and confirm it does not come back from
    Supabase.

## Sports Data

1. Confirm `BIG_BALLS_DATA_API_KEY`, `BIG_BALLS_DATA_BASE_URL`, and
   `BIG_BALLS_DATA_SYNC_LEAGUES` exist in the deployment environment.
2. Run `supabase/sports-data-migration.sql` before using the sync button.
3. Login and open `/championships/create`.
4. Confirm the create form automatically syncs or reads cached tournament data.
5. Confirm the create form shows synced team and fixture counts.
6. Create a FIFA World Cup pool and confirm team-based bets use synced team
   choices.
7. Open an existing pool's Picks page and confirm team bets use synced teams
   when the stored bet does not already have choices.
8. Confirm `/api/sports/sync` returns `401` when called without a logged-in
   Supabase session.

## Live Scores

1. Open `/live-scores` after login.
2. Confirm the page shows FIFA World Cup 2026, fixture count, source, and
   upcoming matches.
3. Confirm `/api/live-scores` returns cached fixtures without exposing provider
   keys.
4. Confirm the page has no manual provider refresh button.
5. Confirm match cards remain readable on mobile and desktop.
6. If `WORLDCUP26_API_URL` is configured later, temporarily break Big Balls
   credentials in a non-production environment and confirm fallback data is
   normalized.

## Predictions

See `docs/lock-testing-guide.md` for detailed lock/reopen testing.

1. Save picks as User A.
2. Save picks as User B.
3. For Top 4 teams, confirm selecting a fifth team is blocked.
4. Refresh both browsers and confirm picks remain.
5. Lock picks as User A.
6. Navigate to another pool tab/page and return; confirm picks remain locked.
7. Confirm locked picks cannot be edited.
8. Reopen picks before the lock date and confirm fields become editable.
9. Save changed picks and lock again.
10. Confirm fingerprint remains after refresh.
11. Test a pool with a past lock date and confirm picks cannot be edited or
    reopened.
12. Confirm save, lock, and reopen buttons show a loading state and block double
    submits.
13. Confirm pool detail tabs show the full-app loading overlay and pending-tab
    spinner when moving between Picks, Participants, Audit Log, and Bets.

## Automated Test Gap

Automated E2E tests are not added yet. The lock/reopen flow should be covered
with Playwright or Cypress before production release.

## Audit

Confirm Audit Log includes:

- Pool created
- Invite created
- Participant joined
- Participant left
- Bet added
- Bet removed
- Prediction field changed
- Picks saved
- Picks locked
- Picks reopened
