/**
 * 클리닉 왕복 플로우 E2E
 * 4주 전 합성 일정(API) → 지난 일정 불러오기(UI) → 학생/선생 확인 → 달력 학생 배정/해제 → 정리
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
  let sourceSessionId: number | null = null;
  let overnightSessionId: number | null = null;
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

    sessionDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })
      .format(new Date(Date.now() + 86_400_000));
    const sourceDateValue = new Date(`${sessionDate}T12:00:00Z`);
    sourceDateValue.setUTCDate(sourceDateValue.getUTCDate() - 28);
    const sourceDate = sourceDateValue.toISOString().slice(0, 10);

    const resp = await apiCall(adminPage, "POST", "/clinic/sessions/", {
      date: sourceDate, start_time: "14:00", duration_minutes: 60,
      location: `E2E_${TS}`, max_participants: 5, title: `[E2E]클리닉_${TS}`,
      target_grade: null, target_school_type: null,
      booking_mode: "fixed_slot", booking_interval_minutes: 60, booking_max_stay_minutes: 240,
      allow_multi_slot_booking: false,
    });
    expect(resp.status).toBe(201);
    sourceSessionId = resp.body.id;

    await gotoAndSettle(adminPage, `${BASE}/workspace/clinic/schedule?date=${sessionDate}`);
    await adminPage.getByRole("button", { name: "지난 일정 불러오기", exact: true }).click();
    const dialog = adminPage.getByRole("dialog", { name: "지난 일정 불러오기" });
    await dialog.getByLabel("가져올 주의 날짜", { exact: true }).fill(sourceDate);
    await dialog.locator(".clinic-import__session-item").filter({ hasText: `[E2E]클리닉_${TS}` }).click();
    for (const width of [1366, 390]) {
      await adminPage.setViewportSize({ width, height: 850 });
      await expect(dialog.getByRole("button", { name: "1건 불러오기", exact: true })).toBeInViewport();
      expect(await adminPage.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await testInfo.attach(`schedule-import-${width}`, { body: await adminPage.screenshot(), contentType: "image/png" });
    }
    const importedResponse = adminPage.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/clinic/sessions/"));
    await dialog.getByRole("button", { name: "1건 불러오기", exact: true }).click();
    const imported = await importedResponse;
    expect(imported.status()).toBe(201);
    const importedSession = await imported.json();
    sessionId = importedSession.id;
    expect(importedSession).toMatchObject({ date: sessionDate, start_time: "14:00:00", max_participants: 5, participant_count: 0, booking_mode: "fixed_slot" });
    await expect(dialog).toHaveCount(0);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await expect(adminPage.getByRole("article").filter({ hasText: `[E2E]클리닉_${TS}` })).toBeVisible();
    const persisted = await apiCall(adminPage, "GET", `/clinic/sessions/${sessionId}/`);
    expect(persisted.status).toBe(200);
    expect(persisted.body).toMatchObject({ id: sessionId, date: sessionDate, participant_count: 0 });
    await adminPage.getByRole("button", { name: "지난 일정 불러오기", exact: true }).click();
    await dialog.getByLabel("가져올 주의 날짜", { exact: true }).fill(sourceDate);
    await expect(dialog.locator(".clinic-import__session-item").filter({ hasText: `[E2E]클리닉_${TS}` })).toBeDisabled();
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
  });

  test("2. 학생 클리닉 화면에서 에러 없이 로드된다", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
    await loginViaUI(studentPage, "student");

    await studentPage.goto(`${BASE}/student/clinic`);
    await studentPage.waitForLoadState("load");
    await expect(studentPage.locator("text=Not Found")).not.toBeVisible();
    await expect(studentPage.locator("[data-app='student']").first()).toBeVisible();
    await studentPage.getByTestId(`clinic-calendar-day-${sessionDate}`).click();
    await expect(studentPage.getByRole("button", { name: `[E2E]클리닉_${TS}` })).toBeVisible();
    await studentPage.reload({ waitUntil: "domcontentloaded" });
    await studentPage.getByTestId(`clinic-calendar-day-${sessionDate}`).click();
    await expect(studentPage.getByRole("button", { name: `[E2E]클리닉_${TS}` })).toBeVisible();
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
    // JWT tenant binding rejects the token before participant permissions.
    expect(await probeDevelopmentCrossTenantDenial({
      accessToken: adminAccess,
      participantId: participant.id,
      targetTenantCode: CROSS_TENANT,
    })).toBe(401);

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

    await adminPage.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(adminPage, `${BASE}/workspace/clinic/schedule?create=1&date=${sessionDate}`);
    const createDialog = adminPage.getByRole("dialog", { name: "클리닉 만들기" });
    await createDialog.getByRole("button", { name: /자유지정 클리닉/ }).click();
    await createDialog.getByPlaceholder("예: 수학 보충").fill(`[E2E]심야클리닉_${TS}`);
    await createDialog.getByPlaceholder("장소 / 룸").fill(`E2E_${TS}`);
    const timePopover = adminPage.getByRole("dialog", { name: "시간 선택" });
    for (const [label, time] of [["시작 시간 선택", "23:00"], ["종료 시간 선택", "01:00"]]) {
      await createDialog.getByRole("button", { name: label, exact: true }).click();
      await timePopover.getByLabel("분 단위 직접 입력").fill(time);
      await timePopover.getByRole("button", { name: "적용", exact: true }).click();
    }
    await createDialog.getByRole("combobox", { name: "예약 간격" }).click();
    await adminPage.locator(".ant-select-dropdown:visible").getByText("30분", { exact: true }).click();
    await createDialog.getByRole("spinbutton", { name: "최대 체류 시간" }).fill("120");
    await createDialog.getByRole("button", { name: /^클리닉 만들기 \(정원 \d+명\)$/ }).click();
    await expect(adminPage.getByRole("alertdialog", { name: "클리닉 일정 최종 확인" })).toContainText("23:00–익일 01:00");
    const createResponse = adminPage.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/clinic/sessions/"));
    await adminPage.getByRole("alertdialog", { name: "클리닉 일정 최종 확인" })
      .getByRole("button", { name: "확인하고 만들기" }).click();
    const createdResponse = await createResponse;
    expect(createdResponse.status()).toBe(201);
    const overnight = await createdResponse.json() as { id: number; end_date: string };
    overnightSessionId = overnight.id;
    const actualDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })
      .format(new Date(`${sessionDate}T12:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000);
    expect(overnight.end_date).toBe(actualDate);
    await adminPage.setViewportSize({ width: 390, height: 844 });
    const overnightAssignments = await openDateAggregateFromCalendar(adminPage, sessionDate);
    await overnightAssignments.getByRole("button", {
      name: new RegExp(`23:00 .*심야클리닉_${TS} 학생 관리, 0명 배정`),
    }).click();
    await adminPage.getByRole("button", { name: "학생 추가하기", exact: true }).click();
    const overnightTargets = adminPage.getByRole("dialog", { name: "대상자 선택" });
    await overnightTargets.getByRole("button", { name: "전체 학생", exact: true }).click();
    await overnightTargets.getByRole("checkbox", { name: `${primaryStudent?.name} 선택` }).check();
    await overnightTargets.getByRole("button", { name: "선택 확정 (1명)" }).click();
    const timePicker = adminPage.getByRole("dialog", { name: "실제 예약 시간 선택" });
    await timePicker.getByRole("button", { name: new RegExp(`${actualDate} 00:30 시작`) }).click();
    await timePicker.getByRole("button", { name: `${actualDate} 01:00 종료, 총 30분` }).click();
    const manualResponse = adminPage.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/clinic/participants/bulk-create/"));
    const actionAt = Date.now();
    await timePicker.getByRole("button", { name: "이 시간으로 1명 추가" }).click();
    const manualResult = await manualResponse;
    const responseMs = Date.now() - actionAt;
    expect(manualResult.status()).toBe(201);
    const manualBody = await manualResult.json() as { participants: ParticipantRow[] };
    expect(manualBody.participants).toContainEqual(expect.objectContaining({
      session: overnight.id, student: primaryStudent?.id, booking_start_date: actualDate, booking_end_date: actualDate,
    }));
    await expect(adminPage.getByText(`예약 ${actualDate} 00:30–01:00`)).toBeVisible();
    const clinicInteractionTiming = { schema: "release-clinic-interaction/v1", action: "manual-add", viewport: 390, responseMs, listVisibleMs: Date.now() - actionAt };
    console.log(JSON.stringify({ clinicInteractionTiming }));
    await testInfo.attach("clinic-manual-add-timing", { body: JSON.stringify(clinicInteractionTiming), contentType: "application/json" });
    for (const width of [390, 1366]) {
      await adminPage.setViewportSize({ width, height: 900 });
      await adminPage.reload({ waitUntil: "domcontentloaded" });
      await expect(adminPage.getByText(`예약 ${actualDate} 00:30–01:00`)).toBeVisible();
      expect(await adminPage.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await testInfo.attach(`overnight-manual-booked-${width}`, { body: await adminPage.screenshot({ fullPage: true }), contentType: "image/png" });
    }

    // Keep the booking-cancellation scenario above in booked state. Study
    // completion is a separate lifecycle: undoing completion retains attendance.
    const completionParticipant = manualBody.participants.find((row) => (
      row.session === overnight.id && row.student === primaryStudent?.id
    ));
    expect(completionParticipant, "the UI-created overnight booking is required").toBeDefined();
    if (!completionParticipant) throw new Error("The overnight booking participant is missing");
    expect(Number.isSafeInteger(completionParticipant.id)).toBe(true);
    expect(completionParticipant.status).toBe("booked");
    // The QA administrator exercises the compact staff UI. Role authorization
    // remains covered separately; these writes must come from actual controls.
    const openCompactParticipant = async () => {
      await gotoAndSettle(adminPage, `${BASE}/workspace/mobile/clinic`);
      const dates = adminPage.locator('input[type="date"]');
      await dates.nth(1).fill(sessionDate);
      await dates.nth(0).fill(sessionDate);
      await adminPage.getByRole("button", { name: `[E2E]심야클리닉_${TS}`, exact: false }).click();
      return adminPage.getByTestId(`teacher-clinic-participant-${completionParticipant.id}`);
    };
    await adminPage.setViewportSize({ width: 390, height: 844 });
    let compactRow = await openCompactParticipant();
    await compactRow.getByRole("button", { name: "등원", exact: true }).click();
    await adminPage.getByRole("dialog", { name: "등원 처리", exact: true })
      .getByRole("button", { name: "등원 확정", exact: true }).click();
    const complete = compactRow.getByRole("button", { name: "자율학습 완료", exact: true });
    await expect(complete).toBeEnabled();
    expect((await complete.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await complete.click();
    await expect(compactRow.getByRole("button", { name: "완료 취소", exact: true })).toBeEnabled();
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    compactRow = await openCompactParticipant();
    await expect(compactRow.getByRole("button", { name: "완료 취소", exact: true })).toBeEnabled();
    const completed = await expectApi<{ status: string; completed_at: string | null }>(
      adminPage.request, "GET", `/clinic/participants/${completionParticipant.id}/`, adminAccess,
    );
    expect(completed.status).toBe("attended");
    expect(completed.completed_at).toBeTruthy();
    await adminPage.setViewportSize({ width: 1366, height: 900 });
    await compactRow.getByRole("button", { name: "완료 취소", exact: true }).click();
    await expect(compactRow.getByRole("button", { name: "자율학습 완료", exact: true })).toBeEnabled();
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    compactRow = await openCompactParticipant();
    await expect(compactRow.getByRole("button", { name: "자율학습 완료", exact: true })).toBeEnabled();
    const undone = await expectApi<{ status: string; completed_at: string | null }>(
      adminPage.request, "GET", `/clinic/participants/${completionParticipant.id}/`, adminAccess,
    );
    expect(undone).toMatchObject({ status: "attended", completed_at: null });
    expect(await adminPage.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });

  test.afterAll(async () => {
    const cleanupErrors: unknown[] = [];
    try {
      for (const cleanupId of [sessionId, sourceSessionId, overnightSessionId].filter((id): id is number => id != null)) {
        if (!adminPage) continue;
        try {
          const cleanupResp = await apiCall(adminPage, "DELETE", `/clinic/sessions/${cleanupId}/`);
          expect(
            [200, 204],
            `클리닉 E2E cleanup failed for session ${cleanupId}: HTTP ${cleanupResp.status}`,
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
