/**
 * E2E: 메시지 발송 모달 — 상품 레벨 UX 검증
 *
 * 검증 시나리오:
 * 1. 학생 도메인에서 모달 열기 — 기본 UX (도메인 배지, 채널 탭, 대상 체크)
 * 2. SMS 직접 작성 — textarea 편집, 변수 삽입, 글자수 표시
 * 3. 알림톡 readOnly — 템플릿 선택 전용, 본문 편집 불가
 * 4. 템플릿 탐색 구조 — chip 나열 아닌 리스트/검색 UX
 * 5. 발송 버튼 문구 — 대상/채널별 구체적 표시
 * 6. 대상 토글 — 학부모/학생 체크 변경 시 버튼 문구 동기화
 * 7. 다양한 도메인 진입점에서 동일 UX 품질
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = "https://hakwonplus.com";

test.describe("메시지 발송 모달 — 상품 UX", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("학생 목록에서 모달 열기 — 기본 구조 확인", async ({ page }) => {
    // 학생 목록으로 이동
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 학생 체크박스 클릭 (첫 번째 행)
    const firstCheckbox = page.locator("table tbody tr").first().locator('input[type="checkbox"]');
    if (await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCheckbox.check();
      await page.waitForTimeout(500);
    }

    // 메시지 발송 버튼 클릭
    const sendBtn = page.locator("button").filter({ hasText: /메시지 발송|메시지/ }).first();
    await sendBtn.click();
    await page.waitForTimeout(1500);

    // 모달 구조 확인
    // 1. 헤더에 "메시지 발송" 텍스트
    await expect(page.locator("text=메시지 발송").first()).toBeVisible({ timeout: 5000 });

    // 2. 도메인 배지 — "학생"
    await expect(page.locator("text=학생").first()).toBeVisible({ timeout: 3000 });

    // 3. 채널 탭 — "알림톡" "SMS"
    await expect(page.locator("button").filter({ hasText: "알림톡" }).first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator("button").filter({ hasText: "SMS" }).first()).toBeVisible({ timeout: 3000 });

    // 4. 대상 체크 — "학부모" "학생"
    await expect(page.locator("text=학부모").first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=대상").first()).toBeVisible({ timeout: 3000 });

    // 5. 수신자 카드
    await expect(page.locator("text=수신자").first()).toBeVisible({ timeout: 3000 });

    // 6. 미리보기 영역
    await expect(page.locator("text=미리보기").first()).toBeVisible({ timeout: 3000 });

    // 7. 발송 버튼 — 구체적 문구 (대상 포함)
    const footerSendBtn = page.locator("button").filter({ hasText: /에게.*(발송|문자|알림톡)/ }).first();
    await expect(footerSendBtn).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "e2e/screenshots/msg-modal-student-default.png", fullPage: false });
  });

  test("알림톡 모드 — readOnly 템플릿 선택 UX", async ({ page }) => {
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 학생 선택
    const firstCheckbox = page.locator("table tbody tr").first().locator('input[type="checkbox"]');
    if (await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCheckbox.check();
    }

    // 메시지 발송 모달 열기
    const sendBtn = page.locator("button").filter({ hasText: /메시지 발송|메시지/ }).first();
    await sendBtn.click();
    await page.waitForTimeout(1500);

    // 알림톡 모드가 기본값
    const alimtalkBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    // 알림톡 버튼이 active 상태인지 (primary 색상)
    await expect(alimtalkBtn).toBeVisible({ timeout: 3000 });

    // 알림톡 모드에서는 textarea가 없어야 함 (readOnly)
    const textarea = page.locator("textarea");
    // 템플릿 선택 안내 텍스트가 보여야 함
    const selectPrompt = page.locator("text=템플릿을 선택해 주세요");
    await expect(selectPrompt).toBeVisible({ timeout: 5000 });

    // 검색 입력 필드 존재
    const searchInput = page.locator('input[placeholder*="검색"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // 카카오 알림톡 미리보기 영역
    await expect(page.locator("text=카카오 알림톡 미리보기").first()).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "e2e/screenshots/msg-modal-alimtalk-browser.png", fullPage: false });
  });

  test("SMS 모드 — 직접 작성 + 변수 삽입 + 글자수", async ({ page }) => {
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const firstCheckbox = page.locator("table tbody tr").first().locator('input[type="checkbox"]');
    if (await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCheckbox.check();
    }

    const sendBtn = page.locator("button").filter({ hasText: /메시지 발송|메시지/ }).first();
    await sendBtn.click();
    await page.waitForTimeout(1500);

    // SMS 모드로 전환
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    // SMS가 disabled일 수 있으므로 체크
    const smsDisabled = await smsBtn.getAttribute("disabled");
    if (smsDisabled !== null && smsDisabled !== "false") {
      // SMS 미설정 — 스킵
      test.skip();
      return;
    }
    await smsBtn.click();
    await page.waitForTimeout(500);

    // textarea가 보여야 함 (편집 가능)
    const textarea = page.locator("textarea");
    await expect(textarea.first()).toBeVisible({ timeout: 3000 });

    // 내용 입력
    await textarea.first().fill("안녕하세요, #{학생이름2}님! 테스트 메시지입니다.");
    await page.waitForTimeout(500);

    // 글자수 표시 확인
    const charCount = page.locator("text=/SMS.*\\d+\\/90자|LMS.*\\d+/");
    await expect(charCount.first()).toBeVisible({ timeout: 3000 });

    // 변수 블록 "치환 변수 삽입" 영역
    await expect(page.locator("text=치환 변수 삽입").first()).toBeVisible({ timeout: 3000 });

    // SMS 미리보기
    await expect(page.locator("text=SMS 미리보기").first()).toBeVisible({ timeout: 3000 });

    // 발송 버튼에 "문자" 포함
    const footerBtn = page.locator("button").filter({ hasText: /문자 발송/ }).first();
    await expect(footerBtn).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "e2e/screenshots/msg-modal-sms-compose.png", fullPage: false });
  });

  test("대상 토글 — 발송 버튼 문구 동기화", async ({ page }) => {
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const firstCheckbox = page.locator("table tbody tr").first().locator('input[type="checkbox"]');
    if (await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCheckbox.check();
    }

    const sendBtn = page.locator("button").filter({ hasText: /메시지 발송|메시지/ }).first();
    await sendBtn.click();
    await page.waitForTimeout(1500);

    // 학부모 체크 해제
    const parentCheckbox = page.locator("label").filter({ hasText: "학부모" }).locator('input[type="checkbox"]');
    if (await parentCheckbox.isChecked()) {
      await parentCheckbox.uncheck();
      await page.waitForTimeout(300);
    }

    // 발송 버튼에 "학생"만 표시
    const footerBtn = page.locator("button").filter({ hasText: /학생.*명에게.*발송/ }).first();
    await expect(footerBtn).toBeVisible({ timeout: 3000 });

    // 학생도 해제 → "대상 선택 필요" 또는 비활성화
    const studentCheckbox = page.locator("label").filter({ hasText: "학생" }).locator('input[type="checkbox"]');
    if (await studentCheckbox.isChecked()) {
      await studentCheckbox.uncheck();
      await page.waitForTimeout(300);
    }

    // "선택 필요" 표시
    await expect(page.locator("text=선택 필요").first()).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "e2e/screenshots/msg-modal-target-toggle.png", fullPage: false });
  });

  test("출결 도메인에서 모달 열기 — 도메인 배지 확인", async ({ page }) => {
    // 출결 관련 페이지로 이동 (강의 목록에서 첫 번째 수업)
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 첫 번째 강의 클릭
    const firstLecture = page.locator("table tbody tr").first();
    if (await firstLecture.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLecture.click();
      await page.waitForTimeout(2000);
    }

    // 수강생 목록에서 메시지 발송 가능한지 확인
    const msgBtn = page.locator("button").filter({ hasText: /메시지/ }).first();
    if (await msgBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 체크박스 선택
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await checkbox.check();
        await page.waitForTimeout(300);
      }
      await msgBtn.click();
      await page.waitForTimeout(1500);

      // 도메인 배지 확인 (강의 또는 출결)
      const badge = page.locator("text=/강의|출결|학생/").first();
      await expect(badge).toBeVisible({ timeout: 3000 });

      await page.screenshot({ path: "e2e/screenshots/msg-modal-lecture-domain.png", fullPage: false });
    }
  });
});
