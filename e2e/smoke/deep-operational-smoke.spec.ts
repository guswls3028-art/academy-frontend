/**
 * 심층 운영 안정화 E2E — 실제 데이터가 있는 동선
 *
 * 실제 API 호출 결과를 확인하고, 빈 데이터/에러/크래시를 잡는다.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

function collectErrors(page: Page) {
  const errors: string[] = [];
  const apiErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
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

test.describe("심층 운영 동선 검증", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("강의 > 차시 > 성적 탭 심층 검증", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);

    // 강의 목록
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 첫 강의 클릭
    const lectureLink = page.locator('a[href*="/lectures/"]').first();
    if (!await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("강의 없음 — 스킵");
      return;
    }
    await lectureLink.click();
    await page.waitForTimeout(2000);

    // 차시 탭 → 첫 차시 클릭
    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (!await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("차시 없음 — 스킵");
      return;
    }
    await sessionLink.click();
    await page.waitForTimeout(3000);

    // 성적 탭 클릭
    const scoresTab = page.locator('a, button, [role="tab"]').filter({ hasText: /성적/ }).first();
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await page.waitForTimeout(4000);

      // 테이블 또는 빈 상태 확인
      const table = page.locator('.ds-scores-table, table').first();
      const empty = page.locator('[class*="empty"], [class*="Empty"]').first();
      const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
      const hasEmpty = await empty.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasTable || hasEmpty).toBeTruthy();

      if (hasTable) {
        // 학생 이름이 있는 행 확인
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThan(0);

        // 첫 학생 행 클릭 → 드로어 열림 확인
        await rows.first().click();
        await page.waitForTimeout(1000);

        // 드로어 또는 패널 확인
        const drawer = page.locator('[class*="drawer"], [class*="Drawer"], [role="complementary"]').first();
        const drawerVisible = await drawer.isVisible({ timeout: 3000 }).catch(() => false);
        if (drawerVisible) {
          // 드로어 닫기
          const closeBtn = page.locator('[class*="close"], button[aria-label*="닫기"]').first();
          if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }
    }

    // 출결 탭 확인
    const attendanceTab = page.locator('a, button, [role="tab"]').filter({ hasText: /출결|출석/ }).first();
    if (await attendanceTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await attendanceTab.click();
      await page.waitForTimeout(3000);
    }

    // 런타임 에러 확인
    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function") || e.includes("undefined") ||
      e.includes("null")
    );
    if (criticalErrors.length > 0) {
      console.log("Critical errors:", criticalErrors);
    }
    expect(criticalErrors).toEqual([]);

    // 500 에러 확인
    const serverErrors = apiErrors.filter(e => e.startsWith("[5"));
    expect(serverErrors).toEqual([]);
  });

  test("메시지 페이지 (올바른 경로)", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);

    await page.goto(`${BASE}/admin/message`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(3000);

    // 페이지 로딩 확인
    const content = page.locator('[class*="domain"], [class*="Domain"], h1, h2').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    // 탭 전환
    const tabs = ["설정", "자동발송", "발송 내역", "템플릿"];
    for (const tabName of tabs) {
      const tab = page.locator('a, button, [role="tab"]').filter({ hasText: new RegExp(tabName) }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(2000);
      }
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("제출함 (올바른 경로)", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);

    await page.goto(`${BASE}/admin/results/submissions`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(3000);

    // 콘텐츠 영역 확인
    const content = page.locator('[class*="domain"], [class*="Domain"], [class*="inbox"], table, h1, h2, [class*="empty"], [class*="Empty"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("시험 탐색기 — 시험 상세 진입", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);

    await page.goto(`${BASE}/admin/exams`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 시험 목록에서 첫 항목 클릭
    const examItem = page.locator('a[href*="/exams/"], [class*="exam-card"], tr[class*="exam"], [data-exam-id]').first();
    if (await examItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await examItem.click();
      await page.waitForTimeout(3000);

      // 상세 페이지 확인
      const detail = page.locator('[class*="exam"], [class*="detail"], [class*="policy"], h1, h2, h3').first();
      await expect(detail).toBeVisible({ timeout: 10000 });
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("클리닉 운영 콘솔 — 달력/세션 전환", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);

    await page.goto(`${BASE}/admin/clinic/operations`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(3000);

    const content = page.locator('[class*="clinic"], [class*="console"], [class*="domain"], h1, h2, [class*="empty"], [class*="Empty"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("학생 상세 오버레이", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/students`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 학생 클릭
    const studentRow = page.locator('tr a, [class*="student-row"], a[href*="/students/"]').first();
    if (await studentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentRow.click();
      await page.waitForTimeout(3000);

      // 오버레이/상세 확인
      const detail = page.locator('[class*="overlay"], [class*="detail"], [class*="student"], h1, h2, h3').first();
      await expect(detail).toBeVisible({ timeout: 10000 });
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("강의 출결 매트릭스", async ({ page }) => {
    const { errors } = collectErrors(page);

    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 첫 강의 클릭
    const lectureLink = page.locator('a[href*="/lectures/"]').first();
    if (!await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) return;
    await lectureLink.click();
    await page.waitForTimeout(2000);

    // 출결 매트릭스 탭
    const matrixTab = page.locator('a, button, [role="tab"]').filter({ hasText: /출결|매트릭스/ }).first();
    if (await matrixTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await matrixTab.click();
      await page.waitForTimeout(3000);
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });
});
