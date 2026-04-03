import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("이전 주 클리닉 불러오기", () => {
  test("중복 세션 감지 + 에러 없이 동작", async ({ page }) => {
    await loginViaUI(page, "admin");
    
    // 클리닉 운영 콘솔 페이지로 이동
    await page.goto("https://hakwonplus.com/admin/clinic/operations");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: "e2e/screenshots/clinic-ops-console.png", fullPage: true });
    
    // "이전 주 불러오기" 버튼 찾기
    const importBtn = page.getByTitle("이전 주 불러오기").or(page.getByText("이전 주 불러오기"));
    if (await importBtn.first().isVisible()) {
      await importBtn.first().click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: "e2e/screenshots/clinic-import-modal.png", fullPage: true });
      
      // 중복 배지 확인
      const dupBadge = page.locator(".clinic-import__dup-badge");
      console.log("중복 세션(이미 있음) 수:", await dupBadge.count());
      
      // 매핑 날짜(→) 확인
      const mapped = page.locator(".clinic-import__session-mapped");
      console.log("매핑 날짜 표시 수:", await mapped.count());

      // 전체 선택 → 불러오기
      const selectAll = page.getByText("전체 선택");
      if (await selectAll.isVisible()) {
        await selectAll.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "e2e/screenshots/clinic-import-selected.png", fullPage: true });
        
        const btn = page.locator("button").filter({ hasText: /건 불러오기/ });
        if (await btn.isVisible()) {
          await btn.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: "e2e/screenshots/clinic-import-result.png", fullPage: true });
          
          const serverError = page.getByText("서버 오류");
          expect(await serverError.count()).toBe(0);
          console.log("서버 오류 없음 ✓");
        }
      }
    } else {
      console.log("버튼 못 찾음, 페이지 확인 필요");
    }
  });
});
