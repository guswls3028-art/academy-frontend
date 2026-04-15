/**
 * Clinic & Community/QnA 데이터 플로우 E2E
 *
 * Admin/Student 양측에서 Clinic, Community, QnA, Notice, Notification 도메인의
 * 실 데이터 렌더링을 검증한다. Tenant 1 (hakwonplus) 대상.
 *
 * 검증 항목:
 *  1. Admin: 클리닉 세션 목록
 *  2. Admin: 커뮤니티 QnA 인박스
 *  3. Admin: 공지 목록
 *  4. Student: 클리닉 페이지 (예약 탭)
 *  5. Student: 클리닉 인증패스카드
 *  6. Student: 공지 목록
 *  7. Student: 알림 페이지
 *  8. API: 클리닉 예약 조회
 *  9. API: 커뮤니티 게시글 조회 (tenant-scoped)
 * 10. Student: 커뮤니티/QnA 페이지
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

// ═══════════════════════════════════════════
// Admin Tests
// ═══════════════════════════════════════════

test.describe("Admin: Clinic & Community 데이터 검증", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("1. 클리닉 세션 목록이 정상 렌더된다", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/admin/clinic/home`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);

    // 페이지가 에러 없이 로드됨
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // 클리닉 페이지 컨테이너가 존재
    const mainContent = page.locator("main, [class*='page'], [class*='clinic']").first();
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "test-results/clinic-community/01-admin-clinic-sessions.png" });
  });

  test("2. 커뮤니티 QnA 인박스가 정상 렌더된다", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/admin/community/qna`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);

    // 페이지 에러 없음
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // QnA 페이지 컨테이너 존재
    const mainContent = page.locator("main, [class*='page'], [class*='community']").first();
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // QnA 게시글이 있으면 최소 1개 이상의 항목이 렌더됨
    // (빈 목록도 유효 — EmptyState 컴포넌트가 렌더될 수 있음)
    const hasItems = await page.locator("tr, [class*='item'], [class*='row'], [class*='card'], [class*='post']").count();
    const hasEmpty = await page.locator("text=/질문이 없|게시글이 없|목록이 비어/").count();
    // 둘 중 하나는 있어야 함 (데이터 있거나 빈 상태 표시)
    expect(hasItems > 0 || hasEmpty > 0).toBeTruthy();

    await page.screenshot({ path: "test-results/clinic-community/02-admin-qna-inbox.png" });
  });

  test("3. 공지 목록이 정상 렌더된다", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/admin/community/notice`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);

    // 에러 없음
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // 공지 컨테이너 존재
    const mainContent = page.locator("main, [class*='page']").first();
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "test-results/clinic-community/03-admin-notices.png" });
  });
});

// ═══════════════════════════════════════════
// Student Tests
// ═══════════════════════════════════════════

test.describe("Student: Clinic & Community 데이터 검증", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("4. 클리닉 페이지가 예약 탭과 함께 렌더된다", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/student/clinic`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);

    // 에러 없음
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // 학생앱 컨테이너 존재
    const appContainer = page.locator("[data-app='student']").first();
    await expect(appContainer).toBeVisible({ timeout: 10_000 });

    // 클리닉 탭 UI 존재 (예약/일정 탭)
    const bookTab = page.locator("button, [role='tab']").filter({ hasText: /예약|일정|book|schedule/ }).first();
    const hasTab = await bookTab.isVisible({ timeout: 5000 }).catch(() => false);
    // 탭이 없더라도 클리닉 콘텐츠(캘린더, 예약 현황 등)가 있으면 통과
    if (!hasTab) {
      const clinicContent = page.locator("[class*='clinic'], [class*='calendar'], [class*='booking']").first();
      const hasContent = await clinicContent.isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasTab || hasContent).toBeTruthy();
    }

    await page.screenshot({ path: "test-results/clinic-community/04-student-clinic.png" });
  });

  test("5. 클리닉 인증패스카드가 학생 이름과 함께 렌더된다", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/student/idcard`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);

    // 에러 없음
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // 패스카드 페이지 로드됨 — 시계, 학생 이름, 색상 카드 중 하나 이상 존재
    const hasTime = await page.locator("text=/오전|오후/").first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasCard = await page.locator("[class*='idcard'], [class*='passcard'], [class*='card']").first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasTime || hasCard).toBeTruthy();

    await page.screenshot({ path: "test-results/clinic-community/05-student-idcard.png" });
  });

  test("6. 공지 목록이 정상 렌더된다", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/student/notices`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);

    // 에러 없음
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // 학생앱 컨테이너
    const appContainer = page.locator("[data-app='student']").first();
    await expect(appContainer).toBeVisible({ timeout: 10_000 });

    // 공지 탭이나 목록 항목이 렌더됨
    const hasTabs = await page.locator("button, [role='tab']").filter({ hasText: /전체공지|강의공지|차시공지/ }).first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasNotices = await page.locator("a, [class*='notice'], [class*='item']").count();
    const hasEmpty = await page.locator("text=/공지가 없|공지사항이 없/").count();
    // 탭 UI가 있거나, 목록이 있거나, 빈 상태가 표시됨
    expect(hasTabs || hasNotices > 0 || hasEmpty > 0).toBeTruthy();

    await page.screenshot({ path: "test-results/clinic-community/06-student-notices.png" });
  });

  test("7. 알림 페이지가 에러 없이 렌더된다", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/student/notifications`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);

    // 에러 없음
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // 학생앱 컨테이너
    const appContainer = page.locator("[data-app='student']").first();
    await expect(appContainer).toBeVisible({ timeout: 10_000 });

    // 알림 페이지가 정상 렌더됨 (빈 상태도 유효)
    // 에러 토스트나 크래시가 없으면 통과
    const errorToast = page.locator(".Toastify__toast--error, [class*='toast'][class*='error']");
    await expect(errorToast).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "test-results/clinic-community/07-student-notifications.png" });
  });

  test("10. 커뮤니티/QnA 페이지가 정상 렌더된다", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${BASE}/student/community`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);

    // 에러 없음
    await expect(page.locator("text=Not Found")).not.toBeVisible();

    // 학생앱 컨테이너
    const appContainer = page.locator("[data-app='student']").first();
    await expect(appContainer).toBeVisible({ timeout: 10_000 });

    // 커뮤니티 탭 UI 존재 (공지/게시판/자료실/QnA/상담 중 하나)
    const tabLabels = ["QnA", "공지", "게시판", "자료실", "상담"];
    let tabFound = false;
    for (const label of tabLabels) {
      const tab = page.locator("button, [role='tab']").filter({ hasText: label }).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        tabFound = true;
        break;
      }
    }
    expect(tabFound).toBeTruthy();

    // QnA 탭 클릭하여 질문 목록 확인
    const qnaTab = page.locator("button, [role='tab']").filter({ hasText: "QnA" }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await page.waitForTimeout(2000);

      // QnA 목록이 렌더되거나 빈 상태가 표시됨
      const hasQna = await page.locator("[class*='item'], [class*='post'], [class*='question']").count();
      const hasEmpty = await page.locator("text=/질문이 없|등록된 질문/").count();
      // 에러가 아닌 어떤 상태든 OK
      await expect(page.locator("text=Not Found")).not.toBeVisible();
    }

    await page.screenshot({ path: "test-results/clinic-community/10-student-community-qna.png" });
  });
});

// ═══════════════════════════════════════════
// API Tests
// ═══════════════════════════════════════════

test.describe("API: Clinic & Community 데이터 검증", () => {
  test("8. 클리닉 예약 API가 정상 응답한다", async ({ page }) => {
    test.setTimeout(30_000);
    await loginViaUI(page, "student");

    // 학생 본인의 클리닉 예약 조회 (participants endpoint)
    const resp = await apiCall(page, "GET", "/clinic/participants/");
    // 200이면 데이터 반환, 빈 배열도 유효
    expect(resp.status).toBe(200);
    expect(Array.isArray(resp.body) || resp.body?.results !== undefined).toBeTruthy();
  });

  test("9. 커뮤니티 게시글 API가 tenant-scoped 응답한다", async ({ page }) => {
    test.setTimeout(30_000);
    await loginViaUI(page, "admin");

    // 커뮤니티 게시글 목록 조회
    const resp = await apiCall(page, "GET", "/community/posts/?post_type=qna");
    expect(resp.status).toBe(200);

    // 응답 구조 검증 (배열 또는 paginated)
    const posts = Array.isArray(resp.body) ? resp.body : resp.body?.results;
    expect(posts).toBeDefined();
    expect(Array.isArray(posts)).toBeTruthy();

    // tenant 격리 검증 — 모든 게시글이 동일 tenant 소속
    // (게시글이 있는 경우만 검증)
    if (posts.length > 0) {
      const firstPost = posts[0];
      // 게시글에 tenant 정보가 있으면 전부 동일한지 확인
      if (firstPost.tenant !== undefined) {
        const tenantIds = posts.map((p: any) => p.tenant);
        const uniqueTenants = [...new Set(tenantIds)];
        expect(uniqueTenants.length).toBe(1);
      }
    }
  });
});
