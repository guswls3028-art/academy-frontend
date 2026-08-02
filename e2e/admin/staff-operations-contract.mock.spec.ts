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
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path === "/staffs/work-records/" && request.method() === "GET") {
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path === "/staffs/expense-records/" && request.method() === "GET") {
      return json({ count: 0, next: null, previous: null, results: [] });
    }
    if (path === "/staffs/work-types/" && request.method() === "GET") {
      return json({ count: 0, next: null, previous: null, results: [] });
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

  test("마감 상태 조회 실패 시 쓰기를 막고 반응형으로 쌓인다", async ({ page }) => {
    await mockStaffApi(page, { lockFailure: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(
      `${BASE}/workspace/staff/month-lock?staffId=1&year=2026&month=7`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(page.getByText("마감 상태를 확인하지 못해 안전을 위해 작업을 막았습니다.")).toBeVisible();
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
