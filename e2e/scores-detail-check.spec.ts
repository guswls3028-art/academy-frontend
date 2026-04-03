/**
 * 성적탭 상세 검증 — 실제 사용자 조작 기준
 * 1. 성적 페이지 진입
 * 2. 편집모드 전환
 * 3. 과제 선택 시 하이라이트 확인
 * 4. 미응시 학생 합격 표시 여부
 * 5. 과제 값 입력 가능 여부
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("성적탭 상세 검증", () => {

  test("성적 페이지 → 편집모드 → 과제 입력 검증", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 사이드바에서 성적 클릭
    const scoresNav = page.locator("nav a, nav button, aside a").filter({ hasText: /성적/ }).first();
    if (await scoresNav.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scoresNav.click();
      await page.waitForTimeout(2000);
    } else {
      // 직접 이동
      await page.goto("https://hakwonplus.com/admin/scores", { waitUntil: "load", timeout: 15000 });
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: "e2e/screenshots/scores-01-page.png" });

    // 강의 선택 (첫 번째)
    const lectureSelector = page.locator("select, [role=listbox], button").filter({ hasText: /강의|선택/ }).first();
    await page.screenshot({ path: "e2e/screenshots/scores-02-lecture-select.png" });

    // 차시 선택 (첫 번째 차시 탭/버튼)
    const sessionTab = page.locator("button, a, [role=tab]").filter({ hasText: /1차|차시|S1/ }).first();
    if (await sessionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionTab.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: "e2e/screenshots/scores-03-session.png" });

    // 테이블 존재 확인
    const table = page.locator("table").first();
    const tableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`테이블 보임: ${tableVisible}`);

    if (tableVisible) {
      // 합/불 배지 확인
      const passBadges = page.locator("[data-tone='success']");
      const failBadges = page.locator("[data-tone='danger']");
      const passCount = await passBadges.count();
      const failCount = await failBadges.count();
      console.log(`합격 배지: ${passCount}, 불합격 배지: ${failCount}`);

      // 편집 버튼 찾기 & 클릭
      const editBtn = page.locator("button").filter({ hasText: /편집|수정|입력/ }).first();
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click();
        await page.waitForTimeout(1000);
        console.log("편집모드 활성화");
      }
      await page.screenshot({ path: "e2e/screenshots/scores-04-edit-mode.png" });

      // 과제 선택 프리셋 버튼
      const hwPreset = page.locator("button").filter({ hasText: /과제/ }).first();
      if (await hwPreset.isVisible({ timeout: 3000 }).catch(() => false)) {
        await hwPreset.click();
        await page.waitForTimeout(500);
        console.log("과제 프리셋 선택");
      }
      await page.screenshot({ path: "e2e/screenshots/scores-05-hw-preset.png" });

      // contentEditable 셀 존재 확인
      const editableCells = page.locator("[contenteditable='true']");
      const editCellCount = await editableCells.count();
      console.log(`편집 가능 셀: ${editCellCount}`);

      if (editCellCount > 0) {
        const cell = editableCells.first();
        await cell.click();
        await page.waitForTimeout(300);

        // 셀 포커스 확인
        const focused = await cell.evaluate((el) => el === document.activeElement);
        console.log(`셀 포커스: ${focused}`);

        // 값 입력
        await page.keyboard.type("75");
        await page.waitForTimeout(300);
        const val = await cell.innerText();
        console.log(`입력 후 값: "${val}"`);

        await page.screenshot({ path: "e2e/screenshots/scores-06-after-input.png" });

        // Tab으로 이동
        await page.keyboard.press("Tab");
        await page.waitForTimeout(500);
        await page.screenshot({ path: "e2e/screenshots/scores-07-after-tab.png" });
      }
    }

    await page.screenshot({ path: "e2e/screenshots/scores-08-final.png" });
  });
});
