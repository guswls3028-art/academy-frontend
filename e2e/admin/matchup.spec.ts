/**
 * E2E: 매치업 기능 — 사이드바 자료실 → 매치업 탭 → UI 검증
 * Tenant 1 (hakwonplus), [E2E-{timestamp}] 태그
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import type { Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

async function gotoMatchup(page: Page): Promise<void> {
  await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-upload-button']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-doc-row']").count()) > 0 ||
      (await page.getByRole("button", { name: /(내 적중 보고서 모음|학원 적중 보고서 모음)/ }).count()) > 0,
    { timeoutMs: 10_000, description: "matchup page settled" },
  );
}

test.describe("매치업 기능", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("사이드바 '자료실' 클릭 → 매치업 탭으로 이동 + 스크린샷", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/admin`, { timeout: 30_000 });

    // 사이드바에서 '자료 저장소' 클릭
    const navItem = page.getByRole("link", { name: /자료 저장소/ }).first();
    await expect(navItem).toBeVisible({ timeout: 10000 });
    await navItem.click();

    // 매치업 탭이 활성화되어 있어야 함
    await expect(page).toHaveURL(/\/admin\/storage\/matchup/, { timeout: 10000 });

    await waitForCondition(
      async () =>
        (await page.locator("[data-testid='matchup-upload-button']").count()) > 0 ||
        (await page.locator("[data-testid='matchup-doc-row']").count()) > 0,
      { timeoutMs: 10_000, description: "matchup content visible" },
    );

    // 스크린샷: 매치업 빈 상태
    await page.screenshot({ path: "e2e/screenshots/matchup-empty-state.png", fullPage: true });
  });

  test("탭 전환: 매치업 → 저장소 → 매치업 + 스크린샷", async ({ page }) => {
    // 매치업으로 이동
    await gotoMatchup(page);

    // 스크린샷: 매치업 탭
    await page.screenshot({ path: "e2e/screenshots/matchup-tab.png", fullPage: true });

    // 저장소 탭 클릭
    const storageTab = page.getByRole("button", { name: /^저장소$/ }).first();
    await storageTab.click();
    await expect(page).toHaveURL(/\/admin\/storage\/files/, { timeout: 10000 });
    await expect(page.getByRole("button", { name: "추가" }).first()).toBeVisible({ timeout: 5000 });

    // 스크린샷: 저장소 탭
    await page.screenshot({ path: "e2e/screenshots/storage-tab.png", fullPage: true });

    // 다시 매치업 탭
    const matchupTab = page.getByRole("button", { name: /^매치업$/ }).first();
    await matchupTab.click();
    await expect(page).toHaveURL(/\/admin\/storage\/matchup/, { timeout: 10000 });
  });

  test("업로드 모달 열기/닫기 + 스크린샷", async ({ page }) => {
    await gotoMatchup(page);

    // '문서 업로드' 버튼 클릭
    await page.locator("[data-testid='matchup-upload-button']").click();

    // 모달 표시 확인
    const modal = page.locator("[data-testid='matchup-upload-modal']");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 스크린샷: 업로드 모달
    await page.screenshot({ path: "e2e/screenshots/matchup-upload-modal.png", fullPage: true });

    // 취소 버튼으로 닫기
    await modal.getByRole("button", { name: /취소|닫기/ }).last().click();

    // 모달 사라짐 확인
    await expect(modal).not.toBeVisible();
  });
});
