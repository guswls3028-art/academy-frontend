import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("quick score test", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/lectures/77/sessions/57/scores", { waitUntil: "load" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e/screenshots/quick-score.png" });
  
  const bodyText = await page.textContent("body") ?? "";
  console.log(">>> Page contains:");
  console.log("  수강생:", bodyText.includes("수강생") ? "YES" : "NO");
  console.log("  등록:", bodyText.includes("등록") ? "YES" : "NO");
  console.log("  1차시:", bodyText.includes("1차시") ? "YES" : "NO");
  console.log("  수업:", bodyText.includes("수업") ? "YES" : "NO");
  
  const checkboxes = page.locator('input[type="checkbox"]');
  console.log("  checkboxes:", await checkboxes.count());
});
