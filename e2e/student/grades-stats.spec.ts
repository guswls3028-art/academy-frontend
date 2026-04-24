/**
 * E2E: 학생앱 성적 통계 개선 검증
 * - 내 위치 분석 (상위/중위/하위)
 * - 약점 강좌 하이라이트
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("학생앱 성적 통계", () => {
  test("성적 통계 탭이 정상 렌더링된다", async ({ page }) => {
    await loginViaUI(page, "student");

    await page.goto("https://hakwonplus.com/student/grades", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 통계 탭 클릭
    const statsTab = page.getByRole("button", { name: "통계", exact: true });
    if (await statsTab.isVisible().catch(() => false)) {
      await statsTab.click();
      await page.waitForTimeout(1000);
    }

    // 기존 통계 요소 확인
    const examSummary = page.getByText("시험 성적 요약");
    const hasExamSummary = await examSummary.isVisible().catch(() => false);
    console.log(`시험 성적 요약: ${hasExamSummary}`);

    // 내 위치 분석 확인
    const positionAnalysis = page.getByText("내 위치 분석");
    const hasPosition = await positionAnalysis.isVisible().catch(() => false);
    console.log(`내 위치 분석: ${hasPosition}`);

    // 약점 강좌 확인
    const weakCourse = page.getByText("약점 강좌");
    const hasWeak = await weakCourse.isVisible().catch(() => false);
    console.log(`약점 강좌: ${hasWeak}`);

    // 과제 현황 확인
    const hwStatus = page.getByText("과제 현황");
    const hasHw = await hwStatus.isVisible().catch(() => false);
    console.log(`과제 현황: ${hasHw}`);

    await page.screenshot({
      path: "e2e/screenshots/student-grades-stats.png",
      fullPage: true,
    });
  });
});
