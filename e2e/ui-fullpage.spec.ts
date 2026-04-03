import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
test("클리닉 메시지 설정 풀페이지", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.goto(`${B}/admin/clinic/msg-settings`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/ui-clinic-fullpage.png", fullPage: true });
});
