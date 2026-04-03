import { test } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";

test.describe("UIUX 전수 검사", () => {
  test.beforeEach(async ({ page }) => { await loginViaUI(page, "admin"); });

  test("1. 클리닉 메시지 설정 전체 스크롤", async ({ page }) => {
    await page.goto(`${B}/admin/clinic/msg-settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/ui-clinic-msg-top.png", fullPage: false });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/ui-clinic-msg-bottom.png", fullPage: false });
  });

  test("2. 커뮤니티 설정 전체", async ({ page }) => {
    await page.goto(`${B}/admin/community/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/ui-community-settings.png", fullPage: true });
  });

  test("3. 직원 설정 전체", async ({ page }) => {
    await page.goto(`${B}/admin/staff/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/ui-staff-settings.png", fullPage: true });
  });

  test("4. 메시지 설정 (대행 모드)", async ({ page }) => {
    await page.goto(`${B}/admin/message/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    // 대행 모드로 전환
    const agencyBtn = page.locator("button").filter({ hasText: "대행 요청" }).first();
    if (await agencyBtn.isVisible({ timeout: 3000 }).catch(() => false)) await agencyBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/ui-msg-settings-agency.png", fullPage: true });
  });

  test("5. 메시지 설정 (직접 연동 + 뿌리오)", async ({ page }) => {
    await page.goto(`${B}/admin/message/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const selfBtn = page.locator("button").filter({ hasText: "직접 연동" }).first();
    if (await selfBtn.isVisible({ timeout: 3000 }).catch(() => false)) await selfBtn.click();
    await page.waitForTimeout(500);
    // 뿌리오 선택 시도
    page.once("dialog", async d => await d.accept());
    const ppBtn = page.locator("button").filter({ hasText: "뿌리오(Ppurio)" }).first();
    if (await ppBtn.isVisible({ timeout: 3000 }).catch(() => false)) await ppBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/ui-msg-settings-ppurio.png", fullPage: true });
    // 솔라피로 복원
    page.once("dialog", async d => await d.accept());
    const slBtn = page.locator("button").filter({ hasText: "솔라피(Solapi)" }).first();
    if (await slBtn.isVisible({ timeout: 2000 }).catch(() => false)) await slBtn.click();
    await page.waitForTimeout(500);
  });

  test("6. 자동발송 전체 페이지", async ({ page }) => {
    await page.goto(`${B}/admin/message/auto-send`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/ui-autosend-page.png", fullPage: true });
  });

  test("7. 발송 내역 (로그)", async ({ page }) => {
    await page.goto(`${B}/admin/message/log`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/ui-msg-log.png", fullPage: true });
  });

  test("8. 성적 발송 모달", async ({ page }) => {
    // 성적 페이지 → 학생 선택 → 발송 모달
    await page.goto(`${B}/admin/results`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/ui-scores-page.png", fullPage: false });
  });
});
