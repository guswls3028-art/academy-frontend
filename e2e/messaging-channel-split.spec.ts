/**
 * E2E: 메시지 설정 — 알림톡/SMS 분리 UI 검증
 *
 * 검증 대상:
 * 1. 클리닉 메시지 설정: 알림톡/SMS 분리 패널 렌더링
 * 2. 커뮤니티 설정: 알림톡/SMS 분리 패널 렌더링
 * 3. 직원 설정: 알림톡/SMS 분리 패널 렌더링
 * 4. 메시지 > 설정: 연동 가이드 + 공급자 전환 확인
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = "https://hakwonplus.com";

test.describe("메시지 설정 — 알림톡/SMS 분리", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("클리닉 메시지 설정: 알림톡/SMS 두 섹션 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/msg-settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 알림톡 자동발송 섹션 확인
    await expect(page.locator("text=알림톡 자동발송").first()).toBeVisible({ timeout: 15000 });
    // SMS 자동발송 섹션 확인
    await expect(page.locator("text=SMS 자동발송").first()).toBeVisible({ timeout: 5000 });

    // 클리닉 트리거가 두 섹션에 각각 표시 (총 2개 이상)
    const triggerCards = page.locator("text=클리닉 예약 완료");
    await expect(triggerCards.first()).toBeVisible({ timeout: 5000 });
    const count = await triggerCards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await page.screenshot({ path: "e2e/screenshots/clinic-msg-split.png" });
  });

  test("커뮤니티 설정: 알림톡/SMS 두 섹션 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/admin/community/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await expect(page.locator("text=알림톡 자동발송").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=SMS 자동발송").first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "e2e/screenshots/community-settings-split.png" });
  });

  test("직원 설정: 알림톡/SMS 두 섹션 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/admin/staff/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await expect(page.locator("text=알림톡 자동발송").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=SMS 자동발송").first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "e2e/screenshots/staff-settings-split.png" });
  });

  test("메시지 설정: 연동 가이드 + 공급자 전환 확인", async ({ page }) => {
    await page.goto(`${BASE}/admin/message/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 연동 가이드 확인
    await expect(page.locator("text=연동 가이드").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=바로 시작하기").first()).toBeVisible({ timeout: 5000 });

    // 공급자 전환 확인 다이얼로그 테스트
    const ppurioBtn = page.locator("button").filter({ hasText: "뿌리오(Ppurio)" }).first();
    await expect(ppurioBtn).toBeVisible({ timeout: 5000 });

    // confirm 다이얼로그 → dismiss
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("메시징 공급자를");
      await dialog.dismiss();
    });
    await ppurioBtn.click();
    await page.waitForTimeout(500);

    // 직접 연동 모드 전환 후 가이드 확인
    const selfBtn = page.locator("button").filter({ hasText: "직접 연동" }).first();
    if (await selfBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selfBtn.click();
      await page.waitForTimeout(500);
    }

    // 뿌리오 공급자 선택 (이미 solapi 상태라면 전환)
    page.once("dialog", async (dialog) => await dialog.accept());
    await ppurioBtn.click();
    await page.waitForTimeout(1000);

    // 뿌리오 연동 가이드 확인
    const ppurioGuide = page.locator("text=뿌리오 연동 방법");
    if (await ppurioGuide.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(page.locator("text=1단계. 회원가입").first()).toBeVisible();
      await expect(page.locator("text=IP 허용 등록").first()).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/message-settings-guide.png" });

    // 솔라피로 되돌리기
    const solapiBtn = page.locator("button").filter({ hasText: "솔라피(Solapi)" }).first();
    page.once("dialog", async (dialog) => await dialog.accept());
    await solapiBtn.click();
    await page.waitForTimeout(500);
  });

  test("메시지 설정: KPI 카드 및 연동 상태 표시", async ({ page }) => {
    await page.goto(`${BASE}/admin/message/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // KPI 카드들이 보이는지
    await expect(page.locator("text=크레딧 잔액").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=발신번호").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=알림톡 채널").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=공급자").first()).toBeVisible({ timeout: 5000 });

    // 연동 상태 섹션
    await expect(page.locator("text=연동 상태").first()).toBeVisible({ timeout: 5000 });

    // 연동 테스트 버튼
    await expect(page.locator("button").filter({ hasText: "연동 상태 테스트" }).first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "e2e/screenshots/message-settings-kpi.png" });
  });
});
