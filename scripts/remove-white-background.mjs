/**
 * TchulLogo.png — 흰색 배경만 제거, RGBA PNG 출력
 * - white → alpha (배경 제거)
 * - anti-aliased edge 유지 (near-white 구간 부드럽게 투명화)
 * - halo 방지 (경계만 처리, 로고 픽셀 유지)
 * - 원본 해상도 유지
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogo.png");
const OUTPUT = path.join(__dirname, "../src/features/auth/pages/logos/TchulLogo.png");

async function main() {
  const { data, info } = await sharp(INPUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const channels = 4; // RGBA
  const buf = new Uint8ClampedArray(data);

  // 흰색 구간: min(R,G,B) >= THRESHOLD_FULL 이면 완전 투명
  // THRESHOLD_SOFT ~ THRESHOLD_FULL 사이면 alpha를 선형으로 줄여서 edge 유지 (halo 방지)
  const THRESHOLD_FULL = 252;  // 이 이상이면 완전 투명
  const THRESHOLD_SOFT = 238;  // 이 이하는 원본 alpha 유지, 사이면 보간

  for (let i = 0; i < buf.length; i += channels) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    let a = buf[i + 3];

    const minRGB = Math.min(r, g, b);

    if (minRGB >= THRESHOLD_FULL) {
      a = 0;
    } else if (minRGB > THRESHOLD_SOFT) {
      // 부드러운 전환: anti-aliased edge 유지, halo 방지
      const t = (minRGB - THRESHOLD_SOFT) / (THRESHOLD_FULL - THRESHOLD_SOFT);
      a = Math.round(a * (1 - t));
    }
    // else: 로고 영역 — RGB·alpha 그대로 유지

    buf[i + 3] = a;
  }

  await sharp(Buffer.from(buf), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(OUTPUT);

  console.log("Written:", OUTPUT, `(${width}x${height} RGBA)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
