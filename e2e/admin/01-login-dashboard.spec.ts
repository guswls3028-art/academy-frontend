import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("관리자 로그인 → 대시보드", () => {
  test("tchul 관리자가 로그인하면 대시보드가 표시된다", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    // 대시보드 URL 확인
    expect(page.url()).toContain("/admin");
    // 사이드바 또는 헤더에 메뉴가 보이는지
    await expect(page.locator("nav, [class*='sidebar'], [class*='header']").first()).toBeVisible();
    // 404나 에러 페이지가 아닌지
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    await expect(page.locator("text=오류")).not.toBeVisible();
  });
});
