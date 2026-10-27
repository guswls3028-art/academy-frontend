import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Linter } from "eslint";

const dist = path.resolve("dist");
const html = await readFile(path.join(dist, "index.html"), "utf8");
assert.match(html, /id="vite-legacy-entry"/, "Production HTML must load the legacy entry");
assert.match(html, /id="vite-legacy-polyfill"/, "Production HTML must load browser polyfills first");

let modules = 0;
for (const name of await readdir(path.join(dist, "assets"))) {
  if (!/-legacy.*\.js$/.test(name)) continue;
  const code = await readFile(path.join(dist, "assets", name), "utf8");
  if (!/\bSystem\.register\s*\(/.test(code)) continue;
  assert.ok(/^(?:"use strict"|'use strict');/.test(code), `${name}: legacy modules must preserve strict binding semantics after minification`);
  modules += 1;
}
assert.ok(modules > 0, "No executable legacy modules found");
const workers = (await readdir(path.join(dist, "assets"))).filter((name) => /^vendor-heic-csp-worker-.*\.js$/.test(name));
assert.equal(workers.length, 1, "One cancellable homework HEIC worker must be emitted");
// Separately bundled workers do not inherit the main page's legacy transform.
const workerSyntax = new Linter().verify(await readFile(path.join(dist, "assets", workers[0]), "utf8"),
  { languageOptions: { ecmaVersion: 2017, sourceType: "script" } }, { allowInlineConfig: false });
assert.deepEqual(workerSyntax, [], "The homework worker must parse on the supported Safari syntax target");
console.log(`[legacy-bundle] PASS (${modules} production modules preserve strict semantics)`);
