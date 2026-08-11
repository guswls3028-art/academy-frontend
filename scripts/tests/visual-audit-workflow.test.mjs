import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "visual-audit.yml"),
  "utf8",
);
const spec = fs.readFileSync(
  path.join(root, "e2e", "visual", "design-system-route-audit.spec.ts"),
  "utf8",
);

const surfaces = [
  "admin static route surface",
  "admin compact route surface",
  "student mobile route surface",
  "student desktop route surface",
  "teacher mobile route surface",
  "promo public route surface",
  "system public route surface",
  "tenant landing route surface",
  "developer route surface",
];

test("weekly live audit shards every maintained route surface exactly once", () => {
  for (const surface of surfaces) {
    assert.match(spec, new RegExp(`test\\(\\"${surface} is visually stable\\"`));
    assert.equal(
      workflow.match(new RegExp(`grep: ${surface}`, "g"))?.length,
      1,
      `${surface} must have one workflow shard`,
    );
  }
  assert.equal(workflow.match(/^\s+- scope:/gm)?.length, surfaces.length);
});

test("weekly live audit remains read-only, bounded, and evidence-producing", () => {
  assert.match(workflow, /cron: "0 19 \* \* 5"/);
  assert.match(workflow, /max-parallel: 1/);
  assert.match(workflow, /E2E_ALLOW_PRODUCTION_WRITES=0/);
  assert.match(workflow, /E2E_ALLOW_REAL_ALIMTALK=0/);
  assert.match(workflow, /retention-days: 14/);
  assert.match(workflow, /if-no-files-found: error/);
});
