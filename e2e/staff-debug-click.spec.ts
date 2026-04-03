import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
test("날짜 클릭 에러 디버그", async ({ page }) => {
  await loginViaUI(page, "admin");
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(`${B}/admin/staff/attendance?staffId=20&year=2026&month=3`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  // 캘린더에서 29일 클릭 (근무기록 있는 날)
  const cell = page.locator(".staff-calendar__cell").filter({ hasText: "29" }).first();
  if (await cell.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cell.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: "e2e/screenshots/debug-click-29.png", fullPage: true });
});
