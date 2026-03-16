import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("관리자 커뮤니티", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("공지 목록 진입", async ({ page }) => {
    await page.goto(`${BASE}/admin/community/notice`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main, [class*='page']").first()).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });

  test("QnA 탭 진입", async ({ page }) => {
    await page.goto(`${BASE}/admin/community/qna`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await expect(page.locator("main, [class*='page']").first()).toBeVisible();
  });

  test("상담 탭 진입", async ({ page }) => {
    await page.goto(`${BASE}/admin/community/counsel`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });
});
