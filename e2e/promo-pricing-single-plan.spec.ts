import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures/strictTest";
import { onRequestGet } from "../functions/[[path]].ts";
import { PROMO_META } from "../src/app_promo/domains/landing/promoMeta";
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

test("pricing shows the payable total and keeps existing fixed-tax contracts accessible", async ({ page }) => {
  await stubPromoBootstrap(page);
  await page.goto(`${BASE}/promo/pricing`, { waitUntil: "load", timeout: 45_000 });
  const plan = page.locator('article[data-plan="all"]');
  await expect(page.locator("article[data-plan]")).toHaveCount(1);
  await expect(plan.getByRole("heading", { name: "학원플러스 기본 요금" })).toBeVisible();
  await expect(plan.getByText("월 19만 8천원", { exact: true })).toBeVisible();
  await expect(plan.getByText("부가세 포함 결제금액", { exact: true })).toBeVisible();
  await expect(plan.getByText("18만원", { exact: true })).toBeVisible();
  await expect(plan.getByText("부가세 10%", { exact: true })).toBeVisible();
  await expect(plan.getByText("1만 8천원", { exact: true })).toBeVisible();
  await expect(plan).toContainText("인원에 따른 추가 요금 없음");
  await expect(plan).toContainText("200GB 포함");
  await expect(page.getByRole("heading", { name: "별도로 협의하는 항목" })).toBeVisible();
  for (const term of ["알림톡 발송비", "추가 저장공간", "대량 데이터 이전", "맞춤 개발"]) {
    await expect(page.locator("#additional-cost").getByText(term, { exact: true })).toBeVisible();
  }
  await plan.locator("summary").click();
  await expect(plan).toContainText("일부 수학 단답형(0~999 정수)");
  await expect(plan.getByRole("link", { name: "시연 신청", exact: true })).toHaveAttribute("href", "/promo/demo");
  const legacy = page.locator("#existing-contract");
  await expect(legacy).not.toHaveAttribute("open", "");
  await legacy.locator("summary").click();
  await expect(legacy.getByRole("heading", { name: "2026년 8월 가입 혜택 · 신규 적용 종료" })).toBeVisible();
  await expect(legacy.getByText("14만 5천원", { exact: true })).toBeVisible();
  await expect(legacy.getByText("고정 부가세", { exact: true })).toBeVisible();
  await expect(legacy.getByText("1만 4천원", { exact: true })).toBeVisible();
  await expect(legacy.getByText("15만 9천원", { exact: true })).toBeVisible();
  await expect(legacy.getByText(/8월 가입 요금은 서비스를 이용하는 동안 계속 적용/)).toBeVisible();
  await expect(legacy).not.toContainText("10%");
  await expect(page.getByText(/선착순|마감 임박|지금 신청|159,500|159500|15만 9,500원|1만 4,500원/)).toHaveCount(0);
  await page.goto(`${BASE}/promo/pricing#existing-contract`);
  await expect(legacy).toHaveAttribute("open", "");
  await page.reload();
  await expect(legacy.getByText("15만 9천원", { exact: true })).toBeVisible();
});
test("390px pricing keeps the current price and ended August terms readable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubPromoBootstrap(page);
  await page.goto(`${BASE}/promo/pricing`, { waitUntil: "load" });
  await expect(page.getByText("월 19만 8천원", { exact: true })).toBeVisible();
  await page.locator("#existing-contract > summary").click();
  await expect(page.getByText("2026년 8월 가입 혜택 · 신규 적용 종료", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("pricing-390-top.png") });
  await page.locator('article[data-plan="all"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("pricing-390-plan.png") });
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

test("Cloudflare pricing metadata and promo offers publish current terms", async () => {
  const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });
  try {
    for (const pathname of ["/promo", "/promo/pricing"]) {
      const response = await onRequestGet({
        request: new Request(`https://hakwonplus.com${pathname}`),
        env: {
          ASSETS: {
            fetch: async () => new Response(
              indexHtml,
              { status: 200, headers: { "Content-Type": "text/html" } },
            ),
          },
        },
      } as never);
      expect(response.status).toBe(200);
      const html = await response.text();
      if (pathname === "/promo/pricing") {
        expect(html).toContain(`<title>${PROMO_META[pathname].title}</title>`);
        expect(html).toContain(`<meta name="description" content="${PROMO_META[pathname].description}" />`);
        expect(html).toContain(`<meta property="og:title" content="${PROMO_META[pathname].title}" />`);
        expect(html).toContain(`<meta property="og:description" content="${PROMO_META[pathname].description}" />`);
      }
      const structuredData = html.match(/<script\b[^>]*\bid="promo-structured-data"[^>]*>([\s\S]*?)<\/script>/);
      expect(structuredData).not.toBeNull();
      expect(structuredData![0]).toContain('type="application/ld+json"');
      const application = JSON.parse(structuredData![1]);
      expect(application["@type"]).toBe("SoftwareApplication");
      expect(application.url).toBe(`https://hakwonplus.com${pathname}`);
      expect(application.offers.price).toBe("180000");
      expect(application.offers.priceCurrency).toBe("KRW");
      expect(application.offers).not.toHaveProperty("priceValidUntil");
      expect(application.offers.description).toContain("월 18만원(부가세 10% 별도, 결제금액 19만 8천원)");
      expect(application.offers.description).toContain("고정 부가세 1만 4천원, 결제금액 15만 9천원");
      expect(html).not.toMatch(/두 금액 모두 부가세 10%|159,500|159500|15만 9,500원|1만 4,500원/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
