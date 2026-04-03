/**
 * 디자인 리뷰용 스크린샷 수집
 * 각 상태별 스크린샷을 찍어 시각적 검토
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";
const API = "http://localhost:8000";

async function login(page: import("@playwright/test").Page) {
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  const { access } = await resp.json() as { access: string };
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access }) => {
    localStorage.setItem("access", access);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, { access });
}

test("디자인 리뷰 — 성적 발송 모달 전체 상태", async ({ page }) => {
  await login(page);
  // 뷰포트를 넉넉하게
  await page.setViewportSize({ width: 1400, height: 900 });

  // 성적 탭 진입
  await page.goto(`${BASE}/admin/lectures/92/sessions/90/scores`, { waitUntil: "load" });
  await page.waitForTimeout(4000);

  // 학생 선택
  const cbs = page.locator("input[type='checkbox']");
  for (let i = 1; i <= await cbs.count(); i++) {
    const cb = cbs.nth(i);
    if (await cb.isVisible({ timeout: 500 }).catch(() => false)) { await cb.check({ force: true }); break; }
  }
  await page.waitForTimeout(500);

  // 성적 발송
  const sendBtn = page.locator("button").filter({ hasText: /성적 발송|수업결과 발송/ }).first();
  await sendBtn.click();
  await page.waitForTimeout(4000);

  // 1. 기본 상태 (양식 로드됨)
  await page.screenshot({ path: "e2e/screenshots/review-01-default.png", fullPage: false });

  // 2. 양식 패널 열기
  const tplBtn = page.locator("button").filter({ hasText: /양식 바꾸기/ }).first();
  if (await tplBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tplBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/screenshots/review-02-panel.png", fullPage: false });

    // 닫기
    const closeBtn = page.locator("button").filter({ hasText: /^닫기$/ }).first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // 3. 변수 블록 영역 (하단)
  // 스크롤해서 변수 영역이 보이게
  const varLabel = page.locator("text=변수 삽입").first();
  if (await varLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await varLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "e2e/screenshots/review-03-variables.png", fullPage: false });
  }

  // 4. + 시험 추가 클릭
  const addExamBtn = page.locator("button").filter({ hasText: "+ 시험 추가" }).first();
  if (await addExamBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addExamBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/review-04-exam-added.png", fullPage: false });
  }

  // 5. 양식 선택 후 수정 → 수정됨 상태
  await tplBtn.click();
  await page.waitForTimeout(1000);
  // 내 양식 중 첫 번째 클릭
  const myCard = page.locator("text=내 양식").first();
  if (await myCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    // 내 양식 아래 첫 카드
    const firstCard = page.locator("text=내 양식").locator("..").locator("~ div button").first();
    // 직접 입력 아래의 첫 사용자 카드를 클릭
  }
  const closeBtn2 = page.locator("button").filter({ hasText: /^닫기$/ }).first();
  if (await closeBtn2.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn2.click();
  }

  // 6. 긴 본문으로 미리보기 스크롤 확인
  const textarea = page.locator("textarea").first();
  if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
    const longBody = Array.from({ length: 30 }, (_, i) => `줄 ${i + 1}: 테스트 내용입니다. 이것은 긴 본문의 ${i + 1}번째 줄입니다.`).join("\n");
    await textarea.fill(longBody);
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/review-05-long-content.png", fullPage: false });
  }

  // 7. 새 이름으로 저장 폼
  const saveBtn = page.locator("button").filter({ hasText: "새 이름으로 저장" }).first();
  if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/review-06-save-form.png", fullPage: false });
  }

  console.log(">>> 디자인 리뷰 스크린샷 수집 완료");
});
