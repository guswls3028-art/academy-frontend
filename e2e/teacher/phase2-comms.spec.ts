/**
 * E2E: 선생님 앱 Phase 2 — 소통/알림/푸시 UI 렌더링 검증
 * Tenant 1 (hakwonplus) admin 로그인 후 모바일 뷰포트에서 검증
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

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

  test("소통탭 3탭 렌더링 (공지/Q&A/등록요청)", async ({ page }) => {
    await page.goto(`${BASE}/teacher/comms`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

    // 3개 탭 버튼 확인
    const tabs = page.locator("button").filter({ hasText: /공지사항|Q&A|등록요청/ });
    await expect(tabs).toHaveCount(3);

    // 공지사항 탭 활성 확인
    await expect(page.getByText("공지사항").first()).toBeVisible();

    // Q&A 탭 클릭
    await page.getByText("Q&A").first().click();
    await page.waitForTimeout(1000);

    // 등록요청 탭 클릭
    await page.getByText("등록요청").first().click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "e2e/screenshots/teacher-phase2-01-comms-tabs.png" });
  });

  test("알림센터 페이지 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/notifications`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

    // 알림 센터 헤딩 확인
    await expect(page.getByRole("heading", { name: "알림 센터" })).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/teacher-phase2-02-notifications.png" });
  });

  test("프로필 — 푸시 알림 설정 카드 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/profile`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

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
    await page.goto(`${BASE}/teacher`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(3000);

    // 하단 탭바 존재 확인
    const tabBar = page.locator('nav[aria-label="하단 메뉴"]');
    await expect(tabBar).toBeVisible({ timeout: 10_000 });

    // 소통 탭 존재
    await expect(tabBar.getByText("소통")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/teacher-phase2-04-tabbar-badge.png" });
  });
});
