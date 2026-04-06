/**
 * E2E: 탭 SSOT 통일 검증
 * DomainLayout tabs prop으로 전환된 3개 도메인 + 서브탭 디자인 통일 확인
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("탭 SSOT — DomainLayout 탭 통일", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("메시지 — DomainLayout 탭으로 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/admin/message/templates`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // DomainLayout 헤더 탭 영역 확인
    const tabsWrap = page.locator(".domain-header__tabs-wrap");
    await expect(tabsWrap).toBeVisible({ timeout: 10000 });

    // 4개 탭 확인
    const tabs = tabsWrap.locator(".ds-tab");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toContainText("템플릿 저장");
    await expect(tabs.nth(1)).toContainText("자동발송");
    await expect(tabs.nth(2)).toContainText("발송 내역");
    await expect(tabs.nth(3)).toContainText("설정");

    // 현재 활성 탭
    await expect(tabs.nth(0)).toHaveClass(/is-active/);

    // 탭 클릭 → 라우트 이동
    await tabs.nth(2).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/admin\/message\/log/);
    await expect(tabs.nth(2)).toHaveClass(/is-active/);

    // StorageStyleTabs가 없는지 확인 (구 CSS class)
    const oldTabs = page.locator('[class*="StorageStyleTabs"]');
    await expect(oldTabs).toHaveCount(0);

    await page.screenshot({ path: "e2e/screenshots/tabs-message.png" });
  });

  test("저장소 — DomainLayout 탭으로 렌더링 + 라우트 전환", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // DomainLayout 헤더 탭 영역 확인
    const tabsWrap = page.locator(".domain-header__tabs-wrap");
    await expect(tabsWrap).toBeVisible({ timeout: 10000 });

    // 2개 탭 확인
    const tabs = tabsWrap.locator(".ds-tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toContainText("내 저장소(선생님)");
    await expect(tabs.nth(1)).toContainText("학생 인벤토리 관리");

    // 기본 탭 활성
    await expect(tabs.nth(0)).toHaveClass(/is-active/);

    // 학생 인벤토리 탭 클릭
    await tabs.nth(1).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/admin\/storage\/students/);
    await expect(tabs.nth(1)).toHaveClass(/is-active/);

    // 다시 내 저장소 클릭
    await tabs.nth(0).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/admin\/storage$/);
    await expect(tabs.nth(0)).toHaveClass(/is-active/);

    await page.screenshot({ path: "e2e/screenshots/tabs-storage.png" });
  });

  test("To개발자 — DomainLayout 탭으로 렌더링 + 라우트 전환", async ({ page }) => {
    await page.goto(`${BASE}/admin/developer`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // DomainLayout 헤더 탭 영역 확인
    const tabsWrap = page.locator(".domain-header__tabs-wrap");
    await expect(tabsWrap).toBeVisible({ timeout: 10000 });

    // 3개 탭 확인
    const tabs = tabsWrap.locator(".ds-tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText("패치노트");
    await expect(tabs.nth(1)).toContainText("버그 제보");
    await expect(tabs.nth(2)).toContainText("피드백");

    // 기본 탭 활성
    await expect(tabs.nth(0)).toHaveClass(/is-active/);

    // 버그 제보 탭 클릭
    await tabs.nth(1).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/admin\/developer\/bug/);
    await expect(tabs.nth(1)).toHaveClass(/is-active/);

    // 피드백 탭 클릭
    await tabs.nth(2).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/admin\/developer\/feedback/);
    await expect(tabs.nth(2)).toHaveClass(/is-active/);

    // 패치노트로 돌아오기
    await tabs.nth(0).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/admin\/developer$/);
    await expect(tabs.nth(0)).toHaveClass(/is-active/);

    await page.screenshot({ path: "e2e/screenshots/tabs-developer.png" });
  });

  test("기존 DomainLayout 탭 도메인 — 회손 없음 확인 (강의, 시험, 클리닉)", async ({ page }) => {
    // 강의 관리
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    const lectureTabs = page.locator(".domain-header__tabs-wrap .ds-tab");
    await expect(lectureTabs.first()).toBeVisible({ timeout: 10000 });

    // 시험
    await page.goto(`${BASE}/admin/exams`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    const examTabs = page.locator(".domain-header__tabs-wrap .ds-tab");
    await expect(examTabs.first()).toBeVisible({ timeout: 10000 });
    await expect(examTabs).toHaveCount(3);

    // 클리닉
    await page.goto(`${BASE}/admin/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    const clinicTabs = page.locator(".domain-header__tabs-wrap .ds-tab");
    await expect(clinicTabs.first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/tabs-existing-domains.png" });
  });
});
