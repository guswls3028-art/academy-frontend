import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
test("콘솔 에러 캡처", async ({ page }) => {
  await loginViaUI(page, "admin");
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push("PAGEERR: " + err.message));
  
  await page.goto(`${B}/admin/staff/attendance?staffId=20&year=2026&month=3`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  
  // 날짜 클릭
  await page.locator(".staff-calendar__cell--worked").first().click();
  await page.waitForTimeout(3000);
  
  for (const e of errors) console.log("ERR:", e.slice(0, 300));
  console.log("Total errors:", errors.length);
});
