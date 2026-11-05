import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Linter } from "eslint";

const ASSETS_DIR = path.resolve("dist", "assets");
const ENTRY_HTML_PATH = path.resolve("dist", "index.html");
const KIB = 1024;
const INITIAL_PRELOAD_GZIP_LIMIT = 220 * KIB;

const limitsFor = (name) => {
  // CSP-safe libheif is loaded only when a homework HEIC preview is requested.
  if (name.startsWith("vendor-heic-csp-")) return { raw: 3_200 * KIB, gzip: 800 * KIB };
  if (name.startsWith("vendor-heic-")) return { raw: 1_400 * KIB, gzip: 360 * KIB };
  if (name.startsWith("vendor-excel-")) return { raw: 1_000 * KIB, gzip: 290 * KIB };
  if (name.startsWith("vendor-")) return { raw: 600 * KIB, gzip: 200 * KIB };
  return { raw: 180 * KIB, gzip: 65 * KIB };
};

const files = (await readdir(ASSETS_DIR)).filter((name) => name.endsWith(".js"));
if (files.length === 0) {
  throw new Error("Bundle budget guard found no JavaScript assets in dist/assets.");
}

const violations = [];
for (const name of files) {
  const filePath = path.join(ASSETS_DIR, name);
  const raw = (await stat(filePath)).size;
  const gzip = gzipSync(await readFile(filePath)).length;
  const limits = limitsFor(name);
  if (raw > limits.raw || gzip > limits.gzip) {
    violations.push({ name, raw, gzip, limits });
  }
}

const entryHtml = await readFile(ENTRY_HTML_PATH, "utf8");
const initialJsPreloads = [...entryHtml.matchAll(/<link\b[^>]*>/g)]
  .map(([tag]) => {
    if (!/\brel="modulepreload"/i.test(tag)) return null;
    const href = tag.match(/\bhref="([^"]+\.js(?:[?#][^"]*)?)"/i)?.[1];
    if (!href) return null;
    const relativePath = new URL(href, "https://academy.invalid").pathname.replace(/^\/+/, "");
    return { href, filePath: path.resolve("dist", relativePath) };
  })
  .filter((entry) => entry !== null);

if (initialJsPreloads.length === 0) {
  throw new Error("Bundle budget guard found no JavaScript module preloads in dist/index.html.");
}

const eagerPdfJs = initialJsPreloads.find(({ href }) => href.includes("vendor-pdfjs-"));
if (eagerPdfJs) {
  throw new Error(`PDF.js must stay out of the initial HTML preload list: ${eagerPdfJs.href}`);
}

const initialJsScripts = [...entryHtml.matchAll(/<script\b[^>]*>/g)]
  .map(([tag]) => tag.match(/\bsrc="([^"]+\.js(?:[?#][^"]*)?)"/i)?.[1])
  .filter((href) => href !== undefined)
  .map((href) => {
    const url = new URL(href, "https://academy.invalid");
    if (url.origin !== "https://academy.invalid") return null;
    const relativePath = url.pathname.replace(/^\/+/, "");
    return { href, filePath: path.resolve("dist", relativePath) };
  })
  .filter((entry) => entry !== null);
const initialJsAssetPaths = new Map(
  [...initialJsPreloads, ...initialJsScripts].map(({ href, filePath }) => [filePath, href]),
);
for (const name of files.filter((asset) => asset.startsWith("vendor-query"))) {
  initialJsAssetPaths.set(path.join(ASSETS_DIR, name), `/assets/${name}`);
}
const linter = new Linter();
const staticDependencies = (source, href) => {
  const dependencies = [];
  const declaration = (node) => {
    if (typeof node.source?.value === "string") dependencies.push(node.source.value);
  };
  const errors = linter.verify(source, {
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: { bundle: { rules: { dependencies: { create: () => ({
      ImportDeclaration: declaration,
      ExportNamedDeclaration: declaration,
      ExportAllDeclaration: declaration,
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || node.callee.computed
          || node.callee.object.name !== "System" || node.callee.property.name !== "register") return;
        const list = node.arguments[typeof node.arguments[0]?.value === "string" ? 1 : 0];
        if (list?.type !== "ArrayExpression") return;
        for (const item of list.elements) {
          if (typeof item?.value === "string") dependencies.push(item.value);
        }
      },
    }) } } } },
    rules: { "bundle/dependencies": "error" },
  }, { allowInlineConfig: false });
  if (errors.length) throw new Error(`Cannot inspect static dependencies of ${href}: ${errors[0].message}`);
  return dependencies;
};
const queue = [...initialJsAssetPaths].map(([filePath, href]) => ({ filePath, href, chain: [href] }));
const visited = new Set();
for (const { filePath, href, chain } of queue) {
  if (visited.has(filePath)) continue;
  visited.add(filePath);
  if (path.basename(filePath).startsWith("vendor-pdfjs-")) {
    throw new Error(`Initial/shared JavaScript must not depend on PDF.js: ${chain.join(" -> ")}`);
  }
  const source = await readFile(filePath, "utf8");
  for (const dependency of staticDependencies(source, href)) {
    if (!dependency.startsWith(".") && !dependency.startsWith("/")) continue;
    const url = new URL(dependency, new URL(href, "https://academy.invalid"));
    if (url.origin !== "https://academy.invalid" || !url.pathname.endsWith(".js")) continue;
    queue.push({ filePath: path.resolve("dist", url.pathname.replace(/^\/+/, "")),
      href: url.pathname, chain: [...chain, url.pathname] });
  }
}

const initialPreloadBuffers = await Promise.all(
  initialJsPreloads.map(({ filePath }) => readFile(filePath)),
);
const initialPreloadGzip = initialPreloadBuffers.reduce(
  (total, buffer) => total + gzipSync(buffer).length,
  0,
);
if (initialPreloadGzip > INITIAL_PRELOAD_GZIP_LIMIT) {
  const largest = initialJsPreloads.map(({ href }, index) => ({
    href, gzip: gzipSync(initialPreloadBuffers[index]).length,
  })).sort((a, b) => b.gzip - a.gzip).slice(0, 12);
  for (const asset of largest) {
    console.error(`[bundle-budget] initial ${asset.href}: ${(asset.gzip / KIB).toFixed(1)} KiB gzip`);
  }
  throw new Error(
    `Initial JavaScript preload budget exceeded: ${(initialPreloadGzip / KIB).toFixed(1)} KiB gzip / ` +
    `${(INITIAL_PRELOAD_GZIP_LIMIT / KIB).toFixed(0)} KiB across ${initialJsPreloads.length} chunks.`,
  );
}

if (violations.length > 0) {
  for (const item of violations) {
    console.error(
      `[bundle-budget] ${item.name}: raw ${(item.raw / KIB).toFixed(1)} KiB / ${(item.limits.raw / KIB).toFixed(0)} KiB, ` +
      `gzip ${(item.gzip / KIB).toFixed(1)} KiB / ${(item.limits.gzip / KIB).toFixed(0)} KiB`,
    );
  }
  throw new Error(`Bundle budget exceeded by ${violations.length} asset(s).`);
}

console.log(
  `[bundle-budget] PASS (${files.length} JavaScript assets; initial preloads ` +
  `${(initialPreloadGzip / KIB).toFixed(1)}/${(INITIAL_PRELOAD_GZIP_LIMIT / KIB).toFixed(0)} KiB gzip, ` +
  `${initialJsPreloads.length} chunks)`,
);
