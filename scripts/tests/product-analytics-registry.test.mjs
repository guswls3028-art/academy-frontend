import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
