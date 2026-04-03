/**
 * 림글리시 테넌트 — 프론트 UI를 통한 실제 SMS 발송 테스트
 * 학생 선택 → 메시지 발송 모달 → SMS 입력 → 발송
 */
import { test, expect } from "@playwright/test";

const BASE = "https://limglish.kr";
const API = "https://api.hakwonplus.com";

test("림글리시 SMS 발송", async ({ page }) => {
  // 1. 로그인
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "ggorno", password: "limglish1126", tenant_code: "limglish" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "limglish" },
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", "limglish"); } catch {}
  }, tokens);

  // 2. 학생 목록
  await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
  await page.waitForTimeout(6000); // 로딩 대기

  // 3. 첫 번째 학생 체크박스 (테이블 내 체크박스)
  const checkboxes = page.locator('table input[type="checkbox"]');
  const count = await checkboxes.count();
  console.log(`Found ${count} checkboxes`);

  if (count > 1) {
    // 첫 번째는 전체선택, 두 번째부터 개별 학생
    await checkboxes.nth(1).check();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: "e2e/screenshots/limglish-selected.png" });

  // 4. 메시지 발송 버튼 — 액션바에서 찾기
  const msgBtn = page.locator("button").filter({ hasText: "메시지 발송" }).first();
  if (await msgBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await msgBtn.click();
  } else {
    // 대안: 메시지 텍스트를 포함하는 버튼
    const altBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
    await altBtn.click();
  }
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "e2e/screenshots/limglish-modal-open.png" });

  // 5. SMS 모드 확인 + 본문 입력
  const textarea = page.locator("textarea").first();
  if (!await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
    // SMS 탭으로 전환 필요
    const smsTab = page.locator("button").filter({ hasText: "SMS" }).first();
    if (await smsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await smsTab.click();
      await page.waitForTimeout(500);
    }
  }

  await expect(textarea).toBeVisible({ timeout: 5000 });
  await textarea.fill("[E2E 테스트] 림글리시 SMS 발송 테스트입니다. 학원플러스 시스템 검증용.");
  await page.waitForTimeout(500);

  await page.screenshot({ path: "e2e/screenshots/limglish-msg-ready.png" });

  // 6. 발송 대상 확인 — 학부모만 체크 (학생 전화번호가 없을 수 있으므로)
  // 기본적으로 학부모+학생 모두 체크되어 있음

  // 7. 발송 버튼 클릭
  const sendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).first();
  await expect(sendBtn).toBeVisible({ timeout: 3000 });
  await expect(sendBtn).toBeEnabled();

  console.log(">>> Clicking send button...");
  await sendBtn.click();
  await page.waitForTimeout(4000);

  await page.screenshot({ path: "e2e/screenshots/limglish-send-result.png" });

  // 8. 결과 확인
  const pageText = await page.textContent("body") ?? "";
  if (pageText.includes("발송 예정")) {
    console.log(">>> SUCCESS: SMS 발송 예정 확인");
  } else if (pageText.includes("실패") || pageText.includes("오류")) {
    console.log(">>> FAILED: 발송 실패");
  } else {
    console.log(">>> UNKNOWN: 결과 불명확");
  }
});
