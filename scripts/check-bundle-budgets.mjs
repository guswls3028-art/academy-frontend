import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

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

const initialPreloadBuffers = await Promise.all(
  initialJsPreloads.map(({ filePath }) => readFile(filePath)),
);
const initialPreloadGzip = initialPreloadBuffers.reduce(
  (total, buffer) => total + gzipSync(buffer).length,
  0,
);
if (initialPreloadGzip > INITIAL_PRELOAD_GZIP_LIMIT) {
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
