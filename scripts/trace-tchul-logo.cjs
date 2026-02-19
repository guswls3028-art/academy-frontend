/**
 * TchulLogo.png → bitmap tracing → path 기반 SVG
 * potrace 방식 트레이싱, viewBox/원본비율/배경제거/커브 스무딩
 */
const fs = require("fs");
const path = require("path");

const ImageTracer = require("../node_modules/imagetracerjs/imagetracer_v1.2.6.js");
const PNGReader = require("../node_modules/imagetracerjs/nodecli/PNGReader.js");

const INPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogo.png");
const OUTPUT_SVG = path.join(__dirname, "out/tchul-logo-traced.svg");

const options = {
  ltres: 0.01,
  qtres: 0.5,
  pathomit: 8,
  rightangleenhance: false,
  colorsampling: 2,
  numberofcolors: 24,
  mincolorratio: 0,
  colorquantcycles: 5,
  layering: 0,
  strokewidth: 0,
  linefilter: true,
  scale: 1,
  roundcoords: 2,
  viewbox: true,
  desc: false,
  blurradius: 0,
  blurdelta: 20,
};

function main() {
  const bytes = fs.readFileSync(INPUT);
  const reader = new PNGReader(bytes);

  reader.parse(function (err, png) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const imageData = {
      width: png.width,
      height: png.height,
      data: new Uint8ClampedArray(png.pixels),
    };
    const svgString = ImageTracer.imagedataToSVG(imageData, options);

    // 배경(흰색/밝은 영역) path 제거: fill이 #fff 또는 rgb(255,255,255)인 path 제거
    let svg = svgString;
    const removeWhiteFill = /<path[^>]*\sfill="(?:#fff|#ffffff|rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\))"[^>]*\/>/gi;
    svg = svg.replace(removeWhiteFill, "");

    fs.mkdirSync(path.dirname(OUTPUT_SVG), { recursive: true });
    fs.writeFileSync(OUTPUT_SVG, svg, "utf8");
    console.log("Written:", OUTPUT_SVG);
  });
}

main();
