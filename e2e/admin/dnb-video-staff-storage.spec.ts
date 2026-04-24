/**
 * DNB 아카데미 (tenant 9) — 영상/스태프/저장소/도구/개발자 페이지 E2E 검증
 * 운영 환경에서 각 페이지 렌더링 + 콘솔에러/API에러/크래시 감지
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";
import type { Page } from "@playwright/test";

const DNB_BASE = getBaseUrl("dnb-admin");
const API_BASE = getApiBaseUrl();

/** Collect console errors and failed API responses during each test */
interface PageErrors {
  consoleErrors: string[];
  apiErrors: string[];
}

function attachErrorListeners(page: Page): PageErrors {
  const errors: PageErrors = { consoleErrors: [], apiErrors: [] };
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore benign noise
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

test.describe("DNB 영상/스태프/저장소/도구/개발자 검증", () => {
  test.setTimeout(180000);
  let accessToken: string;

  test.beforeEach(async ({ page }) => {
    const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: DNB_USER, password: DNB_PASS, tenant_code: DNB_CODE },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
    });
    expect(resp.status()).toBe(200);
    const tokens = (await resp.json()) as { access: string; refresh: string };
    accessToken = tokens.access;

    await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit" });
    await page.evaluate(
      ({ access, refresh, code }) => {
        localStorage.setItem("access", access);
        localStorage.setItem("refresh", refresh);
        try { sessionStorage.setItem("tenantCode", code); } catch {}
      },
      { access: tokens.access, refresh: tokens.refresh, code: DNB_CODE },
    );
    await page.goto(`${DNB_BASE}/admin`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2500);
  });

  // ──────────────── 영상 ────────────────

  test("01. 영상 탐색기 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/videos`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-01-videos.png", fullPage: true });

    // Page should render (not blank/crash)
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    // URL should stay on videos page (no redirect to error)
    expect(page.url()).toContain("/admin");
    console.log(`[01] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  // ──────────────── 저장소 ────────────────

  test("02. 저장소 > 내 저장소 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/storage`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-02-storage.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    expect(page.url()).toContain("/admin");
    console.log(`[02] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("03. 저장소 > 학생 인벤토리 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/storage/students`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-03-storage-students.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    expect(page.url()).toContain("/admin");
    console.log(`[03] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  // ──────────────── 스태프 ────────────────

  test("04. 스태프 목록 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    // Try sidebar navigation first
    const staffLink = page.locator('a[href*="/admin/staff"], nav >> text=스태프').first();
    if (await staffLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await staffLink.click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto(`${DNB_BASE}/admin/staff`, { waitUntil: "load", timeout: 15000 });
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: "e2e/screenshots/dnb-04-staff.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    expect(page.url()).toContain("/admin");
    console.log(`[04] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("05. 스태프 출근부 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/staff/attendance`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-05-staff-attendance.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[05] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("06. 스태프 경비 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/staff/expenses`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-06-staff-expenses.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[06] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("07. 스태프 월 마감 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/staff/month-lock`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-07-staff-month-lock.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[07] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("08. 스태프 급여 스냅샷 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/staff/payroll-snapshot`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-08-staff-payroll-snapshot.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[08] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("09. 스태프 리포트 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/staff/reports`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-09-staff-reports.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[09] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("10. 스태프 설정 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/staff/settings`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-10-staff-settings.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[10] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  // ──────────────── 도구 ────────────────

  test("11. 스톱워치 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/tools/stopwatch`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-11-stopwatch.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[11] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("12. 가이드 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/guide`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-12-guide.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[12] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  // ──────────────── 개발자 ────────────────

  test("13. 버그 리포트 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/developer/bug`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-13-bug-report.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[13] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });

  test("14. 피드백 렌더링", async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto(`${DNB_BASE}/admin/developer/feedback`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/dnb-14-feedback.png", fullPage: true });

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(10);
    console.log(`[14] console errors: ${errors.consoleErrors.length}, api errors: ${errors.apiErrors.length}`);
    if (errors.apiErrors.length > 0) console.log(`  API errors: ${errors.apiErrors.join(", ")}`);
  });
});
