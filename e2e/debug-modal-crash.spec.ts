import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("debug modal crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`PAGE_ERROR: ${err.stack || err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`CONSOLE_ERROR: ${msg.text()}`);
  });

  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
  await page.waitForTimeout(3000);

  // Select first student
  const cb = page.locator("table tbody tr").first().locator('input[type="checkbox"]');
  if (await cb.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cb.check();
    await page.waitForTimeout(500);
  }

  // Click 메시지 발송
  const btn = page.locator("button").filter({ hasText: /메시지 발송/ }).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(3000);
  }

  // Print all errors
  console.log("=== COLLECTED ERRORS ===");
  for (const e of errors) console.log(e);
  console.log(`=== TOTAL: ${errors.length} errors ===`);

  await page.screenshot({ path: "e2e/screenshots/debug-modal.png" });
});
