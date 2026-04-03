import { test, expect } from "@playwright/test";

test("림글리시 테넌트 뿌리오 인증 등록", async ({ page }) => {
  // limglish.kr 로그인 페이지
  await page.goto("https://limglish.kr/login/limglish");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  
  // 로그인 버튼 클릭 → 로그인 모달/폼 표시
  const loginBtn = page.getByText("로그인").first();
  await loginBtn.click();
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: "e2e/screenshots/limglish-login-form.png", fullPage: true });
  
  // 로그인 폼에 입력
  const usernameInput = page.locator('input[type="text"], input[name="username"], input[placeholder*="아이디"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  if (await usernameInput.isVisible()) {
    await usernameInput.fill("admin");
    await passwordInput.fill("0000");
    
    // 로그인 제출
    const submitBtn = page.locator('button[type="submit"]').or(page.getByRole("button", { name: /로그인|login/i })).first();
    await submitBtn.click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: "e2e/screenshots/limglish-after-login.png", fullPage: true });
    console.log("URL after login:", page.url());
  }
  
  // 메시지 설정 페이지로 이동
  await page.goto("https://limglish.kr/admin/message/settings");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: "e2e/screenshots/limglish-msg-settings.png", fullPage: true });
  
  // 뿌리오로 전환
  page.on("dialog", async (d) => { await d.accept(); });
  const ppurioBtn = page.locator("button").filter({ hasText: "뿌리오" }).first();
  if (await ppurioBtn.isVisible()) {
    await ppurioBtn.click();
    await page.waitForTimeout(2000);
  }
  
  await page.screenshot({ path: "e2e/screenshots/limglish-ppurio-switch.png", fullPage: true });
  
  // 계정 ID 입력
  const accountInput = page.locator('input[placeholder*="계정 ID"]').or(page.locator('input[placeholder*="계정"]')).first();
  if (await accountInput.isVisible()) {
    await accountInput.fill("ggorno");
    console.log("계정 ID 입력: ggorno ✓");
  }
  
  // API Key 입력
  const apiKeyInput = page.locator('input[placeholder*="API Key"]').or(page.locator('input[type="password"]')).first();
  if (await apiKeyInput.isVisible()) {
    await apiKeyInput.fill("d003dd35103c0f7407991cd268ae10cb0d1cd9a9526ed090b234f85a0a92ec59");
    console.log("API Key 입력 ✓");
  }
  
  await page.screenshot({ path: "e2e/screenshots/limglish-ppurio-filled.png", fullPage: true });
  
  // API 키 저장
  const saveBtn = page.getByRole("button", { name: /API 키 저장/ });
  if (await saveBtn.isVisible()) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    console.log("API 키 저장 클릭 ✓");
  }
  
  await page.screenshot({ path: "e2e/screenshots/limglish-ppurio-saved.png", fullPage: true });
  
  // 연동 테스트
  const testBtn = page.getByRole("button", { name: /연동.*테스트|테스트/ }).first();
  if (await testBtn.isVisible()) {
    await testBtn.click();
    await page.waitForTimeout(5000);
    console.log("연동 테스트 실행 ✓");
  }
  
  await page.screenshot({ path: "e2e/screenshots/limglish-ppurio-test.png", fullPage: true });
  
  const body = await page.textContent("body") ?? "";
  console.log("인증 성공 포함:", body.includes("성공"));
  console.log("실패 포함:", body.includes("실패"));
  console.log("서버 오류:", body.includes("서버 오류"));
});
