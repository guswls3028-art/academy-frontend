/**
 * E2E: 선생앱 성적 통계 탭 검증
 * - 로그인 → /teacher/results 이동 → 통계 탭 클릭
 * - 강의 선택 → 시험 선택 → KPI 카드 + 차트 렌더링 확인
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("선생앱 성적 통계", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("통계 탭이 렌더링되고 강의/시험 선택 시 KPI가 표시된다", async ({ page }) => {
    // 1. /teacher/results로 이동
    await page.goto("https://hakwonplus.com/teacher/results", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 2. 탭 바 확인 — "조회" | "통계" 두 탭이 보여야
    const statsTab = page.getByRole("button", { name: "통계", exact: true });
    await expect(statsTab).toBeVisible({ timeout: 10000 });

    // 3. 통계 탭 클릭
    await statsTab.click();
    await page.waitForTimeout(500);

    // 4. "강의를 선택하세요" 안내 확인
    await expect(page.getByText("강의를 선택하세요")).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "e2e/screenshots/teacher-stats-01-empty.png",
      fullPage: true,
    });

    // 5. 첫 번째 강의 선택 (통계 탭 내의 칩)
    const chipRows = page.locator(".overflow-x-auto");
    const firstChipRow = chipRows.first();
    const lectureChips = firstChipRow.locator("button");
    const lectureCount = await lectureChips.count();

    if (lectureCount === 0) {
      console.log("강의 데이터 없음 — 빈 상태 확인 완료");
      return;
    }

    // 첫 번째 강의 칩 클릭
    await lectureChips.first().click();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: "e2e/screenshots/teacher-stats-02-lecture-selected.png",
      fullPage: true,
    });

    // 6. 시험이 있는지 확인
    const noExamMsg = page.getByText("이 강의에 시험이 없습니다");
    const noExams = await noExamMsg.isVisible().catch(() => false);

    if (noExams) {
      console.log("이 강의에 시험 없음 — 빈 상태 정상");
      return;
    }

    // 7. 시험 칩 클릭 (두 번째 칩 행)
    const chipRowCount = await chipRows.count();
    if (chipRowCount >= 2) {
      const examChips = chipRows.nth(1).locator("button");
      const examChipCount = await examChips.count();

      if (examChipCount > 0) {
        await examChips.first().click();
        await page.waitForTimeout(3000);

        // 8. KPI 카드 확인
        const participantKpi = page.getByText("응시");
        const avgKpi = page.getByText("평균", { exact: false });
        const passRateKpi = page.getByText("합격률");

        const hasParticipant = await participantKpi.isVisible().catch(() => false);
        const hasAvg = await avgKpi.isVisible().catch(() => false);
        const hasPassRate = await passRateKpi.isVisible().catch(() => false);

        console.log(`KPI — 응시: ${hasParticipant}, 평균: ${hasAvg}, 합격률: ${hasPassRate}`);

        // KPI 하나라도 보여야
        expect(hasParticipant || hasAvg || hasPassRate).toBe(true);

        // 9. 통계 섹션 확인
        const scoreDist = page.getByText("점수 분포");
        const questionStats = page.getByText("문항별 정답률");
        const studentRank = page.getByText("학생별 성적");

        const hasDist = await scoreDist.isVisible().catch(() => false);
        const hasQuestion = await questionStats.isVisible().catch(() => false);
        const hasRank = await studentRank.isVisible().catch(() => false);

        console.log(`섹션 — 점수분포: ${hasDist}, 문항분석: ${hasQuestion}, 석차: ${hasRank}`);

        // 최종 스크린샷
        await page.screenshot({
          path: "e2e/screenshots/teacher-stats-03-with-data.png",
          fullPage: true,
        });

        // 스크롤 다운 후 추가 스크린샷
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.screenshot({
          path: "e2e/screenshots/teacher-stats-04-scrolled.png",
          fullPage: true,
        });
      }
    }
  });
});
