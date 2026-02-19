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

  // 텍스트 영역 제거하고 아이콘만 추출
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = 4; // RGBA
  const buf = new Uint8ClampedArray(data);

  // 아이콘은 상단에 있으므로 상단 30%만 확실하게 아이콘 영역으로 사용
  // 텍스트는 하단에 있으므로 상단 30%는 안전하게 아이콘만 포함
  const iconMaxY = Math.floor(height * 0.3);
  
  console.log(`Using top ${iconMaxY}px as icon area (${(iconMaxY/height*100).toFixed(1)}% of image)`);
  
  // 아이콘의 실제 경계 찾기 (좌우 패딩 없이)
  // 중앙 영역에 집중 (좌우 25% 제외하여 여백 제거)
  const marginX = Math.floor(width * 0.25);
  const scanStartX = marginX;
  const scanEndX = width - marginX;
  
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  // 텍스트 위쪽 아이콘 영역만 스캔
  for (let y = 0; y < iconMaxY; y++) {
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
  const iconHeight_cropped = maxY - minY + 1;

  // 1:1 비율로 만들기 위해 더 긴 쪽 기준
  const size = Math.max(iconWidth, iconHeight_cropped);

  // 중앙 정렬을 위한 오프셋 계산 (패딩 없이)
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  const cropX = Math.max(0, Math.floor(centerX - size / 2));
  const cropY = Math.max(0, Math.floor(centerY - size / 2));
  
  // 크롭 영역이 이미지 범위를 벗어나지 않도록 조정
  const finalCropX = cropX;
  const finalCropY = cropY;
  const finalSize = Math.min(size, width - finalCropX, height - finalCropY);

  console.log(`Cropping: x=${finalCropX}, y=${finalCropY}, size=${finalSize}x${finalSize}`);

  await image
    .extract({
      left: finalCropX,
      top: finalCropY,
      width: finalSize,
      height: finalSize,
    })
    .png()
    .toFile(OUTPUT);

  console.log(`✓ Created: ${OUTPUT} (${finalSize}x${finalSize})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
