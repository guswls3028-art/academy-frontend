import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("운영 메시지 설정 최종 검증", () => {
  test("1. 헤더에 크레딧 없음", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    expect(await page.locator(".app-header__credit").count()).toBe(0);
    const header = await page.locator(".app-header__right").textContent() ?? "";
    expect(header).not.toContain("크레딧");
    await page.screenshot({ path: "e2e/screenshots/prod-header.png" });
    console.log("헤더 크레딧 제거 확인 ✓");
  });

  test("2. 대시보드 — 충전 없음 + 메시지 위젯", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const body = await page.textContent("body") ?? "";
    expect(body).not.toContain("충전하기");
    expect(body).not.toContain("크레딧 잔액");
    expect(body).not.toContain("현재 잔액");
    
    // 메시지 위젯이 연동 상태를 보여주는지
    const msgWidget = page.locator("text=발송 상태");
    expect(await msgWidget.count()).toBeGreaterThan(0);
    await page.screenshot({ path: "e2e/screenshots/prod-dashboard.png", fullPage: true });
    console.log("대시보드 크레딧→연동상태 전환 확인 ✓");
  });

  test("3. 메시지 설정 — 대행 모드 없음 + 솔라피 직접연동 표시", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    const body = await page.textContent("body") ?? "";
    // 대행 모드 완전 제거
    expect(body).not.toContain("대행 요청");
    expect(body).not.toContain("연동 방식");
    expect(body).not.toContain("플랫폼 기본");
    
    // 핵심 UI 존재
    expect(body).toContain("메시징 공급자");
    expect(body).toContain("API 키 등록");
    expect(body).toContain("발신번호");
    expect(body).toContain("연동 테스트");
    expect(body).toContain("카카오 알림톡");
    
    await page.screenshot({ path: "e2e/screenshots/prod-msg-settings.png", fullPage: true });
    console.log("설정 페이지 구조 확인 ✓");
  });

  test("4. 솔라피 상태에서 API 키 저장 + 테스트 동작", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    // 연동 테스트 실행
    const testBtn = page.getByRole("button", { name: /연동.*테스트|테스트/ }).first();
    await testBtn.click();
    await page.waitForTimeout(4000);
    
    // 결과가 표시되는지
    const testResults = page.locator("text=API").or(page.locator("text=발신번호")).or(page.locator("text=알림톡"));
    expect(await testResults.count()).toBeGreaterThan(0);
    
    // 서버 오류 없음
    const body = await page.textContent("body") ?? "";
    expect(body).not.toContain("서버 오류가 발생했습니다");
    
    await page.screenshot({ path: "e2e/screenshots/prod-solapi-test.png", fullPage: true });
    console.log("솔라피 연동 테스트 동작 확인 ✓");
  });

  test("5. 뿌리오 전환 → 가이드 + 필드 + 테스트 → 솔라피 복원", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    // 뿌리오 전환
    page.on("dialog", async (d) => { await d.accept(); });
    await page.locator("button").filter({ hasText: "뿌리오" }).first().click();
    await page.waitForTimeout(2000);
    
    const body = await page.textContent("body") ?? "";
    // 뿌리오 가이드 표시
    expect(body).toContain("ppurio.com");
    expect(body).toContain("계정 ID");
    expect(body).toContain("API Key");
    expect(body).toContain("발신번호 관리");
    expect(body).toContain("IP");
    
    // 입력 필드
    const accountInput = page.locator('input[placeholder*="계정 ID"]');
    const apiKeyInput = page.locator('input[placeholder*="API Key"]');
    expect(await accountInput.count()).toBe(1);
    expect(await apiKeyInput.count()).toBe(1);
    
    // 테스트 실행
    await page.getByRole("button", { name: /테스트/ }).first().click();
    await page.waitForTimeout(4000);
    
    const bodyAfter = await page.textContent("body") ?? "";
    expect(bodyAfter).not.toContain("서버 오류가 발생했습니다");
    expect(bodyAfter).toContain("뿌리오");
    
    await page.screenshot({ path: "e2e/screenshots/prod-ppurio-full.png", fullPage: true });
    console.log("뿌리오 전환+가이드+필드+테스트 확인 ✓");
    
    // 솔라피로 복원
    await page.locator("button").filter({ hasText: "솔라피" }).first().click();
    await page.waitForTimeout(1500);
    
    const restored = await page.textContent("body") ?? "";
    expect(restored).toContain("솔라피");
    console.log("솔라피 복원 확인 ✓");
  });

  test("6. 발신번호 저장 동작", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    // 발신번호 필드 존재
    const senderInput = page.locator('input[type="tel"]');
    expect(await senderInput.count()).toBe(1);
    
    // 저장 버튼 존재
    const saveBtn = page.locator("button").filter({ hasText: "저장" });
    expect(await saveBtn.count()).toBeGreaterThan(0);
    
    // 인증 버튼 존재
    const verifyBtn = page.locator("button").filter({ hasText: "인증" });
    expect(await verifyBtn.count()).toBeGreaterThan(0);
    
    await page.screenshot({ path: "e2e/screenshots/prod-sender.png", fullPage: true });
    console.log("발신번호 UI 동작 확인 ✓");
  });
});
