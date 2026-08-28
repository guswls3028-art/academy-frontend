import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

type TenantRole = "owner" | "admin" | "teacher";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

function subscriptionFixture() {
  return {
    plan: "all",
    plan_display: "전체 기능",
    monthly_price: 180_000,
    original_price: 180_000,
    is_promo: false,
    discount_rate: 0,
    subscription_status: "active",
    subscription_status_display: "이용 중",
    subscription_started_at: "2026-08-01",
    subscription_expires_at: "2026-09-01",
    is_subscription_active: true,
    days_remaining: 30,
    billing_email: "owner@example.test",
    billing_mode: "INVOICE_REQUEST",
    next_billing_at: "2026-09-01",
    cancel_at_period_end: false,
    canceled_at: null,
    tenant_code: "hakwonplus",
    tenant_name: "테스트 학원",
  };
}

async function installApi(
  page: Page,
  options: {
    role: TenantRole;
    cardsStatus?: number;
    consultStatuses?: number[];
    consultFailure?: boolean;
    consultPatchStatus?: number;
    consultFailureAfterPatch?: boolean;
  },
) {
  let cardRequests = 0;
  let consultRequests = 0;
  let consultPatchRequests = 0;
  let consultFailing = options.consultFailure === true;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: false,
        display_name: "테스트 학원",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: `${options.role}-user`,
        name: options.role === "admin" ? "관리자님" : options.role === "owner" ? "김원장" : "김강사",
        phone: null,
        is_staff: true,
        is_superuser: false,
        tenantRole: options.role,
        must_change_password: false,
        first_login_guide_required: false,
      });
    }
    if (path === "/lectures/sessions/" && url.searchParams.get("include_progress") === "1") {
      return json({
        count: 1,
        results: [{
          id: 77,
          lecture: 9,
          order: 1,
          title: "1차시",
          date: "2026-08-18",
          lecture_title: "수학 A반",
          start_time: "16:00:00",
          attendance_filled: 0,
          attendance_total: 12,
        }],
      });
    }
    if (path === "/lectures/sessions/77/") {
      return json({
        id: 77,
        lecture: 9,
        order: 1,
        title: "1차시",
        date: "2026-08-18",
        lecture_title: "수학 A반",
      });
    }
    if (path === "/lectures/attendance/" && url.searchParams.get("session") === "77") {
      return json({
        count: 1,
        results: [{
          id: 501,
          enrollment: 801,
          student_id: 1001,
          student_name: "미입력 학생",
          status: "UNSET",
        }],
      });
    }
    if (path === "/enrollments/session-enrollments/") {
      return json({
        count: 1,
        results: [{
          id: 901,
          session: 77,
          enrollment: 801,
          student_id: 1001,
          student_name: "미입력 학생",
        }],
      });
    }
    if (path === "/core/subscription/") return json(subscriptionFixture());
    if (path === "/billing/cards/") {
      cardRequests += 1;
      if (options.cardsStatus && options.cardsStatus !== 200) {
        return json({ detail: "temporary failure" }, options.cardsStatus);
      }
      return json([]);
    }
    if (path === "/core/landing/admin/consult/" && request.method() === "GET") {
      consultRequests += 1;
      if (consultFailing) return json({ detail: "temporary consult failure" }, 503);
      const status = options.consultStatuses?.shift() ?? 200;
      if (status !== 200) return json({ detail: "temporary consult failure" }, status);
      return json({
        summary: { total: 1, unread: 1 },
        items: [{
          id: 41,
          name: "상담 보호자",
          phone: "010-0000-0000",
          interest: "중등 수학",
          message: "상담 요청",
          source: "landing",
          read_at: null,
          admin_memo: "",
          created_at: "2026-08-27T00:00:00Z",
        }],
      });
    }
    if (path === "/core/landing/admin/consult/41/" && request.method() === "PATCH") {
      consultPatchRequests += 1;
      const status = options.consultPatchStatus ?? 200;
      if (status !== 200) return json({ detail: "상태 저장 실패" }, status);
      if (options.consultFailureAfterPatch) consultFailing = true;
      return json({ ok: true });
    }
    if (path === "/lectures/attendance/arrival-overview/") {
      return json({
        generated_at: "2026-08-18T09:00:00+09:00",
        today: "2026-08-18",
        tomorrow: "2026-08-19",
        range_end: "2026-08-20",
        range_days: 3,
        soon_window_minutes: 60,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
        items: [],
      });
    }
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0 });
    if (path === "/community/notifications/unread-count/") return json({ count: 0 });
    if (path === "/community/admin/reports/pending-count/") return json({ count: 0 });
    return json({ count: 0, results: [] });
  });

  return {
    cardRequests: () => cardRequests,
    consultRequests: () => consultRequests,
    consultPatchRequests: () => consultPatchRequests,
    recoverConsult: () => { consultFailing = false; },
  };
}

async function installAuth(page: Page) {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

test.use({ serviceWorkers: "block" });
test.skip(
  !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
  "선생님 업무 route-mock 검증은 로컬 dev 서버 전용",
);

test("관리자는 오늘 업무 합계를 일관되게 보고 학원장 전용 API를 호출하지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuth(page);
  const apiState = await installApi(page, { role: "admin" });

  await gotoAndSettle(page, `${BASE}/workspace/mobile`);

  await expect(page.getByText("안녕하세요, 관리자님", { exact: true })).toBeVisible();
  await expect(page.getByText("오늘 업무 12건", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "출결 미입력 12건 처리하기" })).toBeVisible();
  await expect(page.getByText("처리 대기함이 비었습니다", { exact: true })).toHaveCount(0);
  await expect(page.getByText("정리됨", { exact: true })).toHaveCount(0);
  expect(apiState.consultRequests()).toBe(0);

  const targets = page.locator("main button:visible, main [role=button]:visible");
  const targetCount = await targets.count();
  expect(targetCount).toBeGreaterThan(0);
  for (let index = 0; index < targetCount; index += 1) {
    const box = await targets.nth(index).boundingBox();
    expect(box?.height ?? 0, `touch target ${index}`).toBeGreaterThanOrEqual(43.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "메뉴" }).click();
  const drawer = page.getByRole("navigation", { name: "선생님 메뉴" });
  await expect(drawer.getByText("결제 / 구독", { exact: true })).toHaveCount(0);

  await gotoAndSettle(page, `${BASE}/workspace/mobile/billing`);
  await expect(page.getByText("접근 권한이 없습니다", { exact: true })).toBeVisible();
  expect(apiState.cardRequests()).toBe(0);
});

test("학원장은 결제 메뉴를 사용하고 카드 실패를 빈 목록과 구분한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await installAuth(page);
  const apiState = await installApi(page, { role: "owner", cardsStatus: 503 });

  await gotoAndSettle(page, `${BASE}/workspace/mobile/billing`);

  await expect(page.getByRole("heading", { name: "결제 / 구독", exact: true })).toBeVisible();
  await expect(page.getByText("카드 정보를 불러오지 못했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByText("등록된 카드가 없습니다.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  expect(apiState.cardRequests()).toBeGreaterThan(0);
  expect(apiState.consultRequests()).toBeGreaterThan(0);

  const sidebar = page.getByRole("navigation", { name: "선생님 메뉴" });
  const adminGroup = sidebar.getByRole("button", { name: /관리자 전용/ });
  if (await adminGroup.getAttribute("aria-expanded") !== "true") await adminGroup.click();
  await expect(sidebar.getByText("결제 / 구독", { exact: true })).toBeVisible();
});

test("차시 상세은 UNSET 출결을 미입력으로 표시한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuth(page);
  await installApi(page, { role: "teacher" });

  await gotoAndSettle(page, `${BASE}/workspace/mobile/classes/9/sessions/77`);
  await page.getByRole("button", { name: "출석", exact: true }).click();

  await expect(page.getByText("미입력", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("UNSET", { exact: true })).toHaveCount(0);
});

test("넓은 데스크톱에서는 선생님 업무 캔버스를 충분히 사용한다", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installAuth(page);
  await installApi(page, { role: "owner" });

  await gotoAndSettle(page, `${BASE}/workspace/mobile`);

  const contentBox = await page.locator("main > div").boundingBox();
  expect(contentBox?.width ?? 0).toBeGreaterThanOrEqual(1280);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("상담 수신함은 초기 오류를 빈 목록이나 영구 로딩으로 숨기지 않고 재시도한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuth(page);
  const apiState = await installApi(page, { role: "owner", consultFailure: true });

  await gotoAndSettle(page, `${BASE}/workspace/settings/consult`);
  await expect.poll(apiState.consultRequests).toBeGreaterThan(0);
  await expect(page.getByRole("alert")).toContainText("temporary consult failure");
  await expect(page.getByText("불러오는 중…", { exact: true })).toHaveCount(0);
  apiState.recoverConsult();
  const retryButton = page.getByRole("button", { name: "다시 시도" });
  expect((await retryButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  await retryButton.click();
  await expect(page.getByText("상담 보호자", { exact: true })).toBeVisible();
  const actionButtons = page.locator("main button:visible");
  for (let index = 0; index < await actionButtons.count(); index += 1) {
    expect((await actionButtons.nth(index).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(apiState.consultRequests()).toBeGreaterThanOrEqual(2);
});

test("상담 수신함 직접 URL은 owner/admin 밖에서 API 호출 전에 차단한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuth(page);
  const apiState = await installApi(page, { role: "teacher" });

  await gotoAndSettle(page, `${BASE}/workspace/settings/consult`);
  await expect(page.getByText("접근 권한이 없습니다", { exact: true })).toBeVisible();
  expect(apiState.consultRequests()).toBe(0);
});

test("상담 수신함 mutation 오류를 사용자에게 알리고 항목을 유지한다", async ({ page }) => {
  await installAuth(page);
  await installApi(page, { role: "owner", consultPatchStatus: 503 });

  await gotoAndSettle(page, `${BASE}/workspace/settings/consult`);
  await page.getByRole("button", { name: "읽음으로 표시" }).click();
  await expect(page.getByRole("alert")).toContainText("상태 저장 실패");
  await expect(page.getByText("상담 보호자", { exact: true })).toBeVisible();
});

test("상담 수신함은 PATCH 성공 뒤 재조회 실패 시 stale 항목과 mutation을 잠그고 재시도한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuth(page);
  const apiState = await installApi(page, {
    role: "owner",
    consultFailureAfterPatch: true,
  });

  await gotoAndSettle(page, `${BASE}/workspace/settings/consult`);
  await expect(page.getByText("상담 보호자", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "읽음으로 표시" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ 메모 추가" })).toBeVisible();

  await page.getByRole("button", { name: "읽음으로 표시" }).click();
  await expect.poll(apiState.consultPatchRequests).toBe(1);
  const readFailure = page.getByRole("alert").filter({ hasText: "temporary consult failure" });
  await expect(readFailure).toBeVisible();
  await expect(readFailure.getByRole("button", { name: "다시 시도" })).toBeVisible();
  await expect(page.getByText("상담 보호자", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /전체 1/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "읽음으로 표시" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ 메모 추가" })).toHaveCount(0);
  expect(apiState.consultPatchRequests()).toBe(1);

  apiState.recoverConsult();
  await readFailure.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("상담 보호자", { exact: true })).toBeVisible();
  await expect.poll(apiState.consultRequests).toBeGreaterThanOrEqual(3);
  expect(apiState.consultPatchRequests()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
