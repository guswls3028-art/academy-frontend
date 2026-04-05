import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("관리자 로그인 → 대시보드", () => {
  test("관리자가 로그인하면 관리 화면이 표시된다", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");
    // superuser는 /dev, 일반 admin은 /admin으로 갈 수 있음
    expect(page.url()).toMatch(/\/(admin|dev)/);
    // admin으로 명시적 이동
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);
    await expect(page.locator("nav, [class*='sidebar'], [class*='header']").first()).toBeVisible();
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });
});
