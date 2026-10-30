import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { runInNewContext } from "node:vm";
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

test("closed diagnostics require explicit manual inputs and never enable production", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/quality-gate.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");
  const input = workflow.match(/\n      diagnostic_full_suite:\n((?:        [^\n]*\n)+)/)?.[1];
  assert.ok(input, "the diagnostic mode is an explicit workflow input");
  assert.match(input, /^        type: boolean$/m);
  assert.match(input, /^        required: false$/m);
  assert.match(input, /^        default: false$/m);
  const flag = workflow.match(/ACADEMY_RELEASE_DIAGNOSTIC_FULL_SUITE: \$\{\{([^\n]+)\}\}/)?.[1];
  assert.ok(flag);
  assert.equal(workflow.match(/ACADEMY_RELEASE_DIAGNOSTIC_FULL_SUITE:/g)?.length, 1);
  const scopeInput = workflow.match(/\n      diagnostic_scope:\n((?:        [^\n]*\n)+)/)?.[1];
  assert.ok(scopeInput);
  assert.match(scopeInput, /^        type: choice$/m);
  assert.match(scopeInput, /^        default: full-suite$/m);
  assert.deepEqual([...scopeInput.matchAll(/^          - (.+)$/gm)].map(match => match[1]),
    ["full-suite", "excel-learning-homework"]);
  const scopeFlag = workflow.match(/ACADEMY_RELEASE_DIAGNOSTIC_SCOPE: \$\{\{([^\n]+)\}\}/)?.[1];
  assert.ok(scopeFlag);
  assert.equal(workflow.match(/ACADEMY_RELEASE_DIAGNOSTIC_SCOPE:/g)?.length, 1);
  const deploy = workflow.match(/\n  deploy:\n([\s\S]*?)(?=\n  [a-z][a-z0-9-]*:\n|$)/)?.[1];
  assert.ok(deploy);
  const condition = deploy.match(/\n    if: >-\n([\s\S]*?)(?=\n    [a-z_-]+:)/)?.[1];
  assert.ok(condition);
  const expression = condition.trim().replace(/needs\.([a-z][a-z0-9-]*)/g, (_match, name) => `needs[${JSON.stringify(name)}]`);
  const evaluate = (value, context) => runInNewContext(`(${value})`, context, { timeout: 1000 });
  for (const event of ["push", "workflow_dispatch", "pull_request"]) {
    for (const requested of [undefined, false, true]) {
      for (const scope of [undefined, "full-suite", "excel-learning-homework", "private-token", ""]) {
        for (const result of ["success", "failure", "skipped"]) {
          const context = { github: { event_name: event, ref: "refs/heads/main" },
            inputs: { diagnostic_full_suite: requested, diagnostic_scope: scope },
            needs: { "quality-check": { outputs: { release_required: "true" } }, "development-canary": { result } } };
          const diagnostic = event === "workflow_dispatch" && requested === true;
          assert.equal(evaluate(flag, context), diagnostic ? "1" : "0");
          assert.equal(evaluate(scopeFlag, context), event === "workflow_dispatch" ? scope : "full-suite",
            "manual empty/unknown scope must reach validation unchanged");
          const manualRelease = event !== "workflow_dispatch" || (!diagnostic && scope === "full-suite");
          assert.equal(evaluate(expression, context), event !== "pull_request" && result === "success" && manualRelease,
            "targeted or invalid manual scope cannot promote even with a false flag and hypothetical QA success");
          context.github.ref = "refs/heads/feature";
          assert.equal(evaluate(expression, context), false, "a non-main job cannot promote");
        }
      }
    }
  }
});
