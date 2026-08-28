import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  controlledWriteSpecs,
  criticalInteractionSpecs,
  criticalStateTransitionSpecs,
  e2eGateSpecs,
  maintainedReleaseSpecs,
  routeMockSpecs,
} from "../../e2e/suites.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const e2eRoot = path.join(root, "e2e");
const gateSpecs = new Set(e2eGateSpecs);
const e2eWorkflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "e2e.yml"),
  "utf8",
);
const packageJson = JSON.parse(read("package.json"));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function collectMockSpecs(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ["_archive", "_local"].includes(entry.name)) return [];
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectMockSpecs(absolutePath);
    if (!entry.name.endsWith(".mock.spec.ts")) return [];
    return [path.relative(root, absolutePath).replaceAll(path.sep, "/")];
  });
}

test("every active route-mock spec is part of the PR gate", () => {
  const mockSpecs = collectMockSpecs(e2eRoot);
  const missing = mockSpecs.filter((spec) => !gateSpecs.has(spec));

  assert.deepEqual(missing, []);
  assert.deepEqual(
    routeMockSpecs.filter((spec) => spec.endsWith(".mock.spec.ts")).sort(),
    mockSpecs.sort(),
  );
  for (const spec of mockSpecs) {
    const source = fs.readFileSync(path.join(root, spec), "utf8");
    assert.match(source, /page\.route\(/, `${spec} must install route mocks`);
    assert.match(source, /api\/v1\//, `${spec} must intercept the API boundary`);
  }
});

test("the current homework score contract cannot fall out of the PR gate", () => {
  assert.ok(gateSpecs.has("e2e/admin/score-entry-autosave.spec.ts"));
});

test("the official clinic PDF contract cannot fall out of the PR gate", () => {
  assert.ok(gateSpecs.has("e2e/clinic-pdf-download.spec.ts"));
});

test("workspace quick navigation cannot fall out of the route-mock PR gate", () => {
  assert.ok(gateSpecs.has("e2e/admin/workspace-quick-navigation.mock.spec.ts"));
});

test("critical mobile interactions share the executable surface contract", () => {
  for (const spec of criticalInteractionSpecs) {
    assert.ok(gateSpecs.has(spec), `${spec} must run in the PR gate`);
    assert.match(read(spec), /assertInteractiveSurface/);
    assert.match(read(spec), /width:\s*390/);
  }
});

test("save, reload, stale, and valid-zero contracts cannot fall out of the PR gate", () => {
  for (const spec of criticalStateTransitionSpecs) {
    assert.ok(gateSpecs.has(spec), `${spec} must run in the PR gate`);
  }
  assert.match(read("e2e/admin/assessment-operations-workspace.mock.spec.ts"), /0점 합격 기준/);
  assert.match(read("e2e/admin/assessment-operations-workspace.mock.spec.ts"), /동시 수정/);
  assert.match(read("e2e/admin/assessment-operations-workspace.mock.spec.ts"), /같은 계정/);
  assert.match(read("e2e/admin/score-entry-autosave.spec.ts"), /0점은 입력된 데이터/);
  assert.match(read("e2e/student/numeric-short-answer.spec.ts"), /같은 계정 재조회/);
  assert.match(read("e2e/student/numeric-short-answer.spec.ts"), /앞자리 0을 정규화/);
});

test("release and controlled-write suites have separate executable owners", () => {
  assert.equal(
    packageJson.scripts["test:e2e:release"],
    "playwright test --config=playwright.release.config.ts",
  );
  assert.equal(
    packageJson.scripts["test:e2e:controlled-writes"],
    "playwright test --config=playwright.controlled-write.config.ts",
  );
  assert.deepEqual(
    controlledWriteSpecs.filter((spec) => maintainedReleaseSpecs.includes(spec)),
    [],
  );
  assert.match(e2eWorkflow, /run: pnpm test:e2e:controlled-writes --reporter=github,html/);
});

test("the exhaustive menu audit reuses one serial runner setup", () => {
  assert.match(e2eWorkflow, /name: All-menu audit\n/);
  assert.match(e2eWorkflow, /name: All-menu audit[\s\S]{0,200}timeout-minutes: 240/);
  assert.match(e2eWorkflow, /e2e\/stability\/all-menu-button-click-audit\.spec\.ts/);
  assert.match(e2eWorkflow, /--retries=0/);
  assert.doesNotMatch(e2eWorkflow, /All-menu audit \(\$\{\{ matrix\.scope \}\}\)/);
});

test("PR read-only and route-mock gates keep separate runtime boundaries", () => {
  for (const workflowOwner of [
    ".github/workflows/e2e.yml",
    "playwright.pr-gate.config.ts",
    "playwright.release.config.ts",
    "playwright.controlled-write.config.ts",
    "e2e/suites.mjs",
    "scripts/guard-e2e-safety.mjs",
    "scripts/guard-deployment-governance.mjs",
    "scripts/tests/e2e-gate-coverage.test.mjs",
  ]) {
    assert.match(e2eWorkflow, new RegExp(workflowOwner.replaceAll(".", "\\.")));
  }
  assert.match(e2eWorkflow, /name: E2E closed-proxy route mocks/);
  assert.match(e2eWorkflow, /VITE_DEV_PROXY_TARGET: http:\/\/127\.0\.0\.1:9/);
  assert.match(e2eWorkflow, /playwright install --with-deps chromium webkit/);
  assert.match(e2eWorkflow, /run: pnpm test:e2e:gate:readonly --reporter=github,html/);
  assert.match(e2eWorkflow, /run: pnpm test:e2e:gate:mock --reporter=github,html/);
});
