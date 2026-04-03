import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("score send test", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/lectures/77/sessions/57/scores", { waitUntil: "load" });
  await page.waitForTimeout(8000);
  
  const cbs = page.locator('input[type="checkbox"]');
  console.log(">>> Checkboxes:", await cbs.count());
  
  // Try to find student names
  const rows = page.locator("table tbody tr");
  console.log(">>> Table rows:", await rows.count());
  
  // Check for any visible text containing student names
  const body = await page.textContent("body");
  console.log(">>> Has 0317:", body?.includes("0317") ? "YES" : "NO");
  console.log(">>> Has 선택됨:", body?.includes("선택됨") ? "YES" : "NO");
  console.log(">>> Has 수업결과:", body?.includes("수업결과") ? "YES" : "NO");
  console.log(">>> Has 시험 추가:", body?.includes("시험 추가") ? "YES" : "NO");

  // Select first student via checkbox if available
  if (await cbs.count() > 1) {
    await cbs.nth(1).check({ force: true });
    await page.waitForTimeout(500);
    console.log(">>> Checked nth(1)");
  } else {
    // Maybe it uses a different selection mechanism
    console.log(">>> No checkboxes, trying row click");
  }

  await page.screenshot({ path: "e2e/screenshots/score-test-page.png" });
  
  // Click 수업결과 발송
  const sendBtn = page.locator("button").filter({ hasText: "수업결과 발송" });
  if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(">>> Clicking 수업결과 발송");
    await sendBtn.click();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: "e2e/screenshots/score-test-modal.png" });
    
    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await textarea.inputValue();
      console.log(">>> MODAL BODY:");
      console.log(text.substring(0, 400));
    } else {
      console.log(">>> No textarea visible");
    }
  }
});
