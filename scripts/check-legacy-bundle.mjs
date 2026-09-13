import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

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
console.log(`[legacy-bundle] PASS (${modules} production modules preserve strict semantics)`);
