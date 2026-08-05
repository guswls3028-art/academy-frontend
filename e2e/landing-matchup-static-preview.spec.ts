import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";
import { expect, test } from "./fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174";
const PREVIEW_IMAGE = readFileSync(
  resolve(process.cwd(), "public/promo/matchup-actual-vs-prepared-q1-20260726.jpg"),
);
let testPdfPromise: Promise<Buffer> | null = null;

function buildTestPdf(): Promise<Buffer> {
  testPdfPromise ??= (async () => {
    const pdf = await PDFDocument.create();
    [
      rgb(0.92, 0.96, 1),
      rgb(0.96, 0.94, 1),
      rgb(0.93, 0.98, 0.95),
    ].forEach((color, index) => {
      const page = pdf.addPage([595, 842]);
      page.drawRectangle({ x: 36, y: 36, width: 523, height: 770, color });
      page.drawRectangle({ x: 70, y: 690 - index * 20, width: 455, height: 52, color: rgb(0.07, 0.41, 0.95) });
    });
    return Buffer.from(await pdf.save());
  })();
  return testPdfPromise;
}

async function stubLandingReport(page: Page) {
  const testPdf = await buildTestPdf();
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
          contact: {
            phone: "02-556-1988",
            email: "",
            address: "",
            inquiries: [
              { label: "두각학원", phone: "02-556-1988" },
              { label: "명인학원", phone: "02-6382-0909" },
              { label: "박철 과학 연구소", phone: "010-3502-3313" },
            ],
          },
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
    if (pathname.endsWith("/matchup-showcase/9/pdf/")) {
      await route.fulfill({ status: 200, contentType: "application/pdf", body: testPdf });
      return;
    }
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
      snapshot_at: "2026-07-25T12:00:00+09:00",
      snapshot_meta: { hit_rate: 0.895, hit_count: 17, counted_entries: 19 },
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
  await expect(page.getByRole("heading", { name: /수업에서 준비한 내용/ })).toBeVisible();
  await expect(page.locator('img[src="/tenants/tchul/classroom-lecture-01.webp"]')).toBeVisible();
  await expect(page.locator('img[src="/tenants/tchul/instructor-formal-portrait.webp"]')).toBeVisible();
  await expect(page.locator('img[src="/tenants/tchul/instructor-casual-portrait.webp"]')).toBeAttached();
  await expect(page.locator('a[href="/landing/matchup-board/9"] img')).toBeVisible();
  await expect(page.getByText("적중률 89.5%").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /두각학원.*02-556-1988/ })).toHaveAttribute("href", "tel:025561988");
  await expect(page.getByRole("link", { name: /명인학원.*02-6382-0909/ })).toHaveAttribute("href", "tel:0263820909");
  await expect(page.getByRole("link", { name: /박철 과학 연구소.*010-3502-3313/ })).toHaveAttribute("href", "tel:01035023313");
  await expect(page.getByTestId("landing-hero-primary-cta")).toContainText("두각학원 수강 문의");
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

test("showcase detail renders every page as one continuous mobile article", async ({ page }) => {
  await stubLandingReport(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/landing/matchup-board`, { waitUntil: "load" });

  const opener = page.getByTestId("landing-matchup-card-9");
  await expect(opener).toHaveAttribute("href", "/landing/matchup-board/9");
  await opener.click();
  await expect(page).toHaveURL(/\/landing\/matchup-board\/9$/);
  await expect(page.getByRole("heading", { name: "2026 숙명여고 적중 보고서" })).toBeVisible();
  await expect(page.getByText("적중률 89.5%")).toBeVisible();
  await expect(page.getByText("전체 자료 · 아래에서 첫 쪽부터 끝까지 이어서 보세요")).toBeVisible();
  const inlinePdf = page.getByTestId("matchup-inline-pdf");
  await expect(inlinePdf).toHaveAttribute("data-page-count", "3", { timeout: 30_000 });
  await expect(page.getByTestId("matchup-pdf-page")).toHaveCount(3);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "새 창에서 크게 보기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "원본 PDF 다운로드" })).toHaveAttribute("href", /\/api\/v1\/landing-public\/matchup-showcase\/9\/pdf\/\?tenant=tchul/);
  await expect(page.getByTestId("static-report-preview")).toHaveCount(0);

  const pages = page.getByTestId("matchup-pdf-page");
  for (let index = 0; index < 3; index += 1) {
    const pdfPage = pages.nth(index);
    await pdfPage.scrollIntoViewIfNeeded();
    await expect(pdfPage).toHaveAttribute("data-render-status", "ready", { timeout: 20_000 });
    const canvas = pdfPage.getByTestId("matchup-pdf-canvas");
    const mobileBox = await canvas.boundingBox();
    expect(mobileBox?.width || 999).toBeLessThanOrEqual(390);
    expect(await canvas.evaluate((element) => element.width > 0 && element.height > 0)).toBe(true);
    expect(await canvas.evaluate((element) => element.width / element.clientWidth)).toBeGreaterThanOrEqual(2.4);
  }
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const firstPage = pages.first();
  await expect(firstPage).toHaveAttribute("data-render-status", "waiting", { timeout: 20_000 });
  await expect.poll(async () => firstPage.getByTestId("matchup-pdf-canvas").evaluate((element) => ({ width: element.width, height: element.height }))).toEqual({ width: 1, height: 1 });

  await page.setViewportSize({ width: 1366, height: 900 });
  await firstPage.scrollIntoViewIfNeeded();
  await expect(firstPage).toHaveAttribute("data-render-status", "ready", { timeout: 20_000 });
  const desktopCanvas = firstPage.getByTestId("matchup-pdf-canvas");
  const desktopBox = await desktopCanvas.boundingBox();
  expect(desktopBox?.width || 0).toBeGreaterThan(800);
  expect(desktopBox?.width || 9999).toBeLessThanOrEqual(920);
  expect(await desktopCanvas.evaluate((element) => element.width / element.clientWidth)).toBeGreaterThanOrEqual(1.4);
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
  await page.route("**/api/v1/landing-public/matchup-showcase/", async (route) => {
    const isAuthenticatedRequest = Boolean(route.request().headers().authorization);
    const result = isAuthenticatedRequest ? {
      id: 88,
      title: "[E2E] 관리 전용 비공개 자료",
      description: "공개 자료실에는 나오면 안 됨",
      status: "hidden",
      published_at: "2026-07-25T12:00:00+09:00",
      published_until: null,
      snapshot_at: "2026-07-25T12:00:00+09:00",
      snapshot_meta: {},
      view_count: 0,
      expired: false,
      visible: true,
      hit_report_id_ref: null,
      pdf_url: "/api/v1/landing-public/matchup-showcase/88/pdf/?tenant=tchul",
      preview_url: "/api/v1/landing-public/matchup-showcase/88/preview/?tenant=tchul",
    } : {
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 1, results: [result] }),
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/landing/matchup-board`, { waitUntil: "load" });

  await expect(page.getByTestId("landing-matchup-card-9")).toBeVisible();
  await expect(page.getByText("[E2E] 관리 전용 비공개 자료")).toHaveCount(0);
  await page.getByRole("button", { name: "PDF 자료 올리기" }).click();

  await expect(page).toHaveURL(/\/landing\/matchup-board\?manage=1/);
  await expect(page.getByRole("dialog", { name: "매치업 게시물 관리" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "새 매치업 자료 올리기" })).toBeVisible();
  await expect(page.getByTestId("publish-mode-upload")).toContainText("내 컴퓨터의 PDF");
  await expect(page.getByText("PDF 파일을 끌어 놓거나 클릭해서 선택")).toBeVisible();
  await expect(page.getByTestId("publish-pdf-file")).toHaveAttribute("accept", "application/pdf,.pdf");
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
