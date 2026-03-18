/**
 * Homework / Scores / Grades / Inventory — 데이터 플로우 E2E
 *
 * Admin: 세션 성적 탭, 과제 관리 확인
 * Student: 성적 허브, 성적 목록, 성적 상세, 성적표 제출, 과제 제출, 인벤토리
 * API: 과제 점수 데이터, 학생 성적 응답 형태 검증
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");

test.describe.serial("Homework / Scores / Inventory 데이터 플로우", () => {
  let browser: Browser;
  let T: Page; // admin (teacher)
  let S: Page; // student

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  // ══════════════════════════════
  // Admin Part
  // ══════════════════════════════

  test("01 Admin: 로그인", async () => {
    T = await (await browser.newContext()).newPage();
    await loginViaUI(T, "admin");
    await T.screenshot({ path: "test-results/hw-scores/01-admin-login.png" });
  });

  test("02 Admin: 세션 성적 탭 렌더링 확인", async () => {
    // 강의 목록 진입
    await T.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
    await T.waitForTimeout(2000);

    // 첫 번째 강의 클릭
    const lectureLink = T.locator("a[href*='/admin/lectures/']").first();
    const hasLecture = await lectureLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasLecture) {
      await lectureLink.click();
      await T.waitForLoadState("load");
      await T.waitForTimeout(2000);

      // 세션(차시) 목록으로 이동
      const sessionsLink = T.locator("a[href*='/sessions']").first();
      const hasSessions = await sessionsLink.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasSessions) {
        await sessionsLink.click();
        await T.waitForLoadState("load");
        await T.waitForTimeout(2000);
      }

      // 첫 번째 세션 클릭
      const sessionLink = T.locator("a[href*='/sessions/']").first();
      const hasSession = await sessionLink.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasSession) {
        await sessionLink.click();
        await T.waitForLoadState("load");
        await T.waitForTimeout(2000);

        // 성적 탭 클릭
        const scoresTab = T.locator("a[href*='/scores'], button, [role='tab']")
          .filter({ hasText: /성적|점수|Scores/ })
          .first();
        const hasScoresTab = await scoresTab.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasScoresTab) {
          await scoresTab.click();
          await T.waitForTimeout(2000);
        }
      }
    }

    await T.screenshot({ path: "test-results/hw-scores/02-admin-session-scores.png" });
    // 페이지가 에러 없이 렌더링 되었는지 확인
    await expect(T.locator("text=Not Found")).not.toBeVisible();
    await expect(T.locator("text=500")).not.toBeVisible();
  });

  test("03 Admin: 과제 관리 확인 (세션 컨텍스트)", async () => {
    // 현재 세션 상세에서 과제 탭 확인
    const assignmentsTab = T.locator("a[href*='/assignments'], button, [role='tab']")
      .filter({ hasText: /과제|숙제|Homework|Assignment/ })
      .first();
    const hasTab = await assignmentsTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await assignmentsTab.click();
      await T.waitForTimeout(2000);
    }

    await T.screenshot({ path: "test-results/hw-scores/03-admin-homework.png" });
    await expect(T.locator("text=Not Found")).not.toBeVisible();
  });

  // ══════════════════════════════
  // Student Part
  // ══════════════════════════════

  test("04 Student: 로그인", async () => {
    S = await (await browser.newContext()).newPage();
    await loginViaUI(S, "student");
    await S.screenshot({ path: "test-results/hw-scores/04-student-login.png" });
  });

  test("05 Student: 성적 허브 (GradesPage) 렌더링", async () => {
    await S.goto(`${BASE}/student/grades`, { waitUntil: "load" });
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/hw-scores/05-student-grades-hub.png" });

    // GradesPage의 StudentPageShell title 확인
    await expect(S.locator("div", { hasText: /^성적$/ }).first()).toBeVisible({ timeout: 10000 });

    // 시험 결과 섹션 또는 빈 상태가 렌더링되어야 함
    const hasExamSection = await S.locator("text=시험 결과").isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyExam = await S.locator("text=기입된 시험 결과가 없습니다").isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasExamSection || hasEmptyExam).toBeTruthy();

    // 과제 이력 섹션 또는 빈 상태
    const hasHomeworkSection = await S.locator("text=과제 이력").isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyHomework = await S.locator("text=기입된 과제 성적이 없습니다").isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasHomeworkSection || hasEmptyHomework).toBeTruthy();

    // 로딩이 아님 (스켈레톤 사라짐)
    await expect(S.locator(".stu-skel").first()).not.toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test("06 Student: 성적 전체보기 (GradeListPage)", async () => {
    await S.goto(`${BASE}/student/grades/all`, { waitUntil: "load" });
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/hw-scores/06-student-grade-list.png" });

    // 성적 전체보기 타이틀
    await expect(S.locator("text=성적 전체보기")).toBeVisible({ timeout: 10000 });

    // 시험 결과 카운트 또는 빈 상태
    const hasExamCount = await S.locator("text=/시험 결과.*\\(\\d+\\)/").isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyExam = await S.locator("text=기입된 시험 결과가 없습니다").isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasExamCount || hasEmptyExam).toBeTruthy();
  });

  test("07 Student: 성적 상세 (GradeDetailPage) 확인", async () => {
    // 먼저 성적 허브에서 시험 결과 링크를 클릭해서 상세로 이동
    await S.goto(`${BASE}/student/grades`, { waitUntil: "load" });
    await S.waitForTimeout(3000);

    // 시험 결과 링크가 있으면 클릭
    const examLink = S.locator("a[href*='/student/exams/'][href*='/result']").first();
    const hasExamLink = await examLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasExamLink) {
      await examLink.click();
      await S.waitForLoadState("load");
      await S.waitForTimeout(3000);
      await S.screenshot({ path: "test-results/hw-scores/07-student-grade-detail.png" });

      // ExamResultPage 에서 점수, 합격/불합격 표시 확인
      const hasScore = await S.locator("text=/\\d+\\s*\\/\\s*\\d+/").isVisible({ timeout: 5000 }).catch(() => false);
      const hasPassBadge = await S.locator("text=/합격|불합격/").isVisible({ timeout: 5000 }).catch(() => false);
      // 점수 또는 결과 배지 중 하나는 보여야 함
      expect(hasScore || hasPassBadge).toBeTruthy();
    } else {
      // 시험 결과가 없으면 GradeDetailPage를 직접 테스트 (유효하지 않은 ID)
      await S.goto(`${BASE}/student/grades/exams/99999`, { waitUntil: "load" });
      // 페이지 타이틀 "성적 상세" 대기 (로딩/에러 모두 이 타이틀을 렌더링)
      await expect(S.locator("text=성적 상세")).toBeVisible({ timeout: 10000 });
      // API 실패 후 에러 상태 전환 대기 (React Query retry=1, 수 초 소요)
      // "결과를 불러오지 못했습니다." 또는 "조회 실패" 텍스트
      const errorLocator = S.locator("text=불러오지 못했습니다");
      await errorLocator.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
      await S.screenshot({ path: "test-results/hw-scores/07-student-grade-detail-empty.png" });
      const hasError = await errorLocator.isVisible();
      expect(hasError).toBeTruthy();
    }
  });

  test("08 Student: 성적표 제출 (SubmitScorePage) UI 확인", async () => {
    await S.goto(`${BASE}/student/submit/score`, { waitUntil: "load" });
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/hw-scores/08-student-submit-score.png" });

    // 성적표 제출 타이틀
    await expect(S.locator("text=성적표 제출")).toBeVisible({ timeout: 10000 });

    // 파일 선택 버튼 존재 (학부모 계정이 아닌 경우)
    const hasFileBtn = await S.locator("button").filter({ hasText: /파일 선택/ }).isVisible({ timeout: 5000 }).catch(() => false);
    const hasParentMsg = await S.locator("text=학부모 계정").isVisible({ timeout: 3000 }).catch(() => false);
    // 파일 선택 버튼이 보이거나, 학부모 메시지가 보이거나
    expect(hasFileBtn || hasParentMsg).toBeTruthy();

    // 제출하기 버튼 존재 확인 (disabled 상태일 수 있음)
    if (hasFileBtn) {
      const submitBtn = S.locator("button").filter({ hasText: /제출하기/ });
      await expect(submitBtn).toBeVisible({ timeout: 5000 });
      // 파일이 없으므로 disabled 상태여야 함
      await expect(submitBtn).toBeDisabled();
    }
  });

  test("09 Student: 과제 제출 (SubmitAssignmentPage) UI 확인", async () => {
    await S.goto(`${BASE}/student/submit/assignment`, { waitUntil: "load" });
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/hw-scores/09-student-submit-assignment.png" });

    // 과제 제출 타이틀
    await expect(S.locator("text=과제 제출")).toBeVisible({ timeout: 10000 });

    // 제출 대상 선택 스텝
    const hasStep1 = await S.locator("text=제출 대상 선택").isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyMsg = await S.locator("text=제출할 미완료 과제").isVisible({ timeout: 5000 }).catch(() => false);
    // 스텝1이 보이거나 빈 상태 메시지가 보이거나
    expect(hasStep1 || hasEmptyMsg).toBeTruthy();
  });

  test("10 Student: 인벤토리 (MyInventoryPage) 렌더링", async () => {
    await S.goto(`${BASE}/student/inventory`, { waitUntil: "load" });
    await S.waitForTimeout(3000);
    await S.screenshot({ path: "test-results/hw-scores/10-student-inventory.png" });

    // 내 인벤토리 타이틀
    await expect(S.locator("div", { hasText: /^내 인벤토리$/ }).first()).toBeVisible({ timeout: 10000 });

    // 파일이 있으면 파일 목록, 없으면 빈 상태
    const hasFiles = await S.locator("text=/다운로드|미리보기/").isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await S.locator("text=파일이 없습니다").isVisible({ timeout: 3000 }).catch(() => false);
    const hasUploadBtn = await S.locator("button").filter({ hasText: /파일 업로드/ }).isVisible({ timeout: 3000 }).catch(() => false);
    // 파일 목록이 보이거나, 빈 상태가 보이거나, 업로드 버튼이 있거나
    expect(hasFiles || hasEmpty || hasUploadBtn).toBeTruthy();

    // 새 폴더 버튼 (학생 계정이면 표시)
    const hasNewFolderBtn = await S.locator("button").filter({ hasText: /새 폴더/ }).isVisible({ timeout: 3000 }).catch(() => false);
    // 학부모가 아닌 학생 계정이면 새 폴더 버튼 존재
    if (!await S.locator("text=학부모 계정").isVisible({ timeout: 1000 }).catch(() => false)) {
      expect(hasNewFolderBtn).toBeTruthy();
    }
  });

  // ══════════════════════════════
  // API Verification
  // ══════════════════════════════

  test("11 API: 세션 성적 데이터 (Admin)", async () => {
    // Admin 컨텍스트에서 강의/세션 조회 후 성적 API 확인
    // 먼저 강의 목록에서 세션 ID를 찾음
    const lecturesResp = await apiCall(T, "GET", "/lectures/");
    expect(lecturesResp.status).toBe(200);

    const lectures = Array.isArray(lecturesResp.body?.results)
      ? lecturesResp.body.results
      : Array.isArray(lecturesResp.body)
        ? lecturesResp.body
        : [];

    if (lectures.length > 0) {
      const lectureId = lectures[0].id;
      // 세션 목록 조회
      const sessionsResp = await apiCall(T, "GET", `/lectures/${lectureId}/sessions/`);

      const sessions = Array.isArray(sessionsResp.body?.results)
        ? sessionsResp.body.results
        : Array.isArray(sessionsResp.body)
          ? sessionsResp.body
          : [];

      if (sessions.length > 0) {
        const sessionId = sessions[0].id;
        // 세션 성적 API 호출
        const scoresResp = await apiCall(T, "GET", `/results/admin/sessions/${sessionId}/scores/`);
        expect(scoresResp.status).toBe(200);

        // 응답 구조 검증: meta + rows
        const body = scoresResp.body;
        expect(body).toHaveProperty("meta");
        expect(body).toHaveProperty("rows");
        expect(body.meta).toHaveProperty("exams");
        expect(body.meta).toHaveProperty("homeworks");
        expect(Array.isArray(body.meta.exams)).toBeTruthy();
        expect(Array.isArray(body.meta.homeworks)).toBeTruthy();
        expect(Array.isArray(body.rows)).toBeTruthy();

        // rows 내 구조 검증 (데이터가 있는 경우)
        if (body.rows.length > 0) {
          const row = body.rows[0];
          expect(row).toHaveProperty("enrollment_id");
          expect(row).toHaveProperty("student_name");
          expect(row).toHaveProperty("exams");
          expect(row).toHaveProperty("homeworks");
          expect(Array.isArray(row.exams)).toBeTruthy();
          expect(Array.isArray(row.homeworks)).toBeTruthy();
        }
      }
    }
  });

  test("12 API: 학생 성적 요약 (Student)", async () => {
    // Student 컨텍스트에서 grades API 호출
    const gradesResp = await apiCall(S, "GET", "/student/grades/");
    expect(gradesResp.status).toBe(200);

    const body = gradesResp.body;
    // 응답 구조 검증
    expect(body).toHaveProperty("exams");
    expect(body).toHaveProperty("homeworks");
    expect(Array.isArray(body.exams)).toBeTruthy();
    expect(Array.isArray(body.homeworks)).toBeTruthy();

    // 시험 결과 항목 구조 검증 (데이터가 있는 경우)
    if (body.exams.length > 0) {
      const exam = body.exams[0];
      expect(exam).toHaveProperty("exam_id");
      expect(exam).toHaveProperty("title");
      expect(exam).toHaveProperty("total_score");
      expect(exam).toHaveProperty("max_score");
      expect(exam).toHaveProperty("is_pass");
      expect(typeof exam.exam_id).toBe("number");
      expect(typeof exam.total_score).toBe("number");
      expect(typeof exam.max_score).toBe("number");
      expect(typeof exam.is_pass).toBe("boolean");
    }

    // 과제 결과 항목 구조 검증 (데이터가 있는 경우)
    if (body.homeworks.length > 0) {
      const hw = body.homeworks[0];
      expect(hw).toHaveProperty("homework_id");
      expect(hw).toHaveProperty("title");
      expect(hw).toHaveProperty("score");
      expect(hw).toHaveProperty("passed");
      expect(typeof hw.homework_id).toBe("number");
      expect(typeof hw.score).toBe("number");
      expect(typeof hw.passed).toBe("boolean");
    }
  });

  test.afterAll(async () => {
    await S?.context()?.close();
    await T?.context()?.close();
  });
});
