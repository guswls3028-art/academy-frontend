import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { assertInteractiveSurface } from "../helpers/assertInteractiveSurface";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 77,
  })}.sig`;
}

type ClockMock = {
  startBodies: Array<Record<string, unknown>>;
  endCount: number;
};

async function installClockApp(page: Page, returnPath: string): Promise<ClockMock> {
  const calls: ClockMock = { startBodies: [], endCount: 0 };
  let current: "OFF" | "WORKING" = "OFF";
  let activeWorkType = 41;
  let recordClosed = false;
  const closedHistory = {
    id: 800,
    staff: 77,
    staff_name: "김조교",
    work_type: 42,
    work_type_name: "현장 조교",
    date: "2026-08-18",
    start_time: "13:00:00",
    end_time: "17:00:00",
    break_minutes: 0,
    meal_minutes: 0,
    work_hours: 4,
    amount: 52000,
    resolved_hourly_wage: 13000,
    memo: "",
    created_at: "2026-08-18T04:00:00Z",
    updated_at: "2026-08-18T08:00:00Z",
  };

  await page.addInitScript(({ path }) => {
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    sessionStorage.setItem("session_return_path", path);
  }, { path: returnPath });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (pathname === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스" },
        feature_flags: {},
        is_active: true,
      });
    }
    if (pathname === "/token/" && request.method() === "POST") {
      return json({ access: localJwt(), refresh: `${localJwt()}-refresh` });
    }
    if (pathname === "/token/refresh/") {
      return json({ access: localJwt(), refresh: `${localJwt()}-refresh` });
    }
    if (pathname === "/core/me/") {
      return json({
        id: 77,
        username: "t1_assistant77",
        name: "김조교",
        phone: "01012345678",
        is_staff: true,
        is_superuser: false,
        tenantRole: "staff",
        must_change_password: false,
        first_login_guide_required: false,
        linkedStudents: null,
      });
    }
    if (pathname === "/staffs/me/") {
      return json({
        is_authenticated: true,
        is_superuser: false,
        is_staff: true,
        is_payroll_manager: false,
        is_owner: false,
        staff_id: 77,
        assigned_work_types: [
          { id: 41, name: "클리닉 조교", hourly_wage: 15000 },
          { id: 42, name: "현장 조교", hourly_wage: 13000 },
        ],
      });
    }
    if (pathname === "/staffs/77/work-records/current/") {
      if (current === "OFF") return json({ status: "OFF" });
      const isClinic = activeWorkType === 41;
      return json({
        status: "WORKING",
        work_record_id: 901,
        date: "2026-08-20",
        started_at: "00:05:00",
        work_type: activeWorkType,
        work_type_name: isClinic ? "클리닉 조교" : "현장 조교",
        hourly_wage: isClinic ? 15000 : 13000,
        break_minutes: 0,
        break_total_seconds: 0,
      });
    }
    if (pathname === "/staffs/77/work-records/start-work/" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.startBodies.push(body);
      activeWorkType = Number(body.work_type);
      current = "WORKING";
      recordClosed = false;
      const isClinic = activeWorkType === 41;
      return json({
        id: 901,
        staff: 77,
        staff_name: "김조교",
        work_type: activeWorkType,
        work_type_name: isClinic ? "클리닉 조교" : "현장 조교",
        date: "2026-08-20",
        start_time: "00:05:00",
        end_time: null,
        break_minutes: 0,
        meal_minutes: 0,
        work_hours: null,
        amount: null,
        resolved_hourly_wage: isClinic ? 15000 : 13000,
        memo: "",
        created_at: "2026-08-19T15:05:00Z",
        updated_at: "2026-08-19T15:05:00Z",
      }, 201);
    }
    if (pathname === "/staffs/work-records/901/end_work/" && request.method() === "POST") {
      calls.endCount += 1;
      current = "OFF";
      recordClosed = true;
      return json({
        id: 901,
        staff: 77,
        staff_name: "김조교",
        work_type: activeWorkType,
        work_type_name: activeWorkType === 41 ? "클리닉 조교" : "현장 조교",
        date: "2026-08-20",
        start_time: "00:05:00",
        end_time: "01:05:00",
        break_minutes: 0,
        meal_minutes: 0,
        work_hours: 1,
        amount: activeWorkType === 41 ? 15000 : 13000,
        resolved_hourly_wage: activeWorkType === 41 ? 15000 : 13000,
        memo: "",
        created_at: "2026-08-19T15:05:00Z",
        updated_at: "2026-08-19T16:05:00Z",
      });
    }
    if (pathname === "/staffs/77/work-records/" && request.method() === "GET") {
      const records: Array<Record<string, unknown>> = [closedHistory];
      if (current === "WORKING" || recordClosed) {
        records.unshift({
          ...closedHistory,
          id: 901,
          work_type: activeWorkType,
          work_type_name: activeWorkType === 41 ? "클리닉 조교" : "현장 조교",
          date: "2026-08-20",
          start_time: "00:05:00",
          end_time: recordClosed ? "01:05:00" : null,
          work_hours: recordClosed ? 1 : null,
          amount: recordClosed ? (activeWorkType === 41 ? 15000 : 13000) : null,
          resolved_hourly_wage: activeWorkType === 41 ? 15000 : 13000,
        });
      }
      return json({ count: records.length, next: null, previous: null, results: records });
    }
    if (pathname === "/staffs/77/summary/" && request.method() === "GET") {
      const extraHours = recordClosed ? 1 : 0;
      const extraAmount = recordClosed ? (activeWorkType === 41 ? 15000 : 13000) : 0;
      return json({
        staff_id: 77,
        work_hours: 4 + extraHours,
        work_amount: 52000 + extraAmount,
        expense_amount: 0,
        total_amount: 52000 + extraAmount,
      });
    }
    if (pathname === "/staffs/currently-working/") return json([]);
    if (pathname === "/core/profile/expenses/") return json([]);
    if (pathname === "/landing/has-published/") return json({ has_published: false });
    return json({ count: 0, next: null, previous: null, results: [] });
  });

  return calls;
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test.describe("조교 로그인 출근 선택", () => {
  test("비근무 로그인은 출근 API를 호출하지 않고 새로고침에도 반복되지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const calls = await installClockApp(page, "/workspace/profile/attendance");

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("login-username").fill("assistant77");
    await page.getByTestId("login-password").fill("password");
    await page.getByTestId("login-submit").click();

    const dialog = page.getByRole("dialog", { name: "오늘 어떤 방식으로 시작할까요?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("로그인만으로는 근무시간이 시작되지 않습니다.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "클리닉 조교 근무 시작" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "현장 조교 근무 시작" })).toBeVisible();
    expect(calls.startBodies).toHaveLength(0);
    await page.screenshot({ path: "test-results/staff-clock-choice-desktop.png", fullPage: false });

    await dialog.getByRole("button", { name: /출근하지 않고 로그인/ }).click();
    await expect(dialog).toHaveCount(0);
    expect(calls.startBodies).toHaveLength(0);
    await expect(page.getByRole("tab", { name: "근무 기록" })).toBeVisible();
    await expect(page.getByText("총 근무액 (공제 전)")).toBeVisible();
    await expect(page.getByText("52,000원").first()).toBeVisible();
    await expect(page.getByText(/세후 수령액|3\.3%/)).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("dialog", { name: "오늘 어떤 방식으로 시작할까요?" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "근무 기록" })).toBeVisible();
  });

  test("모바일에서 유형 출근 후 상태 확인과 퇴근까지 이어진다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const calls = await installClockApp(page, "/workspace/mobile/my-records");

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("login-username").fill("assistant77");
    await page.getByTestId("login-password").fill("password");
    await page.getByTestId("login-submit").click();

    const choiceDialog = page.getByRole("dialog", { name: "오늘 어떤 방식으로 시작할까요?" });
    await expect(choiceDialog).toBeVisible();
    await assertInteractiveSurface(
      page,
      choiceDialog,
      choiceDialog.getByRole("button", { name: "클리닉 조교 근무 시작" }),
    );
    await page.screenshot({ path: "test-results/staff-clock-choice-mobile-390.png", fullPage: false });
    await choiceDialog.getByRole("button", { name: "클리닉 조교 근무 시작" }).click();
    await expect(choiceDialog).toHaveCount(0);
    expect(calls.startBodies).toEqual([{ work_type: 41 }]);

    const clockButton = page.getByRole("button", { name: /클리닉 조교 근무 중/ });
    await expect(clockButton).toBeVisible();
    await clockButton.click();
    const statusDialog = page.getByRole("dialog", { name: "근무 상태" });
    await expect(statusDialog.getByText("클리닉 조교", { exact: true })).toBeVisible();
    await expect(statusDialog.getByText("15,000원/시간 · 퇴근 시 최종 금액 계산")).toBeVisible();
    await statusDialog.getByRole("button", { name: "퇴근" }).click();
    await expect(statusDialog).toHaveCount(0);
    expect(calls.endCount).toBe(1);
    await expect(page.getByRole("button", { name: "출근하지 않음, 근무 상태 열기" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "근무 기록 / 지출" })).toBeVisible();
    await expect(page.getByText("클리닉 조교", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("67,000원").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "test-results/staff-clock-mobile-390.png", fullPage: false });
  });
});
