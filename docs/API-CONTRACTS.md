# Backend API type contract

The backend owns the OpenAPI transport contract; the frontend owns only the
generated TypeScript view of that artifact. The immutable backend source
revision is recorded in `scripts/openapi-backend-source.json`, and generated
types live at `src/shared/api/generated/schema.d.ts`.

Run:

```powershell
pnpm api-types:generate
pnpm api-types:check
```

CI downloads the schema from the exact 40-character backend commit SHA and
fails when the generated artifact differs. It never follows a moving branch.
To update the contract, merge or publish the reviewed backend schema first,
change the pinned SHA, regenerate, and review the resulting frontend type
diff. Existing handwritten contracts may migrate endpoint by endpoint; new or
touched API code should derive shapes from the generated `paths` or
`components` types when the backend schema covers that endpoint.

Generated files are excluded from refactor inventory and legacy-call text
scans because they describe server compatibility routes but never execute
them; generator output is governed by the dedicated drift check. Tenant,
authorization, selected-student, retry, and business-state behavior remains in
the owning product contract and must not be inferred from OpenAPI types alone.

The backend generation and no-regression ceiling are documented in
`backend/docs/architecture/api-schema-contract.md`.
