/**
 * TchulLogo.png → 리사이즈 후 bitmap tracing → path 기반 SVG
 * (원본 해상도 그대로 트레이싱 시 SVG가 수십 MB가 되므로, 리사이즈 후 트레이싱)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogo.png");
const OUTPUT_SVG = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogoTraced.svg");
const MAX_WIDTH = 400;

const ImageTracer = require("../node_modules/imagetracerjs/imagetracer_v1.2.6.js");

const options = {
  ltres: 0.01,
  qtres: 0.5,
  pathomit: 8,
  rightangleenhance: false,
  numberofcolors: 16,
  strokewidth: 0,
  linefilter: true,
  scale: 1,
  roundcoords: 2,
  viewbox: true,
  desc: false,
};

/**
 * stroke 제거, shape-rendering="geometricPrecision", fill-only closed path 정리
 * (서브픽셀 안티앨리어싱 완화 · print-grade SVG)
 */
function toFillOnlyPrintGrade(svg) {
  // 1) path에서 stroke, stroke-width 제거 (fill만 유지)
  svg = svg.replace(/\s*stroke-width="[^"]*"/gi, "");
  svg = svg.replace(/\s*stroke="[^"]*"/gi, "");

  // 2) path d 내부 좌표를 1자리로 반올림 (서브픽셀 블러 감소)
  svg = svg.replace(
    /(\s)d="([^"]+)"/g,
    (_, space, d) =>
      space + 'd="' + d.replace(/[-+]?\d*\.?\d+/g, (n) => Number(n).toFixed(1)) + '"'
  );

  // 3) 루트 <svg>에 shape-rendering="geometricPrecision" 추가
  svg = svg.replace(
    /<svg\s/,
    '<svg shape-rendering="geometricPrecision" '
  );

  return svg;
}

async function main() {
  const { data, info } = await sharp(INPUT)
    .resize(MAX_WIDTH, null, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imageData = {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data),
  };

  let svg = ImageTracer.imagedataToSVG(imageData, options);

  // 흰색 배경 path 제거
  svg = svg.replace(
    /<path[^>]*\sfill="(?:#fff|#ffffff|rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\))"[^>]*\/?>/gi,
    ""
  );
  // 거의 흰색 rgb(24x~255, 24x~255, 24x~255) path 제거
  svg = svg.replace(
    /<path\s[^>]*fill="rgb\s*\(\s*2[4-5]\d\s*,\s*2[4-5]\d\s*,\s*2[4-5]\d\s*\)"[^>]*\/?>/gi,
    ""
  );

  // Fill-only, print-grade: stroke 제거 · shape-rendering · 좌표 정규화
  svg = toFillOnlyPrintGrade(svg);

  fs.mkdirSync(path.dirname(OUTPUT_SVG), { recursive: true });
  fs.writeFileSync(OUTPUT_SVG, svg, "utf8");
  console.log("Written:", OUTPUT_SVG, "size:", (svg.length / 1024).toFixed(1), "KB");
  console.log("(TchulLogoTraced.tsx uses this file; no manual copy needed.)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
