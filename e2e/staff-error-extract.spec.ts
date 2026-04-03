import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
test("에러 추출", async ({ page }) => {
  await loginViaUI(page, "admin");
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  
  await page.goto(`${B}/admin/staff/attendance?staffId=20&year=2026&month=3`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  
  // inject error catcher before click
  await page.evaluate(() => {
    window.addEventListener("error", (e) => {
      (window as any).__lastErr = e.message + " | " + e.filename + ":" + e.lineno;
    });
  });
  
  // click date
  const btns = page.locator("button");
  const count = await btns.count();
  for (let i = 0; i < count; i++) {
    const t = await btns.nth(i).textContent().catch(() => "");
    if (t?.trim() === "29" || t?.includes("29\n")) {
      await btns.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(3000);
  
  const lastErr = await page.evaluate(() => (window as any).__lastErr).catch(() => "no window error");
  console.log("Last error:", lastErr);
  for (const e of errors.slice(-5)) console.log("Console:", e.slice(0, 400));
  await page.screenshot({ path: "e2e/screenshots/error-extract.png" });
});
