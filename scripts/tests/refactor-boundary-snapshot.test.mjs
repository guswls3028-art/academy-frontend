import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import url from "node:url";
import { readFileSync } from "node:fs";
import { approvedEmptyScoreExitFetchCount } from "../refactor-native-transport.mjs";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");

test("only one exact empty score exit fetch in the central owner is approved", () => {
  const owner = "src/shared/api/axios.ts";
  const source = readFileSync(path.join(root, owner), "utf8");
  assert.equal(approvedEmptyScoreExitFetchCount(owner, source), 1);
  assert.equal(approvedEmptyScoreExitFetchCount("src/feature/api.ts", source), 0);
  assert.equal(approvedEmptyScoreExitFetchCount(owner, source.replace("function releaseEmptyScoreDraftOnPageExit", "function other")), 0);
  assert.equal(approvedEmptyScoreExitFetchCount(owner, source.replace("${sessionId}/score-draft/commit/", "${sessionId}/scores/")), 0);
  // A second exact call is still debt, as is any generic fetch in the same file.
  assert.equal(approvedEmptyScoreExitFetchCount(owner, source + source), 1);
  assert.equal(approvedEmptyScoreExitFetchCount(owner, source + "\nfetch(url);"), 1);
});

function snapshot() {
  const output = execFileSync(
    process.execPath,
    ["scripts/refactor-boundary-snapshot.mjs", "--json"],
    { cwd: root, encoding: "utf8" },
  );
  return JSON.parse(output);
}

test("public domain contracts do not count as internal reach-through", () => {
  const payload = snapshot();
  const publicFindings = payload.findings.filter(
    (finding) => finding.kind === "same_app_domain_import" && finding.detail.includes("/public/"),
  );

  assert.deepEqual(publicFindings, []);
  assert.ok(payload.summary.same_app_domain_import > 0, "guard must still report internal imports");
});

test("response metric counts declarations, not imported type specifiers", () => {
  const source = `
    import { type ImportedResponse } from "./contract";
    export type LocalResponse = { ok: true };
    interface LocalDTO { id: number }
  `;
  const pattern = /^\s*(?:export\s+)?(?:declare\s+)?(?:interface\s+[A-Za-z0-9_]*(?:Response|DTO|Dto)\b(?:\s+extends[^\{]+)?\s*\{|type\s+[A-Za-z0-9_]*(?:Response|DTO|Dto)\b\s*=)/gm;

  assert.equal([...source.matchAll(pattern)].length, 2);
});
