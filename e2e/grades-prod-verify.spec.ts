/**
 * 운영 검증: 성적 도메인 — hakwonplus.com (Tenant 1)
 * 데이터 0건 상태에서 페이지 구조, 섹션, redirect 검증
 * (실데이터 검증은 grades-real-e2e.spec.ts에서 localhost + tenant 9999로 수행 완료)
 */
import { test, expect, Page } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const TC = "hakwonplus";
const STU_USER = process.env.E2E_STUDENT_USER || "3333";
const STU_PASS = process.env.E2E_STUDENT_PASS || "test1234";

async function login(page: Page) {
  const res = await page.request.post(`${API}/api/v1/token/`, {
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TC },
    data: { username: STU_USER, password: STU_PASS, tenant_code: TC },
  });
  const tokens = await res.json();
  if (!tokens.access) throw new Error(`Login failed: ${JSON.stringify(tokens)}`);

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(
    ([a, r, c]) => {
      localStorage.setItem("access", a);
      localStorage.setItem("refresh", r);
      try { sessionStorage.setItem("tenantCode", c); } catch {}
    },
    [tokens.access, tokens.refresh, TC],
  );
  await page.goto(`${BASE}/student/dashboard`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);

  // Dismiss "업데이트가 있습니다" banner if present, then hard reload
  const updateBanner = page.locator("text=업데이트가 있습니다");
  if (await updateBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.evaluate(() => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      }
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    });
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(3000);
  }
}

test.describe.serial("운영 성적 도메인 검증 (hakwonplus.com)", () => {

  test("01 GradesPage: 성적 페이지 렌더링", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/grades-prod/01-grades-page.png", fullPage: true });

    // 페이지 타이틀 확인
    await expect(page.locator("div", { hasText: /^성적$/ }).first()).toBeVisible({ timeout: 15000 });

    // 시험 관련 콘텐츠: 탭 버튼 또는 섹션 헤더 또는 빈 상태
    const hasExamTab = await page.locator("button", { hasText: /시험 성적/ }).isVisible({ timeout: 5000 }).catch(() => false);
    const hasExamSection = await page.locator("text=시험 결과").isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyExam = await page.locator("text=/기입된 시험 결과가 없습니다|시험 결과가 아직 없습니다/").isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasExamTab || hasExamSection || hasEmptyExam).toBeTruthy();

    // 과제 관련 콘텐츠: 탭 버튼 또는 섹션 헤더 또는 빈 상태
    const hasHomeworkTab = await page.locator("button", { hasText: /과제 현황/ }).isVisible({ timeout: 3000 }).catch(() => false);
    const hasHomeworkSection = await page.locator("text=과제 이력").isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmptyHomework = await page.locator("text=/기입된 과제 성적이 없습니다|과제 성적이 아직 없습니다/").isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasHomeworkTab || hasHomeworkSection || hasEmptyHomework).toBeTruthy();
  });

  test("02 과제 영역 확인", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // 탭이 있으면 클릭, 없으면 섹션 구조
    const hasTab = await page.locator("button", { hasText: /과제 현황/ }).isVisible({ timeout: 3000 }).catch(() => false);
    if (hasTab) {
      await page.locator("button", { hasText: /과제 현황/ }).click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: "test-results/grades-prod/02-homework.png", fullPage: true });

    const hasContent = await page.locator("text=과제 목록").isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await page.locator("text=/과제 성적이 아직 없습니다|기입된 과제 성적이 없습니다/").isVisible({ timeout: 3000 }).catch(() => false);
    const hasSection = await page.locator("text=과제 이력").isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasContent || hasEmpty || hasSection).toBeTruthy();
  });

  test("03 /grades/all 경로 접근 시 크래시 없음", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/student/grades/all`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/grades-prod/03-grades-all.png" });

    // redirect 또는 정상 렌더링 (크래시 없이 처리)
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
    const bodyText = await page.locator("body").textContent();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test("04 Redirect: /grades/exams/:id → /exams/:id/result", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/student/grades/exams/1`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    expect(page.url()).toContain("/exams/1/result");
    await page.screenshot({ path: "test-results/grades-prod/04-redirect-detail.png" });
  });

  test("05 모바일 뷰포트", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/grades-prod/05-mobile.png", fullPage: true });

    // 페이지 타이틀 확인
    await expect(page.locator("div", { hasText: /^성적$/ }).first()).toBeVisible({ timeout: 15000 });
    await ctx.close();
  });
});
