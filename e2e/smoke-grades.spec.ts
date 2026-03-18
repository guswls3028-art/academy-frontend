/**
 * Smoke test: 성적 도메인 라우트 렌더링 검증
 *
 * 인증 없이 실행 가능한 최소 검증:
 * - SPA 라우트가 크래시 없이 로드되는지 (JS 에러 없음)
 * - 인증 리다이렉트가 정상 작동하는지
 *
 * 인증 필요한 전체 E2E는 homework-scores-inventory-data-flow.spec.ts 에서 수행.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

test.describe("성적 도메인 smoke (인증 없음)", () => {
  test("SPA 라우트 크래시 없이 로드", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    // 각 라우트를 순회하며 JS 에러 없이 로드되는지 확인
    const routes = [
      "/student/grades",
      "/student/exams/99999/result",
      "/student/grades/all",
      "/student/grades/exams/123",
    ];

    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
    }

    // JS 런타임 에러가 없어야 함 (React 렌더링 크래시 감지)
    const criticalErrors = jsErrors.filter(
      (e) => !e.includes("401") && !e.includes("403") && !e.includes("Network"),
    );
    expect(criticalErrors).toEqual([]);
  });

  test("Redirect: /grades/all → /grades (SPA 라우팅)", async ({ page }) => {
    await page.goto(`${BASE}/student/grades/all`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // SPA 라우터가 redirect 처리 후 URL에 /grades/all이 없어야 함
    // 인증 리다이렉트로 /login으로 갈 수도 있으나 /grades/all은 아님
    expect(page.url()).not.toContain("/grades/all");
  });

  test("Redirect: /grades/exams/:id → /exams/:id/result (SPA 라우팅)", async ({ page }) => {
    await page.goto(`${BASE}/student/grades/exams/123`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // /grades/exams/가 URL에 없어야 함
    expect(page.url()).not.toContain("/grades/exams/");
  });

  test("모바일 뷰포트 JS 크래시 없음", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const criticalErrors = jsErrors.filter(
      (e) => !e.includes("401") && !e.includes("403") && !e.includes("Network"),
    );
    expect(criticalErrors).toEqual([]);

    await page.screenshot({ path: "test-results/smoke-grades/mobile-viewport.png" });
    await context.close();
  });
});
