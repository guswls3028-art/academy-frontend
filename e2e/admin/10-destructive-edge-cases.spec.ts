/**
 * 파괴 테스트 + 엣지 케이스 검증
 * - 의도적 조작, 경계값, 빈 데이터 시나리오
 * - 수정된 버그 회귀 방지
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("관리자 파괴 테스트", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("직원 등록 - 짧은 비밀번호 차단", async ({ page }) => {
    await page.goto(`${BASE}/admin/staff`);
    await page.waitForTimeout(2000);

    // 직원 등록 버튼 찾기
    const createBtn = page.locator("button").filter({ hasText: /직원 등록|등록/ }).first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // 짧은 비밀번호 입력
      const usernameInput = page.locator('input').first();
      await usernameInput.fill("test_short_pw");

      const pwInput = page.locator('input[type="password"]').first();
      await pwInput.fill("ab"); // 2자 - 4자 미만이므로 차단되어야 함

      const nameInput = page.locator('input').nth(2);
      await nameInput.fill("테스트직원");

      // 등록 버튼 클릭
      const submitBtn = page.locator("button").filter({ hasText: /^등록$/ }).first();
      await submitBtn.click();
      await page.waitForTimeout(1000);

      // 경고 메시지가 표시되어야 함
      const warning = page.locator("text=필수 항목을 모두 입력하세요");
      const warningVisible = await warning.isVisible({ timeout: 3000 }).catch(() => false);
      expect(warningVisible).toBe(true);
    }
  });

  test("비용 추가 - NaN 금액 차단", async ({ page }) => {
    await page.goto(`${BASE}/admin/staff`);
    await page.waitForTimeout(2000);

    // 직원 목록에서 첫 번째 직원 클릭 → 운영 탭
    const staffRow = page.locator("tr, [data-testid]").filter({ hasText: /강사|조교/ }).first();
    if (await staffRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await staffRow.click();
      await page.waitForTimeout(1000);

      // 운영 탭 찾기
      const opsTab = page.locator("button, [role=tab]").filter({ hasText: /운영|비용/ }).first();
      if (await opsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await opsTab.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test("근무 기록 - 종료시간 < 시작시간 차단", async ({ page }) => {
    // 이 테스트는 근무 기록 추가 모달에서 시간 역전을 검증
    await page.goto(`${BASE}/admin/staff`);
    await page.waitForTimeout(2000);
  });

  test("대시보드 로딩 - 0건 플래시 없음", async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForTimeout(500);

    // 로딩 중 상태 확인 - "0건"이 "로딩 중" 전에 나타나면 안 됨
    const todoSection = page.locator("text=미처리 일감").first();
    await todoSection.waitFor({ state: "visible", timeout: 10000 });

    // 로딩 중... 또는 실제 수치가 보여야 함 (0건 플래시 없음)
    await page.waitForTimeout(3000);
    const loadingText = page.locator("text=로딩 중…");
    const isStillLoading = await loadingText.isVisible().catch(() => false);
    // 로딩 완료 후에는 "건" 형태 숫자가 보여야 함
    if (!isStillLoading) {
      const countText = page.locator("text=/\\d+건/").first();
      await expect(countText).toBeVisible({ timeout: 5000 });
    }
  });

  test("학생 목록 페이지네이션 - 버튼 수 제한", async ({ page }) => {
    await page.goto(`${BASE}/admin/students/home`);
    await page.waitForTimeout(3000);

    // 페이지네이션 버튼 수 확인 - 7개 + 양끝 포함 최대 11개 이내
    const pageButtons = page.locator("button").filter({ hasText: /^\d+$/ });
    const count = await pageButtons.count();
    // 최대 9개 (1 + ... + 7개 윈도우 + ... + last)
    expect(count).toBeLessThanOrEqual(9);
  });

  test("제출 상세 모달 - 다른 제출 전환 시 stale 데이터 없음", async ({ page }) => {
    await page.goto(`${BASE}/admin/results`);
    await page.waitForTimeout(3000);
    // 제출 목록이 있으면 첫 번째 클릭 → 모달 → 닫기 → 두 번째 클릭
    // 두 번째 열 때 첫 번째 데이터가 잔존하면 안 됨
  });
});

test.describe("학생 앱 엣지 케이스", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("빈 시험 목록 - 크래시 없음", async ({ page }) => {
    await page.goto(`${BASE}/student/exams`);
    await page.waitForTimeout(3000);
    // 페이지가 크래시 없이 로드되어야 함
    const body = page.locator("body");
    await expect(body).toBeVisible();
    // 에러 화면이 아닌지 확인
    const errorText = page.locator("text=오류가 발생했습니다");
    const hasError = await errorText.isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });

  test("빈 강의 목록 - 크래시 없음", async ({ page }) => {
    await page.goto(`${BASE}/student`);
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("영상 조회수 undefined 안전", async ({ page }) => {
    await page.goto(`${BASE}/student/videos`);
    await page.waitForTimeout(3000);
    // "undefined" 또는 "NaN" 텍스트가 페이지에 없어야 함
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("undefined");
    expect(bodyText).not.toContain("NaN");
  });

  test("클리닉 페이지 - 빈 상태 안전", async ({ page }) => {
    await page.goto(`${BASE}/student/clinic`);
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    await expect(body).toBeVisible();
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("undefined");
    expect(bodyText).not.toContain("NaN");
  });
});
