import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ASSETS_DIR = path.resolve("dist", "assets");
const KIB = 1024;

const limitsFor = (name) => {
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

if (violations.length > 0) {
  for (const item of violations) {
    console.error(
      `[bundle-budget] ${item.name}: raw ${(item.raw / KIB).toFixed(1)} KiB / ${(item.limits.raw / KIB).toFixed(0)} KiB, ` +
      `gzip ${(item.gzip / KIB).toFixed(1)} KiB / ${(item.limits.gzip / KIB).toFixed(0)} KiB`,
    );
  }
  throw new Error(`Bundle budget exceeded by ${violations.length} asset(s).`);
}

console.log(`[bundle-budget] PASS (${files.length} JavaScript assets checked)`);
