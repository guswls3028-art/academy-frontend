import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function isLocalBase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function fakeJwt(tenantCode = "hakwonplus"): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: tenantCode,
    user_id: 771,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

function dateAfter(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function koreanDateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${year}년 ${month}월 ${day}일 ${weekdays[new Date(year, month - 1, day).getDay()]}요일`;
}

type MockState = {
  bookings: Array<Record<string, unknown>>;
  bookingPayloads: Array<Record<string, unknown>>;
  cancelledIds: number[];
  changePayloads: Array<Record<string, unknown>>;
};

type IdcardMockControl = {
  delayMs?: number;
  fail?: boolean;
};

type ProgramMockOptions = {
  tenantCode?: string;
  assessmentStatusDisplay?: "wrong_completion";
};

const bookingStatusLabels: Record<string, string> = {
  pending: "승인 대기",
  booked: "예약 확정",
  attended: "클리닉 진행 중",
  completed: "클리닉 진행 완료",
};

const bookedDate = dateAfter(2);
const openDate = dateAfter(5);
const sessions = [
  {
    id: 101,
    title: "대수 오답 클리닉",
    date: bookedDate,
    start_time: "15:00:00",
    end_time: "16:30:00",
    location: "2층 보강실",
    participant_count: 4,
    booked_count: 4,
    max_participants: 12,
    target_lecture_names: [{ id: 41, title: "대수 정규반", color: "#2563eb", chip_label: "대수" }],
  },
  {
    id: 102,
    title: "대수 마감 클리닉",
    date: bookedDate,
    start_time: "16:30:00",
    end_time: "17:30:00",
    location: "2층 보강실",
    participant_count: 8,
    booked_count: 8,
    max_participants: 8,
    target_lecture_names: [{ id: 41, title: "대수 정규반", color: "#2563eb", chip_label: "대수" }],
  },
  {
    id: 201,
    title: "토요일 1시 클리닉",
    date: openDate,
    start_time: "13:00:00",
    end_time: "14:30:00",
    location: "2층 보강실",
    participant_count: 3,
    booked_count: 3,
    max_participants: 10,
    allow_multi_slot_booking: true,
    target_lecture_names: [{ id: 77, title: "기하 정규반", color: "#7c3aed", chip_label: "기하" }],
  },
  {
    id: 202,
    title: "토요일 5시 클리닉",
    date: openDate,
    start_time: "17:00:00",
    end_time: "18:00:00",
    location: "1층 세미나실",
    participant_count: 6,
    booked_count: 6,
    max_participants: 10,
    allow_time_preference: true,
    allow_multi_slot_booking: true,
    target_lecture_names: [{ id: 41, title: "대수 정규반", color: "#2563eb", chip_label: "대수" }],
  },
  {
    id: 203,
    title: "토요일 6시 클리닉",
    date: openDate,
    start_time: "18:00:00",
    end_time: "19:00:00",
    location: "3층 자습실",
    participant_count: 1,
    booked_count: 1,
    max_participants: 8,
    allow_multi_slot_booking: true,
    target_lecture_names: [{ id: 78, title: "미적분 정규반", color: "#ea580c", chip_label: "미적" }],
  },
  {
    id: 204,
    title: "토요일 7시 클리닉",
    date: openDate,
    start_time: "19:00:00",
    end_time: "20:00:00",
    location: "3층 자습실",
    participant_count: 2,
    booked_count: 2,
    max_participants: 8,
    allow_multi_slot_booking: true,
    target_lecture_names: [{ id: 78, title: "미적분 정규반", color: "#ea580c", chip_label: "미적" }],
  },
  {
    id: 205,
    title: "토요일 8시 클리닉",
    date: openDate,
    start_time: "20:00:00",
    end_time: "21:00:00",
    location: "3층 자습실",
    participant_count: 0,
    booked_count: 0,
    max_participants: 8,
    allow_multi_slot_booking: false,
    target_lecture_names: [{ id: 78, title: "미적분 정규반", color: "#ea580c", chip_label: "미적" }],
  },
];

function createState(): MockState {
  return {
    bookings: [
      {
        id: 501,
        session: 101,
        session_title: "대수 오답 클리닉",
        session_date: bookedDate,
        session_start_time: "15:00:00",
        session_location: "2층 보강실",
        status: "pending",
        student_request_memo: "오답노트 지참",
        created_at: new Date().toISOString(),
      },
    ],
    bookingPayloads: [],
    cancelledIds: [],
    changePayloads: [],
  };
}

function validIdcardBookings(state: MockState) {
  const today = dateAfter(0);
  return state.bookings.flatMap((booking) => {
    const rawStatus = String(booking.status ?? "");
    const date = String(booking.session_date ?? "");
    const activeReservation = ["pending", "booked"].includes(rawStatus) && date >= today;
    const incompleteAttendance = rawStatus === "attended" && !booking.completed_at;
    if (!activeReservation && !incompleteAttendance) return [];
    const status = rawStatus;
    return [{
      participant_id: Number(booking.id),
      session_id: Number(booking.session),
      title: String(booking.session_title ?? ""),
      status,
      status_label: bookingStatusLabels[status],
      date,
      start_time: String(booking.session_start_time ?? ""),
      location: String(booking.session_location ?? ""),
    }];
  }).sort((left, right) => {
    const scheduleDifference = `${left.date} ${left.start_time}`.localeCompare(
      `${right.date} ${right.start_time}`,
    );
    if (scheduleDifference !== 0) return scheduleDifference;
    return left.participant_id - right.participant_id;
  });
}

async function seed(page: Page, programOptions: ProgramMockOptions = {}) {
  test.skip(!isLocalBase(BASE), "학생 클리닉 route-mock 검증은 로컬 dev 서버 전용");
  const tenantCode = programOptions.tenantCode ?? "hakwonplus";
  await page.addInitScript(({ token, tenant }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
    localStorage.setItem("tenant_code", tenant);
    sessionStorage.setItem("tenantCode", tenant);
  }, { token: fakeJwt(tenantCode), tenant: tenantCode });
}

async function installApi(
  page: Page,
  state: MockState,
  idcardResult: "SUCCESS" | "FAIL" = "FAIL",
  idcardControl?: IdcardMockControl,
  programOptions: ProgramMockOptions = {},
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
      const tenantCode = programOptions.tenantCode ?? "hakwonplus";
      return json({
        tenantCode,
        display_name: tenantCode === "ymath" ? "Ymath" : "학원플러스",
        ui_config: {},
        feature_flags: programOptions.assessmentStatusDisplay
          ? { assessment_status_display: programOptions.assessmentStatusDisplay }
          : {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 771,
        username: "student",
        name: "김학생",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        linkedStudentId: 991,
        linkedStudentName: "김학생",
        must_change_password: false,
      });
    }
    if (path === "/clinic/sessions/" && method === "GET") return json(sessions);
    if (path === "/clinic/participants/" && method === "GET") {
      return json({ count: state.bookings.length, results: state.bookings });
    }
    if (path === "/clinic/participants/bulk-create/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.bookingPayloads.push(payload);
      const selectedSessions = sessions.filter((session) => (
        (payload.session_ids as number[]).includes(session.id)
      ));
      const bookings = selectedSessions.map((session, index) => ({
        id: 503 + index,
        session: session.id,
        session_title: session.title,
        session_date: session.date,
        session_start_time: session.start_time,
        session_location: session.location,
        status: "pending",
        student_request_memo: payload.student_request_memo,
        preferred_start_time: payload.preferred_start_time,
        preferred_end_time: payload.preferred_end_time,
        created_at: new Date().toISOString(),
      }));
      state.bookings = [...state.bookings, ...bookings];
      return json({ count: bookings.length, participants: bookings }, 201);
    }
    const cancellation = path.match(/^\/clinic\/participants\/(\d+)\/set_status\/$/);
    if (cancellation && method === "PATCH") {
      const id = Number(cancellation[1]);
      expect(request.postDataJSON()).toEqual({ status: "cancelled" });
      state.cancelledIds.push(id);
      state.bookings = state.bookings.filter((booking) => booking.id !== id);
      return json({ status: "cancelled" });
    }
    if (path === "/clinic/idcard/" && method === "GET") {
      if (idcardControl?.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, idcardControl.delayMs));
      }
      if (idcardControl?.fail) return json({ detail: "temporary unavailable" }, 503);
      const validBookings = validIdcardBookings(state);
      const confirmedBooking = validBookings.find((booking) => (
        ["booked", "attended"].includes(booking.status)
      ));
      const currentBooking = idcardResult === "FAIL" && confirmedBooking
        ? confirmedBooking
        : validBookings[0] ?? null;
      const passcardState = idcardResult === "SUCCESS"
        ? "PASSED"
        : confirmedBooking ? "BOOKING_CONFIRMED" : "CLINIC_REQUIRED";
      const bookingStatus = currentBooking?.status ?? (idcardResult === "FAIL" ? "required" : "none");
      return json({
        student_name: "김학생",
        profile_photo_url: null,
        background_colors: ["#ef4444", "#3b82f6", "#22c55e"],
        server_date: dateAfter(0),
        server_datetime: `${dateAfter(0)}T09:30:00+09:00`,
        current_result: idcardResult,
        passcard_state: passcardState,
        can_leave: passcardState !== "CLINIC_REQUIRED",
        booking_status: bookingStatus,
        booking_status_label: currentBooking?.status_label ?? (bookingStatus === "required" ? "예약 필요" : "예약 없음"),
        current_booking: currentBooking,
        valid_bookings: validBookings,
        current_targets: idcardResult === "FAIL" ? [
          {
            clinic_link_id: 81,
            enrollment_id: 31,
            lecture_id: 41,
            lecture_title: "대수 정규반",
            lecture_color: "#2563eb",
            lecture_chip_label: "대수",
            session_id: 61,
            session_order: 4,
            session_title: "4주차 함수",
            source_type: "exam",
            source_id: 814,
            source_title: "4주차 확인 시험",
            source_scope: "함수 기초",
            created_at: "2026-08-19T09:00:00+09:00",
          },
          {
            clinic_link_id: 84,
            enrollment_id: 31,
            lecture_id: 41,
            lecture_title: "대수 정규반",
            lecture_color: "#2563eb",
            lecture_chip_label: "대수",
            session_id: 64,
            session_order: 7,
            session_title: "7주차 미적분",
            source_type: "exam",
            source_id: 817,
            source_title: "7주차 확인 시험",
            source_scope: "미분법",
            created_at: "2026-08-22T09:00:00+09:00",
          },
          {
            clinic_link_id: 82,
            enrollment_id: 31,
            lecture_id: 41,
            lecture_title: "대수 정규반",
            lecture_color: "#2563eb",
            lecture_chip_label: "대수",
            session_id: 62,
            session_order: 5,
            session_title: "5주차 수열",
            source_type: "homework",
            source_id: 290,
            source_title: "5주차 오답 과제",
            source_scope: "등차수열",
            created_at: "2026-08-20T09:00:00+09:00",
          },
          {
            clinic_link_id: 83,
            enrollment_id: 31,
            lecture_id: 41,
            lecture_title: "대수 정규반",
            lecture_color: "#2563eb",
            lecture_chip_label: "대수",
            session_id: 63,
            session_order: 6,
            session_title: "6주차 극한",
            source_type: "exam",
            source_id: 816,
            source_title: "6주차 확인 시험",
            source_scope: "함수의 극한",
            created_at: "2026-08-21T09:00:00+09:00",
          },
        ] : [],
        histories: [{
          enrollment_id: 31,
          lecture_id: 41,
          lecture_title: "대수 정규반",
          lecture_color: "#2563eb",
          lecture_chip_label: "대수",
          session_id: 61,
          session_order: 7,
          session_title: "함수의 그래프",
          passed: idcardResult === "SUCCESS",
          clinic_required: idcardResult === "FAIL",
        }],
        lectures: [{
          id: 41,
          title: "대수 정규반",
          color: "#2563eb",
          chip_label: "대수",
        }],
      });
    }
    if (path === "/clinic/participants/501/change-booking/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.changePayloads.push(payload);
      state.bookings = [{
        id: 502,
        session: 202,
        session_title: "토요일 5시 클리닉",
        session_date: openDate,
        session_start_time: "17:00:00",
        session_location: "1층 세미나실",
        status: "pending",
        student_request_memo: payload.student_request_memo,
        created_at: new Date().toISOString(),
      }];
      return json(state.bookings[0]);
    }
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) {
      return json({ count: 0, results: [] });
    }
    return json({ count: 0, results: [] });
  });
}

test.describe("학생 클리닉 예약 UX", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });

  test("모바일 홈에서 클리닉 패스카드로 바로 진입한다", async ({ page }) => {
    const state = createState();
    const idcardControl: IdcardMockControl = { delayMs: 1_500 };
    const unexpectedMutations: string[] = [];
    page.on("request", (request) => {
      const signature = `${request.method()} ${new URL(request.url()).pathname}`;
      const isReadNavigationTelemetry = signature === "POST /api/v1/students/me/activity/";
      if (!["GET", "OPTIONS"].includes(request.method()) && !isReadNavigationTelemetry) {
        unexpectedMutations.push(signature);
      }
    });
    await seed(page);
    await installApi(page, state, "FAIL", idcardControl);
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });

    const appArea = page.locator("[data-guide='dash-apps']");
    const passcardLink = appArea.getByRole("link", { name: "클리닉 패스카드", exact: true });
    const shortcuts = appArea.getByRole("link");
    await expect(shortcuts).toHaveCount(8);
    await expect(passcardLink).toHaveAttribute("href", "/student/idcard");
    await expect(appArea.getByRole("link", { name: "내 정보", exact: true })).toHaveCount(0);
    for (let index = 0; index < 8; index += 1) {
      const box = await shortcuts.nth(index).boundingBox();
      expect(box, `shortcut ${index + 1} should have a measurable touch target`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await appArea.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    await passcardLink.focus();
    await expect(passcardLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/student\/idcard$/);
    await expect(page.getByRole("status")).toContainText("패스카드를 불러오는 중");
    await expect(page.getByTestId("clinic-passcard")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/student\/dashboard$/);
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const drawer = page.getByRole("dialog", { name: "메뉴" });
    await expect(drawer.getByRole("link", { name: "클리닉 패스카드", exact: true }))
      .toHaveAttribute("href", "/student/idcard");
    await expect(drawer.getByRole("link", { name: "프로필", exact: true }))
      .toHaveAttribute("href", "/student/profile");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "프로필 메뉴" }).click();
    await page.getByRole("button", { name: "내 정보", exact: true }).click();
    await expect(page).toHaveURL(/\/student\/profile$/);
    expect(unexpectedMutations).toEqual([]);
  });

  test("패스카드 직접 URL은 오류를 실패 폐쇄하고 다시 시도한다", async ({ page }) => {
    const state = createState();
    const idcardControl: IdcardMockControl = { fail: true };
    await seed(page);
    await installApi(page, state, "FAIL", idcardControl);
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });

    const error = page.getByRole("alert");
    await expect(error).toContainText("패스카드를 불러오지 못했습니다.");
    idcardControl.fail = false;
    await error.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByTestId("clinic-passcard")).toBeVisible();
  });

  test("인증 없는 패스카드 직접 URL은 로그인으로 되돌린다", async ({ page }) => {
    const state = createState();
    test.skip(!isLocalBase(BASE), "학생 클리닉 route-mock 검증은 로컬 dev 서버 전용");
    await installApi(page, state);
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("실제 개설 날짜와 수업 정보를 날짜표 중심으로 보여준다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "열린 일정" })).toBeVisible();
    const bookedDateRegion = page.getByRole("region", { name: koreanDateLabel(bookedDate) });
    await expect(bookedDateRegion).toContainText("대수 오답 클리닉");
    await page.getByTestId(`clinic-calendar-day-${openDate}`).click();
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    await expect(openDateRegion).toContainText("토요일 5시 클리닉");
    await expect(openDateRegion).toContainText("17:00–18:00");
    await expect(openDateRegion).toContainText("1층 세미나실");
    await expect(openDateRegion).toContainText("내 보강과 맞음");
    await expect(openDateRegion.getByText("5개 수업", { exact: true })).toBeVisible();
    await expect(page.getByLabel("2일, 7개 시간대")).toBeVisible();
    await expect(openDateRegion.locator("button span").filter({ hasText: /^\d{2}:\d{2}–/ })).toHaveText([
      "13:00–14:30",
      "17:00–18:00",
      "18:00–19:00",
      "19:00–20:00",
      "20:00–21:00",
    ]);
    await expect(page.getByRole("button", { name: "이전 달" })).toBeVisible();

    const dateNumber = openDateRegion.locator("time strong");
    await expect(dateNumber).toHaveText(String(Number(openDate.split("-")[2])));
    const fontSize = await dateNumber.evaluate((element) => getComputedStyle(element).fontSize);
    expect(Number.parseFloat(fontSize)).toBeGreaterThanOrEqual(27);
    await page.screenshot({ path: "test-results/student-clinic-open-dates-390.png", fullPage: true });
  });

  test("월간 달력에서 날짜를 직접 골라 선택일의 전체 시간대를 탐색한다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    const calendar = page.getByRole("grid", { name: "클리닉 월간 일정" });
    await expect(calendar).toBeVisible();
    await expect(calendar.getByRole("columnheader")).toHaveCount(7);
    const days = calendar.getByRole("gridcell");
    await expect(days).toHaveCount(42);
    expect(await days.first().getAttribute("data-weekday-index")).toBe("0");
    expect((await calendar.evaluate((element) => getComputedStyle(element).gridTemplateColumns))
      .split(" ")).toHaveLength(7);

    const bookedDay = page.getByTestId(`clinic-calendar-day-${bookedDate}`);
    await expect(bookedDay).toHaveAttribute("data-booked", "true");
    await expect(bookedDay).toHaveAttribute("data-full", "true");
    await expect(bookedDay).toHaveAccessibleName(/예약 있음, 마감/);
    const openDay = page.getByTestId(`clinic-calendar-day-${openDate}`);
    await expect(openDay).toHaveAttribute("data-open", "true");
    const today = page.getByTestId(`clinic-calendar-day-${dateAfter(0)}`);
    await expect(today).toHaveAttribute("aria-current", "date");
    await expect(today).toHaveAttribute("data-today", "true");
    await expect(today).toHaveClass(/today/);
    await bookedDay.click();
    await expect(bookedDay).toHaveAttribute("aria-pressed", "true");

    await bookedDay.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId(`clinic-calendar-day-${dateAfter(3)}`)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId(`clinic-calendar-day-${dateAfter(10)}`)).toBeFocused();
    await openDay.focus();
    await expect(openDay).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(openDay).toHaveAttribute("aria-pressed", "true");
    const selectedDay = page.getByRole("region", { name: koreanDateLabel(openDate) });
    await expect(selectedDay.getByRole("button", { name: /토요일 1시 클리닉/ })).toBeVisible();
    await expect(selectedDay.getByRole("button", { name: /토요일 5시 클리닉/ })).toBeVisible();
    await expect(selectedDay.getByRole("button", { name: /토요일 6시 클리닉/ })).toBeVisible();
    await expect(selectedDay.getByRole("button", { name: /토요일 7시 클리닉/ })).toBeVisible();
    await expect(selectedDay.getByRole("button", { name: /토요일 8시 클리닉/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "다음 일정 더 보기" })).toHaveCount(0);

    for (const viewport of [
      { width: 390, height: 844, name: "390" },
      { width: 1366, height: 900, name: "1366" },
    ]) {
      await page.setViewportSize(viewport);
      if (viewport.width === 390) {
        const mobileCalendarTargets = await calendar.locator("button").evaluateAll(
          (elements) => elements.map((element) => {
            const bounds = element.getBoundingClientRect();
            return Math.min(bounds.width, bounds.height);
          }),
        );
        expect(Math.min(...mobileCalendarTargets)).toBeGreaterThanOrEqual(44);
      }
      expect(await page.locator("body").evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      )).toBe(true);
      await page.screenshot({
        path: `test-results/student-clinic-calendar-${viewport.name}.png`,
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 312, height: 675 });
    const zoomedCalendarTargets = await calendar.locator("button").evaluateAll(
      (elements) => elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return Math.min(bounds.width, bounds.height) * 1.25;
      }),
    );
    expect(Math.min(...zoomedCalendarTargets)).toBeGreaterThanOrEqual(44);
    expect(await page.locator("body").evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    )).toBe(true);
  });

  test("보강 항목을 최근순으로 전부 표시한다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    const targets = page.getByTestId("clinic-target-item");
    await expect(targets).toHaveCount(4);
    await expect(targets).toContainText([
      "7주차 확인 시험",
      "6주차 확인 시험",
      "5주차 오답 과제",
      "4주차 확인 시험",
    ]);
    await expect(targets.first()).toContainText("단원/범위 미분법");
    await expect(targets.first().getByRole("link", { name: "시험 확인·제출" }))
      .toHaveAttribute("href", "/student/exams/817");
    const homeworkTarget = targets.filter({ hasText: "5주차 오답 과제" });
    await expect(homeworkTarget.getByRole("link", { name: "과제 온라인 제출" }))
      .toHaveAttribute("href", "/student/submit/assignment?sessionId=62&homeworkId=290");
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });

  test("승인 대기 예약을 다른 날짜로 원자적으로 변경한다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await page.getByRole("tab", { name: "내 일정 1" }).click();
    await page.getByRole("button", { name: "일정 바꾸기" }).click();
    await expect(page.getByRole("region", { name: "변경 중인 예약" })).toContainText("대수 오답 클리닉");
    await page.getByTestId(`clinic-calendar-day-${openDate}`).click();
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    const openSessionButton = openDateRegion.getByRole("button", { name: /토요일 5시 클리닉/ });
    await openSessionButton.click();
    await page.getByRole("button", { name: "이 일정으로 변경하기" }).click();

    await expect.poll(() => state.changePayloads).toEqual([
      { new_session_id: 202, student_request_memo: "오답노트 지참" },
    ]);
    await expect(page.getByText("일정 변경 신청이 접수되었습니다.")).toBeVisible();
  });

  test("레거시 교직원 메모를 학생 요청으로 노출하지 않는다", async ({ page }) => {
    const state = createState();
    state.bookings[0] = {
      ...state.bookings[0],
      memo: "교직원 내부 확인 메모",
      student_request_memo: "오답노트 지참",
    };
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await page.getByRole("tab", { name: "내 일정 1" }).click();
    const bookingCard = page.locator("article").filter({ hasText: "대수 오답 클리닉" });
    await expect(bookingCard).not.toContainText("교직원 내부 확인 메모");
    await expect(bookingCard).toContainText("오답노트 지참");
  });

  test("열린 일정에 예약을 신청하고 내 일정에서 취소한다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await page.getByTestId(`clinic-calendar-day-${openDate}`).click();
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    await openDateRegion.getByRole("button", { name: /토요일 5시 클리닉/ }).click();
    await page.getByLabel("희망 시작 시간").fill("17:30");
    await page.getByLabel("희망 종료 시간").fill("18:00");
    await page.getByLabel("학원에 전할 내용 (선택)").fill("개념서 지참");
    await page.getByRole("button", { name: "이 일정 예약하기" }).click();

    await expect.poll(() => state.bookingPayloads).toEqual([
      {
        session_ids: [202],
        student_request_memo: "개념서 지참",
        preferred_end_time: "18:00",
        preferred_start_time: "17:30",
      },
    ]);
    await expect(page.getByRole("status")).toContainText("예약 신청이 접수되었습니다.");

    await page.getByRole("tab", { name: "내 일정 2" }).click();
    const bookingCard = page.locator("article").filter({ hasText: "토요일 5시 클리닉" });
    await expect(bookingCard).toContainText("희망 17:30–18:00");
    await expect(bookingCard).toContainText("개념서 지참");
    await bookingCard.getByRole("button", { name: "예약 취소" }).click();
    await page.getByRole("alertdialog", { name: "예약 취소" })
      .getByRole("button", { name: "예약 취소" })
      .click();

    await expect.poll(() => state.cancelledIds).toEqual([503]);
    await expect(page.getByText("예약 신청이 취소되었습니다.")).toBeVisible();
  });

  test("시작과 종료를 골라 사이의 연속 시간대까지 한 번에 예약한다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await page.getByTestId(`clinic-calendar-day-${openDate}`).click();
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    await openDateRegion.getByRole("button", { name: /토요일 5시 클리닉/ }).click();
    await openDateRegion.getByRole("button", { name: /토요일 7시 클리닉/ }).click();

    const selection = page.getByRole("region", { name: "선택한 클리닉 시간" });
    await expect(selection).toContainText("17:00–20:00");
    await expect(selection).toContainText("3개 시간대");
    await expect(selection).toContainText("총 3시간");
    await selection.scrollIntoViewIfNeeded();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-clinic-multi-slot-390.png", fullPage: true });

    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(selection).toContainText("17:00–20:00");
    await selection.scrollIntoViewIfNeeded();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-clinic-multi-slot-1100.png", fullPage: true });

    await selection.getByLabel("학원에 전할 내용 (선택)").fill("세 시간 연속 참여");
    await selection.getByRole("button", { name: "3개 시간대 예약하기" }).click();

    await expect.poll(() => state.bookingPayloads).toEqual([{
      session_ids: [202, 203, 204],
      student_request_memo: "세 시간 연속 참여",
    }]);
    await expect(page.getByRole("status")).toContainText("3개 시간대 예약 신청이 접수되었습니다.");

    await page.getByRole("tab", { name: "내 일정 4" }).click();
    await expect(page.locator("article").filter({ hasText: "토요일 5시 클리닉" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "토요일 6시 클리닉" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "토요일 7시 클리닉" })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "내 일정 4" }).click();
    await expect(page.locator("article").filter({ hasText: "토요일 6시 클리닉" })).toContainText("세 시간 연속 참여");
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole("tab", { name: "예약하기" }).click();
    await expect(page.getByTestId(`clinic-calendar-day-${openDate}`))
      .toHaveAttribute("data-booked-count", "3");
  });

  test("연속 범위의 빈 구간과 한 타임 전용 정책을 설명하고 기존 선택을 지킨다", async ({ page }) => {
    const state = createState();
    state.bookings = [];
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await page.getByTestId(`clinic-calendar-day-${openDate}`).click();
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    const onePm = openDateRegion.getByRole("button", { name: /토요일 1시 클리닉/ });
    const fivePm = openDateRegion.getByRole("button", { name: /토요일 5시 클리닉/ });
    const eightPm = openDateRegion.getByRole("button", { name: /토요일 8시 클리닉/ });

    await onePm.click();
    await fivePm.click();
    await expect(page.getByRole("status")).toContainText("시간 사이에 빈 구간이 있어");
    await expect(onePm).toHaveAttribute("aria-pressed", "true");
    await expect(fivePm).toHaveAttribute("aria-pressed", "false");

    await onePm.click();
    await fivePm.click();
    await eightPm.click();
    await expect(page.getByRole("status")).toContainText("한 타임 전용 일정이 포함되어");
    await expect(fivePm).toHaveAttribute("aria-pressed", "true");
    await expect(eightPm).toHaveAttribute("aria-pressed", "false");
  });

  test("다른 날짜로 옮길 때는 한 타임 전용 일정도 바로 선택할 수 있다", async ({ page }) => {
    const state = createState();
    state.bookings = [];
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await page.getByTestId(`clinic-calendar-day-${openDate}`).click();
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    await openDateRegion.getByRole("button", { name: /토요일 5시 클리닉/ }).click();

    await page.getByTestId(`clinic-calendar-day-${bookedDate}`).click();
    const bookedDateRegion = page.getByRole("region", { name: koreanDateLabel(bookedDate) });
    const singleSlotOnOtherDate = bookedDateRegion.getByRole("button", {
      name: /대수 오답 클리닉/,
    });
    await expect(singleSlotOnOtherDate).toBeEnabled();
    await singleSlotOnOtherDate.click();
    await expect(singleSlotOnOtherDate).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId(`clinic-calendar-day-${openDate}`).click();
    await expect(page.getByRole("region", { name: koreanDateLabel(openDate) })
      .getByRole("button", { name: /토요일 5시 클리닉/ }))
      .toHaveAttribute("aria-pressed", "false");
  });

  test("미해소 대상의 승인 대기 예약을 귀가 불가 상태로 표시하고 reload 후 유지한다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/student\/idcard$/);
    await expect(page.getByTestId("clinic-passcard")).toBeVisible();
    await expect(page.getByRole("heading", { name: "대상자" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "예약완료" })).toHaveCount(0);
    const bookingStatus = page.getByRole("region", { name: "클리닉 예약 상태" });
    await expect(bookingStatus).toContainText("승인 대기");
    await expect(bookingStatus).toContainText(bookedDate);
    await expect(bookingStatus).toContainText("15:00");
    await expect(bookingStatus).toContainText("2층 보강실");
    await expect(page.getByRole("link", { name: "예약 일정 확인하기" })).toHaveAttribute("href", "/student/clinic");
    await expect(page.getByText("LIVE", { exact: false })).toBeVisible();
    const passcard = page.getByTestId("clinic-passcard");
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-clinic-passcard-390.png", fullPage: true });

    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(passcard).toBeVisible();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-clinic-passcard-1100.png", fullPage: true });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "대상자" })).toBeVisible();
    await expect(page.getByRole("region", { name: "클리닉 예약 상태" })).toContainText("승인 대기");
  });

  test("확정 예약은 수강완료까지 예약완료이고 미해결 완료 뒤에는 대상자로 돌아온다", async ({ page }) => {
    const state = createState();
    state.bookings[0] = { ...state.bookings[0], status: "booked" };
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "예약완료" })).toBeVisible();
    await expect(page.getByRole("region", { name: "클리닉 예약 상태" })).toContainText("예약 확정");

    state.bookings = [{
      ...state.bookings[0],
      status: "attended",
      session_date: dateAfter(-1),
      completed_at: null,
    }];
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "예약완료" })).toBeVisible();
    await expect(page.getByRole("region", { name: "클리닉 예약 상태" })).toContainText("클리닉 진행 중");

    state.bookings = [{
      ...state.bookings[0],
      status: "attended",
      session_date: dateAfter(-1),
      completed_at: `${dateAfter(0)}T18:00:00+09:00`,
    }];
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "대상자" })).toBeVisible();
    await expect(page.getByRole("region", { name: "클리닉 예약 상태" })).toContainText("예약 필요");

    for (const status of ["cancelled", "rejected", "no_show"]) {
      state.bookings = [{
        ...state.bookings[0],
        status,
        session_date: dateAfter(-1),
        completed_at: status === "attended" ? `${dateAfter(-1)}T18:00:00+09:00` : null,
      }];
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "대상자" })).toBeVisible();
      await expect(page.getByRole("region", { name: "클리닉 예약 상태" })).toContainText("예약 필요");
    }
  });

  test("예약완료 패스카드의 상태 색상은 라이트와 다크 모드에서 동일하다", async ({ page }) => {
    const state = createState();
    state.bookings[0] = { ...state.bookings[0], status: "booked" };
    await seed(page);
    await page.addInitScript(() => {
      if (!localStorage.getItem("hakwonplus:student-theme-mode")) {
        localStorage.setItem("hakwonplus:student-theme-mode", "light");
      }
    });
    await installApi(page, state);
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "예약완료" })).toBeVisible();

    const readPalette = () => page.getByTestId("clinic-passcard").evaluate((passcard) => {
      const read = (selector: string) => {
        const element = passcard.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing passcard element: ${selector}`);
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderColor: style.borderColor,
          color: style.color,
          backdropFilter: style.backdropFilter,
        };
      };
      return {
        passcard: read(".clinic-idcard__aurora"),
        header: read(".clinic-idcard__header"),
        verdict: read(".clinic-idcard__verdict"),
        booking: read(".clinic-idcard__booking"),
        history: read(".clinic-idcard__history"),
      };
    });

    const lightPalette = await readPalette();
    await page.screenshot({ path: "test-results/student-clinic-passcard-reserved-light-390.png", fullPage: true });
    await page.evaluate(() => {
      localStorage.setItem("hakwonplus:student-theme-mode", "dark");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-app="student"][data-student-dark="true"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "예약완료" })).toBeVisible();
    const darkPalette = await readPalette();

    expect(darkPalette).toEqual(lightPalette);
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-clinic-passcard-reserved-dark-390.png", fullPage: true });

    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(page.getByTestId("clinic-passcard")).toBeVisible();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-clinic-passcard-reserved-dark-1100.png", fullPage: true });
  });

  test("예약 성공 직후 패스카드가 승인 대기로 갱신되고 새로고침에도 유지된다", async ({ page }) => {
    const state = createState();
    state.bookings = [];
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await page.getByTestId(`clinic-calendar-day-${openDate}`).click();
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    await openDateRegion.getByRole("button", { name: /토요일 5시 클리닉/ }).click();
    await page.getByRole("button", { name: "이 일정 예약하기" }).click();
    await expect(page.getByRole("status")).toContainText("예약 신청이 접수되었습니다.");

    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "대상자" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "예약완료" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "클리닉 예약 상태" })).toContainText("승인 대기");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("region", { name: "클리닉 예약 상태" })).toContainText("승인 대기");
  });

  test("합격 패스카드는 학원에서 지정한 3색과 합격 판정을 보여준다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state, "SUCCESS");
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });

    const passcard = page.getByTestId("clinic-passcard");
    await expect(page.getByRole("heading", { name: "합격자" })).toBeVisible();
    await expect(page.getByRole("region", { name: "클리닉 예약 상태" })).toContainText("승인 대기");
    await expect(page.getByRole("link", { name: "클리닉 일정 예약하기" })).toHaveCount(0);
    const backgroundImage = await passcard.evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(backgroundImage).toContain("239, 68, 68");
    expect(backgroundImage).toContain("59, 130, 246");
    expect(backgroundImage).toContain("34, 197, 94");
    await page.screenshot({ path: "test-results/student-clinic-passcard-pass-390.png", fullPage: true });
  });

  test("Ymath 패스카드는 합격 대신 오답 완료 여부만 데스크톱과 모바일에 표시한다", async ({ page }) => {
    const state = createState();
    const programOptions: ProgramMockOptions = {
      tenantCode: "ymath",
      assessmentStatusDisplay: "wrong_completion",
    };
    await seed(page, programOptions);
    await installApi(page, state, "SUCCESS", undefined, programOptions);
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });
    const appArea = page.locator("[data-guide='dash-apps']");
    const statusCardLink = appArea.getByRole("link", { name: "오답 상태 카드", exact: true });
    await expect(statusCardLink).toHaveAttribute("href", "/student/idcard");
    await expect(appArea).not.toContainText("패스카드");
    await statusCardLink.click();
    await expect(page).toHaveURL(/\/student\/idcard$/);

    const passcard = page.getByTestId("clinic-passcard");
    await expect(page.getByRole("heading", { name: "오답 완료" })).toBeVisible();
    await expect(page.getByRole("region", { name: "차시별 상태" }).getByText("오답 완료", { exact: true })).toBeVisible();
    await expect(passcard).not.toContainText(/PASS|보강\s?합격|합격자/);
    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true);

    await page.setViewportSize({ width: 1100, height: 820 });
    await expect(passcard).toBeVisible();
    await expect.poll(() => passcard.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
});
