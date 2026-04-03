import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("trace modal error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`STACK: ${err.stack}`);
    errors.push(`MSG: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`CONSOLE: ${msg.text().substring(0, 500)}`);
      // Try to get stack from args
      msg.args().forEach(async (arg, i) => {
        try {
          const val = await arg.jsonValue();
          errors.push(`ARG${i}: ${JSON.stringify(val).substring(0, 300)}`);
        } catch {}
      });
    }
  });

  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
  await page.waitForTimeout(3000);

  const cb = page.locator("table tbody tr").first().locator('input[type="checkbox"]');
  if (await cb.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cb.check();
    await page.waitForTimeout(500);
  }

  const btn = page.locator("button").filter({ hasText: /메시지 발송/ }).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(3000);
  }

  console.log("=== FULL ERRORS ===");
  for (const e of errors) console.log(e);
  console.log("=== END ===");
});
