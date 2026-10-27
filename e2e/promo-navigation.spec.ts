import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

async function stubPromoBootstrap(page: Page) {
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
}

async function expectHashAligned(page: Page, id: string) {
  await expect.poll(async () => page.evaluate((targetId) => {
    const target = document.getElementById(targetId);
    const header = document.querySelector("[data-promo-header]");
    if (!target || !header) return false;
    const top = target.getBoundingClientRect().top;
    const headerBottom = header.getBoundingClientRect().bottom;
    return top >= headerBottom && top <= headerBottom + 40;
  }, id)).toBe(true);
}

test.describe("promo navigation", () => {
  test.beforeEach(async ({ page }) => {
    await stubPromoBootstrap(page);
  });

  test("aligns cross-page hash links below the fixed promo header", async ({ page }) => {
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });
    await page.locator('a[data-workflow-card="students"]').click();
    await expect(page).toHaveURL(/\/promo\/features#class-management$/);
    await expectHashAligned(page, "class-management");

    await page.goto(`${BASE}/promo/ai-grading`, { waitUntil: "load" });
    await page.getByRole("link", { name: "결과 안내 보기" }).click();
    await expect(page).toHaveURL(/\/promo\/features#communication$/);
    await expectHashAligned(page, "communication");
  });

  test("resets scroll on page navigation and closes mobile sidebar after route changes", async ({ page }) => {
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1400);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

    const pricingLink = page.locator('header nav[aria-label="프로모션 메뉴"] a[href="/promo/pricing"]');
    await expect(pricingLink).toHaveCount(1);
    await pricingLink.click();
    await expect(page).toHaveURL(/\/promo\/pricing$/);
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });

    const menuButton = page.locator('button[aria-controls="promo-mobile-sidebar"]');
    await menuButton.click();
    const sidebarFeaturesLink = page.locator('#promo-mobile-sidebar a[href="/promo/features"]');
    await expect(sidebarFeaturesLink).toHaveCount(1);
    await sidebarFeaturesLink.click();
    await expect(page).toHaveURL(/\/promo\/features$/);
    await expect(
      page.getByRole("heading", { name: "기능 소개" }),
    ).toBeVisible();

    await page.goto(`${BASE}/promo`, { waitUntil: "load" });
    await expect(menuButton).toHaveCount(1);
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    const sidebarPricingLink = page.locator('#promo-mobile-sidebar a[href="/promo/pricing"]');
    await expect(sidebarPricingLink).toHaveCount(1);
    await sidebarPricingLink.click();
    await expect(page).toHaveURL(/\/promo\/pricing$/);
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  for (const width of [390, 1100, 1366]) {
    test("opens the detailed guide and Instagram at " + width + "px", async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(BASE + "/promo", { waitUntil: "load" });
      const instagram = page.locator('header a[aria-label="인스타그램 @hakwon_p (새 창)"]');
      await expect(instagram).toBeVisible();
      await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/hakwon_p/");
      await expect(instagram).toHaveAttribute("target", "_blank");
      await expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
      // Keep this public navigation check offline and avoid depending on Instagram login.
      await page.context().route("https://www.instagram.com/hakwon_p/", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>학원플러스 Instagram</title>" }));
      const popupPromise = page.waitForEvent("popup");
      await instagram.click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL("https://www.instagram.com/hakwon_p/");
      await popup.close();
      await expect(page.getByRole("heading", { name: /수업 관리부터\s*학생의 복습까지/ })).toBeVisible();
      const screenshotPath = info.outputPath("promo-home-" + width + ".png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await info.attach("promo-home-" + width, { path: screenshotPath, contentType: "image/png" });
      await page.getByRole("link", { name: "43쪽 상세 가이드 보기" }).click();
      await expect(page.getByRole("heading", { name: "기능 상세 가이드", exact: true })).toBeVisible();
      const reader = page.getByRole("region", { name: "기능 둘러보기", exact: true });
      await expect(reader.getByRole("button", { name: "상세 설명 43쪽", exact: true })).toHaveAttribute("aria-pressed", "true");
      await reader.getByRole("button", { name: "엑셀 업로드", exact: true }).click();
      await expect(reader.getByLabel("설명서 페이지")).toHaveValue("16");
      await page.reload();
      await expect(reader.getByLabel("설명서 페이지")).toHaveValue("16");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
});
