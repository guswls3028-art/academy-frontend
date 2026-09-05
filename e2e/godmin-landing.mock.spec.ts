import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";

const BASE = (
  process.env.E2E_LANDING_BASE_URL
  || process.env.E2E_LOCAL_BASE_URL
  || "http://127.0.0.1:5174"
).replace(/\/+$/, "");

async function prepareGodmin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("tenant_code", "godmin");
    sessionStorage.setItem("tenantCode", "godmin");
  });
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "godmin",
        display_name: "신과함께",
        ui_config: { login_title: "신과함께" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
}

test.describe("godmin public landing", () => {
  test.beforeEach(async ({ page }) => {
    await prepareGodmin(page);
  });

  test("renders the dedicated desktop home without depending on a published landing config", async ({ page }, testInfo) => {
    let genericLandingRequests = 0;
    await page.route("**/api/v1/core/landing/public/**", async (route) => {
      genericLandingRequests += 1;
      await route.abort("blockedbyclient");
    });
    await page.setViewportSize({ width: 1366, height: 900 });

    await page.goto(`${BASE}/landing`, { waitUntil: "commit", timeout: 45_000 });

    await expect(page.getByRole("heading", { name: "복잡한 과학을, 이해되는 구조로." })).toBeVisible({ timeout: 90_000 });
    await expect(page).toHaveTitle("신민T 통합과학 | 신과함께");
    await expect(page.getByAltText("통합과학 강사 신민 선생님")).toBeVisible();
    await expect(page.getByRole("link", { name: "수강생·학부모 로그인" })).toHaveAttribute("href", "/login/godmin");
    await expect(page.getByText("대성마이맥 통합과학", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "네 영역을 잇는 하나의 과학 지도" })).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /13년 차 통합과학 강사/);
    expect(genericLandingRequests).toBe(0);
    expect(await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    )).toBeLessThanOrEqual(1);

    const screenshotPath = testInfo.outputPath("godmin-landing-1366.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach("godmin-landing-1366.png", { path: screenshotPath, contentType: "image/png" });
  });

  test("keeps the 390px home readable, actionable, and free of horizontal overflow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`${BASE}/landing`, { waitUntil: "commit", timeout: 45_000 });

    await expect(page.getByRole("heading", { name: "복잡한 과학을, 이해되는 구조로." })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("navigation", { name: "홈페이지 주요 메뉴" })).toBeHidden();
    const login = page.getByRole("link", { name: "수강생·학부모 로그인" });
    await expect(login).toBeVisible();
    const loginBox = await login.boundingBox();
    expect(loginBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    )).toBeLessThanOrEqual(1);

    const screenshotPath = testInfo.outputPath("godmin-landing-390.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach("godmin-landing-390.png", { path: screenshotPath, contentType: "image/png" });
  });

  test("routes an unauthenticated godmin root visit to the public home and respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto(`${BASE}/`, { waitUntil: "commit", timeout: 45_000 });

    await expect(page.getByRole("heading", { name: "복잡한 과학을, 이해되는 구조로." })).toBeVisible({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/landing$/);
    const portraitMotion = await page.getByAltText("통합과학 강사 신민 선생님").evaluate((element) => {
      const frame = element.parentElement;
      const style = frame ? getComputedStyle(frame) : null;
      return { duration: style?.animationDuration, iterations: style?.animationIterationCount };
    });
    expect(Number.parseFloat(portraitMotion.duration ?? "1")).toBeLessThanOrEqual(0.00001);
    expect(portraitMotion.iterations).toBe("1");
  });
});
