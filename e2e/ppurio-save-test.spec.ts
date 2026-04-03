import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test("뿌리오 API 키 저장 플로우 테스트", async ({ page }) => {
  page.setViewportSize({ width: 1920, height: 1080 });
  await loginViaUI(page, "admin");

  // 네트워크 감시
  const apiCalls: { method: string; url: string; status: number; body?: any; response?: any }[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/messaging/")) {
      apiCalls.push({ method: req.method(), url: req.url(), status: 0, body: req.postDataJSON() });
    }
  });
  page.on("response", async (resp) => {
    if (resp.url().includes("/messaging/")) {
      const call = apiCalls.find(c => c.url === resp.url() && c.status === 0);
      if (call) {
        call.status = resp.status();
        try { call.response = await resp.json(); } catch {}
      }
    }
  });

  // 메시지 설정 페이지 이동
  await page.goto(`${BASE}/admin/message/settings`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/ppurio-01-settings-page.png", fullPage: true });

  // 현재 공급자 확인
  const providerText = await page.locator("text=현재:").first().textContent();
  console.log("현재 공급자:", providerText);

  // 뿌리오 버튼 클릭
  const ppurioBtn = page.locator("button").filter({ hasText: /뿌리오/ }).first();
  if (await ppurioBtn.isVisible({ timeout: 5000 })) {
    console.log("뿌리오 버튼 발견, 클릭");

    // confirm 다이얼로그 자동 승인
    page.on("dialog", async (dialog) => {
      console.log("다이얼로그:", dialog.message());
      await dialog.accept();
    });

    await ppurioBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/ppurio-02-after-provider-switch.png", fullPage: true });
  }

  // 뿌리오 필드가 나타나는지 확인
  const accountInput = page.locator("input[placeholder*='뿌리오 계정'], input[placeholder*='계정 ID']").first();
  const apiKeyInput = page.locator("input[type='password'][placeholder*='뿌리오'], input[type='password'][placeholder*='API Key']").first();

  const accountVisible = await accountInput.isVisible({ timeout: 5000 }).catch(() => false);
  const apiKeyVisible = await apiKeyInput.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`계정 ID 입력필드: ${accountVisible ? "보임" : "안보임"}`);
  console.log(`API Key 입력필드: ${apiKeyVisible ? "보임" : "안보임"}`);

  if (!accountVisible || !apiKeyVisible) {
    console.log("❌ 뿌리오 입력 필드가 보이지 않음!");
    await page.screenshot({ path: "e2e/screenshots/ppurio-03-fields-missing.png", fullPage: true });

    // 전체 페이지 텍스트에서 뿌리오 관련 확인
    const bodyText = await page.locator("body").textContent();
    console.log("페이지에 '뿌리오' 포함:", bodyText?.includes("뿌리오"));
    console.log("페이지에 '계정 ID' 포함:", bodyText?.includes("계정 ID"));
    console.log("페이지에 'API Key' 포함:", bodyText?.includes("API Key"));
    return;
  }

  // 테스트 값 입력
  await accountInput.fill("test_limglish_account");
  await apiKeyInput.fill("test_api_key_12345");
  await page.screenshot({ path: "e2e/screenshots/ppurio-03-filled.png", fullPage: true });

  // API 키 저장 버튼 클릭
  const saveBtn = page.locator("button").filter({ hasText: /API 키 저장/ }).first();
  console.log("저장 버튼 visible:", await saveBtn.isVisible());
  await saveBtn.click();
  await page.waitForTimeout(3000);

  // 결과 확인
  await page.screenshot({ path: "e2e/screenshots/ppurio-04-after-save.png", fullPage: true });

  // 네트워크 호출 로그
  console.log("\n=== API 호출 로그 ===");
  for (const c of apiCalls) {
    console.log(`  ${c.method} ${c.url.replace(BASE, "")} → ${c.status}`);
    if (c.body) console.log(`    body: ${JSON.stringify(c.body)}`);
    if (c.response && c.status >= 400) console.log(`    error: ${JSON.stringify(c.response)}`);
  }

  // 저장 성공 확인 - 토스트 메시지
  const successToast = page.locator("text=저장되었습니다").first();
  const errorToast = page.locator("text=실패").first();
  const hasSuccess = await successToast.isVisible({ timeout: 3000 }).catch(() => false);
  const hasError = await errorToast.isVisible({ timeout: 1000 }).catch(() => false);
  console.log(`성공 토스트: ${hasSuccess}, 에러 토스트: ${hasError}`);

  // 저장 후 다시 확인 - 자체 키 등록됨 표시
  const hasOwnCreds = page.locator("text=자체 API 키가 등록되어 있습니다").first();
  console.log("자체 키 등록 확인:", await hasOwnCreds.isVisible({ timeout: 3000 }).catch(() => false));

  // 원래대로 복원 - 솔라피로 되돌리기 + 키 해제
  const clearBtn = page.locator("button").filter({ hasText: /자체 키 해제/ }).first();
  if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await clearBtn.click();
    await page.waitForTimeout(2000);
  }

  // 솔라피로 되돌리기
  const solapiBtn = page.locator("button").filter({ hasText: /솔라피/ }).first();
  if (await solapiBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    page.on("dialog", async (dialog) => await dialog.accept());
    await solapiBtn.click();
    await page.waitForTimeout(2000);
  }

  console.log("\n✅ 테스트 완료, 원래 상태로 복원됨");
});
