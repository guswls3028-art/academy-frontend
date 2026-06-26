/**
 * 매치업 UIUX 배포후 실사용 리뷰 — 학원장 시점.
 * Button 아이콘 정렬/줄바꿈 fix 후 시각 검증.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import type { Locator, Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const OUT = "e2e/_artifacts/matchup-uiux-postdeploy-2026-05-05";
const DOC_ROW_SELECTOR = "[data-testid='matchup-doc-row']";

async function waitForMatchupList(page: Page): Promise<void> {
  await waitForCondition(
    async () =>
      (await page.locator(DOC_ROW_SELECTOR).count()) > 0 ||
      (await page.getByRole("button", { name: /(내 적중 보고서 모음|학원 적중 보고서 모음)/ }).count()) > 0,
    { timeoutMs: 10_000, description: "matchup list settled" },
  ).catch(() => {});
}

async function waitForDocDetail(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-failed-banner']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-paper-type-banner']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-low-conf-reviewer-open-btn']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-doc-more-menu-trigger']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-intent-toggle']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-problem-card']").count()) > 0,
    { timeoutMs: 10_000, description: "matchup document detail settled" },
  ).catch(() => {});
}

async function waitForHitReportList(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='hit-report-card']").count()) > 0 ||
      (await page.getByText(/작성한 보고서가 없습니다|학원 홈페이지에 게시된 보고서가 없습니다/).count()) > 0 ||
      (await page.getByRole("button", { name: "새로고침" }).count()) > 0,
    { timeoutMs: 10_000, description: "hit report list settled" },
  ).catch(() => {});
}

async function waitForHitReportEditor(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-hit-report-save-state']").count()) > 0 ||
      (await page.locator("[data-testid='hit-report-preview-iframe']").count()) > 0 ||
      (await page.getByRole("dialog", { name: "적중보고서 미리보기" }).count()) > 0,
    { timeoutMs: 10_000, description: "hit report detail settled" },
  ).catch(() => {});
}

async function openDocRow(page: Page, row: Locator): Promise<void> {
  await row.scrollIntoViewIfNeeded();
  await row.click({ noWaitAfter: true });
  await waitForDocDetail(page);
}

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("매치업 UIUX 배포후 실사용", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
    await waitForMatchupList(page);
  });

  test("01-entry — 빈 상태 (좌측 트리)", async ({ page }) => {
    await page.screenshot({ path: `${OUT}/01-entry-1440.png`, fullPage: false });
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `${OUT}/01-entry-1024.png`, fullPage: false });
  });

  test("02-test-doc — 시험지 doc 헤더 (적중 보고서 작성 + 직접 자르기)", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test'][data-doc-status='done']").first();
    if (await testDoc.count() === 0) test.skip(true, "시험지 done doc 없음");
    await openDocRow(page, testDoc);
    await page.screenshot({ path: `${OUT}/02-test-header-1440.png`, fullPage: false });
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `${OUT}/02-test-header-1100.png`, fullPage: false });
  });

  test("03-failed-banner — 분석 실패 배너 + 재시도 버튼", async ({ page }) => {
    const failedDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-status='failed']").first();
    if (await failedDoc.count() === 0) test.skip(true, "실패 doc 없음");
    await failedDoc.click();
    await waitForDocDetail(page);
    const banner = page.locator("[data-testid='matchup-failed-banner']");
    await banner.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await banner.screenshot({ path: `${OUT}/03-failed-banner.png` });
  });

  test("04-paper-type-banner — 자동분리 정확도 경고 배너 + 직접 자르기", async ({ page }) => {
    const docs = page.locator("[data-testid='matchup-doc-row'][data-doc-status='done']");
    const n = await docs.count();
    let found = false;
    for (let i = 0; i < Math.min(n, 20); i++) {
      const doc = docs.nth(i);
      await openDocRow(page, doc);
      const banner = page.locator("[data-testid='matchup-paper-type-banner']").first();
      if (await banner.isVisible({ timeout: 500 }).catch(() => false)) {
        await banner.scrollIntoViewIfNeeded();
        await banner.screenshot({ path: `${OUT}/04-paper-type-banner.png` });
        found = true;
        break;
      }
    }
    if (!found) test.skip(true, "paper-type 경고 배너 띄워진 doc 없음");
  });

  test("05-low-conf-banner — 검수 필요 페이지 영역 + 검수 페이지 열기", async ({ page }) => {
    const docs = page.locator("[data-testid='matchup-doc-row'][data-doc-status='done']");
    const n = await docs.count();
    let found = false;
    for (let i = 0; i < Math.min(n, 20); i++) {
      await openDocRow(page, docs.nth(i));
      const btn = page.locator("[data-testid='matchup-low-conf-reviewer-open-btn']");
      if (await btn.count() > 0) {
        const region = btn.locator("xpath=ancestor::*[1]");
        await region.screenshot({ path: `${OUT}/05-low-conf-area.png` });
        await btn.click();
        await waitForCondition(
          async () => (await page.locator("[data-testid='matchup-low-conf-reviewer']").count()) > 0,
          { timeoutMs: 5000, description: "low confidence reviewer opened" },
        ).catch(() => {});
        await expect(page.locator("body")).toBeVisible();
        await page.screenshot({ path: `${OUT}/05-low-conf-reviewer-open.png`, fullPage: false });
        found = true;
        break;
      }
    }
    if (!found) test.skip(true, "low-conf 검수 영역 노출된 doc 없음");
  });

  test("06-hit-report-editor — 적중 보고서 편집기 4버튼 헤더", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/storage/hit-reports`, { timeout: 30_000 });
    await waitForHitReportList(page);
    const firstReport = page.locator("[data-testid='hit-report-card'], [data-testid^='hit-report-row-']").first();
    if (await firstReport.count() === 0) test.skip(true, "적중 보고서 없음");
    await firstReport.click();
    await waitForHitReportEditor(page);
    await page.screenshot({ path: `${OUT}/06-hit-report-editor-1440.png`, fullPage: false });
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: `${OUT}/06-hit-report-editor-1024.png`, fullPage: false });
  });

  test("07-hit-report-list — 적중 보고서 리스트 헤더 (새로고침 버튼)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin/storage/hit-reports`, { timeout: 30_000 });
    await waitForHitReportList(page);
    await page.screenshot({ path: `${OUT}/07-hit-report-list.png`, fullPage: false });
  });
});
