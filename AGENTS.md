# Academy Frontend — Codex Instructions

This file is self-contained for Codex sessions started at the frontend Git root.

## Sources and boundaries

- Frontend docs entry: `docs/README.md`
- Backend contracts and policy: `../backend/docs/`
- Current code, tests, and runtime contracts outrank prose.
- Preserve tenant, auth, and role boundaries in every API call and route.
- Do not reconstruct backend-owned business decisions in the client.
- Preserve pre-existing worktree changes.

## Durable feature records

Every changed user-visible behavior updates its owning current-state document
in the same task. Put product-wide flows, routing, and operator behavior in
`docs/`; a feature-local README may own module details only when indexed from
`docs/README.md`. Backend policy stays in `../backend/docs/` and is linked,
not duplicated.

Record purpose, roles and entry points, interaction flow, permissions and
states, API/data ownership, loading/empty/error/retry behavior, responsive
expectations, and focused verification. For removal or replacement, also
record why, migration/compatibility behavior, and persisted-state handling.

## UI standard

- Reuse the existing design system and role-app patterns.
- Use `Badge` from `@/shared/ui/ds`; do not add raw `ds-badge` spans.
- Use `ICON.*`, `ICON_FOR_BUTTON.*`, and `ICON_FOR_BADGE.*` tokens.
- User-facing copy is plain Korean and does not expose internal IDs or workers.
- Every async surface needs loading, empty, success, and failure states.
- Disabled actions explain why.
- Check long Korean text and 1100/1366 desktop or 390 mobile as applicable.
- Browser evidence requires DOM assertions and persisted state, not a
  screenshot alone.

## Contract verification

For a changed flow verify request/response and backend ownership, tenant/auth/
role outcomes, loading/empty/error/repeat states, save/reload persistence,
consuming screens, keyboard behavior, and relevant viewports.

Run focused tests first, then as applicable:

```powershell
pnpm typecheck
pnpm guard:legacy-api
pnpm lint
pnpm build
pnpm test:e2e:gate
```

Production delivery goes through `.github/workflows/quality-gate.yml`.
Confirm deployed revision and the affected user flow. Ordinary automation uses
repository OIDC/API-token secrets. Explicitly authorized manual work may use
an already configured AWS account-root or Cloudflare master credential, but
must never print/copy its value or bypass the quality, direct-deploy,
production-readback, or real-use gates.

Finish with `git diff --check` and `git status --short`. Stage explicit files
only and preserve pre-existing changes.
