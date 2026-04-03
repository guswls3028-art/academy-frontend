import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
test("근태 KPI 리디자인 확인", async ({ page }) => {
  await loginViaUI(page, "admin");
  // 3월 데이터 있는 직원으로 접근
  await page.goto(`${B}/admin/staff/attendance?staffId=20&year=2026&month=3`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e/screenshots/kpi-attendance-final.png", fullPage: true });
  // 날짜 클릭 (3/31)
  const cell31 = page.locator("button").filter({ hasText: "31" }).first();
  if (await cell31.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cell31.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: "e2e/screenshots/kpi-daily-detail.png", fullPage: true });
});
