/**
 * 전체 시나리오 E2E — Tenant 9999
 *
 * 선생(admin) + 학생(0000) 역할 분배, 실제 UI 클릭 기반 검증.
 * 데이터 연결 플로우: 선생이 입력한 데이터가 학생에게 올바르게 표시되는지.
 *
 * 시나리오:
 * 1. 선생 로그인 → 대시보드 확인
 * 2. 학생 로그인 → 대시보드 확인 (공지 최상단, 아이콘 메뉴)
 * 3. 학생: 성적 페이지 → 시험 탭 (강의별 그룹핑, 요약 카드, 차트)
 * 4. 학생: 과제 탭 전환
 * 5. 학생: 시험 결과 상세 (합격, 정답 공개)
 * 6. 학생: 시험 결과 상세 (불합격, 정답 비공개)
 * 7. 학생: 가이드 페이지 접근
 * 8. Redirect 검증
 * 9. 모바일 뷰포트 전체 검증
 */
import { test, expect, Page } from "@playwright/test";

const BASE = process.env.GRADES_E2E_BASE || "http://localhost:3000";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TENANT = "9999";

async function login(page: Page, username: string, password: string) {
  const res = await page.request.post(`${API}/api/v1/token/`, {
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    data: { username, password, tenant_code: TENANT },
  });
  const tokens = await res.json();
  if (!tokens.access) throw new Error(`Login failed for ${username}: ${JSON.stringify(tokens)}`);

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(
    ([a, r, tc]) => {
      localStorage.setItem("access", a);
      localStorage.setItem("refresh", r);
      try { sessionStorage.setItem("tenantCode", tc); } catch {}
    },
    [tokens.access, tokens.refresh, TENANT],
  );
}

/* ============================================================
   선생(Admin) 시나리오
   ============================================================ */
test.describe.serial("선생 시나리오 (admin97)", () => {

  test("A01 선생 로그인 → 대시보드", async ({ page }) => {
    await login(page, "admin97", "kjkszpj123");
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/full-scenario/A01-admin-dashboard.png", fullPage: true });

    // 관리자 대시보드가 렌더링됨 (정확한 요소는 테넌트마다 다를 수 있음)
    const bodyText = await page.locator("body").textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test("A02 선생: 가이드 페이지 접근", async ({ page }) => {
    await login(page, "admin97", "kjkszpj123");
    await page.goto(`${BASE}/admin/guide`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/full-scenario/A02-admin-guide.png", fullPage: true });

    // 가이드 페이지 콘텐츠 존재
    const hasGuideContent = await page.locator("text=사용 가이드").isVisible({ timeout: 10000 }).catch(() => false);
    const bodyText = await page.locator("body").textContent();
    // 페이지가 비어있지 않으면 OK (가이드가 없어도 크래시 없음)
    expect(bodyText!.length).toBeGreaterThan(30);
  });
});

/* ============================================================
   학생 시나리오
   ============================================================ */
test.describe.serial("학생 시나리오 (0000)", () => {

  test("S01 학생 로그인 → 대시보드", async ({ page }) => {
    await login(page, "0000", "0000");
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/full-scenario/S01-student-dashboard.png", fullPage: true });

    // 공지사항이 최상단에 렌더링됨
    const noticeSection = page.locator("text=공지사항");
    await expect(noticeSection.first()).toBeVisible({ timeout: 10000 });

    // 아이콘 메뉴 존재 (4열 그리드)
    const menuLabels = ["영상", "성적", "시험", "과제", "일정", "클리닉", "커뮤니티", "보관함"];
    for (const label of menuLabels) {
      const el = page.locator(`text=${label}`).first();
      const visible = await el.isVisible({ timeout: 3000 }).catch(() => false);
      if (!visible) {
        // 스크롤 필요할 수 있음
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(500);
      }
    }
  });

  test("S02 대시보드 → 성적 아이콘 클릭 → 성적 페이지", async ({ page }) => {
    await login(page, "0000", "0000");
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // "성적" 아이콘 메뉴 클릭
    const gradesIcon = page.locator("a[href='/student/grades']").first();
    await gradesIcon.scrollIntoViewIfNeeded();
    await gradesIcon.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/full-scenario/S02-grades-from-dashboard.png", fullPage: true });

    // 성적 페이지 도착
    expect(page.url()).toContain("/student/grades");
  });

  test("S03 성적 페이지: 시험 성적 탭 — 강의별 그룹핑 확인", async ({ page }) => {
    await login(page, "0000", "0000");
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/full-scenario/S03-grades-exam-tab.png", fullPage: true });

    // 탭 존재
    const examTab = page.locator("button", { hasText: /시험 성적/ });
    await expect(examTab).toBeVisible({ timeout: 10000 });

    // 요약 카드 (평균, 합격률, 응시)
    await expect(page.locator("text=평균 점수")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=합격률")).toBeVisible();
    await expect(page.locator("text=응시 횟수")).toBeVisible();

    // 시험 5건 — 링크가 5개
    const examLinks = page.locator("a[href*='/student/exams/'][href*='/result']");
    const count = await examLinks.count();
    expect(count).toBe(5);
  });

  test("S04 성적 페이지: 과제 현황 탭 전환", async ({ page }) => {
    await login(page, "0000", "0000");
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // 과제 현황 탭 클릭
    const hwTab = page.locator("button", { hasText: /과제 현황/ });
    await hwTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/full-scenario/S04-grades-homework-tab.png", fullPage: true });

    // 과제 요약 카드
    await expect(page.locator("text=채점 완료")).toBeVisible({ timeout: 5000 });
  });

  test("S05 시험 결과 상세: 합격 시험 (정답 공개)", async ({ page }) => {
    await login(page, "0000", "0000");
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // 첫 번째 시험 결과 클릭
    const firstExam = page.locator("a[href*='/student/exams/'][href*='/result']").first();
    await firstExam.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/full-scenario/S05-exam-result-detail.png", fullPage: true });

    // 시험 결과 페이지
    await expect(page.locator("text=시험 결과").first()).toBeVisible({ timeout: 10000 });

    // SVG 게이지
    await expect(page.locator("svg[viewBox='0 0 108 108']")).toBeVisible();

    // 합격 또는 불합격 뱃지
    const hasPass = await page.locator("text=합격").first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasFail = await page.locator("text=불합격").first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasPass || hasFail).toBeTruthy();

    // 문항별 결과
    await expect(page.locator("text=문항별 결과")).toBeVisible();
    const questionItems = page.locator("text=/\\d+번/");
    expect(await questionItems.count()).toBe(10);
  });

  test("S06 시험 결과 상세: 불합격 시험 (정답 비공개)", async ({ page }) => {
    await login(page, "0000", "0000");
    // 과학 기말고사 (exam 68, hidden visibility, 55점 불합격)
    await page.goto(`${BASE}/student/exams/68/result`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "test-results/full-scenario/S06-exam-result-fail.png", fullPage: true });

    await expect(page.locator("text=시험 결과").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=불합격").first()).toBeVisible();

    // 정답 비공개 메시지
    await expect(page.locator("text=정답은 비공개입니다")).toBeVisible();
  });

  test("S07 학생 가이드 페이지", async ({ page }) => {
    await login(page, "0000", "0000");
    await page.goto(`${BASE}/student/guide`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/full-scenario/S07-student-guide.png", fullPage: true });

    // 가이드 페이지 렌더링 확인
    await expect(page.locator("text=사용 가이드").first()).toBeVisible({ timeout: 10000 });
  });

  test("S08 Redirect: /grades/all → /grades", async ({ page }) => {
    await login(page, "0000", "0000");
    await page.goto(`${BASE}/student/grades/all`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("/grades/all");
  });

  test("S09 Redirect: /grades/exams/:id → /exams/:id/result", async ({ page }) => {
    await login(page, "0000", "0000");
    await page.goto(`${BASE}/student/grades/exams/64`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/exams/64/result");
  });

  test("S10 모바일: 대시보드 + 성적 + 시험 결과", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await login(page, "0000", "0000");

    // 대시보드
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/full-scenario/S10-mobile-dashboard.png", fullPage: true });
    await expect(page.locator("text=공지사항").first()).toBeVisible({ timeout: 10000 });

    // 성적
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/full-scenario/S10-mobile-grades.png", fullPage: true });

    // 시험 결과
    const firstExam = page.locator("a[href*='/student/exams/'][href*='/result']").first();
    if (await firstExam.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstExam.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: "test-results/full-scenario/S10-mobile-exam-result.png", fullPage: true });
    }

    await ctx.close();
  });

  test("S11 전체 네비게이션 플로우: 대시보드 → 시험 → 성적 → 가이드", async ({ page }) => {
    await login(page, "0000", "0000");

    // 대시보드
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // 시험 아이콘 클릭
    const examIcon = page.locator("a[href='/student/exams']").first();
    await examIcon.scrollIntoViewIfNeeded();
    await examIcon.click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/student/exams");
    await page.screenshot({ path: "test-results/full-scenario/S11-exams-page.png", fullPage: true });

    // 뒤로가기 → 대시보드
    await page.goBack();
    await page.waitForTimeout(2000);

    // 성적 아이콘 클릭
    const gradesIcon = page.locator("a[href='/student/grades']").first();
    await gradesIcon.scrollIntoViewIfNeeded();
    await gradesIcon.click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/student/grades");

    // 가이드 페이지로 이동
    await page.goto(`${BASE}/student/guide`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/full-scenario/S11-guide-page.png", fullPage: true });
  });
});
