/**
 * 학생 도메인 사용자 이상행동 guardrail.
 *
 * 보호 라우트/로그아웃 뒤로가기/모바일 폭 overflow를 launch gate로 고정한다.
 */
import { test, expect } from "../fixtures/strictTest";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const API = getApiBaseUrl().replace(/\/+$/, "");
const CODE = "hakwonplus";
const STUDENT_USER = requiredEnv("E2E_STUDENT_USER");
const STUDENT_PASS = requiredEnv("E2E_STUDENT_PASS");

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing required env ${name}. See .env.e2e.example.`);
}

async function clearBrowserAuth(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("parent_selected_student_id");
    sessionStorage.removeItem("tenantCode");
    sessionStorage.removeItem("session_expired");
  });
  await page.evaluate(() => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("parent_selected_student_id");
    sessionStorage.removeItem("tenantCode");
    sessionStorage.removeItem("session_expired");
  }).catch(() => undefined);
}

async function expectAuthEntry(page: import("@playwright/test").Page): Promise<void> {
  await waitForCondition(
    async () => {
      const loginFormVisible = await page.getByRole("textbox", { name: "아이디" }).isVisible().catch(() => false);
      return loginFormVisible && !page.url().includes("/student");
    },
    { timeoutMs: 20_000, intervalMs: 500, description: "redirect to auth entry" },
  );
  expect(page.url()).not.toContain("/student");
  await expect(page.getByRole("textbox", { name: "아이디" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("textbox", { name: "비밀번호" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible({ timeout: 10_000 });
}

async function loginStudentOnce(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  landingPath: string,
): Promise<void> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username: STUDENT_USER, password: STUDENT_PASS, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${BASE}/login`, { waitUntil: "commit", timeout: 45_000 });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: CODE });
  await gotoAndSettle(page, `${BASE}${landingPath}`, { timeout: 45_000 });
}

test.describe("[E2E] 학생 도메인 guardrail", () => {
  test("비로그인/가짜 토큰으로 학생 보호 라우트에 접근하면 로그인으로 돌려보낸다", async ({ page }) => {
    await clearBrowserAuth(page);
    await gotoAndSettle(page, `${BASE}/student/grades`, { timeout: 25_000 });
    await expectAuthEntry(page);

    await page.addInitScript(() => {
      localStorage.setItem("access", "not-a-real-token");
      localStorage.setItem("refresh", "not-a-real-refresh");
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    });
    await page.evaluate(() => {
      localStorage.setItem("access", "not-a-real-token");
      localStorage.setItem("refresh", "not-a-real-refresh");
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    });
    await gotoAndSettle(page, `${BASE}/student/clinic`, { timeout: 25_000 });
    await expectAuthEntry(page);
  });

  test("학생 로그아웃 후 뒤로가기를 눌러도 이전 학생 화면이 복원되지 않는다", async ({ page, request }) => {
    await loginStudentOnce(page, request, "/student/grades");
    await expect(page).toHaveURL(/\/student\/grades/);
    await expect(page.getByText("성적").first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const drawer = page.getByRole("dialog", { name: "메뉴" });
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await drawer.getByRole("button", { name: "로그아웃" }).click();
    const confirm = page.locator(".stu-logout-dialog__box");
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await page.locator(".stu-logout-dialog__confirm").click();

    await waitForCondition(
      async () => {
        const auth = await page.evaluate(() => ({
          access: localStorage.getItem("access"),
          refresh: localStorage.getItem("refresh"),
        }));
        return auth.access == null && auth.refresh == null;
      },
      { timeoutMs: 15_000, intervalMs: 500, description: "logout clears browser auth" },
    );

    await page.goBack({ waitUntil: "load", timeout: 20_000 }).catch(() => undefined);
    await expectAuthEntry(page);
    expect(page.url()).not.toContain("/student/grades");
  });

  test("모바일 폭에서 핵심 학생 화면이 가로로 터지지 않는다", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaUI(page, "student", { landingPath: "/student/dashboard" });

    const routes = [
      "/student/dashboard",
      "/student/grades",
      "/student/exams",
      "/student/clinic",
      "/student/submit",
      "/student/notifications",
    ];

    for (const route of routes) {
      await gotoAndSettle(page, `${BASE}${route}`, { timeout: 25_000 });
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        Math.max(metrics.scrollWidth, metrics.bodyScrollWidth),
        `${route} mobile horizontal overflow`,
      ).toBeLessThanOrEqual(metrics.innerWidth + 2);
    }

    await context.clearCookies();
  });
});
