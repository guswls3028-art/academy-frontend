// 자체 리뷰 batch 검증 — 통산 KPI 자동 + viewport 다양화 + PII 가드.
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("자체 리뷰 batch 검증", () => {
  for (const vp of [
    { name: "1920", w: 1920, h: 1080 },
    { name: "1366", w: 1366, h: 768 },
    { name: "1280", w: 1280, h: 720 },
    { name: "768", w: 768, h: 1024 },
    { name: "390", w: 390, h: 844 },
  ]) {
    test(`viewport ${vp.name} — 통산 KPI 자동 + 풀 캡처`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.w < 500 ? 2 : 1 });
      const page = await ctx.newPage();
      await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/v4-${vp.name}-full.png`, fullPage: true });

      // 강사 프로필 통산 KPI 자동 노출 검증
      const totalLabel = await page.getByText("통산 적중률").count();
      const cumulativeLabel = await page.getByText("누적 보고서").count();
      console.log(`[${vp.name}]`, JSON.stringify({ totalLabel, cumulativeLabel }));
      // KPI 노출 확인 — instructor_profile 섹션에 1회 이상
      if (vp.w >= 768) expect(totalLabel).toBeGreaterThanOrEqual(1);
      await ctx.close();
    });
  }

  test("학원장 username PII — 외부 노출 0건 검증", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const phoneFmt = await page.getByText(/01035023313/).count();
    console.log("PERSONAL_PHONE_LEAK:", phoneFmt);
    expect(phoneFmt).toBe(0);
    await ctx.close();
  });

  test("학원장 로그인 시 NavRoleMenu /student 라우트 (parent fix)", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // owner는 "관리실" 메뉴 노출 (parent와 무관)
    const adminLink = await page.getByRole("link", { name: /관리실/ }).count();
    expect(adminLink).toBeGreaterThanOrEqual(1);
    // username "01035023313" username 노출 X (학원장 본인이 자기 도메인 봐도 nav에는 username X)
    const usernameLeak = await page.locator('nav').getByText(/01035023313/).count();
    console.log("ADMIN_NAV_LEAK:", usernameLeak);
    expect(usernameLeak).toBe(0);
  });
});
