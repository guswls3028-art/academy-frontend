// 다크 버전 박철 과학 로고 배경 노이즈 시각 검증.
import { test } from "@playwright/test";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test("다크 nav 로고 영역 close-up — 회색 노이즈 검수", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // nav 좌측(로고 + 브랜드명) close-up
  await page.screenshot({ path: `${OUT}/v9-logo-darknav-closeup.png`, clip: { x: 280, y: 0, width: 600, height: 100 } });

  // 로고 element 자체 close-up
  const logo = page.locator('nav img').first();
  const box = await logo.boundingBox();
  if (box) {
    await page.screenshot({
      path: `${OUT}/v9-logo-element-only.png`,
      clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16 },
    });
    console.log("LOGO_BOX:", JSON.stringify(box));
  }

  // 로고 src + computed style
  const info = await page.evaluate(() => {
    const img = document.querySelector('nav img') as HTMLImageElement | null;
    if (!img) return null;
    const cs = getComputedStyle(img);
    return {
      src: img.src, naturalW: img.naturalWidth, naturalH: img.naturalHeight,
      objectFit: cs.objectFit, filter: cs.filter, background: cs.backgroundColor,
      width: img.width, height: img.height,
    };
  });
  console.log("LOGO_INFO:", JSON.stringify(info));

  await ctx.close();
});
