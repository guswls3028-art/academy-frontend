import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("메시지 안정성 검사", () => {
  
  test("hakwonplus — 솔라피 모드 설정 페이지 정상 로드", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    const body = await page.textContent("body") ?? "";
    expect(body).toContain("메시징 공급자");
    expect(body).toContain("API 연동 설정");
    expect(body).not.toContain("서버 오류");
    expect(body).not.toContain("크레딧");
    
    // 연동 테스트 실행
    await page.getByRole("button", { name: /연동.*테스트/ }).click();
    await page.waitForTimeout(4000);
    
    const afterTest = await page.textContent("body") ?? "";
    expect(afterTest).not.toContain("서버 오류가 발생했습니다");
    
    await page.screenshot({ path: "e2e/screenshots/stability-hakwonplus.png", fullPage: true });
    console.log("hakwonplus 솔라피 모드 ✓");
  });

  test("hakwonplus — 뿌리오 전환 + 테스트 + 솔라피 복원", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    page.on("dialog", async (d) => { await d.accept(); });
    
    // 뿌리오 전환
    await page.locator("button").filter({ hasText: "뿌리오" }).first().click();
    await page.waitForTimeout(2000);
    
    // 가이드 펼침
    const summary = page.locator("details summary");
    if (await summary.isVisible()) await summary.click();
    await page.waitForTimeout(500);
    
    // IP 표시 확인
    const body = await page.textContent("body") ?? "";
    expect(body).toContain("43.201.119.172");
    expect(body).toContain("연동개발(API)");
    expect(body).toContain("연동관리");
    
    // 연동 테스트
    await page.getByRole("button", { name: /연동.*테스트/ }).click();
    await page.waitForTimeout(4000);
    
    const afterTest = await page.textContent("body") ?? "";
    expect(afterTest).not.toContain("서버 오류가 발생했습니다");
    
    await page.screenshot({ path: "e2e/screenshots/stability-ppurio-switch.png", fullPage: true });
    
    // 솔라피 복원
    await page.locator("button").filter({ hasText: "솔라피" }).first().click();
    await page.waitForTimeout(1500);
    console.log("뿌리오 전환/복원 ✓");
  });
  
  test("hakwonplus — 메시지 발송 페이지 정상 로드 (발송 안 함)", async ({ page }) => {
    await loginViaUI(page, "admin");
    
    // 발송 내역 탭
    await page.goto("https://hakwonplus.com/admin/message/log");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const logBody = await page.textContent("body") ?? "";
    expect(logBody).not.toContain("서버 오류");
    console.log("발송 내역 페이지 ✓");
    
    // 템플릿 탭
    await page.goto("https://hakwonplus.com/admin/message/templates");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const tplBody = await page.textContent("body") ?? "";
    expect(tplBody).not.toContain("서버 오류");
    console.log("템플릿 페이지 ✓");
    
    // 자동발송 탭
    await page.goto("https://hakwonplus.com/admin/message/auto-send");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const autoBody = await page.textContent("body") ?? "";
    expect(autoBody).not.toContain("서버 오류");
    console.log("자동발송 페이지 ✓");
    
    await page.screenshot({ path: "e2e/screenshots/stability-msg-pages.png", fullPage: true });
  });
  
  test("hakwonplus — 대시보드 메시지 위젯 정상", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const body = await page.textContent("body") ?? "";
    expect(body).not.toContain("크레딧");
    expect(body).not.toContain("충전하기");
    expect(body).toContain("메시지");
    console.log("대시보드 ✓");
  });
});
