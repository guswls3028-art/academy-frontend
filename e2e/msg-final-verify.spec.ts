import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("메시지 설정 최종 검증", () => {
  test("대시보드 — 크레딧 없음, 메시지 연동 상태 위젯 표시", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const body = await page.textContent("body") ?? "";
    console.log("크레딧 표시:", body.includes("크레딧"));
    console.log("충전하기 표시:", body.includes("충전하기"));
    console.log("메시지 위젯:", body.includes("연동 상태") || body.includes("연동됨") || body.includes("미연동"));
    
    expect(body).not.toContain("충전하기");
    expect(body).not.toContain("크레딧 잔액");
    
    await page.screenshot({ path: "e2e/screenshots/dashboard-no-credit.png", fullPage: true });
  });
  
  test("헤더 — 크레딧 잔액 표시 없음", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const creditEl = page.locator(".app-header__credit");
    expect(await creditEl.count()).toBe(0);
    console.log("헤더 크레딧 요소:", await creditEl.count() === 0 ? "제거됨 ✓" : "아직 있음 ✗");
  });
  
  test("메시지 설정 — 대행 모드 없음, 직접 연동 UI 표시", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const body = await page.textContent("body") ?? "";
    console.log("대행 요청 표시:", body.includes("대행 요청"));
    console.log("연동 방식 선택:", body.includes("연동 방식"));
    console.log("API 키 등록:", body.includes("API 키 등록"));
    console.log("공급자 선택:", body.includes("공급자"));
    console.log("발신번호:", body.includes("발신번호"));
    console.log("연동 테스트:", body.includes("연동 테스트") || body.includes("테스트"));
    
    expect(body).not.toContain("대행 요청");
    expect(body).not.toContain("연동 방식");
    expect(body).toContain("API 키");
    expect(body).toContain("공급자");
    
    await page.screenshot({ path: "e2e/screenshots/msg-settings-final.png", fullPage: true });
  });
  
  test("뿌리오 전환 + API 키 입력 필드 + 테스트 버튼 동작", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    // 뿌리오 전환
    page.on("dialog", async (d) => { await d.accept(); });
    const ppurioBtn = page.locator("button").filter({ hasText: "뿌리오" }).first();
    await ppurioBtn.click();
    await page.waitForTimeout(2000);
    
    // 필드 확인
    const accountInput = page.locator('input[placeholder*="계정"]');
    const apiKeyInput = page.locator('input[type="password"]').first();
    expect(await accountInput.count()).toBeGreaterThan(0);
    expect(await apiKeyInput.count()).toBeGreaterThan(0);
    console.log("계정 ID 필드: ✓");
    console.log("API Key 필드: ✓");
    
    // 연동 테스트 버튼 클릭
    const testBtn = page.getByRole("button", { name: /테스트/ });
    await testBtn.first().click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: "e2e/screenshots/msg-ppurio-test-result.png", fullPage: true });
    
    // 테스트 결과 표시 확인
    const body = await page.textContent("body") ?? "";
    console.log("테스트 결과 표시:", body.includes("뿌리오"));
    console.log("서버 오류 없음:", !body.includes("서버 오류"));
    expect(body).not.toContain("서버 오류");
    
    // 솔라피로 복원
    const solapiBtn = page.locator("button").filter({ hasText: "솔라피" }).first();
    await solapiBtn.click();
    await page.waitForTimeout(1000);
  });
});
