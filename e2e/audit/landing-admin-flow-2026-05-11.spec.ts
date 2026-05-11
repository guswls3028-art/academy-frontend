// 학원장 (Tenant 1 admin) 로그인 후 홈페이지 동선 시각 검수.
// 1) Header dropdown — "우리 학원 홈페이지" 메뉴 노출 (owner)
// 2) /admin/settings/landing → LandingEditor → SECTION_LABELS에 "최근 적중 사례 (매치업)" 노출
// 3) 클릭 → HitReportPicker UI 노출 (보고서 리스트 + 체크박스 + 적중률)
// 4) /landing 진입 → floating fab "홈페이지 꾸미기" / "관리실로" 노출 (owner only)
import { test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("학원장 동선 시각 검수 (admin role)", () => {
  test("admin 로그인 + Header dropdown 캡처", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/admin-dashboard.png`, fullPage: false });

    // 프로필 dropdown 열기 (StaffRoleAvatar 클릭)
    const avatar = page.locator('[role="button"]').filter({ has: page.locator('img,svg') }).last();
    await avatar.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/admin-header-dropdown.png`, fullPage: false, clip: { x: 1400, y: 0, width: 520, height: 500 } });

    // dropdown text 직접 확인
    const dropdownText = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map((el) => el.textContent?.trim());
      return items;
    });
    console.log("DROPDOWN_ITEMS:", JSON.stringify(dropdownText));
  });

  test("LandingEditor → 최근 적중 사례 picker 캡처", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/settings/landing", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/admin-landing-editor.png`, fullPage: true });

    const navItems = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("button, a")).map((el) => el.textContent?.trim()).filter((t) => t && t.length < 30);
    });
    const hitNav = navItems.filter((t) => t?.includes("적중"));
    console.log("NAV_HIT_RELATED:", JSON.stringify(hitNav));

    // hit_reports section nav 클릭
    const hitNavBtn = page.getByText("최근 적중 사례 (매치업)").first();
    if (await hitNavBtn.count() > 0) {
      await hitNavBtn.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/admin-landing-editor-picker.png`, fullPage: true });
    } else {
      console.log("WARN: hit_reports section nav 미노출 — sections에 hit_reports가 draft에 없을 수 있음");
    }
  });

  test("/landing 진입 — owner floating fab 노출 캡처", async ({ page }) => {
    await loginViaUI(page, "admin");
    // hakwonplus는 자체 랜딩 없을 가능성 → /landing 가면 /login redirect. tchul.com에 admin token으로 접근 시도
    // tchul subdomain은 별도 origin이라 token 공유 안 됨. hakwonplus.com/landing으로만 시도.
    await page.goto("https://hakwonplus.com/landing", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/admin-landing-direct.png`, fullPage: false });
    const fab = await page.getByText("홈페이지 꾸미기").count();
    const consoleFab = await page.getByText("관리실로").count();
    console.log("ADMIN_FABS:", JSON.stringify({ edit: fab, console: consoleFab }));
  });
});
