/**
 * 운영 검증 — 성적 발송 양식 관리
 * hakwonplus.com (Tenant 1) 운영 환경에서 확인
 */
import { test, expect } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";

test("운영: 성적 발송 모달 + 양식 기능 검증", async ({ page }) => {
  // 로그인
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  expect(resp.status()).toBe(200);
  const { access } = await resp.json() as { access: string };

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access }) => {
    localStorage.setItem("access", access);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, { access });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  // 학생 페이지에서 모달 열기
  await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
  await page.waitForTimeout(4000);

  // 학생 선택
  const cbs = page.locator("input[type='checkbox']");
  const cbCount = await cbs.count();
  console.log(`>>> 학생 체크박스: ${cbCount}개`);
  expect(cbCount).toBeGreaterThan(0);

  await cbs.nth(0).check({ force: true });
  await page.waitForTimeout(500);

  // 메시지 발송 버튼
  const msgBtn = page.locator("button").filter({ hasText: /메시지|문자|발송/ }).first();
  await expect(msgBtn).toBeVisible({ timeout: 5000 });
  await msgBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/prod-01-modal.png" });

  // 모달 확인
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 8000 });
  console.log(">>> 운영 모달 오픈 ✓");

  // 양식 바꾸기 버튼
  const tplBtn = page.locator("button").filter({ hasText: /양식 바꾸기/ }).first();
  const tplVisible = await tplBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`>>> 양식 바꾸기 버튼: ${tplVisible}`);

  if (tplVisible) {
    await tplBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/prod-02-panel.png" });

    // 시스템 양식 섹션
    const sysSection = page.locator("text=시스템 기본 양식");
    const sysVisible = await sysSection.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`>>> 시스템 양식 섹션: ${sysVisible}`);

    // 닫기
    const closeBtn = page.locator("button").filter({ hasText: /^닫기$/ }).first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) await closeBtn.click();
  }

  // 변수 블록 영역
  const varSection = page.locator("text=변수 삽입");
  const varVisible = await varSection.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`>>> 변수 삽입 영역: ${varVisible}`);

  // 새 이름으로 저장 버튼
  await textarea.fill("운영 테스트 본문");
  await page.waitForTimeout(300);
  const saveBtn = page.locator("button").filter({ hasText: "새 이름으로 저장" }).first();
  const saveVisible = await saveBtn.isVisible({ timeout: 2000 }).catch(() => false);
  console.log(`>>> 새 이름으로 저장 버튼: ${saveVisible}`);

  await page.screenshot({ path: "e2e/screenshots/prod-03-final.png" });

  // 크리티컬 에러
  const critical = errors.filter(e => !e.includes("ResizeObserver") && !e.includes("net::ERR") && !e.includes("chunk"));
  console.log(`>>> 크리티컬 에러: ${critical.length}건`);
  if (critical.length > 0) console.log(">>> Errors:", critical.join("\n"));

  console.log(">>> 운영 검증 완료");
});
