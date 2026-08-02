import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page) {
  let cardEndpointRequests = 0;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204 });
    }
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
        username: "billing-owner",
        name: "결제 담당자",
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
        first_login_guide_required: false,
      });
    }
    if (path === "/core/subscription/") {
      return json({
        plan: "all",
        plan_display: "전체 기능",
        monthly_price: 180_000,
        monthly_supply_amount: 180_000,
        monthly_tax_amount: 18_000,
        monthly_total_amount: 198_000,
        monthly_price_includes_tax: false,
        vat_rate_percent: 10,
        original_price: 180_000,
        list_monthly_total_amount: 198_000,
        is_promo: false,
        discount_rate: 0,
        subscription_status: "active",
        subscription_status_display: "이용 중",
        subscription_started_at: "2026-08-01",
        subscription_expires_at: "2026-09-01",
        is_subscription_active: true,
        days_remaining: 30,
        billing_email: "",
        billing_mode: "INVOICE_REQUEST",
        next_billing_at: "2026-09-01",
        cancel_at_period_end: false,
        canceled_at: null,
        tenant_code: "hakwonplus",
        tenant_name: "테스트 학원",
      });
    }
    if (path === "/billing/bank-transfer/") {
      return json({
        bank_account: {
          enabled: true,
          bank_name: "테스트은행",
          account_number: "0000-00-0000000",
          account_holder: "테스트예금주",
        },
        billing_mode: "INVOICE_REQUEST",
        business_profile: null,
        invoices: [
          {
            id: 91,
            invoice_number: "INV-TEST-001",
            billing_mode: "INVOICE_REQUEST",
            total_amount: 198_000,
            supply_amount: 180_000,
            tax_amount: 18_000,
            period_start: "2026-09-01",
            period_end: "2026-09-30",
            due_date: "2026-09-15",
            status: "PENDING",
            status_display: "납부 대기",
            bank_transfer_notice: null,
          },
        ],
      });
    }
    if (path.startsWith("/billing/cards/") || path.startsWith("/billing/card/")) {
      cardEndpointRequests += 1;
      return json([]);
    }
    return json({ count: 0, results: [] });
  });

  return { cardEndpointRequests: () => cardEndpointRequests };
}

test.use({ serviceWorkers: "block" });
test.skip(
  !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
  "결제 route-mock 검증은 로컬 dev 서버 전용",
);

test("결제 설정은 계좌이체 정보만 노출하고 카드 API를 호출하지 않는다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  const apiState = await installApi(page);

  await gotoAndSettle(page, `${BASE}/workspace/settings/billing`);

  await expect(
    page.getByRole("heading", { name: "계좌이체로 이용료 납부", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("테스트은행", { exact: true })).toBeVisible();
  await expect(page.getByText("0000-00-0000000", { exact: true })).toBeVisible();
  await expect(page.getByText("테스트예금주", { exact: true })).toBeVisible();
  await expect(page.getByText(/카드/)).toHaveCount(0);
  expect(apiState.cardEndpointRequests()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "계좌이체로 이용료 납부", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0000-00-0000000", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
