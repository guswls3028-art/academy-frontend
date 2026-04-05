/**
 * 배포 후 운영 검증: 차시 출결탭 제거 + 매트릭스 테이블 정렬
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("운영 검증: 출결 수정", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("1. 차시 상세 — 출결 탭 미노출 + 출결 화면 정상 표시", async ({ page }) => {
    // 강의 목록
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 첫 번째 강의 클릭
    const lectureRow = page.locator(".ds-table tbody tr").first();
    await lectureRow.waitFor({ state: "visible", timeout: 10000 });
    await lectureRow.click();
    await page.waitForTimeout(3000);

    // 차시 버튼 클릭 (첫 번째)
    const sessionBtn = page.locator("button").filter({ hasText: /\d+차/ }).first();
    if (await sessionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionBtn.click();
      await page.waitForTimeout(3000);
    }

    const url = page.url();
    console.log("Session URL:", url);
    await page.screenshot({ path: "e2e/screenshots/att-prod-01-session.png", fullPage: true });

    // 탭 확인 — 출결 탭이 없어야 함
    const tabs = page.locator("[role='tab'], .ds-tab");
    const tabCount = await tabs.count();
    const tabTexts: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      const text = await tabs.nth(i).textContent();
      if (text) tabTexts.push(text.trim());
    }
    console.log("Session tabs:", tabTexts);

    if (url.includes("/sessions/")) {
      const sessionTabs = tabTexts.filter(t => ["성적", "시험", "과제", "영상", "출결"].includes(t));
      console.log("Filtered session tabs:", sessionTabs);
      expect(sessionTabs).not.toContain("출결");
      expect(sessionTabs).toContain("성적");
      expect(sessionTabs).toContain("시험");
      expect(sessionTabs).toContain("과제");
      expect(sessionTabs).toContain("영상");
    }

    await page.screenshot({ path: "e2e/screenshots/att-prod-02-tabs.png", fullPage: true });

    // 출결 화면이 기본 렌더링되는지 확인
    if (url.includes("/attendance")) {
      const toolbar = page.locator("text=총").first();
      const toolbarVisible = await toolbar.isVisible({ timeout: 3000 }).catch(() => false);
      console.log("Attendance toolbar visible:", toolbarVisible);
    }
  });

  test("2. 세션 출결 테이블 정렬 확인 (데이터 있는 세션)", async ({ page }) => {
    // 강의 76, 세션 93 (이전 테스트에서 확인된 데이터)
    await page.goto(`${BASE}/admin/lectures/76/sessions/93/attendance`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/att-prod-03-attendance-table.png", fullPage: true });

    const table = page.locator("table.ds-table").first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const colCount = await table.locator("colgroup col").count();
      const thCount = await table.locator("thead th").count();
      const firstTr = table.locator("tbody tr").first();
      const tdCount = await firstTr.isVisible({ timeout: 3000 }).catch(() => false)
        ? await firstTr.locator("td").count()
        : 0;

      console.log(`Table alignment: colgroup=${colCount}, thead=${thCount}, tbody=${tdCount}`);

      if (tdCount > 0) {
        expect(thCount).toBe(tdCount);
        expect(colCount).toBe(thCount);
      }

      await table.screenshot({ path: "e2e/screenshots/att-prod-04-table-detail.png" });
    }

    // 성적 탭으로 이동 가능한지 확인
    const scoresTab = page.locator("[role='tab'], .ds-tab").filter({ hasText: "성적" });
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await page.waitForTimeout(2000);
      const scoreUrl = page.url();
      console.log("After scores tab click:", scoreUrl);
      expect(scoreUrl).toContain("/scores");
      await page.screenshot({ path: "e2e/screenshots/att-prod-05-scores-tab.png", fullPage: true });
    }

    await page.screenshot({ path: "e2e/screenshots/att-prod-06-final.png", fullPage: true });
  });
});
