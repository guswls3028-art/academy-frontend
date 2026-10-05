import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { changedLintFiles, lintChangedFiles } from "../lint-changed-files.mjs";

const script = fileURLToPath(new URL("../lint-changed-files.mjs", import.meta.url));

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "academy-strict-lint-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const pending = new Set();
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), text);
    pending.add(file);
  };
  git("init", "-q");
  write("eslint.config.mjs", 'export default [{files:["**/*.ts","**/*.tsx"],rules:{"no-debugger":"error","no-console":"warn"}}];\n');
  const commit = () => {
    if (pending.size) git("add", "--", ...pending);
    pending.clear();
    git("-c", "user.name=Lint fixture", "-c", "user.email=lint@example.invalid", "commit", "-qm", "fixture");
    return git("rev-parse", "HEAD");
  };
  const base = commit();
  return { cwd, git, write, commit, base, options: (head, before = base) => ({ cwd, head, eventName: "push", event: { before } }) };
}

test("renamed files and literal Unicode/space/glob paths still fail real lint", async (t) => {
  const f = fixture(t);
  f.write("src/original.ts", "debugger;\n");
  const base = f.commit();
  f.git("mv", "src/original.ts", "src/새 파일 [1].ts");
  const head = f.commit();
  const options = f.options(head, base);
  assert.deepEqual(changedLintFiles(options), ["src/새 파일 [1].ts"]);
  assert.equal(await lintChangedFiles(options), 1);
});

test("push compares all commits and includes root config and Functions TypeScript", async (t) => {
  const f = fixture(t);
  f.write("playwright.config.ts", "debugger;\n");
  f.commit();
  f.write("functions/api.ts", "export {};\n");
  const head = f.commit();
  assert.deepEqual(changedLintFiles(f.options(head)), ["functions/api.ts", "playwright.config.ts"]);
  assert.equal(await lintChangedFiles(f.options(head)), 1);
  assert.equal(await lintChangedFiles({ ...f.options(head), eventName: "workflow_dispatch", event: {} }), 0);
});

test("extension changes and shell-sensitive filenames are inspected literally", async (t) => {
  const f = fixture(t);
  f.write("old.txt", "debugger;\n");
  const base = f.commit();
  f.git("mv", "--", "old.txt", "-renamed.ts");
  if (process.platform !== "win32") f.write("src/line\nbreak.ts", "export {};\n");
  const options = f.options(f.commit(), base);
  assert.ok(changedLintFiles(options).includes("-renamed.ts"));
  assert.equal(await lintChangedFiles(options), 1);
});

test("PR merge checkout excludes unrelated changes on its advanced base", async (t) => {
  const f = fixture(t);
  f.git("checkout", "-qb", "feature");
  f.write("src/feature.ts", "export {};\n");
  f.commit();
  f.git("checkout", "-qb", "advanced-base", f.base);
  f.write("src/base-only.ts", "debugger;\n");
  const base = f.commit();
  f.git("-c", "user.name=Lint fixture", "-c", "user.email=lint@example.invalid", "merge", "--no-ff", "-qm", "merge", "feature");
  const options = { cwd: f.cwd, head: f.git("rev-parse", "HEAD"), eventName: "pull_request", event: { pull_request: { base: { sha: base } } } };
  assert.deepEqual(changedLintFiles(options), ["src/feature.ts"]);
  assert.equal(await lintChangedFiles(options), 0);
});

test("unchanged debt is excluded; clean changes pass and warnings block", async (t) => {
  const f = fixture(t);
  f.write("src/legacy.ts", "debugger;\n");
  const base = f.commit();
  f.write("src/clean.tsx", "export {};\n");
  const clean = f.commit();
  const pr = { ...f.options(clean), eventName: "pull_request", event: { pull_request: { base: { sha: base } } } };
  assert.deepEqual(changedLintFiles(pr), ["src/clean.tsx"]);
  assert.equal(await lintChangedFiles(pr), 0);
  f.write("e2e/warning.ts", 'console.log("warning");\n');
  assert.equal(await lintChangedFiles(f.options(f.commit(), clean)), 1);
});

test("prose-only and deleted TypeScript pass without linting missing files", async (t) => {
  const f = fixture(t);
  f.write("src/deleted.ts", "debugger;\n");
  const base = f.commit();
  f.git("rm", "src/deleted.ts");
  f.write("README.md", "Prose only\n");
  const options = f.options(f.commit(), base);
  assert.deepEqual(changedLintFiles(options), []);
  assert.equal(await lintChangedFiles(options), 0);
});

test("missing history, invalid events/revisions and stale checkout cannot pass", (t) => {
  const f = fixture(t);
  f.write("README.md", "Next\n");
  const head = f.commit();
  for (const before of [undefined, "0".repeat(40), "--help", "a".repeat(40)]) {
    assert.throws(() => changedLintFiles({ ...f.options(head), event: { before } }));
  }
  assert.throws(() => changedLintFiles({ ...f.options(head), eventName: "schedule" }));
  assert.throws(() => changedLintFiles(f.options("main")));
  assert.throws(() => changedLintFiles(f.options(f.base)));
  const eventPath = path.join(f.cwd, "event.json");
  fs.writeFileSync(eventPath, JSON.stringify({ before: "a".repeat(40) }));
  const result = spawnSync(process.execPath, [script], {
    cwd: f.cwd, encoding: "utf8",
    env: { ...process.env, GITHUB_EVENT_NAME: "push", GITHUB_EVENT_PATH: eventPath, GITHUB_SHA: head },
  });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /no changed TypeScript|passed/);
});
