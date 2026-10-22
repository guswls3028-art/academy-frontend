# Academy Frontend — Codex Instructions

Self-contained instructions for the frontend Git root.

## Sources and context

- Entry: `docs/README.md`; backend policy: `../backend/docs/`.
  Workflows/scripts/settings/migrations/runtime readback outrank code/tests,
  then SSOT, owning docs and plans/history/agent guidance.
- Reuse rules already in context; read only relevant changed/missing sections.
  Use scoped searches and bounded output. Save long logs only when needed for
  recovery; reuse passing checks on unchanged relevant inputs, retaining CI.
- Keep the primary model/settings. Prefer one bounded `chatgpt-web/gpt-6-pro`
  at `max` early when independent work advances the task. Small, coupled or
  duplicate work stays local. Use a lower Web model only for trivial work.
  Verify the selected model; retry capacity once, never silently downgrade.
  Bridge/Native2 failure: continue locally and report once; do not interrupt
  another task's launcher. Codex owns integration, checks and release.
- Detailed reasoning, output recovery and evidence policy:
  `../backend/docs/operations/concurrent-codex-sessions.md` → Execution efficiency.
  Read the needed subsection when these defaults leave a decision unresolved;
  do not reload it for every task/check.
  Without a sibling backend, use
  `git -C C:\academy\backend show origin/main:docs/operations/concurrent-codex-sessions.md` (Codespace root:
  `/workspaces/academy-backend`). Refresh the ref if freshness is unestablished.

## Scope and authority

Diagnosis/review is read-only unless changes are requested. Otherwise, unless
local-only/no-deploy/draft/PR-only, the assignment includes scoped publication,
merge, deployment, verification and owned cleanup. `모든권한` and equivalents
persist until narrowed/revoked; finish the earliest assignment without repeated
permission. Same-user Academy tasks/owned subagents may exchange non-sensitive
scope, paths, SHAs and CI/verification evidence. External recipients, authentication,
secret transfers and ambiguous destructive targets need exact authorization.
Preserve tenant/user data, current HOLDs, release gates, managed permissions and
higher-priority action-time approvals. Give formal review the exact target,
impact and user instruction; never work around a denial.

Explicit deployment/release/production/rollout continuation also authorizes that
exact run's GitHub `production` approval via the official authenticated API.
Require platform readback before mutation; no protection bypass or unrelated-run
approval. Rejection/ineligibility is a technical blocker, not a reconfirmation
request. Owner: `../backend/docs/operations/github-governance.md`.

Docs/instruction/local-settings changes require applicable syntax/path/contract/
diff checks and required CI; no separate product build, deployment or mutating
QA solely for prose. Executable changes use their owning gates.

## Product and UI contract

For design, usability, or workflow changes, inspect the current affected UI and
the role's entry → task → saved result → next-screen journey before choosing a
solution. Treat user suggestions as evidence, identify observed friction versus
hypotheses, and prioritize plausible failure, interruption, permission, and
responsive edge cases. Compare proportionate options, then verify the chosen
journey and recovery. If the UI cannot be observed, use code/current evidence
and disclose the gap. The focused method is in
`docs/REAL-USE-REVIEW-MANUAL.md`.

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
For local Windows work, export the lifecycle helper from fresh backend
`origin/main` as described in the session owner’s `Start a task` section;
create/inspect an owned current-main worktree. Never bootstrap from a stale
canonical helper. For GitHub Codespace Linux work, use the remote Git worktree procedure in
`/workspaces/academy-backend/docs/operations/concurrent-codex-sessions.md`.
Below 10 GB free on C:, use a Codespace for new installs and builds; local
`Start` refuses unless explicitly limited to lightweight recovery work.
Never mutate a foreign tree. One task owns release; others hand off exact
committed SHA/CI. Close only
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
