/**
 * 선생앱 전 페이지 스크린샷 촬영 — UIUX 대조용
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import type { Page } from "@playwright/test";

const BASE = getBaseUrl("admin");

async function waitForTeacherPageReady(page: Page) {
  await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

test.describe("선생앱 전체 스크린샷", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => localStorage.removeItem("teacher:preferAdmin"));
  });

  const pages = [
    { name: "01-dashboard", path: "/workspace/mobile" },
    { name: "02-students", path: "/workspace/mobile/students" },
    { name: "03-classes", path: "/workspace/mobile/classes" },
    { name: "04-comms", path: "/workspace/mobile/comms" },
    { name: "05-exams", path: "/workspace/mobile/exams" },
    { name: "06-videos", path: "/workspace/mobile/videos" },
    { name: "07-clinic", path: "/workspace/mobile/clinic" },
    { name: "08-counseling", path: "/workspace/mobile/counseling" },
    { name: "09-results", path: "/workspace/mobile/results" },
    { name: "10-notifications", path: "/workspace/mobile/notifications" },
    { name: "11-profile", path: "/workspace/mobile/profile" },
  ];

  for (const p of pages) {
    test(`${p.name}`, async ({ page }) => {
      await page.goto(`${BASE}${p.path}`, { waitUntil: "load", timeout: 20_000 });
      await waitForTeacherPageReady(page);
      await page.screenshot({ path: `e2e/screenshots/audit-teacher-${p.name}.png`, fullPage: true });
    });
  }

  test("12-drawer", async ({ page }) => {
    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "load", timeout: 20_000 });
    await waitForTeacherPageReady(page);
    await page.getByRole("button", { name: "메뉴" }).click();
    await expect(page.getByRole("button", { name: "설정", exact: true })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e/screenshots/audit-teacher-12-drawer.png", fullPage: false });
  });
});
