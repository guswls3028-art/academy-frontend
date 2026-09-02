/**
 * Persistent-development attendance projection canary.
 *
 * The caller seeds one exact attendance row through the normal staff UI, then
 * this spec proves that the student API and both desktop/mobile student UI
 * consume the same persisted status after reload. It is read-only apart from
 * acknowledging the disposable account's first-login guide.
 */
import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { acknowledgeFirstLoginGuideIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

const ENABLED = process.env.E2E_ATTENDANCE_PROJECTION_REALUSE === "1";
const BASE = (process.env.E2E_BASE_URL || "").replace(/\/+$/, "");
const API = (process.env.E2E_API_URL || "").replace(/\/+$/, "");
const CODE = (process.env.E2E_ATTENDANCE_TENANT_CODE || "").trim().toLowerCase();
const PASSWORD = process.env.E2E_ATTENDANCE_PASSWORD || "";
const STUDENT_USER = process.env.E2E_ATTENDANCE_STUDENT || "ymath-qa-student-01";
const ADMIN_USER = process.env.E2E_ATTENDANCE_ADMIN || "ymath-qa-teacher";
const EXPECTED_LECTURE = process.env.E2E_ATTENDANCE_LECTURE || "공통수학2 정규반";
const EXPECTED_STATUS = process.env.E2E_ATTENDANCE_STATUS || "PRESENT";
const EXPECTED_STATUS_LABEL = process.env.E2E_ATTENDANCE_STATUS_LABEL || "출석";

type Tokens = { access: string; refresh: string };
type AttendanceSummary = {
  summary: { total: number; present: number };
  recent: Array<{
    session_id: number;
    lecture_title: string;
    session_title: string;
    status: string;
  }>;
};

function isLoopback(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function assertIsolatedRuntime(): void {
  expect(isLoopback(BASE), "attendance frontend must be loopback-only").toBe(true);
  expect(isLoopback(API), "attendance API must be loopback-only").toBe(true);
  expect(CODE).toMatch(/^qa-ymath-realuse-[a-z0-9-]+$/);
  expect(PASSWORD, "E2E_ATTENDANCE_PASSWORD is required").not.toBe("");
}

async function login(request: APIRequestContext, username: string): Promise<Tokens> {
  const response = await request.post(`${API}/api/v1/token/`, {
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    data: { username, password: PASSWORD, tenant_code: CODE },
    timeout: 60_000,
  });
  expect(response.status(), `login ${username}`).toBe(200);
  return await response.json() as Tokens;
}

async function seedBrowser(page: Page, tokens: Tokens): Promise<void> {
  await page.addInitScript(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: CODE });
}

async function assertAttendanceSurface(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "출결 현황" })).toBeVisible();
  const attendanceLink = page.getByRole("link").filter({ hasText: EXPECTED_LECTURE }).first();
  await expect(attendanceLink).toBeVisible();
  await expect(attendanceLink).toContainText(EXPECTED_STATUS_LABEL);
  expect(await page.locator("body").evaluate((element) => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
}

test.describe.serial("[real-use] 학생 출결 projection", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!ENABLED, "Set E2E_ATTENDANCE_PROJECTION_REALUSE=1 for isolated development QA.");

  test.beforeAll(() => {
    assertIsolatedRuntime();
  });

  test("관리자 출결 저장이 학생 API와 1366/390 UI, 새로고침, 차시 상세에 이어진다", async ({ page, request }) => {
    const student = await login(request, STUDENT_USER);
    const admin = await login(request, ADMIN_USER);
    const headers = { Authorization: `Bearer ${student.access}`, "X-Tenant-Code": CODE };

    const summaryResponse = await request.get(`${API}/api/v1/student/attendance/summary/`, {
      headers,
      timeout: 60_000,
    });
    expect(summaryResponse.status()).toBe(200);
    const summary = await summaryResponse.json() as AttendanceSummary;
    const expectedRow = summary.recent.find((row) => (
      row.lecture_title === EXPECTED_LECTURE && row.status === EXPECTED_STATUS
    ));
    expect(expectedRow, "student attendance API should expose the persisted status").toBeTruthy();
    expect(summary.summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.summary.present).toBeGreaterThanOrEqual(1);

    const logResponse = await request.get(`${API}/api/v1/messaging/log/?page=1&page_size=1`, {
      headers: { Authorization: `Bearer ${admin.access}`, "X-Tenant-Code": CODE },
      timeout: 60_000,
    });
    expect(logResponse.status()).toBe(200);
    expect((await logResponse.json() as { count: number }).count).toBe(0);

    await seedBrowser(page, student);
    const strict = attachStrictBrowserGuards(page);
    for (const viewport of [
      { width: 1366, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoAndSettle(page, `${BASE}/student/attendance`, { timeout: 30_000 });
      await acknowledgeFirstLoginGuideIfVisible(page);
      await waitForRenderSettled(page, { timeout: 20_000 });
      await assertAttendanceSurface(page);

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForRenderSettled(page, { timeout: 20_000 });
      await assertAttendanceSurface(page);
    }

    const attendanceLink = page.getByRole("link").filter({ hasText: EXPECTED_LECTURE }).first();
    await attendanceLink.click();
    await expect(page).toHaveURL(new RegExp(`/student/sessions/${expectedRow!.session_id}(?:[/?#]|$)`));
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.getByText(expectedRow!.session_title, { exact: true }).first()).toBeVisible();
    strict.assertZeroDefects();
  });
});
