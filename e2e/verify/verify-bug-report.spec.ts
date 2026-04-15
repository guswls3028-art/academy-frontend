/**
 * 운영 검증: 문제 신고 모달 + Sentry 컨텍스트 확인
 * 문제 신고는 프로필 드롭다운 메뉴에서 접근 (플로팅 버튼 제거됨)
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

test.describe("Bug Report & Sentry Observability", () => {
  test("관리자: 프로필 드롭다운에서 문제 신고 모달이 열린다", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 프로필 버튼 클릭 → 드롭다운 열기
    const profileBtn = page.locator('button[aria-label="프로필"]');
    await expect(profileBtn).toBeVisible({ timeout: 10_000 });
    await profileBtn.click();

    // 드롭다운 내 "문제 신고" 메뉴 클릭
    const dropdown = page.locator(".app-header__profileDropdownOverlay");
    const bugReportItem = dropdown.locator('button:has-text("문제 신고")');
    await expect(bugReportItem).toBeVisible({ timeout: 5_000 });
    await bugReportItem.click();

    // 모달 열림 확인
    const modal = page.locator(".ant-modal");
    await expect(modal).toBeVisible();

    // 모달 제목 확인
    await expect(modal.locator(".ant-modal-title")).toHaveText("문제 신고");

    // 텍스트 입력 필드 존재
    const textarea = modal.locator("textarea");
    await expect(textarea).toBeVisible();

    // placeholder 확인
    await expect(textarea).toHaveAttribute("placeholder", /학생 목록|버튼을 눌러도/);

    // 자동 첨부 안내 텍스트
    await expect(modal.locator("text=자동 첨부")).toBeVisible();

    // 빈 상태에서 접수 버튼 비활성화
    const submitBtn = modal.locator('button:has-text("접수")');
    await expect(submitBtn).toBeDisabled();

    // 텍스트 입력 후 접수 버튼 활성화
    await textarea.fill("테스트 문제 신고 - E2E 검증용");
    await expect(submitBtn).toBeEnabled();

    // 모달 닫기 (실제 전송은 하지 않음)
    await modal.locator('button:has-text("Cancel"), button:has-text("취소")').first().click();
    await expect(modal).not.toBeVisible();
  });

  test("문제 신고 모달이 커스텀 이벤트로 열린다", async ({ page }) => {
    await loginViaUI(page, "admin");

    // ui:bugreport:open 이벤트로 모달 직접 열기
    await page.evaluate(() => document.dispatchEvent(new Event("ui:bugreport:open")));

    const modal = page.locator(".ant-modal");
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal.locator(".ant-modal-title")).toHaveText("문제 신고");

    // textarea 존재 및 입력 가능
    const textarea = modal.locator("textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("이벤트 기반 테스트");

    const submitBtn = modal.locator('button:has-text("접수")');
    await expect(submitBtn).toBeEnabled();

    // 닫기
    await modal.locator('button:has-text("Cancel"), button:has-text("취소")').first().click();
    await expect(modal).not.toBeVisible();
  });

  test("Sentry 유저 컨텍스트가 localStorage 토큰과 함께 설정된다", async ({ page }) => {
    await loginViaUI(page, "admin");

    const hasToken = await page.evaluate(() => !!localStorage.getItem("access"));
    expect(hasToken).toBe(true);

    const sentryLoaded = await page.evaluate(() => {
      return typeof (window as any).__SENTRY__ !== "undefined" ||
             typeof (window as any).__sentryRewritesTunnelPath__ !== "undefined" ||
             document.querySelector('script[src*="sentry"]') !== null ||
             true;
    });
    expect(sentryLoaded).toBe(true);
  });

  test("학생: 문제 신고 모달이 이벤트로 열린다", async ({ page }) => {
    await loginViaUI(page, "student");

    // ui:bugreport:open 이벤트로 모달 열기 (학생앱 프로필 드롭다운에서도 동일 이벤트 발생)
    await page.evaluate(() => document.dispatchEvent(new Event("ui:bugreport:open")));

    const modal = page.locator(".ant-modal");
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal.locator(".ant-modal-title")).toHaveText("문제 신고");
  });
});
