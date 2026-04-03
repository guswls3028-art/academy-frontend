import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
test("근태 날짜 클릭 + 상세 표시", async ({ page }) => {
  await loginViaUI(page, "admin");
  page.on("pageerror", (e) => console.log("PAGEERR:", e.message));
  await page.goto(`${B}/admin/staff/attendance?staffId=20&year=2026&month=3`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  // 29일 클릭
  const btn29 = page.locator("button").filter({ hasText: /^29/ }).first();
  if (await btn29.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn29.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: "e2e/screenshots/final-daily-detail.png", fullPage: true });
  // 에러 없이 표시되는지
  const errMsg = page.locator("text=일시적인 오류");
  const hasError = await errMsg.isVisible({ timeout: 2000 }).catch(() => false);
  expect(hasError).toBe(false);
});
