// tchul-admin (Tenant 2 owner) 로그인 후 동선 시각 검수.
// **read-only**: login → capture → logout. 학원장 데이터 변경 X.
// 사용자 명시 OK 받음 (실사용 테넌트 single login + 캡처는 데이터 무영향).
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("tchul-admin 동선 시각 검수 (Tenant 2 owner)", () => {
  test("admin 로그인 + Header dropdown — 우리 학원 홈페이지 노출", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/tchul-admin-dashboard.png`, fullPage: false });

    const avatar = page.locator('[role="button"]').filter({ has: page.locator('img,svg') }).last();
    if (await avatar.count() > 0) {
      await avatar.click({ force: true }).catch(() => {});
      await expect(page.locator('[role="menuitem"]').first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
    }
    await page.screenshot({ path: `${OUT}/tchul-admin-header-dropdown.png`, fullPage: false, clip: { x: 1400, y: 0, width: 520, height: 500 } });

    const items = await page.evaluate(() => Array.from(document.querySelectorAll('[role="menuitem"]')).map((el) => el.textContent?.trim()));
    console.log("TCHUL_DROPDOWN:", JSON.stringify(items));
  });

  test("tchul.com /landing 진입 — owner floating fab 노출", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await gotoAndSettle(page, "https://tchul.com/landing", { timeout: 20_000 });
    await expect(page.getByText(/홈페이지 꾸미기|관리실로/).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/tchul-admin-landing-fab.png`, fullPage: false });
    await page.screenshot({ path: `${OUT}/tchul-admin-landing-fab-bottom.png`, fullPage: false, clip: { x: 1500, y: 800, width: 420, height: 280 } });
    const fab = await page.getByText("홈페이지 꾸미기").count();
    const consoleFab = await page.getByText("관리실로").count();
    console.log("TCHUL_ADMIN_FABS:", JSON.stringify({ edit: fab, console: consoleFab }));
  });

  test("LandingEditor → 최근 적중 사례 picker (backend backfill 후)", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await gotoAndSettle(page, "https://tchul.com/admin/settings/landing", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "홈페이지 꾸미기" })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/tchul-admin-landing-editor.png`, fullPage: true });

    const hitNavBtn = page.getByText("최근 적중 사례 (매치업)").first();
    if (await hitNavBtn.count() > 0) {
      await hitNavBtn.click();
      await expect(page.getByTestId("hit-report-picker")).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: `${OUT}/tchul-admin-picker.png`, fullPage: true });
      console.log("PICKER_OK");
    } else {
      console.log("PICKER_MISSING — backend backfill 미배포 또는 nav 라벨 mismatch");
    }
  });
});
