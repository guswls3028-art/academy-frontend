import { expect, test, type Page } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

function isLocalBase(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  })).toString("base64url");
  return `e30.${payload}.ymath`;
}

const student = {
  id: 101,
  name: "윤지용 학생",
  ps_number: "YM001",
  omr_code: "1042",
  phone: "01012345678",
  parent_phone: "01087654321",
  high_school: "와이매스중학교",
  grade: 2,
  gender: "M",
  is_managed: true,
  created_at: "2026-03-01T09:00:00+09:00",
  tags: [{ id: 91, name: "성장관찰", color: "#7c3aed" }],
  enrollments: [
    {
      id: 201,
      lecture: 501,
      lecture_name: "Ymath 중등 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "Y",
      status: "ACTIVE",
    },
    {
      id: 202,
      lecture: 502,
      lecture_name: "Ymath 경시 대비",
      lecture_color: "#7c3aed",
      lecture_chip_label: "경",
      status: "ACTIVE",
    },
  ],
};

const grades = {
  exams: [
    {
      exam_id: 301,
      enrollment_id: 201,
      title: "Ymath 주간 테스트 1회",
      total_score: 40,
      max_score: 50,
      is_pass: true,
      achievement: "PASS",
      retake_count: 1,
      session_id: 701,
      session_title: "1차시",
      lecture_id: 501,
      lecture_title: "Ymath 중등 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "Y",
      submitted_at: "2026-07-01T18:00:00+09:00",
      archived: true,
    },
    {
      exam_id: 302,
      enrollment_id: 201,
      title: "Ymath 주간 테스트 2회",
      total_score: 90,
      max_score: 100,
      is_pass: true,
      achievement: "PASS",
      retake_count: 2,
      session_id: 702,
      session_title: "2차시",
      lecture_id: 501,
      lecture_title: "Ymath 중등 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "Y",
      submitted_at: "2026-07-08T18:00:00+09:00",
      archived: false,
    },
    {
      exam_id: 303,
      enrollment_id: 202,
      title: "Ymath 경시 테스트 3회",
      total_score: 48,
      max_score: 50,
      is_pass: true,
      achievement: "PASS",
      retake_count: 1,
      session_id: 703,
      session_title: "3차시",
      lecture_id: 502,
      lecture_title: "Ymath 경시 대비",
      lecture_color: "#7c3aed",
      lecture_chip_label: "경",
      submitted_at: "2026-07-15T18:00:00+09:00",
      archived: false,
    },
    {
      exam_id: 304,
      enrollment_id: 201,
      title: "Ymath 주간 테스트 미응시",
      total_score: null,
      max_score: 100,
      is_pass: false,
      achievement: "NOT_SUBMITTED",
      meta_status: "NOT_SUBMITTED",
      retake_count: 1,
      session_id: 704,
      session_title: "4차시",
      lecture_id: 501,
      lecture_title: "Ymath 중등 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "Y",
      submitted_at: null,
      archived: false,
    },
  ],
  homeworks: [],
  exam_trend: [
    {
      round_index: 1,
      exam_id: 301,
      enrollment_id: 201,
      title: "Ymath 주간 테스트 1회",
      score: 40,
      max_score: 50,
      score_pct: 80,
      recorded_at: "2026-07-01T18:00:00+09:00",
      session_id: 701,
      session_title: "1차시",
      session_order: 1,
      session_regular_order: 1,
      session_date: "2026-07-01",
      lecture_id: 501,
      lecture_title: "Ymath 중등 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "Y",
      retake_count: 1,
      archived: true,
    },
    {
      round_index: 2,
      exam_id: 302,
      enrollment_id: 201,
      title: "Ymath 주간 테스트 2회",
      score: 90,
      max_score: 100,
      score_pct: 90,
      recorded_at: "2026-07-08T18:00:00+09:00",
      session_id: 702,
      session_title: "2차시",
      session_order: 2,
      session_regular_order: 2,
      session_date: "2026-07-08",
      lecture_id: 501,
      lecture_title: "Ymath 중등 심화",
      lecture_color: "#2563eb",
      lecture_chip_label: "Y",
      retake_count: 2,
      archived: false,
    },
    {
      round_index: 3,
      exam_id: 303,
      enrollment_id: 202,
      title: "Ymath 경시 테스트 3회",
      score: 48,
      max_score: 50,
      score_pct: 96,
      recorded_at: "2026-07-15T18:00:00+09:00",
      session_id: 703,
      session_title: "3차시",
      session_order: 3,
      session_regular_order: 3,
      session_date: "2026-07-15",
      lecture_id: 502,
      lecture_title: "Ymath 경시 대비",
      lecture_color: "#7c3aed",
      lecture_chip_label: "경",
      retake_count: 1,
      archived: false,
    },
  ],
  exam_summary: {
    scored_count: 3,
    average_score_pct: 88.7,
    latest_score_pct: 96,
    change_pct_points: 6,
    best_score_pct: 96,
  },
};

const performanceConsole = {
  period: { days: 180, from: "2026-01-20", to: "2026-07-19" },
  summary: {
    student_count: 1,
    scored_student_count: 1,
    result_count: 3,
    average_score_pct: 88.7,
    under_60_student_count: 0,
    improving_student_count: 1,
    declining_student_count: 0,
    pending_reported_score_count: 1,
    verified_school_score_count: 2,
    verified_mock_score_count: 1,
  },
  filter_options: {
    lectures: student.enrollments.map((enrollment) => ({
      id: enrollment.lecture,
      title: enrollment.lecture_name,
      color: enrollment.lecture_color,
      chip_label: enrollment.lecture_chip_label,
      is_active: true,
    })),
    grades: [2],
    reported_subjects: ["수학"],
  },
  pending_reported_scores: [{
    id: 903,
    student_id: student.id,
    student_name: student.name,
    school: student.high_school,
    grade: student.grade,
    source: "kice_mock",
    source_group: "mock",
    label: "2026년 9월 평가원 모의평가",
    academic_year: 2026,
    semester: null,
    exam_round: null,
    exam_month: 9,
    exam_date: "2026-09-03",
    subject: "수학",
    score: 92,
    max_score: 100,
    score_pct: 92,
    standard_score: 136,
    percentile: 96,
    grade_rank: 1,
    status: "pending",
    review_note: "",
    evidence_file_id: 1903,
    evidence_r2_key: "tenant/student/score-903.jpg",
    created_at: "2026-07-19T10:30:00+09:00",
    reviewed_at: null,
  }],
  students: [{
    student_id: student.id,
    name: student.name,
    display_name: student.name,
    grade: student.grade,
    school_type: "MIDDLE",
    school: student.high_school,
    lectures: student.enrollments.map((enrollment) => ({
      id: enrollment.lecture,
      title: enrollment.lecture_name,
      color: enrollment.lecture_color,
      chip_label: enrollment.lecture_chip_label,
      is_active: true,
      enrollment_id: enrollment.id,
      enrollment_status: enrollment.status,
    })),
    scored_count: 3,
    average_score_pct: 88.7,
    latest_score_pct: 96,
    change_pct_points: 6,
    first_to_latest_pct_points: 16,
    best_score_pct: 96,
    latest_exam_title: "Ymath 경시 테스트 3회",
    last_recorded_at: "2026-07-15T18:00:00+09:00",
    score_band: "80_plus",
    trend_direction: "up",
    source_summaries: {
      overall: { scored_count: 6, average_score_pct: 87.8, latest_score_pct: 91, change_pct_points: 5, first_to_latest_pct_points: 11, best_score_pct: 96, score_band: "80_plus", trend_direction: "up" },
      academy: { scored_count: 3, average_score_pct: 88.7, latest_score_pct: 96, change_pct_points: 6, first_to_latest_pct_points: 16, best_score_pct: 96, score_band: "80_plus", trend_direction: "up" },
      school: { scored_count: 2, average_score_pct: 83.5, latest_score_pct: 87, change_pct_points: 7, first_to_latest_pct_points: 7, best_score_pct: 87, score_band: "80_plus", trend_direction: "up" },
      mock: { scored_count: 1, average_score_pct: 91, latest_score_pct: 91, change_pct_points: null, first_to_latest_pct_points: null, best_score_pct: 91, score_band: "80_plus", trend_direction: "insufficient" },
    },
    subject_summaries: {
      school: {
        수학: { scored_count: 2, average_score_pct: 83.5, latest_score_pct: 87, change_pct_points: 7, first_to_latest_pct_points: 7, best_score_pct: 87, score_band: "80_plus", trend_direction: "up" },
      },
      mock: {
        수학: { scored_count: 1, average_score_pct: 91, latest_score_pct: 91, change_pct_points: null, first_to_latest_pct_points: null, best_score_pct: 91, score_band: "80_plus", trend_direction: "insufficient" },
      },
    },
    reported_scores: [
      {
        id: 901, student_id: student.id, source: "school_exam", source_group: "school", label: "2026년 1학기 1차 지필평가(중간)", academic_year: 2026, semester: 1, exam_round: "first", exam_month: null, exam_date: "2026-04-28", subject: "수학", score: 80, max_score: 100, score_pct: 80, standard_score: null, percentile: null, grade_rank: 3, status: "verified", review_note: "", evidence_file_id: 1901, evidence_r2_key: "tenant/student/score-901.jpg", created_at: "2026-04-29T10:00:00+09:00", reviewed_at: "2026-04-29T11:00:00+09:00",
      },
      {
        id: 902, student_id: student.id, source: "school_exam", source_group: "school", label: "2026년 1학기 2차 지필평가(기말)", academic_year: 2026, semester: 1, exam_round: "second", exam_month: null, exam_date: "2026-07-03", subject: "수학", score: 87, max_score: 100, score_pct: 87, standard_score: null, percentile: null, grade_rank: 2, status: "verified", review_note: "", evidence_file_id: 1902, evidence_r2_key: "tenant/student/score-902.jpg", created_at: "2026-07-04T10:00:00+09:00", reviewed_at: "2026-07-04T11:00:00+09:00",
      },
      {
        id: 904, student_id: student.id, source: "national_mock", source_group: "mock", label: "2026년 6월 전국연합학력평가", academic_year: 2026, semester: null, exam_round: null, exam_month: 6, exam_date: "2026-06-04", subject: "수학", score: 91, max_score: 100, score_pct: 91, standard_score: 132, percentile: 94, grade_rank: 2, status: "verified", review_note: "", evidence_file_id: 1904, evidence_r2_key: "tenant/student/score-904.jpg", created_at: "2026-06-05T10:00:00+09:00", reviewed_at: "2026-06-05T11:00:00+09:00",
      },
    ],
    pending_reported_score_count: 1,
  }],
};

async function installApi(page: Page, options: { failGrades?: boolean } = {}): Promise<void> {
  const access = fakeJwt();
  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "ymath-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    localStorage.setItem("teacher:preferAdmin", "0");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { token: access });

  let scoreReviewResolved = false;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith("/core/program/")) {
      await route.fulfill({ json: {
        tenantCode: "hakwonplus",
        display_name: "Ymath",
        is_active: true,
        ui_config: {},
        feature_flags: {},
      } });
      return;
    }
    if (path.endsWith("/core/me/")) {
      await route.fulfill({ json: {
        id: 1,
        username: "ymath-admin",
        name: "Ymath 선생님",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      } });
      return;
    }
    if (path.endsWith("/staffs/me/")) {
      await route.fulfill({ json: { id: 1, name: "Ymath 선생님", role: "admin", user: 1 } });
      return;
    }
    if (path.endsWith("/students/101/account-notifications/")) {
      await route.fulfill({ json: { count: 0, results: [] } });
      return;
    }
    if (path.endsWith("/students/101/")) {
      await route.fulfill({ json: student });
      return;
    }
    if (path.endsWith("/students/tags/")) {
      await route.fulfill({ json: { count: 1, results: student.tags } });
      return;
    }
    if (path.endsWith("/students/")) {
      await route.fulfill({ json: { count: 1, page_size: 50, results: [student] } });
      return;
    }
    if (path.endsWith("/results/admin/student-grades/")) {
      if (options.failGrades) {
        await route.fulfill({ status: 500, json: { detail: "성적 조회 일시 실패" } });
        return;
      }
      await route.fulfill({ json: grades });
      return;
    }
    if (path.endsWith("/results/admin/student-performance/")) {
      await route.fulfill({ json: scoreReviewResolved ? {
        ...performanceConsole,
        summary: { ...performanceConsole.summary, pending_reported_score_count: 0 },
        pending_reported_scores: [],
        students: performanceConsole.students.map((row) => ({ ...row, pending_reported_score_count: 0 })),
      } : performanceConsole });
      return;
    }
    if (path.includes("/results/admin/reported-scores/") && path.endsWith("/review/") && request.method() === "PATCH") {
      scoreReviewResolved = true;
      await route.fulfill({ json: { ...performanceConsole.pending_reported_scores[0], status: "verified" } });
      return;
    }
    if (path.endsWith("/storage/inventory/presign/")) {
      await route.fulfill({ json: { url: "https://example.invalid/score-evidence.jpg" } });
      return;
    }
    if (path.endsWith("/results/admin/landing-stats/")) {
      await route.fulfill({ json: {
        active_lectures: 2,
        active_exams: 3,
        pending_submissions: 0,
        done_last_7d: 3,
        failed_last_24h: 0,
        pending_top: [],
        recent_done_top: [],
      } });
      return;
    }
    await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });
}

async function assertTrend(component: ReturnType<Page["getByTestId"]>): Promise<void> {
  await expect(component).toBeVisible();
  await expect(component.getByText("회차별 성적 추이")).toBeVisible();
  await expect(component).toContainText("자동 누적");
  await expect(component).toContainText("최근96%");
  await expect(component).toContainText("누적3회");
  await expect(component).toContainText("평균88.7%");
  await expect(component).toContainText("직전 대비+6%p");
  await expect(component.getByText("1회차", { exact: true })).toBeVisible();
  await expect(component.getByText("2회차", { exact: true })).toBeVisible();
  await expect(component.getByText("3회차", { exact: true })).toBeVisible();
}

test.describe("학생별 회차 누적 성적 추이", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock visual contract spec.");
  test.use({ serviceWorkers: "block" });

  test("관리자 성적 콘솔에서 학생별 누적 추이와 다중 필터를 함께 관리한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 960 });
    await installApi(page);
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });

    await page.locator('a[href="/admin/results"]').first().click();
    await expect(page).toHaveURL(/\/admin\/results$/);
    const console = page.getByTestId("results-performance-console");
    await expect(console).toBeVisible();
    await expect(console.getByText("학생의 변화를 회차로 봅니다")).toBeVisible();
    await expect(console.getByText("시험 추가 시 자동 누적")).toBeVisible();
    await expect(console.getByText("조건에 맞는 1명")).toBeVisible();
    await expect(console.getByText("학원96%").first()).toBeVisible();
    await console.screenshot({ path: "test-results/student-score-trend/results-console-initial-1366.png" });
    await expect(console.getByLabel("학생", { exact: true })).toContainText("윤지용 학생");
    await console.getByLabel("학생", { exact: true }).selectOption(String(student.id));
    await expect(console.getByTestId("performance-student-list")).toContainText("윤지용 학생");
    await console.getByRole("button", { name: /초기화/ }).first().click();

    const detail = page.getByTestId("performance-student-detail");
    await expect(detail).toContainText("윤지용 학생");
    await expect(detail).toContainText("성적을 세 갈래로 나눠 봅니다.");
    await console.getByRole("button", { name: /학원 시험/ }).first().click();
    await expect(detail.getByTestId("student-score-trend")).toContainText("학원 시험 누적 추이");
    await expect(detail.getByTestId("student-score-trend")).toContainText("누적3회");
    await expect(detail.getByText("1회차", { exact: true }).first()).toBeVisible();
    await expect(detail.getByText("3회차", { exact: true }).first()).toBeVisible();

    await console.getByLabel("강의").selectOption("501");
    await expect(detail.getByTestId("student-score-trend")).toContainText("누적2회");
    await expect(detail.getByText("3회차", { exact: true })).toHaveCount(0);
    await console.getByRole("button", { name: /초기화/ }).first().click();
    await expect(detail.getByTestId("student-score-trend")).toContainText("누적3회");

    await console.getByLabel("득점 구간").selectOption("under_60");
    await expect(console.getByText("조건에 맞는 학생이 없습니다")).toBeVisible();
    await console.getByRole("button", { name: /초기화/ }).first().click();
    await expect(console.getByText("조건에 맞는 1명")).toBeVisible();

    await console.getByRole("button", { name: /학교 내신/ }).first().click();
    await expect(console.getByLabel("과목")).toHaveValue("수학");
    await expect(detail.getByTestId("student-score-trend")).toContainText("학교 내신 누적 추이");
    await expect(detail.getByTestId("student-score-trend")).toContainText("누적2회");
    await expect(detail).toContainText("1학기 2차 지필평가");
    await console.getByRole("button", { name: "30일", exact: true }).click();
    await expect(detail.getByTestId("student-score-trend")).toContainText("누적1회");
    await expect(detail).not.toContainText("1학기 1차 지필평가");

    const reviewQueue = page.getByTestId("reported-score-review-queue");
    await expect(reviewQueue).toContainText("2026년 9월 평가원 모의평가");
    await reviewQueue.screenshot({ path: "test-results/student-score-trend/reported-score-review-queue.png" });
    await reviewQueue.getByRole("button", { name: "확인·반영" }).click();
    await expect(reviewQueue).toContainText("확인할 성적표가 없습니다.");

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "test-results/student-score-trend/results-console-top-1366.png" });
    await page.screenshot({ path: "test-results/student-score-trend/results-console-1366.png", fullPage: true });
    await page.setViewportSize({ width: 1100, height: 820 });
    await expect(console).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-score-trend/results-console-1100.png", fullPage: true });
  });

  test("관리자 학생 상세에서 자동 누적·강의 필터·정규화 점수를 확인한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await installApi(page);
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });

    await page.locator('a[href="/admin/students"]').first().click();
    await expect(page).toHaveURL(/\/admin\/students\/home/);
    await page.getByRole("button", { name: /윤지용 학생/ }).first().click();
    await expect(page).toHaveURL(/\/admin\/students\/101/);
    const examTab = page.getByRole("tab", { name: /^시험/ });
    await expect(examTab).toContainText("합격 100%");
    await examTab.click();

    const component = page.getByTestId("student-score-trend");
    await assertTrend(component);
    await expect(page.getByText("미응시", { exact: true })).toBeVisible();
    await component.screenshot({ path: "test-results/student-score-trend/admin-1366.png" });

    const dots = component.locator(".recharts-line-dots circle");
    await expect(dots).toHaveCount(3);
    await dots.nth(2).hover();
    await expect(component).toContainText("48 / 50점 · 득점률 96%");

    await component.getByRole("button", { name: /Ymath 중등 심화/ }).click();
    await expect(component).toContainText("누적2회");
    await expect(component.getByText("3회차", { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 1100, height: 820 });
    await expect(component).toBeVisible();
    await page.screenshot({ path: "test-results/student-score-trend/admin-1100.png", fullPage: true });
  });

  test("성적 API 오류를 실제 0건으로 오인시키지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 820 });
    await installApi(page, { failGrades: true });
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });

    await page.locator('a[href="/admin/students"]').first().click();
    await page.getByRole("button", { name: /윤지용 학생/ }).first().click();
    const examTab = page.getByRole("tab", { name: /시험/ });
    await expect(examTab).toContainText("확인 필요");
    await expect(examTab).toContainText("불러오기 실패");
    await examTab.click();
    await expect(page.getByText("성적 추이를 불러오지 못했습니다.")).toBeVisible();

    const homeworkTab = page.getByRole("tab", { name: /과제/ });
    await expect(homeworkTab).toContainText("확인 필요");
    await homeworkTab.click();
    await expect(page.getByText("과제 성적을 불러오지 못했습니다.")).toBeVisible();
  });

  test("선생 모바일 학생 상세에서도 회차 추이가 내부 스크롤로 안정적으로 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installApi(page);
    await page.goto(`${BASE}/teacher`, { waitUntil: "domcontentloaded" });

    await page.locator('a[href="/teacher/students"]').first().click();
    await expect(page).toHaveURL(/\/teacher\/students$/);
    await page.getByRole("button", { name: /윤지용 학생/ }).first().click();
    await expect(page).toHaveURL(/\/teacher\/students\/101/);
    await page.getByRole("button", { name: "시험", exact: true }).click();

    const component = page.getByTestId("student-score-trend");
    await assertTrend(component);
    await expect(page.getByText("미응시", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-score-trend/teacher-390.png", fullPage: true });
    await page.mouse.move(380, 20);
    await page.getByTestId("student-score-trend-chart").scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await page.screenshot({ path: "test-results/student-score-trend/teacher-390-chart.png" });
  });
});
