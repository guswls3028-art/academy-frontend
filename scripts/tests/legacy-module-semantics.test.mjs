import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "vite";

import { legacyModuleSemanticsPlugin } from "../legacy-module-semantics.mjs";

// Reduced from the emitted cssinjs parseStyle callback that crashed while
// opening an existing dialog. Minified block-function names are safe in ESM
// strict mode, but Annex B hoists this inner `e` over the outer style map.
const legacyStyleParser = `
(function () {
  System.register([], function () {
    return { execute: function () {
      const e = { a: { color: "red" } };
      Object.keys(e).forEach(s => {
        let c = e[s];
        if (typeof c === "object") {
          record(c.color);
        } else {
          function e(key, value) { record(key + ":" + value); }
          e(s, c);
        }
      });
    }};
  });
})();
`;

function execute(code) {
  const result = [];
  vm.runInNewContext(code, {
    record(value) { result.push(value); },
    System: { register(_dependencies, declare) { declare().execute(); } },
  });
  return result;
}

test("the real legacy CSS parser binding failure is reproduced without strict semantics", () => {
  assert.throws(() => execute(legacyStyleParser), /Cannot read properties of undefined \(reading 'a'\)/);
});

test("legacy output preserves module bindings and successfully parses the same style", () => {
  const plugin = legacyModuleSemanticsPlugin();
  assert.equal(plugin.renderChunk.order, "post");
  const result = plugin.renderChunk.handler(legacyStyleParser, { fileName: "assets/es-legacy-ABC.js" });
  assert.match(result.code, /^"use strict";/);
  assert.deepEqual(execute(result.code), ["red"]);
});

test("modern modules and the legacy polyfill loader retain their original execution mode", () => {
  const plugin = legacyModuleSemanticsPlugin();
  assert.equal(plugin.renderChunk.handler("export const module = true", { fileName: "assets/es-ABC.js" }), null);
  assert.equal(plugin.renderChunk.handler("(function(){this.System={};})();", { fileName: "assets/polyfills-legacy-ABC.js" }), null);
});

test("Vite's final legacy ESM minification retains executable strict semantics", async () => {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [{
      name: "legacy-systemjs-fixture",
      resolveId(id) { return id === "legacy-style-fixture" ? id : null; },
      load(id) { return id === "legacy-style-fixture" ? "export const value = 1;" : null; },
      renderChunk() { return { code: legacyStyleParser, map: null }; },
    }, legacyModuleSemanticsPlugin()],
    build: {
      write: false,
      minify: "oxc",
      rolldownOptions: {
        input: "legacy-style-fixture",
        output: { format: "esm", entryFileNames: "assets/style-legacy-[hash].js" },
      },
    },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const chunk = output.find((item) => item.type === "chunk");
  assert.ok(chunk);
  assert.deepEqual(execute(chunk.code), ["red"]);
});
