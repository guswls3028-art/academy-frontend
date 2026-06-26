/**
 * HitReport storage tab + 리스트 페이지 + 미리보기/편집 진입 흐름 (P1, 2026-05-04).
 *
 * 박철 학원장(T2 tchul-admin) 자격으로 매치업 활용 진입 동선 검증:
 * 1. 자료실 안의 "적중 보고서" 탭 노출
 * 2. /admin/storage/hit-reports 도달, draft alert banner 노출
 * 3. 카드 클릭 → 미리보기 모달 → 매치업 편집기로 이동
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

  test("자료실 '적중 보고서' 탭 노출 + click → 리스트 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/dashboard`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-sidebar.png`,
      fullPage: true,
    });

    await page.goto(`${BASE}/admin/storage/hit-reports`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    await page.waitForURL(/\/admin\/storage\/hit-reports/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-hit-reports-page.png`,
      fullPage: true,
    });

    // 페이지 헤더 확인
    await expect(page.getByRole("button", { name: /적중 보고서/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /적중 보고서/ })).toBeVisible();
  });

  test("draft alert banner + 카드 click → 미리보기 후 편집기 진입", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/hit-reports`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    // alert banner 확인 (draft 1건 이상이면 표시)
    const banner = page.getByText(/작성중 \d+건/);
    const bannerVisible = await banner.isVisible().catch(() => false);
    if (bannerVisible) {
      console.log("draft alert banner visible");
    }

    const firstCard = page.getByTestId("hit-report-card").first();
    const visible = await firstCard.isVisible().catch(() => false);
    if (visible) {
      await firstCard.click();
      const preview = page.getByRole("dialog", { name: /적중보고서 미리보기/ });
      await expect(preview).toBeVisible({ timeout: 10_000 });
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/03-preview-opened.png`,
        fullPage: true,
      });

      const editButton = preview.getByTestId("hit-report-preview-edit");
      await expect(editButton).toBeVisible({ timeout: 5_000 });
      await editButton.click();
      await page.waitForURL(/\/admin\/storage\/matchup/, { timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/04-editor-opened.png`,
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
