import { expect, test } from "../fixtures/strictTest";
import type { Page, Route } from "@playwright/test";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
  })}.sig`;
}

const activeStaff = {
  id: 1,
  name: "김조교",
  phone: "01012345678",
  role: "ASSISTANT",
  position: "ASSISTANT",
  position_label: "조교",
  account_role: "STAFF",
  is_active: true,
  is_manager: false,
  can_manage_staff: false,
  pay_type: "HOURLY",
  staff_work_types: [
    {
      id: 11,
      staff: 1,
      work_type: {
        id: 21,
        name: "채점",
        base_hourly_wage: 12000,
        color: "#2563eb",
        is_active: true,
      },
      effective_hourly_wage: 12000,
    },
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const inactiveMonthlyStaff = {
  ...activeStaff,
  id: 2,
  name: "이퇴사",
  phone: "01087654321",
  role: "TEACHER",
  position: "INSTRUCTOR",
  position_label: "강사",
  account_role: "TEACHER",
  is_active: false,
  pay_type: "MONTHLY",
  staff_work_types: [],
};

const adminDirectorStaff = {
  ...activeStaff,
  id: 3,
  name: "박철",
  phone: "01035023313",
  position: "DIRECTOR",
  position_label: "실장",
  account_role: "ADMIN",
  is_manager: false,
  can_manage_staff: true,
  staff_work_types: [],
};

async function seedAuth(page: Page) {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const token = localJwt();
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, token);
}

async function mockStaffApi(
  page: Page,
  options?: {
    lockFailure?: boolean;
    onStaffPatch?: (body: Record<string, unknown>) => void;
    onPasswordReset?: (body: Record<string, unknown>) => void;
    workRecords?: Array<Record<string, unknown>>;
    onWorkRecordPatch?: (id: number, body: Record<string, unknown>) => void;
    expenses?: Array<Record<string, unknown>>;
    onExpensePatch?: (id: number, body: Record<string, unknown>) => void;
    onExpenseDelete?: (id: number) => void;
    profileExpenses?: Array<Record<string, unknown>>;
    onProfileExpenseCreate?: (body: Record<string, unknown>) => void;
    onProfileExpenseDelete?: (id: number) => void;
  },
) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "/core/program/" && request.method() === "GET") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스", login_subtitle: "학원 관리 시스템" },
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/" && request.method() === "GET") {
      return json({
        id: 12,
        username: "t1_admin97",
        name: "관리자",
        phone: null,
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        linkedStudentId: null,
        linkedStudentName: null,
        linkedStudents: null,
        must_change_password: false,
      });
    }
    if (path === "/staffs/me/" && request.method() === "GET") {
      return json({
        is_authenticated: true,
        is_superuser: false,
        is_staff: true,
        is_payroll_manager: true,
        is_owner: true,
        owner_display_name: "박원장",
        owner_phone: "01011112222",
      });
    }
    if (path === "/staffs/currently-working/" && request.method() === "GET") {
      return json([]);
    }
    if (path === "/lectures/attendance/arrival-overview/" && request.method() === "GET") {
      return json({
        today: "2026-08-21",
        range_end: "2026-08-27",
        range_days: 7,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
        items: [],
      });
    }
    if (path === "/staffs/" && request.method() === "GET") {
      return json({
        count: 3,
        next: null,
        previous: null,
        results: [activeStaff, inactiveMonthlyStaff, adminDirectorStaff],
        owner: {
          id: null,
          name: "박원장",
          phone: "01011112222",
          role: "OWNER",
          position: "OWNER",
          position_label: "대표",
          account_role: "OWNER",
          is_owner: true,
          is_manager: true,
          can_manage_staff: true,
        },
      });
    }
    if (path === "/staffs/payroll-overview/" && request.method() === "GET") {
      return json({
        year: 2026,
        month: 8,
        date_from: "2026-08-01",
        date_to: "2026-08-31",
        totals: {
          staff_count: 2,
          work_hours: 28.5,
          work_amount: 342000,
          approved_expense_amount: 18000,
          pending_expense_amount: 30000,
          total_amount: 360000,
          needs_review_count: 1,
          closed_count: 1,
        },
        rows: [
          {
            staff_id: 1,
            name: "김조교",
            position: "ASSISTANT",
            position_label: "조교",
            account_role: "STAFF",
            is_active: true,
            can_manage_staff: false,
            pay_type: "HOURLY",
            work_hours: 24,
            work_amount: 288000,
            approved_expense_amount: 12000,
            pending_expense_amount: 30000,
            pending_expense_count: 1,
            total_amount: 300000,
            open_work_record_count: 0,
            incomplete_work_record_count: 0,
            assigned_work_type_count: 1,
            locked: false,
            snapshot_exists: false,
            settlement_status: "NEEDS_REVIEW",
            can_close: false,
          },
          {
            staff_id: 2,
            name: "이퇴사",
            position: "INSTRUCTOR",
            position_label: "강사",
            account_role: "TEACHER",
            is_active: false,
            can_manage_staff: false,
            pay_type: "HOURLY",
            work_hours: 4.5,
            work_amount: 54000,
            approved_expense_amount: 6000,
            pending_expense_amount: 0,
            pending_expense_count: 0,
            total_amount: 60000,
            open_work_record_count: 0,
            incomplete_work_record_count: 0,
            assigned_work_type_count: 0,
            locked: true,
            snapshot_exists: true,
            settlement_status: "CLOSED",
            can_close: false,
          },
        ],
      });
    }
    if (path === "/staffs/1/" && request.method() === "GET") {
      return json({
        ...activeStaff,
        user: 101,
        user_username: "assistant1",
        user_is_staff: true,
      });
    }
    if (path === "/staffs/3/" && request.method() === "GET") {
      return json({
        ...adminDirectorStaff,
        user: 103,
        user_username: "director-admin",
        user_is_staff: true,
      });
    }
    if (path === "/staffs/1/" && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      options?.onStaffPatch?.(body);
      return json({ ...activeStaff, ...body });
    }
    if (path === "/staffs/1/change-password/" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      options?.onPasswordReset?.(body);
      return json({ detail: "비밀번호가 변경되었습니다." });
    }
    if (path === "/staffs/1/summary/" && request.method() === "GET") {
      return json({
        staff_id: 1,
        work_hours: 24,
        work_amount: 288000,
        expense_amount: 12000,
        total_amount: 300000,
      });
    }
    if (path === "/staffs/3/summary/" && request.method() === "GET") {
      return json({
        staff_id: 3,
        work_hours: 0,
        work_amount: 0,
        expense_amount: 0,
        total_amount: 0,
      });
    }
    if (path === "/staffs/work-month-locks/" && request.method() === "GET") {
      if (options?.lockFailure) {
        return json({ detail: "temporary failure" }, 503);
      }
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path === "/staffs/work-records/" && request.method() === "GET") {
      const workRecords = options?.workRecords ?? [];
      return json({ count: workRecords.length, next: null, previous: null, results: workRecords });
    }
    const workRecordMatch = path.match(/^\/staffs\/work-records\/(\d+)\/$/);
    if (workRecordMatch && request.method() === "PATCH") {
      const id = Number(workRecordMatch[1]);
      const body = request.postDataJSON() as Record<string, unknown>;
      options?.onWorkRecordPatch?.(id, body);
      const existing = options?.workRecords?.find((record) => record.id === id) ?? {};
      return json({ ...existing, ...body, id, updated_at: "2026-08-22T03:00:00Z" });
    }
    if (path === "/staffs/expense-records/" && request.method() === "GET") {
      const expenses = options?.expenses ?? [];
      return json({ count: expenses.length, next: null, previous: null, results: expenses });
    }
    const expenseMatch = path.match(/^\/staffs\/expense-records\/(\d+)\/$/);
    if (expenseMatch && request.method() === "PATCH") {
      const id = Number(expenseMatch[1]);
      const body = request.postDataJSON() as Record<string, unknown>;
      options?.onExpensePatch?.(id, body);
      const existing = options?.expenses?.find((expense) => expense.id === id) ?? {};
      return json({ ...existing, ...body, id, updated_at: "2026-08-02T09:00:00Z" });
    }
    if (expenseMatch && request.method() === "DELETE") {
      const id = Number(expenseMatch[1]);
      options?.onExpenseDelete?.(id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (path === "/core/profile/expenses/" && request.method() === "GET") {
      return json(options?.profileExpenses ?? []);
    }
    if (path === "/core/profile/expenses/" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      options?.onProfileExpenseCreate?.(body);
      return json({ id: 91, ...body }, 201);
    }
    const profileExpenseMatch = path.match(/^\/core\/profile\/expenses\/(\d+)\/$/);
    if (profileExpenseMatch && request.method() === "DELETE") {
      const id = Number(profileExpenseMatch[1]);
      options?.onProfileExpenseDelete?.(id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (path === "/staffs/work-types/" && request.method() === "GET") {
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path === "/staffs/staff-work-types/" && request.method() === "GET") {
      return json({
        count: activeStaff.staff_work_types.length,
        next: null,
        previous: null,
        results: activeStaff.staff_work_types,
      });
    }
    if (path === "/staffs/payroll-snapshots/" && request.method() === "GET") {
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    return route.fallback();
  });
}

test.describe("직원 운영 계약", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test("급여 첫 화면에서 전 직원의 합계와 검토 항목을 바로 비교한다", async ({ page }) => {
    await mockStaffApi(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/staff/attendance?year=2026&month=8`, {
      waitUntil: "domcontentloaded",
    });

    const overview = page.getByTestId("staff-payroll-overview");
    await expect(overview.getByRole("heading", { name: "2026년 8월 급여판" })).toBeVisible();
    await expect(overview.getByText("360,000원", { exact: true }).first()).toBeVisible();
    await expect(overview.getByText("확인 필요").first()).toBeVisible();
    const overviewTable = overview.getByRole("table");
    await expect(overviewTable.getByText("비용 대기 1건")).toBeVisible();
    await expect(overviewTable.getByRole("button", { name: /김조교/ })).toBeVisible();
    await expect(overviewTable.getByRole("button", { name: /이퇴사/ })).toBeVisible();
    await page.screenshot({
      path: "test-results/staff-payroll-overview-1366.png",
      fullPage: true,
    });

    await overviewTable.getByRole("button", { name: /김조교/ }).click();
    await expect(page).toHaveURL(/staffId=1/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/workspace/staff/attendance?year=2026&month=8`, {
      waitUntil: "domcontentloaded",
    });
    const mobileOverview = page.getByTestId("staff-payroll-overview");
    await expect(mobileOverview).toBeVisible();
    await expect(mobileOverview.getByText("360,000원", { exact: true }).first()).toBeVisible();
    const mobileLayout = await page.evaluate(() => {
      const overview = document.querySelector<HTMLElement>("[data-testid='staff-payroll-overview']");
      return {
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        overviewTop: overview?.getBoundingClientRect().top ?? Number.MAX_SAFE_INTEGER,
        panelCount: document.querySelectorAll(".staff-workspace-grid > .staff-panel").length,
      };
    });
    expect(mobileLayout.fitsViewport).toBe(true);
    expect(mobileLayout.overviewTop).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(mobileLayout.panelCount).toBe(1);
    await mobileOverview.evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({
      path: "test-results/staff-payroll-overview-390.png",
      fullPage: false,
    });
  });

  test("실장 직위와 관리자 계정을 분리하고 고정 권한을 오해시키지 않는다", async ({ page }) => {
    await mockStaffApi(page);
    await page.goto(`${BASE}/workspace/staff/home`, {
      waitUntil: "domcontentloaded",
    });

    const directorRow = page.getByText("박철", { exact: true }).first().locator("xpath=ancestor::tr");
    await expect(directorRow.getByText("실장", { exact: true })).toBeVisible();
    await expect(directorRow.getByText("관리자 계정", { exact: true })).toBeVisible();
    await expect(directorRow.getByText("ON", { exact: true })).toBeVisible();
    await expect(directorRow.getByRole("button", { name: /권한/ })).toHaveCount(0);

    await directorRow.getByText("박철", { exact: true }).click();
    const detail = page.getByTestId("staff-detail-overlay");
    await expect(detail.locator("dl").getByText("직위", { exact: true }).locator("..")).toContainText("실장");
    await expect(detail.locator("dl").getByText("계정", { exact: true }).locator("..")).toContainText("관리자 계정");
    await expect(detail.getByRole("button", { name: "퇴사 처리" })).toHaveCount(0);
    await expect(detail.getByRole("button", { name: /권한 부여|권한 회수/ })).toHaveCount(0);

    await detail.getByRole("button", { name: "정보 수정" }).click();
    const editDialog = page.getByRole("dialog", { name: "직원 수정" });
    await expect(editDialog.getByText("관리자 계정", { exact: true })).toBeVisible();
    await expect(editDialog.getByText(/직원 화면에서 변경할 수 없습니다/)).toBeVisible();
    await page.screenshot({
      path: "test-results/staff-admin-director-edit-1366.png",
      fullPage: false,
    });
  });

  test("직원 추가에서 직위·계정·직원관리 권한을 분리해 선택한다", async ({ page }) => {
    await mockStaffApi(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/staff/home`, {
      waitUntil: "domcontentloaded",
    });

    await page.getByRole("button", { name: "직원 추가", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "직원 추가" });
    await expect(createDialog.getByRole("radiogroup", { name: "직위 선택" })).toBeVisible();
    await expect(createDialog.getByRole("radio", { name: /실장/ })).toBeVisible();
    await expect(createDialog.getByRole("radio", { name: /직원 계정/ })).toBeVisible();
    await expect(createDialog.getByText("직원관리 권한", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/staff-create-identity-1366.png",
      fullPage: false,
    });

    await page.keyboard.press("Escape");
    await expect(createDialog).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText("박철", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("실장 · 관리자 계정", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: "test-results/staff-home-identity-390.png",
      fullPage: false,
    });
    await page.getByRole("button", { name: "직원 추가", exact: true }).click();
    await expect(createDialog).toBeVisible();
    const bounds = await createDialog.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(390);
    await createDialog.evaluate((node) => {
      const body = node.querySelector<HTMLElement>(".ds-modal-body");
      if (body) body.scrollTop = 0;
    });
    await page.screenshot({
      path: "test-results/staff-create-identity-390.png",
      fullPage: false,
    });
  });

  test("퇴사·월급·정산 표시가 이력 보존형 계약을 따른다", async ({ page }) => {
    let patchBody: Record<string, unknown> | null = null;
    await mockStaffApi(page, {
      onStaffPatch: (body) => {
        patchBody = body;
      },
    });

    await page.goto(`${BASE}/workspace/staff/home`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("김조교", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("이퇴사", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("월급(수동 확인)", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "직원 목록 엑셀" })).toBeVisible();
    await expect(page.getByRole("button", { name: "이번 달 정산 엑셀" })).toBeVisible();
    await expect(page.getByText(/실지급|3\.3%/)).toHaveCount(0);

    await page.getByText("김조교", { exact: true }).first().click();
    const staffDetail = page.getByTestId("staff-detail-overlay");
    await expect(staffDetail).toBeVisible();
    await expect(staffDetail.getByRole("button", { name: "퇴사 처리" })).toBeVisible();
    await expect(staffDetail.getByRole("button", { name: "잘못 등록한 직원 삭제" })).toHaveCount(0);

    await staffDetail.getByRole("button", { name: "퇴사 처리" }).click();
    await page.getByRole("button", { name: "퇴사 처리" }).last().click();
    await expect.poll(() => patchBody).toEqual({ is_active: false });
  });

  test("직원 상세가 목록 위 팝업으로 열리고 동일한 위치로 닫힌다", async ({ page }) => {
    await mockStaffApi(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/staff/home`, {
      waitUntil: "domcontentloaded",
    });

    const staffName = page.getByText("김조교", { exact: true }).first();
    const staffRow = staffName.locator("xpath=ancestor::tr");
    await expect(staffRow).toBeVisible();
    await staffName.click();

    await expect(page).toHaveURL(/\/workspace\/staff\/1$/);
    const staffDetail = page.getByTestId("staff-detail-overlay");
    await expect(staffDetail).toBeVisible();
    await expect(staffDetail.getByRole("button", { name: "닫기" })).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await expect(staffRow).toBeVisible();
    await expect(staffDetail.getByLabel("재직 상태: 재직")).toBeVisible();
    await expect(staffDetail.getByRole("button", { name: "정보 수정" })).toBeVisible();
    await expect(staffDetail.getByRole("button", { name: "직원관리 권한 없음, 권한 부여" })).toBeVisible();
    const summaryTab = staffDetail.getByRole("tab", { name: "요약", exact: true });
    const workTypeTab = staffDetail.getByRole("tab", { name: "시급·근무유형", exact: true });
    await expect(summaryTab).toHaveAttribute("aria-selected", "true");
    await summaryTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(workTypeTab).toHaveAttribute("aria-selected", "true");
    await expect(workTypeTab).toBeFocused();
    await page.screenshot({
      path: "test-results/staff-detail-overlay-1366.png",
      fullPage: true,
    });

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/workspace\/staff\/home$/);
    await expect(page.getByTestId("staff-detail-overlay")).toHaveCount(0);
    await expect(staffRow).toBeVisible();
    await expect(staffRow).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await staffName.click();
    const mobileOverlay = page.getByTestId("staff-detail-overlay");
    await expect(mobileOverlay).toBeVisible();
    await expect(mobileOverlay.getByRole("heading", { name: "김조교" })).toBeVisible();
    const mobileLayout = await mobileOverlay.evaluate((overlay) => {
      const body = overlay.querySelector<HTMLElement>(".ds-overlay-body");
      const rect = overlay.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        overflowY: body ? getComputedStyle(body).overflowY : "missing",
      };
    });
    expect(mobileLayout.left).toBeGreaterThanOrEqual(0);
    expect(mobileLayout.right).toBeLessThanOrEqual(390);
    expect(mobileLayout.overflowY).toBe("auto");
    await expect(mobileOverlay.getByRole("tab", { name: "시급·근무유형" })).toHaveCSS("white-space", "nowrap");
    await page.screenshot({
      path: "test-results/staff-detail-overlay-390.png",
      fullPage: false,
    });
    await page.getByRole("button", { name: "닫기" }).click();
    await expect(page).toHaveURL(/\/workspace\/staff\/home$/);

    await page.goto(`${BASE}/workspace/staff/1`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("staff-detail-overlay")).toBeVisible();
    await expect(page.getByText("김조교", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "닫기" }).click();
    await expect(page).toHaveURL(/\/workspace\/staff\/home$/);

    await page.goto(`${BASE}/workspace/staff/attendance?staffId=1&year=2026&month=8`, {
      waitUntil: "domcontentloaded",
    });
    const workspaceDetailEntry = page.getByRole("button", { name: "김조교 직원 상세 열기" });
    await expect(workspaceDetailEntry).toBeVisible();
    await workspaceDetailEntry.click();
    await expect(page).toHaveURL(/\/workspace\/staff\/1$/);
    await expect(page.getByTestId("staff-detail-overlay")).toBeVisible();
    await page.getByTestId("staff-detail-overlay").getByRole("button", { name: "닫기" }).click();
    await expect(page).toHaveURL(/\/workspace\/staff\/attendance\?staffId=1&year=2026&month=8$/);
  });

  test("직원 비밀번호 설정은 선택한 한 계정의 재설정 API만 호출한다", async ({ page }) => {
    let passwordBody: Record<string, unknown> | undefined;
    await mockStaffApi(page, {
      onPasswordReset: (body) => { passwordBody = body; },
    });

    await page.goto(`${BASE}/workspace/staff/home`, {
      waitUntil: "domcontentloaded",
    });
    const staffCheckbox = page.getByRole("checkbox", { name: "김조교 선택" });
    await expect(staffCheckbox).toBeVisible({ timeout: 20_000 });
    await staffCheckbox.check();
    await expect(staffCheckbox).toBeChecked();
    await page.getByRole("button", { name: "비밀번호 변경", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "비밀번호 설정" });
    await expect(dialog.getByText(/변경하면 기존 로그인은 만료됩니다/)).toBeVisible();
    await expect(dialog.getByText(/즉시 로그인에 계속 사용할 수 있습니다/)).toBeVisible();
    await dialog.getByRole("button", { name: "안전한 비밀번호 만들기" }).click();
    const generatedPassword = await dialog.getByLabel("새 비밀번호", { exact: true }).inputValue();
    await expect(dialog.getByLabel("새 비밀번호 확인", { exact: true })).toHaveValue(generatedPassword);
    expect(generatedPassword).toHaveLength(12);
    expect(generatedPassword).toMatch(/[A-Z]/);
    expect(generatedPassword).toMatch(/[a-z]/);
    expect(generatedPassword).toMatch(/[2-9]/);
    expect(generatedPassword).not.toMatch(/[0O1Il]/);
    await dialog.getByRole("button", { name: "변경", exact: true }).click();

    await expect.poll(() => passwordBody).toEqual({
      password: generatedPassword,
    });
  });

  test("선결제 환급은 상태 합계·필터와 대기 건 수정·삭제를 한 흐름에서 처리한다", async ({ page }) => {
    const expenses = [
      {
        id: 31,
        staff: 1,
        staff_name: "김조교",
        date: "2026-08-01",
        title: "교재 구입",
        amount: 30000,
        memo: "영수증 있음",
        status: "PENDING",
        approved_at: null,
        approved_by: null,
        approved_by_name: null,
        created_at: "2026-08-01T01:00:00Z",
        updated_at: "2026-08-01T01:00:00Z",
      },
      {
        id: 32,
        staff: 1,
        staff_name: "김조교",
        date: "2026-08-02",
        title: "교통비",
        amount: 12000,
        memo: "",
        status: "APPROVED",
        approved_at: "2026-08-02T02:00:00Z",
        approved_by: 9,
        approved_by_name: "박원장",
        created_at: "2026-08-02T01:00:00Z",
        updated_at: "2026-08-02T02:00:00Z",
      },
      {
        id: 33,
        staff: 1,
        staff_name: "김조교",
        date: "2026-08-03",
        title: "개인 물품",
        amount: 5000,
        memo: "환급 대상 아님",
        status: "REJECTED",
        approved_at: "2026-08-03T02:00:00Z",
        approved_by: 9,
        approved_by_name: "박원장",
        created_at: "2026-08-03T01:00:00Z",
        updated_at: "2026-08-03T02:00:00Z",
      },
    ];
    let patched: { id: number; body: Record<string, unknown> } | null = null;
    let deletedId: number | null = null;
    let nativeDialogCount = 0;
    page.on("dialog", async (dialog) => {
      nativeDialogCount += 1;
      await dialog.dismiss();
    });
    await mockStaffApi(page, {
      expenses,
      onExpensePatch: (id, body) => { patched = { id, body }; },
      onExpenseDelete: (id) => { deletedId = id; },
    });

    await page.goto(`${BASE}/workspace/staff/expenses?staffId=1&year=2026&month=8`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("button", { name: /전체 3건 · 47,000원/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /대기 1건 · 30,000원/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /승인 1건 · 12,000원/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /반려 1건 · 5,000원/ })).toBeVisible();

    await page.getByRole("button", { name: /대기 1건/ }).click();
    await expect(page.getByTestId("staff-expense-31")).toBeVisible();
    await expect(page.getByTestId("staff-expense-32")).toHaveCount(0);

    const pendingRow = page.getByTestId("staff-expense-31");
    await pendingRow.getByRole("button", { name: "수정" }).click();
    const editModal = page.getByRole("dialog", { name: "선결제 환급 수정" });
    await expect(editModal).toBeVisible();
    await editModal.getByLabel("금액(원) *").fill("35000");
    await editModal.getByLabel("항목 *").focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => patched).toEqual({
      id: 31,
      body: {
        date: "2026-08-01",
        title: "교재 구입",
        amount: 35000,
        memo: "영수증 있음",
      },
    });

    await pendingRow.getByRole("button", { name: "삭제" }).click();
    const confirmDialog = page.getByRole("alertdialog", { name: "선결제 환급 삭제" });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole("button", { name: "삭제" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirmDialog.getByRole("button", { name: "취소" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirmDialog.getByRole("button", { name: "삭제" })).toBeFocused();
    await confirmDialog.getByRole("button", { name: "삭제" }).click();
    await expect.poll(() => deletedId).toBe(31);
    expect(nativeDialogCount).toBe(0);

    await page.getByRole("button", { name: /전체 3건/ }).click();
    const approvedRow = page.getByTestId("staff-expense-32");
    await expect(approvedRow.getByText("처리 완료된 환급은 이력 보존을 위해 수정·삭제할 수 없습니다.")).toBeVisible();
    await expect(approvedRow.getByRole("button", { name: "수정" })).toHaveCount(0);
    await expect(approvedRow.getByPlaceholder("메모")).toHaveCount(0);
    await page.screenshot({
      path: "test-results/staff-expenses-optimized-1366.png",
      fullPage: true,
    });
  });

  test("미마감 월의 조교 근무 기록을 수정하면 기존 PATCH 계약으로 저장한다", async ({ page }) => {
    const workRecords = [
      {
        id: 41,
        staff: 1,
        staff_name: "김조교",
        work_type: 21,
        work_type_name: "채점",
        date: "2026-08-21",
        start_time: "14:00",
        end_time: "18:00",
        break_minutes: 0,
        work_hours: 4,
        amount: 48000,
        memo: "출근 입력 누락 보정",
        created_at: "2026-08-21T09:00:00Z",
        updated_at: "2026-08-21T09:00:00Z",
      },
    ];
    let patched: { id: number; body: Record<string, unknown> } | null = null;
    await mockStaffApi(page, {
      workRecords,
      onWorkRecordPatch: (id, body) => { patched = { id, body }; },
    });

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/staff/attendance?staffId=1&year=2026&month=8`, {
      waitUntil: "domcontentloaded",
    });

    const row = page.getByTestId("staff-work-record-41");
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "수정" }).click();

    const dialog = page.getByRole("dialog", { name: "근무 기록 수정" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("근무유형 *", { exact: true })).toHaveValue("21");
    await page.screenshot({
      path: "test-results/staff-work-record-edit-1366.png",
      fullPage: false,
    });
    await dialog.getByLabel("종료 시간 *", { exact: true }).fill("19:30");
    await dialog.getByLabel("휴게시간(분)", { exact: true }).fill("30");
    await dialog.getByLabel("메모", { exact: true }).fill("퇴근 기록 보정");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await expect.poll(() => patched).toEqual({
      id: 41,
      body: {
        work_type: 21,
        date: "2026-08-21",
        start_time: "14:00",
        end_time: "19:30",
        break_minutes: 30,
        memo: "퇴근 기록 보정",
      },
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await row.getByRole("button", { name: "수정" }).click();
    const mobileDialog = page.getByRole("dialog", { name: "근무 기록 수정" });
    await expect(mobileDialog).toBeVisible();
    const mobileBounds = await mobileDialog.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    expect(mobileBounds.left).toBeGreaterThanOrEqual(0);
    expect(mobileBounds.right).toBeLessThanOrEqual(390);
    expect(mobileBounds.width).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: "test-results/staff-work-record-edit-390.png",
      fullPage: false,
    });
  });

  test("개인 지출도 공용 모달의 이름·Enter 저장·확인창 계약을 따른다", async ({ page }) => {
    let createdBody: Record<string, unknown> | null = null;
    let deletedId: number | null = null;
    await mockStaffApi(page, {
      profileExpenses: [
        {
          id: 81,
          date: "2026-08-01",
          title: "개인 교통비",
          amount: 8000,
          memo: "버스",
        },
      ],
      onProfileExpenseCreate: (body) => { createdBody = body; },
      onProfileExpenseDelete: (id) => { deletedId = id; },
    });

    await page.goto(`${BASE}/workspace/profile/expense`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("개인 교통비", { exact: true })).toBeVisible();
    const createTrigger = page.getByRole("button", { name: "지출 등록" });
    await createTrigger.click();

    const createDialog = page.getByRole("dialog", { name: "지출 등록" });
    await expect(createDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(createDialog).toHaveCount(0);
    await expect(createTrigger).toBeFocused();

    await createTrigger.click();
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("항목").fill("교재 배송비");
    await createDialog.getByLabel("금액").fill("4500");
    await createDialog.getByLabel("메모 (선택)").fill("택배");
    await createDialog.getByLabel("금액").focus();
    await page.keyboard.press("Enter");

    await expect.poll(() => createdBody).toEqual({
      date: expect.stringMatching(/^2026-08-\d{2}$/),
      title: "교재 배송비",
      amount: 4500,
      memo: "택배",
    });
    await expect(createDialog).toHaveCount(0);

    await page.getByRole("button", { name: "개인 교통비 지출 삭제" }).click();
    const deleteDialog = page.getByRole("alertdialog", { name: "지출 삭제" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "삭제" }).click();
    await expect.poll(() => deletedId).toBe(81);
  });

  test("마감 상태 조회 실패 시 쓰기를 막고 반응형으로 쌓인다", async ({ page }) => {
    await mockStaffApi(page, { lockFailure: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(
      `${BASE}/workspace/staff/month-lock?staffId=1&year=2026&month=7`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(
      page.getByText("마감 상태를 확인하지 못해 안전을 위해 작업을 막았습니다."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "다시 확인" })).toBeVisible();
    await expect(page.getByText("공제 전 합계 300,000원")).toBeVisible();
    await page.getByRole("tab", { name: "비용/경비 탭" }).click();
    await expect(page.getByText("마감 상태를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.")).toBeVisible();
    await expect(page.getByRole("button", { name: "추가" }).first()).toBeDisabled();
    await expect(page.getByText(/실지급|3\.3%/)).toHaveCount(0);

    await page.screenshot({
      path: "test-results/staff-operations-1366.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 1024, height: 900 });
    const columns = await page.locator(".staff-workspace-grid").evaluate((node) =>
      getComputedStyle(node).gridTemplateColumns,
    );
    expect(columns.trim().split(/\s+/)).toHaveLength(1);
    await page.screenshot({
      path: "test-results/staff-operations-1024.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 1100, height: 900 });
    const mediumColumns = await page.locator(".staff-workspace-grid").evaluate((node) =>
      getComputedStyle(node).gridTemplateColumns,
    );
    expect(mediumColumns.trim().split(/\s+/)).toHaveLength(1);
    await page.screenshot({
      path: "test-results/staff-operations-1100.png",
      fullPage: true,
    });
  });
});
