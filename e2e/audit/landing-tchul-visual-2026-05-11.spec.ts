// tchul.com 운영 랜딩 페이지 시각 검수 — premium_dark + hit_reports 카드 + 권한 분기.
// 외부 관전자 기준 (비로그인): 카드 노출 / floating fab 미노출 / "수정" 칩 미노출.
import { test } from "@playwright/test";

const PROD_BASE = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("tchul.com 외부 관전자 시각 검수", () => {
  test("desktop 1920 — root 진입 + 전체 fullPage 캡처", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${PROD_BASE}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/desktop-1920-full.png`, fullPage: true });
    await page.screenshot({ path: `${OUT}/desktop-1920-viewport.png`, fullPage: false });

    // floating fab은 비로그인 시 미노출
    const editFabCount = await page.getByText("홈페이지 꾸미기").count();
    const consoleFabCount = await page.getByText("관리실로").count();
    // hit_reports 카드 적중률 텍스트 노출 확인 (78/79/72)
    const rates = await page.locator("text=/적중률/").count();
    console.log(JSON.stringify({ editFab: editFabCount, consoleFab: consoleFabCount, rateBlocks: rates }));

    await ctx.close();
  });

  test("mobile 390 — fullPage 캡처", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${PROD_BASE}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/mobile-390-full.png`, fullPage: true });
    await page.screenshot({ path: `${OUT}/mobile-390-viewport.png`, fullPage: false });

    await ctx.close();
  });

  test("login 화면 모바일 + 데스크탑", async ({ browser }) => {
    for (const viewport of [{ name: "desktop-1920", w: 1920, h: 1080 }, { name: "mobile-390", w: 390, h: 844 }]) {
      const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, deviceScaleFactor: viewport.w < 500 ? 2 : 1 });
      const page = await ctx.newPage();
      await page.goto(`${PROD_BASE}/login`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/login-${viewport.name}.png`, fullPage: false });
      await ctx.close();
    }
  });
});
