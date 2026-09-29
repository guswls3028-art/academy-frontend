import { readFileSync } from "node:fs";

/** Preserve ESM strict semantics after plugin-legacy wraps SystemJS modules. */
export function legacyModuleSemanticsPlugin() {
  const transformIdentity = readFileSync(new URL(import.meta.url), "utf8");
  const isLegacyModule = (code, chunk) =>
    chunk.fileName.includes("-legacy") && /\bSystem\.register\s*\(/.test(code);
  return {
    name: "academy-legacy-module-semantics",
    apply: "build",
    enforce: "post",
    renderChunk: {
      order: "post",
      handler(code, chunk) {
        if (!isLegacyModule(code, chunk)) return null;
        // plugin-legacy's outer IIFE can discard the module's directive. In
        // sloppy scripts Annex B hoists block functions, changing bindings in
        // minified code (including Ant Design's nested style parser).
        return { code: `"use strict";\n${code}`, map: null };
      },
    },
    augmentChunkHash(chunk) {
      return chunk.fileName.includes("-legacy") ? transformIdentity : null;
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== "chunk" || !isLegacyModule(chunk.code, chunk)) continue;
          // Rolldown labels these outputs ESM, so Oxc can remove the directive
          // as redundant after renderChunk. They are actually classic scripts
          // loaded by SystemJS: restore the directive in the final artifact.
          if (!/^\s*(["'])use strict\1\s*;/.test(chunk.code)) {
            chunk.code = `"use strict";\n${chunk.code}`;
          }
        }
      },
    },
  };
}
