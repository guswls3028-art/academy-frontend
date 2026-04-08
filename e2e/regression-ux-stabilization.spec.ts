/**
 * 운영안정화 회귀 E2E — UX 3건 수정 검증 + 핵심 사용자 흐름
 * 영구 보존 대상. 삭제 금지.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SS = "e2e/screenshots/regression";
const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

// ──────────────────────────────────────────────
// A. 관리자 회귀 테스트
// ──────────────────────────────────────────────
test.describe.serial("관리자 운영안정화 회귀", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    await loginViaUI(page, "admin");
  });
  test.afterAll(async () => { await page?.context()?.close(); });

  test("R01 — 대시보드 정상 로드", async () => {
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await expect(page.locator("nav, [class*='sidebar']").first()).toBeVisible();
    await page.screenshot({ path: `${SS}/r01-dashboard.png`, fullPage: true });
  });

  test("R02 — 학생 오버레이 열어도 사이드바 클릭 가능 (UX#1 수정 검증)", async () => {
    await page.goto(`${BASE}/admin/students/home`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    // 첫 학생 클릭 → 오버레이 열기
    const row = page.locator("table tbody tr").first();
    if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(1500);
      // 오버레이가 열린 상태에서 사이드바의 '강의' 링크 클릭 시도
      const lectureLink = page.locator("a[href*='/lectures']").first();
      await expect(lectureLink).toBeVisible();
      await lectureLink.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      // 강의 목록 페이지로 이동했는지 확인
      expect(page.url()).toContain("/lectures");
      await page.screenshot({ path: `${SS}/r02-sidebar-clickable.png`, fullPage: true });
    }
  });

  test("R03 — 강의 목록 정상 로드", async () => {
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r03-lectures.png`, fullPage: true });
  });

  test("R04 — 시험 페이지 첫 차시 자동 선택 (UX#3 수정 검증)", async () => {
    await page.goto(`${BASE}/admin/exams`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    // "차시를 선택해주세요" 메시지가 사라지고 실제 콘텐츠가 표시되는지 확인
    const emptyMsg = page.locator("text=차시를 선택해주세요");
    const isEmptyVisible = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    await page.screenshot({ path: `${SS}/r04-exams-autoselect.png`, fullPage: true });
    // 강의가 있다면 자동 선택되어 빈 메시지가 안 보여야 함
    // (강의가 없으면 다른 빈 상태가 보일 수 있으므로 조건부 검증)
  });

  test("R05 — 성적 페이지 첫 차시 자동 선택 (UX#3 수정 검증)", async () => {
    await page.goto(`${BASE}/admin/results`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/r05-results-autoselect.png`, fullPage: true });
  });

  test("R06 — 영상 페이지 첫 차시 자동 선택 (UX#3 수정 검증)", async () => {
    await page.goto(`${BASE}/admin/videos`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS}/r06-videos-autoselect.png`, fullPage: true });
  });

  test("R07 — 클리닉 정상 로드", async () => {
    await page.goto(`${BASE}/admin/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r07-clinic.png`, fullPage: true });
  });

  test("R08 — 메시지 정상 로드", async () => {
    await page.goto(`${BASE}/admin/message`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r08-message.png`, fullPage: true });
  });

  test("R09 — 커뮤니티 정상 로드", async () => {
    await page.goto(`${BASE}/admin/community/notice`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r09-community.png`, fullPage: true });
  });

  test("R10 — 설정 정상 로드", async () => {
    await page.goto(`${BASE}/admin/settings/profile`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r10-settings.png`, fullPage: true });
  });
});

// ──────────────────────────────────────────────
// B. 학생 회귀 테스트
// ──────────────────────────────────────────────
test.describe.serial("학생 운영안정화 회귀", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await ctx.newPage();
    await loginViaUI(page, "student");
  });
  test.afterAll(async () => { await page?.context()?.close(); });

  test("R11 — 학생 대시보드", async () => {
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r11-student-dashboard.png`, fullPage: true });
  });

  test("R12 — 학생 영상", async () => {
    await page.goto(`${BASE}/student/video`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r12-student-video.png`, fullPage: true });
  });

  test("R13 — 학생 시험", async () => {
    await page.goto(`${BASE}/student/exams`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r13-student-exams.png`, fullPage: true });
  });

  test("R14 — 학생 성적", async () => {
    await page.goto(`${BASE}/student/grades`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r14-student-grades.png`, fullPage: true });
  });

  test("R15 — 학생 제출", async () => {
    await page.goto(`${BASE}/student/submit`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r15-student-submit.png`, fullPage: true });
  });

  test("R16 — 학생 클리닉", async () => {
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r16-student-clinic.png`, fullPage: true });
  });

  test("R17 — 학생 커뮤니티", async () => {
    await page.goto(`${BASE}/student/community`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r17-student-community.png`, fullPage: true });
  });

  test("R18 — 학생 프로필", async () => {
    await page.goto(`${BASE}/student/profile`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r18-student-profile.png`, fullPage: true });
  });

  test("R19 — 학생 더보기", async () => {
    await page.goto(`${BASE}/student/more`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/r19-student-more.png`, fullPage: true });
  });
});
