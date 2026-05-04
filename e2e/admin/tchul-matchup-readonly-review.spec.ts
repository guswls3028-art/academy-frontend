/**
 * Tchul (T2) 매치업 실사용 시각 검수 — read-only.
 *
 * 사용자 자율 권한: 학원장 자격(01035023313/727258)으로 매치업 도메인 시각 검수.
 * 12 결함 doc + 검수 UI + hit report editor screenshot.
 *
 * 주의: read-only — 새 doc 업로드/삭제/edit 등 mutation 없음. screenshot만.
 */
import { expect, test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const BASE = "https://tchul.com";
const SCREENSHOT_DIR = "e2e/_artifacts/tchul-matchup-review";

test.describe("Tchul T2 매치업 실사용 시각 검수 (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
  });

  test("매치업 메인 페이지 + doc 리스트 screenshot", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2000); // 데이터 로딩 대기
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-matchup-main.png`,
      fullPage: true,
    });
    // doc row 확인
    const rows = page.locator('[data-testid="matchup-doc-row"]');
    const count = await rows.count();
    console.log(`doc rows visible: ${count}`);
    expect(count).toBeGreaterThan(0);
  });

  test("12 결함 doc 중 핵심 4개 detail screenshot", async ({ page }) => {
    const targetTitles = [
      "통합과학",  // doc#291 KakaoTalk 합치기 (학생답안지)
      "은광",      // doc#294 (4-quadrant)
      "중대부고",  // doc#148
      "언남",      // doc#329
    ];
    await page.goto(`${BASE}/admin/storage/matchup`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    for (const title of targetTitles) {
      const row = page.locator('[data-testid="matchup-doc-row"]')
        .filter({ hasText: title })
        .first();
      const visible = await row.isVisible().catch(() => false);
      if (!visible) {
        console.log(`SKIP ${title} not visible`);
        continue;
      }
      await row.click();
      await page.waitForTimeout(2000);
      const safeName = title.replace(/[^\w가-힣]/g, "_");
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/02-doc-${safeName}.png`,
        fullPage: true,
      });
      // 모달 닫기 (있으면)
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  });

  test("HitReport 리스트 + 편집기 screenshot", async ({ page }) => {
    await page.goto(`${BASE}/admin/hit-reports`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-hit-reports-list.png`,
      fullPage: true,
    });
    // 첫 보고서 click (있으면)
    const firstReport = page.locator('[data-testid*="hit-report"]').first();
    const visible = await firstReport.isVisible().catch(() => false);
    if (visible) {
      await firstReport.click();
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/04-hit-report-editor.png`,
        fullPage: true,
      });
    }
  });
});
