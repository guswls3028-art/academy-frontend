import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";

test.describe("직원 상세 + 근태 검증", () => {
  test.beforeEach(async ({ page }) => { await loginViaUI(page, "admin"); });

  test("근태 탭 — 직원 선택 후 캘린더+근무기록", async ({ page }) => {
    await page.goto(`${B}/admin/staff/attendance`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 좌측 직원 목록에서 첫 번째 직원 클릭
    const staffItems = page.locator("button, a, div").filter({ hasText: /강사|조교|관리/ });
    const count = await staffItems.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const el = staffItems.nth(i);
      const text = await el.textContent().catch(() => "");
      if (text && (text.includes("강사") || text.includes("조교")) && text.length < 50) {
        await el.click();
        break;
      }
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/staff-attendance-detail.png", fullPage: true });
  });

  test("직원 상세 오버레이", async ({ page }) => {
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 직원 행 클릭 (이름 링크)
    const nameLink = page.locator("td, a").filter({ hasText: /유현진|테스트/ }).first();
    if (await nameLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/staff-detail-overlay.png", fullPage: true });
    } else {
      // 직접 직원 상세로 이동 시도
      await page.screenshot({ path: "e2e/screenshots/staff-home-noclick.png", fullPage: true });
    }
  });

  test("비용/경비 탭", async ({ page }) => {
    await page.goto(`${B}/admin/staff/expenses`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/staff-expenses.png", fullPage: true });
  });

  test("리포트 탭", async ({ page }) => {
    await page.goto(`${B}/admin/staff/reports`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/staff-reports.png", fullPage: true });
  });
});
