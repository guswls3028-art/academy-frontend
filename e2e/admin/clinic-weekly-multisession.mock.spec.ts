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

function currentDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateInMonth(monthOffset: number, day: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setMonth(date.getMonth() + monthOffset, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const saturday = currentWeekDate(5);
const today = currentDate();
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
    target_lecture_ids: [31, 32],
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

type ScheduleState = {
  createPayloads: Array<Record<string, unknown>>;
  updatePayloads: Array<{ id: number; payload: Record<string, unknown> }>;
  sessions?: Array<(typeof sessions)[number]>;
  failSessionRead?: boolean;
  sessionReadGate?: Promise<void>;
  createGate?: Promise<void>;
  updateGate?: Promise<void>;
};

type OperationsState = {
  participants: Array<Record<string, unknown>>;
  participantPages?: Array<Array<Record<string, unknown>>>;
  participantRequestQueries?: string[];
  participantNextByPage?: Record<number, string | null>;
  omitParticipantNext?: boolean;
  onsiteParticipantsGate?: Promise<void>;
  returnUnsafeOnsiteRows?: boolean;
  targets: Array<Record<string, unknown>>;
  failTargets?: boolean;
  targetGate?: Promise<void>;
  targetRequests?: number;
  participantRequests?: number;
  resolutionPayloads?: Array<Record<string, unknown>>;
  persistHomeworkTargetReadbacks?: number;
  participantsGate?: Promise<void>;
  statusPayloads?: Array<Record<string, unknown>>;
  checkoutPayloads?: Array<Record<string, unknown>>;
  reminderPayloads?: Array<Record<string, unknown>>;
  bookingPayloads?: Array<Record<string, unknown>>;
  planPayloads?: Array<{ id: number; planned_clinic_link_ids: number[] }>;
  rejectNextPlan?: boolean;
  waiverPayloads?: Array<Record<string, unknown>>;
  completionPayloads?: number[];
  statusNotifications?: Record<number, Record<string, unknown> | null>;
  statusFailures?: number[];
  checkoutNotification?: Record<string, unknown> | null;
  completeNotification?: Record<string, unknown> | null;
  reminderResponses?: Array<{ body: Record<string, unknown>; status?: number }>;
};

async function installApi(
  page: Page,
  passcardState?: PasscardSettingsState,
  operationsState?: OperationsState,
  scheduleState?: ScheduleState,
) {
  const sessionRows = (scheduleState?.sessions ?? sessions).map((session) => ({ ...session }));
  if (scheduleState) scheduleState.sessions = sessionRows;
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
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
    if (path === "/clinic/sessions/" && method === "GET") {
      await scheduleState?.sessionReadGate;
      if (scheduleState?.failSessionRead) return json({ detail: "temporary failure" }, 503);
      return json(sessionRows);
    }
    if (path === "/clinic/sessions/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      scheduleState?.createPayloads.push(payload);
      await scheduleState?.createGate;
      return json({ id: 799, ...payload }, 201);
    }
    const updateSessionMatch = path.match(/^\/clinic\/sessions\/(\d+)\/$/);
    if (updateSessionMatch && method === "PATCH") {
      const sessionId = Number(updateSessionMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      scheduleState?.updatePayloads.push({ id: sessionId, payload });
      await scheduleState?.updateGate;
      const session = sessionRows.find((candidate) => candidate.id === sessionId);
      if (session) Object.assign(session, payload);
      return json({ id: sessionId, ...payload });
    }
    if (path === "/clinic/sessions/tree/" && method === "GET") return json(sessionRows);
    if (path === "/clinic/participants/" && method === "GET") {
      if (operationsState) {
        operationsState.participantRequests = (operationsState.participantRequests ?? 0) + 1;
      }
      await operationsState?.participantsGate;
      const url = new URL(request.url());
      if (url.searchParams.has("onsite_date")) {
        await operationsState?.onsiteParticipantsGate;
      }
      operationsState?.participantRequestQueries?.push(url.search);
      const pageNumber = Math.max(1, Number(url.searchParams.get("page") || "1"));
      const rawPageRows = operationsState?.participantPages?.[pageNumber - 1];
      if (rawPageRows) {
        const pageRows = url.searchParams.has("onsite_date") && !operationsState?.returnUnsafeOnsiteRows
          ? rawPageRows.filter((row) =>
              row.session_date === url.searchParams.get("onsite_date") &&
              row.status === "attended" &&
              typeof row.checked_in_at === "string" &&
              row.checked_in_at.length > 0 &&
              row.checked_out_at == null
            )
          : rawPageRows;
        const nextPage = operationsState?.participantPages?.[pageNumber];
        const hasNextOverride = Object.prototype.hasOwnProperty.call(
          operationsState?.participantNextByPage ?? {},
          pageNumber,
        );
        const next = hasNextOverride
          ? operationsState?.participantNextByPage?.[pageNumber] ?? null
          : nextPage
            ? `${url.origin}/api/v1/clinic/participants/?onsite_date=${url.searchParams.get("onsite_date")}&page=${pageNumber + 1}`
            : null;
        const response = {
          count: operationsState?.participantPages?.flat().filter((row) =>
            !url.searchParams.has("onsite_date") || operationsState?.returnUnsafeOnsiteRows || (
              row.session_date === url.searchParams.get("onsite_date") &&
              row.status === "attended" &&
              typeof row.checked_in_at === "string" &&
              row.checked_in_at.length > 0 &&
              row.checked_out_at == null
            )
          ).length ?? pageRows.length,
          next,
          previous: pageNumber > 1 ? "previous" : null,
          results: pageRows,
        };
        if (operationsState?.omitParticipantNext) {
          return json({ count: response.count, previous: response.previous, results: response.results });
        }
        return json(response);
      }
      const visibleParticipants = url.searchParams.has("onsite_date") && !operationsState?.returnUnsafeOnsiteRows
        ? (operationsState?.participants ?? []).filter((row) =>
            row.session_date === url.searchParams.get("onsite_date") &&
            row.status === "attended" &&
            typeof row.checked_in_at === "string" &&
            row.checked_in_at.length > 0 &&
            row.checked_out_at == null
          )
        : operationsState?.participants ?? [];
      const response = {
        count: visibleParticipants.length,
        next: null,
        previous: null,
        results: visibleParticipants,
      };
      if (operationsState?.omitParticipantNext) {
        return json({ count: response.count, previous: response.previous, results: response.results });
      }
      return json(response);
    }
    if (path === "/results/admin/clinic-targets/") {
      if (operationsState) {
        operationsState.targetRequests = (operationsState.targetRequests ?? 0) + 1;
        await operationsState.targetGate;
        if (operationsState.failTargets) return json({ detail: "temporary" }, 503);
      }
      return json((operationsState?.targets ?? []).filter((target) => !target.resolved_at));
    }
    if (path === "/results/admin/clinic-targets/waive-missing/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.waiverPayloads?.push(payload);
      if (operationsState) {
        operationsState.targets = operationsState.targets.map((target) => (
          target.session_id === payload.session_id &&
          target.enrollment_id === payload.enrollment_id &&
          target.exam_id === payload.exam_id
            ? { ...target, resolved_at: "2026-08-24T10:00:00+09:00", resolution_type: "WAIVED" }
            : target
        ));
      }
      return json({ clinic_link_id: 9904, resolution_type: "WAIVED" }, 201);
    }
    if (path === "/results/admin/sessions/703/score-correction/" && method === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.resolutionPayloads?.push(payload);
      if (operationsState) {
        if ((operationsState.persistHomeworkTargetReadbacks ?? 0) > 0) {
          operationsState.persistHomeworkTargetReadbacks = (operationsState.persistHomeworkTargetReadbacks ?? 0) - 1;
        } else {
          operationsState.targets = operationsState.targets.map((target) => (
            target.clinic_link_id === 9003
              ? {
                  ...target,
                  resolved_at: "2026-08-23T16:45:00+09:00",
                  resolution_type: "MANUAL_OVERRIDE",
                }
              : target
          ));
        }
      }
      return json({
        correction_status: "COMPLETED",
        correction_completed_at: "2026-08-23T16:45:00+09:00",
        correction_note: "현장 제출 확인",
        correction_updated_at: "2026-08-23T16:45:00+09:00",
        teacher_resolved: true,
      });
    }
    const statusMatch = path.match(/^\/clinic\/participants\/(\d+)\/set_status\/$/);
    if (statusMatch && method === "PATCH") {
      const id = Number(statusMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.statusPayloads?.push({ id, ...payload });
      if (operationsState?.statusFailures?.includes(id)) {
        return json({ detail: "temporary status failure" }, 503);
      }
      const participant = operationsState?.participants.find((row) => row.id === id);
      if (!participant) return json({ detail: "not found" }, 404);
      participant.status = payload.status;
      participant.is_late = Boolean(payload.is_late);
      participant.checked_in_at = payload.status === "attended"
        ? `${saturday}T13:30:00+09:00`
        : null;
      participant.checked_out_at = null;
      const notification = operationsState?.statusNotifications?.[id] ?? {
        requested: 1,
        failed: 0,
        send_to: payload.send_to ?? "parent",
      };
      return json({ ...participant, notification });
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
      return json({
        ...participant,
        notification: operationsState?.checkoutNotification ?? {
          requested: 1,
          failed: 0,
          send_to: payload.send_to ?? "parent",
        },
      });
    }
    const remindMatch = path.match(/^\/clinic\/participants\/(\d+)\/remind\/$/);
    if (remindMatch && method === "POST") {
      const id = Number(remindMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.reminderPayloads?.push({ id, ...payload });
      const configured = operationsState?.reminderResponses?.shift();
      if (configured) return json(configured.body, configured.status ?? 200);
      return json({ ok: true, status: "ok", sent: 2, scheduled: 4, skipped: 0 });
    }
    const completeMatch = path.match(/^\/clinic\/participants\/(\d+)\/complete\/$/);
    if (completeMatch && method === "POST") {
      const id = Number(completeMatch[1]);
      operationsState?.completionPayloads?.push(id);
      const participant = operationsState?.participants.find((row) => row.id === id);
      if (!participant) return json({ detail: "not found" }, 404);
      participant.completed_at = `${saturday}T15:10:00+09:00`;
      return json({
        ...participant,
        notification: operationsState?.completeNotification ?? {
          requested: 1,
          failed: 0,
          send_to: "parent",
        },
      });
    }
    const bookingMatch = path.match(/^\/clinic\/participants\/(\d+)\/change-booking\/$/);
    if (bookingMatch && method === "POST") {
      const id = Number(bookingMatch[1]);
      const payload = request.postDataJSON() as Record<string, unknown>;
      operationsState?.bookingPayloads?.push({ id, ...payload });
      return json({ id: 9901, session: payload.new_session_id, status: "booked" });
    }
    const planMatch = path.match(/^\/clinic\/participants\/(\d+)\/planned-clinic-links\/$/);
    if (planMatch && method === "PUT") {
      const id = Number(planMatch[1]);
      const payload = request.postDataJSON() as { planned_clinic_link_ids: number[] };
      operationsState?.planPayloads?.push({ id, ...payload });
      if (operationsState?.rejectNextPlan) {
        operationsState.rejectNextPlan = false;
        return json({ detail: "해결되었거나 범위를 벗어난 항목입니다." }, 400);
      }
      const participant = operationsState?.participants.find((row) => row.id === id);
      if (!participant) return json({ detail: "not found" }, 404);
      participant.planned_clinic_link_ids = [...payload.planned_clinic_link_ids].sort((a, b) => a - b);
      return json({ ...participant });
    }
    if (path === "/messaging/auto-send/") {
      return json([]);
    }
    if (path === "/lectures/lectures/") {
      return url.searchParams.get("is_active") === "false"
        ? json([{ id: 32, title: "고2 화학 심화", is_active: false }])
        : json([{ id: 31, title: "고2 물리 심화", is_active: true }]);
    }
    if (path === "/lectures/sections/") {
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

  const saturdayCell = page.getByRole("gridcell", { name: `${saturdayLabel} 토요일`, exact: true });
  await expect(saturdayCell).toContainText("3개", { timeout: 20_000 });
  await expect(saturdayCell.getByRole("article")).toHaveCount(3);
  await expect(saturdayCell.getByRole("article")).toContainText([
    "13:00–14:30",
    "17:00–18:30",
    "19:00–20:30",
  ]);
  const middleSession = saturdayCell.getByRole("article").filter({ hasText: "토요일 5시 클리닉" });
  const settingsButton = middleSession.getByRole("button", { name: "토요일 5시 클리닉 17:00 일정 수정" });
  const capacity = middleSession.getByText("0/12", { exact: true });
  const studentAdd = middleSession.getByRole("button", { name: "학생 추가", exact: true });
  const actionGroup = studentAdd.locator("..");
  await expect(actionGroup.getByRole("button")).toHaveCount(3);
  const [settingsBox, capacityBox, studentAddBox] = await Promise.all([
    settingsButton.boundingBox(),
    capacity.boundingBox(),
    studentAdd.boundingBox(),
  ]);
  expect(Math.abs((settingsBox?.y ?? 0) - (capacityBox?.y ?? 0))).toBeLessThanOrEqual(8);
  expect(settingsBox?.y ?? 0).toBeLessThan(studentAddBox?.y ?? 0);

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

test("주간 날짜 탐색에서 원하는 날짜의 일정 열로 바로 이동한다", async ({ page }) => {
  await seed(page);
  await installApi(page);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });

  const navigator = page.getByRole("navigation", { name: "주간 날짜 선택" });
  await expect(navigator.getByRole("button")).toHaveCount(7);
  const saturdayButton = navigator.getByRole("button", {
    name: new RegExp(`${saturdayLabel} 토요일, 클리닉 3개, 예약 0명`),
  });
  await expect(saturdayButton).toContainText("3개");
  await saturdayButton.click();
  await expect(saturdayButton).toHaveAttribute("aria-pressed", "true");

  const desktopViewport = page.locator("[data-clinic-board-viewport]");
  const saturdayCell = page.getByRole("gridcell", { name: `${saturdayLabel} 토요일`, exact: true });
  await expect.poll(async () => {
    const [viewportBox, dayBox] = await Promise.all([
      desktopViewport.boundingBox(),
      saturdayCell.boundingBox(),
    ]);
    if (!viewportBox || !dayBox) return false;
    return dayBox.x >= viewportBox.x - 1 && dayBox.x < viewportBox.x + viewportBox.width;
  }).toBe(true);
  await page.screenshot({ path: "test-results/admin-clinic-calendar-forwardfix-1366.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });
  const mobileNavigator = page.getByRole("navigation", { name: "주간 날짜 선택" });
  const mobileSaturdayButton = mobileNavigator.getByRole("button", {
    name: new RegExp(`${saturdayLabel} 토요일, 클리닉 3개, 예약 0명`),
  });
  await mobileSaturdayButton.click();
  await expect(mobileSaturdayButton).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator("[data-clinic-board-viewport]").evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  )).toBe(true);
  await page.screenshot({ path: "test-results/admin-clinic-calendar-forwardfix-390.png", fullPage: false });
});

test("월간 달력에서 날짜를 찾은 뒤 기존 주간 레일과 일정 카드로 이어진다", async ({ page }) => {
  const nextMonthDate = dateInMonth(1, 15);
  const nextMonthDateValue = new Date(`${nextMonthDate}T12:00:00`);
  const nextMonthLabel = `${nextMonthDateValue.getMonth() + 1}월 ${nextMonthDateValue.getDate()}일`;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][nextMonthDateValue.getDay()];
  const state: ScheduleState = {
    createPayloads: [],
    updatePayloads: [],
    sessions: [
      ...sessions,
      {
        ...sessions[0],
        id: 704,
        title: "다음 달 선택 클리닉",
        date: nextMonthDate,
        start_time: "15:00:00",
      },
    ],
  };
  const clinicMutations: string[] = [];
  page.on("request", (request) => {
    if (!request.url().includes("/api/v1/clinic/")) return;
    if (["GET", "OPTIONS"].includes(request.method())) return;
    clinicMutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });

  await seed(page);
  await installApi(page, undefined, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });

  const overview = page.getByRole("region", { name: "월간 날짜 탐색" });
  const calendar = overview.getByRole("grid", { name: /클리닉 월간 달력/ });
  await expect(calendar.getByRole("columnheader")).toHaveText(["일", "월", "화", "수", "목", "금", "토"]);
  await expect(calendar.getByRole("gridcell")).toHaveCount(42);
  await overview.getByRole("button", { name: "다음 달" }).click();
  const monthDate = calendar.getByRole("gridcell", {
    name: new RegExp(`${nextMonthLabel} ${weekday}요일, 클리닉 1개`),
  });
  await monthDate.focus();
  await monthDate.press("Enter");
  await expect(monthDate).toHaveAttribute("aria-selected", "true");

  const navigator = page.getByRole("navigation", { name: "주간 날짜 선택" });
  const weekDate = navigator.getByRole("button", {
    name: new RegExp(`${nextMonthLabel} ${weekday}요일, 클리닉 1개, 예약 0명`),
  });
  await expect(weekDate).toHaveAttribute("aria-pressed", "true");
  await expect(weekDate).toBeFocused();
  const selectedCell = page.getByRole("gridcell", {
    name: `${nextMonthLabel} ${weekday}요일`,
    exact: true,
  });
  await expect(selectedCell.getByRole("article")).toContainText("다음 달 선택 클리닉");
  await expect(selectedCell.getByRole("button", { name: "학생 추가", exact: true })).toBeVisible();
  expect(clinicMutations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator("[data-clinic-board-viewport]").evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  )).toBe(true);
  await expect(calendar.getByRole("gridcell")).toHaveCount(42);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await calendar.getByRole("gridcell").first()
    .evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  expect(clinicMutations).toEqual([]);
});

test("월간 달력은 조회 중·실패를 0개로 단정하지 않고 성공한 빈 달만 0개로 표시한다", async ({ page }) => {
  let releaseSessionRead = () => {};
  const sessionReadGate = new Promise<void>((resolve) => { releaseSessionRead = resolve; });
  const state: ScheduleState = {
    createPayloads: [],
    updatePayloads: [],
    sessions: [],
    sessionReadGate,
  };
  await seed(page);
  await installApi(page, undefined, undefined, state);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/workspace/clinic/schedule`, { waitUntil: "domcontentloaded" });

  const overview = page.getByRole("region", { name: "월간 날짜 탐색" });
  await expect(overview.getByText("월간 일정을 불러오는 중입니다.")).toBeVisible({ timeout: 20_000 });
  await expect(overview.getByText("0개", { exact: true })).toHaveCount(0);

  releaseSessionRead();
  await expect(overview.getByText("이번 달에 열린 시간대가 없습니다.")).toBeVisible();
  await expect(overview.getByText("0개", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  state.failSessionRead = true;
  await page.getByRole("button", { name: "일정 새로고침" }).click();
  await expect(overview.getByText("월간 일정을 확인하지 못했습니다.")).toBeVisible();
  await expect(overview.getByText("0개", { exact: true })).toHaveCount(0);

  state.failSessionRead = false;
  await overview.getByRole("button", { name: "월간 일정 다시 불러오기" }).click();
  await expect(overview.getByText("이번 달에 열린 시간대가 없습니다.")).toBeVisible();
});

test("주간 날짜 탐색은 일정 조회 실패를 0개로 확정 표시하지 않는다", async ({ page }) => {
  const state: ScheduleState = {
    createPayloads: [],
    updatePayloads: [],
    failSessionRead: true,
  };
  await seed(page);
  await installApi(page, undefined, undefined, state);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });

  const navigator = page.getByRole("navigation", { name: "주간 날짜 선택" });
  await expect(navigator.getByRole("button", { name: /일정 확인 실패/ })).toHaveCount(7, {
    timeout: 20_000,
  });
  await expect(navigator.getByText("확인 실패", { exact: true })).toHaveCount(7);
  await expect(navigator.getByText("0개", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("결석 후 새 일정 만들기는 선택 날짜의 생성 창을 바로 연다", async ({ page }) => {
  await seed(page);
  await installApi(page);
  await page.setViewportSize({ width: 1366, height: 850 });
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

test("클리닉 생성은 일정 요약을 최종 확인한 뒤에만 저장한다", async ({ page }) => {
  let releaseCreate = () => {};
  const createGate = new Promise<void>((resolve) => { releaseCreate = resolve; });
  const state: ScheduleState = { createPayloads: [], updatePayloads: [], createGate };
  await seed(page);
  await installApi(page, undefined, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });

  const saturdayCell = page.getByRole("gridcell", { name: `${saturdayLabel} 토요일`, exact: true });
  const sourceSession = saturdayCell.getByRole("article").filter({ hasText: "토요일 5시 클리닉" });
  await sourceSession.getByRole("button", { name: "토요일 5시 클리닉 설정 복사" }).click();

  const createDialog = page.getByRole("dialog", { name: "클리닉 설정 복사" });
  const parentModalHost = page.locator(".ant-modal").filter({ hasText: "클리닉 설정 복사" });
  const parentModalContent = parentModalHost.locator(".admin-modal__inner");
  const createButton = createDialog.getByRole("button", { name: /클리닉 만들기/ });
  await expect(createDialog).toBeVisible({ timeout: 60_000 });
  await expect(parentModalHost).not.toHaveClass(/ant-zoom-appear/);
  await expect(createButton).toBeEnabled();
  const headerBox = await createDialog.locator(".modal-header").boundingBox();
  expect(headerBox).not.toBeNull();
  await page.mouse.move(headerBox!.x + headerBox!.width / 2, headerBox!.y + headerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBox!.x + headerBox!.width / 2 + 120, headerBox!.y + headerBox!.height / 2 + 60);
  await page.mouse.up();
  await createButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  const confirmation = page.getByRole("alertdialog", { name: "클리닉 일정 최종 확인" });
  await expect(confirmation).toContainText(`${saturdayLabel} (토요일)`);
  await expect(confirmation.getByText("토요일 5시 클리닉", { exact: true })).toBeVisible();
  await expect(confirmation).toContainText("17:00–18:30");
  await expect(confirmation).toContainText("2층 보강실");
  await expect(confirmation.getByText("12명", { exact: true })).toBeVisible();
  await expect(confirmation.getByText("고2 물리 심화, 고2 화학 심화", { exact: true })).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "다시 확인" })).toBeVisible();
  const backdropBox = await page.locator("[data-confirm-dialog]").boundingBox();
  expect(backdropBox).not.toBeNull();
  expect(backdropBox!.x).toBeLessThanOrEqual(1);
  expect(backdropBox!.y).toBeLessThanOrEqual(1);
  expect(backdropBox!.width).toBeGreaterThanOrEqual(1365);
  expect(backdropBox!.height).toBeGreaterThanOrEqual(849);
  await expect(page.getByRole("alertdialog", { name: "클리닉 일정 최종 확인" })).toHaveCount(1);
  await expect(parentModalHost).toHaveAttribute("inert", "");
  await expect(parentModalHost).toHaveAttribute("aria-hidden", "true");
  await expect(parentModalContent).toHaveAttribute("inert", "");
  await expect(parentModalContent).toHaveAttribute("aria-hidden", "true");
  expect(state.createPayloads).toHaveLength(0);

  const outsideHit = await page.evaluate(() => {
    const element = document.elementFromPoint(2, 2) as HTMLElement | null;
    return {
      className: element?.className ?? null,
      insideConfirmation: Boolean(element?.closest("[data-confirm-dialog]")),
    };
  });
  expect(outsideHit).toMatchObject({ insideConfirmation: true });
  await page.mouse.click(2, 2);
  await expect(confirmation).toBeVisible();
  expect(state.createPayloads).toHaveLength(0);
  await confirmation.getByRole("button", { name: "다시 확인" }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(parentModalHost).not.toHaveAttribute("inert", "");
  await expect(parentModalHost).not.toHaveAttribute("aria-hidden", "true");
  await expect(parentModalContent).not.toHaveAttribute("inert", "");
  await expect(parentModalContent).not.toHaveAttribute("aria-hidden", "true");
  await expect(createDialog).toBeVisible({ timeout: 60_000 });
  expect(state.createPayloads).toHaveLength(0);

  await createButton.click();
  await page.getByRole("alertdialog", { name: "클리닉 일정 최종 확인" })
    .getByRole("button", { name: "확인하고 만들기" })
    .click();

  await expect.poll(() => state.createPayloads).toHaveLength(1);
  await expect(createButton).toBeDisabled();
  await expect(createDialog.getByRole("button", { name: "대화상자 종료" })).toHaveCount(0);
  expect(state.createPayloads[0]).toMatchObject({
    date: saturday,
    start_time: "17:00:00",
    duration_minutes: 90,
    location: "2층 보강실",
    max_participants: 12,
  });
  releaseCreate();
  await expect(createDialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("빈 클리닉도 일정 카드에서 수정하고 최종 확인한 뒤에만 저장한다", async ({ page }) => {
  let releaseUpdate = () => {};
  const updateGate = new Promise<void>((resolve) => { releaseUpdate = resolve; });
  const state: ScheduleState = { createPayloads: [], updatePayloads: [], updateGate };
  await seed(page);
  await installApi(page, undefined, undefined, state);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });

  const saturdayCell = page.getByRole("gridcell", { name: `${saturdayLabel} 토요일`, exact: true });
  await saturdayCell.getByRole("button", { name: "토요일 5시 클리닉 17:00 일정 수정" }).click();

  const editDialog = page.getByRole("dialog", { name: "클리닉 일정 수정" });
  await expect(editDialog.getByRole("heading", { name: "클리닉 일정 수정" })).toBeVisible();
  await editDialog.getByRole("button", { name: "−1시간" }).click();
  const editButton = editDialog.getByRole("button", { name: "클리닉 수정", exact: true });
  await editButton.click();

  const confirmation = page.getByRole("alertdialog", { name: "클리닉 일정 수정 확인" });
  await expect(confirmation).toContainText(`${saturday} · 17:00–18:30 · 2층 보강실`);
  await expect(confirmation).toContainText(`${saturday} · 17:00–17:30 · 2층 보강실`);
  expect(state.updatePayloads).toHaveLength(0);

  await confirmation.getByRole("button", { name: "다시 확인" }).click();
  await expect(confirmation).toHaveCount(0);
  expect(state.updatePayloads).toHaveLength(0);

  await editDialog.getByRole("button", { name: "클리닉 수정", exact: true }).click();
  await page.getByRole("alertdialog", { name: "클리닉 일정 수정 확인" })
    .getByRole("button", { name: "확인하고 수정" })
    .click();

  await expect.poll(() => state.updatePayloads).toHaveLength(1);
  await expect(editButton).toBeDisabled();
  await expect(editDialog.getByRole("button", { name: "대화상자 종료" })).toHaveCount(0);
  expect(state.updatePayloads[0]).toMatchObject({
    id: 702,
    payload: {
      date: saturday,
      start_time: "17:00:00",
      duration_minutes: 30,
      location: "2층 보강실",
      max_participants: 12,
    },
  });
  releaseUpdate();
  await expect(editDialog).toHaveCount(0);
  await expect(saturdayCell.getByRole("article").filter({ hasText: "토요일 5시 클리닉" }))
    .toContainText("17:00–17:30");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("예약자가 있는 일정 수정은 운영 화면의 수정 알림으로 인계한다", async ({ page }) => {
  const state: ScheduleState = {
    createPayloads: [],
    updatePayloads: [],
    sessions: sessions.map((session) => session.id === 702
      ? { ...session, participant_count: 1, booked_count: 1 }
      : { ...session }),
  };
  const operationsState: OperationsState = {
    participants: [{
      id: 802,
      session: 702,
      student: 502,
      student_name: "예약 학생",
      enrollment_id: 1002,
      session_date: saturday,
      session_title: "토요일 5시 클리닉",
      session_start_time: "17:00:00",
      session_end_time: "18:30:00",
      session_location: "2층 보강실",
      status: "booked",
      checked_in_at: null,
      checked_out_at: null,
      completed_at: null,
      is_late: false,
    }],
    targets: [],
  };
  await seed(page);
  await installApi(page, undefined, operationsState, state);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/schedule`, { timeout: 45_000 });

  const saturdayCell = page.getByRole("gridcell", { name: `${saturdayLabel} 토요일`, exact: true });
  await saturdayCell.getByRole("button", { name: "토요일 5시 클리닉 17:00 일정 수정" }).click();
  const editDialog = page.getByRole("dialog", { name: "클리닉 일정 수정" });
  await editDialog.getByRole("button", { name: "−1시간" }).click();
  await editDialog.getByRole("button", { name: "클리닉 수정", exact: true }).click();
  await page.getByRole("alertdialog", { name: "클리닉 일정 수정 확인" })
    .getByRole("button", { name: "확인하고 수정" })
    .click();

  await expect(page).toHaveURL(new RegExp(`/workspace/clinic/operations\\?date=${saturday}&session=702$`));
  const changeAlert = page.locator(".clinic-ops__change-alert");
  await expect(changeAlert).toContainText(`${saturday} 17:00-18:30 2층 보강실`);
  await expect(changeAlert).toContainText(`${saturday} 17:00-17:30 2층 보강실`);
  const noticePreviewButton = page.getByRole("button", { name: "미리보기 열기" });
  await expect(noticePreviewButton).toBeVisible();
  await noticePreviewButton.click();
  await expect(page.getByRole("dialog", { name: "클리닉 변경 알림" })).toBeVisible();
  expect(state.updatePayloads).toHaveLength(1);
});

test("현장 콘솔은 16·17·18시 등원 학생을 한 화면에서 시간대 이동 없이 처리한다", async ({ page }) => {
  const onsiteParticipants: Array<Record<string, unknown>> = [
    {
      id: 821, session: 704, student: 521, student_name: "네시 현장학생",
      enrollment_id: 1021, session_date: today, session_title: "4시 클리닉",
      session_start_time: "16:00:00", session_end_time: "17:30:00",
      session_location: "1층 세미나실", status: "attended",
      checked_in_at: `${today}T16:03:00+09:00`, checked_out_at: null,
      completed_at: `${today}T16:40:00+09:00`, is_late: false,
    },
    {
      id: 822, session: 705, student: 522, student_name: "다섯시 현장학생",
      enrollment_id: 1022, session_date: today, session_title: "5시 클리닉",
      session_start_time: "17:00:00", session_end_time: "18:30:00",
      session_location: "2층 보강실", status: "attended",
      checked_in_at: `${today}T17:02:00+09:00`, checked_out_at: null,
      completed_at: null, is_late: true,
    },
    {
      id: 823, session: 706, student: 523, student_name: "여섯시 현장학생",
      enrollment_id: 1023, session_date: today, session_title: "6시 클리닉",
      session_start_time: "18:00:00", session_end_time: "19:30:00",
      session_location: "3층 자습실", status: "attended",
      checked_in_at: `${today}T18:01:00+09:00`, checked_out_at: null,
      completed_at: null, is_late: false,
    },
    {
      id: 824, session: 706, student: 522, student_name: "다섯시 현장학생",
      enrollment_id: 1022, session_date: today, session_title: "6시 클리닉",
      session_start_time: "18:00:00", session_end_time: "19:30:00",
      session_location: "3층 집중석", status: "attended",
      checked_in_at: `${today}T18:04:00+09:00`, checked_out_at: null,
      completed_at: null, is_late: false,
    },
  ];
  const state: OperationsState = {
    participants: onsiteParticipants,
    participantPages: [onsiteParticipants.slice(0, 2), onsiteParticipants.slice(2)],
    participantRequestQueries: [],
    targets: [
      {
        enrollment_id: 1022, student_id: 522, student_name: "다섯시 현장학생",
        source_title: "부교재 화학평형", session_title: "화학특강 5차시", reason: "score", clinic_reason: "exam",
        exam_score: 42, cutline_score: 60, clinic_link_id: 9022,
        source_type: "exam", max_score: 100, created_at: `${today}T08:00:00Z`,
      },
      {
        enrollment_id: 1022, student_id: 522, student_name: "다섯시 현장학생",
        source_title: "부교재 가역반응", session_title: "화학특강 4차시", reason: "score", clinic_reason: "homework",
        homework_score: 40, homework_cutline: 80, clinic_link_id: 9023,
        source_type: "homework", max_score: 100, created_at: `${today}T07:00:00Z`,
      },
    ],
    checkoutPayloads: [],
    planPayloads: [],
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/operations`, { timeout: 45_000 });

  const scopeRail = page.getByRole("group", { name: "클리닉 운영 범위" });
  await expect(scopeRail.getByRole("button", { name: "현장 3명", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(scopeRail.getByRole("button", { name: "오늘 전체", exact: true })).toBeVisible();
  await expect.poll(() => state.participantRequestQueries?.some((query) => query.includes("page=2"))).toBe(true);

  const queue = page.locator(".clinic-ops__queue");
  await expect(queue.locator(".clinic-ops__card")).toHaveCount(3);
  await expect(queue.locator(".clinic-ops__card-name")).toHaveText([
    /네시 현장학생/,
    /다섯시 현장학생/,
    /여섯시 현장학생/,
  ]);
  await expect(queue.getByText("다섯시 현장학생", { exact: true })).toHaveCount(1);
  await expect(queue).toContainText("16:00 · 1층 세미나실");
  await expect(queue).toContainText("17:00 · 2층 보강실");
  await expect(queue).toContainText("18:00 · 3층 자습실");
  await expect(queue).toContainText("18:00 · 3층 집중석");
  await expect(page.getByRole("button", { name: "학생 추가", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /전체 출석 체크/ })).toHaveCount(0);
  const scheduleTrigger = page.getByRole("button", { name: "일정 오늘 현장", exact: true });
  const queueBeforeOverlay = await queue.boundingBox();
  await scheduleTrigger.click();
  const scheduleOverlay = page.getByRole("dialog", { name: "날짜·수업 선택" });
  await expect(scheduleOverlay).toBeVisible();
  await expect(scheduleOverlay).toContainText("클리닉 수업");
  await page.screenshot({ path: "test-results/admin-clinic-schedule-overlay-1366.png", fullPage: false });
  const queueUnderOverlay = await queue.boundingBox();
  expect(queueUnderOverlay?.x).toBe(queueBeforeOverlay?.x);
  expect(queueUnderOverlay?.width).toBe(queueBeforeOverlay?.width);
  await page.keyboard.press("Escape");
  await expect(scheduleTrigger).toBeFocused();
  await page.screenshot({ path: "test-results/admin-clinic-onsite-multisession-1366.png", fullPage: false });

  const timeRail = page.getByRole("group", { name: "시간대 필터" });
  await timeRail.getByRole("button", { name: "17:00 1명", exact: true }).click();
  await expect(queue.locator(".clinic-ops__card")).toHaveCount(1);
  await expect(queue).toContainText("다섯시 현장학생");
  await timeRail.getByRole("button", { name: "전체 시간 3명", exact: true }).click();
  await expect(queue.locator(".clinic-ops__card")).toHaveCount(3);
  const duplicateStudentRow = queue.getByRole("group", { name: "다섯시 현장학생 클리닉 운영 행" });
  await expect(duplicateStudentRow.getByRole("button", { name: "하원", exact: true })).toHaveCount(0);

  const originalUrl = page.url();
  const taskButton = queue.getByRole("button", { name: /다섯시 현장학생.*부교재 화학평형/ });
  await taskButton.click();
  const exactContextWorkbench = page.getByRole("dialog", { name: "다섯시 현장학생 클리닉 워크벤치" });
  await expect(exactContextWorkbench).toContainText("처리할 시간대를 먼저 선택하세요");
  const lockedPlanToggle = exactContextWorkbench.getByRole("button", { name: "시간대 선택 필요" });
  await expect(lockedPlanToggle).toBeDisabled();
  await expect(lockedPlanToggle).toHaveAttribute("aria-pressed", "false");
  await expect(exactContextWorkbench.getByText("오늘 할 일로 선택됨", { exact: true })).toHaveCount(0);
  expect(state.planPayloads).toEqual([]);
  await exactContextWorkbench.getByRole("button", { name: /18:00.*3층 집중석/ }).click();
  await expect(exactContextWorkbench).toContainText("18:00 · 3층 집중석");
  const planToggle = exactContextWorkbench.locator(".clinic-workbench__plan-toggle");
  await exactContextWorkbench.getByRole("button", { name: "오늘 할 일에 추가" }).click();
  await expect.poll(() => state.planPayloads).toEqual([
    { id: 824, planned_clinic_link_ids: [9022] },
  ]);
  expect(state.planPayloads?.some((payload) => payload.id === 822)).toBe(false);
  await expect(planToggle).toBeFocused();
  await expect(exactContextWorkbench.locator(".clinic-workbench__active-panel")).toContainText("부교재 화학평형");
  await exactContextWorkbench.getByRole("button", { name: "하원 처리", exact: true }).click();
  await page.getByRole("dialog", { name: "하원 처리" }).getByLabel("학부모").check();
  await page.keyboard.press("Enter");
  await expect.poll(() => state.checkoutPayloads?.[0]).toEqual({ id: 824, send_to: "parent" });
  await expect(queue.getByText("다섯시 현장학생", { exact: true })).toHaveCount(1);

  await taskButton.click();
  const workbench = page.getByRole("dialog", { name: "다섯시 현장학생 클리닉 워크벤치" });
  await expect(workbench).toContainText("17:00 · 2층 보강실");
  expect(page.url()).toBe(originalUrl);
  await page.keyboard.press("Escape");
  await expect(taskButton).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(scopeRail.getByRole("button", { name: "현장 3명", exact: true })).toBeVisible();
  await expect(timeRail.getByRole("button", { name: "16:00 1명", exact: true })).toBeVisible();
  await expect(queue.locator(".clinic-ops__card")).toHaveCount(3);
  expect(
    await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: "test-results/admin-clinic-onsite-multisession-390.png", fullPage: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await scheduleTrigger.click();
  await expect(scheduleOverlay).toBeVisible();
  expect(await scheduleOverlay.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  expect(await scheduleOverlay.evaluate((element) => element.getBoundingClientRect().width)).toBe(390);
  await page.screenshot({ path: "test-results/admin-clinic-schedule-overlay-390.png", fullPage: false });
  await page.keyboard.press("Escape");
  await expect(scheduleTrigger).toBeFocused();
  await queue.getByRole("button", { name: /다섯시 현장학생.*화학특강 5차시/ }).click();
  await expect(workbench).toBeVisible();
  expect(await workbench.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 1366, height: 850 });
  const fourOClockCard = queue.locator(".clinic-ops__card").filter({ hasText: "네시 현장학생" });
  await fourOClockCard.getByRole("button", { name: "하원", exact: true }).click();
  await page.getByRole("dialog", { name: "하원 처리" }).getByLabel("학부모").check();
  await page.keyboard.press("Enter");
  await expect.poll(() => state.checkoutPayloads?.[1]).toEqual({ id: 821, send_to: "parent" });
  await expect(fourOClockCard).toHaveCount(0);
  await expect(scopeRail.getByRole("button", { name: "현장 2명", exact: true })).toBeVisible();
});

test("현장 참가자 pagination loop는 0명으로 숨기지 않고 fail-closed 한다", async ({ page }) => {
  const first = {
    id: 831, session: 704, student: 531, student_name: "루프 첫 학생",
    session_date: today, session_start_time: "16:00:00", session_location: "1층",
    status: "attended", checked_in_at: `${today}T16:01:00+09:00`, checked_out_at: null,
  };
  const second = {
    id: 832, session: 705, student: 532, student_name: "루프 둘째 학생",
    session_date: today, session_start_time: "17:00:00", session_location: "2층",
    status: "attended", checked_in_at: `${today}T17:01:00+09:00`, checked_out_at: null,
  };
  const state: OperationsState = {
    participants: [first, second],
    participantPages: [[first], [second]],
    participantNextByPage: {
      2: `${BASE}/api/v1/clinic/participants/?onsite_date=${today}&page=2`,
    },
    targets: [],
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/operations`, { timeout: 45_000 });

  await expect(page.getByRole("alert")).toContainText("현재 등원중인 학생을 불러오지 못했습니다.");
  await expect(page.getByRole("button", { name: "현장 0명", exact: true })).toHaveCount(0);
  await expect(page.getByText("현장 0명", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toBeVisible();
});

test("현장 참가자 중복 ID는 일부 명단을 노출하지 않고 fail-closed 한다", async ({ page }) => {
  const duplicate = {
    id: 841, session: 704, student: 541, student_name: "중복 학생",
    session_date: today, session_start_time: "16:00:00", session_location: "1층",
    status: "attended", checked_in_at: `${today}T16:01:00+09:00`, checked_out_at: null,
  };
  const state: OperationsState = {
    participants: [duplicate],
    participantPages: [[duplicate], [duplicate]],
    targets: [],
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/operations`, { timeout: 45_000 });

  await expect(page.getByRole("alert")).toContainText("현재 등원중인 학생을 불러오지 못했습니다.");
  await expect(page.getByText("중복 학생", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "현장 0명", exact: true })).toHaveCount(0);
});

test("오늘 전체 참가자 page의 next 누락은 일부 명단을 노출하지 않고 fail-closed 한다", async ({ page }) => {
  const state: OperationsState = {
    participants: [
      {
        id: 844, session: 704, student: 544, student_name: "다음 페이지 누락 학생",
        session_date: today, session_start_time: "16:00:00", session_location: "1층",
        status: "booked", checked_in_at: null, checked_out_at: null,
      },
    ],
    targets: [],
    omitParticipantNext: true,
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/operations?scope=day&date=${today}`, { timeout: 45_000 });

  await expect(page.getByRole("alert")).toContainText("클리닉 학생 목록을 불러오지 못했습니다.", {
    timeout: 60_000,
  });
  await expect(page.getByText("다음 페이지 누락 학생", { exact: true })).toHaveCount(0);
  await expect(page.getByText("학생 0명", { exact: true })).toHaveCount(0);
});

test("현장 응답의 권위 상태가 어긋나면 빈 현장으로 오인하지 않는다", async ({ page }) => {
  const state: OperationsState = {
    returnUnsafeOnsiteRows: true,
    participants: [
      {
        id: 845, session: 704, student: 545, student_name: "체크인 누락 학생",
        session_date: today, session_start_time: "16:00:00", session_location: "1층",
        status: "attended", checked_in_at: null, checked_out_at: null,
      },
    ],
    targets: [],
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/operations`, { timeout: 45_000 });

  await expect(page.getByRole("alert")).toContainText("현재 등원중인 학생을 불러오지 못했습니다.");
  await expect(page.getByText("체크인 누락 학생", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "현장 0명", exact: true })).toHaveCount(0);
});

test("현장 조회 취소 뒤 오늘 전체 응답이 지연된 현장 명단으로 덮이지 않는다", async ({ page }) => {
  let releaseOnsite!: () => void;
  const onsiteGate = new Promise<void>((resolve) => {
    releaseOnsite = resolve;
  });
  const state: OperationsState = {
    onsiteParticipantsGate: onsiteGate,
    participants: [
      {
        id: 851, session: 704, student: 551, student_name: "현재 현장 학생",
        session_date: today, session_start_time: "16:00:00", session_location: "1층",
        status: "attended", checked_in_at: `${today}T16:01:00+09:00`, checked_out_at: null,
      },
      {
        id: 852, session: 705, student: 552, student_name: "오늘 예약 학생",
        session_date: today, session_start_time: "17:00:00", session_location: "2층",
        status: "booked", checked_in_at: null, checked_out_at: null,
      },
    ],
    targets: [],
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/workspace/clinic/operations`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".clinic-ops__loading")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "오늘 전체", exact: true }).click();
  await expect(page.getByText("현재 현장 학생", { exact: true })).toBeVisible();
  await expect(page.getByText("오늘 예약 학생", { exact: true })).toBeVisible();
  releaseOnsite();
  await expect(page.getByRole("button", { name: "오늘 전체 2명", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.locator(".clinic-ops__card").count()).toBe(2);
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
        planned_clinic_link_ids: [9002],
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
      {
        enrollment_id: 1001,
        student_id: studentId,
        student_name: "김다과목",
        session_title: "화학특강 8차시",
        lecture_title: "화학특강",
        reason: "score",
        clinic_reason: "homework",
        homework_score: null,
        clinic_link_id: 9003,
        session_id: 703,
        source_type: "homework",
        source_id: 3003,
        source_title: "8주차 산화수 확인 과제",
        created_at: "2026-08-22T04:10:00Z",
      },
      {
        enrollment_id: 1002,
        student_id: 502,
        student_name: "지각 학생",
        session_title: "화학특강 8차시",
        lecture_title: "화학특강",
        reason: "missing",
        meta_status: "NOT_SUBMITTED",
        clinic_reason: "exam",
        clinic_link_id: null,
        session_id: 703,
        source_type: "exam",
        source_id: 4004,
        exam_id: 4004,
        source_title: "8주차 산화수 확인 시험",
        created_at: "2026-08-22T04:12:00Z",
      },
    ],
    statusPayloads: [],
    checkoutPayloads: [],
    reminderPayloads: [],
    bookingPayloads: [],
    planPayloads: [],
    resolutionPayloads: [],
    waiverPayloads: [],
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
  await expect(studentCard.locator(".clinic-ops__task-chip")).toHaveCount(3);
  await expect(studentCard.locator(".clinic-ops__task-kind")).toHaveText(["과제", "과제", "시험"]);
  const taskCardBoxes = await studentCard.locator(".clinic-ops__task-chip").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(taskCardBoxes.every((box) => box.width >= 132 && box.height >= 40)).toBe(true);
  expect((await studentCard.boundingBox())?.height ?? Infinity).toBeLessThanOrEqual(96);
  await expect(studentCard.getByRole("spinbutton")).toHaveCount(0);
  await expect(studentCard).toContainText("오늘 1 / 미완료 3");
  await expect(studentCard).toContainText("6주차 확인 시험");
  await expect(studentCard).toContainText("7주차 오답 과제");
  await expect(studentCard).toContainText("8주차 산화수 확인 과제");
  await studentCard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/admin-clinic-operations-queue-1366.png", fullPage: false });
  const newestTarget = studentCard.getByText("8주차 산화수 확인 과제", { exact: true });
  const olderTarget = studentCard.getByText("6주차 확인 시험", { exact: true });
  expect((await newestTarget.boundingBox())?.x ?? Infinity).toBeLessThan(
    (await olderTarget.boundingBox())?.x ?? 0,
  );

  const originalUrl = page.url();
  const olderTargetButton = studentCard.getByRole("button", { name: /김다과목.*6주차 확인 시험/ });
  await olderTargetButton.click();
  const workbench = page.getByRole("dialog", { name: "김다과목 클리닉 워크벤치" });
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole("heading", { name: "김다과목 작업대" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await workbench.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect(workbench.locator(".clinic-workbench__item-switcher")).toHaveCSS("min-height", "45px");
  await expect(workbench.getByRole("tab", { name: /6주차 확인 시험/ })).toBeVisible();
  await expect(workbench.locator(".clinic-workbench__active-panel")).toContainText("6주차 확인 시험");
  await expect(workbench.locator(".clinic-workbench__active-panel")).not.toContainText("7주차 오답 과제");
  expect(page.url()).toBe(originalUrl);
  await page.screenshot({ path: "test-results/admin-clinic-operations-workbench-1366.png", fullPage: false });

  await workbench.getByRole("button", { name: "오늘 할 일에 추가" }).click();
  await expect.poll(() => state.planPayloads?.[0]).toEqual({
    id: 801,
    planned_clinic_link_ids: [9001, 9002],
  });
  await expect(workbench).toContainText("오늘 할 일 2 / 전체 미완료 3");

  state.rejectNextPlan = true;
  await workbench.getByRole("button", { name: "오늘 할 일에서 빼기" }).click();
  await expect.poll(() => state.planPayloads?.[1]).toEqual({
    id: 801,
    planned_clinic_link_ids: [9002],
  });
  await expect(workbench).toContainText("오늘 할 일 2 / 전체 미완료 3");
  await expect(workbench.getByRole("button", { name: "오늘 할 일에서 빼기" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(workbench).toHaveCount(0);
  await expect(olderTargetButton).toBeFocused();

  const submittedHomeworkButton = studentCard.getByRole("button", { name: /김다과목.*8주차 산화수 확인 과제/ });
  await submittedHomeworkButton.click();
  await expect(workbench.locator(".clinic-workbench__active-panel")).toContainText("8주차 산화수 확인 과제");
  await expect(workbench.locator(".clinic-workbench__active-panel")).toContainText("화학특강 8차시");
  await workbench.getByRole("button", { name: "제출 확인·완료", exact: true }).click();
  const completionDialog = page.getByRole("dialog", { name: "과제 제출 확인·완료" });
  await completionDialog.getByPlaceholder(/문자 제출/).fill("문자로 제출 확인");
  await completionDialog.getByRole("button", { name: "제출 확인하고 완료", exact: true }).click();
  await expect.poll(() => state.resolutionPayloads?.[0]).toEqual({
    enrollment_id: 1001,
    source_type: "homework",
    source_id: 3003,
    completed: true,
    note: "문자로 제출 확인",
  });
  await expect(studentCard.locator(".clinic-ops__task-chip")).toHaveCount(2);
  await expect(studentCard).not.toContainText("8주차 산화수 확인 과제");
  await page.keyboard.press("Escape");

  const missingExamCard = page.locator(".clinic-ops__card").filter({ hasText: "지각 학생" });
  await missingExamCard.getByRole("button", { name: /지각 학생.*8주차 산화수 확인 시험/ }).click();
  const examWorkbench = page.getByRole("dialog", { name: "지각 학생 클리닉 워크벤치" });
  await expect(examWorkbench.locator(".clinic-workbench__active-panel")).toContainText("8주차 산화수 확인 시험");
  await expect(examWorkbench.getByRole("button", { name: "수동 통과" })).toHaveCount(0);
  await expect(examWorkbench.getByRole("button", { name: "제출 확인·완료", exact: true })).toHaveCount(0);
  await expect(examWorkbench.getByRole("spinbutton")).toHaveCount(0);
  await expect(examWorkbench.getByRole("button", { name: "면제" })).toBeVisible();
  await expect(examWorkbench.getByRole("button", { name: "다음 차수 이월" })).toHaveCount(0);
  await examWorkbench.getByRole("button", { name: "면제" }).click();
  const examWaiverDialog = page.getByRole("dialog", { name: "시험 미응시 면제" });
  await examWaiverDialog.getByPlaceholder(/이전 수업 결석/).fill("결석 확인 면제");
  await examWaiverDialog.getByRole("button", { name: "사유 남기고 면제" }).click();
  await expect.poll(() => state.waiverPayloads).toEqual([{
    session_id: 703,
    enrollment_id: 1002,
    exam_id: 4004,
    memo: "결석 확인 면제",
  }]);
  await expect.poll(() => state.targetRequests ?? 0).toBeGreaterThan(1);
  await expect.poll(() => state.participantRequests ?? 0).toBeGreaterThan(1);
  await expect(examWorkbench.getByText("자율 학습 참여", { exact: true })).toBeVisible();
  await expect(examWorkbench.getByRole("button", { name: "면제" })).toHaveCount(0);
  await page.keyboard.press("Escape");

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
  await page.reload();
  await expect(page.getByRole("button", { name: /^일정 / })).toBeVisible();
  await expect(page.locator(".clinic-scheduler-panel__mini-cal--sidebar")).toHaveCount(0);
  await studentCard.scrollIntoViewIfNeeded();
  await expect(studentCard.locator(".clinic-ops__task-chip")).toHaveCount(2);
  await expect(studentCard).toContainText("오늘 2 / 미완료 2");
  expect((await studentCard.boundingBox())?.height ?? Infinity).toBeLessThanOrEqual(124);
  await expect(studentCard).toContainText("6주차 확인 시험");
  await expect(studentCard).toContainText("7주차 오답 과제");
  const clinicTabs = page.locator(".clinic-domain-layout .domain-header__tabs-wrap .ds-tab");
  const tabBoxes = await clinicTabs.evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().top));
  expect(Math.max(...tabBoxes) - Math.min(...tabBoxes)).toBeLessThan(2);
  expect(
    await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: "test-results/admin-clinic-operations-queue-390.png", fullPage: false });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const mobileTargetButton = studentCard.getByRole("button", { name: /김다과목.*6주차 확인 시험/ });
  await mobileTargetButton.click();
  await expect(workbench).toBeVisible();
  expect(await workbench.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.screenshot({ path: "test-results/admin-clinic-operations-workbench-390.png", fullPage: false });
});

test("클리닉 상태 저장과 알림톡 요청의 부분 실패를 성공으로 숨기지 않는다", async ({ page }) => {
  const state: OperationsState = {
    participants: [{
      id: 901,
      session: 701,
      student: 601,
      student_name: "하원 알림 실패",
      enrollment_id: 1101,
      session_date: saturday,
      session_title: "토요일 1시 클리닉",
      session_start_time: "13:00:00",
      session_location: "1층 세미나실",
      status: "attended",
      checked_in_at: `${saturday}T13:00:00+09:00`,
      checked_out_at: null,
      completed_at: null,
    }, {
      id: 902,
      session: 701,
      student: 602,
      student_name: "완료 알림 실패",
      enrollment_id: 1102,
      session_date: saturday,
      session_title: "토요일 1시 클리닉",
      session_start_time: "13:00:00",
      session_location: "1층 세미나실",
      status: "attended",
      checked_in_at: `${saturday}T13:05:00+09:00`,
      checked_out_at: null,
      completed_at: null,
    }, {
      id: 903,
      session: 701,
      student: 603,
      student_name: "재촉 부분 성공",
      enrollment_id: 1103,
      session_date: saturday,
      session_title: "토요일 1시 클리닉",
      session_start_time: "13:00:00",
      session_location: "1층 세미나실",
      status: "booked",
      checked_in_at: null,
      checked_out_at: null,
      completed_at: null,
    }, {
      id: 904,
      session: 701,
      student: 604,
      student_name: "상태 저장 실패",
      enrollment_id: 1104,
      session_date: saturday,
      session_title: "토요일 1시 클리닉",
      session_start_time: "13:00:00",
      session_location: "1층 세미나실",
      status: "booked",
      checked_in_at: null,
      checked_out_at: null,
      completed_at: null,
    }],
    targets: [],
    statusPayloads: [],
    checkoutPayloads: [],
    reminderPayloads: [],
    completionPayloads: [],
    statusNotifications: {
      903: { requested: 0, failed: 1, send_to: "parent" },
    },
    statusFailures: [904],
    checkoutNotification: { requested: 0, failed: 1, send_to: "parent" },
    completeNotification: { requested: 0, failed: 1, send_to: "parent" },
    reminderResponses: [{
      status: 503,
      body: { status: "failed", sent: 0, scheduled: 0, skipped: 1, detail: "승인된 재촉 양식이 없습니다." },
    }, {
      body: { ok: true, status: "ok", sent: 1, scheduled: 0, skipped: 1 },
    }],
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(
    page,
    `${BASE}/workspace/clinic/operations?date=${saturday}&session=701`,
    { timeout: 45_000 },
  );

  const checkoutCard = page.locator(".clinic-ops__card").filter({ hasText: "하원 알림 실패" });
  await checkoutCard.getByRole("button", { name: "하원", exact: true }).click();
  await page.getByRole("dialog", { name: "하원 처리" }).getByLabel("학부모").check();
  await page.keyboard.press("Enter");
  await expect.poll(() => state.checkoutPayloads).toEqual([{ id: 901, send_to: "parent" }]);
  await expect(page.getByText(/하원 처리 완료 상태는 저장됐지만 알림톡 요청 0건 완료, 1건 실패/)).toBeVisible();

  const reminderCard = page.locator(".clinic-ops__card").filter({ hasText: "재촉 부분 성공" });
  await reminderCard.getByRole("button", { name: "재촉", exact: true }).click();
  const reminderDialog = page.getByRole("dialog", { name: "등원 재촉" });
  await reminderDialog.getByRole("button", { name: "재촉 발송" }).click();
  await expect(page.getByText("승인된 재촉 양식이 없습니다.", { exact: true })).toBeVisible();
  await expect(reminderDialog).toBeVisible();
  await reminderDialog.getByRole("button", { name: "재촉 발송" }).click();
  await expect(reminderDialog).toHaveCount(0);
  await expect(page.getByText(/재촉 알림톡 요청 1건 완료, 1건 제외/)).toBeVisible();

  await page.getByRole("button", { name: "전체 출석 체크 (2명)", exact: true }).click();
  await page.getByRole("button", { name: "알림톡 요청 (2명)", exact: true }).click();
  await expect.poll(() => state.statusPayloads?.[0]).toMatchObject({ id: 903, status: "attended" });
  await expect(page.getByText(/1명 처리 완료, 1명 상태 저장 실패 · 알림톡 요청 0건 완료, 1건 실패/)).toBeVisible();
  await expect(page.getByText(/발송 완료/)).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const completeCard = page.locator(".clinic-ops__card").filter({ hasText: "완료 알림 실패" });
  await completeCard.click();
  const workbench = page.getByRole("dialog", { name: "완료 알림 실패 클리닉 워크벤치" });
  await workbench.getByRole("button", { name: "세션 처리 완료", exact: true }).click();
  await expect.poll(() => state.completionPayloads).toEqual([902]);
  await expect(page.getByText(/세션 처리 완료 상태는 저장됐지만 알림톡 요청 0건 완료, 1건 실패/)).toBeVisible();
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("클리닉 운영은 참가자 로딩 중 0명을 확정값처럼 표시하지 않는다", async ({ page }) => {
  let releaseParticipants!: () => void;
  const participantsGate = new Promise<void>((resolve) => {
    releaseParticipants = resolve;
  });
  const state: OperationsState = {
    participantsGate,
    participants: [{
      id: 811,
      session: 701,
      student: 511,
      student_name: "로딩 확인 학생",
      enrollment_id: 1011,
      session_date: saturday,
      status: "booked",
      checked_in_at: null,
      checked_out_at: null,
      completed_at: null,
    }],
    targets: [],
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto(`${BASE}/workspace/clinic/operations?date=${saturday}&session=701`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator(".clinic-ops__loading")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".clinic-ops__filters")).toHaveCount(0);
  await expect(page.getByText("전체 0", { exact: true })).toHaveCount(0);

  releaseParticipants();
  await expect(page.getByText("로딩 확인 학생", { exact: true })).toBeVisible({ timeout: 20_000 });
});

test("운영 화면에서 대상 조회 실패를 재시도하고 문자 제출 과제를 완료한다", async ({ page }) => {
  const studentId = 502;
  let releaseTargets: (() => void) | undefined;
  const targetGate = new Promise<void>((resolve) => {
    releaseTargets = resolve;
  });
  const state: OperationsState = {
    participants: [{
      id: 802,
      session: 701,
      student: studentId,
      student_name: "현장제출 학생",
      enrollment_id: 1003,
      session_date: saturday,
      session_title: "토요일 1시 클리닉",
      session_start_time: "13:00:00",
      session_end_time: "14:30:00",
      session_location: "1층 세미나실",
      status: "attended",
      lecture_title: "중1 수학",
      clinic_reason: "homework",
    }, {
      id: 803,
      session: 701,
      student: 503,
      student_name: "식별자누락 학생",
      enrollment_id: 1004,
      session_date: saturday,
      session_title: "토요일 1시 클리닉",
      session_start_time: "13:00:00",
      session_end_time: "14:30:00",
      session_location: "1층 세미나실",
      status: "attended",
      lecture_title: "중1 수학",
      clinic_reason: "homework",
    }],
    targets: [{
      enrollment_id: 1003,
      student_id: studentId,
      student_name: "현장제출 학생",
      session_title: "중1 수학 4차시",
      reason: "missing",
      clinic_reason: "homework",
      homework_score: null,
      homework_cutline: 8,
      clinic_link_id: 9003,
      session_id: 703,
      source_type: "homework",
      source_id: 803,
      source_title: "연산 숙제 12쪽",
      max_score: 10,
      created_at: "2026-08-23T15:30:00+09:00",
    }, {
      enrollment_id: 1004,
      student_id: 503,
      student_name: "식별자누락 학생",
      session_title: "중1 수학 4차시",
      reason: "missing",
      clinic_reason: "homework",
      homework_score: null,
      homework_cutline: 8,
      clinic_link_id: 9004,
      session_id: 703,
      source_type: "homework",
      source_id: 0,
      source_title: "식별자 없는 과제",
      max_score: 10,
      created_at: "2026-08-23T15:30:00+09:00",
    }],
    failTargets: true,
    targetGate,
    targetRequests: 0,
    participantRequests: 0,
    resolutionPayloads: [],
    persistHomeworkTargetReadbacks: 1,
  };

  await seed(page);
  await installApi(page, undefined, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto(`${BASE}/workspace/clinic/operations?date=${saturday}&session=701`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  const studentCard = page.locator(".clinic-ops__card").filter({ hasText: "현장제출 학생" });
  await expect(page.getByRole("status").filter({ hasText: "클리닉 과제 정보를 불러오는 중입니다" })).toBeVisible();
  await expect(page.getByText("자율 학습 참여", { exact: true })).toHaveCount(0);
  await studentCard.click();
  const drawer = page.getByRole("dialog", { name: "현장제출 학생 클리닉 워크벤치" });
  await expect(drawer.getByRole("status").filter({ hasText: "클리닉 과제 정보를 불러오는 중입니다" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "클리닉 과제 정보를 불러오는 중입니다" })).toHaveCount(2);
  await expect(drawer.getByText("자율 학습 참여", { exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "클리닉 완료", exact: true })).toHaveCount(0);
  releaseTargets?.();
  await expect(page.getByRole("alert").filter({ hasText: "클리닉 과제 정보를 불러오지 못했습니다" })).toHaveCount(2);
  await expect(page.getByText("자율 학습 참여", { exact: true })).toHaveCount(0);
  const drawerAlert = drawer.getByRole("alert").filter({ hasText: "클리닉 과제 정보를 불러오지 못했습니다" });
  await expect(drawerAlert).toBeVisible();
  await expect(drawer.getByText("자율 학습 참여", { exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "클리닉 완료", exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("alert").filter({ hasText: "클리닉 과제 정보를 불러오지 못했습니다" })).toBeVisible();
  await expect(studentCard.getByText("자율 학습 참여", { exact: true })).toHaveCount(0);
  await expect(studentCard.getByRole("button", { name: "클리닉 완료", exact: true })).toHaveCount(0);
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 1366, height: 850 });
  await studentCard.click();
  await expect(drawerAlert).toBeVisible();
  state.failTargets = false;
  await drawerAlert.getByRole("button", { name: "다시 시도", exact: true }).click();

  await expect(studentCard).toContainText("연산 숙제 12쪽");
  await expect(drawer).toContainText("중1 수학 4차시");
  const invalidCard = page.locator(".clinic-ops__card").filter({ hasText: "식별자누락 학생" });
  await expect(invalidCard).toContainText("식별자 없는 과제");
  await expect(invalidCard.getByRole("button", { name: "제출 확인·완료", exact: true })).toHaveCount(0);
  await drawer.getByRole("button", { name: "제출 확인·완료", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "과제 제출 확인·완료" });
  const submit = dialog.getByRole("button", { name: "제출 확인하고 완료", exact: true });
  await dialog.getByPlaceholder(/문자 제출/).fill("현");
  await expect(submit).toBeDisabled();
  await dialog.getByPlaceholder(/문자 제출/).fill("현장 제출 확인");
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText("완료 상태를 다시 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(drawer.getByRole("button", { name: "제출 확인·완료", exact: true })).toBeVisible();
  await submit.click();

  const expectedResolution = {
    enrollment_id: 1003,
    source_type: "homework",
    source_id: 803,
    completed: true,
    note: "현장 제출 확인",
  };
  await expect.poll(() => state.resolutionPayloads).toEqual([
    expectedResolution,
    expectedResolution,
  ]);
  await expect.poll(() => state.targetRequests ?? 0).toBeGreaterThan(1);
  await expect.poll(() => state.participantRequests ?? 0).toBeGreaterThan(1);
  await expect(studentCard.getByRole("button", { name: "제출 확인·완료", exact: true })).toHaveCount(0);
  await expect(studentCard).not.toContainText("과제 미통과");
  await expect(studentCard).toContainText("자율 학습 참여");
  await expect(drawer.getByRole("button", { name: "제출 확인·완료", exact: true })).toHaveCount(0);
  await expect(drawer).toContainText("자율 학습 참여");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(studentCard).not.toContainText("과제 미통과");
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
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
