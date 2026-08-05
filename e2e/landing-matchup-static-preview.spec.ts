import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174";
const PREVIEW_IMAGE = readFileSync(
  resolve(process.cwd(), "public/promo/matchup-actual-vs-prepared-q1-20260726.jpg"),
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
              items: [{ report_id: 7 }, { report_id: 8 }],
            },
          ],
        },
      }),
    });
  });
  await page.route("**/api/v1/matchup/landing/public/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/preview.jpg")) {
      await route.fulfill({ status: 200, contentType: "image/jpeg", body: PREVIEW_IMAGE });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reports: [7, 8].map((id) => ({
          id,
          doc_title: `2026 개포고 1학기 중간고사 ${id}`,
          doc_category: "통합과학",
          hit_count: 8,
          total_problems: 10,
          hit_rate_pct: 80,
          submitted_at: "2026-07-25T12:00:00+09:00",
          created_at: "2026-07-25T12:00:00+09:00",
        })),
      }),
    });
  });
  await page.route("**/api/v1/landing-public/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/matchup-showcase/9/preview/")) {
      await route.fulfill({ status: 200, contentType: "image/jpeg", body: PREVIEW_IMAGE });
      return;
    }
    const showcase = {
      id: 9,
      title: "2026 숙명여고 적중 보고서",
      description: "실제 시험과 사전 대비 자료 비교",
      status: "published",
      published_at: "2026-07-25T12:00:00+09:00",
      published_until: null,
      snapshot_meta: { hit_rate: 0.8, hit_count: 8, counted_entries: 10 },
      view_count: 1,
      expired: false,
      visible: true,
      hit_report_id_ref: 7,
      pdf_url: "/api/v1/landing-public/matchup-showcase/9/pdf/?tenant=tchul",
      preview_url: "/api/v1/landing-public/matchup-showcase/9/preview/?tenant=tchul",
    };
    if (pathname.endsWith("/matchup-showcase/9/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(showcase),
      });
      return;
    }
    if (pathname.endsWith("/matchup-showcase/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [showcase],
        }),
      });
      return;
    }
    const body = pathname.endsWith("/reviews/summary/")
      ? { count: 0, average: 0, distribution: {} }
      : { count: 0, next: null, previous: null, results: [] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("tenant report opens one static comparison image without a PDF renderer", async ({ page }) => {
  await stubLandingReport(page);
  await page.setViewportSize({ width: 390, height: 844 });
  // Vite의 첫 premium_dark 변환은 Windows 콜드 캐시에서 30초를 넘길 수 있다.
  await page.goto(`${BASE}/landing`, { waitUntil: "load", timeout: 75_000 });
  await expect(page.getByRole("heading", { name: "수업의 결과를 자료로 공개합니다" })).toBeVisible();
  await expect(page.getByRole("link", { name: /매치업 자료실/ }).first()).toHaveAttribute("href", "/landing/matchup-board");
  await page.goto(`${BASE}/landing/reports/7`, { waitUntil: "load" });

  const preview = page.getByTestId("static-report-preview");
  await expect(preview).toBeVisible();
  await expect(preview.locator('img[src*="/preview.jpg"]')).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "PDF 전체 보기" })).toHaveAttribute("href", /curated\.pdf/);
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a failed report preview retries after route change", async ({ page }) => {
  await stubLandingReport(page);
  await page.route("**/api/v1/matchup/landing/public/*/preview.jpg*", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes("/7/")) {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "image/jpeg", body: PREVIEW_IMAGE });
  });

  await page.goto(`${BASE}/landing/reports/7`, { waitUntil: "load" });
  await expect(page.getByText("미리보기를 불러오지 못했습니다.")).toBeVisible();

  await page.locator('a[href="/landing/reports/8"]').click();
  await expect(page.getByTestId("static-report-preview").locator("img")).toBeVisible();
});

test("showcase card opens a dedicated mobile-readable article", async ({ page }) => {
  await stubLandingReport(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/landing/matchup-board`, { waitUntil: "load" });

  const opener = page.getByTestId("landing-matchup-card-9");
  await expect(opener).toHaveAttribute("href", "/landing/matchup-board/9");
  await opener.click();
  await expect(page).toHaveURL(/\/landing\/matchup-board\/9$/);
  await expect(page.getByRole("heading", { name: "2026 숙명여고 적중 보고서" })).toBeVisible();
  await expect(page.getByText("좌우로 밀어 크게 볼 수 있습니다")).toBeVisible();
  const detailPreview = page.getByTestId("static-report-preview").locator("img");
  await expect(detailPreview).toBeVisible();
  await expect.poll(async () => detailPreview.evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("link", { name: "전체 화면 PDF 보기" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("owner mobile flow starts with a local PDF upload", async ({ page }) => {
  await stubLandingReport(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "tchul",
    user_id: 12,
  })}.sig`;
  await page.addInitScript(({ access }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
    localStorage.setItem("tenant_code", "tchul");
  }, { access: token });
  await page.route("**/api/v1/core/me/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 12,
        username: "tchul-owner",
        name: "박철T",
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
        first_login_guide_required: false,
      }),
    });
  });
  await page.route("**/api/v1/matchup/hit-reports/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reports: [] }) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/landing/admin/matchup-board?compose=upload`, { waitUntil: "load" });

  await expect(page.getByRole("heading", { name: "매치업 자료실 관리" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "새 매치업 자료 올리기" })).toBeVisible();
  await expect(page.getByTestId("publish-mode-upload")).toContainText("내 컴퓨터의 PDF");
  await expect(page.getByText("PDF 파일을 끌어 놓거나 클릭해서 선택")).toBeVisible();
  await expect(page.getByTestId("publish-pdf-file")).toHaveAttribute("accept", "application/pdf,.pdf");
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
