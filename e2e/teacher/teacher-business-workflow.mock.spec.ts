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
  options: { role: TenantRole; cardsStatus?: number },
) {
  let cardRequests = 0;
  let consultRequests = 0;

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
    if (path === "/core/landing/admin/consult/") {
      consultRequests += 1;
      return json({ summary: { unread: 0 } });
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
