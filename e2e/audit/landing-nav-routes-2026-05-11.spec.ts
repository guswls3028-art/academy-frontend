// nav 메뉴 + 모바일 햄버거 + 적중보고서 상세 라우트 + 테넌트 로고 fallback 검증.
import { test, expect } from "@playwright/test";
import { gotoAndSettle } from "../helpers/wait";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("nav + 라우트 + 로고 fallback 검증", () => {
  test("데스크탑 1920 — nav 메뉴 + 로고 fallback", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await gotoAndSettle(page, `${PROD}/landing`, { timeout: 20_000 });
    await expect(page.locator("nav").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("nav button").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/v5-nav-desktop.png`, clip: { x: 0, y: 0, width: 1920, height: 200 } });

    const menuItems = await page.evaluate(() => Array.from(document.querySelectorAll("nav button")).map((b) => b.textContent?.trim()).filter(Boolean));
    console.log("NAV_MENU:", JSON.stringify(menuItems));
    expect(menuItems.length).toBeGreaterThanOrEqual(3);

    // 로고 fallback — img src가 /tenants/tchul/logo.png 또는 BrandMark
    const logoImg = await page.locator('nav img').count();
    console.log("LOGO_IMG_COUNT:", logoImg);

    await ctx.close();
  });

  test("모바일 390 — 햄버거 + 슬라이드 패널", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await gotoAndSettle(page, `${PROD}/landing`, { timeout: 20_000 });
    await expect(page.locator("nav").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/v5-mobile-nav-closed.png`, clip: { x: 0, y: 0, width: 390, height: 200 } });

    // 햄버거 버튼 → 슬라이드 패널
    const burger = page.getByRole("button", { name: "메뉴 열기" });
    await expect(burger).toBeVisible({ timeout: 10_000 });
    await burger.click();
    await expect(page.getByRole("button", { name: /강사 소개|수업 특징|적중 사례/ }).first()).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: `${OUT}/v5-mobile-nav-open.png`, fullPage: false });

    const slideItems = await page.evaluate(() => Array.from(document.querySelectorAll("button")).map((b) => b.textContent?.trim()).filter((t) => t && ["강사 소개", "수업 특징", "학생 관리", "수업 흐름", "적중 사례", "프로그램", "자주 묻는 질문", "문의"].includes(t || "")));
    console.log("SLIDE_ITEMS:", JSON.stringify(slideItems));
    expect(slideItems.length).toBeGreaterThanOrEqual(3);
    await ctx.close();
  });

  test("적중보고서 상세 라우트 — /landing/reports/25 (숙명여고)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await gotoAndSettle(page, `${PROD}/landing/reports/25`, { timeout: 20_000 });
    await expect(page.getByText("박철 과학").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("iframe").first()).toBeAttached({ timeout: 10_000 });
    await page.waitForFunction(
      () => {
        const iframe = document.querySelector("iframe") as HTMLIFrameElement | null;
        return !!iframe && iframe.clientWidth > 0 && iframe.clientHeight > 0 && iframe.src.length > 0;
      },
      null,
      { timeout: 10_000 },
    );
    await page.screenshot({ path: `${OUT}/v5-report-detail.png`, fullPage: false });

    // 학원 헤더(브랜드명)
    const brandHeader = await page.getByText("박철 과학").first().count();
    // KPI
    const ratePct = await page.getByText("적중률").count();
    // PDF iframe 존재
    const iframe = await page.locator("iframe").count();
    console.log("REPORT_DETAIL:", JSON.stringify({ brandHeader, ratePct, iframe }));
    expect(brandHeader).toBeGreaterThanOrEqual(1);
    expect(iframe).toBeGreaterThanOrEqual(1);

    // 다른 적중 사례 — 2개 카드
    const others = await page.getByText("다른 적중 사례").count();
    console.log("OTHER_HEADING:", others);

    await ctx.close();
  });

  test("랜딩 카드 클릭 → 라우트 네비게이트 (새 탭 X)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await gotoAndSettle(page, `${PROD}/landing`, { timeout: 20_000 });

    // 적중 카드 첫번째 Link 클릭
    const firstCard = page.locator('a[href*="/landing/reports/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForURL(/\/landing\/reports\/.+/, { timeout: 15_000 }),
      firstCard.click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const url = page.url();
    console.log("AFTER_CLICK_URL:", url);
    expect(url).toContain("/landing/reports/");
    await ctx.close();
  });
});
