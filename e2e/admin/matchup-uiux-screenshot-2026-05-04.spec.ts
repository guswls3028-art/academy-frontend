/**
 * 매치업 UIUX 개편 — 시각 검수용 스크린샷.
 * 학원장 시점에서 화면이 친절·직관적인지 직접 확인.
 */
import { test } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("매치업 UIUX 시각 검수", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
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
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/02-test-doc-header.png",
      fullPage: false,
    });
  });

  test("03 — 참고자료 doc 헤더 (적중보고서 CTA 미노출 + segmented 토글 reference active)", async ({ page }) => {
    const refDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='reference']").first();
    if (await refDoc.count() === 0) test.skip(true, "참고자료 doc 없음");
    await refDoc.click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/03-reference-doc-header.png",
      fullPage: false,
    });
  });

  test("04 — 시험지 → 참고자료 confirm 다이얼로그", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test']").first();
    if (await testDoc.count() === 0) test.skip(true, "시험지 doc 없음");
    await testDoc.click();
    await page.waitForTimeout(1500);
    await page.locator("[data-testid='matchup-intent-toggle-reference']").click();
    await page.waitForTimeout(800);
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
    await page.waitForTimeout(2000);
    const enter = page.locator("[data-testid='matchup-merge-mode-enter']");
    if (await enter.count() === 0) test.skip(true, "합치기 진입 없음");
    await enter.click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: "e2e/_artifacts/matchup-uiux-2026-05-04/05-merge-mode-help.png",
      fullPage: false,
    });
  });

  test("06 — 시험지 + 문제 선택 시 우측 SimilarResults (Pin hint + 카드)", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test'][data-doc-status='done']").first();
    if (await testDoc.count() === 0) test.skip(true, "시험지 done doc 없음");
    await testDoc.click();
    await page.waitForTimeout(2500);
    const firstP = page.locator("[data-testid='matchup-problem-card']").first();
    if (await firstP.count() === 0) test.skip(true, "문항 없음");
    await firstP.click();
    await page.waitForTimeout(2500);
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
