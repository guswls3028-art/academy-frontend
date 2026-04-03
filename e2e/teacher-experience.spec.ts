import { test, expect } from "@playwright/test";

const BASE = "https://limglish.kr";
const API = "https://api.hakwonplus.com";

test("선생님 실사용 전체 점검", async ({ page }) => {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "ggorno", password: "dlarmsgur12", tenant_code: "limglish" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "limglish" },
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    sessionStorage.setItem("tenantCode", "limglish");
  }, tokens);

  // === A. SMS 발송 모달 ===
  await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
  await page.waitForTimeout(6000);
  console.log(">>> A. 학생:", await page.locator("table tbody tr").count(), "명");

  await page.locator('table input[type="checkbox"]').nth(1).check();
  await page.waitForTimeout(300);
  await page.locator("button").filter({ hasText: /메시지 발송/ }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e/screenshots/t-a1-modal.png" });

  // SMS textarea, 도메인 배지, 발송 버튼, 학부모/학생 체크
  console.log(">>> A. SMS:", await page.locator("textarea").first().isVisible());
  console.log(">>> A. 배지:", await page.getByText("학생").first().isVisible().catch(() => false));
  const footerBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).first();
  console.log(">>> A. 발송버튼:", await footerBtn.textContent().catch(() => "없음"));

  // 알림톡 전환 + 복귀
  await page.locator("button").filter({ hasText: "알림톡" }).click();
  await page.waitForTimeout(500);
  console.log(">>> A. 알림톡 select:", await page.locator("select").isVisible().catch(() => false));
  await page.screenshot({ path: "e2e/screenshots/t-a2-alimtalk.png" });

  await page.locator("button").filter({ hasText: "SMS" }).click();
  await page.waitForTimeout(300);
  console.log(">>> A. SMS복귀:", await page.locator("textarea").first().isVisible());

  await page.locator("button").filter({ hasText: "취소" }).click();
  await page.waitForTimeout(500);

  // === B. 설정 페이지 KPI ===
  await page.goto(`${BASE}/admin/message/settings`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/t-b-settings.png" });
  console.log(">>> B. 공급자:", await page.getByText("뿌리오").first().isVisible().catch(() => false));
  console.log(">>> B. 발신번호:", await page.getByText("01034201126").first().isVisible().catch(() => false));

  // === C. 템플릿 — 성적 카테고리 ===
  await page.goto(`${BASE}/admin/message/templates`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  // 좌측 트리에서 "성적" 클릭
  const gradesNav = page.locator("button, a, div").filter({ hasText: /^성적$/ }).first();
  if (await gradesNav.isVisible({ timeout: 3000 }).catch(() => false)) {
    await gradesNav.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: "e2e/screenshots/t-c-templates-grades.png" });
  console.log(">>> C. 성적 양식:", await page.getByText("성적 발송 양식").first().isVisible({ timeout: 3000 }).catch(() => false));

  // === D. 자동발송 ===
  await page.goto(`${BASE}/admin/message/auto-send`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/t-d-autosend.png" });

  // === E. 발송 내역 ===
  await page.goto(`${BASE}/admin/message/log`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e/screenshots/t-e-log.png" });
  console.log(">>> E. 발송내역 행:", await page.locator("table tbody tr").count());

  console.log(">>> 전체 점검 완료");
});
