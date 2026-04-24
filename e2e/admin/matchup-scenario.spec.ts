/**
 * E2E 시나리오: 매치업 실전 — 문서 2개 업로드 → 문제 추출 → 유사 문제 검색
 * 이미 API로 업로드/처리 완료된 문서 사용 (doc 14, 15)
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("매치업 실전 시나리오", () => {
  test("문서 선택 → 문제 그리드 → 유사 문제 추천 스크린샷", async ({ page }) => {
    test.setTimeout(60_000);
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/storage/matchup", { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);

    // 1. 문서 목록 확인
    await page.screenshot({ path: "e2e/screenshots/scenario-1-doc-list.png", fullPage: true });

    // 2. 첫 번째 문서(Midterm) 클릭
    const midtermDoc = page.locator("text=Midterm").first();
    if (await midtermDoc.isVisible({ timeout: 5000 }).catch(() => false)) {
      await midtermDoc.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/scenario-2-problems.png", fullPage: true });

      // 3. 첫 번째 문제(Q1) 클릭 → 유사 문제 추천
      const q1 = page.locator("text=Q1").first();
      if (await q1.isVisible({ timeout: 5000 }).catch(() => false)) {
        await q1.click();
        await page.waitForTimeout(3000);  // 유사 검색 대기
        await page.screenshot({ path: "e2e/screenshots/scenario-3-similar.png", fullPage: true });
      }
    }

    // 4. Final 문서 클릭
    const finalDoc = page.locator("text=Final").first();
    if (await finalDoc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await finalDoc.click();
      await page.waitForTimeout(2000);

      // Q4 (Trigonometry) 클릭
      const q4 = page.locator("text=Q4").first();
      if (await q4.isVisible({ timeout: 3000 }).catch(() => false)) {
        await q4.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: "e2e/screenshots/scenario-4-trig-similar.png", fullPage: true });
      }
    }
  });
});
