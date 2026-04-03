import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
test.describe("UIUX 최종 확인", () => {
  test.beforeEach(async ({ page }) => { await loginViaUI(page, "admin"); });

  test("메시지 설정 (간소화 후)", async ({ page }) => {
    await page.goto(`${B}/admin/message/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/final-msg-settings.png", fullPage: true });
  });

  test("클리닉 메시지 설정", async ({ page }) => {
    await page.goto(`${B}/admin/clinic/msg-settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/final-clinic-msg.png", fullPage: true });
  });

  test("자동발송 페이지 (both 제거 확인)", async ({ page }) => {
    await page.goto(`${B}/admin/message/auto-send`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/final-autosend.png", fullPage: true });
  });

  test("발송 내역", async ({ page }) => {
    await page.goto(`${B}/admin/message/log`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/final-log.png", fullPage: true });
  });
});
