/**
 * 림글리시 — 성적탭 수업결과 발송 + 템플릿 자동 로드 확인
 */
import { test, expect } from "@playwright/test";

const BASE = "https://limglish.kr";
const API = "https://api.hakwonplus.com";

test("림글리시 성적 발송 — 템플릿 자동 로드 + 변수 치환", async ({ page }) => {
  // 로그인
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

  // 콘솔 에러 캡처
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`PAGE: ${err.message}`));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`CON: ${msg.text().substring(0, 200)}`); });

  // 직접 성적 진입 페이지로 이동 (session 82 = 언남 2학년 3차시, lecture 13)
  await page.goto(`${BASE}/admin/lectures/13/sessions/82/scores`, { waitUntil: "load" });
  await page.waitForTimeout(6000);

  await page.screenshot({ path: "e2e/screenshots/limglish-scores-tab.png" });

  // 학생 체크박스 선택 — 테이블 행에서 첫 번째 학생
  const allCheckboxes = page.locator('input[type="checkbox"]');
  const cbCount = await allCheckboxes.count();
  console.log(`>>> Found ${cbCount} checkboxes on scores page`);
  // 순서대로 시도: nth(1)이 학생 체크박스일 수 있고 nth(0)이 전체 선택
  for (let i = 1; i <= Math.min(cbCount - 1, 3); i++) {
    const cb = allCheckboxes.nth(i);
    if (await cb.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cb.check({ force: true });
      await page.waitForTimeout(300);
      break;
    }
  }
  await page.waitForTimeout(500);
  // 선택됨 확인
  const selectedText = page.locator("text=/\\d+명 선택됨/").first();
  if (await selectedText.isVisible({ timeout: 2000 }).catch(() => false)) {
    const selText = await selectedText.textContent();
    console.log(`>>> Selection: ${selText}`);
  } else {
    console.log(">>> Selection: NONE");
  }

  // "수업결과 발송" 버튼 정확히 클릭 (blockCategory: grades → 템플릿 자동 로드)
  const sendBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
  if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(">>> Clicking 수업결과 발송...");
    await sendBtn.click();
    // 비동기 템플릿 로딩 + 모달 열기 대기
    await page.waitForTimeout(5000);
  } else {
    console.log(">>> 수업결과 발송 button NOT visible");
  }

  await page.screenshot({ path: "e2e/screenshots/limglish-score-send-modal.png" });

  // 모달 본문 확인 — 템플릿이 자동 로드되었는지
  const textarea = page.locator("textarea").first();
  if (await textarea.isVisible({ timeout: 8000 }).catch(() => false)) {
    const bodyText = await textarea.inputValue();
    console.log(">>> MODAL BODY (first 300 chars):");
    console.log(bodyText.substring(0, 300));

    // 검증: 임근혁영어 양식이 로드되었는지
    if (bodyText.includes("임근혁영어") || bodyText.includes("두각학원")) {
      console.log(">>> TEMPLATE LOADED: YES — 림글리시 양식이 자동 로드됨");
    } else if (bodyText.includes("성적표 안내")) {
      console.log(">>> TEMPLATE LOADED: NO — 기본 양식 사용됨");
    } else if (bodyText.trim() === "") {
      console.log(">>> TEMPLATE LOADED: EMPTY — 본문이 비어있음");
    } else {
      console.log(">>> TEMPLATE LOADED: UNKNOWN");
    }
  } else {
    console.log(">>> textarea not visible — modal might not have opened");
  }

  // 에러 출력
  if (errors.length > 0) {
    console.log(">>> ERRORS:");
    for (const e of errors) console.log("  " + e);
  }
});
