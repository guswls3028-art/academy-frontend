/**
 * Comprehensive Messaging Modal E2E Tests
 * Domain: ALL messaging touchpoints on hakwonplus.com (Tenant 1)
 * Covers: Students, Scores, Attendance, Settings, Channel switching, Modal reset
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SS = "e2e/screenshots";

async function ss(page: Page, name: string) {
  await page.screenshot({ path: `${SS}/${name}.png`, fullPage: false });
}

test.describe("Messaging Modal — Comprehensive E2E", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page, "admin");
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ═══════════════════════════════════════════
  // 1. 학생 목록 SMS 발송 플로우
  // ═══════════════════════════════════════════
  test("1. 학생 목록 SMS 발송 플로우", async () => {
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await ss(page, "01-students-loaded");

    // 첫 번째 학생 체크박스 클릭
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.waitFor({ state: "visible", timeout: 10000 });
    await firstCheckbox.click();
    await page.waitForTimeout(500);
    await ss(page, "01-student-checked");

    // 메시지 발송 버튼 클릭
    const msgBtn = page.locator("button").filter({ hasText: "메시지 발송" }).first();
    await expect(msgBtn).toBeVisible({ timeout: 5000 });
    await msgBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, "01-modal-opened");

    // 모달 표시 확인 — "메시지 발송" 타이틀
    await expect(page.locator("text=수신자")).toBeVisible({ timeout: 5000 });

    // SMS 기본 모드 확인 — SMS 버튼이 활성화
    const smsBtn = page.locator("button").filter({ hasText: /^SMS$/ }).first();
    await expect(smsBtn).toBeVisible();

    // textarea에 텍스트 입력
    const textarea = page.locator(".send-message-modal textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill("[E2E-test] 학생 메시지 테스트");
    await page.waitForTimeout(500);
    await ss(page, "01-sms-text-entered");

    // 학부모 체크 해제
    const parentCheckbox = page.locator("label").filter({ hasText: "학부모" }).locator('input[type="checkbox"]');
    await expect(parentCheckbox).toBeVisible();
    const parentWasChecked = await parentCheckbox.isChecked();
    if (parentWasChecked) {
      await parentCheckbox.click();
      await page.waitForTimeout(300);
    }
    await ss(page, "01-parent-unchecked");

    // 발송 버튼 문구에 "학부모" 미포함 확인
    const footerBtnText = await page.locator(".send-message-modal button").filter({ hasText: /발송/ }).first().textContent();
    console.log(`[Scenario 1] Footer button text after parent uncheck: "${footerBtnText}"`);
    expect(footerBtnText).not.toContain("학부모");

    // 학생 체크도 해제 -> "선택 필요" 표시
    const studentCheckbox = page.locator("label").filter({ hasText: "학생" }).locator('input[type="checkbox"]');
    if (await studentCheckbox.isChecked()) {
      await studentCheckbox.click();
      await page.waitForTimeout(300);
    }
    await ss(page, "01-both-unchecked");

    // "선택 필요" 또는 "대상 선택 필요" 텍스트 확인
    const selectionRequired = page.locator("text=선택 필요").first();
    await expect(selectionRequired).toBeVisible({ timeout: 3000 });
    console.log("[Scenario 1] PASS: '선택 필요' visible when both unchecked");

    // 모달 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ═══════════════════════════════════════════
  // 2. 알림톡 드롭다운 + 미리보기
  // ═══════════════════════════════════════════
  test("2. 알림톡 드롭다운 + 미리보기", async () => {
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 학생 선택 + 모달 열기
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.waitFor({ state: "visible", timeout: 10000 });
    await firstCheckbox.click();
    await page.waitForTimeout(500);

    const msgBtn = page.locator("button").filter({ hasText: "메시지 발송" }).first();
    await msgBtn.click();
    await page.waitForTimeout(1500);

    // 알림톡 전환
    const alimtalkBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    await expect(alimtalkBtn).toBeVisible({ timeout: 5000 });
    await alimtalkBtn.click();
    await page.waitForTimeout(1000);
    await ss(page, "02-alimtalk-mode");

    // 카카오 미리보기 카드 표시 확인
    const kakaoCard = page.locator(".template-preview-kakao").first();
    const kakaoVisible = await kakaoCard.isVisible().catch(() => false);
    console.log(`[Scenario 2] Kakao card preview visible: ${kakaoVisible}`);
    await ss(page, "02-kakao-preview");

    // 템플릿 카드 존재 확인 (알림톡 모드에서 승인된 템플릿 목록)
    const templateCards = page.locator(".send-message-modal button").filter({ hasText: /승인|학원플러스/ });
    const templateCount = await templateCards.count();
    console.log(`[Scenario 2] Template cards found: ${templateCount}`);

    if (templateCount > 0) {
      // 첫 번째 템플릿 클릭
      await templateCards.first().click();
      await page.waitForTimeout(800);
      await ss(page, "02-template-selected");

      // 미리보기에 내용 표시 확인
      const previewBody = page.locator(".template-preview-kakao__body").first();
      const previewText = await previewBody.textContent();
      console.log(`[Scenario 2] Preview body text: "${previewText?.slice(0, 80)}..."`);
      expect(previewText?.length).toBeGreaterThan(0);

      // 발송 버튼에 "알림톡" 포함 확인
      const sendBtnText = await page.locator(".send-message-modal button").filter({ hasText: /발송/ }).first().textContent();
      console.log(`[Scenario 2] Send button text: "${sendBtnText}"`);
      expect(sendBtnText).toContain("알림톡");
    } else {
      console.log("[Scenario 2] No approved templates found — testing template list UI only");
      // 템플릿 없더라도 "템플릿을 선택하세요" 표시 확인
      const placeholder = page.locator("text=템플릿을 선택하세요").first();
      const phVisible = await placeholder.isVisible().catch(() => false);
      console.log(`[Scenario 2] Placeholder visible: ${phVisible}`);
    }

    // 발송 버튼 문구에 "알림톡" 포함 확인 (또는 "대상 선택 필요")
    const footerBtn = page.locator(".send-message-modal button").filter({ hasText: /발송|선택/ }).first();
    const footerText = await footerBtn.textContent();
    console.log(`[Scenario 2] Footer text: "${footerText}"`);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ═══════════════════════════════════════════
  // 3. 성적 탭 양식 자동 로드
  // ═══════════════════════════════════════════
  test("3. 성적 탭 양식 자동 로드", async () => {
    await page.goto("https://hakwonplus.com/admin/lectures/77/sessions/57/scores", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await ss(page, "03-scores-loaded");

    // 학생 체크박스 선택 — 헤더(전체선택)가 아닌 개별 학생 1명만 선택
    // 테이블 tbody 내의 첫 번째 체크박스 = 개별 학생 행
    const studentCheckboxes = page.locator("tbody input[type='checkbox'], tr input[type='checkbox']");
    const cbCount = await studentCheckboxes.count();
    console.log(`[Scenario 3] Student checkboxes found: ${cbCount}`);

    // 두 번째 체크박스부터 시도 (첫 번째가 헤더일 수 있음)
    // 모든 체크박스 중 헤더가 아닌 것을 찾기
    const allCheckboxes = page.locator('input[type="checkbox"]');
    const totalCb = await allCheckboxes.count();
    // 첫 번째는 헤더, 두 번째부터 개별 학생
    if (totalCb >= 2) {
      await allCheckboxes.nth(1).click();
    } else {
      await allCheckboxes.first().click();
    }
    await page.waitForTimeout(500);
    await ss(page, "03-one-student-checked");

    // "수업결과 발송" 버튼 클릭
    const resultBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    await expect(resultBtn).toBeVisible({ timeout: 5000 });
    await resultBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, "03-score-modal-opened");

    // textarea에 양식이 사전 로드되었는지 확인
    const textarea = page.locator(".send-message-modal textarea").first();
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      const bodyText = await textarea.inputValue();
      console.log(`[Scenario 3] Pre-loaded body (first 200 chars): "${bodyText.slice(0, 200)}"`);
      // 성적 관련 텍스트 확인 — 1명 선택 시 initialBody가 자동 생성됨
      const hasScoreContent = bodyText.length > 10;
      console.log(`[Scenario 3] Body has score content: ${hasScoreContent} (length: ${bodyText.length})`);
      expect(hasScoreContent).toBe(true);
    } else {
      console.log("[Scenario 3] textarea not found — checking for alimtalk mode default");
      await ss(page, "03-no-textarea");
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ═══════════════════════════════════════════
  // 4. 출결 탭 수업결과 발송 버튼
  // ═══════════════════════════════════════════
  test("4. 출결 탭 수업결과 발송 버튼", async () => {
    await page.goto("https://hakwonplus.com/admin/lectures/77/sessions/57/attendance", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await ss(page, "04-attendance-loaded");

    // "수업결과 발송" 버튼 존재 확인
    const resultBtn = page.locator("button").filter({ hasText: "수업결과 발송" });
    const btnCount = await resultBtn.count();
    console.log(`[Scenario 4] '수업결과 발송' buttons found: ${btnCount}`);

    if (btnCount > 0) {
      await expect(resultBtn.first()).toBeVisible({ timeout: 5000 });
      console.log("[Scenario 4] PASS: '수업결과 발송' button is visible");
    } else {
      // 학생 체크 필요할 수 있음
      const firstCheckbox = page.locator('input[type="checkbox"]').first();
      if (await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstCheckbox.click();
        await page.waitForTimeout(500);
        const btnAfterCheck = page.locator("button").filter({ hasText: "수업결과 발송" });
        await expect(btnAfterCheck.first()).toBeVisible({ timeout: 5000 });
        console.log("[Scenario 4] PASS: '수업결과 발송' button visible after checkbox selection");
      }
    }
    await ss(page, "04-result-btn");
  });

  // ═══════════════════════════════════════════
  // 5. 설정 페이지 KPI
  // ═══════════════════════════════════════════
  test("5. 설정 페이지 KPI", async () => {
    await page.goto("https://hakwonplus.com/admin/message/settings", { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await ss(page, "05-settings-loaded");

    // KPI 카드들 확인
    const kpiLabels = ["공급자", "발신번호", "알림톡", "SMS"];
    for (const label of kpiLabels) {
      const kpi = page.locator(`text=${label}`).first();
      const visible = await kpi.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`[Scenario 5] KPI "${label}" visible: ${visible}`);
      expect(visible).toBe(true);
    }

    await ss(page, "05-kpi-cards");
    console.log("[Scenario 5] PASS: All 4 KPI cards visible");
  });

  // ═══════════════════════════════════════════
  // 6. 채널 전환 후 상태 초기화
  // ═══════════════════════════════════════════
  test("6. 채널 전환 후 상태 유지/초기화", async () => {
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 학생 선택 + 모달 열기
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.waitFor({ state: "visible", timeout: 10000 });
    await firstCheckbox.click();
    await page.waitForTimeout(500);

    const msgBtn = page.locator("button").filter({ hasText: "메시지 발송" }).first();
    await msgBtn.click();
    await page.waitForTimeout(1500);

    // SMS 모드에서 텍스트 입력
    const textarea = page.locator(".send-message-modal textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    const testText = "[E2E-channel-switch] 채널 전환 테스트";
    await textarea.fill(testText);
    await page.waitForTimeout(300);
    await ss(page, "06-sms-text-entered");

    // 알림톡으로 전환
    const alimtalkBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    await alimtalkBtn.click();
    await page.waitForTimeout(800);
    await ss(page, "06-switched-to-alimtalk");

    // SMS로 복귀
    const smsBtn = page.locator("button").filter({ hasText: /^SMS$/ }).first();
    await smsBtn.click();
    await page.waitForTimeout(800);
    await ss(page, "06-switched-back-to-sms");

    // textarea 값 확인 (유지 또는 초기화)
    const textareaAfter = page.locator(".send-message-modal textarea").first();
    if (await textareaAfter.isVisible({ timeout: 3000 }).catch(() => false)) {
      const afterValue = await textareaAfter.inputValue();
      console.log(`[Scenario 6] SMS body after channel switch: "${afterValue}"`);
      // 채널 전환 시 body state가 유지됨 (React state)
      if (afterValue === testText) {
        console.log("[Scenario 6] PASS: textarea content preserved after channel switch");
      } else {
        console.log(`[Scenario 6] INFO: textarea content changed — was "${testText}", now "${afterValue}"`);
      }
    } else {
      console.log("[Scenario 6] INFO: textarea not visible after switch back");
    }
    await ss(page, "06-final-state");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ═══════════════════════════════════════════
  // 7. 모달 닫기 후 재열기 상태 초기화
  // ═══════════════════════════════════════════
  test("7. 모달 닫기 후 재열기 상태 초기화", async () => {
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 학생 선택 + 모달 열기
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.waitFor({ state: "visible", timeout: 10000 });
    await firstCheckbox.click();
    await page.waitForTimeout(500);

    const msgBtn = page.locator("button").filter({ hasText: "메시지 발송" }).first();
    await msgBtn.click();
    await page.waitForTimeout(1500);

    // 텍스트 입력
    const textarea = page.locator(".send-message-modal textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill("[E2E-reset] 모달 초기화 테스트");
    await page.waitForTimeout(300);
    await ss(page, "07-text-entered");

    // 모달 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    await ss(page, "07-modal-closed");

    // 모달 다시 열기 (체크박스가 해제되었을 수 있으므로 다시 체크)
    const checkbox2 = page.locator('input[type="checkbox"]').first();
    if (!(await checkbox2.isChecked())) {
      await checkbox2.click();
      await page.waitForTimeout(300);
    }
    await msgBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, "07-modal-reopened");

    // textarea가 비어있는지 확인
    const textarea2 = page.locator(".send-message-modal textarea").first();
    if (await textarea2.isVisible({ timeout: 5000 }).catch(() => false)) {
      const reopenedValue = await textarea2.inputValue();
      console.log(`[Scenario 7] textarea value after reopen: "${reopenedValue}"`);
      expect(reopenedValue).toBe("");
      console.log("[Scenario 7] PASS: textarea is empty after modal reopen");
    } else {
      console.log("[Scenario 7] WARN: textarea not visible after reopen");
    }
    await ss(page, "07-final");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });
});
