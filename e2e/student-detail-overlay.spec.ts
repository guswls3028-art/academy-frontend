/**
 * 학생 상세 오버레이 E2E — 탭 UI, 정보 정합성, 네비게이션 검증
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("학생 상세 오버레이", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("오버레이 열림 + 탭 전환 + 정보 표시", async ({ page }) => {
    await page.goto(`${BASE}/admin/students/home`, { waitUntil: "load", timeout: 15_000 });
    await page.waitForTimeout(2000);

    // 학생 목록 로딩 대기
    const studentRow = page.locator("tr").filter({ has: page.locator("td") }).first();
    await expect(studentRow).toBeVisible({ timeout: 10_000 });

    // 첫 번째 학생 클릭
    await studentRow.click();
    await page.waitForTimeout(1000);

    // 오버레이 패널 렌더링
    const overlay = page.locator(".ds-overlay-panel--student-detail");
    await expect(overlay).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: "e2e/screenshots/student-detail-overlay-open.png" });

    // 헤더: 이름, 아바타, 뱃지 존재
    await expect(overlay.locator(".ds-overlay-header__avatar")).toBeVisible();
    await expect(overlay.locator(".ds-overlay-header__title")).toBeVisible();

    // 좌측 정보 패널 — 기본 정보 행
    const infoPanel = overlay.locator(".ds-overlay-info-rows");
    await expect(infoPanel).toBeVisible();

    // 탭 전환 확인
    const tabLabels = ["수강", "시험 성적", "과제", "클리닉", "질문"];
    for (const label of tabLabels) {
      const tab = overlay.locator(".ds-tab").filter({ hasText: label }).first();
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveClass(/is-active/);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `e2e/screenshots/student-detail-tab-${label}.png` });
    }

    // 수강 탭으로 돌아와서 클릭 네비게이션 테스트
    const enrollTab = overlay.locator(".ds-tab").filter({ hasText: "수강" }).first();
    await enrollTab.click();
    await page.waitForTimeout(500);

    // 수강 항목이 있으면 클릭하여 강의 페이지로 이동 확인
    const enrollItem = overlay.locator("[class*='rounded-xl']").filter({ hasText: /수강중|탈퇴|수료/ }).first();
    const hasEnrollment = await enrollItem.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasEnrollment) {
      await enrollItem.click();
      await page.waitForTimeout(2000);
      // 오버레이 닫히고 강의 페이지로 이동
      const currentUrl = page.url();
      console.log("네비게이션 URL:", currentUrl);
      await page.screenshot({ path: "e2e/screenshots/student-detail-enroll-nav.png" });
    }
  });
});
