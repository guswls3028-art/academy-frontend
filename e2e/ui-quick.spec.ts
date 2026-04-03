import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
test("메시지 설정 확인", async ({ page }) => {
  await loginViaUI(page, "admin");
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(`${B}/admin/message/settings`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e/screenshots/final-msg-settings.png", fullPage: true });
});
test("클리닉 메시지 설정 확인", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto(`${B}/admin/clinic/msg-settings`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e/screenshots/final-clinic-msg.png", fullPage: true });
});
test("자동발송 확인", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto(`${B}/admin/message/auto-send`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e/screenshots/final-autosend.png", fullPage: true });
});
