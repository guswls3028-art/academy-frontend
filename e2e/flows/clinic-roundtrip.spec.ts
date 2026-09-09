/**
 * 클리닉 왕복 플로우 E2E
 * 선생 세션 생성(API) → 학생/선생 화면 확인 → 달력 학생 배정/해제 → 정리
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import {
  api,
  expectApi,
  loginAdmin,
  loginApi,
} from "../helpers/qaStudentParentScenario";
import { probeDevelopmentCrossTenantDenial } from "../helpers/releaseApiBoundary";
import { productionWriteOptInSkipReason } from "../helpers/safety";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");
const PRODUCTION_WRITE_BLOCK = productionWriteOptInSkipReason(getApiBaseUrl());
const TS = Date.now();
const CROSS_TENANT = (process.env.E2E_CROSS_TENANT_CODE || "").trim();

type StudentRow = { id: number; name: string; ps_number: string };
type ParticipantRow = { id: number; session: number; student: number; status: string };
type ParticipantPage = { results?: ParticipantRow[] } | ParticipantRow[];

function participantRows(payload: ParticipantPage): ParticipantRow[] {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function calendarDateLabel(date: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${date}T12:00:00+09:00`));
}

async function openDateAggregateFromCalendar(page: Page, date: string) {
  await gotoAndSettle(page, `${BASE}/workspace/clinic/operations`, { timeout: 45_000 });
  const mobile = (page.viewportSize()?.width ?? 0) <= 640;
  if (mobile) {
    await page.locator(".clinic-console__schedule-trigger:visible").click();
    const scheduleOverlay = page.getByRole("dialog", { name: "날짜·수업 선택" });
    await expect(scheduleOverlay).toBeVisible();
    await scheduleOverlay.getByRole("gridcell", {
      name: new RegExp(calendarDateLabel(date)),
    }).click();
    await scheduleOverlay.getByRole("button", { name: "일정 닫기" }).click();
  } else {
    const desktopCalendar = page.getByRole("complementary", { name: "날짜와 클리닉 수업" });
    await desktopCalendar.getByRole("gridcell", {
      name: new RegExp(calendarDateLabel(date)),
    }).click();
  }
  const assignmentRegion = page.getByRole("region", { name: "배정 학생 관리" });
  await expect(assignmentRegion).toBeVisible();
  return assignmentRegion;
}

test.describe.serial("클리닉 왕복: 선생→학생→선생", () => {
  test.skip(Boolean(PRODUCTION_WRITE_BLOCK), PRODUCTION_WRITE_BLOCK ?? "");

  let browser: Browser;
  let adminPage: Page;
  let studentPage: Page;
  let sessionId: number | null = null;
  let sessionDate = "";
  let adminAccess = "";

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 선생이 클리닉 세션을 생성한다", async ({ browser: currentBrowser }, testInfo) => {
    testInfo.setTimeout(360_000);
    const ctx = await currentBrowser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    await adminPage.goto(`${BASE}/workspace/clinic/home`);
    await adminPage.waitForLoadState("load");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    sessionDate = tomorrow.toISOString().split("T")[0];

    const resp = await apiCall(adminPage, "POST", "/clinic/sessions/", {
      date: sessionDate, start_time: "14:00", duration_minutes: 60,
      location: `E2E_${TS}`, max_participants: 5, title: `[E2E]클리닉_${TS}`,
      target_grade: null, target_school_type: null,
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
    await adminPage.goto(`${BASE}/workspace/clinic/home`);
    await adminPage.waitForLoadState("load");
    await expect(adminPage.locator("text=Not Found")).not.toBeVisible();
  });

  test("4. 달력 일정에서 실제 학생을 추가·재조회·해제하고 권한·테넌트 경계를 확인한다", async ({ browser: currentBrowser }, testInfo) => {
    testInfo.setTimeout(360_000);
    expect(sessionId).toBeGreaterThan(0);
    expect(CROSS_TENANT).toMatch(/^qa-ymath-realuse-[a-z0-9-]+$/);

    await adminPage.context().close();
    const adminContext = await currentBrowser.newContext();
    adminPage = await adminContext.newPage();
    await loginViaUI(adminPage, "admin");
    const adminTokens = await loginAdmin(adminPage.request);
    adminAccess = adminTokens.access;

    const students = await expectApi<{ results?: StudentRow[] } | StudentRow[]>(
      adminPage.request,
      "GET",
      "/students/?page_size=100&ordering=name,id",
      adminAccess,
    );
    const primaryStudent = (Array.isArray(students) ? students : students.results ?? [])
      .find((student) => student.ps_number === "QA-0001");
    expect(primaryStudent, "the fixed qa-* scenario student is required").toBeTruthy();

    await adminPage.setViewportSize({ width: 1366, height: 850 });
    const desktopAssignments = await openDateAggregateFromCalendar(adminPage, sessionDate);
    await expect(desktopAssignments).toContainText("1개 일정 · 배정 0명");
    const desktopManage = desktopAssignments.getByRole("button", {
      name: new RegExp(`14:00 \\[E2E\\]클리닉_${TS} 학생 관리, 0명 배정`),
    });
    await expect(desktopManage).toBeVisible();
    expect((await desktopManage.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await desktopManage.click();

    await adminPage.getByRole("button", { name: "학생 추가하기", exact: true }).click();
    const targetDialog = adminPage.getByRole("dialog", { name: "대상자 선택" });
    await targetDialog.getByRole("button", { name: "전체 학생", exact: true }).click();
    await targetDialog.getByRole("checkbox", { name: `${primaryStudent?.name} 선택` }).check();
    const bulkResponsePromise = adminPage.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/clinic/participants/bulk-create/")
    ));
    await targetDialog.getByRole("button", { name: "선택 확정 (1명)" }).click();
    const bulkResponse = await bulkResponsePromise;
    expect(bulkResponse.status()).toBe(201);
    const bulkPayload = await bulkResponse.json() as { count: number; participants: ParticipantRow[] };
    expect(bulkPayload.count).toBe(1);
    expect(bulkPayload.participants).toHaveLength(1);
    const participant = bulkPayload.participants[0];
    expect(participant).toMatchObject({
      session: sessionId,
      student: primaryStudent?.id,
      status: "booked",
    });

    await adminPage.reload({ waitUntil: "domcontentloaded" });
    const persistedAfterAdd = await expectApi<ParticipantPage>(
      adminPage.request,
      "GET",
      `/clinic/participants/?session=${sessionId}`,
      adminAccess,
    );
    expect(participantRows(persistedAfterAdd)).toContainEqual(expect.objectContaining({
      id: participant.id,
      session: sessionId,
      student: primaryStudent?.id,
      status: "booked",
    }));
    await expect(adminPage.locator(".clinic-ops__card").filter({ hasText: primaryStudent?.name })).toBeVisible();

    const anonymous = await adminPage.request.get(
      `${getApiBaseUrl()}/api/v1/clinic/participants/${participant.id}/`,
      { headers: { "X-Tenant-Code": process.env.E2E_TENANT_CODE || "" } },
    );
    expect(anonymous.status()).toBe(401);

    const siblingUsername = process.env.E2E_STUDENT2_USER?.trim();
    const siblingPassword = process.env.E2E_STUDENT2_PASS?.trim();
    expect(siblingUsername, "the fixed sibling QA student is required").toBeTruthy();
    expect(siblingPassword, "the fixed sibling QA password is required").toBeTruthy();
    const siblingTokens = await loginApi(adminPage.request, siblingUsername!, siblingPassword!);
    const siblingRead = await api(
      adminPage.request,
      "GET",
      `/clinic/participants/${participant.id}/`,
      siblingTokens.access,
    );
    expect(siblingRead.status).toBe(404);
    const siblingMutation = await api(
      adminPage.request,
      "PATCH",
      `/clinic/participants/${participant.id}/set_status/`,
      siblingTokens.access,
      { status: "cancelled" },
    );
    expect(siblingMutation.status).toBe(404);
    expect(await probeDevelopmentCrossTenantDenial({
      accessToken: adminAccess,
      participantId: participant.id,
      targetTenantCode: CROSS_TENANT,
    })).toBe(403);

    await adminPage.setViewportSize({ width: 390, height: 844 });
    const mobileAssignments = await openDateAggregateFromCalendar(adminPage, sessionDate);
    await expect(mobileAssignments).toContainText("1개 일정 · 배정 1명");
    const mobileManage = mobileAssignments.getByRole("button", {
      name: new RegExp(`14:00 \\[E2E\\]클리닉_${TS} 학생 관리, 1명 배정`),
    });
    await expect(mobileManage).toBeVisible();
    expect((await mobileManage.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await mobileManage.focus();
    await adminPage.keyboard.press("Enter");
    await adminPage.getByRole("button", { name: `${primaryStudent?.name} 학생 작업대 열기` }).click();
    const workbench = adminPage.getByRole("dialog", { name: `${primaryStudent?.name} 클리닉 워크벤치` });
    await workbench.getByRole("button", { name: "명단에서 빼기", exact: true }).click();
    const confirmation = adminPage.getByRole("alertdialog", { name: "클리닉 명단에서 빼기" });
    const statusResponsePromise = adminPage.waitForResponse((response) => (
      response.request().method() === "PATCH"
      && new URL(response.url()).pathname.endsWith(`/api/v1/clinic/participants/${participant.id}/set_status/`)
    ));
    await confirmation.getByRole("button", { name: "명단에서 빼기", exact: true }).click();
    const statusResponse = await statusResponsePromise;
    expect(statusResponse.status()).toBe(200);
    expect(await statusResponse.json()).toMatchObject({ id: participant.id, status: "cancelled" });

    await adminPage.reload({ waitUntil: "domcontentloaded" });
    const persistedAfterRemoval = await expectApi<ParticipantPage>(
      adminPage.request,
      "GET",
      `/clinic/participants/?session=${sessionId}`,
      adminAccess,
    );
    expect(participantRows(persistedAfterRemoval)).toContainEqual(expect.objectContaining({
      id: participant.id,
      status: "cancelled",
    }));
    await expect(adminPage.locator(".clinic-ops__card").filter({ hasText: primaryStudent?.name })).toHaveCount(0);
    expect(await adminPage.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });

  test.afterAll(async () => {
    const cleanupErrors: unknown[] = [];
    try {
      if (sessionId && adminPage) {
        try {
          const cleanupResp = await apiCall(adminPage, "DELETE", `/clinic/sessions/${sessionId}/`);
          expect(
            [200, 204],
            `클리닉 E2E cleanup failed for session ${sessionId}: HTTP ${cleanupResp.status}`,
          ).toContain(cleanupResp.status);
        } catch (error) { cleanupErrors.push(error); }
      }
    } finally {
      await studentPage?.context()?.close();
      await adminPage?.context()?.close();
    }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "clinic real-use cleanup failed");
  });
});
