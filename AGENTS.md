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
- User-visible changes include purposeful motion and interaction polish when
  they materially clarify state, hierarchy, or navigation. Prefer brief
  opacity/transform transitions, keep scrolling and input responsive, respect
  `prefers-reduced-motion`, and avoid decorative or input-blocking animation.

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
PR E2E is login/read-only/mock only; production writes require the controlled
manual canary flag or the rollback-bound post-deploy job. Cloudflare uses
separate preview, production, and infrastructure-scoped API tokens plus
`preview`, `production`, and `production-rollback` environments. Confirm
deployed revision, rollback readiness, and the affected user flow. Ordinary
automation uses
repository OIDC/API-token secrets. For assigned production work, an already
configured AWS account-root or Cloudflare master credential may be used by the
owning manual workflow when the normal least-privilege path is insufficient,
but its value must never be printed/copied and the quality, direct-deploy,
production-readback, and real-use gates remain mandatory.

Production verification is a feedback loop, not a report-only checkpoint.
After the exact revision propagates, inspect the affected live routes on
desktop and 390px mobile for hierarchy, interaction feedback, motion timing,
loading/error states, overflow, and perceived responsiveness. If that live
review exposes a defect, keep ownership, implement the correction, rerun the
relevant gates, redeploy, and verify again. During an assigned implementation,
do not ask whether to deploy or continue unless an explicit opt-out or a
genuine scope/authority blocker applies.

Unless the user explicitly limits the task to local-only, no-deploy,
draft/PR-only, or read-only work, an assigned implementation, change, or build
includes its normal in-scope commit, push, PR, merge, messaging, deployment,
production verification, and residue cleanup. Do not stop merely because
GitHub publication or production deployment was not requested as a separate
step; the implementation assignment itself authorizes the owning end-to-end
workflow. Release, operations, and cleanup assignments carry the same standing
authority. This authority does not expand the task, resolve an ambiguous
destructive target, waive user-data protection, bypass a release gate, or make
an external approval true without platform readback. When the user explicitly
instructs Codex to deploy, release, apply to production, or continue an in-scope
rollout, that instruction also authorizes Codex to submit the exact rollout's
GitHub `production` environment approval through the official authenticated API
without asking for a second confirmation. The platform must record the approval
before mutation; never remove or bypass the protection, approve an unrelated
run, or claim approval from the instruction alone. If GitHub rejects the review
or no eligible authenticated reviewer is available, preserve the error and
report the technical blocker without asking the user to repeat the same
authorization. The shared execution contract is
`../backend/docs/operations/github-governance.md`.

For concurrent Codex work, keep canonical `C:\academy\frontend` and
`C:\academy\backend` on clean `main`. Create a uniquely owned worktree from
current `origin/main` with
`C:\academy\backend\scripts\codex\session-worktree.ps1 -Action Start`; never share a
worktree or edit another task's dirty tree. Exactly one task owns release, and
other tasks stop at an exact committed SHA plus CI evidence. Close only a clean
branch already merged or fully patch-equivalent to `origin/main`; the script
refuses dirty, foreign, and uniquely unmerged worktrees. The lifecycle contract
is `C:\academy\backend\docs\operations\concurrent-codex-sessions.md`.

Finish with `git diff --check` and `git status --short`. Stage explicit files
only and preserve pre-existing changes.
