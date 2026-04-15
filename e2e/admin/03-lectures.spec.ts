import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("관리자 강의/출결", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("강의 목록 진입", async ({ page }) => {
    await page.goto(`${BASE}/admin/lectures`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await expect(page.locator("main, [class*='page']").first()).toBeVisible();
  });

  test("강의 상세 진입", async ({ page }) => {
    await page.goto(`${BASE}/admin/lectures`);
    await page.waitForLoadState("networkidle");
    const firstLecture = page.locator("a[href*='/lectures/']").first();
    if (await firstLecture.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLecture.click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("text=Not Found")).not.toBeVisible();
    }
  });
});
