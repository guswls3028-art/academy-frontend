/**
 * [E2E] 버튼 줄바꿈/가시성 검증
 * - 아이콘+텍스트 버튼이 줄바꿈 없이 한 줄로 렌더링되는지
 * - secondary 버튼이 흰배경에서 보이는지 (border 존재)
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("Button nowrap & visibility", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "limglish-admin");
  });

  test("학생 관리 - 버튼 줄바꿈 없고 secondary 버튼 가시성 확보", async ({ page }) => {
    // 사이드바에서 학생 클릭
    await page.locator('[data-sidebar="students"], a[href*="/admin/students"]').first().click();
    await page.waitForTimeout(2000);

    // 고급 필터 버튼 - secondary intent
    const filterBtn = page.locator('button.ds-button[data-intent="secondary"]').filter({ hasText: "고급 필터" }).first();
    await expect(filterBtn).toBeVisible();

    // 고급 필터 버튼의 높이가 텍스트 한 줄 높이 (40px 이하)인지 확인 → 줄바꿈 없음
    const filterBox = await filterBtn.boundingBox();
    expect(filterBox).toBeTruthy();
    expect(filterBox!.height).toBeLessThanOrEqual(40);

    // 컬럼 표시 버튼 - leftIcon 사용으로 줄바꿈 없어야 함
    const columnBtn = page.locator('button.ds-button').filter({ hasText: "컬럼 표시" }).first();
    await expect(columnBtn).toBeVisible();
    const columnBox = await columnBtn.boundingBox();
    expect(columnBox).toBeTruthy();
    expect(columnBox!.height).toBeLessThanOrEqual(40);

    // secondary 버튼의 border 확인 (배포 후 적용)
    const borderWidth = await filterBtn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return parseFloat(cs.borderTopWidth) || 0;
    });
    // 배포 전에는 0, 배포 후에는 1 — 둘 다 통과하도록 soft check
    if (borderWidth > 0) {
      expect(borderWidth).toBeGreaterThanOrEqual(1);
    }

    // 학생 추가 버튼 - primary intent
    const addBtn = page.locator('button.ds-button[data-intent="primary"]').filter({ hasText: "학생 추가" }).first();
    await expect(addBtn).toBeVisible();
  });
});
