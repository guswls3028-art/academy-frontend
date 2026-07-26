import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";
import { onRequestGet } from "../functions/[[path]]";
import { resolveBillingAmounts } from "../src/shared/product/billingAmounts";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

async function stubPromoBootstrap(page: Page) {
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
}

test("pricing presents one plan with clear August terms and separate-cost boundaries", async ({ page }) => {
  await stubPromoBootstrap(page);
  await page.goto(`${BASE}/promo/pricing`, {
    waitUntil: "load",
    timeout: 45_000,
  });

  await expect(
    page.getByRole("heading", { name: "기본 월 198,000원, 8월 가입 적용 월 159,000원" }),
  ).toBeVisible();
  await expect(page.getByText("2026년 8월 가입 적용 요금", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("기본 월 요금", { exact: true })).toBeVisible();
  await expect(page.getByText("기본 요금과 월 39,000원 차이", { exact: true })).toBeVisible();
  await expect(page.getByText(/평생|가격 인상 없음/)).toHaveCount(0);

  const plans = page.locator("article[data-plan]");
  await expect(plans).toHaveCount(1);
  await expect(plans).toHaveAttribute("data-plan", "all");
  await expect(plans.getByRole("heading", { name: "전체 기능" })).toBeVisible();
  await expect(plans).toContainText("기본 월 198,000원");
  await expect(plans).toContainText("공급가 180,000원 + 부가가치세 18,000원");
  await expect(plans).toContainText("159,000원 / 월");
  await expect(plans).toContainText("기본 요금 대비 월 39,000원 차이");
  await expect(plans).toContainText("수강생별도 좌석 과금 없음");
  await expect(plans).toContainText("계정별도 좌석 과금 없음");
  await expect(plans).toContainText("기능모두 포함");
  await expect(plans).toContainText(
    "기본 월 요금보다 39,000원 낮은 8월 가입 적용 요금",
  );
  await expect(plans).toContainText(
    "2026년 8월 1일부터 31일까지 가입할 때 적용되는 월 요금입니다. 이후 요금 변경은 계약과 이용약관에 따라 사전에 안내합니다.",
  );
  await expect(page.getByText(/알림톡 발송비, 저장공간 초과, 대량 데이터 이전, 커스텀 개발은 별도 협의/)).toBeVisible();

  await expect(page.getByText(/Standard|Pro|Max/, { exact: false })).toHaveCount(0);
  await expect(page).toHaveTitle("요금 안내 | 기본 198,000원 · 8월 가입 159,000원 | 학원플러스");
});

test("null VAT metadata preserves the fixed single-plan breakdown", () => {
  expect(resolveBillingAmounts({
    monthly_price: 145_000,
    vat_rate_percent: null,
  })).toEqual({
    supplyAmount: 145_000,
    taxAmount: 14_000,
    totalAmount: 159_000,
    vatRatePercent: null,
  });
});

test("standard single-plan billing uses ten percent VAT", () => {
  expect(resolveBillingAmounts({
    monthly_price: 180_000,
    vat_rate_percent: 10,
  })).toEqual({
    supplyAmount: 180_000,
    taxAmount: 18_000,
    totalAmount: 198_000,
    vatRatePercent: 10,
  });
});

test("Cloudflare routing forwards promo image assets", async () => {
  const response = await onRequestGet({
    request: new Request("https://hakwonplus.com/promo/admin-scores.png"),
    env: {
      ASSETS: {
        fetch: async () => new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      },
    },
  } as never);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
});
