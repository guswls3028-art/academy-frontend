import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const guard = fileURLToPath(new URL("./check-bundle-budgets.mjs", import.meta.url));
const cases = [
  { name: "rejects transitive ESM re-exports", rejected: true, files: {
    "index.js": 'import "./shared.js";', "shared.js": 'export * from "./vendor-pdfjs-a.js";',
  } },
  { name: "rejects transitive legacy dependencies", rejected: true, files: {
    "index-legacy.js": 'System.register(["./shared.js"], function () { return {}; });',
    "shared.js": 'System.register("shared", ["./vendor-pdfjs-a.js"], function () { return {}; });',
  } },
  { name: "rejects a shared Query dependency even outside HTML", rejected: true, files: {
    "vendor-query-a.js": 'import "./shared.js";', "shared.js": 'import "./vendor-pdfjs-a.js";',
  } },
  { name: "allows lazy PDF imports", files: { "index.js": 'import("./vendor-pdfjs-a.js");' } },
  { name: "allows cycles without traversing dynamic imports", files: {
    "index.js": 'import "./shared.js";', "shared.js": 'import "./index.js"; import("./vendor-pdfjs-a.js");',
  } },
  { name: "ignores import-looking strings and comments", files: {
    "index.js": 'const text = "import \'./vendor-pdfjs-a.js\'"; /* export * from "./vendor-pdfjs-a.js" */',
  } },
];

for (const scenario of cases) test(scenario.name, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "academy-bundle-guard-"));
  try {
    const assets = path.join(root, "dist/assets");
    await mkdir(assets, { recursive: true });
    const files = { "core.js": "export {};", "index.js": "export {};", "vendor-pdfjs-a.js": "export {};", ...scenario.files };
    await Promise.all(Object.entries(files).map(([name, source]) => writeFile(path.join(assets, name), source)));
    await writeFile(path.join(root, "dist/index.html"),
      '<link rel="modulepreload" href="/assets/core.js"><script type="module" src="/assets/index.js"></script>'
      + (files["index-legacy.js"] ? '<script id="vite-legacy-entry" data-src="/assets/index-legacy.js"></script>' : ""));
    const result = spawnSync(process.execPath, [guard], { cwd: root, encoding: "utf8", timeout: 10_000 });
    assert.ifError(result.error);
    if (scenario.rejected) {
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /must not depend on PDF\.js/);
    } else {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /\[bundle-budget\] PASS/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
