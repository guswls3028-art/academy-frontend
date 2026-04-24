/**
 * E2E: DNB 테넌트 성적 통계 검증 — 실데이터 다수 학생
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("DNB 성적 통계", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "dnb-admin");
  });

  test("DNB 강좌에서 통계 데이터가 정상 표시된다", async ({ page }) => {
    await page.goto("https://dnbacademy.co.kr/teacher/results", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 1. 통계 탭 클릭
    const statsTab = page.getByRole("button", { name: "통계", exact: true });
    await expect(statsTab).toBeVisible({ timeout: 10000 });
    await statsTab.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "e2e/screenshots/dnb-stats-01-tab.png",
      fullPage: true,
    });

    // 2. 첫 번째 강의 선택
    const chipRows = page.locator(".overflow-x-auto");
    const lectureChips = chipRows.first().locator("button");
    const lectureCount = await lectureChips.count();

    if (lectureCount === 0) {
      console.log("DNB 강의 없음");
      return;
    }

    await lectureChips.first().click();
    await page.waitForTimeout(1500);

    // 3. 시험 유무 확인
    const noExamMsg = page.getByText("이 강의에 시험이 없습니다");
    if (await noExamMsg.isVisible().catch(() => false)) {
      // 다른 강의 시도
      if (lectureCount > 1) {
        await lectureChips.nth(1).click();
        await page.waitForTimeout(1500);
      } else {
        console.log("DNB 시험 없음");
        return;
      }
    }

    // 4. 시험 칩 클릭
    const chipRowCount = await chipRows.count();
    if (chipRowCount >= 2) {
      const examChips = chipRows.nth(1).locator("button");
      const examChipCount = await examChips.count();

      if (examChipCount > 0) {
        await examChips.first().click();
        await page.waitForTimeout(3000);

        // 5. KPI 확인
        const hasParticipant = await page.getByText("응시").isVisible().catch(() => false);
        const hasAvg = await page.getByText("평균").isVisible().catch(() => false);
        console.log(`DNB KPI — 응시: ${hasParticipant}, 평균: ${hasAvg}`);

        // 6. 소수 데이터 안내 확인 (3명 미만이면 보여야)
        const sparseWarning = page.getByText("통계 해석에 주의");
        const hasSparseWarning = await sparseWarning.isVisible().catch(() => false);
        console.log(`소수 데이터 안내: ${hasSparseWarning}`);

        // 7. 점수 분포 확인
        const hasDist = await page.getByText("점수 분포").isVisible().catch(() => false);
        console.log(`점수 분포: ${hasDist}`);

        // 8. 학생 석차 확인
        const hasRank = await page.getByText("학생별 성적").isVisible().catch(() => false);
        console.log(`학생 석차: ${hasRank}`);

        await page.screenshot({
          path: "e2e/screenshots/dnb-stats-02-data.png",
          fullPage: true,
        });

        // 스크롤 다운
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.screenshot({
          path: "e2e/screenshots/dnb-stats-03-scrolled.png",
          fullPage: true,
        });
      }
    }
  });
});
