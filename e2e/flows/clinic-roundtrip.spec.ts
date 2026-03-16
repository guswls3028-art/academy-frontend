/**
 * 클리닉 왕복 플로우 E2E
 * 선생 세션 생성(API) → 학생 클리닉 화면 확인 → 선생 클리닉 화면 확인 → 정리
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();

test.describe.serial("클리닉 왕복: 선생→학생→선생", () => {
  let browser: Browser;
  let adminPage: Page;
  let studentPage: Page;
  let sessionId: number | null = null;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 선생이 클리닉 세션을 생성한다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    await adminPage.goto(`${BASE}/admin/clinic/home`);
    await adminPage.waitForLoadState("load");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const resp = await apiCall(adminPage, "POST", "/clinic/sessions/", {
      date: dateStr, start_time: "14:00", duration_minutes: 60,
      location: `E2E_${TS}`, max_participants: 5, title: `[E2E]클리닉_${TS}`,
    });
    expect(resp.status).toBe(201);
    sessionId = resp.body.id;
  });

  test("2. 학생 클리닉 화면에서 에러 없이 로드된다", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
    await loginViaUI(studentPage, "student");

    await studentPage.goto(`${BASE}/student/clinic`);
    await studentPage.waitForLoadState("load");
    await expect(studentPage.locator("text=Not Found")).not.toBeVisible();
    await expect(studentPage.locator("[data-app='student']").first()).toBeVisible();
  });

  test("3. 선생 클리닉 홈이 정상 로드된다", async () => {
    await adminPage.goto(`${BASE}/admin/clinic/home`);
    await adminPage.waitForLoadState("load");
    await expect(adminPage.locator("text=Not Found")).not.toBeVisible();
  });

  test.afterAll(async () => {
    if (sessionId && adminPage) {
      try { await apiCall(adminPage, "DELETE", `/clinic/sessions/${sessionId}/`); } catch {}
    }
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
