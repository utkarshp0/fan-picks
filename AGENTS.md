<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Fan Picks Agent Handoff

Before changing this project, read:

1. `AI_HANDOFF.md`
2. `docs/architecture.md`
3. `docs/production-data-safety.md`
4. `docs/testing-checklist.md`

The active project path is `C:\QA\fan-picks`.

Important: the app now uses Supabase Auth. Do not revive the legacy custom
`app_accounts` auth flow.

## Definition Of Done For AI Changes

After every meaningful code, schema, auth, data-flow, route, product-decision,
or deployment change, update the handoff docs in the same change:

- `AI_HANDOFF.md` for current state, decisions, risks, and next steps.
- `docs/architecture.md` for architecture or data-flow changes.
- `docs/roadmap.md` for completed/next work changes.
- `docs/testing-checklist.md` for new verification steps.
- `docs/production-data-safety.md` for persistence, backup, or security changes.

Do not leave the handoff stale. If no handoff update is needed, mention why in
the final response.
