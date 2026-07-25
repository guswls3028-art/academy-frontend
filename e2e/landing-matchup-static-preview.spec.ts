import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174";
const PREVIEW_IMAGE = readFileSync(
  resolve(process.cwd(), "public/promo/matchup-gaepo-results-20260725.png"),
);

async function stubLandingReport(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("tenant_code", "tchul");
  });
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "tchul",
        display_name: "테스트 학원",
        ui_config: { login_title: "테스트 학원" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
  await page.route("**/api/v1/core/landing/public/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        has_landing: true,
        template_key: "premium_dark",
        config: {
          brand_name: "테스트 학원",
          template_key: "premium_dark",
          primary_color: "#D4A04C",
          cta_text: "상담 문의",
          cta_link: "#contact",
          contact: {},
          sections: [
            {
              type: "hit_reports",
              enabled: true,
              order: 1,
              title: "적중 보고서",
              description: "카드를 누르면 시험지와 강의 자료를 비교한 본문 PDF가 열립니다.",
              items: [{ report_id: 7 }],
            },
          ],
        },
      }),
    });
  });
  await page.route("**/api/v1/matchup/landing/public/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/preview.jpg")) {
      await route.fulfill({ status: 200, contentType: "image/png", body: PREVIEW_IMAGE });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reports: [{
          id: 7,
          doc_title: "2026 개포고 1학기 중간고사",
          doc_category: "통합과학",
          hit_count: 8,
          total_problems: 10,
          hit_rate_pct: 80,
          submitted_at: "2026-07-25T12:00:00+09:00",
          created_at: "2026-07-25T12:00:00+09:00",
        }],
      }),
    });
  });
  await page.route("**/api/v1/landing-public/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/reviews/summary/")
      ? { count: 0, average: 0, distribution: {} }
      : { count: 0, next: null, previous: null, results: [] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("tenant report opens one static comparison image without a PDF renderer", async ({ page }) => {
  await stubLandingReport(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/landing`, { waitUntil: "load" });
  await expect(
    page.getByText("카드를 누르면 실제 시험과 사전 대비 자료의 대표 비교 화면이 바로 열립니다. 전체 문항은 PDF로 확인할 수 있습니다."),
  ).toBeVisible();
  await page.goto(`${BASE}/landing/reports/7`, { waitUntil: "load" });

  const preview = page.getByTestId("static-report-preview");
  await expect(preview).toBeVisible();
  await expect(preview.locator('img[src*="/preview.jpg"]')).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "PDF 전체 보기" })).toHaveAttribute("href", /curated\.pdf/);
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
