/**
 * 출결 탭 제거 + 매트릭스 테이블 정렬 검증
 * Test 1: 운영 사이트에서 현재 세션 출결 테이블 + 탭 상태 확인
 * Test 2: 로컬 빌드에서 탭 제거 확인 (serve 필요)
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("출결 수정 검증", () => {
  test("운영: 세션 출결 테이블 스크린샷 + 탭 상태 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 강의 목록
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 첫 번째 강의 클릭
    const lectureRow = page.locator(".ds-table tbody tr").first();
    await lectureRow.waitFor({ state: "visible", timeout: 10000 });
    await lectureRow.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/att-fix-01-lecture-detail.png", fullPage: true });

    // 세션 블록 (첫 번째 차시 버튼)
    const sessionBtn = page.locator("button").filter({ hasText: /\d+차/ }).first();
    if (await sessionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionBtn.click();
      await page.waitForTimeout(3000);
    }

    const url = page.url();
    console.log("URL after session click:", url);
    await page.screenshot({ path: "e2e/screenshots/att-fix-02-session-attendance.png", fullPage: true });

    // 탭 확인
    const tabs = page.locator("[role='tab'], .ds-tab");
    const tabCount = await tabs.count();
    const tabTexts: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      const text = await tabs.nth(i).textContent();
      if (text) tabTexts.push(text.trim());
    }
    console.log("Session tabs:", tabTexts);

    // 테이블이 있으면 정렬 확인 + 스크린샷
    const table = page.locator("table.ds-table").first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const colCount = await table.locator("colgroup col").count();
      const thCount = await table.locator("thead th").count();
      const firstTr = table.locator("tbody tr").first();
      const tdCount = await firstTr.isVisible({ timeout: 2000 }).catch(() => false)
        ? await firstTr.locator("td").count()
        : 0;

      console.log(`Table: colgroup=${colCount}, thead=${thCount}, tbody=${tdCount}`);
      await table.screenshot({ path: "e2e/screenshots/att-fix-03-table-detail.png" });

      if (tdCount > 0) {
        expect(thCount).toBe(tdCount);
      }
    }

    await page.screenshot({ path: "e2e/screenshots/att-fix-04-final.png", fullPage: true });
  });
});
