// PATH: e2e/admin/matchup-uiux-review.spec.ts
// 운영 매치업 화면 UI/UX 시각 검수용 — 스크린샷만 찍어 시각 검수

import { test } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import type { Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const DOC_ROW_SELECTOR = '[data-testid="matchup-doc-row"]';

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
      (await page.locator('[data-testid="matchup-doc-more-menu-trigger"]').count()) > 0 ||
      (await page.locator('[data-testid="matchup-intent-toggle"]').count()) > 0 ||
      (await page.locator('[data-testid="matchup-problem-card"]').count()) > 0,
    { timeoutMs: 10_000, description: "matchup document detail settled" },
  ).catch(() => {});
}

async function waitForSimilarResults(page: Page): Promise<void> {
  await waitForCondition(
    async () =>
      (await page.locator('[data-testid="matchup-similar-pin-hint"]').count()) > 0 ||
      (await page.locator("[class*='Similar'], [data-testid^='similar-problem']").count()) > 0 ||
      (await page.getByText(/유사 문제가 없|결과 없|매치 안됨/).count()) > 0,
    { timeoutMs: 10_000, description: "similar results settled" },
  ).catch(() => {});
}

test("매치업 UI/UX 시각 검수 — 4 화면", async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaUI(page, "admin");
  await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
  await waitForMatchupList(page);

  // 1. 매치업 메인 화면 (doc list + 빈 상태)
  await page.screenshot({
    path: "e2e/_local/screenshots/matchup-uiux-1-main.png",
    fullPage: false,
  });

  // 카테고리 펼침 시도 (참고 자료)
  const refCategory = page.locator('[data-testid="matchup-category-header"]').filter({ hasText: "참고" }).first();
  if (await refCategory.count() > 0) {
    await refCategory.click();
    await waitForMatchupList(page);
  }

  // 2. 첫 doc 클릭
  const allRows = page.locator('[data-testid="matchup-doc-row"]');
  const rowCount = await allRows.count();
  if (rowCount > 0) {
    await allRows.first().click();
    await waitForDocDetail(page);
    await page.screenshot({
      path: "e2e/_local/screenshots/matchup-uiux-2-first-doc.png",
      fullPage: false,
    });

    // 3. problem 카드 클릭
    const cards = page.locator('[data-testid="matchup-problem-card"]');
    if (await cards.count() > 0) {
      await cards.first().click();
      await waitForSimilarResults(page);
      await page.screenshot({
        path: "e2e/_local/screenshots/matchup-uiux-3-cross-matches.png",
        fullPage: false,
      });
    }
  }

  // 4. 학습자료 (참고자료) doc 클릭 — 페이지 폴백 케이스
  const refRows = page.locator('[data-testid="matchup-doc-row"]');
  const totalRows = await refRows.count();
  if (totalRows > 5) {
    await refRows.nth(totalRows - 1).click();  // 마지막 doc
    await waitForDocDetail(page);
    await page.screenshot({
      path: "e2e/_local/screenshots/matchup-uiux-4-reference-doc.png",
      fullPage: false,
    });
  }
});
