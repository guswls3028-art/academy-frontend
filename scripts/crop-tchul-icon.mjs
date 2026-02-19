/**
 * TchulLogoTransparent.png — 아이콘 영역만 1:1 비율로 크롭
 * - 텍스트 영역 제외, 아이콘만 추출
 * - 1:1 비율로 정사각형 크롭
 * - 적절한 패딩 포함
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogoTransparent.png");
const OUTPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogoIcon.png");

async function main() {
  const image = sharp(INPUT);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  console.log(`Input image: ${width}x${height}`);

  // 이미지의 상단 부분에서 아이콘 영역 찾기
  // 텍스트는 보통 하단에 있으므로, 상단 50% 정도에서 아이콘 영역 감지
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = 4; // RGBA
  const buf = new Uint8ClampedArray(data);

  // 투명하지 않은 픽셀 찾기 (alpha > 0)
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  // 상단 50% 영역만 스캔 (텍스트 영역 제외)
  const scanHeight = Math.floor(height * 0.5);
  
  // 중앙 영역에 집중 (좌우 20% 제외)
  const marginX = Math.floor(width * 0.2);
  const scanStartX = marginX;
  const scanEndX = width - marginX;

  for (let y = 0; y < scanHeight; y++) {
    for (let x = scanStartX; x < scanEndX; x++) {
      const idx = (y * width + x) * channels;
      const alpha = buf[idx + 3];

      if (alpha > 10) { // 투명하지 않은 픽셀
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Icon bounds: x=${minX}-${maxX}, y=${minY}-${maxY}`);
  console.log(`Icon size: ${maxX - minX + 1}x${maxY - minY + 1}`);

  // 아이콘 영역 크기 계산
  const iconWidth = maxX - minX + 1;
  const iconHeight = maxY - minY + 1;

  // 1:1 비율로 만들기 위해 더 긴 쪽 기준
  const size = Math.max(iconWidth, iconHeight);

  // 패딩 추가 (10% 정도)
  const padding = Math.floor(size * 0.1);
  const finalSize = size + padding * 2;

  // 중앙 정렬을 위한 오프셋 계산
  const offsetX = Math.max(0, minX - padding);
  const offsetY = Math.max(0, minY - padding);

  // 크롭 영역이 이미지 범위를 벗어나지 않도록 조정
  const cropX = offsetX;
  const cropY = offsetY;
  const cropWidth = Math.min(finalSize, width - cropX);
  const cropHeight = Math.min(finalSize, height - cropY);

  // 정사각형으로 크롭
  const squareSize = Math.min(cropWidth, cropHeight);

  console.log(`Cropping: x=${cropX}, y=${cropY}, size=${squareSize}x${squareSize}`);

  await image
    .extract({
      left: cropX,
      top: cropY,
      width: squareSize,
      height: squareSize,
    })
    .png()
    .toFile(OUTPUT);

  console.log(`✓ Created: ${OUTPUT} (${squareSize}x${squareSize})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
