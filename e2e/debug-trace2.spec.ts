import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("trace2", async ({ page }) => {
  page.on("console", async (msg) => {
    if (msg.type() === "error") {
      for (const arg of msg.args()) {
        try {
          const val = await arg.jsonValue();
          if (typeof val === "string" && val.length > 100) {
            console.log("FULL_ARG:", val.substring(0, 2000));
          }
        } catch {}
      }
    }
  });

  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const cb = page.locator("table tbody tr").first().locator('input[type="checkbox"]');
  if (await cb.isVisible({ timeout: 5000 }).catch(() => false)) await cb.check();
  await page.waitForTimeout(500);
  const btn = page.locator("button").filter({ hasText: /메시지 발송/ }).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) await btn.click();
  await page.waitForTimeout(3000);
});
