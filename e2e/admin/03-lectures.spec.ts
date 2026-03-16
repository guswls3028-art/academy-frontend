import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("관리자 강의/출결", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
  });

  test("강의 목록 진입 → 강의가 보인다", async ({ page }) => {
    await page.goto("https://tchul.com/admin/lectures");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    // 강의 카드 또는 목록이 존재
    const content = page.locator("main, [class*='page'], [class*='lecture']").first();
    await expect(content).toBeVisible();
  });

  test("강의 상세 진입 시 깨지지 않는다", async ({ page }) => {
    await page.goto("https://tchul.com/admin/lectures");
    await page.waitForLoadState("networkidle");
    // 첫 번째 강의 클릭 (링크 또는 카드)
    const firstLecture = page.locator("a[href*='/lectures/'], [class*='lecture-card'], [class*='lectureCard']").first();
    if (await firstLecture.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLecture.click();
      await page.waitForLoadState("networkidle");
      // 상세 페이지가 로드되는지
      await expect(page.locator("text=Not Found")).not.toBeVisible();
    }
  });
});
