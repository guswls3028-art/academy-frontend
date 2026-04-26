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

async function visit(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 20000 });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

test.describe("심층 운영 동선 검증", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("강의 > 차시 > 성적 탭 심층 검증", async ({ page }) => {
    const { errors, apiErrors } = collectErrors(page);

    await visit(page, "/admin/lectures");

    const lectureLink = page.locator('a[href*="/lectures/"]').first();
    if (!await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.info().annotations.push({ type: "skip-reason", description: "강의 0개" });
      return;
    }
    await lectureLink.click();
    await settle(page);

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (!await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.info().annotations.push({ type: "skip-reason", description: "차시 0개" });
      return;
    }
    await sessionLink.click();
    await settle(page);

    const scoresTab = page.locator('a, button, [role="tab"]').filter({ hasText: /성적/ }).first();
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await settle(page);

      const table = page.locator('.ds-scores-table, table').first();
      const empty = page.locator('[class*="empty"], [class*="Empty"]').first();
      const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
      const hasEmpty = await empty.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasTable || hasEmpty).toBeTruthy();

      if (hasTable) {
        const rows = page.locator('tbody tr');
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThan(0);

        await rows.first().click();
        await settle(page);

        const drawer = page.locator('[class*="drawer"], [class*="Drawer"], [role="complementary"]').first();
        if (await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
          const closeBtn = page.locator('[class*="close"], button[aria-label*="닫기"]').first();
          if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await closeBtn.click();
            await expect(drawer).toBeHidden({ timeout: 3_000 });
          }
        }
      }
    }

    const attendanceTab = page.locator('a, button, [role="tab"]').filter({ hasText: /출결|출석/ }).first();
    if (await attendanceTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await attendanceTab.click();
      await settle(page);
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function") || e.includes("undefined") ||
      e.includes("null")
    );
    expect(criticalErrors).toEqual([]);

    const serverErrors = apiErrors.filter(e => e.startsWith("[5"));
    expect(serverErrors).toEqual([]);
  });

  test("메시지 페이지 (올바른 경로)", async ({ page }) => {
    const { errors } = collectErrors(page);

    await visit(page, "/admin/message");

    const content = page.locator('[class*="domain"], [class*="Domain"], h1, h2').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const tabs = ["설정", "자동발송", "발송 내역", "템플릿"];
    for (const tabName of tabs) {
      const tab = page.locator('a, button, [role="tab"]').filter({ hasText: new RegExp(tabName) }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await settle(page);
      }
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("제출함 (올바른 경로)", async ({ page }) => {
    const { errors } = collectErrors(page);

    await visit(page, "/admin/results/submissions");

    const content = page.locator('[class*="domain"], [class*="Domain"], [class*="inbox"], table, h1, h2, [class*="empty"], [class*="Empty"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });

  test("시험 탐색기 — 시험 상세 진입", async ({ page }) => {
    const { errors } = collectErrors(page);

    await visit(page, "/admin/exams");

    const examItem = page.locator('a[href*="/exams/"], [class*="exam-card"], tr[class*="exam"], [data-exam-id]').first();
    if (await examItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await examItem.click();
      await settle(page);

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
    const { errors } = collectErrors(page);

    await visit(page, "/admin/clinic/operations");

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

    await visit(page, "/admin/students");

    const studentRow = page.locator('tr a, [class*="student-row"], a[href*="/students/"]').first();
    if (await studentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentRow.click();
      await settle(page);

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

    await visit(page, "/admin/lectures");

    const lectureLink = page.locator('a[href*="/lectures/"]').first();
    if (!await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) return;
    await lectureLink.click();
    await settle(page);

    const matrixTab = page.locator('a, button, [role="tab"]').filter({ hasText: /출결|매트릭스/ }).first();
    if (await matrixTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await matrixTab.click();
      await settle(page);
    }

    const criticalErrors = errors.filter(e =>
      e.includes("TypeError") || e.includes("Cannot read") ||
      e.includes("is not a function")
    );
    expect(criticalErrors).toEqual([]);
  });
});
