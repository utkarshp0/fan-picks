# Lock And Reopen Testing Guide

Use this guide to test the prediction lock business rule before release.

## Business Rule

- Users can save drafts until the lock date passes.
- Users can lock picks before the lock date.
- Users can reopen accidentally locked picks before the lock date.
- After the lock date passes, picks cannot be edited or reopened.
- If a user never clicks Lock, the latest saved draft is final after the lock
  date passes.

## Manual Test: Lock And Reopen Before Deadline

1. Login as User A.
2. Create or open a pool with a future lock date.
3. Join the pool if needed.
4. Go to `Picks`.
5. Fill every bet.
6. Click `Save picks`.
7. For `Top 4 teams`, try selecting a fifth team.
8. Confirm the fifth choice is blocked and the count cannot exceed `4/4`.
9. Click `Lock picks`.
10. Confirm:
   - Badge says `Locked`.
   - Inputs are disabled.
   - Fingerprint is visible.
   - Button changes to `Reopen picks`.
11. Navigate to another pool page, such as `Participants` or `Audit Log`.
12. Return to `Picks`.
13. Confirm it is still locked.
14. Click `Reopen picks`.
15. Confirm:
   - Badge returns to `Editable`.
   - Inputs are enabled.
   - Fingerprint is removed.
   - Audit Log shows `Picks reopened`.
16. Change one pick, save, and lock again.
17. Refresh the page and confirm it remains locked.

## Manual Test: After Deadline

The easiest way to simulate the tournament starting is to move the pool's
`lock_date` into the past in Supabase.

1. Create a pool with a future lock date.
2. Save picks as User A.
3. Lock picks as User A.
4. Copy the pool ID from the URL:
   `/championships/<pool-id>/predictions`
5. In Supabase SQL Editor, run:

```sql
update public.championships
set lock_date = current_date - interval '1 day'
where id = '<pool-id>';
```

6. Refresh the app.
7. Confirm:
   - Inputs are disabled.
   - `Reopen picks` is not available.
   - `Save picks` and `Lock picks` are disabled.
   - API unlock should fail if called directly.

## Manual Test: User Did Not Click Lock

1. Create a pool with a future lock date.
2. Save picks but do not click `Lock picks`.
3. Move the pool's `lock_date` into the past using the SQL above.
4. Refresh the app.
5. Confirm:
   - Inputs are disabled.
   - Latest saved picks are visible to the owner.
   - Other users can see picks because the lock date has passed.

## API Guard Smoke Tests

Unauthenticated requests must fail:

```bash
curl -i -X POST http://localhost:3001/api/predictions/lock \
  -H "Content-Type: application/json" \
  -d "{\"championshipId\":\"test\"}"
```

Expected: `401 Login required`.

Repeat for:

```bash
curl -i -X POST http://localhost:3001/api/predictions/unlock \
  -H "Content-Type: application/json" \
  -d "{\"championshipId\":\"test\"}"
```

Expected: `401 Login required`.

## Automated Test Gap

We do not yet have Playwright/Cypress E2E tests in the repo. Before production,
add automated coverage for:

- Signup/login.
- Create pool.
- Save picks.
- Lock picks.
- Reject over-limit picks such as 5 selections for a 4-pick bet.
- Navigate away/back and confirm locked state persists.
- Reopen before deadline.
- Reject reopen after deadline.
- Audit events for lock and reopen.
