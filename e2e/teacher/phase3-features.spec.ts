/**
 * E2E: 선생님 앱 Phase 3 — 시험/과제, 영상, 클리닉, 상담 메모 렌더링 검증
 * Tenant 1 (hakwonplus) admin 로그인 후 모바일 뷰포트에서 검증
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("Phase 3: 시험/과제 + 영상 + 클리닉 + 상담", () => {
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

  test("드로어에 Phase 3 메뉴 표시", async ({ page }) => {
    await page.goto(`${BASE}/teacher`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

    // 메뉴 탭 클릭 → 드로어 열기
    const tabBar = page.locator('nav[aria-label="하단 메뉴"]');
    await expect(tabBar).toBeVisible({ timeout: 10_000 });
    await tabBar.getByText("메뉴").click();
    await page.waitForTimeout(500);

    // PC 사이드바 구조 메뉴 확인 (드로어 내)
    await expect(page.getByRole("button", { name: "시험 / 과제" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "성적 조회" })).toBeVisible();
    await expect(page.getByRole("button", { name: "상담 메모" })).toBeVisible();
    // 영상은 대시보드 퀵액션에도 있어서 nth(1)로 드로어 것 확인
    await expect(page.getByRole("button", { name: /^영상$/ }).nth(1)).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/teacher-phase3-01-drawer-menu.png" });
  });

  test("시험/과제 페이지 렌더링 + 탭 전환", async ({ page }) => {
    await page.goto(`${BASE}/teacher/exams`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

    // 페이지 헤딩 확인
    await expect(page.getByRole("heading", { name: "시험 / 과제" })).toBeVisible({ timeout: 10_000 });

    // 2개 탭 버튼 확인 (탭 영역 내 버튼만)
    const examTab = page.locator("button").filter({ hasText: /^시험$/ }).first();
    const hwTab = page.locator("button").filter({ hasText: /^과제$/ }).first();
    await expect(examTab).toBeVisible();
    await expect(hwTab).toBeVisible();

    // 과제 탭 클릭
    await hwTab.click();
    await page.waitForTimeout(1000);

    // 시험 탭 다시 클릭
    await examTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "e2e/screenshots/teacher-phase3-02-exams.png" });
  });

  test("영상 목록 페이지 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/videos`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

    // 페이지 헤딩 확인
    await expect(page.getByRole("heading", { name: "영상 목록" })).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/teacher-phase3-03-videos.png" });
  });

  test("클리닉 페이지 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/clinic`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

    // 페이지 헤딩 확인 — "클리닉" 또는 "오늘 클리닉" (section_mode에 따라)
    const heading = page.getByText(/클리닉/).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/teacher-phase3-04-clinic.png" });
  });

  test("상담 메모 페이지 렌더링 + 새 메모 버튼", async ({ page }) => {
    await page.goto(`${BASE}/teacher/counseling`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

    // 페이지 헤딩 확인
    await expect(page.getByRole("heading", { name: "상담 메모" })).toBeVisible({ timeout: 10_000 });

    // 새 메모 버튼 확인
    await expect(page.getByRole("button", { name: "+ 새 메모" })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/teacher-phase3-05-counseling.png" });
  });

  test("드로어에서 각 페이지 네비게이션", async ({ page }) => {
    await page.goto(`${BASE}/teacher`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForTimeout(2000);

    const tabBar = page.locator('nav[aria-label="하단 메뉴"]');
    await expect(tabBar).toBeVisible({ timeout: 10_000 });

    // 메뉴 → 영상
    await tabBar.getByText("메뉴").click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /^영상$/ }).nth(1).click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/teacher/videos");

    // 메뉴 → 상담 메모
    await tabBar.getByText("메뉴").click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "상담 메모" }).click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/teacher/counseling");

    await page.screenshot({ path: "e2e/screenshots/teacher-phase3-06-nav-flow.png" });
  });
});
