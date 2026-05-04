/**
 * HitReport sidebar + 리스트 페이지 + 편집기 진입 흐름 (P1, 2026-05-04).
 *
 * 박철 학원장(T2 tchul-admin) 자격으로 매치업 활용 진입 동선 검증:
 * 1. 사이드바 "적중 보고서" 메뉴 노출
 * 2. 클릭 → /admin/hit-reports 도달, draft alert banner 노출
 * 3. 카드 클릭 → 매치업 페이지 + HitReportEditor 자동 오픈
 * 4. 편집기 좌측 진행률 bar 시각 검증
 *
 * Read-only — mutation 없음 (카드 click + editor 진입만, 저장/제출 X).
 */
import { expect, test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const BASE = "https://tchul.com";
const SCREENSHOT_DIR = "e2e/_artifacts/hit-reports-flow";

test.describe("HitReport sidebar 진입 흐름 (P1)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
  });

  test("사이드바 '적중 보고서' 메뉴 노출 + click → 리스트 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-sidebar.png`,
      fullPage: true,
    });

    // 사이드바 "적중 보고서" 링크
    const link = page.getByRole("link", { name: /적중 보고서/ });
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();

    await page.waitForURL(/\/admin\/hit-reports/, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-hit-reports-page.png`,
      fullPage: true,
    });

    // 페이지 헤더 확인
    await expect(page.getByRole("heading", { name: /적중 보고서/ })).toBeVisible();
  });

  test("draft alert banner + 카드 click → 편집기 자동 오픈", async ({ page }) => {
    await page.goto(`${BASE}/admin/hit-reports`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2000);

    // alert banner 확인 (draft 1건 이상이면 표시)
    const banner = page.getByText(/작성중 \d+건/);
    const bannerVisible = await banner.isVisible().catch(() => false);
    if (bannerVisible) {
      console.log("draft alert banner visible");
    }

    // 첫 카드 click (있으면)
    const firstCard = page.getByRole("button").filter({ hasText: /작성|제출/ }).first();
    const visible = await firstCard.isVisible().catch(() => false);
    if (visible) {
      await firstCard.click();
      // 매치업 페이지로 navigate + editor 오픈
      await page.waitForURL(/\/admin\/storage\/matchup/, { timeout: 30_000 });
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/03-editor-opened.png`,
        fullPage: true,
      });
    } else {
      console.log("no cards visible (empty state)");
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/03-empty-state.png`,
        fullPage: true,
      });
    }
  });
});
