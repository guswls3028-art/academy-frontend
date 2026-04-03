import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("메시지 설정 최종 검증", () => {
  test("전체 UI 구조 + 뿌리오 가이드 + 연동 테스트", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    // 1. 페이지 로드 확인
    const body = await page.textContent("body") ?? "";
    expect(body).toContain("메시징 공급자");
    expect(body).toContain("API 연동 설정");
    expect(body).toContain("발신번호");
    expect(body).toContain("연동 테스트");
    console.log("페이지 구조 확인 ✓");
    
    // 2. 불필요한 요소 없음
    expect(body).not.toContain("크레딧");
    expect(body).not.toContain("충전하기");
    expect(body).not.toContain("대행 요청");
    expect(body).not.toContain("연동 방식");
    console.log("레거시 제거 확인 ✓");
    
    await page.screenshot({ path: "e2e/screenshots/msg-final-clean.png", fullPage: true });
    
    // 3. 뿌리오 전환
    page.on("dialog", async (d) => { await d.accept(); });
    await page.locator("button").filter({ hasText: "뿌리오" }).first().click();
    await page.waitForTimeout(2000);
    
    // 4. 가이드 펼치기
    const details = page.locator("details summary");
    if (await details.isVisible()) {
      await details.click();
      await page.waitForTimeout(500);
    }
    
    await page.screenshot({ path: "e2e/screenshots/msg-ppurio-guide.png", fullPage: true });
    
    // 5. IP 표시 확인
    const bodyAfter = await page.textContent("body") ?? "";
    expect(bodyAfter).toContain("43.201.119.172");
    console.log("서버 IP 표시 확인 ✓");
    
    // 6. 복사 버튼 확인
    const copyBtn = page.getByText("복사");
    expect(await copyBtn.count()).toBeGreaterThan(0);
    console.log("IP 복사 버튼 확인 ✓");
    
    // 7. 가이드 내용 확인
    expect(bodyAfter).toContain("연동개발(API)");
    expect(bodyAfter).toContain("연동관리");
    expect(bodyAfter).toContain("발신번호 등록");
    console.log("가이드 내용 확인 ✓");
    
    // 8. 연동 테스트
    const testBtn = page.getByRole("button", { name: /연동.*테스트/ });
    await testBtn.click();
    await page.waitForTimeout(4000);
    
    await page.screenshot({ path: "e2e/screenshots/msg-ppurio-test-final.png", fullPage: true });
    
    const testBody = await page.textContent("body") ?? "";
    expect(testBody).not.toContain("서버 오류");
    expect(testBody).toContain("뿌리오");
    console.log("연동 테스트 동작 ✓");
    
    // 솔라피 복원
    await page.locator("button").filter({ hasText: "솔라피" }).first().click();
    await page.waitForTimeout(1000);
    console.log("전체 PASS ✓");
  });
});
