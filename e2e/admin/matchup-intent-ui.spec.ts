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

  test("문서 유형 변경 버튼으로 시험지/참고자료를 전환할 수 있다", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    const firstDoc = page.locator("[data-testid='matchup-doc-row']").first();
    if (await firstDoc.count() === 0) {
      test.skip(true, "문서가 없어 유형 전환 시나리오를 건너뜁니다.");
      return;
    }

    await firstDoc.click();
    await page.waitForTimeout(800);
    const convertBtn = page.getByRole("button", { name: /시험지로 변경|참고자료로 변경/ }).first();
    if (await convertBtn.count() === 0) {
      test.skip(true, "실행 대상 환경이 아직 최신 UI(문서 유형 전환 버튼)로 배포되지 않았습니다.");
      return;
    }
    await expect(convertBtn).toBeVisible({ timeout: 5000 });
    const before = (await convertBtn.textContent())?.trim() ?? "";
    await convertBtn.click();
    await expect(page.getByRole("button", { name: before.includes("시험지") ? "참고자료로 변경" : "시험지로 변경" }))
      .toBeVisible({ timeout: 10000 });
  });
});
