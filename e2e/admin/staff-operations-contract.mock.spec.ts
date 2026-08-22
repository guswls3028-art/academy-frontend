import { expect, test } from "../fixtures/strictTest";
import type { Page, Route } from "@playwright/test";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

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
  is_active: true,
  is_manager: false,
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
  is_active: false,
  pay_type: "MONTHLY",
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
    onWorkRecordsFetch?: () => void;
    onWorkRecordPatch?: (id: number, body: Record<string, unknown>) => void;
    expenses?: Array<Record<string, unknown>>;
    onExpensesFetch?: () => void;
    onExpensePatch?: (id: number, body: Record<string, unknown>) => void;
    onExpenseDelete?: (id: number) => void;
    onWorkMonthLock?: (body: Record<string, unknown>) => void;
    profileExpenses?: Array<Record<string, unknown>>;
    onProfileExpenseCreate?: (body: Record<string, unknown>) => void;
    onProfileExpenseDelete?: (id: number) => void;
  },
) {
  let workMonthLocked = false;
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
    if (
      (path === "/clinic/participants/" ||
        path === "/community/admin/posts/" ||
        path === "/students/registration_requests/" ||
        path === "/submissions/submissions/pending/") &&
      request.method() === "GET"
    ) {
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path === "/results/admin/teacher-dashboard-counts/" && request.method() === "GET") {
      return json({ video_failed: 0 });
    }
    if (
      (path === "/community/admin/reports/pending-count/" ||
        path === "/community/notifications/unread-count/") &&
      request.method() === "GET"
    ) {
      return json({ count: 0 });
    }
    if (path === "/results/admin/clinic-targets/" && request.method() === "GET") {
      return json([]);
    }
    if (path === "/staffs/" && request.method() === "GET") {
      return json({
        count: 2,
        next: null,
        previous: null,
        results: [activeStaff, inactiveMonthlyStaff],
        owner: {
          id: null,
          name: "박원장",
          phone: "01011112222",
          role: "OWNER",
          is_owner: true,
        },
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
    if (path === "/staffs/work-month-locks/" && request.method() === "GET") {
      if (options?.lockFailure) {
        return json({ detail: "temporary failure" }, 503);
      }
      const results = workMonthLocked
        ? [{
            id: 71,
            staff: 1,
            staff_name: "김조교",
            year: 2026,
            month: 8,
            is_locked: true,
            locked_by: 12,
            locked_by_name: "관리자",
            created_at: "2026-08-22T04:00:00Z",
          }]
        : [];
      return json({ count: results.length, next: null, previous: null, results });
    }
    if (path === "/staffs/work-month-locks/" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      workMonthLocked = true;
      options?.onWorkMonthLock?.(body);
      return json({
        id: 71,
        staff: 1,
        staff_name: "김조교",
        year: 2026,
        month: 8,
        is_locked: true,
        locked_by: 12,
        locked_by_name: "관리자",
        created_at: "2026-08-22T04:00:00Z",
      }, 201);
    }
    if (path === "/staffs/work-records/" && request.method() === "GET") {
      options?.onWorkRecordsFetch?.();
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
      options?.onExpensesFetch?.();
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

  test("퇴사·월급·정산 표시가 이력 보존형 계약을 따른다", async ({ page }) => {
    let patchBody: Record<string, unknown> | null = null;
    await mockStaffApi(page, {
      onStaffPatch: (body) => {
        patchBody = body;
      },
    });

    await gotoAndSettle(page, `${BASE}/workspace/staff/home`, {
      timeout: 30_000,
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
    await expect(staffDetail.getByRole("button", { name: "관리자 권한 없음, 권한 부여" })).toBeVisible();
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

  test("직원 상세 근무기록에서도 잘못 입력한 기록을 바로 수정한다", async ({ page }) => {
    const workRecords = [
      {
        id: 42,
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

    await gotoAndSettle(page, `${BASE}/workspace/staff/home`, {
      timeout: 30_000,
    });
    const staffName = page.getByText("김조교", { exact: true }).first();
    await expect(staffName).toBeVisible({ timeout: 20_000 });
    await staffName.click();

    const staffDetail = page.getByTestId("staff-detail-overlay");
    await staffDetail.getByRole("tab", { name: "근무기록", exact: true }).click();
    const row = staffDetail.getByTestId("staff-work-record-42");
    await expect(row).toBeVisible();
    await expect(staffDetail.getByRole("button", { name: "추가", exact: true })).toBeVisible();
    await row.getByRole("button", { name: "수정", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "근무 기록 수정" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("메모", { exact: true }).fill("퇴근 기록 보정");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await expect.poll(() => patched).toEqual({
      id: 42,
      body: {
        work_type: 21,
        date: "2026-08-21",
        start_time: "14:00",
        end_time: "18:00",
        break_minutes: 0,
        memo: "퇴근 기록 보정",
      },
    });
    await expect(dialog).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverlayBody = staffDetail.locator(".ds-overlay-body");
    const mobileOverlayOverflow = await mobileOverlayBody.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }));
    expect(mobileOverlayOverflow.scrollWidth).toBeLessThanOrEqual(
      mobileOverlayOverflow.clientWidth,
    );
    const mobileRowLayout = await row.evaluate((node) => {
      const rowRect = node.getBoundingClientRect();
      const summary = node.querySelector<HTMLElement>(
        '[data-testid="staff-work-record-summary"]',
      );
      const summaryRect = summary?.getBoundingClientRect();
      return {
        height: rowRect.height,
        summaryWidth: summaryRect?.width ?? 0,
      };
    });
    expect(mobileRowLayout.height).toBeLessThanOrEqual(240);
    expect(mobileRowLayout.summaryWidth).toBeGreaterThanOrEqual(200);
    await page.screenshot({
      path: "test-results/staff-detail-work-records-390.png",
      fullPage: false,
    });
    await row.getByRole("button", { name: "수정", exact: true }).click();
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
      path: "test-results/staff-detail-work-record-edit-390.png",
      fullPage: false,
    });
  });

  test("직원 상세 비용에서도 대기 환급을 본 화면과 같은 계약으로 수정한다", async ({ page }) => {
    const expenses = [
      {
        id: 34,
        staff: 1,
        staff_name: "김조교",
        date: "2026-08-02",
        title: "교재 배송비",
        amount: 12000,
        memo: "영수증 확인",
        status: "PENDING",
        approved_at: null,
        approved_by: null,
        approved_by_name: null,
        created_at: "2026-08-02T01:00:00Z",
        updated_at: "2026-08-02T01:00:00Z",
      },
    ];
    let patched: { id: number; body: Record<string, unknown> } | null = null;
    await mockStaffApi(page, {
      expenses,
      onExpensePatch: (id, body) => { patched = { id, body }; },
    });

    await gotoAndSettle(page, `${BASE}/workspace/staff/home`, {
      timeout: 30_000,
    });
    const staffName = page.getByText("김조교", { exact: true }).first();
    await expect(staffName).toBeVisible({ timeout: 20_000 });
    await staffName.click();

    const staffDetail = page.getByTestId("staff-detail-overlay");
    await staffDetail.getByRole("tab", { name: "비용", exact: true }).click();
    const row = staffDetail.getByTestId("staff-expense-34");
    await expect(row).toBeVisible();
    await expect(staffDetail.getByRole("button", { name: "추가", exact: true })).toBeVisible();
    await expect(staffDetail.getByRole("button", { name: /전체 1건 · 12,000원/ })).toBeVisible();
    await row.getByRole("button", { name: "수정", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "선결제 환급 수정" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("금액(원) *").fill("15000");
    await dialog.getByLabel("항목 *").focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => patched).toEqual({
      id: 34,
      body: {
        date: "2026-08-02",
        title: "교재 배송비",
        amount: 15000,
        memo: "영수증 확인",
      },
    });
    await expect(dialog).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await row.evaluate((node) => {
      const rowRect = node.getBoundingClientRect();
      const summary = node.querySelector<HTMLElement>('[data-testid="staff-expense-summary"]');
      const summaryRect = summary?.getBoundingClientRect();
      return {
        height: rowRect.height,
        summaryWidth: summaryRect?.width ?? 0,
      };
    });
    expect(mobileLayout.height).toBeLessThanOrEqual(420);
    expect(mobileLayout.summaryWidth).toBeGreaterThanOrEqual(200);
    const mobileOverlayBody = staffDetail.locator(".ds-overlay-body");
    const mobileOverflow = await mobileOverlayBody.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }));
    expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.clientWidth);
    await page.screenshot({
      path: "test-results/staff-detail-expenses-390.png",
      fullPage: false,
    });
  });

  test("월 마감 뒤 필터 키를 포함한 근태·비용 목록을 즉시 갱신한다", async ({ page }) => {
    let workRecordFetches = 0;
    let expenseFetches = 0;
    let lockBody: Record<string, unknown> | null = null;
    await mockStaffApi(page, {
      onWorkRecordsFetch: () => {
        workRecordFetches += 1;
      },
      onExpensesFetch: () => {
        expenseFetches += 1;
      },
      onWorkMonthLock: (body) => {
        lockBody = body;
      },
    });

    const query = "staffId=1&year=2026&month=8";
    await gotoAndSettle(page, `${BASE}/workspace/staff/attendance?${query}`, {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "월 전체 근무 기록" })).toBeVisible({
      timeout: 20_000,
    });
    await expect.poll(() => workRecordFetches).toBeGreaterThan(0);

    await page.getByRole("tab", { name: "비용/경비 탭" }).click();
    await expect(page.getByRole("heading", { name: "직원 선결제 환급" })).toBeVisible({
      timeout: 20_000,
    });
    await expect.poll(() => expenseFetches).toBeGreaterThan(0);

    await page.getByRole("tab", { name: "월 마감 탭" }).click();
    const monthLockButton = page.getByRole("button", { name: "월 마감", exact: true });
    await expect(monthLockButton).toBeVisible({ timeout: 30_000 });
    const workFetchesBeforeLock = workRecordFetches;
    const expenseFetchesBeforeLock = expenseFetches;
    await monthLockButton.click();
    const confirmDialog = page.getByRole("alertdialog", { name: "2026년 8월 마감" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "월 마감", exact: true }).click();
    await expect.poll(() => lockBody).toEqual({ staff: 1, year: 2026, month: 8 });
    await expect(page.getByText("이 달은 마감되었습니다.")).toBeVisible();
    await expect.poll(() => workRecordFetches).toBeGreaterThan(workFetchesBeforeLock);
    await expect.poll(() => expenseFetches).toBeGreaterThan(expenseFetchesBeforeLock);
  });

  test("직원 임시 비밀번호 설정은 선택한 한 계정의 강제 초기화 API만 호출한다", async ({ page }) => {
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

    const dialog = page.getByRole("dialog", { name: "임시 비밀번호 설정" });
    await expect(dialog.getByText(/변경하면 기존 로그인은 만료됩니다/)).toBeVisible();
    await dialog.getByRole("button", { name: "안전한 비밀번호 만들기" }).click();
    const generatedPassword = await dialog.getByLabel("새 임시 비밀번호", { exact: true }).inputValue();
    await expect(dialog.getByLabel("새 임시 비밀번호 확인", { exact: true })).toHaveValue(generatedPassword);
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

    await gotoAndSettle(page, `${BASE}/workspace/profile/expense`, {
      timeout: 30_000,
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
