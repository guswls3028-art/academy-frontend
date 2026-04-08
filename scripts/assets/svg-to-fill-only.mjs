/**
 * 기존 SVG를 fill-only print-grade로 변환
 * - stroke / stroke-width 제거
 * - shape-rendering="geometricPrecision"
 * - path d 좌표 1자리 반올림
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVG_PATH = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogoTraced.svg");

function toFillOnlyPrintGrade(svg) {
  svg = svg.replace(/\s*stroke-width="[^"]*"/gi, "");
  svg = svg.replace(/\s*stroke="[^"]*"/gi, "");
  svg = svg.replace(
    /(\s)d="([^"]+)"/g,
    (_, space, d) =>
      space + 'd="' + d.replace(/[-+]?\d*\.?\d+/g, (n) => Number(n).toFixed(1)) + '"'
  );
  svg = svg.replace(/<svg\s/, '<svg shape-rendering="geometricPrecision" ');
  return svg;
}

const svg = fs.readFileSync(SVG_PATH, "utf8");
const out = toFillOnlyPrintGrade(svg);
fs.writeFileSync(SVG_PATH, out, "utf8");
console.log("Updated:", SVG_PATH);
