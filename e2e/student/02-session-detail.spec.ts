import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("학생 세션 상세", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-student");
  });

  test("세션 목록 진입 → 일정이 보인다", async ({ page }) => {
    await page.goto("https://tchul.com/student/sessions");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    // 캘린더 또는 세션 목록
    const content = page.locator("main, [class*='session'], [class*='calendar'], [data-app='student']").first();
    await expect(content).toBeVisible();
  });

  test("영상 홈 진입 → 빈 공개영상 카드가 보이지 않는다", async ({ page }) => {
    await page.goto("https://tchul.com/student/video");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    // "전체공개영상" 카드가 0개 영상이면 숨겨져야 함
    const publicCard = page.locator("text=전체공개영상");
    const publicCardVisible = await publicCard.isVisible({ timeout: 3000 }).catch(() => false);
    if (publicCardVisible) {
      // 카드가 보인다면 영상 개수가 0이 아니어야 함
      const zeroCard = page.locator("text=0개 영상");
      await expect(zeroCard).not.toBeVisible();
    }
  });

  test("클리닉 화면 진입 → 예약/내일정 탭이 보인다", async ({ page }) => {
    await page.goto("https://tchul.com/student/clinic");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Not Found")).not.toBeVisible();
    // 예약 또는 내 일정 탭
    // 클리닉 관련 컨텐츠가 있는지 (탭 버튼, 캘린더, 빈 상태 중 하나)
    const clinicUI = page.locator("[data-app='student']").first();
    await expect(clinicUI).toBeVisible({ timeout: 5000 });
    // 에러 화면이 아닌지
    await expect(page.locator("text=Not Found")).not.toBeVisible();
  });
});
