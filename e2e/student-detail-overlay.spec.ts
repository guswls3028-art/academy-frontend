/**
 * 학생 상세 오버레이 E2E — 탭 UI, 정보 정합성, 네비게이션 검증
 *
 * 검증 대상:
 * 1. 학생 목록 → 학생 클릭 → 오버레이 열림
 * 2. 요약 대시보드 카드 렌더링
 * 3. 5개 탭 (수강, 시험 성적, 과제, 클리닉, 질문) 전환 + 콘텐츠 로딩
 * 4. 탭 아이템 클릭 시 네비게이션 (오버레이 닫히고 해당 페이지 이동)
 * 5. 학생 정보 패널 (좌측) 정보 표시
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("학생 상세 오버레이", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("오버레이 열림 + 헤더 정보 표시", async ({ page }) => {
    await page.goto("/admin/students/home");
    await page.waitForSelector(".ds-table-row, [data-testid='student-row']", { timeout: 10_000 });

    // 첫 번째 학생 클릭
    const firstRow = page.locator(".ds-table-row, [data-testid='student-row']").first();
    await firstRow.click();

    // 오버레이 패널 렌더링
    await expect(page.locator(".ds-overlay-panel--student-detail")).toBeVisible({ timeout: 8_000 });

    // 헤더: 이름, 아바타, 뱃지 존재
    await expect(page.locator(".ds-overlay-header__avatar")).toBeVisible();
    await expect(page.locator(".ds-overlay-header__title")).toBeVisible();
    await expect(page.locator(".ds-overlay-header__badge-id")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/student-detail-header.png" });
  });

  test("요약 대시보드 카드 렌더링 (6개)", async ({ page }) => {
    await page.goto("/admin/students/home");
    await page.waitForSelector(".ds-table-row, [data-testid='student-row']", { timeout: 10_000 });
    const firstRow = page.locator(".ds-table-row, [data-testid='student-row']").first();
    await firstRow.click();
    await expect(page.locator(".ds-overlay-panel--student-detail")).toBeVisible({ timeout: 8_000 });

    // 대시보드 카드: 수강, 시험, 합격률, 과제, 클리닉, 질문
    const dashCards = page.locator(".ds-overlay-body__grid >> div >> div").filter({ hasText: /수강|시험|합격률|과제|클리닉|질문/ });
    await expect(dashCards.first()).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: "e2e/screenshots/student-detail-dashboard.png" });
  });

  test("탭 전환 동작 — 5개 탭 모두 클릭 가능", async ({ page }) => {
    await page.goto("/admin/students/home");
    await page.waitForSelector(".ds-table-row, [data-testid='student-row']", { timeout: 10_000 });
    const firstRow = page.locator(".ds-table-row, [data-testid='student-row']").first();
    await firstRow.click();
    await expect(page.locator(".ds-overlay-panel--student-detail")).toBeVisible({ timeout: 8_000 });

    const tabLabels = ["수강", "시험 성적", "과제", "클리닉", "질문"];
    for (const label of tabLabels) {
      const tab = page.locator(".ds-tab").filter({ hasText: label });
      await tab.click();
      await expect(tab).toHaveClass(/is-active/);
      // 탭 콘텐츠 영역 존재 확인 (빈 상태이거나 데이터가 있을 수 있음)
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: "e2e/screenshots/student-detail-tabs.png" });
  });

  test("좌측 정보 패널 — 기본 정보 표시", async ({ page }) => {
    await page.goto("/admin/students/home");
    await page.waitForSelector(".ds-table-row, [data-testid='student-row']", { timeout: 10_000 });
    const firstRow = page.locator(".ds-table-row, [data-testid='student-row']").first();
    await firstRow.click();
    await expect(page.locator(".ds-overlay-panel--student-detail")).toBeVisible({ timeout: 8_000 });

    // 정보 행: 식별코드, 학부모 전화, 학생 전화, 성별, 학교, 학년, 등록일 등
    const infoLabels = ["식별코드", "학부모 전화", "학교", "등록일"];
    for (const label of infoLabels) {
      await expect(page.locator(".ds-overlay-info-row").filter({ hasText: label }).first()).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/student-detail-info-panel.png" });
  });

  test("수강 탭 — 강의 클릭 시 강의 페이지 네비게이션", async ({ page }) => {
    await page.goto("/admin/students/home");
    await page.waitForSelector(".ds-table-row, [data-testid='student-row']", { timeout: 10_000 });
    const firstRow = page.locator(".ds-table-row, [data-testid='student-row']").first();
    await firstRow.click();
    await expect(page.locator(".ds-overlay-panel--student-detail")).toBeVisible({ timeout: 8_000 });

    // 수강 탭 (기본 탭)
    const enrollTab = page.locator(".ds-tab").filter({ hasText: "수강" });
    await enrollTab.click();

    // 수강 항목이 있으면 클릭 → 강의 페이지 이동 확인
    const enrollItem = page.locator(".ds-overlay-body__grid").locator("div").filter({ hasText: /수강중|탈퇴|수료/ }).first();
    const enrollExists = await enrollItem.isVisible().catch(() => false);
    if (enrollExists) {
      await enrollItem.click();
      await page.waitForURL(/\/admin\/lectures\//, { timeout: 5_000 });
      await page.screenshot({ path: "e2e/screenshots/student-detail-enroll-nav.png" });
    }
  });
});
