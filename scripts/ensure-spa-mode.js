/**
 * Cloudflare Pages SPA 모드 유지: dist/404.html 제거.
 * 404.html이 있으면 Pages가 SPA가 아닌 것으로 간주해 /admin/* 등에서 404를 반환함.
 */
import { unlinkSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist404 = join(__dirname, "..", "dist", "404.html");
if (existsSync(dist404)) {
  unlinkSync(dist404);
  console.log("Removed dist/404.html (Cloudflare Pages SPA mode)");
}
