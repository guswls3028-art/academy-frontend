/**
 * 운영 안정화 스모크 E2E — 선생님 핵심 동선
 *
 * 목적: 선생님이 실제 사용하는 주요 페이지/기능이 런타임 에러 없이 동작하는지 검증
 * - 각 페이지 진입 시 콘솔 에러 수집
 * - API 4xx/5xx 응답 수집
 * - 핵심 DOM 요소 visible 확인
 * - 모달/탭/필터 동작 확인
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

/** 콘솔 에러 + API 에러 수집 헬퍼 */
function collectErrors(page: Page) {
  const errors: string[] = [];
  const apiErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore known noise
      if (text.includes("favicon") || text.includes("sourcemap") || text.includes("ResizeObserver")) return;
      errors.push(`[console.error] ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  page.on("response", (resp) => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !url.includes("favicon") && !url.includes("sourcemap") && !url.includes("hot-update")) {
      apiErrors.push(`[${status}] ${resp.request().method()} ${url}`);
    }
  });

  return { errors, apiErrors };
}

test.describe("선생님 핵심 동선 스모크", () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("1. 대시보드 진입", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 20000 });
    // 대시보드 렌더 확인
    await expect(page.locator('[data-page="dashboard"], main, .dashboard, h1, h2').first()).toBeVisible({ timeout: 10000 });
    expect(errors).toEqual([]);
  });

  test("2. 강의 목록 → 강의 상세 → 차시", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);

    // 강의 목록 진입
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 강의 목록 페이지가 렌더되었는지 확인
    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });

    // 강의 링크로 상세 진입
    const lectureLink = page.locator('a[href*="/lectures/"]').first();
    if (!await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, "강의 목록에 강의 데이터 없음 — 테스트 데이터 필요");
      return;
    }
    await lectureLink.click();
    await page.waitForTimeout(2000);

    // 강의 상세가 렌더되었는지 확인
    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });

    // 차시 탭 클릭
    const sessionTab = page.locator('a[href*="/sessions"], button, [role="tab"]').filter({ hasText: /차시/ }).first();
    if (await sessionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionTab.click();
      await page.waitForTimeout(2000);
    }

    const pageErrors = errors.filter(e => !e.includes("Failed to fetch"));
    expect(pageErrors).toEqual([]);
  });

  test("3. 성적 탭 진입 + 테이블 렌더링", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);

    // 강의 > 차시 > 성적 탭
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 첫 강의 진입
    const lectureLink = page.locator('a[href*="/lectures/"]').first();
    if (!await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, "강의 목록에 강의가 없음 — 테스트 데이터 필요");
      return;
    }
    await lectureLink.click();
    await page.waitForTimeout(2000);

    // 차시 목록에서 첫 차시 클릭
    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (!await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, "강의에 차시가 없음 — 테스트 데이터 필요");
      return;
    }
    await sessionLink.click();
    await page.waitForTimeout(2000);

    // 성적 탭 클릭
    const scoresTab = page.locator('a, button, [role="tab"]').filter({ hasText: /성적/ }).first();
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await page.waitForTimeout(3000);

      // 테이블 또는 빈 상태 확인
      const tableOrEmpty = page.locator('table, [class*="empty"], [data-empty]').first();
      await expect(tableOrEmpty).toBeVisible({ timeout: 10000 });
    }

    // 런타임 에러 없어야 함
    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function") || e.includes("undefined")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("4. 학생 목록 페이지 + 검색 + 상세", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/students`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 학생 목록 렌더 확인
    const content = page.locator('table, [class*="student"], [class*="card"], main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    // 검색 테스트
    const searchInput = page.locator('input[type="search"], input[placeholder*="검색"], input[placeholder*="이름"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("테스트");
      await page.waitForTimeout(1500);
      await searchInput.clear();
      await page.waitForTimeout(1000);
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("5. 시험 관리 (시험탐색기)", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/exams`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const content = page.locator('main, [class*="exam"], table').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("6. 클리닉 홈 + 운영 페이지", async ({ page }) => {
    const { errors } = collectErrors(page);

    // 클리닉 홈
    await page.goto(`${BASE}/admin/clinic`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);
    const content = page.locator('main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    // 운영 페이지
    const opsLink = page.locator('a[href*="operations"], a[href*="console"], button').filter({ hasText: /운영|콘솔/ }).first();
    if (await opsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await opsLink.click();
      await page.waitForTimeout(2000);
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("7. 메시지 설정 페이지", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/message`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const content = page.locator('main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    // 설정 탭 클릭
    const settingsTab = page.locator('a, button, [role="tab"]').filter({ hasText: /설정/ }).first();
    if (await settingsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsTab.click();
      await page.waitForTimeout(2000);
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("8. 커뮤니티 페이지", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/community`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const content = page.locator('main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("9. 제출함 (인박스)", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/results/submissions`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const content = page.locator('main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("10. 직원 관리", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/staff`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const content = page.locator('main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("11. 영상 관리", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/videos`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const content = page.locator('main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("12. 설정 페이지", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const content = page.locator('main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("13. 도구 페이지", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/tools`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const content = page.locator('main').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") || e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });
});
