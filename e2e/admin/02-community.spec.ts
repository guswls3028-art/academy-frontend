import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("관리자 커뮤니티", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
  });

  test("공지 목록 진입 → 항목이 보인다", async ({ page }) => {
    await page.goto("https://tchul.com/admin/community/notice");
    await page.waitForLoadState("networkidle");
    // 공지 페이지 헤더 또는 컨텐츠가 보이는지
    const content = page.locator('[class*="notice"], [class*="community"], main, [class*="page"]').first();
    await expect(content).toBeVisible();
    // 404 아닌지
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });

  test("QnA 탭 진입 → 깨지지 않는다", async ({ page }) => {
    await page.goto("https://tchul.com/admin/community/qna");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    // QnA 관련 UI 존재
    const qnaContent = page.locator("main, [class*='page'], [class*='inbox'], [class*='qna']").first();
    await expect(qnaContent).toBeVisible();
  });

  test("상담 탭 진입 → 깨지지 않는다", async ({ page }) => {
    await page.goto("https://tchul.com/admin/community/counsel");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });
});
