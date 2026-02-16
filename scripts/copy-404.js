/**
 * Cloudflare Pages SPA 폴백: 미존재 경로 접근 시 index.html 제공
 * 빌드 후 dist/index.html → dist/404.html 복사
 */
import { copyFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "..", "dist");
const index = join(dist, "index.html");
const out404 = join(dist, "404.html");

if (!existsSync(index)) {
  console.error("scripts/copy-404.js: dist/index.html not found. Run build first.");
  process.exit(1);
}
copyFileSync(index, out404);
console.log("Copied dist/index.html → dist/404.html (SPA fallback)");
