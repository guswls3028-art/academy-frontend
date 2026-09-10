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
  recordRanges: Array<{ from: string | null; to: string | null }>;
  summaryRanges: Array<{ from: string | null; to: string | null }>;
};

type ClockFailureOptions = {
  staffMe?: boolean;
  currentlyWorking?: boolean;
  showWorkingStaff?: boolean;
  mustChangePassword?: boolean;
  monthAwareHistory?: boolean;
};

async function installClockApp(
  page: Page,
  returnPath: string,
  tenantRole: "staff" | "admin" = "staff",
  failures: ClockFailureOptions = {},
): Promise<ClockMock> {
  const calls: ClockMock = {
    startBodies: [],
    endCount: 0,
    recordRanges: [],
    summaryRanges: [],
  };
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
  const septemberHistory = {
    ...closedHistory,
    id: 801,
    work_type: 41,
    work_type_name: "클리닉 조교",
    date: "2026-09-06",
    start_time: "10:00:00",
    end_time: "12:30:00",
    work_hours: 2.5,
    amount: 37500,
    resolved_hourly_wage: 15000,
    created_at: "2026-09-06T01:00:00Z",
    updated_at: "2026-09-06T03:30:00Z",
  };

  await page.addInitScript(({ path }) => {
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    sessionStorage.setItem("session_return_path", path);
  }, { path: returnPath });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const pathname = requestUrl.pathname.replace(/^\/api\/v1/, "");
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
        tenantRole,
        must_change_password: Boolean(failures.mustChangePassword),
        first_login_guide_required: false,
        linkedStudents: null,
      });
    }
    if (pathname === "/staffs/me/") {
      if (failures.staffMe) return json({ detail: "staff identity unavailable" }, 503);
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
      const range = {
        from: requestUrl.searchParams.get("date_from"),
        to: requestUrl.searchParams.get("date_to"),
      };
      calls.recordRanges.push(range);
      if (failures.monthAwareHistory) {
        const records = range.from === "2026-09-01"
          ? [septemberHistory]
          : range.from === "2026-08-01"
            ? [closedHistory]
            : [];
        return json({ count: records.length, next: null, previous: null, results: records });
      }
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
      const range = {
        from: requestUrl.searchParams.get("date_from"),
        to: requestUrl.searchParams.get("date_to"),
      };
      calls.summaryRanges.push(range);
      if (failures.monthAwareHistory) {
        const isSeptember = range.from === "2026-09-01";
        const workAmount = isSeptember ? 37500 : 52000;
        const businessIncomeTax = Math.round(workAmount * 0.03);
        const deductionTotal = Math.round(workAmount * 0.033);
        return json({
          staff_id: 77,
          work_hours: isSeptember ? 2.5 : 4,
          work_amount: workAmount,
          expense_amount: 0,
          total_amount: workAmount,
          reference_business_income_tax: businessIncomeTax,
          reference_local_income_tax: deductionTotal - businessIncomeTax,
          reference_deduction_total: deductionTotal,
          reference_net_work_amount: workAmount - deductionTotal,
          reference_transfer_amount: workAmount - deductionTotal,
        });
      }
      const extraHours = recordClosed ? 1 : 0;
      const extraAmount = recordClosed ? (activeWorkType === 41 ? 15000 : 13000) : 0;
      const workAmount = 52000 + extraAmount;
      const businessIncomeTax = Math.round(workAmount * 0.03);
      const deductionTotal = Math.round(workAmount * 0.033);
      return json({
        staff_id: 77,
        work_hours: 4 + extraHours,
        work_amount: workAmount,
        expense_amount: 0,
        total_amount: workAmount,
        reference_business_income_tax: businessIncomeTax,
        reference_local_income_tax: deductionTotal - businessIncomeTax,
        reference_deduction_total: deductionTotal,
        reference_net_work_amount: workAmount - deductionTotal,
        reference_transfer_amount: workAmount - deductionTotal,
      });
    }
    if (pathname === "/staffs/currently-working/") {
      if (failures.currentlyWorking) return json({ detail: "working list unavailable" }, 503);
      if (failures.showWorkingStaff) {
        return json([{
          staff_id: 88,
          staff_name: "박강사",
          role: "TEACHER",
          date: "2026-08-20",
          started_at: "00:05:00",
          break_started_at: null,
          break_total_seconds: 0,
        }]);
      }
      return json([]);
    }
    if (pathname === "/core/profile/expenses/") return json([]);
    if (pathname === "/landing/has-published/") return json({ has_published: false });
    return json({ count: 0, next: null, previous: null, results: [] });
  });

  return calls;
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test.describe("조교 로그인 출근 선택", () => {
  test("직원의 과거 비밀번호 권장 상태는 출근 선택을 막지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await installClockApp(
      page,
      "/workspace/profile/attendance",
      "staff",
      { mustChangePassword: true },
    );

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("login-username").fill("assistant77");
    await page.getByTestId("login-password").fill("password");
    await page.getByTestId("login-submit").click();

    await expect(page.getByRole("dialog", { name: "비밀번호 변경 권장" })).toHaveCount(0);
    const clockDialog = page.getByRole("dialog", { name: "오늘 어떤 방식으로 시작할까요?" });
    await expect(clockDialog).toBeVisible();
    await expect(clockDialog.getByRole("button", { name: "클리닉 조교 근무 시작" })).toBeVisible();
  });

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
    await expect(page.getByText("3.3% 적용 시 참고 공제")).toBeVisible();
    await expect(page.getByText("50,284원").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "출근 유형 선택" })).toBeVisible();

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

  test("조교가 모바일 메뉴에서 본인 근무기록을 열고 월별 시간과 금액을 확인한다", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-10T12:00:00+09:00") });
    await page.setViewportSize({ width: 390, height: 844 });
    const calls = await installClockApp(
      page,
      "/workspace/mobile",
      "staff",
      { monthAwareHistory: true },
    );
    let signalClinicPendingRequest!: () => void;
    const clinicPendingRequested = new Promise<void>((resolve) => {
      signalClinicPendingRequest = resolve;
    });
    let releaseClinicPendingResponse!: () => void;
    const clinicPendingResponseReleased = new Promise<void>((resolve) => {
      releaseClinicPendingResponse = resolve;
    });
    await page.route("**/api/v1/clinic/participants/**", async (route) => {
      signalClinicPendingRequest();
      await clinicPendingResponseReleased;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      });
    });

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("login-username").fill("assistant77");
    await page.getByTestId("login-password").fill("password");
    await page.getByTestId("login-submit").click();
    await page.getByRole("dialog", { name: "오늘 어떤 방식으로 시작할까요?" })
      .getByRole("button", { name: /출근하지 않고 로그인/ })
      .click();

    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    const menu = page.getByRole("navigation", { name: "선생님 메뉴" });
    await expect(menu).toBeVisible();
    await clinicPendingRequested;
    const loadingBadge = menu.getByLabel("알림 센터 집계 중");
    await expect(loadingBadge).toBeVisible();
    const accountGroupButton = menu.getByRole("button", { name: /내 계정/ });
    await accountGroupButton.click();
    await expect(accountGroupButton).toHaveAttribute("aria-expanded", "true");
    const recordsButton = menu.getByRole("button", { name: "근무 기록 / 지출", exact: true });
    await expect(recordsButton).toBeVisible();
    releaseClinicPendingResponse();
    await expect(loadingBadge).toHaveCount(0);
    await expect(accountGroupButton).toHaveAttribute("aria-expanded", "true");
    await expect(recordsButton).toBeVisible();
    await recordsButton.click();

    await expect(page).toHaveURL(/\/workspace\/mobile\/my-records$/);
    await expect(page.getByRole("heading", { name: "근무 기록 / 지출" })).toBeVisible();
    await expect(page.getByText("9/6(일) · 클리닉 조교", { exact: true })).toBeVisible();
    await expect(page.getByText("10:00 ~ 12:30 · 2.5시간 · 휴게 0분", { exact: true })).toBeVisible();
    await expect(page.getByText("적용 시급 15,000원", { exact: true })).toBeVisible();
    await expect(page.getByText("37,500원").first()).toBeVisible();

    await page.getByLabel("조회 월").fill("2026-08");
    await expect(page.getByText("8/18(화) · 현장 조교", { exact: true })).toBeVisible();
    await expect(page.getByText("13:00 ~ 17:00 · 4시간 · 휴게 0분", { exact: true })).toBeVisible();
    await expect(page.getByText("적용 시급 13,000원", { exact: true })).toBeVisible();
    await expect(page.getByText("52,000원").first()).toBeVisible();
    expect(calls.recordRanges).toEqual(expect.arrayContaining([
      { from: "2026-09-01", to: "2026-09-30" },
      { from: "2026-08-01", to: "2026-08-31" },
    ]));
    expect(calls.summaryRanges).toEqual(expect.arrayContaining([
      { from: "2026-09-01", to: "2026-09-30" },
      { from: "2026-08-01", to: "2026-08-31" },
    ]));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "test-results/staff-my-records-payroll-390.png", fullPage: true });
  });

  test("조교가 아닌 로그인은 근무 선택 세션을 만들지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const calls = await installClockApp(page, "/workspace/dashboard", "admin");

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("login-username").fill("admin77");
    await page.getByTestId("login-password").fill("password");
    await page.getByTestId("login-submit").click();

    await expect(page.getByRole("dialog", { name: "오늘 어떤 방식으로 시작할까요?" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/workspace\/dashboard/);
    expect(calls.startBodies).toHaveLength(0);
    expect(await page.evaluate(() => sessionStorage.getItem("staff.clock-in-choice.pending.v1"))).toBeNull();
  });

  test("근무 현황 API 실패를 빈 명단으로 숨기지 않고 다시 시도를 제공한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await installClockApp(page, "/workspace/dashboard", "admin", { currentlyWorking: true });

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("login-username").fill("admin77");
    await page.getByTestId("login-password").fill("password");
    await page.getByTestId("login-submit").click();

    await expect(page.getByRole("button", { name: "근무 현황 오류 · 다시 시도" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "문제가 발생했습니다" })).toHaveCount(0);
  });

  test("모바일에서 직원 식별 실패를 숨기지 않고 복구 화면을 연다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installClockApp(page, "/workspace/dashboard", "admin", { staffMe: true });

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("login-username").fill("admin77");
    await page.getByTestId("login-password").fill("password");
    await page.getByTestId("login-submit").click();

    const clockButton = page.getByRole("button", { name: "근무 상태를 불러오지 못함, 자세히 보기" });
    await expect(clockButton).toBeVisible();
    await clockButton.click();
    await expect(page.getByRole("dialog", { name: "근무 상태" }).getByText("근무 상태를 불러오지 못했습니다")).toBeVisible();
  });

  test("근무자 아바타는 키보드 Enter로 상세를 연다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await installClockApp(page, "/workspace/dashboard", "admin", { showWorkingStaff: true });

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("login-username").fill("admin77");
    await page.getByTestId("login-password").fill("password");
    await page.getByTestId("login-submit").click();

    const avatar = page.getByRole("button", { name: "박강사 근무 정보 보기" });
    await avatar.focus();
    await avatar.press("Enter");
    await expect(page.getByText("근무시간", { exact: true })).toBeVisible();
  });
});
