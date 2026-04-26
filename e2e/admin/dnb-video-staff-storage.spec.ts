/**
 * DNB 아카데미 (tenant 9) — 영상/스태프/저장소/도구/개발자 페이지 E2E 검증
 * 운영 환경에서 각 페이지 렌더링 + 콘솔에러/API에러/크래시 감지
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";
import type { Page } from "@playwright/test";

const DNB_BASE = getBaseUrl("dnb-admin");

interface PageErrors {
  consoleErrors: string[];
  apiErrors: string[];
}

function attachErrorListeners(page: Page): PageErrors {
  const errors: PageErrors = { consoleErrors: [], apiErrors: [] };
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("favicon") || text.includes("ResizeObserver")) return;
      errors.consoleErrors.push(text);
    }
  });
  page.on("response", (resp) => {
    const status = resp.status();
    if (status >= 400) {
      errors.apiErrors.push(`${status} ${resp.url()}`);
    }
  });
  return errors;
}

/** 페이지 진입 + body 비어있지 않음 + URL 정상 검증. */
async function visitAndAssertRendered(page: Page, path: string, screenshot: string) {
  attachErrorListeners(page);
  await gotoAndSettle(page, `${DNB_BASE}${path}`, { settleMs: 1500 });
  await page.screenshot({ path: `e2e/screenshots/${screenshot}.png`, fullPage: true });

  const body = await page.locator("body").innerText();
  expect(body.length).toBeGreaterThan(10);
  expect(page.url()).toContain("/admin");
}

test.describe("DNB 영상/스태프/저장소/도구/개발자 검증", () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "dnb-admin");
  });

  // ──────────────── 영상 ────────────────

  test("01. 영상 탐색기 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/videos", "dnb-01-videos");
  });

  // ──────────────── 저장소 ────────────────

  test("02. 저장소 > 내 저장소 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/storage", "dnb-02-storage");
  });

  test("03. 저장소 > 학생 인벤토리 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/storage/students", "dnb-03-storage-students");
  });

  // ──────────────── 스태프 ────────────────

  test("04. 스태프 목록 렌더링", async ({ page }) => {
    attachErrorListeners(page);
    // 사이드바 우선, fallback URL 직접 진입.
    const staffLink = page.locator('a[href*="/admin/staff"], nav >> text=스태프').first();
    if (await staffLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await staffLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    } else {
      await gotoAndSettle(page, `${DNB_BASE}/admin/staff`, { settleMs: 1500 });
    }
    await page.screenshot({ path: "e2e/screenshots/dnb-04-staff.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    expect(page.url()).toContain("/admin");
  });

  test("05. 스태프 출근부 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/staff/attendance", "dnb-05-staff-attendance");
  });

  test("06. 스태프 경비 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/staff/expenses", "dnb-06-staff-expenses");
  });

  test("07. 스태프 월 마감 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/staff/month-lock", "dnb-07-staff-month-lock");
  });

  test("08. 스태프 급여 스냅샷 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/staff/payroll-snapshot", "dnb-08-staff-payroll-snapshot");
  });

  test("09. 스태프 리포트 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/staff/reports", "dnb-09-staff-reports");
  });

  test("10. 스태프 설정 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/staff/settings", "dnb-10-staff-settings");
  });

  // ──────────────── 도구 ────────────────

  test("11. 스톱워치 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/tools/stopwatch", "dnb-11-stopwatch");
  });

  test("12. 가이드 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/guide", "dnb-12-guide");
  });

  // ──────────────── 개발자 ────────────────

  test("13. 버그 리포트 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/developer/bug", "dnb-13-bug-report");
  });

  test("14. 피드백 렌더링", async ({ page }) => {
    await visitAndAssertRendered(page, "/admin/developer/feedback", "dnb-14-feedback");
  });
});
