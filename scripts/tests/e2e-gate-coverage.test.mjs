import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const e2eRoot = path.join(root, "e2e");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const gateSpecs = new Set(
  String(packageJson.scripts?.["test:e2e:gate"] ?? "").match(/e2e\/[^\s]+\.spec\.ts/g) ?? [],
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
  for (const spec of mockSpecs) {
    const source = fs.readFileSync(path.join(root, spec), "utf8");
    assert.match(source, /page\.route\(/, `${spec} must install route mocks`);
    assert.match(source, /api\/v1\//, `${spec} must intercept the API boundary`);
  }
});

test("the current homework score contract cannot fall out of the PR gate", () => {
  assert.ok(gateSpecs.has("e2e/admin/score-entry-autosave.spec.ts"));
});
