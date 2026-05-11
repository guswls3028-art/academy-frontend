// tchul-admin (Tenant 2 owner) 로그인 후 동선 시각 검수.
// **read-only**: login → capture → logout. 학원장 데이터 변경 X.
// 사용자 명시 OK 받음 (실사용 테넌트 single login + 캡처는 데이터 무영향).
import { test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("tchul-admin 동선 시각 검수 (Tenant 2 owner)", () => {
  test("admin 로그인 + Header dropdown — 우리 학원 홈페이지 노출", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/tchul-admin-dashboard.png`, fullPage: false });

    const avatar = page.locator('[role="button"]').filter({ has: page.locator('img,svg') }).last();
    await avatar.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/tchul-admin-header-dropdown.png`, fullPage: false, clip: { x: 1400, y: 0, width: 520, height: 500 } });

    const items = await page.evaluate(() => Array.from(document.querySelectorAll('[role="menuitem"]')).map((el) => el.textContent?.trim()));
    console.log("TCHUL_DROPDOWN:", JSON.stringify(items));
  });

  test("tchul.com /landing 진입 — owner floating fab 노출", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto("https://tchul.com/landing", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/tchul-admin-landing-fab.png`, fullPage: false });
    await page.screenshot({ path: `${OUT}/tchul-admin-landing-fab-bottom.png`, fullPage: false, clip: { x: 1500, y: 800, width: 420, height: 280 } });
    const fab = await page.getByText("홈페이지 꾸미기").count();
    const consoleFab = await page.getByText("관리실로").count();
    console.log("TCHUL_ADMIN_FABS:", JSON.stringify({ edit: fab, console: consoleFab }));
  });

  test("LandingEditor → 최근 적중 사례 picker (backend backfill 후)", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto("https://tchul.com/admin/settings/landing", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/tchul-admin-landing-editor.png`, fullPage: true });

    const hitNavBtn = page.getByText("최근 적중 사례 (매치업)").first();
    if (await hitNavBtn.count() > 0) {
      await hitNavBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/tchul-admin-picker.png`, fullPage: true });
      console.log("PICKER_OK");
    } else {
      console.log("PICKER_MISSING — backend backfill 미배포 또는 nav 라벨 mismatch");
    }
  });
});
