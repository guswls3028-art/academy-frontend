# Academy Frontend — Codex Instructions

Self-contained instructions for the frontend Git root.

## Sources and context

- Frontend owner: `docs/README.md`; backend policy: `../backend/docs/`.
  Workflows/scripts/settings/migrations/runtime readback outrank code/tests,
  then SSOT, owning docs, and plans/reports/agent guidance.
- Read relevant rules/skills once; reopen only changed/missing sections. Use
  bounded `rg`/targeted reads and concise evidence; keep full logs in artifacts.
  Reuse unchanged passing checks unless failures/risks remain. Delegate only
  useful bounded independent work with minimal context; delegation is optional.

## Scope and authority

Diagnosis/explanation/review is read-only unless a change is requested. Unless
local-only/no-deploy/draft/PR-only/read-only, implementation/change/build and
release/operations/cleanup authorize their full in-scope workflow: commit, push,
PR, merge, explicitly authorized messaging, deployment, production verification,
cleanup. No repeated
permission for these steps.

`모든권한`, `모든권한 있음`, `모든권한o`, and equivalents retain that authority
until narrowed/revoked; finish the earliest assignment first. Never expand scope,
guess destructive targets, waive data protection/current HOLDs/gates, override
higher-priority action-time confirmation, or infer platform approval.

Explicit deploy/release/production/continue instructions authorize that exact
run's GitHub `production` review via official authenticated API; verify approval
before mutation. No protection bypass/other-run approval. Rejection/ineligibility
is a technical blocker, not a reconfirmation request. Owner:
`../backend/docs/operations/github-governance.md`.

Docs/agent-config-only changes need publication, required repository CI, and
applicable syntax/path/contract/diff checks; never skip or bypass required CI.
No separate application build/deployment or mutating live QA is needed unless
an executable contract changes.

## Product and UI contract

- Preserve tenant/auth/role boundaries in every route/API and user-authored data;
  do not reconstruct backend-owned business decisions.
- Reuse design-system/role-app patterns: `Badge` from `@/shared/ui/ds` (no raw
  `ds-badge`), `ICON.*`, `ICON_FOR_BUTTON.*`, and `ICON_FOR_BADGE.*` tokens.
  Copy is plain Korean without internal IDs/workers.
- Async surfaces need loading/empty/success/failure states. Preserve input and
  working recovery. Disabled actions explain legitimate prerequisites;
  disabling an ordinary supported action does not fix it.
- Polish interactions with brief opacity/transform motion when it clarifies
  state/hierarchy/navigation. Respect `prefers-reduced-motion`, responsive input/
  scroll, and avoid decorative or blocking animation.
- Verify long Korean text, keyboard access, desktop 1100/1366 and 390px where
  exposed. Browser evidence requires DOM assertions and persisted state.

Prove each affected role's ordinary successful journey: CTA → API → saved state
→ reload → consuming screens, plus visible failure/recovery. Guards, notices,
swallowed errors, empty-success fallbacks, screenshots, and green CI alone are
insufficient. Only Beta labeled before entry permits a documented incomplete
path. Preserve legitimate tenant/permission/data/messaging boundaries; inspect
callers/compatibility before removing code. Evidence owners:
`docs/REAL-USE-REVIEW-MANUAL.md` and
`../backend/docs/operations/change-risk-and-release-bundle.md`.

Every behavior change updates its owner in `docs/` or a module README indexed
from `docs/README.md`; link backend policy. Record purpose, actors/entry points,
flow, permissions/states, API/data ownership, loading/empty/error/retry,
responsiveness, verification. Removal/replacement also records reason,
migration/compatibility, persisted-state fate. Behavior-preserving internals
may omit product docs only with a final explanation and supporting verification.

## Delivery and isolation

Keep canonical `C:\academy\frontend` and `C:\academy\backend` on clean `main`.
Create/inspect an owned current-`origin/main` worktree with
`C:\academy\backend\scripts\codex\session-worktree.ps1`; never mutate a foreign
tree. One task owns release; others hand off exact committed SHA/CI. Close only
clean, merged/patch-equivalent branches; intentional WIP needs a named recovery
commit. Sync after active tasks/releases finish. Owner:
`../backend/docs/operations/concurrent-codex-sessions.md`.

Before release read `docs/DEPLOYMENT-OPERATIONS.md`; executable owner:
`.github/workflows/quality-gate.yml`. Preserve exact current HOLD scope/state
until its owner's release conditions pass, including technical transition
gates. Historical holds/unrelated static findings are not blanket holds. No default 04:00 wait
after old/new API/DB and uninterrupted playback/editing without forced reload.
Unresolved interruption/incompatibility needs a separate window.

- PR E2E is login/read-only/mock. Automatic release QA must use same-artifact
  isolated `development-canary`: non-skipped real-use and exact tenant/user
  cleanup zero before promotion. No production synthetic business rows/old
  production-writing path. Controlled manual canaries retain their gates.
- Authenticated visual QA uses the exact checkout, SSM loopback API, disposable
  `qa-*` tenants/accounts, and cleanup-zero readback per
  `../backend/docs/operations/persistent-development-runtime.md`. Never copy
  production personal data, credentials, rows, or storage.
- Use configured OIDC/API-token secrets and separate Cloudflare preview/
  production/infrastructure scopes/rollback environment. Assigned manual
  workflows may use configured account-root/master credentials when needed;
  never weaken gates or print/copy credentials.
- Verify exact deployed revision/assets, rollback readiness, and affected journeys.
  Authentication/dashboard observation writes are separate from business
  mutation; never report them as total writes zero.
- After propagation inspect affected live desktop/390px routes for hierarchy,
  feedback/motion, loading/errors, overflow, and responsiveness. Own discovered
  defects through correction, relevant checks, redeployment, and verification.

## Verification

Verify the product/UI contract above, request/response, and repeated actions.
Run focused tests, then applicable gates:

```powershell
pnpm typecheck
pnpm guard:legacy-api
pnpm lint
pnpm build
pnpm test:e2e:gate
```

Rules/docs work follows workspace `docs-and-rules-sync` and applicable contract
checks, including `guard:deployment-governance`/`guard:runtime-recovery` for
deployment/E2E guidance. Start/finish with both repository statuses and finish
`git diff --check`. Stage explicit files only; preserve other work.
