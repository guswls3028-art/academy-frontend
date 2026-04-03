import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("0317테스트학생 대상 양식 발송", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/lectures/77/sessions/57/scores", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(10000);

  // 대상자 전원등록 (새 학생 포함)
  const enrollBtn = page.locator("button").filter({ hasText: "대상자 전원등록" });
  if (await enrollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enrollBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.reload({ waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e/screenshots/final-students.png" });

  // 0317테스트학생 찾기
  const targetRow = page.locator("tr").filter({ hasText: "0317테스트학생" });
  const found = await targetRow.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(">>> 0317테스트학생 found:", found);

  if (found) {
    // 체크
    const cb = targetRow.locator('input[type="checkbox"]');
    await cb.check({ force: true });
    await page.waitForTimeout(500);
  } else {
    console.log(">>> 0317테스트학생 없음. 전체 학생 리스트:");
    const rows = page.locator("table tbody tr");
    const rc = await rows.count();
    for (let i = 0; i < Math.min(rc, 5); i++) {
      const txt = await rows.nth(i).textContent();
      console.log(`>>>   row ${i}: ${txt?.substring(0, 50)}`);
    }
    return;
  }

  // 수업결과 발송
  console.log(">>> 수업결과 발송 클릭");
  await page.locator("button").filter({ hasText: "수업결과 발송" }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e/screenshots/final-modal.png" });

  const textarea = page.locator("textarea").first();
  if (await textarea.isVisible({ timeout: 8000 }).catch(() => false)) {
    const body = await textarea.inputValue();
    console.log(">>> === MODAL BODY ===");
    console.log(body);
    console.log(">>> === END ===");

    // 실제 발송
    console.log(">>> 발송 클릭!");
    await page.locator("button").filter({ hasText: /에게.*발송/ }).first().click();
    await page.waitForTimeout(5000);

    console.log(">>> 발송 완료");
  }
});
