# Frontend refactor guardrails

The frontend quality workflow blocks refactor-debt regression with
`pnpm refactor:budget`. The reviewed 2026-08-05 ceiling is 153 same-app domain
imports, 41 files of at least 1,000 lines, and 33 fixed-time E2E waits. All
tracked metric ceilings in `scripts/refactor-budget-baseline.json` match or
improve on the measured tree; raising a ceiling requires a documented design
reason, not merely a failing build.

Cross-domain UI reuse enters through the owning domain's `public/` directory.
Internal `components/`, `overlays/`, `api/`, and implementation paths remain
counted. The first adoption moves student detail links and overlays to the
student public surface and reduces same-app reach-through from 167 to 153.

Large CSS is counted separately from generated API declarations. The clinic,
message-template, and student base global styles were split at top-level rule
boundaries into ordered files while retaining their original import entry
paths and cascade order, reducing the large-file count from 44 to 41. CSS
Modules are not mechanically split because doing so can change exported class
semantics. Generated OpenAPI types are governed by `pnpm api-types:check` and
excluded from inventory metrics.

Verification:

```powershell
node --test scripts/tests/refactor-boundary-snapshot.test.mjs
pnpm refactor:budget
pnpm api-types:check
pnpm typecheck
pnpm lint
pnpm build
```
