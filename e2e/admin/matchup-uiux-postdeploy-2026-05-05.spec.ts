/**
 * 매치업 UIUX 배포후 실사용 리뷰 — 학원장 시점.
 * Button 아이콘 정렬/줄바꿈 fix 후 시각 검증.
 */
import { test } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const OUT = "e2e/_artifacts/matchup-uiux-postdeploy-2026-05-05";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("매치업 UIUX 배포후 실사용", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
  });

  test("01-entry — 빈 상태 (좌측 트리)", async ({ page }) => {
    await page.screenshot({ path: `${OUT}/01-entry-1440.png`, fullPage: false });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/01-entry-1024.png`, fullPage: false });
  });

  test("02-test-doc — 시험지 doc 헤더 (적중 보고서 작성 + 직접 자르기)", async ({ page }) => {
    const testDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='test'][data-doc-status='done']").first();
    if (await testDoc.count() === 0) test.skip(true, "시험지 done doc 없음");
    await testDoc.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/02-test-header-1440.png`, fullPage: false });
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/02-test-header-1100.png`, fullPage: false });
  });

  test("03-failed-banner — 분석 실패 배너 + 재시도 버튼", async ({ page }) => {
    const failedDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-status='failed']").first();
    if (await failedDoc.count() === 0) test.skip(true, "실패 doc 없음");
    await failedDoc.click();
    await page.waitForTimeout(2000);
    const banner = page.locator("[data-testid='matchup-failed-banner']");
    await banner.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await banner.screenshot({ path: `${OUT}/03-failed-banner.png` });
  });

  test("04-paper-type-banner — 자동분리 정확도 경고 배너 + 직접 자르기", async ({ page }) => {
    const docs = page.locator("[data-testid='matchup-doc-row'][data-doc-status='done']");
    const n = await docs.count();
    let found = false;
    for (let i = 0; i < Math.min(n, 20); i++) {
      await docs.nth(i).click();
      await page.waitForTimeout(1500);
      const banner = page.locator("[data-testid='matchup-paper-type-banner']");
      if (await banner.count() > 0) {
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
      await docs.nth(i).click();
      await page.waitForTimeout(1500);
      const btn = page.locator("[data-testid='matchup-low-conf-reviewer-open-btn']");
      if (await btn.count() > 0) {
        const region = btn.locator("xpath=ancestor::*[1]");
        await region.screenshot({ path: `${OUT}/05-low-conf-area.png` });
        await btn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/05-low-conf-reviewer-open.png`, fullPage: false });
        found = true;
        break;
      }
    }
    if (!found) test.skip(true, "low-conf 검수 영역 노출된 doc 없음");
  });

  test("06-hit-report-editor — 적중 보고서 편집기 4버튼 헤더", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/hit-reports`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const firstReport = page.locator("[data-testid^='hit-report-row-']").first();
    if (await firstReport.count() === 0) test.skip(true, "적중 보고서 없음");
    await firstReport.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/06-hit-report-editor-1440.png`, fullPage: false });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/06-hit-report-editor-1024.png`, fullPage: false });
  });

  test("07-hit-report-list — 적중 보고서 리스트 헤더 (새로고침 버튼)", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/hit-reports`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/07-hit-report-list.png`, fullPage: false });
  });
});
