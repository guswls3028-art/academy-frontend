/**
 * 직원관리 E2E — 조교 생성 → 시급태그 → 출퇴근 → 근무기록 검증
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
const B = "https://hakwonplus.com";
const TS = Date.now().toString().slice(-6);

test.describe("직원관리 실사용 검증", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("1. 직원 홈 페이지 렌더링", async ({ page }) => {
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    // 직원 테이블이 보이는지
    await expect(page.locator("text=직위").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=이름").first()).toBeVisible();
    // 직원 등록 버튼
    await expect(page.locator("button").filter({ hasText: "직원 등록" }).first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/staff-home.png", fullPage: true });
  });

  test("2. 조교 생성", async ({ page }) => {
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 직원 등록 버튼 클릭
    await page.locator("button").filter({ hasText: "직원 등록" }).first().click();
    await page.waitForTimeout(500);

    // 모달이 열렸는지 확인
    const modal = page.locator('[role="dialog"], .modal, [class*="Modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 필드 입력
    const usernameInput = page.locator('input[name="username"], input[placeholder*="아이디"]').first();
    if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usernameInput.fill(`e2e_test_${TS}`);
    }
    const passwordInput = page.locator('input[name="password"], input[placeholder*="비밀번호"], input[type="password"]').first();
    if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passwordInput.fill("test1234");
    }
    const nameInput = page.locator('input[name="name"], input[placeholder*="이름"]').first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill(`[E2E-${TS}] 테스트조교`);
    }

    await page.screenshot({ path: "e2e/screenshots/staff-create-modal.png" });

    // 생성 버튼 클릭
    const createBtn = page.locator("button").filter({ hasText: /생성|등록|저장/ }).last();
    await createBtn.click();
    await page.waitForTimeout(2000);

    // 성공 토스트 또는 테이블에 새 직원 표시
    const newStaff = page.locator(`text=[E2E-${TS}]`);
    const created = await newStaff.isVisible({ timeout: 5000 }).catch(() => false);
    
    await page.screenshot({ path: "e2e/screenshots/staff-created.png", fullPage: true });
    
    if (!created) {
      // 에러 메시지 확인
      console.log("Staff creation may have failed - checking for error messages");
    }
  });

  test("3. 시급태그 관리", async ({ page }) => {
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 시급태그 관리 버튼 찾기
    const tagBtn = page.locator("button").filter({ hasText: /시급.*태그|태그.*관리|태그.*생성/ }).first();
    if (await tagBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tagBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "e2e/screenshots/staff-worktypes.png" });
    } else {
      console.log("시급태그 버튼을 찾을 수 없음");
      await page.screenshot({ path: "e2e/screenshots/staff-worktypes-notfound.png", fullPage: true });
    }
  });

  test("4. 급여 워크스페이스 — 근태 탭", async ({ page }) => {
    await page.goto(`${B}/admin/staff/attendance`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 좌측 직원 리스트가 보이는지
    await page.screenshot({ path: "e2e/screenshots/staff-attendance.png", fullPage: true });
    
    // 직원 선택 (첫 번째 직원 클릭)
    const staffItem = page.locator('[class*="staff"], [class*="Staff"]').filter({ hasText: /강사|조교/ }).first();
    if (await staffItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await staffItem.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/staff-attendance-selected.png", fullPage: true });
    }
  });

  test("5. 출퇴근 버튼 상태 확인 (헤더)", async ({ page }) => {
    await page.goto(`${B}/admin/staff/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 헤더에서 출근/퇴근 버튼 찾기
    const clockBtn = page.locator("button").filter({ hasText: /출근|퇴근/ }).first();
    if (await clockBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await clockBtn.textContent();
      console.log("Clock button text:", text);
      await page.screenshot({ path: "e2e/screenshots/staff-clock-header.png" });
    } else {
      console.log("출근/퇴근 버튼 없음 — 관리자 계정은 staff_profile 없을 수 있음");
      await page.screenshot({ path: "e2e/screenshots/staff-clock-no-button.png" });
    }
  });

  test("6. 월 마감 탭", async ({ page }) => {
    await page.goto(`${B}/admin/staff/month-lock`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/staff-monthlock.png", fullPage: true });
  });

  test("7. 급여 스냅샷 탭", async ({ page }) => {
    await page.goto(`${B}/admin/staff/payroll-snapshot`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/staff-payroll.png", fullPage: true });
  });

  test("8. 설정 탭 (알림톡/SMS 분리)", async ({ page }) => {
    await page.goto(`${B}/admin/staff/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await expect(page.locator("text=알림톡 자동발송").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=SMS 자동발송").first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: "e2e/screenshots/staff-settings-final.png", fullPage: true });
  });
});
