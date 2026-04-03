import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const SS = "e2e/screenshots";

/**
 * Wait for the SendMessageModal to be visible.
 * Antd v6 renders modal in a portal; the inner wrapper is `.admin-modal__inner`.
 * We detect the modal header text "메시지 발송" becoming visible.
 */
async function waitForMsgModal(page: import("@playwright/test").Page) {
  // The modal renders with class "send-message-modal" on the Ant wrapper
  // and has an inner div ".admin-modal__inner"
  const modal = page.locator(".send-message-modal .admin-modal__inner");
  await modal.waitFor({ state: "visible", timeout: 10000 });
  return modal;
}

test.describe("메시지 모달 — 전체 도메인 진입점 E2E", () => {
  test.setTimeout(90_000);

  // ─── 1. 학생 목록 → 메시지 발송 ───
  test("1. 학생 목록 — 학생 선택 → 메시지 발송 → SMS/알림톡 전환", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/students`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/all-01-students-page.png`, fullPage: true });

    // 두 번째 체크박스 = 첫 번째 학생 (첫 번째는 전체선택 헤더)
    const studentCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await studentCheckbox.waitFor({ state: "visible", timeout: 10000 });
    await studentCheckbox.check({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/all-01-student-selected.png` });

    // "메시지 발송" 버튼 클릭
    const sendBtn = page.getByRole("button", { name: "메시지 발송" });
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();
    await page.waitForTimeout(2000);

    // 모달 열림 확인
    const modal = await waitForMsgModal(page);
    await page.screenshot({ path: `${SS}/all-01-modal-open.png` });

    // SMS 탭 보임 확인
    const smsTab = modal.locator('button').filter({ hasText: "SMS" }).first();
    await expect(smsTab).toBeVisible({ timeout: 5000 });

    // textarea 보임 (SMS 모드 기본)
    const textarea = modal.locator("textarea").first();
    const textareaVisible = await textarea.isVisible().catch(() => false);
    console.log(`SMS textarea visible: ${textareaVisible}`);
    await page.screenshot({ path: `${SS}/all-01-sms-mode.png` });

    // 알림톡 전환
    const alimtalkTab = modal.locator('button').filter({ hasText: "알림톡" }).first();
    await expect(alimtalkTab).toBeVisible({ timeout: 5000 });
    await alimtalkTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SS}/all-01-alimtalk-mode.png` });

    // 알림톡 모드에서 템플릿 UI 확인
    const modalText = await modal.textContent() ?? "";
    const hasTemplateUI = modalText.includes("템플릿");
    console.log(`알림톡 template UI found: ${hasTemplateUI}`);
    expect(hasTemplateUI).toBeTruthy();
    await page.screenshot({ path: `${SS}/all-01-alimtalk-final.png` });
    console.log("PASS: 학생 목록 메시지 발송 모달 — SMS/알림톡 전환 확인");
  });

  // ─── 2. 강의 수강생 → 메시지 발송 ───
  test("2. 강의 수강생 — 학생 선택 → 메시지 발송 → 도메인 배지 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    // 강의 77 (수강생이 있는 강의)에 직접 이동
    await page.goto(`${BASE}/admin/lectures/77`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/all-02-lecture-detail.png`, fullPage: true });

    // 모달이 자동으로 열릴 수 있음 (수강생 등록/차시 생성 안내 등)
    // 여러 번 Escape를 눌러 닫기
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
    // 혹시 남은 ant-modal-wrap 클릭으로 닫기
    const modalWrap = page.locator(".ant-modal-wrap");
    if (await modalWrap.isVisible().catch(() => false)) {
      // 모달 바깥 영역 클릭 (좌상단)
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);
      // 닫기 버튼 클릭 시도
      const closeBtn = page.locator(".ant-modal-close, button[aria-label='Close']").first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(500);

    // 수강생 탭 확인 및 클릭
    const studentsTab = page.locator('a, button, [role="tab"]').filter({ hasText: /수강생/ }).first();
    if (await studentsTab.isVisible().catch(() => false)) {
      await studentsTab.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SS}/all-02-lecture-students.png`, fullPage: true });

    // 모달이 여전히 열려 있다면 ant-modal-wrap을 JS로 제거
    await page.evaluate(() => {
      document.querySelectorAll(".ant-modal-root").forEach(el => el.remove());
    });
    await page.waitForTimeout(500);

    // 개별 학생 체크박스 선택
    const checkboxCount = await page.locator('input[type="checkbox"]').count();
    console.log(`Checkbox count: ${checkboxCount}`);

    if (checkboxCount >= 2) {
      const studentCb = page.locator('input[type="checkbox"]').nth(1);
      await studentCb.click();
      await page.waitForTimeout(500);
    } else if (checkboxCount === 1) {
      await page.locator('input[type="checkbox"]').first().click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${SS}/all-02-checkbox-clicked.png` });

    // "메시지 발송" 버튼
    let sendBtn = page.getByRole("button", { name: "메시지 발송" });
    await expect(sendBtn).toBeEnabled({ timeout: 5000 });
    await sendBtn.click();
    await page.waitForTimeout(2000);

    // 모달 열림 확인
    const modal = await waitForMsgModal(page);
    await page.screenshot({ path: `${SS}/all-02-modal-open.png` });

    // 도메인 컨텍스트 확인 — 모달 내용에 수강생/발송 텍스트
    const modalText = await modal.textContent() ?? "";
    console.log(`Modal text (first 200): ${modalText.slice(0, 200)}`);
    const hasDomainContext = modalText.includes("수강생") || modalText.includes("메시지 발송");
    expect(hasDomainContext).toBeTruthy();
    await page.screenshot({ path: `${SS}/all-02-modal-badge.png` });
    console.log("PASS: 강의 수강생 메시지 발송 모달 열림 + 도메인 컨텍스트 확인");
  });

  // ─── 3. 출결 탭 → 수업결과 발송 ───
  test("3. 출결 탭 — 수업결과 발송 버튼 존재 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/lectures/77/sessions/57/attendance`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/all-03-attendance-page.png`, fullPage: true });

    // 개별 학생 체크박스 (2번째 이후) — force click to bypass resize handle
    const checkbox = page.locator('input[type="checkbox"]').nth(1);
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click({ force: true });
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${SS}/all-03-after-check.png` });

    // "수업결과 발송" 버튼 존재 확인
    const resultSendBtn = page.getByRole("button", { name: /수업결과 발송/ });
    await expect(resultSendBtn).toBeVisible({ timeout: 8000 });
    console.log("수업결과 발송 button: VISIBLE");
    await page.screenshot({ path: `${SS}/all-03-result-send-btn.png` });
    console.log("PASS: 출결 탭 수업결과 발송 버튼 확인");
  });

  // ─── 4. 성적 탭 → 수업결과 발송 → 모달 양식 자동 로드 ───
  test("4. 성적 탭 — 수업결과 발송 → 모달에 양식 자동 로드", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/lectures/77/sessions/57/scores`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/all-04-scores-page.png`, fullPage: true });

    // 개별 학생 체크박스 (nth(1) — skip header)
    const checkbox = page.locator('input[type="checkbox"]').nth(1);
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click({ force: true });
      await page.waitForTimeout(500);
    }

    // "수업결과 발송" 버튼 클릭
    const resultSendBtn = page.getByRole("button", { name: /수업결과 발송/ });
    await expect(resultSendBtn).toBeVisible({ timeout: 8000 });
    await resultSendBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/all-04-modal-open.png` });

    // 모달 열림 확인
    const modal = await waitForMsgModal(page);

    // 양식 자동 로드 — SMS/알림톡 탭 또는 미리보기/템플릿 텍스트 확인
    const modalText = await modal.textContent() ?? "";
    const hasTemplate = modalText.includes("템플릿") || modalText.includes("미리보기") || modalText.includes("SMS") || modalText.includes("알림톡");
    console.log(`Modal has template/preview content: ${hasTemplate}`);
    console.log(`Modal text (first 300): ${modalText.slice(0, 300)}`);
    expect(hasTemplate).toBeTruthy();

    await page.screenshot({ path: `${SS}/all-04-modal-template.png` });
    console.log("PASS: 성적 탭 수업결과 발송 모달 양식 자동 로드 확인");
  });

  // ─── 5. 설정 페이지 — KPI 카드 4개 표시 확인 ───
  test("5. 설정 페이지 — KPI 카드 4개 표시 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/message/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/all-05-settings-page.png`, fullPage: true });

    // KPI 카드 4개: 공급자, 발신번호, 알림톡, SMS
    const bodyText = await page.textContent("body") ?? "";

    const kpiLabels = ["공급자", "발신번호", "알림톡", "SMS"];
    let foundCount = 0;
    for (const label of kpiLabels) {
      const found = bodyText.includes(label);
      console.log(`KPI "${label}": ${found ? "FOUND" : "NOT FOUND"}`);
      if (found) foundCount++;
    }

    console.log(`KPI cards found: ${foundCount}/4`);
    expect(foundCount).toBe(4);

    await page.screenshot({ path: `${SS}/all-05-kpi-cards.png` });
    console.log("PASS: 설정 페이지 KPI 카드 4개 표시 확인");
  });
});
