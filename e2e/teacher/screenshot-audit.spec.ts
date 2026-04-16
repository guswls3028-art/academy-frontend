/**
 * 선생앱 전 페이지 스크린샷 촬영 — UIUX 대조용
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

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
    { name: "01-dashboard", path: "/teacher" },
    { name: "02-students", path: "/teacher/students" },
    { name: "03-classes", path: "/teacher/classes" },
    { name: "04-comms", path: "/teacher/comms" },
    { name: "05-exams", path: "/teacher/exams" },
    { name: "06-videos", path: "/teacher/videos" },
    { name: "07-clinic", path: "/teacher/clinic" },
    { name: "08-counseling", path: "/teacher/counseling" },
    { name: "09-results", path: "/teacher/results" },
    { name: "10-notifications", path: "/teacher/notifications" },
    { name: "11-profile", path: "/teacher/profile" },
  ];

  for (const p of pages) {
    test(`${p.name}`, async ({ page }) => {
      await page.goto(`${BASE}${p.path}`, { waitUntil: "load", timeout: 20_000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `e2e/screenshots/audit-teacher-${p.name}.png`, fullPage: true });
    });
  }

  test("12-drawer", async ({ page }) => {
    await page.goto(`${BASE}/teacher`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "메뉴" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/audit-teacher-12-drawer.png", fullPage: false });
  });
});
