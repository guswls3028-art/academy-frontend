/**
 * 성적 도메인 실데이터 E2E — Tenant 9999
 * 실제 API 연결 + 인증 + 데이터 검증
 */
import { test, expect, Page } from "@playwright/test";

const BASE = process.env.GRADES_E2E_BASE || "http://localhost:3000";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TENANT = "9999";
const STU_USER = "01099990001";
const STU_PASS = "test1234";

async function loginStudent(page: Page) {
  const res = await page.request.post(`${API}/api/v1/token/`, {
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    data: { username: STU_USER, password: STU_PASS, tenant_code: TENANT },
  });
  const tokens = await res.json();
  if (!tokens.access) throw new Error(`Login failed: ${JSON.stringify(tokens)}`);

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([access, refresh, tc]) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      sessionStorage.setItem("tenantCode", tc);
    },
    [tokens.access, tokens.refresh, TENANT],
  );
}

test.describe.serial("성적 도메인 실데이터 E2E (Tenant 9999)", () => {

  test("01 GradesPage: 시험 성적 탭 — 요약 + 차트 + 목록", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/grades-real/01-exam-tab.png", fullPage: true });

    // 탭
    await expect(page.locator("button", { hasText: /시험 성적/ })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("button", { hasText: /과제 현황/ })).toBeVisible();

    // 요약 카드
    await expect(page.locator("text=평균 점수")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=합격률")).toBeVisible();
    await expect(page.locator("text=응시 횟수")).toBeVisible();

    // 추이 차트 (3건이므로 표시)
    await expect(page.locator("text=점수 추이")).toBeVisible();

    // 시험 목록
    await expect(page.locator("text=시험 결과")).toBeVisible();
    const examLinks = page.locator("a[href*='/student/exams/'][href*='/result']");
    expect(await examLinks.count()).toBeGreaterThanOrEqual(2);
  });

  test("02 GradesPage: 과제 현황 탭 — 요약 + 목록", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    await page.locator("button", { hasText: /과제 현황/ }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/grades-real/02-homework-tab.png", fullPage: true });

    await expect(page.locator("text=채점 완료")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=과제 목록")).toBeVisible();
  });

  test("03 ExamResultPage: 합격 — 게이지 + 정답 공개", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Math Test 클릭
    const mathLink = page.locator("a[href*='/result']", { hasText: /Math/ });
    if (await mathLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mathLink.click();
    } else {
      // Fallback: exam 57 직접 이동
      await page.goto(`${BASE}/student/exams/57/result`, { waitUntil: "domcontentloaded" });
    }
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/grades-real/03-exam-pass.png", fullPage: true });

    await expect(page.locator("text=시험 결과").first()).toBeVisible({ timeout: 15000 });

    // 점수 게이지 SVG (108x108 viewBox)
    await expect(page.locator("svg[viewBox='0 0 108 108']")).toBeVisible();

    // 합격
    await expect(page.locator("text=합격").first()).toBeVisible();

    // 문항별 결과
    await expect(page.locator("text=문항별 결과")).toBeVisible();

    // 정답 공개 (always)
    const correctAnswerVisible = await page.locator("text=/정답:/").count();
    expect(correctAnswerVisible).toBeGreaterThan(0);
  });

  test("04 ExamResultPage: 불합격 — 정답 비공개", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE}/student/exams/59/result`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/grades-real/04-exam-fail.png", fullPage: true });

    await expect(page.locator("text=시험 결과").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=불합격").first()).toBeVisible();

    // 정답 비공개
    await expect(page.locator("text=정답은 비공개입니다")).toBeVisible();
    const correctAnswerCount = await page.locator("text=/· 정답:/").count();
    expect(correctAnswerCount).toBe(0);
  });

  test("05 Redirect: /grades/all → /grades", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE}/student/grades/all`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    expect(page.url()).not.toContain("/grades/all");
    await expect(page.locator("button", { hasText: /시험 성적/ })).toBeVisible({ timeout: 10000 });
  });

  test("06 Redirect: /grades/exams/:id → /exams/:id/result", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE}/student/grades/exams/57`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    expect(page.url()).toContain("/exams/57/result");
  });

  test("07 모바일 뷰포트", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await loginStudent(page);
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/grades-real/07-mobile.png", fullPage: true });

    await expect(page.locator("button", { hasText: /시험 성적/ })).toBeVisible({ timeout: 15000 });
    await ctx.close();
  });
});
