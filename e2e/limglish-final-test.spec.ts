import { test } from "@playwright/test";

const BASE = "https://limglish.kr";
const API = "https://api.hakwonplus.com";

test("림글리시 전체 메시지 기능 실전 확인", async ({ page }) => {
  // 로그인 (원래 비밀번호)
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "ggorno", password: "dlarmsgur12", tenant_code: "limglish" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "limglish" },
  });
  if (resp.status() !== 200) { console.log(">>> LOGIN FAIL:", resp.status()); return; }
  const tokens = await resp.json() as { access: string; refresh: string };
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    sessionStorage.setItem("tenantCode", "limglish");
  }, tokens);

  // === 1. 학생 목록 → SMS 발송 ===
  await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
  await page.waitForTimeout(6000);

  const cbs = page.locator('table input[type="checkbox"]');
  const cbCount = await cbs.count();
  console.log(`>>> 1. 학생 ${cbCount - 1}명`);
  if (cbCount > 1) await cbs.nth(1).check();
  await page.waitForTimeout(300);

  await page.locator("button").filter({ hasText: /메시지 발송/ }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e/screenshots/lim-1-sms-modal.png" });

  const ta = page.locator("textarea").first();
  console.log(">>> 1. SMS textarea:", await ta.isVisible().catch(() => false));

  // 알림톡 전환 확인
  await page.locator("button").filter({ hasText: "알림톡" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "e2e/screenshots/lim-2-alimtalk.png" });
  const select = page.locator("select");
  console.log(">>> 1. 알림톡 select:", await select.isVisible().catch(() => false));

  // 모달 닫기
  await page.locator("button").filter({ hasText: "취소" }).click();
  await page.waitForTimeout(500);

  // === 2. 메시지 도메인 레이아웃 확인 ===
  await page.goto(`${BASE}/admin/message/templates`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/lim-3-msg-templates.png" });

  // 탭 확인
  const tabs = page.locator("a, button").filter({ hasText: /템플릿|자동발송|발송 내역|설정/ });
  const tabTexts = await tabs.allTextContents();
  console.log(">>> 2. 메시지 탭:", tabTexts.filter(t => t.trim()).join(" | "));

  // 설정 페이지
  await page.goto(`${BASE}/admin/message/settings`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/lim-4-settings.png" });

  // KPI 카드 확인
  const kpiTexts = ["공급자", "발신번호", "알림톡", "SMS"];
  for (const kpi of kpiTexts) {
    const vis = await page.getByText(kpi).first().isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`>>> 2. KPI "${kpi}":`, vis);
  }

  // === 3. 자동발송 페이지 ===
  await page.goto(`${BASE}/admin/message/auto-send`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/lim-5-autosend.png" });

  // === 4. 발송 내역 ===
  await page.goto(`${BASE}/admin/message/log`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/lim-6-log.png" });

  console.log(">>> 림글리시 전체 메시지 기능 확인 완료");
});
