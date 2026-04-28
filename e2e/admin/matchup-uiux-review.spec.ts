// PATH: e2e/admin/matchup-uiux-review.spec.ts
// 운영 매치업 화면 UI/UX 시각 검수용 — 스크린샷만 찍어 시각 검수

import { test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test("매치업 UI/UX 시각 검수 — 4 화면", async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/storage/matchup", { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 1. 매치업 메인 화면 (doc list + 빈 상태)
  await page.screenshot({
    path: "e2e/_local/screenshots/matchup-uiux-1-main.png",
    fullPage: false,
  });

  // 카테고리 펼침 시도 (참고 자료)
  const refCategory = page.locator('[data-testid="matchup-category-header"]').filter({ hasText: "참고" }).first();
  if (await refCategory.count() > 0) {
    await refCategory.click();
    await page.waitForTimeout(800);
  }

  // 2. 첫 doc 클릭
  const allRows = page.locator('[data-testid="matchup-doc-row"]');
  const rowCount = await allRows.count();
  console.log(`doc rows: ${rowCount}`);
  if (rowCount > 0) {
    await allRows.first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "e2e/_local/screenshots/matchup-uiux-2-first-doc.png",
      fullPage: false,
    });

    // 3. problem 카드 클릭
    const cards = page.locator('[data-testid="matchup-problem-card"]');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForTimeout(1500);
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
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "e2e/_local/screenshots/matchup-uiux-4-reference-doc.png",
      fullPage: false,
    });
  }

  console.log("✓ UI/UX 검수 4 스크린샷 저장");
});
