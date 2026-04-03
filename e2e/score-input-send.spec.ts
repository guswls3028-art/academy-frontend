import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("점수입력 + 양식발송", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/lectures/77/sessions/57/scores", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(10000);

  await page.locator("button").filter({ hasText: "편집 모드" }).click();
  await page.waitForTimeout(3000);

  // draft 모달 → 버리기
  const dlg = page.locator('[role="dialog"]');
  if (await dlg.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dlg.locator("button").filter({ hasText: "버리기" }).click();
    await page.waitForTimeout(2000);
  }

  // 점수 입력
  const row = page.locator("tr").filter({ hasText: "0317테스트학생" });
  for (const [idx, score] of [[3,"25"],[5,"8"],[7,"6"],[9,"5"]] as [number,string][]) {
    await row.locator("td").nth(idx).click();
    await page.waitForTimeout(500);
    const inp = row.locator("td").nth(idx).locator("input").first();
    if (await inp.isVisible({ timeout: 800 }).catch(() => false)) await inp.fill(score);
    else await page.keyboard.type(score);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    console.log(`>>> ${score} 입력`);
  }

  // 저장하기
  console.log(">>> 저장하기 클릭");
  await page.locator("button").filter({ hasText: "저장하기" }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/after-save.png" });

  // 학생 선택 + 수업결과 발송
  const row2 = page.locator("tr").filter({ hasText: "0317테스트학생" });
  await row2.locator('input[type="checkbox"]').check({ force: true });
  await page.waitForTimeout(500);

  console.log(">>> 수업결과 발송");
  await page.locator("button").filter({ hasText: "수업결과 발송" }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e/screenshots/final-send-modal.png" });

  const ta = page.locator("textarea").first();
  if (await ta.isVisible({ timeout: 8000 }).catch(() => false)) {
    const body = await ta.inputValue();
    console.log(">>> === 발송 본문 ===");
    console.log(body);
    console.log(">>> === END ===");
    
    // 발송
    await page.locator("button").filter({ hasText: /에게.*발송/ }).first().click();
    await page.waitForTimeout(5000);
    console.log(">>> 발송 완료!");
  }
});
