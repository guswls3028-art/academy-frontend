import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

test.use({ serviceWorkers: "block" });

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

function currentWeekDate(dayIndex: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset + dayIndex);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const saturday = currentWeekDate(5);
const saturdayLabel = `${Number(saturday.slice(5, 7))}월 ${Number(saturday.slice(8, 10))}일`;
const sessions = [
  {
    id: 703,
    title: "토요일 7시 클리닉",
    date: saturday,
    start_time: "19:00:00",
    duration_minutes: 90,
    location: "3층 자습실",
    max_participants: 8,
    participant_count: 0,
    booked_count: 0,
  },
  {
    id: 701,
    title: "토요일 1시 클리닉",
    date: saturday,
    start_time: "13:00:00",
    duration_minutes: 90,
    location: "1층 세미나실",
    max_participants: 10,
    participant_count: 0,
    booked_count: 0,
  },
  {
    id: 702,
    title: "토요일 5시 클리닉",
    date: saturday,
    start_time: "17:00:00",
    duration_minutes: 90,
    location: "2층 보강실",
    max_participants: 12,
    participant_count: 0,
    booked_count: 0,
  },
];

async function seed(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "관리자 클리닉 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

type PasscardSettingsState = {
  payloads: Array<Record<string, unknown>>;
};

type OperationsState = {
  participants: Array<Record<string, unknown>>;
  targets: Array<Record<string, unknown>>;
  statusPayloads?: Array<Record<string, unknown>>;
  checkoutPayloads?: Array<Record<string, unknown>>;
  reminderPayloads?: Array<Record<string, unknown>>;
  bookingPayloads?: Array<Record<string, unknown>>;
};

async function installApi(
  page: Page,
  passcardState?: PasscardSettingsState,
  operationsState?: OperationsState,
) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/clinic/settings/" && method === "GET") {
      return json({
        colors: ["#ef4444", "#3b82f6", "#22c55e"],
        saved_colors: ["#ef4444", "#3b82f6", "#22c55e"],
        use_daily_random: false,
        auto_approve_booking: true,
      });
    }
    if (path === "/clinic/settings/" && method === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      passcardState?.payloads.push(payload);
      return json({
        ...payload,
        saved_colors: payload.colors,
        auto_approve_booking: true,
      });
    }
    if (path === "/clinic/sessions/" && method === "GET") return json(sessions);
    if (path === "/clinic/sessions/tree/" && method === "GET") return json(sessions);
    if (path === "/clinic/participants/" && method === "GET") {
      return json({
        count: operationsState?.participants.length ?? 0,
        results: operationsState?.participants ?? [],
      });
    }
    if (path === "/results/admin/clinic-targets/") {
      return json(operationsState?.targets ?? []);
    }
    const statusMatch = path.match(/^\/clinic\/participants\/(\d+)\/set_status\/$/);
    if (statusMatch && method === "PATCH") {
      const id = Number(statusMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.statusPayloads?.push({ id, ...payload });
      const participant = operationsState?.participants.find((row) => row.id === id);
      if (!participant) return json({ detail: "not found" }, 404);
      participant.status = payload.status;
      participant.is_late = Boolean(payload.is_late);
      participant.checked_in_at = payload.status === "attended"
        ? `${saturday}T13:30:00+09:00`
        : null;
      participant.checked_out_at = null;
      return json({ ...participant, notification: { requested: 1, failed: 0 } });
    }
    const checkoutMatch = path.match(/^\/clinic\/participants\/(\d+)\/checkout\/$/);
    if (checkoutMatch && method === "POST") {
      const id = Number(checkoutMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.checkoutPayloads?.push({ id, ...payload });
      const participant = operationsState?.participants.find((row) => row.id === id);
      if (!participant || participant.status !== "attended") {
        return json({ detail: "등원 후 하원할 수 있습니다." }, 400);
      }
      participant.checked_out_at = `${saturday}T15:00:00+09:00`;
      return json({ ...participant, notification: { requested: 1, failed: 0 } });
    }
    const remindMatch = path.match(/^\/clinic\/participants\/(\d+)\/remind\/$/);
    if (remindMatch && method === "POST") {
      const id = Number(remindMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.reminderPayloads?.push({ id, ...payload });
      return json({ ok: true, status: "ok", sent: 2, scheduled: 4, skipped: 0 });
    }
    const bookingMatch = path.match(/^\/clinic\/participants\/(\d+)\/change-booking\/$/);
    if (bookingMatch && method === "POST") {
      const id = Number(bookingMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.bookingPayloads?.push({ id, ...payload });
      return json({ id: 9901, session: payload.new_session_id, status: "booked" });
    }
    if (path === "/messaging/auto-send/") {
      return json([]);
    }
    if (
      path === "/lectures/sections/" ||
      path === "/lectures/lectures/"
    ) {
      return json([]);
    }
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) {
      return json({ count: 0, results: [] });
    }
    return json({ count: 0, results: [] });
  });
}

test("같은 날짜에 여러 클리닉 시간대를 시간순으로 보고 계속 추가한다", async ({ page }) => {
  await seed(page);
  await installApi(page);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });

  const saturdayCell = page.getByRole("gridcell", { name: `${saturdayLabel} 토요일` });
  await expect(saturdayCell).toContainText("3개", { timeout: 20_000 });
  await expect(saturdayCell.getByRole("article")).toHaveCount(3);
  await expect(saturdayCell.getByRole("article")).toContainText([
    "13:00–14:30",
    "17:00–18:30",
    "19:00–20:30",
  ]);

  const addTimeButton = saturdayCell.getByRole("button", {
    name: `${saturdayLabel} 클리닉 시간대 추가`,
  });
  await expect(addTimeButton).toBeVisible();
  await expect(addTimeButton).toContainText("시간대 추가");
  await page.screenshot({ path: "test-results/admin-clinic-multisession-1366.png", fullPage: false });

  await addTimeButton.click();
  const dialog = page.getByRole("dialog").filter({ hasText: "클리닉 만들기" });
  await expect(dialog.getByRole("heading", { name: "클리닉 만들기" })).toBeVisible();
  await expect(dialog).toContainText("현재 3개 시간대가 있습니다.");
});

test("결석 후 새 일정 만들기는 선택 날짜의 생성 창을 바로 연다", async ({ page }) => {
  await seed(page);
  await installApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(
    page,
    `${BASE}/workspace/clinic/schedule?create=1&date=${saturday}`,
    { timeout: 45_000 },
  );

  const dialog = page.getByRole("dialog").filter({ hasText: "클리닉 만들기" });
  await expect(dialog.getByRole("heading", { name: "클리닉 만들기" })).toBeVisible();
  await expect(dialog).toContainText(`${Number(saturday.slice(5, 7))}월 ${Number(saturday.slice(8, 10))}일`);
  await expect(page).toHaveURL(/\/workspace\/clinic\/schedule$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("클리닉 운영은 최근 할 일과 등원·지각·하원·재촉·결석 후 보충을 함께 처리한다", async ({ page }) => {
  const studentId = 501;
  const state: OperationsState = {
    participants: [
      {
        id: 801, session: 701, student: studentId, student_name: "김다과목",
        enrollment_id: 1001, session_date: saturday, session_title: "토요일 1시 클리닉",
        session_start_time: "13:00:00", session_end_time: "14:30:00",
        session_location: "1층 세미나실", status: "booked", checked_in_at: null,
        checked_out_at: null, completed_at: null, is_late: false,
        lecture_title: "화학특강", lecture_chip_label: "화특",
      },
      {
        id: 802, session: 701, student: 502, student_name: "지각 학생",
        enrollment_id: 1002, session_date: saturday, session_title: "토요일 1시 클리닉",
        session_start_time: "13:00:00", session_location: "1층 세미나실",
        status: "no_show", checked_in_at: null, checked_out_at: null, is_late: false,
      },
      {
        id: 803, session: 701, student: 503, student_name: "재촉 학생",
        enrollment_id: 1003, session_date: saturday, session_title: "토요일 1시 클리닉",
        session_start_time: "13:00:00", session_location: "1층 세미나실",
        status: "booked", checked_in_at: null, checked_out_at: null, is_late: false,
      },
      {
        id: 804, session: 701, student: 504, student_name: "결석 학생",
        enrollment_id: 1004, session_date: saturday, session_title: "토요일 1시 클리닉",
        session_start_time: "13:00:00", session_location: "1층 세미나실",
        status: "booked", checked_in_at: null, checked_out_at: null, is_late: false,
      },
    ],
    targets: [
      {
        enrollment_id: 1001,
        student_id: studentId,
        student_name: "김다과목",
        session_title: "화학특강 4차시",
        reason: "score",
        clinic_reason: "exam",
        exam_score: 35,
        cutline_score: 60,
        clinic_link_id: 9001,
        source_type: "exam",
        max_score: 100,
        source_title: "6주차 확인 시험",
        source_scope: "화학 결합",
        created_at: "2026-08-22T04:00:00Z",
      },
      {
        enrollment_id: 1002,
        student_id: studentId,
        student_name: "김다과목",
        session_title: "통과특강 2차시",
        reason: "score",
        clinic_reason: "homework",
        exam_score: null,
        cutline_score: null,
        homework_score: 2,
        homework_cutline: 4,
        clinic_link_id: 9002,
        source_type: "homework",
        max_score: 5,
        source_title: "7주차 오답 과제",
        source_scope: "산화 환원",
        created_at: "2026-08-22T04:05:00Z",
      },
    ],
    statusPayloads: [],
    checkoutPayloads: [],
    reminderPayloads: [],
    bookingPayloads: [],
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(
    page,
    `${BASE}/workspace/clinic/operations?date=${saturday}&session=701`,
    { timeout: 45_000 },
  );

  const studentCard = page.locator(".clinic-ops__card").filter({ hasText: "김다과목" });
  await expect(studentCard).toBeVisible({ timeout: 20_000 });
  await expect(studentCard.locator(".clinic-ops__reason-tag")).toHaveCount(2);
  await expect(studentCard).toContainText("화학특강 4차시");
  await expect(studentCard).toContainText("통과특강 2차시");
  const newestTarget = studentCard.getByText("통과특강 2차시", { exact: true });
  const olderTarget = studentCard.getByText("화학특강 4차시", { exact: true });
  expect((await newestTarget.boundingBox())?.y ?? Infinity).toBeLessThan(
    (await olderTarget.boundingBox())?.y ?? 0,
  );

  await expect(studentCard.getByRole("button", { name: "하원", exact: true })).toBeDisabled();
  await studentCard.getByRole("button", { name: "등원", exact: true }).click();
  await page.getByRole("dialog", { name: "등원 처리" }).getByLabel("둘 다").check();
  await page.keyboard.press("Enter");
  await expect.poll(() => state.statusPayloads?.[0]).toEqual({
    id: 801, status: "attended", is_late: false, send_to: "both",
  });
  await expect(studentCard.getByRole("button", { name: "하원", exact: true })).toBeEnabled();
  await studentCard.getByRole("button", { name: "하원", exact: true }).click();
  await page.getByRole("dialog", { name: "하원 처리" }).getByLabel("학부모").check();
  await page.keyboard.press("Enter");
  await expect.poll(() => state.checkoutPayloads?.[0]).toEqual({ id: 801, send_to: "parent" });
  await expect(studentCard).toContainText("하원 완료");

  const lateCard = page.locator(".clinic-ops__card").filter({ hasText: "지각 학생" });
  await lateCard.getByRole("button", { name: "지각 등원", exact: true }).click();
  await page.keyboard.press("Enter");
  await expect.poll(() => state.statusPayloads?.[1]).toMatchObject({
    id: 802, status: "attended", is_late: true,
  });

  const reminderCard = page.locator(".clinic-ops__card").filter({ hasText: "재촉 학생" });
  await reminderCard.getByRole("button", { name: "재촉", exact: true }).click();
  const reminderDialog = page.getByRole("dialog", { name: "등원 재촉" });
  await reminderDialog.getByLabel("반복 발송").check();
  await reminderDialog.getByLabel("반복 간격(분)").fill("60");
  await reminderDialog.getByLabel("반복 종료").fill("21:00");
  await page.keyboard.press("Enter");
  await expect.poll(() => state.reminderPayloads?.[0]).toMatchObject({
    id: 803, mode: "repeat", interval_minutes: 60,
  });

  const absentCard = page.locator(".clinic-ops__card").filter({ hasText: "결석 학생" });
  await absentCard.getByRole("button", { name: "결석", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "결석 확인" })).toHaveCount(0);
  await absentCard.getByRole("button", { name: "결석", exact: true }).click();
  await page.keyboard.press("Enter");
  const reschedule = page.getByRole("dialog", { name: "보충 일정 정하기" });
  await reschedule.getByLabel("이동할 일정").selectOption("702");
  await reschedule.getByRole("button", { name: "일정 이동" }).click();
  await expect.poll(() => state.bookingPayloads?.[0]).toMatchObject({
    id: 804, new_session_id: 702,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await studentCard.scrollIntoViewIfNeeded();
  await expect(studentCard.locator(".clinic-ops__reason-tag")).toHaveCount(2);
  await expect(studentCard).toContainText("화학특강 4차시");
  await expect(studentCard).toContainText("통과특강 2차시");
  expect(
    await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test("관리자가 패스카드 3색을 확인하고 학생 화면에 적용한다", async ({ page }) => {
  const state: PasscardSettingsState = { payloads: [] };
  await seed(page);
  await installApi(page, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/settings`, { timeout: 45_000 });

  await expect(page.getByRole("heading", { name: "클리닉 패스카드" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "학생 합격 화면" })).toBeVisible();
  await expect(page.getByLabel("패스카드 색상 1")).toHaveValue("#ef4444");
  await page.getByLabel("패스카드 색상 1").fill("#112233");
  await page.getByRole("button", { name: "학생 화면에 적용" }).click();

  await expect.poll(() => state.payloads).toEqual([{
    colors: ["#112233", "#3b82f6", "#22c55e"],
    use_daily_random: false,
  }]);
  await page.screenshot({ path: "test-results/admin-clinic-passcard-1366.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "클리닉 패스카드" })).toBeVisible();
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/admin-clinic-passcard-390.png", fullPage: true });
});

test("선생님 모바일 메뉴에서 패스카드 색상 리모컨을 연다", async ({ page }) => {
  await seed(page);
  await installApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/clinic/remote`, { timeout: 45_000 });

  await expect(page.getByRole("heading", { name: "패스카드 색상" })).toBeVisible();
  await expect(page.getByText("합격", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "색상 1 변경" })).toBeVisible();
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/teacher-clinic-passcard-390.png", fullPage: true });
});
