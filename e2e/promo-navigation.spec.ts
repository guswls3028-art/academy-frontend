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
    await page.goto(`${BASE}/promo/faq`, { waitUntil: "load" });
    await page.getByRole("link", { name: "학생앱 영상 화면 보기" }).click();
    await expect(page).toHaveURL(/\/promo\/features#student-video$/);
    await expectHashAligned(page, "student-video");

    await page.goto(`${BASE}/promo/ai-grading`, { waitUntil: "load" });
    await page.getByRole("link", { name: "결과 안내 보기" }).click();
    await expect(page).toHaveURL(/\/promo\/features#alimtalk$/);
    await expectHashAligned(page, "alimtalk");
  });

  test("resets scroll on page navigation and closes mobile sidebar after route changes", async ({ page }) => {
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(3000);
    await page.evaluate(() => window.scrollTo(0, 4000));
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

    const pricingLink = page.locator('header nav[aria-label="프로모션 메뉴"] a[href="/promo/pricing"]');
    await expect(pricingLink).toHaveCount(1);
    await pricingLink.click();
    await expect(page).toHaveURL(/\/promo\/pricing$/);
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });

    const quickVideoLink = page.locator('header nav[aria-label="프로모션 빠른 메뉴"] a[href="/promo/video-platform"]');
    await expect(quickVideoLink).toHaveCount(1);
    await quickVideoLink.click();
    await expect(page).toHaveURL(/\/promo\/video-platform$/);
    await expect(page.getByRole("heading", { name: "수강생이 학생전용앱에서 이어서 보는 영상 학습" })).toBeVisible();

    await page.goto(`${BASE}/promo`, { waitUntil: "load" });
    const menuButton = page.locator('button[aria-controls="promo-mobile-sidebar"]');
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
});
