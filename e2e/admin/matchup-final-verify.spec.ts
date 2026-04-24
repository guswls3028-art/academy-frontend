/**
 * 매치업 최종 검증 — 문서 선택 → 문제 그리드 → 유사 문제 추천
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test("매치업 전체 플로우 스크린샷", async ({ page }) => {
  test.setTimeout(60_000);
  await loginViaUI(page, "admin");

  await page.goto("https://hakwonplus.com/admin/storage/matchup", { waitUntil: "load", timeout: 15000 });
  await page.waitForTimeout(2000);

  // 1. 첫 번째 문서 클릭
  const firstDoc = page.locator("[class*=tree] [class*=treeScroll] > div").first();
  await firstDoc.click();
  await page.waitForTimeout(2000);

  // 2. Q1 클릭 → 유사 문제 추천
  await page.locator("text=Q1").first().click();
  await page.waitForTimeout(4000);  // API 호출 대기

  // 3. 유사 문제 추천 섹션까지 스크롤
  const content = page.locator("[class*=gridWrap]");
  await content.evaluate(el => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "e2e/screenshots/final-similar-results.png", fullPage: false });

  // 4. 전체 페이지 스크린샷 (풀페이지)
  await content.evaluate(el => el.scrollTop = 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "e2e/screenshots/final-full-page.png", fullPage: true });
});
