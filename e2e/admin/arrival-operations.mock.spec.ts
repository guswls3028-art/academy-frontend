import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 8811;
const SESSION_ID = 8822;

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type AttendanceRow = {
  id: number;
  session: number;
  enrollment_id: number;
  student_id: number;
  name: string;
  status: string;
  memo: string;
  planned_arrival_date: string | null;
  planned_arrival_time: string | null;
  parent_phone: string;
  phone: string;
};

type MockState = {
  attendance: AttendanceRow;
  patches: Record<string, unknown>[];
};

const arrivalOverview = {
  generated_at: "2026-08-01T09:00:00+09:00",
  today: "2026-08-01",
  tomorrow: "2026-08-02",
  soon_window_minutes: 60,
  summary: { soon: 1, today: 3, tomorrow: 1, time_unset: 1, overdue: 1 },
  items: [
    {
      key: "supplement:501",
      source: "supplement",
      attendance_id: 501,
      clinic_participant_id: null,
      clinic_session_id: null,
      student_id: 2001,
      student_name: "김준혁",
      lecture_id: LECTURE_ID,
      lecture_title: "수학 보강",
      lecture_color: "#f59e0b",
      session_id: SESSION_ID,
      session_title: "주말 보강",
      date: "2026-08-01",
      time: "09:30",
      location: "",
      memo: "시험지 A 준비",
      status: "unset",
      is_resolved: false,
      is_overdue: false,
    },
    {
      key: "clinic:601",
      source: "clinic",
      attendance_id: null,
      clinic_participant_id: 601,
      clinic_session_id: 602,
      student_id: 2002,
      student_name: "이하늘",
      lecture_id: LECTURE_ID,
      lecture_title: "수학 정규반",
      lecture_color: "#2563eb",
      session_id: null,
      session_title: "오답 클리닉",
      date: "2026-08-01",
      time: "08:30",
      location: "2강의실",
      memo: "오답노트 지참",
      status: "booked",
      is_resolved: false,
      is_overdue: true,
    },
    {
      key: "supplement:503",
      source: "supplement",
      attendance_id: 503,
      clinic_participant_id: null,
      clinic_session_id: null,
      student_id: 2003,
      student_name: "박서윤",
      lecture_id: LECTURE_ID,
      lecture_title: "수학 보강",
      lecture_color: "#f59e0b",
      session_id: SESSION_ID,
      session_title: "주말 보강",
      date: "2026-08-01",
      time: null,
      location: "",
      memo: "시간 확인 중",
      status: "unset",
      is_resolved: false,
      is_overdue: false,
    },
    {
      key: "clinic:604",
      source: "clinic",
      attendance_id: null,
      clinic_participant_id: 604,
      clinic_session_id: 605,
      student_id: 2004,
      student_name: "최도윤",
      lecture_id: null,
      lecture_title: "",
      lecture_color: "",
      session_id: null,
      session_title: "영어 클리닉",
      date: "2026-08-02",
      time: "13:00",
      location: "1강의실",
      memo: "",
      status: "booked",
      is_resolved: false,
      is_overdue: false,
    },
  ],
};

arrivalOverview.items.sort((left, right) =>
  `${left.date} ${left.time ?? "99:99"}`.localeCompare(`${right.date} ${right.time ?? "99:99"}`),
);

async function seed(page: Page) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "등원 운영 route-mock 검증은 로컬 dev 서버 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

async function installApi(page: Page, state: MockState) {
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
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원플러스", feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "admin", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false });
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/lectures/attendance/arrival-overview/") return json(arrivalOverview);
    if (path === `/lectures/sessions/${SESSION_ID}/`) return json({ id: SESSION_ID, lecture: LECTURE_ID, title: "주말 보강", order: 9, regular_order: null, session_type: "SUPPLEMENT", date: "2026-08-01" });
    if (path === `/lectures/lectures/${LECTURE_ID}/`) return json({ id: LECTURE_ID, title: "수학 보강", color: "#f59e0b", chip_label: "보강" });
    if (path === "/lectures/sessions/") return json({ count: 1, results: [{ id: SESSION_ID, lecture: LECTURE_ID, title: "주말 보강", order: 9, regular_order: null, session_type: "SUPPLEMENT", date: "2026-08-01" }] });
    if (path === "/lectures/attendance/" && method === "GET") return json({ count: 1, page_size: 50, results: [state.attendance] });
    if (path === "/lectures/attendance/501/" && method === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.patches.push(payload);
      state.attendance = { ...state.attendance, ...payload } as AttendanceRow;
      return json(state.attendance);
    }
    if (path === "/community/admin/posts/") return json({ count: 0, results: [] });
    if (path === "/exams/") return json([]);
    if (path === "/submissions/submissions/" || path === "/submissions/submissions/pending/") return json([]);
    if (path === "/messaging/info/") return json({ alimtalk_available: true });
    if (path === "/clinic/participants/" || path === "/students/registration_requests/") return json({ count: 0, results: [] });
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0 });
    if (path === "/core/landing/admin/consult/") return json({ summary: { unread: 0 } });
    if (path === "/community/admin/reports/pending-count/" || path === "/community/notifications/unread-count/") return json({ count: 0 });
    if (path === "/enrollments/session-enrollments/" || path === "/enrollments/" || path === "/lectures/sections/" || path === "/results/admin/clinic-targets/") return json([]);
    return json({ count: 0, results: [] });
  });
}

function createState(): MockState {
  return {
    attendance: {
      id: 501,
      session: SESSION_ID,
      enrollment_id: 3001,
      student_id: 2001,
      name: "김준혁",
      status: "UNSET",
      memo: "",
      planned_arrival_date: null,
      planned_arrival_time: null,
      parent_phone: "01011112222",
      phone: "01033334444",
    },
    patches: [],
  };
}

test("보강 출석표에서 예정 날짜·시간·메모를 명시적으로 저장한다", async ({ page }) => {
  const state = createState();
  await seed(page);
  await installApi(page, state);
  await page.goto(`${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/attendance`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("columnheader", { name: "등원 예정" })).toBeVisible();
  await page.getByRole("button", { name: "김준혁 등원 예정 입력" }).click();
  const dialog = page.getByRole("dialog", { name: "김준혁 등원 예정 편집" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("예정 날짜").fill("2026-08-01");
  await dialog.getByLabel("예정 시간").fill("09:30");
  await dialog.getByLabel("준비 메모").fill("시험지 A 준비");
  await page.screenshot({ path: "test-results/arrival-plan-input-1366.png", fullPage: false });
  await dialog.getByRole("button", { name: "저장", exact: true }).click();

  await expect.poll(() => state.patches).toEqual([{
    planned_arrival_date: "2026-08-01",
    planned_arrival_time: "09:30",
    memo: "시험지 A 준비",
  }]);
  await expect(page.getByRole("button", { name: "김준혁 등원 예정 수정" })).toContainText("09:30");
  await expect(page.getByRole("button", { name: "김준혁 등원 예정 수정" })).toContainText("시험지 A 준비");
});

test("대시보드와 우상단 알림이 보강·클리닉 준비를 같은 현황으로 보여준다", async ({ page }) => {
  const state = createState();
  await seed(page);
  await installApi(page, state);
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });

  const board = page.getByRole("region", { name: "오늘 등원 예정" });
  await expect(board).toContainText("김준혁");
  await expect(board).toContainText("이하늘");
  await expect(board).toContainText("시간 미정");
  await expect(board).toContainText("확인 필요");
  await expect(page.getByRole("heading", { name: "내일 등원" })).toBeVisible();
  await expect(page.getByText("최도윤", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "알림" }).first().click();
  await expect(page.getByText("예정 시간 지난 등원", { exact: true })).toBeVisible();
  await expect(page.getByText("1시간 내 등원 예정", { exact: true })).toBeVisible();
  await expect(page.getByText("시간 미정 보강", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/arrival-operations-1366.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(board).toBeVisible();
  const rect = await board.boundingBox();
  expect(rect?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((rect?.x ?? 0) + (rect?.width ?? 999)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/arrival-operations-390.png", fullPage: false });
});
