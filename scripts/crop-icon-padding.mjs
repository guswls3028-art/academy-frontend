/**
 * 아이콘 이미지에서 좌우 패딩만 제거하고 1:1 비율로 크롭
 * - 사용자가 위아래는 이미 잘랐다고 가정
 * - 좌우 여백만 제거하여 아이콘 경계만 남김
 * - 1:1 비율로 정사각형 크롭
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogoIcon.png");
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

  // 좌우 경계 찾기 (위아래는 이미 잘랐다고 가정)
  let minX = width;
  let maxX = 0;

  // 전체 높이에서 스캔
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = buf[idx + 3];

      if (alpha > 10) { // 투명하지 않은 픽셀
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }

  const iconWidth = maxX - minX + 1;
  const iconHeight = height;

  console.log(`Icon bounds: x=${minX}-${maxX}`);
  console.log(`Icon size: ${iconWidth}x${iconHeight}`);

  // 1:1 비율로 만들기 위해 더 긴 쪽 기준
  const size = Math.max(iconWidth, iconHeight);

  // 중앙 정렬을 위한 오프셋 계산
  const centerX = (minX + maxX) / 2;
  const cropX = Math.max(0, Math.floor(centerX - size / 2));
  
  // 크롭 영역이 이미지 범위를 벗어나지 않도록 조정
  const finalCropX = Math.max(0, Math.min(cropX, width - size));
  const finalSize = Math.min(size, width - finalCropX);

  console.log(`Cropping: x=${finalCropX}, y=0, size=${finalSize}x${finalSize}`);

  await image
    .extract({
      left: finalCropX,
      top: 0,
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
