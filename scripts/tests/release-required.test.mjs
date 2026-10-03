import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { classifyRelease, requiresRelease } from "../release-required.mjs";
import { assertOfficialReleaseContext } from "../run-development-release-canary.mjs";

test("only known prose locations skip release", () => {
  assert.equal(requiresRelease(["AGENTS.md", "README.md", "docs/DEPLOYMENT-OPERATIONS.md", ".agents/skills/review/SKILL.md"]), false);
  for (const file of ["src/help.md", "docs/policy.json", "docs/check.mjs", ".github/workflows/quality-gate.yml", "scripts/release-required.mjs", "package.json", "pnpm-lock.yaml", "e2e/auth.spec.ts", "public/readme.md", ".agents/skills/review/check.ps1"]) {
    assert.equal(requiresRelease(["README.md", file]), true, file);
  }
  assert.equal(requiresRelease([]), true);
});

test("manual retry and unknown revisions cannot suppress a release", () => {
  assert.deepEqual(classifyRelease({ eventName: "workflow_dispatch", event: {} }), { required: true, reason: "explicit-release" });
  for (const base of [undefined, "0".repeat(40), "main", "--help"]) {
    assert.equal(classifyRelease({ eventName: "push", event: { before: base }, head: "a".repeat(40) }).required, true);
  }
});

test("Git comparison includes deleted runtime inputs and fails safe for unavailable history", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "academy-release-scope-"));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const commit = (message) => {
    git("add", "README.md", "runtime.ts");
    git("-c", "user.name=Release test", "-c", "user.email=release-test@example.invalid", "commit", "-qm", message);
    return git("rev-parse", "HEAD");
  };
  try {
    git("init", "-q");
    writeFileSync(path.join(cwd, "README.md"), "before\n");
    writeFileSync(path.join(cwd, "runtime.ts"), "export {};\n");
    const base = commit("base");
    writeFileSync(path.join(cwd, "README.md"), "after\n");
    const prose = commit("prose");
    assert.equal(classifyRelease({ eventName: "push", event: { before: base }, head: prose, cwd }).required, false);
    assert.equal(classifyRelease({ eventName: "pull_request", event: { pull_request: { base: { sha: base } } }, head: prose, cwd }).required, false);
    rmSync(path.join(cwd, "runtime.ts"));
    const deletion = commit("delete runtime");
    assert.equal(classifyRelease({ eventName: "push", event: { before: prose }, head: deletion, cwd }).required, true);
    assert.equal(classifyRelease({ eventName: "push", event: { before: "a".repeat(40) }, head: deletion, cwd }).required, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("manual release QA retains official CI, main and exact revision boundaries", () => {
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main", GITHUB_SHA: "a".repeat(40) };
  assert.doesNotThrow(() => assertOfficialReleaseContext(env));
  assert.doesNotThrow(() => assertOfficialReleaseContext({ ...env, GITHUB_EVENT_NAME: "workflow_dispatch" }));
  for (const invalid of [
    { GITHUB_ACTIONS: "false" }, { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_EVENT_NAME: "pull_request_target" }, { GITHUB_EVENT_NAME: "schedule" },
    { GITHUB_REF: "refs/heads/feature" }, { GITHUB_REF: "refs/tags/main" },
    { GITHUB_SHA: "main" },
  ]) assert.throws(() => assertOfficialReleaseContext({ ...env, ...invalid }));
});
