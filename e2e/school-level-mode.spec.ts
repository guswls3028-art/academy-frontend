/**
 * School Level Mode E2E — 기존 테넌트(middle_high) 동작 검증
 * 학생 생성 모달에서 학교급/학년 버튼이 중등/고등, 1~3학년으로 표시되는지 확인.
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("School Level Mode - middle_high (기존 테넌트)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("학생 등록 모달에서 중등/고등 버튼 + 1~3학년 표시", async ({ page }) => {
    // 사이드바에서 학생 메뉴 클릭
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(1500);

    // 학생 추가 버튼 클릭
    const registerBtn = page.locator("button").filter({ hasText: /학생 추가/ }).first();
    await registerBtn.waitFor({ state: "visible", timeout: 10000 });
    await registerBtn.click();
    await page.waitForTimeout(1000);

    // 1명 등록 선택 (모달 내부)
    const singleBtn = page.locator("button").filter({ hasText: /1명만 등록/ }).first();
    if (await singleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await singleBtn.click();
      await page.waitForTimeout(500);
    }

    // 스크린샷
    await page.screenshot({ path: "e2e/screenshots/school-level-create-modal.png" });

    // 학교급 버튼 확인: 고등, 중등 존재
    const choiceBtns = page.locator(".ds-choice-btn");
    const allBtnTexts = await choiceBtns.allTextContents();
    console.log("Choice buttons:", allBtnTexts);

    expect(allBtnTexts.some(t => t.includes("고등"))).toBeTruthy();
    expect(allBtnTexts.some(t => t.includes("중등"))).toBeTruthy();
    // 초등 버튼은 없어야 함 (middle_high 모드)
    expect(allBtnTexts.some(t => t === "초등")).toBeFalsy();

    // 학년 버튼: 1, 2, 3학년만 존재
    expect(allBtnTexts.some(t => t === "1학년")).toBeTruthy();
    expect(allBtnTexts.some(t => t === "2학년")).toBeTruthy();
    expect(allBtnTexts.some(t => t === "3학년")).toBeTruthy();
    expect(allBtnTexts.some(t => t === "4학년")).toBeFalsy();
  });

  test("학생 목록에서 학교급 필터 확인", async ({ page }) => {
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(1500);

    // 스크린샷
    await page.screenshot({ path: "e2e/screenshots/school-level-student-list.png" });

    // 필터 영역에 학교급 select 있는지 확인
    const schoolTypeSelect = page.locator("select").filter({ has: page.locator('option[value="HIGH"]') }).first();
    if (await schoolTypeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = await schoolTypeSelect.locator("option").allTextContents();
      console.log("Filter options:", options);
      expect(options.some(o => o.includes("고등"))).toBeTruthy();
      expect(options.some(o => o.includes("중등"))).toBeTruthy();
      expect(options.some(o => o.includes("초등"))).toBeFalsy();
    }
  });
});
