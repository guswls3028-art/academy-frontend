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

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: "hakwonplus",
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
    id: 201,
    title: "토요일 1시 클리닉",
    date: openDate,
    start_time: "13:00:00",
    end_time: "14:30:00",
    location: "2층 보강실",
    participant_count: 3,
    booked_count: 3,
    max_participants: 10,
    target_lecture_names: [{ id: 77, title: "기하 정규반", color: "#7c3aed", chip_label: "기하" }],
  },
  {
    id: 202,
    title: "토요일 5시 클리닉",
    date: openDate,
    start_time: "17:00:00",
    end_time: "18:30:00",
    location: "1층 세미나실",
    participant_count: 6,
    booked_count: 6,
    max_participants: 10,
    target_lecture_names: [{ id: 41, title: "대수 정규반", color: "#2563eb", chip_label: "대수" }],
  },
  {
    id: 203,
    title: "토요일 7시 클리닉",
    date: openDate,
    start_time: "19:00:00",
    end_time: "20:30:00",
    location: "3층 자습실",
    participant_count: 1,
    booked_count: 1,
    max_participants: 8,
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
        memo: "오답노트 지참",
        created_at: new Date().toISOString(),
      },
    ],
    bookingPayloads: [],
    cancelledIds: [],
    changePayloads: [],
  };
}

async function seed(page: Page) {
  test.skip(!isLocalBase(BASE), "학생 클리닉 route-mock 검증은 로컬 dev 서버 전용");
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, fakeJwt());
}

async function installApi(page: Page, state: MockState, idcardResult: "SUCCESS" | "FAIL" = "FAIL") {
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
    if (path === "/clinic/participants/" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.bookingPayloads.push(payload);
      const booking = {
        id: 503,
        session: payload.session,
        session_title: "토요일 5시 클리닉",
        session_date: openDate,
        session_start_time: "17:00:00",
        session_location: "1층 세미나실",
        status: "pending",
        memo: payload.memo,
        created_at: new Date().toISOString(),
      };
      state.bookings = [...state.bookings, booking];
      return json(booking, 201);
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
      return json({
        student_name: "김학생",
        profile_photo_url: null,
        background_colors: ["#ef4444", "#3b82f6", "#22c55e"],
        server_date: "2026-08-22",
        server_datetime: "2026-08-22T09:30:00+09:00",
        current_result: idcardResult,
        current_targets: idcardResult === "FAIL" ? [{
          clinic_link_id: 81,
          enrollment_id: 31,
          lecture_id: 41,
          lecture_title: "대수 정규반",
          lecture_color: "#2563eb",
          lecture_chip_label: "대수",
          session_id: 61,
          session_order: 7,
          session_title: "함수의 그래프",
          source_type: "exam",
        }] : [],
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
        memo: payload.memo,
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

  test("실제 개설 날짜와 수업 정보를 날짜표 중심으로 보여준다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "열린 일정" })).toBeVisible();
    const bookedDateRegion = page.getByRole("region", { name: koreanDateLabel(bookedDate) });
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    await expect(bookedDateRegion).toContainText("대수 오답 클리닉");
    await expect(openDateRegion).toContainText("토요일 5시 클리닉");
    await expect(openDateRegion).toContainText("17:00–18:30");
    await expect(openDateRegion).toContainText("1층 세미나실");
    await expect(openDateRegion).toContainText("내 보강과 맞음");
    await expect(openDateRegion.getByText("3개 수업", { exact: true })).toBeVisible();
    await expect(page.getByLabel("2일, 4개 시간대")).toBeVisible();
    await expect(openDateRegion.locator("button span").filter({ hasText: /^\d{2}:\d{2}–/ })).toHaveText([
      "13:00–14:30",
      "17:00–18:30",
      "19:00–20:30",
    ]);
    await expect(page.getByRole("button", { name: "이전 달" })).toHaveCount(0);

    const dateNumber = openDateRegion.locator("time strong");
    await expect(dateNumber).toHaveText(String(Number(openDate.split("-")[2])));
    const fontSize = await dateNumber.evaluate((element) => getComputedStyle(element).fontSize);
    expect(Number.parseFloat(fontSize)).toBeGreaterThanOrEqual(27);
    await page.screenshot({ path: "test-results/student-clinic-open-dates-390.png", fullPage: true });
  });

  test("승인 대기 예약을 다른 날짜로 원자적으로 변경한다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    await page.getByRole("tab", { name: "내 일정 1" }).click();
    await page.getByRole("button", { name: "일정 바꾸기" }).click();
    await expect(page.getByRole("region", { name: "변경 중인 예약" })).toContainText("대수 오답 클리닉");
    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    const openSessionButton = openDateRegion.getByRole("button", { name: /토요일 5시 클리닉/ });
    await openSessionButton.click();
    await page.getByRole("button", { name: "이 일정으로 변경하기" }).click();

    await expect.poll(() => state.changePayloads).toEqual([
      { new_session_id: 202, memo: "오답노트 지참" },
    ]);
    await expect(page.getByText("일정 변경 신청이 접수되었습니다.")).toBeVisible();
  });

  test("열린 일정에 예약을 신청하고 내 일정에서 취소한다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "domcontentloaded" });

    const openDateRegion = page.getByRole("region", { name: koreanDateLabel(openDate) });
    await openDateRegion.getByRole("button", { name: /토요일 5시 클리닉/ }).click();
    await page.getByLabel("학원에 전할 내용 (선택)").fill("개념서 지참");
    await page.getByRole("button", { name: "이 일정 예약하기" }).click();

    await expect.poll(() => state.bookingPayloads).toEqual([
      {
        session: 202,
        memo: "개념서 지참",
        source: "student_request",
        status: "pending",
      },
    ]);
    await expect(page.getByRole("status")).toContainText("예약 신청이 접수되었습니다.");

    await page.getByRole("tab", { name: "내 일정 2" }).click();
    const bookingCard = page.locator("article").filter({ hasText: "토요일 5시 클리닉" });
    await bookingCard.getByRole("button", { name: "예약 취소" }).click();
    await page.getByRole("alertdialog", { name: "예약 취소" })
      .getByRole("button", { name: "예약 취소" })
      .click();

    await expect.poll(() => state.cancelledIds).toEqual([503]);
    await expect(page.getByText("예약 신청이 취소되었습니다.")).toBeVisible();
  });

  test("학생 패스카드가 실시간 클리닉 판정과 예약 진입점을 보여준다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state);
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/student\/idcard$/);
    await expect(page.getByTestId("clinic-passcard")).toBeVisible();
    await expect(page.getByRole("heading", { name: "클리닉 예약 대상자" })).toBeVisible();
    await expect(page.getByRole("link", { name: "클리닉 일정 예약하기" })).toHaveAttribute("href", "/student/clinic");
    await expect(page.getByText("LIVE", { exact: false })).toBeVisible();
    const passcard = page.getByTestId("clinic-passcard");
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-clinic-passcard-390.png", fullPage: true });

    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(passcard).toBeVisible();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-clinic-passcard-1100.png", fullPage: true });
  });

  test("합격 패스카드는 학원에서 지정한 3색과 합격 판정을 보여준다", async ({ page }) => {
    const state = createState();
    await seed(page);
    await installApi(page, state, "SUCCESS");
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "domcontentloaded" });

    const passcard = page.getByTestId("clinic-passcard");
    await expect(page.getByRole("heading", { name: "합격" })).toBeVisible();
    await expect(page.getByRole("link", { name: "클리닉 일정 예약하기" })).toHaveCount(0);
    const backgroundImage = await passcard.evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(backgroundImage).toContain("239, 68, 68");
    expect(backgroundImage).toContain("59, 130, 246");
    expect(backgroundImage).toContain("34, 197, 94");
    await page.screenshot({ path: "test-results/student-clinic-passcard-pass-390.png", fullPage: true });
  });
});
