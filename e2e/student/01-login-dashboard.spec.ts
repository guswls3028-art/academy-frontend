import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("학생 로그인 → 대시보드", () => {
  test("tchul 학생이 로그인하면 학생 대시보드가 표시된다", async ({ page }) => {
    await loginViaUI(page, "tchul-student");
    expect(page.url()).toContain("/student");
    // 학생 앱 탭바가 보이는지
    await expect(page.locator("[class*='tabbar'], [class*='tab-bar'], nav").first()).toBeVisible();
    // 404나 에러가 아닌지
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });
});
