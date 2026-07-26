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
    page.getByRole("heading", { name: /8월 가입 14만 5천원/ }),
  ).toBeVisible();
  await expect(
    page.getByText("2026년 8월 가입 혜택", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("2026년 8월 가입", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2026년 9월 이후 가입", { exact: true })).toBeVisible();
  await expect(page.getByText("14만 5천원", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("18만원", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("월 요금 · 부가세 10% 별도", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("부가세 1만 4,500원 · 결제금액 15만 9,500원", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("부가세 1만 8천원 · 결제금액 19만 8천원", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/8월 가입 요금은 서비스를 이용하는 동안 계속 적용/).first()).toBeVisible();
  await expect(page.getByText(/선착순|마감 임박|지금 신청/)).toHaveCount(0);
  await expect(page.getByText(/160,000|160000/)).toHaveCount(0);
  await expect(page.getByText("16만원", { exact: true })).toHaveCount(0);

  const plans = page.locator("article[data-plan]");
  await expect(plans).toHaveCount(1);
  await expect(plans).toHaveAttribute("data-plan", "all");
  await expect(plans.getByRole("heading", { name: "학원플러스 기본 요금" })).toBeVisible();
  await expect(plans).toContainText("8월 가입14만 5천원월 요금 · 부가세 10% 별도부가세 1만 4,500원 · 결제금액 15만 9,500원");
  await expect(plans).toContainText("9월 이후 가입18만원월 요금 · 부가세 10% 별도부가세 1만 8천원 · 결제금액 19만 8천원");
  await expect(plans).toContainText("8월 가입 시 월 3만 5천원 차이");
  await expect(plans).toContainText("수강생학생 수에 따른 추가 요금 없음");
  await expect(plans).toContainText("계정계정 수에 따른 추가 요금 없음");
  await expect(plans).toContainText("기능모두 포함");
  await expect(plans).toContainText(
    "8월에 가입하면 월 14만 5천원의 공급가가 이용 기간 동안 유지됩니다.",
  );
  await expect(plans).toContainText(
    "2026년 8월 1일부터 31일까지 가입한 학원은 월 14만 5천원(부가세 10% 별도, 결제금액 15만 9,500원)으로 이용하며, 해당 공급가는 이용 기간 동안 계속 적용됩니다.",
  );
  await expect(page.getByText("2026년 9월 1일부터 가입하는 학원은 월 18만원(부가세 10% 별도, 결제금액 19만 8천원)입니다.")).toBeVisible();
  await expect(page.getByText(/알림톡 발송비, 저장공간 초과, 대량 데이터 이전, 커스텀 개발은 별도 협의/)).toBeVisible();

  await expect(page.getByText(/Standard|Pro|Max/, { exact: false })).toHaveCount(0);
  await expect(page).toHaveTitle("요금 안내 | 8월 14만 5천원·이후 18만원 | 학원플러스");
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

test("terms preserve an explicitly promised continuing promotion price", async ({ page }) => {
  await stubPromoBootstrap(page);
  await page.goto(`${BASE}/terms`, { waitUntil: "load" });

  await expect(page.getByText("시행일: 2026년 7월 26일 | 버전 1.2")).toBeVisible();
  await expect(
    page.getByText("별도 계약이나 가입 행사에서 이용 기간 동안의 요금 유지가 명시된 경우에는 해당 조건이 우선합니다."),
  ).toBeVisible();
  await expect(page.getByText(/SaaS|테넌트/)).toHaveCount(0);
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
