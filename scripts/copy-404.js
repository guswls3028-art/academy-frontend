/**
 * SPA 폴백: dist/index.html → dist/404.html 복사.
 * Cloudflare Pages에서는 사용하지 않음(404.html이 있으면 SPA 모드가 꺼져 /admin/* 등이 404됨).
 * Netlify 등 404.html을 쓰는 호스팅에서만 필요 시 수동 실행.
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
