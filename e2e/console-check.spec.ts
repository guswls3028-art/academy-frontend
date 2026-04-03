import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test("console errors on student page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
  await page.waitForTimeout(5000);
  console.log("=== ERRORS ===");
  for (const e of errors) console.log(e);
  console.log("=== END ===");
});
