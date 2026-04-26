/**
 * 실패/엣지 케이스 처리 E2E
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");

test.describe("실패/엣지 케이스 처리", () => {

  test("a) 비로그인 상태에서 /admin 접근 시 크래시하지 않는다", async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    // SPA가 로그인 리다이렉트 또는 로그인 폼을 보여야 함 — 500/크래시가 아니어야
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
    // 페이지에 뭔가 보이는지 (완전 빈 화면 아닌지)
    const bodyText = await page.locator("body").textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test("b) 존재하지 않는 관리자 경로는 크래시 없이 처리된다", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/nonexistent-route-xyz`);
    await page.waitForLoadState("networkidle");
    // 크래시(React error boundary)가 아닌지
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
    // 페이지가 빈 화면이 아닌지 (SPA는 catch-all로 다른 페이지를 보여줄 수 있음)
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("c) 학생은 관리자 경로에 접근할 수 없다", async ({ page }) => {
    await loginViaUI(page, "student");
    await page.goto(`${BASE}/admin/students`);
    await page.waitForTimeout(3000);
    // 학생은 /student 영역으로 리다이렉트되거나 로그인으로 갈 것
    const url = page.url();
    const notInAdmin = !url.includes("/admin/students");
    expect(notInAdmin).toBe(true);
  });

  test("d) 존재하지 않는 리소스 API는 404를 반환한다", async ({ page }) => {
    await loginViaUI(page, "admin");
    const resp = await apiCall(page, "GET", "/community/posts/999999/");
    expect(resp.status).toBe(404);
  });

  test("e) 토큰 삭제 후 페이지 이동 시 크래시하지 않는다", async ({ page }) => {
    await loginViaUI(page, "admin");
    // 토큰 삭제
    await page.evaluate(() => {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    });
    // 페이지 이동 시도
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForTimeout(5000);
    // 크래시가 아닌지
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
    // 로그인 페이지 또는 어딘가로 갔는지 (빈 화면이 아닌지)
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
