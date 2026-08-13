# Frontend refactor guardrails

The frontend quality workflow blocks refactor-debt regression with
`pnpm refactor:budget`. The current ceiling is 145 same-app domain
imports, 41 files of at least 1,000 lines, 33 fixed-time E2E waits, and 53
local-storage references after the scoped-persistence cutover. All
tracked metric ceilings in `scripts/refactor-budget-baseline.json` match or
improve on the measured tree; raising a ceiling requires a documented design
reason, not merely a failing build.

Cross-domain UI reuse enters through the owning domain's `public/` directory.
Internal `components/`, `overlays/`, `api/`, and implementation paths remain
counted. The first adoption moved student detail links and overlays to the
student public surface; the scores public cutover then reduced same-app
reach-through from 153 to 145.
The scores public surface preserves the existing lazy modal boundaries while
the lectures score workspace consumes panels, draft recovery, and print/report
modals without reaching into scores internals. Scores reads attendance through
the shared API contract, so the scores/lectures runtime dependency is no longer
bidirectional.

Large CSS is counted separately from generated API declarations. The clinic,
message-template, and student base global styles were split at top-level rule
boundaries into ordered files while retaining their original import entry
paths and cascade order, reducing the large-file count from 44 to 41. CSS
Modules are not mechanically split because doing so can change exported class
semantics. Generated OpenAPI types are governed by `pnpm api-types:check` and
excluded from inventory metrics.

Route-mock E2E waits for observable render or network-settled state instead of
fixed sleeps. Routes whose first Vite transform can exceed the default assertion
window use the shared bounded `waitForRenderSettled` helper before asserting the
first screen state; retries remain a recovery path, not the expected cold-start
path.

Verification:

```powershell
node --test scripts/tests/refactor-boundary-snapshot.test.mjs
pnpm refactor:budget
pnpm api-types:check
pnpm typecheck
pnpm lint
pnpm build
```
