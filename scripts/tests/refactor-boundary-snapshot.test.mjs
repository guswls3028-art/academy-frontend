import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");

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
