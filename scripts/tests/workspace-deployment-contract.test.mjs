import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../../.github/workflows/quality-gate.yml", import.meta.url),
  "utf8",
);

test("workspace route contracts run before the deploy artifact is built", () => {
  const contractIndex = workflow.indexOf(
    "- name: Workspace routing and PWA contracts",
  );
  const buildIndex = workflow.indexOf("- name: Build", contractIndex);
  const uploadIndex = workflow.indexOf(
    "- name: Upload build artifact",
    buildIndex,
  );

  assert.ok(contractIndex >= 0, "workspace route contract step is missing");
  assert.ok(buildIndex > contractIndex, "build must follow route contracts");
  assert.ok(uploadIndex > buildIndex, "artifact upload must follow the build");
  assert.match(workflow, /dist\/\s+functions\/\s+src\/core\/router\/workspaceRoutes\.ts/);
});

test("an isolated candidate preview gates the production deploy", () => {
  const previewIndex = workflow.indexOf("\n  candidate-preview:");
  const deployIndex = workflow.indexOf("\n  deploy:", previewIndex);

  assert.ok(previewIndex >= 0, "candidate preview job is missing");
  assert.ok(deployIndex > previewIndex, "production deploy must follow preview");
  assert.match(
    workflow,
    /needs: \[quality-check, hangul-companion-check, candidate-preview\]/,
  );
  assert.match(workflow, /--branch="\$\{PREVIEW_BRANCH\}"/);
  assert.match(workflow, /for ATTEMPT in \$\(seq 1 60\)/);
  assert.match(workflow, /Preview version did not propagate/);
  assert.match(workflow, /fetch_body_with_retry/);
  assert.match(workflow, /"\/teacher\?candidate=legacy-mobile-root"/);
  assert.match(workflow, /data-omr-canonical-route="\/workspace\/tools\/omr"/);
});

test("production captures a rollback baseline before atomic promotion", () => {
  const baselineIndex = workflow.indexOf(
    "- name: Capture production baseline and deployment ownership",
  );
  const productionDeployIndex = workflow.indexOf(
    "- name: Deploy to Cloudflare Pages",
    baselineIndex,
  );
  const rollbackIndex = workflow.indexOf(
    "- name: Roll back production after a failed post-deploy check",
    productionDeployIndex,
  );

  assert.ok(baselineIndex >= 0, "production rollback baseline is missing");
  assert.ok(
    productionDeployIndex > baselineIndex,
    "promotion must happen after the baseline is captured",
  );
  assert.ok(
    rollbackIndex > productionDeployIndex,
    "post-deploy failure rollback is missing",
  );
  assert.match(workflow, /canonical_deployment\.id/);
  assert.match(workflow, /--branch="\$\{\{ steps\.production-baseline\.outputs\.production_branch \}\}"/);
  assert.match(workflow, /--commit-hash="\$\{GITHUB_SHA\}"/);
  assert.match(workflow, /--commit-dirty=false/);
  assert.match(workflow, /deployments\/\$\{BASELINE_DEPLOYMENT_ID\}\/rollback/);
});

test("a failed authenticated roundtrip also restores the prior deployment", () => {
  assert.match(workflow, /\n  rollback-on-e2e-failure:/);
  assert.match(workflow, /needs: \[deploy, e2e-roundtrip\]/);
  assert.match(workflow, /needs\.e2e-roundtrip\.result == 'failure'/);
  assert.match(
    workflow,
    /BASELINE_DEPLOYMENT_ID: \$\{\{ needs\.deploy\.outputs\.baseline_deployment_id \}\}/,
  );
  assert.match(workflow, /Production rollback verified at \$\{BASELINE_VERSION\}/);
});
