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

test("한 학생이 여러 특강을 수강하면 클리닉 할 일을 모두 표시한다", async ({ page }) => {
  const studentId = 501;
  const state: OperationsState = {
    participants: [{
      id: 801,
      session: 701,
      student: studentId,
      student_name: "김다과목",
      enrollment_id: 1001,
      session_date: saturday,
      session_title: "토요일 1시 클리닉",
      session_start_time: "13:00:00",
      session_end_time: "14:30:00",
      session_location: "1층 세미나실",
      status: "booked",
      lecture_title: "화학특강",
      lecture_chip_label: "화특",
    }],
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
        created_at: "2026-08-22T04:05:00Z",
      },
    ],
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
