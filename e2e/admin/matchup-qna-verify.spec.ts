/**
 * Q&A 매치업 결과 표시 확인
 */
import { test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test("Q&A 매치업 결과 스크린샷", async ({ page }) => {
  test.setTimeout(30_000);
  await loginViaUI(page, "admin");

  // 커뮤니티 > Q&A 탭 이동
  await page.goto("https://hakwonplus.com/admin/community", { waitUntil: "load", timeout: 15000 });
  await page.waitForTimeout(1000);

  // QnA 탭 클릭
  const qnaTab = page.locator("a, button").filter({ hasText: "QnA" }).first();
  await qnaTab.click();
  await page.waitForTimeout(2000);

  // [E2E] test question 클릭
  const qna = page.locator("text=test question").first();
  if (await qna.isVisible({ timeout: 5000 }).catch(() => false)) {
    await qna.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/qna-matchup-results.png", fullPage: false });
  } else {
    // Q&A 목록 스크린샷
    await page.screenshot({ path: "e2e/screenshots/qna-list.png", fullPage: false });
  }
});
