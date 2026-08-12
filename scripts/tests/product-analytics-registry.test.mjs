import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

test("product analytics registry verifier passes", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-product-analytics-registry.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /product analytics registry OK/);
});

test("tenant rollout workflow is exact-target, API-owned, and secret-safe", () => {
  const source = readFileSync(
    ".github/workflows/product-analytics-rollout.yml",
    "utf8",
  );

  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /ENABLE <tenant_code> or DISABLE <tenant_code>/);
  assert.match(source, /Expected exactly one matching tenant/);
  assert.match(source, /productUsageAnalyticsEnabled/);
  assert.match(source, /core\/tenants\/\$TENANT_ID\//);
  assert.match(source, /::add-mask::\$ACCESS_TOKEN/);
  assert.match(source, /umask 077/);
  assert.match(source, /Product analytics flag readback mismatch/);
  assert.doesNotMatch(source, /echo "\$PLATFORM_(?:USER|PASS)"/);
});

test("representative task funnels wrap the existing API promise boundary", () => {
  const contracts = [
    {
      path: "src/app_admin/domains/lectures/pages/scores/SessionScoresEntryPage.tsx",
      pattern: /runTrackedTask\(\s*"scores\.session\.save",\s*saveScoreDraftNow/,
    },
    {
      path: "src/app_admin/domains/exams/panels/setup/ExamEnrollmentPanel.tsx",
      pattern: /runTrackedTask\(\s*"exams\.enrollment\.save",\s*\(\) => updateMut\.mutateAsync/,
    },
    {
      path: "src/app_admin/domains/homework/panels/setup/HomeworkEnrollmentPanel.tsx",
      pattern: /runTrackedTask\(\s*"assignments\.enrollment\.save",\s*\(\) => putHomeworkAssignments/,
    },
    {
      path: "src/app_student/domains/submit/pages/SubmitAssignmentPage.tsx",
      pattern: /runTrackedTask\(\s*"assignments\.student\.submit",\s*\(\) => studentApi\.post/,
    },
    {
      path: "src/app_admin/domains/messages/components/SendMessageModal.tsx",
      pattern: /runTrackedTask\("messaging\.alimtalk\.request", async \(\) => \{[\s\S]*?sendMessage\(/,
    },
  ];

  for (const contract of contracts) {
    const source = readFileSync(contract.path, "utf8");
    assert.match(source, contract.pattern, contract.path);
  }
});
