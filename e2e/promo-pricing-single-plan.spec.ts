import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";
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

test("pricing presents the August lifetime guarantee and one unrestricted plan", async ({ page }) => {
  await stubPromoBootstrap(page);
  await page.goto(`${BASE}/promo/pricing`, {
    waitUntil: "load",
    timeout: 45_000,
  });

  await expect(
    page.getByRole("heading", { name: "평소 월 198,000원, 8월 가입은 159,000원" }),
  ).toBeVisible();
  await expect(page.getByText("2026년 8월 가입 특별가", { exact: true })).toBeVisible();
  await expect(page.getByText("8월 가입 평생 보장가")).toBeVisible();
  await expect(page.getByText("8월 가입자는 가격 인상 없음")).toBeVisible();
  await expect(page.getByText("평소 월 요금")).toBeVisible();
  await expect(page.getByText("월 39,000원 할인", { exact: true })).toBeVisible();

  const plans = page.locator("article[data-plan]");
  await expect(plans).toHaveCount(1);
  await expect(plans).toHaveAttribute("data-plan", "all");
  await expect(plans.getByRole("heading", { name: "전체 기능" })).toBeVisible();
  await expect(plans).toContainText("평소 198,000원");
  await expect(plans).toContainText("공급가 180,000원 + 부가가치세 18,000원");
  await expect(plans).toContainText("공급가 145,000원 + 부가가치세 14,000원");
  await expect(plans).toContainText("159,000원 / 월");
  await expect(plans).toContainText("월 39,000원 절약");
  await expect(plans).toContainText("수강생제한 없음");
  await expect(plans).toContainText("계정제한 없음");
  await expect(plans).toContainText("기능모두 포함");
  await expect(plans).toContainText(
    "8월에만 월 39,000원 할인, 가입 후에는 159,000원 그대로",
  );
  await expect(plans).toContainText(
    "8월 1일부터 31일까지 가입한 학원은 이후 가격이 인상되어도 월 159,000원을 그대로 적용합니다.",
  );

  await expect(page.getByText(/Standard|Pro|Max/, { exact: false })).toHaveCount(0);
  await expect(page).toHaveTitle("요금제 | 평소 198,000원 · 8월 특별가 159,000원 | 학원플러스");
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
