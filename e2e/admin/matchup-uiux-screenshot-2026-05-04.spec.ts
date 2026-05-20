/**
 * 매치업 UIUX 개편 — 시각 검수용 스크린샷.
 * 학원장 시점에서 화면이 친절·직관적인지 직접 확인.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import type { Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
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
      (await page.locator("[data-testid='matchup-doc-more-menu-trigger']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-intent-toggle']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-problem-card']").count()) > 0,
    { timeoutMs: 10_000, description: "matchup document detail settled" },
  ).catch(() => {});
}

async function waitForSimilarResults(page: Page): Promise<void> {
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-similar-pin-hint']").count()) > 0 ||
      (await page.locator("[class*='Similar'], [data-testid^='similar-problem']").count()) > 0 ||
      (await page.getByText(/유사 문제가 없|결과 없|매치 안됨/).count()) > 0,
    { timeoutMs: 10_000, description: "similar results settled" },
  ).catch(() => {});
}

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("매치업 UIUX 시각 검수", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
    await waitForMatchupList(page);
  });

  test("01 — 매치업 진입 시 좌측 트리 + 우측 빈 상태", async ({ page }) => {
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/01-entry.png",
      fullPage: false,
    });
  });

  test("02 — 시험지 선택 시 헤더 액션바 (적중보고서 primary CTA + ⋮ 메뉴)", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test']").first();
    if (await testDoc.count() === 0) test.skip(true, "시험지 doc 없음");
    await testDoc.click();
    await waitForDocDetail(page);
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/02-test-doc-header.png",
      fullPage: false,
    });
  });

  test("03 — 참고자료 doc 헤더 (적중보고서 CTA 미노출 + segmented 토글 reference active)", async ({ page }) => {
    const refDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='reference']").first();
    if (await refDoc.count() === 0) test.skip(true, "참고자료 doc 없음");
    await refDoc.click();
    await waitForDocDetail(page);
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/03-reference-doc-header.png",
      fullPage: false,
    });
  });

  test("04 — 시험지 → 참고자료 confirm 다이얼로그", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test']").first();
    if (await testDoc.count() === 0) test.skip(true, "시험지 doc 없음");
    await testDoc.click();
    await waitForDocDetail(page);
    await page.locator("[data-testid='matchup-intent-toggle-reference']").click();
    await expect(page.getByText(/시험지를 참고자료로 변경/)).toBeVisible({ timeout: 5000 });
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/04-intent-confirm-dialog.png",
      fullPage: false,
    });
    // 취소
    await page.getByRole("button", { name: "취소" }).click();
  });

  test("05 — 합치기 모드 우측 도움말", async ({ page }) => {
    const doneDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-status='done']").first();
    if (await doneDoc.count() === 0) test.skip(true, "완료 doc 없음");
    await doneDoc.click();
    await waitForDocDetail(page);
    const enter = page.locator("[data-testid='matchup-merge-mode-enter']");
    if (await enter.count() === 0) test.skip(true, "합치기 진입 없음");
    await enter.click();
    await page.locator("[data-testid='matchup-merge-mode-right-panel']").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/05-merge-mode-help.png",
      fullPage: false,
    });
  });

  test("06 — 시험지 + 문제 선택 시 우측 SimilarResults (Pin hint + 카드)", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test'][data-doc-status='done']").first();
    if (await testDoc.count() === 0) test.skip(true, "시험지 done doc 없음");
    await testDoc.click();
    await waitForDocDetail(page);
    const firstP = page.locator("[data-testid='matchup-problem-card']").first();
    if (await firstP.count() === 0) test.skip(true, "문항 없음");
    await firstP.click();
    await waitForSimilarResults(page);
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/06-similar-pin-hint.png",
      fullPage: false,
    });
  });

  test("07 — DocumentList 좌측 트리 (보고서 모음 + 카운트 라벨)", async ({ page }) => {
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/07-doc-list-tree.png",
      clip: { x: 0, y: 100, width: 380, height: 700 },
    });
  });
});
