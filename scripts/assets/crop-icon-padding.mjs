/**
 * 아이콘 이미지에서 좌우 상하 패딩 모두 제거하고 아이콘만 남김
 * - 투명한 여백을 모두 제거하여 아이콘의 실제 경계만 남김
 * - 1:1 비율로 정사각형 크롭
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogoIcon.png");
const OUTPUT_TEMP = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogoIcon.temp.png");
const OUTPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogoIcon.png");

async function main() {
  const image = sharp(INPUT);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  console.log(`Input image: ${width}x${height}`);

  // 이미지에서 좌우 패딩 찾기
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = 4; // RGBA
  const buf = new Uint8ClampedArray(data);

  // 좌우 상하 모든 경계 찾기
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  // 전체 이미지에서 스캔하여 아이콘의 실제 경계 찾기
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
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

  const iconWidth = maxX - minX + 1;
  const iconHeight = maxY - minY + 1;

  console.log(`Icon bounds: x=${minX}-${maxX}, y=${minY}-${maxY}`);
  console.log(`Icon size: ${iconWidth}x${iconHeight}`);

  // 1:1 비율로 만들기 위해 더 긴 쪽 기준
  const size = Math.max(iconWidth, iconHeight);

  // 중앙 정렬을 위한 오프셋 계산
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  const cropX = Math.max(0, Math.floor(centerX - size / 2));
  const cropY = Math.max(0, Math.floor(centerY - size / 2));
  
  // 크롭 영역이 이미지 범위를 벗어나지 않도록 조정
  const finalCropX = Math.max(0, Math.min(cropX, width - size));
  const finalCropY = Math.max(0, Math.min(cropY, height - size));
  const finalSize = Math.min(size, width - finalCropX, height - finalCropY);

  console.log(`Cropping: x=${finalCropX}, y=${finalCropY}, size=${finalSize}x${finalSize}`);

  // 임시 파일에 저장 후 원본 파일로 교체
  await image
    .extract({
      left: finalCropX,
      top: finalCropY,
      width: finalSize,
      height: finalSize,
    })
    .png()
    .toFile(OUTPUT_TEMP);

  // 임시 파일을 원본 파일로 교체
  fs.renameSync(OUTPUT_TEMP, OUTPUT);

  console.log(`✓ Created: ${OUTPUT} (${finalSize}x${finalSize})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
