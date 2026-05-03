import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("매치업 업로드 의도 UI 구분", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("시험지/참고자료 버튼에 따라 업로드 모달 타이틀이 분리 노출된다", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });

    const testUploadBtn = page.locator(
      "[data-testid='matchup-upload-button'], [data-testid='matchup-empty-test-btn']",
    ).first();
    const referenceUploadBtn = page.locator(
      "[data-testid='matchup-reference-upload-button'], [data-testid='matchup-empty-reference-btn']",
    ).first();

    await expect(testUploadBtn).toBeVisible({ timeout: 10000 });
    await expect(referenceUploadBtn).toBeVisible({ timeout: 10000 });

    await testUploadBtn.click();
    await expect(page.locator("[data-testid='matchup-upload-modal']")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("학생 시험지 업로드").first()).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-testid='matchup-upload-modal']")).toHaveCount(0);

    await referenceUploadBtn.click();
    await expect(page.locator("[data-testid='matchup-upload-modal']")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("참고 자료 업로드").first()).toBeVisible({ timeout: 5000 });
  });

  test("segmented 토글로 시험지/참고자료를 전환할 수 있다", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    // 참고자료(reference) doc만 사용 — 시험지→참고자료 전환은 confirm 가드가 새로 끼어들어
    // 여기서는 기본 토글 동작만 검증 (confirm 가드는 matchup-uiux-2026-05-04.spec에서 별도 검증).
    const refDoc = page.locator("[data-testid='matchup-doc-row'][data-doc-intent='reference']").first();
    if (await refDoc.count() === 0) {
      test.skip(true, "참고자료 doc 없음 — 전환 시나리오를 건너뜁니다.");
      return;
    }
    await refDoc.click();
    await page.waitForTimeout(800);

    const toggle = page.locator("[data-testid='matchup-intent-toggle']");
    await expect(toggle).toBeVisible({ timeout: 5000 });
    // 현재 reference active
    await expect(page.locator("[data-testid='matchup-intent-toggle-reference'][data-active='true']")).toBeVisible();

    // 시험지로 전환 (참고자료 → 시험지는 confirm 없이 바로 진행)
    await page.locator("[data-testid='matchup-intent-toggle-test']").click();
    await expect(page.locator("[data-testid='matchup-intent-toggle-test'][data-active='true']"))
      .toBeVisible({ timeout: 10000 });
  });
});
