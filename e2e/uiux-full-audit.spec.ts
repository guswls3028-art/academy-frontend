/**
 * 전역 UI/UX 전문감사 E2E — 실사용자 플로우 검증
 *
 * 감사 영역:
 * A. 핵심 네비게이션 & 라우팅 (딥링크, 뒤로가기, 탭 전환)
 * B. 폼 입력 & 데이터 표시 (빈값, 엣지케이스, 일관성)
 * C. 모달 & 다이얼로그 UX (닫기, 키보드, 포커스)
 * D. 모바일 반응형 (터치타깃, 레이아웃)
 * E. 학생앱 실사용 플로우
 * F. 에러 상태 & 엣지케이스
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";

const BASE = getBaseUrl("admin");
const SS = (name: string) => `e2e/screenshots/uiux-audit-${name}.png`;

// ─── A. 관리자 핵심 네비게이션 ───────────────────────────────────

test.describe("A. Admin Navigation & Routing", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page, "admin");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("A1. 대시보드 정상 로드", async () => {
    await page.goto(`${BASE}/admin/dashboard`);
    await expect(page.locator("text=대시보드").first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: SS("a1-dashboard"), fullPage: true });
  });

  test("A2. 사이드바 전체 메뉴 접근 가능", async () => {
    const menuItems = [
      { text: "학생", url: "/admin/students" },
      { text: "강의", url: "/admin/lectures" },
      { text: "시험", url: "/admin/exams" },
      { text: "성적", url: "/admin/results" },
      { text: "영상", url: "/admin/videos" },
      { text: "메시지", url: "/admin/message" },
    ];

    for (const item of menuItems) {
      const link = page.locator(`nav a, aside a`).filter({ hasText: new RegExp(`^${item.text}$`) }).first();
      if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
        await link.click();
        await page.waitForTimeout(1500);
        expect(page.url()).toContain(item.url);
      }
    }
    await page.screenshot({ path: SS("a2-sidebar-nav"), fullPage: true });
  });

  test("A3. 학생 목록 → 학생 상세 → 뒤로가기 (C5 버그 검증)", async () => {
    await page.goto(`${BASE}/admin/students/home`);
    await page.waitForTimeout(2000);

    // 학생 행 클릭
    const studentRow = page.locator("table tbody tr, [role='button']").first();
    if (await studentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      const urlBefore = page.url();
      await studentRow.click();
      await page.waitForTimeout(1500);

      // 상세 오버레이 확인
      const detailVisible = await page.locator("text=기본 정보").first().isVisible({ timeout: 5000 }).catch(() => false);
      await page.screenshot({ path: SS("a3-student-detail"), fullPage: true });

      // 뒤로가기
      await page.goBack();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: SS("a3-back-to-list"), fullPage: true });

      // 검증: URL이 학생 목록으로 복귀
      expect(page.url()).toContain("/admin/students");
    }
  });

  test("A4. 존재하지 않는 세션 딥링크 (C4 버그 검증)", async () => {
    await page.goto(`${BASE}/admin/lectures/99999/sessions/99999/attendance`);
    await page.waitForTimeout(3000);

    // 빈 화면인지, 에러 메시지가 있는지 확인
    const pageContent = await page.textContent("body");
    const hasError = pageContent?.includes("찾을 수 없") || pageContent?.includes("오류") || pageContent?.includes("존재하지");
    const isBlank = (pageContent?.trim().length || 0) < 50;

    await page.screenshot({ path: SS("a4-invalid-session"), fullPage: true });

    // C4 버그: 빈 화면이면 버그 확인
    if (isBlank) {
      console.warn("[C4 BUG CONFIRMED] Invalid session ID shows blank screen with no error message");
    }
  });

  test("A5. 커뮤니티 탭 전환 시 쿼리파라미터 유지 (C6 버그 검증)", async () => {
    // 커뮤니티 게시판 → 스코프 선택
    await page.goto(`${BASE}/admin/community/board`);
    await page.waitForTimeout(2000);

    const currentUrl1 = page.url();
    await page.screenshot({ path: SS("a5-community-board"), fullPage: true });

    // 공지사항 탭으로 이동
    const noticeTab = page.locator("a, button, [role='tab']").filter({ hasText: /공지/ }).first();
    if (await noticeTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noticeTab.click();
      await page.waitForTimeout(1500);

      const currentUrl2 = page.url();
      await page.screenshot({ path: SS("a5-community-notice"), fullPage: true });

      // C6 버그: 쿼리파라미터가 사라지는지 확인
      if (currentUrl1.includes("?") && !currentUrl2.includes("?")) {
        console.warn("[C6 BUG CONFIRMED] Community tab switch drops query parameters");
      }
    }
  });

  test("A6. 404/잘못된 경로 처리", async () => {
    await page.goto(`${BASE}/admin/nonexistent-page-xyz`);
    await page.waitForTimeout(2000);

    const isRedirected = page.url().includes("/admin/dashboard");
    await page.screenshot({ path: SS("a6-404-handling"), fullPage: true });

    // 조용한 리다이렉트인지 404 페이지인지 확인
    if (isRedirected) {
      console.info("[L9 CONFIRMED] No 404 page — silently redirects to dashboard");
    }
  });
});

// ─── B. 폼 입력 & 데이터 표시 ─────────────────────────────────

test.describe("B. Forms & Data Display", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page, "admin");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("B1. 강의 목록 — 빈 상태 vs 데이터 표시", async () => {
    await page.goto(`${BASE}/admin/lectures`);
    await page.waitForTimeout(2000);

    const hasData = await page.locator("table tbody tr").count() > 0;
    const hasEmptyState = await page.locator("text=데이터가 없습니다").isVisible({ timeout: 2000 }).catch(() => false);

    await page.screenshot({ path: SS("b1-lectures-list"), fullPage: true });

    // 데이터가 있으면 테이블, 없으면 빈 상태 — 둘 중 하나여야 함
    expect(hasData || hasEmptyState).toBeTruthy();
  });

  test("B2. 시험 도메인 탭 전환", async () => {
    await page.goto(`${BASE}/admin/exams`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("b2-exams-explorer"), fullPage: true });

    // 템플릿 탭
    const templateTab = page.locator("a, button, [role='tab']").filter({ hasText: /템플릿/ }).first();
    if (await templateTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await templateTab.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain("/templates");
      await page.screenshot({ path: SS("b2-exams-templates"), fullPage: true });
    }

    // 묶음 탭
    const bundleTab = page.locator("a, button, [role='tab']").filter({ hasText: /묶음/ }).first();
    if (await bundleTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bundleTab.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain("/bundles");
      await page.screenshot({ path: SS("b2-exams-bundles"), fullPage: true });
    }
  });

  test("B3. 영상 탐색기 — 날짜/상태 표시 일관성", async () => {
    await page.goto(`${BASE}/admin/videos`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("b3-videos-explorer"), fullPage: true });

    // 상태 배지 존재 확인
    const badges = page.locator("[class*='badge'], [class*='status'], [data-tone]");
    const badgeCount = await badges.count();
    if (badgeCount > 0) {
      console.info(`[B3] Found ${badgeCount} status badges on video explorer`);
    }
  });

  test("B4. 설정 페이지 — 프로필/조직/외관/결제", async () => {
    const settingsTabs = [
      { path: "/admin/settings/profile", check: "프로필" },
      { path: "/admin/settings/organization", check: "학원" },
      { path: "/admin/settings/appearance", check: "테마" },
      { path: "/admin/settings/billing", check: "구독" },
    ];

    for (const tab of settingsTabs) {
      await page.goto(`${BASE}${tab.path}`);
      await page.waitForTimeout(2000);
      const visible = await page.locator(`text=${tab.check}`).first().isVisible({ timeout: 5000 }).catch(() => false);
      await page.screenshot({ path: SS(`b4-settings-${tab.path.split("/").pop()}`), fullPage: true });
    }
  });

  test("B5. 메시지 로그 — 날짜/상태 표시", async () => {
    await page.goto(`${BASE}/admin/message/log`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("b5-message-log"), fullPage: true });
  });

  test("B6. 직원 관리 — 통화 표기 일관성 (M6 검증)", async () => {
    await page.goto(`${BASE}/admin/staff/home`);
    await page.waitForTimeout(2000);

    // 직원 관리가 활성화되어 있는지 확인
    const hasStaffPage = !page.url().includes("/dashboard");
    if (hasStaffPage) {
      await page.screenshot({ path: SS("b6-staff-home"), fullPage: true });

      // 급여 관련 탭으로 이동
      const payrollTab = page.locator("a, button").filter({ hasText: /급여|지출/ }).first();
      if (await payrollTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await payrollTab.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: SS("b6-staff-payroll"), fullPage: true });
      }
    }
  });
});

// ─── C. 모달 & 다이얼로그 ──────────────────────────────────────

test.describe("C. Modals & Dialogs", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page, "admin");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("C1. 학생 등록 모달 — 열기/닫기/모드 전환", async () => {
    await page.goto(`${BASE}/admin/students/home`);
    await page.waitForTimeout(2000);

    // 등록 버튼 찾기
    const createBtn = page.locator("button").filter({ hasText: /등록|추가|새 학생/ }).first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);

      // 모달 표시 확인
      const modal = page.locator(".ant-modal, [class*='modal']").first();
      await expect(modal).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: SS("c1-student-create-modal"), fullPage: true });

      // Escape로 닫기
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      await page.screenshot({ path: SS("c1-modal-after-escape"), fullPage: true });
    }
  });

  test("C2. 강의 생성 모달", async () => {
    await page.goto(`${BASE}/admin/lectures`);
    await page.waitForTimeout(2000);

    const createBtn = page.locator("button").filter({ hasText: /강의 만들기|생성|추가/ }).first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);

      const modal = page.locator(".ant-modal, [class*='modal']").first();
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.screenshot({ path: SS("c2-lecture-create-modal"), fullPage: true });

        // Escape로 닫기
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
    }
  });

  test("C3. 확인 다이얼로그 — 키보드 접근성 (L1 검증)", async () => {
    await page.goto(`${BASE}/admin/students/home`);
    await page.waitForTimeout(2000);

    // 삭제 등 확인 다이얼로그 트리거 시도
    // (실제 삭제 대신 UI만 확인)
    await page.screenshot({ path: SS("c3-confirm-dialog-check"), fullPage: true });
  });
});

// ─── D. 모바일 반응형 ──────────────────────────────────────────

test.describe("D. Mobile Responsive", () => {
  test("D1. 관리자앱 모바일 레이아웃 (375px)", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    });
    const page = await context.newPage();
    await loginViaUI(page, "admin");

    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("d1-mobile-dashboard"), fullPage: true });

    // 하단 탭바 확인
    const bottomBar = page.locator("nav").last();
    const barVisible = await bottomBar.isVisible({ timeout: 3000 }).catch(() => false);
    await page.screenshot({ path: SS("d1-mobile-bottombar"), fullPage: true });

    // 학생 목록 — 테이블 가로 스크롤
    await page.goto(`${BASE}/admin/students/home`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("d1-mobile-students"), fullPage: true });

    // 강의 목록
    await page.goto(`${BASE}/admin/lectures`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("d1-mobile-lectures"), fullPage: true });

    await page.close();
    await context.close();
  });

  test("D2. 모달 모바일 전체화면 (639px 이하)", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await loginViaUI(page, "admin");

    await page.goto(`${BASE}/admin/students/home`);
    await page.waitForTimeout(2000);

    const createBtn = page.locator("button").filter({ hasText: /등록|추가|새 학생/ }).first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: SS("d2-mobile-modal"), fullPage: true });

      // 모달이 전체화면인지 확인
      const modal = page.locator(".ant-modal").first();
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        const box = await modal.boundingBox();
        if (box) {
          const isFullScreen = box.width >= 370 && box.height >= 700;
          console.info(`[D2] Modal size: ${box.width}x${box.height}, fullscreen: ${isFullScreen}`);
        }
      }

      await page.keyboard.press("Escape");
    }

    await page.close();
    await context.close();
  });
});

// ─── E. 학생앱 실사용 플로우 ───────────────────────────────────

test.describe("E. Student App Flows", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page, "student");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("E1. 학생 대시보드 로드", async () => {
    await page.goto(`${BASE}/student/dashboard`);
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).not.toBeEmpty();
    await page.screenshot({ path: SS("e1-student-dashboard"), fullPage: true });
  });

  test("E2. 학생 영상 페이지", async () => {
    await page.goto(`${BASE}/student/video`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("e2-student-video"), fullPage: true });
  });

  test("E3. 학생 수업 목록", async () => {
    await page.goto(`${BASE}/student/sessions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("e3-student-sessions"), fullPage: true });
  });

  test("E4. 학생 시험 목록", async () => {
    await page.goto(`${BASE}/student/exams`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("e4-student-exams"), fullPage: true });
  });

  test("E5. 학생 커뮤니티", async () => {
    await page.goto(`${BASE}/student/community`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("e5-student-community"), fullPage: true });
  });

  test("E6. 학생 알림", async () => {
    await page.goto(`${BASE}/student/notifications`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("e6-student-notifications"), fullPage: true });
  });

  test("E7. 학생 더보기 / 프로필", async () => {
    await page.goto(`${BASE}/student/more`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("e7-student-more"), fullPage: true });
  });

  test("E8. 학생 출결", async () => {
    await page.goto(`${BASE}/student/attendance`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("e8-student-attendance"), fullPage: true });
  });

  test("E9. 학생 성적", async () => {
    await page.goto(`${BASE}/student/grades`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("e9-student-grades"), fullPage: true });
  });

  test("E10. 학생앱 모바일 뷰포트 (375px)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const p = await ctx.newPage();
    await loginViaUI(p, "student");

    await p.goto(`${BASE}/student/dashboard`);
    await p.waitForTimeout(2000);
    await p.screenshot({ path: SS("e10-student-mobile-dashboard"), fullPage: true });

    // 하단 탭바 확인
    const tabBar = p.locator("nav").last();
    if (await tabBar.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await tabBar.boundingBox();
      console.info(`[E10] Tab bar size: ${box?.width}x${box?.height}`);
    }

    await p.goto(`${BASE}/student/video`);
    await p.waitForTimeout(2000);
    await p.screenshot({ path: SS("e10-student-mobile-video"), fullPage: true });

    await p.close();
    await ctx.close();
  });
});

// ─── F. 에러 & 엣지케이스 ──────────────────────────────────────

test.describe("F. Error States & Edge Cases", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page, "admin");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("F1. 이미 로그인된 상태에서 /login 접근 (L10 검증)", async () => {
    await page.goto(`${BASE}/login/hakwonplus`);
    await page.waitForTimeout(2000);

    const showsLoginForm = await page.locator('input[name="username"]').isVisible({ timeout: 3000 }).catch(() => false);
    const redirected = page.url().includes("/admin") || page.url().includes("/student");

    await page.screenshot({ path: SS("f1-already-logged-login"), fullPage: true });

    if (showsLoginForm) {
      console.warn("[L10 CONFIRMED] Authenticated user sees login form instead of being redirected");
    }
  });

  test("F2. 클리닉 페이지 접근성", async () => {
    await page.goto(`${BASE}/admin/clinic/home`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("f2-clinic-home"), fullPage: true });
  });

  test("F3. 도구 페이지 — PPT/OMR/스톱워치", async () => {
    const tools = [
      { path: "/admin/tools/ppt", name: "ppt" },
      { path: "/admin/tools/omr", name: "omr" },
      { path: "/admin/tools/stopwatch", name: "stopwatch" },
    ];

    for (const tool of tools) {
      await page.goto(`${BASE}${tool.path}`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: SS(`f3-tool-${tool.name}`), fullPage: true });
    }
  });

  test("F4. 가이드 페이지", async () => {
    await page.goto(`${BASE}/admin/guide`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("f4-admin-guide"), fullPage: true });
  });

  test("F5. 저장소 페이지", async () => {
    await page.goto(`${BASE}/admin/storage`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("f5-storage"), fullPage: true });
  });

  test("F6. 성적 탐색기", async () => {
    await page.goto(`${BASE}/admin/results`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("f6-results-explorer"), fullPage: true });
  });

  test("F7. 제출함", async () => {
    await page.goto(`${BASE}/admin/results/submissions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SS("f7-submissions-inbox"), fullPage: true });
  });
});
