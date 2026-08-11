import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  e2eGateSpecs,
  routeMockSpecs,
} from "../e2e-gate-specs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const e2eRoot = path.join(root, "e2e");
const gateSpecs = new Set(e2eGateSpecs);
const e2eWorkflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "e2e.yml"),
  "utf8",
);

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

test("PR read-only and route-mock gates keep separate runtime boundaries", () => {
  for (const workflowOwner of [
    ".github/workflows/e2e.yml",
    "playwright.pr-gate.config.ts",
    "scripts/e2e-gate-specs.mjs",
    "scripts/guard-e2e-safety.mjs",
    "scripts/guard-deployment-governance.mjs",
    "scripts/tests/e2e-gate-coverage.test.mjs",
  ]) {
    assert.match(e2eWorkflow, new RegExp(workflowOwner.replaceAll(".", "\\.")));
  }
  assert.match(e2eWorkflow, /name: E2E closed-proxy route mocks/);
  assert.match(e2eWorkflow, /VITE_DEV_PROXY_TARGET: http:\/\/127\.0\.0\.1:9/);
  assert.match(e2eWorkflow, /run: pnpm test:e2e:gate:readonly --reporter=github,html/);
  assert.match(e2eWorkflow, /run: pnpm test:e2e:gate:mock --reporter=github,html/);
});
