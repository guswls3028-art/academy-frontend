// E2E: 랜딩 페이지 샘플 갤러리 로컬 검증
// 로컬 dev 서버(localhost:5173)에서 tenant 9999/hakwonplus로 접근

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";

test.describe("Landing Samples Gallery (local)", () => {
  test("프로모 페이지에서 샘플 갤러리 진입 가능", async ({ page }) => {
    await page.goto(`${BASE}/promo`);
    await page.waitForLoadState("networkidle");

    const navLink = page.locator('a[href="/promo/landing-samples"]').first();
    await expect(navLink).toBeVisible({ timeout: 10000 });

    await navLink.click();
    await page.waitForURL("**/promo/landing-samples");

    await expect(page.getByRole("heading", { name: "선생님 전용 랜딩 페이지" })).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("Minimal Tutor").first()).toBeVisible();
    await expect(page.getByText("Premium Dark").first()).toBeVisible();
    await expect(page.getByText("Academic Trust").first()).toBeVisible();
    await expect(page.getByText("Program Promo").first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/landing-samples-gallery.png" });
  });

  test("Minimal Tutor 샘플 미리보기 + 돌아가기", async ({ page }) => {
    await page.goto(`${BASE}/promo/landing-samples`);
    await page.waitForLoadState("networkidle");

    // Minimal Tutor 카드 클릭
    await page.getByText("Minimal Tutor").first().click();

    // 템플릿 렌더링 확인 (brand_name이 nav에 존재)
    await expect(page.getByText("체계적인 수학 교육의 시작").first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/landing-sample-minimal-tutor.png" });

    // 돌아가기
    await page.getByRole("button", { name: "목록" }).click();
    await expect(page.getByRole("heading", { name: "선생님 전용 랜딩 페이지" })).toBeVisible({ timeout: 10000 });
  });

  test("Premium Dark 샘플 미리보기", async ({ page }) => {
    await page.goto(`${BASE}/promo/landing-samples`);
    await page.waitForLoadState("networkidle");

    await page.getByText("Premium Dark").first().click();
    await expect(page.getByText("최상위권을 위한 영어 교육").first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/landing-sample-premium-dark.png" });
  });

  test("Academic Trust 샘플 미리보기", async ({ page }) => {
    await page.goto(`${BASE}/promo/landing-samples`);
    await page.waitForLoadState("networkidle");

    await page.getByText("Academic Trust").first().click();
    await expect(page.getByText("데이터로 증명하는 교육").first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/landing-sample-academic-trust.png" });
  });

  test("Program Promo 샘플 미리보기", async ({ page }) => {
    await page.goto(`${BASE}/promo/landing-samples`);
    await page.waitForLoadState("networkidle");

    await page.getByText("Program Promo").first().click();
    await expect(page.getByText("미래를 코딩하는 아이들").first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/landing-sample-program-promo.png" });
  });

  test("프로모 메인 페이지에 샘플 소개 섹션 노출", async ({ page }) => {
    await page.goto(`${BASE}/promo`);
    await page.waitForLoadState("networkidle");

    const samplesHeading = page.getByText("선생님 전용 랜딩 페이지").first();
    await samplesHeading.scrollIntoViewIfNeeded();
    await expect(samplesHeading).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("모든 샘플 미리보기").first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/promo-landing-samples-section.png" });
  });

  test("이전/다음 네비게이션 동작", async ({ page }) => {
    await page.goto(`${BASE}/promo/landing-samples`);
    await page.waitForLoadState("networkidle");

    // 첫 번째 템플릿(Minimal Tutor) 클릭
    await page.getByText("Minimal Tutor").first().click();
    await expect(page.getByText("체계적인 수학 교육의 시작").first()).toBeVisible({ timeout: 10000 });

    // "다음" 버튼 클릭
    const nextBtn = page.getByRole("button", { name: "다음 →" });
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Premium Dark로 이동 확인
    await expect(page.getByText("최상위권을 위한 영어 교육").first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/landing-sample-navigation.png" });
  });
});
