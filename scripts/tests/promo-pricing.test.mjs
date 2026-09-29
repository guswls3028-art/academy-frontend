import assert from "node:assert/strict";
import test from "node:test";
import {
  AUGUST_MONTHLY_SUPPLY_AMOUNT, AUGUST_MONTHLY_TAX_AMOUNT, AUGUST_MONTHLY_TOTAL_AMOUNT,
  AUGUST_PRICE_GUARANTEE, AUGUST_PROMOTION_LABEL, MONTHLY_VAT_RATE_PERCENT,
  POST_AUGUST_MONTHLY_SUPPLY_AMOUNT, POST_AUGUST_MONTHLY_TAX_AMOUNT, POST_AUGUST_MONTHLY_TOTAL_AMOUNT,
  PROMO_PLANS,
} from "../../src/app_promo/domains/landing/business.ts";

test("August public pricing preserves the backend fixed-tax guarantee", () => {
  assert.deepEqual([AUGUST_MONTHLY_SUPPLY_AMOUNT, AUGUST_MONTHLY_TAX_AMOUNT, AUGUST_MONTHLY_TOTAL_AMOUNT], [145000, 14000, 159000]);
  assert.equal(AUGUST_MONTHLY_SUPPLY_AMOUNT + AUGUST_MONTHLY_TAX_AMOUNT, AUGUST_MONTHLY_TOTAL_AMOUNT);
  assert.match(AUGUST_PRICE_GUARANTEE, /고정 부가세 1만 4천원 별도, 결제금액 15만 9천원/);
  assert.doesNotMatch(AUGUST_PRICE_GUARANTEE, /10%|9,500/);
});

test("new sign-ups retain standard ten-percent VAT", () => {
  assert.deepEqual([POST_AUGUST_MONTHLY_SUPPLY_AMOUNT, POST_AUGUST_MONTHLY_TAX_AMOUNT, POST_AUGUST_MONTHLY_TOTAL_AMOUNT], [180000, 18000, 198000]);
  assert.equal(POST_AUGUST_MONTHLY_SUPPLY_AMOUNT * MONTHLY_VAT_RATE_PERCENT / 100, POST_AUGUST_MONTHLY_TAX_AMOUNT);
  assert.equal(POST_AUGUST_MONTHLY_SUPPLY_AMOUNT + POST_AUGUST_MONTHLY_TAX_AMOUNT, POST_AUGUST_MONTHLY_TOTAL_AMOUNT);
});

test("the single plan retains August amounts while describing current sign-ups", () => {
  assert.equal(PROMO_PLANS.length, 1);
  assert.equal(PROMO_PLANS[0].monthlyTotalAmount, 159000);
  assert.equal(PROMO_PLANS[0].postAugustMonthlyTotalAmount, 198000);
  assert.equal(PROMO_PLANS[0].monthlySavings, 35000);
  assert.equal(PROMO_PLANS[0].target, "2026년 9월 1일 이후 가입 학원");
  assert.match(AUGUST_PROMOTION_LABEL, /신규 적용 종료/);
});
