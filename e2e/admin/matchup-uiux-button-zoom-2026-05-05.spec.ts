/**
 * 매치업 Button alignment fix 검증 — 헤더 액션바 클로즈업.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const OUT = "e2e/_artifacts/matchup-uiux-postdeploy-2026-05-05";

test.use({ viewport: { width: 1440, height: 900 } });

test("button-zoom — 헤더 액션바 + 문제 그리드 줄바꿈 확인", async ({ page }) => {
  await loginViaUI(page, "admin");
  await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
  await waitForCondition(
    async () => (await page.locator("[data-testid='matchup-doc-row']").count()) > 0,
    { timeoutMs: 10_000, description: "matchup document rows visible" },
  ).catch(() => {});

  const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test'][data-doc-status='done']").first();
  if (await testDoc.count() === 0) test.skip(true, "시험지 done doc 없음");
  await testDoc.click();
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-doc-hit-report-curate-btn']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-problem-card']").count()) > 0,
    { timeoutMs: 10_000, description: "test document detail settled" },
  ).catch(() => {});

  // 헤더 액션바 (적중 보고서 작성 + 직접 자르기 + 더 보기) 클로즈업
  const headerArea = page.locator("[data-testid='matchup-doc-hit-report-curate-btn']").locator("xpath=ancestor::*[2]");
  if (await headerArea.count() > 0) {
    await headerArea.first().screenshot({ path: `${OUT}/zoom-header-actions-1440.png` });
  }

  // 1100 narrow 에서도 같은 영역
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(page.locator("body")).toBeVisible();
  if (await headerArea.count() > 0) {
    await headerArea.first().screenshot({ path: `${OUT}/zoom-header-actions-1100.png` });
  }

  // 문제 카드 그리드 영역 — 1글자/줄 줄바꿈 확인
  const grid = page.locator("[data-testid='matchup-problem-card']").first().locator("xpath=ancestor::*[3]");
  if (await grid.count() > 0) {
    await grid.first().screenshot({ path: `${OUT}/zoom-problem-grid-1100.png` });
  }

  // 1366 (대표 노트북 폭)에서도
  await page.setViewportSize({ width: 1366, height: 800 });
  await expect(page.locator("body")).toBeVisible();
  if (await grid.count() > 0) {
    await grid.first().screenshot({ path: `${OUT}/zoom-problem-grid-1366.png` });
  }
  if (await headerArea.count() > 0) {
    await headerArea.first().screenshot({ path: `${OUT}/zoom-header-actions-1366.png` });
  }
});
