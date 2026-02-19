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
const OUTPUT_SVG = path.join(__dirname, "out/tchul-logo-traced.svg");
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

  // 흰색 배경 path 제거 (fill이 #fff/#ffffff/rgb(255,255,255)인 path)
  svg = svg.replace(
    /<path[^>]*\sfill="(?:#fff|#ffffff|rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\))"[^>]*\/?>/gi,
    ""
  );

  fs.mkdirSync(path.dirname(OUTPUT_SVG), { recursive: true });
  fs.writeFileSync(OUTPUT_SVG, svg, "utf8");
  console.log("Written:", OUTPUT_SVG, "size:", (svg.length / 1024).toFixed(1), "KB");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
