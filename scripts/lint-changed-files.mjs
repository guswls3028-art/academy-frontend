import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ESLint } from "eslint";

export function changedLintFiles({ eventName, event, head, cwd = process.cwd() }) {
  const sha = /^[0-9a-f]{40}$/;
  if (!sha.test(head || "")) throw new Error("Strict lint requires an exact head SHA.");
  let base;
  if (eventName === "pull_request") base = event.pull_request?.base?.sha;
  else if (eventName === "push") base = event.before;
  else if (eventName === "workflow_dispatch") base = `${head}^`;
  else throw new Error(`Unsupported strict lint event: ${eventName}`);
  if (eventName !== "workflow_dispatch" && (!sha.test(base || "") || /^0+$/.test(base))) {
    throw new Error("Strict lint requires an exact nonzero base SHA.");
  }
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (git("rev-parse", "HEAD").trim() !== head) throw new Error("Strict lint head does not match the checkout.");
  // Renames become deletion + addition; NUL delimiters preserve literal paths.
  return git("diff", "--name-only", "--no-renames", "--diff-filter=d", "-z", base, head, "--", "*.ts", "*.tsx")
    .split("\0").filter(Boolean);
}

export async function lintChangedFiles(options) {
  const files = changedLintFiles(options);
  if (files.length === 0) {
    console.log("Strict lint: no changed TypeScript files.");
    return 0;
  }
  const eslint = new ESLint({ cwd: options.cwd ?? process.cwd(), globInputPaths: false });
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter("stylish");
  const report = formatter.format(results);
  if (report) console.log(report);
  const failed = results.some((result) => result.errorCount > 0 || result.warningCount > 0);
  console.log(`Strict lint: ${files.length} changed TypeScript file(s), ${failed ? "failed" : "passed"}.`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await lintChangedFiles({
    eventName: process.env.GITHUB_EVENT_NAME,
    event: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
    head: process.env.GITHUB_SHA,
  });
}
