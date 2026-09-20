import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertSsmManifest, expectedSsmManifest, verifyBinarySafeSsm } from "../binary-safe-ssm.mjs";

test("port transport accepts only the complete reviewed custom provenance", () => {
  for (const platform of ["win32", "linux"]) {
    const expected = expectedSsmManifest(platform);
    assert.doesNotThrow(() => assertSsmManifest(expected, platform));
    for (const key of Object.keys(expected)) {
      const omitted = { ...expected };
      delete omitted[key];
      assert.throws(() => assertSsmManifest(omitted, platform), /Unreviewed SSM build provenance/);
    }
    for (const changed of [
      { ...expected, customBuild: false },
      { ...expected, version: expected.upstreamVersion },
      { ...expected, binarySha256: "0".repeat(64) },
      { ...expected, upstreamCommit: "0".repeat(40) },
      { ...expected, unknown: "not permitted" },
    ]) assert.throws(() => assertSsmManifest(changed, platform), /Unreviewed SSM build provenance/);
  }
});

test("a matching manifest cannot authorize a replaced executable", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "academy-ssm-integrity-"));
  try {
    fs.mkdirSync(path.join(directory, "bin"));
    const binary = path.join(directory, "bin", process.platform === "win32" ? "session-manager-plugin.exe" : "session-manager-plugin");
    fs.writeFileSync(binary, "non-executable test fixture");
    fs.writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(expectedSsmManifest(process.platform)));
    assert.throws(() => verifyBinarySafeSsm(directory), /SSM executable digest differs/);
  } finally {
    // Exactly the new test-owned temporary directory; never a caller-provided path.
    assert.ok(path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith("academy-ssm-integrity-"));
    fs.rmSync(directory, { recursive: true });
  }
});

test("missing toolchain fails before starting any SSM session", () => {
  assert.throws(() => verifyBinarySafeSsm(undefined), /Pinned SSM directory is required/);
  assert.throws(() => verifyBinarySafeSsm("relative-directory"), /Pinned SSM directory is required/);
});
