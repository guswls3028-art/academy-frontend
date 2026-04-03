/**
 * 운영 브라우저 E2E — school_level_mode 배포 후 기존 테넌트 검증
 * hakwonplus(middle_high) 에서 학생 추가 모달 검증
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("운영 school_level_mode 검증", () => {
  test("hakwonplus: 학생 추가 모달 — 고등/중등 + 1~3학년", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 학생 메뉴 클릭
    await page.locator("text=학생").first().click();
    await page.waitForTimeout(1500);

    // 학생 추가 버튼
    await page.locator("button").filter({ hasText: /학생 추가/ }).first().click();
    await page.waitForTimeout(1000);

    // 1명만 등록 선택
    const singleBtn = page.locator("button").filter({ hasText: /1명만 등록/ }).first();
    if (await singleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await singleBtn.click();
      await page.waitForTimeout(500);
    }

    // 스크린샷
    await page.screenshot({ path: "e2e/screenshots/prod-school-level-create.png" });

    // 학교급+학년 버튼 텍스트
    const btns = await page.locator(".ds-choice-btn").allTextContents();
    console.log("Prod choice buttons:", btns);

    // middle_high: 고등, 중등, 1~3학년만
    expect(btns).toContain("고등");
    expect(btns).toContain("중등");
    expect(btns).not.toContain("초등");
    expect(btns).toContain("1학년");
    expect(btns).toContain("2학년");
    expect(btns).toContain("3학년");
    expect(btns).not.toContain("4학년");
  });
});
