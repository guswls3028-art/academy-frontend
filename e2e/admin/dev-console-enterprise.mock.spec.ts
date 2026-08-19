import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function createE2eJwt(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 })).toString("base64url");
  return `e30.${payload}.e2e`;
}

async function stubDashboard(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "mock-platform-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, createE2eJwt());

  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}",
  }));
  await page.route("**/api/v1/core/program/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      tenantCode: "hakwonplus",
      display_name: "학원플러스",
      ui_config: { primary_color: "#2563eb" },
      feature_flags: {},
      is_active: true,
      isPlatformAdmin: true,
    }),
  }));
  await page.route("**/api/v1/core/me/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: 1,
      username: "platform-owner",
      name: "Platform Owner",
      is_staff: true,
      is_superuser: false,
      tenantRole: "owner",
      must_change_password: false,
      first_login_guide_required: false,
    }),
  }));
  await page.route("**/api/v1/core/dev/dashboard/", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      tenants: {
        total: 42,
        active: 38,
        inactive: 4,
        new_7d: 3,
        signup_series_30d: [
          { date: new Date().toISOString().slice(0, 10), count: 2 },
        ],
      },
      billing: {
        mrr: 12800000,
        mrr_supply_amount: 12800000,
        expiring_7d: 4,
        overdue_invoices: 2,
        paid_30d: 15400000,
      },
      inbox: { total: 17, unanswered: 5 },
      users: { total: 4218, signups_7d: 86 },
      audit: {
        failed_24h: 1,
        recent: [
          {
            id: 901,
            created_at: new Date(Date.now() - 7 * 60000).toISOString(),
            actor: "platform-owner",
            action: "tenant.subscription.extend",
            summary: "godmin 구독을 365일 연장",
            result: "success",
            tenant_code: "godmin",
            tenant_name: "신과함께",
          },
          {
            id: 902,
            created_at: new Date(Date.now() - 24 * 60000).toISOString(),
            actor: "system",
            action: "cron.cleanup",
            summary: "잔재 정리 작업 실패",
            result: "failed",
            tenant_code: null,
            tenant_name: null,
          },
        ],
      },
      maintenance: { enabled_for_all: false, enabled_count: 1, total: 42 },
    }),
  }));
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test.describe("개발자 콘솔 엔터프라이즈 운영 셸", () => {
  test("데스크톱에서 운영 상태와 우선 조치를 한 화면에 제공한다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await stubDashboard(page);
    await gotoAndSettle(page, `${BASE}/dev/dashboard`);

    await expect(page.getByRole("heading", { name: "운영 대시보드", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "운영 환경 상태" })).toContainText("LOCAL PREVIEW");
    await expect(page.getByRole("heading", { name: "우선 확인 항목" })).toBeVisible();
    await expect(page.getByText("4개 항목을 우선 확인하세요")).toBeVisible();
    await expect(page.getByText("연체 인보이스", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("미답변 문의", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "최근 활동" })).toBeVisible();

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);

    const screenshot = testInfo.outputPath("developer-console-enterprise-desktop.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach("developer-console-enterprise-desktop", { path: screenshot, contentType: "image/png" });
  });

  test("390px에서 핵심 탭과 전체 메뉴를 분리하고 가로 넘침이 없다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubDashboard(page);
    await gotoAndSettle(page, `${BASE}/dev/dashboard`);

    const bottomNav = page.getByRole("navigation", { name: "핵심 개발자 메뉴" });
    await expect(bottomNav.getByText("대시보드", { exact: true })).toBeVisible();
    await expect(bottomNav.getByText("테넌트", { exact: true })).toBeVisible();
    await expect(bottomNav.getByText("문의함", { exact: true })).toBeVisible();
    await expect(bottomNav.getByText("전체", { exact: true })).toBeVisible();
    await bottomNav.getByRole("button", { name: "전체 메뉴" }).click();

    const fullNav = page.getByRole("navigation", { name: "전체 개발자 메뉴" });
    await expect(fullNav.getByText("결제", { exact: true })).toBeVisible();
    await expect(fullNav.getByText("기능 사용 신호", { exact: true })).toBeVisible();
    await expect(fullNav.getByText("자동화", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "전체 메뉴 닫기" }).click();
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);

    const screenshot = testInfo.outputPath("developer-console-enterprise-mobile-390.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach("developer-console-enterprise-mobile-390", { path: screenshot, contentType: "image/png" });
  });

  test("운영 목록 조회 실패를 빈 상태로 오인하지 않고 쓰기 기능을 잠근다", async ({ page }) => {
    await stubDashboard(page);
    const unavailable = (route: Route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "temporary_failure" }),
    });
    await page.route("**/api/v1/billing/admin/tenants/", unavailable);
    await page.route("**/api/v1/billing/admin/dashboard/", unavailable);
    await page.route("**/api/v1/billing/admin/invoices/**", unavailable);
    await page.route("**/api/v1/core/dev/audit/**", unavailable);
    await page.route("**/api/v1/core/dev/cron/", unavailable);

    await gotoAndSettle(page, `${BASE}/dev/billing`);
    await expect(page.getByRole("alert").filter({ hasText: "기간 연장 기능을 잠갔습니다" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "연장", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "인보이스", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "입금 확인 기능을 잠갔습니다" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "입금 확인", exact: true })).toHaveCount(0);

    await gotoAndSettle(page, `${BASE}/dev/automation`);
    await expect(page.getByRole("alert").filter({ hasText: "기록이 없는 것으로 간주하지 않습니다" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "크론", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "실행 기능을 잠갔습니다" })).toBeVisible({ timeout: 15_000 });
  });
});
