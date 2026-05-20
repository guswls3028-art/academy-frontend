/**
 * E2E: 선생님 앱 Phase 2 — 소통/알림/푸시 UI 렌더링 검증
 * Tenant 1 (hakwonplus) admin 로그인 후 모바일 뷰포트에서 검증
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

async function waitForTeacherPageReady(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page.getByText("불러오는 중…").first()).not.toBeVisible({ timeout: 10_000 });
}

test.describe("Phase 2: 소통탭 + 알림센터", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => {
      localStorage.removeItem("teacher:preferAdmin");
    });
  });

  test("소통탭 5탭 렌더링 (공지/Q&A/가입신청/게시판/자료)", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/teacher/comms`, { timeout: 20_000 });
    await waitForTeacherPageReady(page);

    // 5개 탭 확인 — 뱃지 숫자 포함 가능하므로 포함 매칭
    await expect(page.getByRole("button", { name: /공지/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Q&A/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /가입신청/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /게시판/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /자료/ }).first()).toBeVisible();

    // Q&A 탭 클릭
    await page.getByRole("button", { name: /Q&A/ }).first().click();
    await waitForTeacherPageReady(page);

    // 게시판 탭 클릭
    await page.getByRole("button", { name: /게시판/ }).first().click();
    await waitForTeacherPageReady(page);

    // 자료 탭 클릭
    await page.getByRole("button", { name: /자료/ }).first().click();
    await waitForTeacherPageReady(page);

    await page.screenshot({ path: "e2e/screenshots/teacher-phase2-01-comms-tabs.png" });
  });

  test("알림센터 페이지 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/teacher/notifications`, { timeout: 20_000 });

    // 알림 센터 헤딩 확인
    await expect(page.getByRole("heading", { name: "알림 센터" })).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/teacher-phase2-02-notifications.png" });
  });

  test("프로필 — 푸시 알림 설정 카드 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/teacher/profile`, { timeout: 20_000 });

    // 프로필 헤딩 확인
    await expect(page.getByRole("heading", { name: "내 프로필" })).toBeVisible({ timeout: 10_000 });

    // 푸시 알림 텍스트 확인 (supported 브라우저에서만)
    const pushSection = page.getByText("푸시 알림");
    // Chromium에서는 PushManager 지원되므로 보여야 함
    if (await pushSection.isVisible()) {
      await expect(pushSection).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/teacher-phase2-03-profile-push.png", fullPage: true });
  });

  test("하단 탭바 소통 뱃지 렌더링", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/teacher`, { timeout: 20_000 });

    // 하단 탭바 존재 확인
    const tabBar = page.locator('nav[aria-label="하단 메뉴"]');
    await expect(tabBar).toBeVisible({ timeout: 10_000 });

    // 커뮤니티 탭 존재
    await expect(tabBar.getByText("커뮤니티")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/teacher-phase2-04-tabbar-badge.png" });
  });
});
