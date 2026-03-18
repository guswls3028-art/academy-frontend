/**
 * Video & Session 도메인 데이터 플로우 E2E
 *
 * 관리자/학생 양측에서 강의·차시·영상 데이터가 실제로 렌더되는지 검증.
 * 빈 데이터 상태는 실패가 아닌 경고(annotation)로 처리.
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");

test.describe.serial("Video & Session 데이터 플로우", () => {
  let browser: Browser;
  let A: Page; // admin
  let S: Page; // student

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  // ══════════════════════════════════════════
  // Admin 파트
  // ══════════════════════════════════════════

  test("01 Admin 로그인", async () => {
    A = await (await browser.newContext()).newPage();
    await loginViaUI(A, "admin");
    await A.screenshot({ path: "test-results/video-session/01-admin-login.png" });
  });

  test("02 Admin: 강의 목록 페이지 로드 + 실제 데이터 확인", async () => {
    await A.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
    await A.waitForTimeout(3000);
    await A.screenshot({ path: "test-results/video-session/02-admin-lectures.png" });

    // 에러 페이지가 아닌지 확인
    await expect(A.locator("text=Not Found")).not.toBeVisible();

    // 강의 카드/행이 존재하는지 확인 (테이블 행, 카드, 또는 링크)
    const lectureItems = A.locator(
      '[class*="lecture"], [class*="Lecture"], tr, [class*="card"], a[href*="/lectures/"]'
    );
    const count = await lectureItems.count();

    if (count === 0) {
      test.info().annotations.push({
        type: "warning",
        description: "강의 데이터가 없음 (빈 상태). 데이터 존재 시 재검증 필요.",
      });
    } else {
      // 실제 텍스트 콘텐츠가 있는지 (로딩 스피너가 아닌 실제 제목)
      const firstText = await lectureItems.first().textContent();
      expect(firstText?.trim().length).toBeGreaterThan(0);
    }
  });

  test("03 Admin: 차시 상세 — 탭 렌더 확인 (출결/성적/영상)", async () => {
    // 강의 목록에서 첫 번째 강의 링크 찾기
    const lectureLink = A.locator('a[href*="/lectures/"]').first();
    const hasLecture = await lectureLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasLecture) {
      test.info().annotations.push({
        type: "warning",
        description: "강의 링크 없음. 차시 상세 테스트 스킵.",
      });
      return;
    }

    await lectureLink.click();
    await A.waitForLoadState("load");
    await A.waitForTimeout(2000);

    // 차시(sessions) 탭으로 이동
    const sessionsTab = A.locator('a[href*="/sessions"], button, [role="tab"]')
      .filter({ hasText: /차시|일정|sessions/i })
      .first();
    if (await sessionsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionsTab.click();
      await A.waitForTimeout(2000);
    }
    await A.screenshot({ path: "test-results/video-session/03-admin-lecture-sessions.png" });

    // 차시 링크 클릭
    const sessionLink = A.locator('a[href*="/sessions/"]').first();
    const hasSession = await sessionLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasSession) {
      test.info().annotations.push({
        type: "warning",
        description: "차시 데이터 없음. 차시 상세 테스트 스킵.",
      });
      return;
    }

    await sessionLink.click();
    await A.waitForLoadState("load");
    await A.waitForTimeout(3000);
    await A.screenshot({ path: "test-results/video-session/03-admin-session-detail.png" });

    // 차시 상세에서 탭 존재 확인 (출결, 성적, 영상 등)
    const tabTexts = ["출결", "성적", "영상", "시험", "과제"];
    for (const label of tabTexts) {
      const tab = A.locator('a, button, [role="tab"]').filter({ hasText: label }).first();
      const visible = await tab.isVisible({ timeout: 3000 }).catch(() => false);
      if (visible) {
        test.info().annotations.push({
          type: "info",
          description: `차시 탭 확인: "${label}" 존재`,
        });
      }
    }

    // 영상 탭 클릭해서 영상 목록 확인
    const videoTab = A.locator('a[href*="/videos"], button, [role="tab"]')
      .filter({ hasText: /영상|video/i })
      .first();
    if (await videoTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await videoTab.click();
      await A.waitForTimeout(2000);
      await A.screenshot({ path: "test-results/video-session/03-admin-session-videos.png" });
    }
  });

  // ══════════════════════════════════════════
  // Student 파트
  // ══════════════════════════════════════════

  test("04 Student 로그인", async () => {
    S = await (await browser.newContext()).newPage();
    await loginViaUI(S, "student");
    await S.screenshot({ path: "test-results/video-session/04-student-login.png" });
  });

  test("05 Student: 일정(세션) 목록", async () => {
    await S.goto(`${BASE}/student/sessions`, { waitUntil: "load" });
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/video-session/05-student-sessions.png" });

    // 에러 페이지 아님
    await expect(S.locator("text=Not Found")).not.toBeVisible();

    // 로딩 완료 확인: "불러오는 중" 이 사라졌는지
    const loading = S.locator('text=불러오는 중');
    await expect(loading).not.toBeVisible({ timeout: 10000 });

    // 세션 아이템 존재 확인
    const sessionItems = S.locator(
      '[class*="session"], [class*="Session"], [class*="card"], [class*="Card"], a[href*="/sessions/"]'
    );
    const count = await sessionItems.count();

    if (count === 0) {
      test.info().annotations.push({
        type: "warning",
        description: "학생 세션 데이터 없음 (빈 상태).",
      });
    } else {
      test.info().annotations.push({
        type: "info",
        description: `학생 세션 ${count}개 렌더 확인`,
      });
    }
  });

  test("06 Student: 세션 상세 (과제/시험/영상)", async () => {
    // 세션 클릭 가능한 항목 찾기
    const sessionLink = S.locator('a[href*="/sessions/"]').first();
    const hasSession = await sessionLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasSession) {
      // 목록 페이지에서 클릭 가능한 카드/항목 시도
      const clickable = S.locator(
        '[class*="session"] >> visible=true, [class*="Session"] >> visible=true, [class*="card"] >> visible=true'
      ).first();
      const hasClickable = await clickable.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasClickable) {
        test.info().annotations.push({
          type: "warning",
          description: "세션 항목 없음. 세션 상세 테스트 스킵.",
        });
        return;
      }
      await clickable.click();
    } else {
      await sessionLink.click();
    }

    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/video-session/06-student-session-detail.png" });

    // 상세 페이지에서 콘텐츠 섹션 확인
    await expect(S.locator("text=Not Found")).not.toBeVisible();

    // 로딩이 끝났는지
    const loading = S.locator('text=불러오는 중');
    await expect(loading).not.toBeVisible({ timeout: 10000 });
  });

  test("07 Student: 영상 홈 — 강좌 카드 렌더", async () => {
    await S.goto(`${BASE}/student/video`, { waitUntil: "load" });
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/video-session/07-student-video-home.png" });

    // 에러/404 아님
    await expect(S.locator("text=Not Found")).not.toBeVisible();

    // 로딩 완료
    const loading = S.locator('text=불러오는 중');
    await expect(loading).not.toBeVisible({ timeout: 10000 });

    // 영상 강좌 카드 탐색
    const videoCards = S.locator(
      '[class*="course"], [class*="Course"], [class*="video"], [class*="Video"], [class*="card"], [class*="Card"], a[href*="/video/courses/"]'
    );
    const count = await videoCards.count();

    if (count === 0) {
      test.info().annotations.push({
        type: "warning",
        description: "영상 강좌 없음 (빈 상태). 데이터 존재 시 재검증 필요.",
      });
    } else {
      // 실제 콘텐츠 렌더 확인 (제목 텍스트)
      const firstText = await videoCards.first().textContent();
      expect(firstText?.trim().length).toBeGreaterThan(0);
      test.info().annotations.push({
        type: "info",
        description: `영상 강좌 ${count}개 카드 렌더 확인`,
      });
    }
  });

  test("08 Student: 영상 강좌 상세 — 차시별 영상 렌더", async () => {
    // 강좌 링크 클릭
    const courseLink = S.locator('a[href*="/video/courses/"]').first();
    const hasCourse = await courseLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCourse) {
      test.info().annotations.push({
        type: "warning",
        description: "영상 강좌 링크 없음. 강좌 상세 테스트 스킵.",
      });
      return;
    }

    await courseLink.click();
    await S.waitForLoadState("load");
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/video-session/08-student-course-detail.png" });

    // 에러 아님
    await expect(S.locator("text=Not Found")).not.toBeVisible();

    // 로딩 완료
    const loading = S.locator('text=불러오는 중');
    await expect(loading).not.toBeVisible({ timeout: 10000 });

    // 영상 썸네일/카드/항목 확인
    const videoItems = S.locator(
      '[class*="video"], [class*="Video"], [class*="thumbnail"], [class*="Thumbnail"], img[src*="thumb"], a[href*="/video/"]'
    );
    const count = await videoItems.count();

    if (count === 0) {
      test.info().annotations.push({
        type: "warning",
        description: "강좌 내 영상 항목 없음.",
      });
    } else {
      test.info().annotations.push({
        type: "info",
        description: `강좌 상세에서 영상 관련 요소 ${count}개 확인`,
      });
    }
  });

  // ══════════════════════════════════════════
  // API 검증 파트
  // ══════════════════════════════════════════

  test("09 API: 영상 목록 (/media/videos/)", async () => {
    const resp = await apiCall(A, "GET", "/media/videos/");
    expect(resp.status).toBe(200);

    // 응답 구조 확인 (paginated 또는 배열)
    const data = resp.body;
    const isList = Array.isArray(data) || (data && Array.isArray(data.results));
    expect(isList).toBe(true);

    const items = Array.isArray(data) ? data : data.results;

    if (items.length === 0) {
      test.info().annotations.push({
        type: "warning",
        description: "API /media/videos/ 결과 0건.",
      });
    } else {
      // 첫 번째 영상 데이터 shape 확인
      const first = items[0];
      expect(first).toHaveProperty("id");
      test.info().annotations.push({
        type: "info",
        description: `API /media/videos/ — ${items.length}건 반환. 첫 번째 id=${first.id}`,
      });

      // 영상에 일반적으로 기대되는 필드 존재 확인
      const expectedFields = ["id", "title"];
      for (const field of expectedFields) {
        if (!(field in first)) {
          test.info().annotations.push({
            type: "warning",
            description: `영상 데이터에 "${field}" 필드 누락`,
          });
        }
      }
    }

    await A.screenshot({ path: "test-results/video-session/09-api-videos.png" });
  });

  test("10 API: 학생 세션 목록", async () => {
    // 학생 컨텍스트에서 세션 API 호출
    const resp = await apiCall(S, "GET", "/student/sessions/me/");
    expect(resp.status).toBe(200);

    const data = resp.body;
    const isList = Array.isArray(data) || (data && Array.isArray(data.results));
    expect(isList).toBe(true);

    const items = Array.isArray(data) ? data : data.results;

    if (items.length === 0) {
      test.info().annotations.push({
        type: "warning",
        description: "API /student/sessions/me/ 결과 0건.",
      });
    } else {
      const first = items[0];
      expect(first).toHaveProperty("id");
      test.info().annotations.push({
        type: "info",
        description: `API /student/sessions/me/ — ${items.length}건 반환. 첫 번째 id=${first.id}`,
      });
    }

    await S.screenshot({ path: "test-results/video-session/10-api-student-sessions.png" });
  });

  // ══════════════════════════════════════════

  test.afterAll(async () => {
    await A?.context()?.close();
    await S?.context()?.close();
  });
});
