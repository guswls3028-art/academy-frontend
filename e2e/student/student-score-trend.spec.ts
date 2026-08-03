import { expect, test, type Page } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

function isLocalBase(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
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

type Viewer = "student" | "parent";

const trendA = [
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
    rank: 3,
    percentile: 30,
    cohort_size: 10,
    cohort_avg: 75,
    retake_count: 1,
    archived: false,
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
    rank: 2,
    percentile: 20,
    cohort_size: 10,
    cohort_avg: 78,
    retake_count: 1,
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
    rank: 1,
    percentile: 10,
    cohort_size: 10,
    cohort_avg: 82,
    retake_count: 2,
    archived: false,
  },
];

const trendB = [{
  ...trendA[0],
  exam_id: 401,
  enrollment_id: 211,
  title: "동생 진단 테스트",
  score: 35,
  max_score: 50,
  score_pct: 70,
}];

type TrendPoint = (typeof trendA)[number];

type LectureOption = {
  id: number;
  title: string;
  color: string | null;
  chip_label: string | null;
};

function lectureOptionsFor(points: TrendPoint[]): LectureOption[] {
  const options = new Map<number, LectureOption>();
  for (const point of points) {
    if (point.lecture_id == null || !point.lecture_title || options.has(point.lecture_id)) continue;
    options.set(point.lecture_id, {
      id: point.lecture_id,
      title: point.lecture_title,
      color: point.lecture_color,
      chip_label: point.lecture_chip_label,
    });
  }
  return Array.from(options.values());
}

function gradesFor(points: TrendPoint[]) {
  const latest = points.at(-1)?.score_pct ?? null;
  const previous = points.length > 1 ? points.at(-2)?.score_pct ?? null : null;
  const average = points.length
    ? Math.round((points.reduce((sum, point) => sum + point.score_pct, 0) / points.length) * 10) / 10
    : null;
  return {
    exams: [
      ...points.map((point, index) => ({
        exam_id: point.exam_id,
        enrollment_id: point.enrollment_id,
        title: point.title,
        total_score: point.score,
        max_score: point.max_score,
        is_pass: true,
        achievement: "PASS",
        meta_status: null,
        retake_count: point.retake_count,
        session_title: point.session_title,
        lecture_title: point.lecture_title,
        rank: point.rank,
        percentile: point.percentile,
        cohort_size: point.cohort_size,
        cohort_avg: point.cohort_avg,
        submitted_at: point.recorded_at,
        total_questions: 20,
        correct_count: index === 0 ? 18 : 17,
        wrong_count: index === 0 ? 2 : 3,
        wrong_question_numbers: index === 0 ? [7, 9] : [5, 11, 13],
        correction_status: index === 0 ? "COMPLETED" : "PENDING",
      })),
      {
        exam_id: 999,
        enrollment_id: points[0]?.enrollment_id ?? 201,
        title: "미응시 테스트",
        total_score: null,
        max_score: 100,
        is_pass: null,
        achievement: "NOT_SUBMITTED",
        meta_status: "NOT_SUBMITTED",
        retake_count: 0,
        session_title: "다음 차시",
        lecture_title: "Ymath 중등 심화",
        submitted_at: null,
      },
    ],
    homeworks: [],
    exam_trend: points,
    exam_summary: {
      scored_count: points.length,
      average_score_pct: average,
      latest_score_pct: latest,
      change_pct_points: latest != null && previous != null ? latest - previous : null,
      best_score_pct: points.length ? Math.max(...points.map((point) => point.score_pct)) : null,
    },
    labels: { pass: "", fail: "" },
  };
}

function analyticsFor(points: TrendPoint[]) {
  return {
    student: { id: points[0]?.enrollment_id === 211 ? 12 : 11, name: "학생" },
    date_range: { days: 365, from: "2025-07-17", to: "2026-07-17" },
    summary: {
      exam_count: points.length,
      scored_exam_count: points.length,
      avg_score_pct: points.length ? points.reduce((sum, point) => sum + point.score_pct, 0) / points.length : null,
      median_score_pct: points.at(Math.floor(points.length / 2))?.score_pct ?? null,
      pass_rate_pct: 100,
      not_submitted_count: 1,
      risk_level: "stable",
    },
    trends: points.map((point) => ({
      exam_id: point.exam_id,
      title: point.title,
      lecture_title: point.lecture_title,
      submitted_at: point.recorded_at,
      score_pct: point.score_pct,
      cohort_avg_pct: point.score_pct - 8,
      rank: 2,
      percentile: 20,
      cohort_size: 10,
    })),
    lecture_breakdown: [{ lecture_title: "Ymath 중등 심화", exam_count: points.length, avg_score_pct: 88 }],
    weak_questions: [{ question_number: 7, wrong_count: 2 }],
    homework: { assigned_count: 0, graded_count: 0, avg_score_pct: null, pass_rate_pct: null },
    highlights: {
      latest_exam: null,
      best_exam: null,
      weakest_exam: { exam_id: 301, title: "Ymath 주간 테스트 1회", score_pct: 80 },
    },
    insights: ["7번 문항을 먼저 복습해 보세요."],
  };
}

async function installApi(
  page: Page,
  viewer: Viewer,
  options: {
    studentPoints?: TrendPoint[];
    failAnalytics?: boolean;
    reportLayout?: unknown;
    analyticsRequests?: string[];
    lectureOptions?: LectureOption[];
    omitLectureOptions?: boolean;
  } = {},
): Promise<string[]> {
  const selectedHeaders: string[] = [];
  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "ymath-refresh");
    localStorage.setItem("tenant_code", "ymath");
    sessionStorage.setItem("tenantCode", "ymath");
  }, { token: fakeJwt() });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith("/core/program/")) {
      await route.fulfill({ json: {
        tenantCode: "ymath",
        display_name: "Ymath",
        is_active: true,
        ui_config: {},
        feature_flags: {},
      } });
      return;
    }
    if (path.endsWith("/core/me/")) {
      await route.fulfill({ json: viewer === "parent" ? {
        id: 2,
        username: "ymath-parent",
        name: "김학부모",
        is_staff: false,
        is_superuser: false,
        tenantRole: "parent",
        linkedStudents: [{ id: 11, name: "김첫째" }, { id: 12, name: "김둘째" }],
      } : {
        id: 1,
        username: "ymath-student",
        name: "김첫째",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        linkedStudents: [],
      } });
      return;
    }
    const rawSelectedId = request.headers()["x-student-id"];
    const selectedId = rawSelectedId ?? "11";
    const selectedPoints = selectedId === "12" ? trendB : (options.studentPoints ?? trendA);
    if (path.endsWith("/student/grades/analytics/")) {
      selectedHeaders.push(rawSelectedId ?? "missing");
      options.analyticsRequests?.push(path);
      if (options.failAnalytics) {
        await route.fulfill({ status: 503, json: { detail: "temporarily unavailable" } });
        return;
      }
      await route.fulfill({ json: analyticsFor(selectedPoints) });
      return;
    }
    if (path.endsWith("/student/grades/")) {
      selectedHeaders.push(rawSelectedId ?? "missing");
      await route.fulfill({
        json: {
          ...gradesFor(selectedPoints),
          ...(!options.omitLectureOptions ? {
            lecture_options: options.lectureOptions ?? lectureOptionsFor(selectedPoints),
          } : {}),
          ...(options.reportLayout ? { report_layout: options.reportLayout } : {}),
        },
      });
      return;
    }
    if (path.endsWith("/student/me/")) {
      await route.fulfill({ json: { id: Number(selectedId), name: selectedId === "12" ? "김둘째" : "김첫째", is_student: true } });
      return;
    }
    await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });
  return selectedHeaders;
}

test.describe("학생·학부모 회차별 누적 성적", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock visual contract spec.");
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  test("학생은 강좌별 성장선과 등수 우선 지표를 확인한다", async ({ page }) => {
    const firstLectureTitle = "[26년 여름방학] 고1 Hyper 정규반 공통수학2 Routine";
    const secondLectureTitle = "[26년 여름방학] 고1 Hyper 특강 대수 Remake";
    const emptyLectureTitle = "[26년 여름방학] 고1 Hyper 주말 클리닉";
    const studentPoints = trendA.map((point) => ({
      ...point,
      lecture_title: point.lecture_id === 501 ? firstLectureTitle : secondLectureTitle,
    }));
    await installApi(page, "student", {
      studentPoints,
      lectureOptions: [
        { id: 501, title: firstLectureTitle, color: "#2563eb", chip_label: "Y" },
        { id: 502, title: secondLectureTitle, color: "#7c3aed", chip_label: "경" },
        { id: 503, title: emptyLectureTitle, color: "#16a34a", chip_label: "클" },
      ],
    });
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    const chart = page.getByTestId("student-score-trend");
    await expect(chart).toBeVisible();
    const lectureSelect = chart.getByRole("combobox", { name: "강좌별 성적 추이" });
    await expect(lectureSelect).toHaveValue("501");
    await expect(lectureSelect.getByRole("option")).toHaveCount(3);
    await expect(lectureSelect.getByRole("option").first()).toHaveText(`[Y] ${firstLectureTitle}`);
    await expect(lectureSelect.getByRole("option").last()).toHaveText(`[클] ${emptyLectureTitle}`);
    await expect(lectureSelect.getByRole("option", { name: "전체", exact: true })).toHaveCount(0);

    const metricButtons = chart.getByRole("group", { name: "성적 추이 기준" }).getByRole("button");
    await expect(metricButtons).toHaveText(["등수", "상위 %", "득점률"]);
    await expect(chart.getByRole("button", { name: "등수", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(chart).toContainText("같은 시험 응시자 중 1차 응시 점수 기준 내 등수입니다.");
    await expect(chart).toContainText("최근2등 / 10명");
    await expect(chart).toContainText("누적2회");
    await expect(chart.getByText("1회차", { exact: true })).toBeVisible();
    await expect(chart.getByText("2회차", { exact: true })).toBeVisible();
    await expect(chart.getByText("3회차", { exact: true })).toHaveCount(0);
    await expect(chart.locator(".recharts-line-dots circle")).toHaveCount(2);
    await page.screenshot({ path: "test-results/student-score-trend/student-390-initial.png", fullPage: true });
    await chart.getByRole("button", { name: "상위 %", exact: true }).click();
    await expect(chart).toContainText("최근20%");
    await expect(chart).toContainText("직전 대비10%p 상승");
    await chart.getByRole("button", { name: "득점률", exact: true }).click();
    await expect(chart).toContainText("최근90%");

    await lectureSelect.selectOption("502");
    await expect(chart).toContainText("최근96%");
    await expect(chart).toContainText("누적1회");
    await expect(chart.getByText("1회차", { exact: true })).toBeVisible();
    await expect(chart.getByText("2회차", { exact: true })).toHaveCount(0);
    await expect(chart.locator(".recharts-line-dots circle")).toHaveCount(1);
    await chart.locator(".recharts-line-dots circle").hover();
    await expect(chart).toContainText("48 / 50점 · 득점률 96%");
    await expect(chart).not.toContainText("미응시 테스트");
    await expect(page.getByRole("region", { name: "성적 비교" })).toBeVisible();

    await chart.getByRole("button", { name: "등수", exact: true }).click();
    await lectureSelect.selectOption("503");
    await expect(chart).toContainText("이 강좌에는 아직 연결할 점수가 없습니다.");
    await expect(chart.getByRole("button", { name: "등수", exact: true })).toBeDisabled();
    await expect(chart.getByRole("button", { name: "상위 %", exact: true })).toBeDisabled();
    await expect(chart.getByRole("button", { name: "득점률", exact: true })).toHaveAttribute("aria-pressed", "true");
    await lectureSelect.selectOption("501");
    await expect(chart.getByRole("button", { name: "등수", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(chart).toContainText("최근2등 / 10명");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-score-trend/student-390.png", fullPage: true });
  });

  test("석차가 없는 강좌도 세 지표 순서와 비교 데이터 안내를 유지한다", async ({ page }) => {
    const scoreOnlyPoints = trendA.slice(0, 2).map((point) => ({
      ...point,
      rank: null,
      percentile: null,
      cohort_size: null,
    }));
    await installApi(page, "student", {
      studentPoints: scoreOnlyPoints,
      lectureOptions: [
        { id: 501, title: "고1 Hyper 정규반", color: "#2563eb", chip_label: "Y" },
      ],
    });
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    const chart = page.getByTestId("student-score-trend");
    const metricButtons = chart.getByRole("group", { name: "성적 추이 기준" }).getByRole("button");
    await expect(chart.getByRole("combobox", { name: "강좌별 성적 추이" })).toHaveCount(0);
    await expect(chart.getByTestId("student-score-trend-current-lecture")).toContainText("고1 Hyper 정규반");
    await expect(chart.getByTestId("student-score-trend-current-lecture")).toContainText("수강 중");
    await expect(metricButtons).toHaveText(["등수", "상위 %", "득점률"]);
    await expect(chart.getByRole("button", { name: "등수", exact: true })).toBeDisabled();
    await expect(chart.getByRole("button", { name: "상위 %", exact: true })).toBeDisabled();
    await expect(chart.getByRole("button", { name: "득점률", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(chart).toContainText("같은 시험에 2명 이상 응시하면 등수와 상위 %를 확인할 수 있습니다.");
    await expect(chart).toContainText("최근90%");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-score-trend/student-score-only-390.png", fullPage: true });
  });

  test("시험 카드에서 교사가 확인한 오답 완료와 미완료 상태를 바로 확인한다", async ({ page }) => {
    await installApi(page, "student");
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });

    const completedCard = page.getByRole("link").filter({ hasText: "Ymath 주간 테스트 1회" });
    const pendingCard = page.getByRole("link").filter({ hasText: "Ymath 주간 테스트 2회" });
    await expect(completedCard).toContainText("오답 완료");
    await expect(pendingCard).toContainText("오답 미완료");
    await expect(completedCard).toContainText("합격");
    await expect(completedCard).toContainText("7, 9번");
    await page.screenshot({ path: "test-results/student-correction-status/student-grade-cards-390.png", fullPage: true });
  });

  test("학원 설정에 따라 성장 그래프 섹션을 숨기고 순서를 바꾼다", async ({ page }) => {
    await installApi(page, "student", {
      reportLayout: {
        version: 2,
        sections: [
          { id: "score_comparison", visible: true },
          { id: "score_trend", visible: true },
          { id: "lecture_average", visible: true },
          { id: "improvement_priority", visible: false },
          { id: "exam_summary", visible: false },
          { id: "rank_position", visible: false },
          { id: "weakest_lecture", visible: false },
          { id: "homework_summary", visible: false },
        ],
        score_comparison_metrics: {
          average_score: true,
          pass_rate: false,
          status: false,
        },
      },
    });
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    const comparison = page.getByRole("region", { name: "성적 비교" });
    const trend = page.getByTestId("student-score-trend");
    await expect(comparison).toBeVisible();
    await expect(trend).toBeVisible();
    await expect(page.getByRole("region", { name: "강좌별 평균" })).toBeVisible();
    await expect(comparison.getByText("평균 득점률", { exact: true })).toBeVisible();
    await expect(comparison.getByText("통과율", { exact: true })).toHaveCount(0);
    await expect(comparison.getByText("상태", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "보완 우선순위" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "시험 성적 요약" })).toHaveCount(0);
    await expect.poll(async () => comparison.evaluate((node, trendSelector) => {
      const trendNode = document.querySelector(trendSelector);
      return Boolean(trendNode && (node.compareDocumentPosition(trendNode) & Node.DOCUMENT_POSITION_FOLLOWING));
    }, '[data-testid="student-score-trend"]')).toBe(true);
  });

  test("분석 기반 섹션을 모두 숨기면 분석 API를 호출하지 않는다", async ({ page }) => {
    const analyticsRequests: string[] = [];
    await installApi(page, "student", {
      analyticsRequests,
      reportLayout: {
        version: 2,
        sections: [
          { id: "score_trend", visible: true },
          { id: "score_comparison", visible: false },
          { id: "lecture_average", visible: false },
          { id: "improvement_priority", visible: false },
          { id: "exam_summary", visible: false },
          { id: "rank_position", visible: false },
          { id: "weakest_lecture", visible: false },
          { id: "homework_summary", visible: false },
        ],
        score_comparison_metrics: {
          average_score: true,
          pass_rate: true,
          status: true,
        },
      },
    });
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("student-score-trend")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(analyticsRequests).toHaveLength(0);
  });

  test("학부모가 자녀를 바꾸면 선택한 자녀의 누적 성적만 다시 표시한다", async ({ page }) => {
    const selectedHeaders = await installApi(page, "parent");
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    const chart = page.getByTestId("student-score-trend");
    await expect(chart).toContainText("누적2회");
    await expect(chart).toContainText("최근2등 / 10명");
    const switcher = page.getByRole("tablist", { name: "자녀 선택" });
    await switcher.getByRole("tab", { name: "김둘째" }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    await expect(chart).toContainText("누적1회");
    await expect(chart).toContainText("최근3등 / 10명");
    await expect(chart).not.toContainText("최근96%");
    await expect(chart.getByRole("combobox", { name: "강좌별 성적 추이" })).toHaveCount(0);
    await expect(chart.getByTestId("student-score-trend-current-lecture")).toHaveAccessibleName("현재 강좌: [Y] Ymath 중등 심화");
    expect(selectedHeaders).toContain("11");
    expect(selectedHeaders).toContain("12");
    expect(selectedHeaders).not.toContain("missing");
    await page.screenshot({ path: "test-results/student-score-trend/parent-child-b-390.png", fullPage: true });
  });

  test("학생 다크 모드에서도 성장선과 글자 대비가 유지된다", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hakwonplus:student-theme-mode", "dark");
    });
    await installApi(page, "student", { omitLectureOptions: true });
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    const app = page.locator("[data-app='student']");
    await expect(app).toHaveAttribute("data-student-dark", "true");
    const chart = page.getByTestId("student-score-trend");
    await expect(chart).toBeVisible();
    await expect(chart.getByRole("combobox", { name: "강좌별 성적 추이" })).toBeVisible();
    await expect(chart).toContainText("최근2등 / 10명");
    await expect(chart.locator(".recharts-line-dots circle")).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-score-trend/student-dark-390.png", fullPage: true });
  });

  test("비교 분석 장애에도 누적 성적과 빈 상태가 독립적으로 유지된다", async ({ page }) => {
    await installApi(page, "student", { studentPoints: [], failAnalytics: true });
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    const chart = page.getByTestId("student-score-trend");
    await expect(chart).toContainText("아직 연결할 점수가 없습니다.");
    await expect(chart).toContainText("첫 시험 점수가 입력되면 1회차 성적이 이곳에 표시됩니다.");
    await expect(page.getByText("비교 분석을 불러오지 못했습니다.", { exact: false })).toBeVisible();
  });

  test("긴 시험 이력은 페이지를 밀지 않고 그래프 안에서 스크롤된다", async ({ page }) => {
    const longTrend = Array.from({ length: 14 }, (_, index): TrendPoint => ({
      ...trendA[0],
      round_index: index + 1,
      exam_id: 500 + index,
      title: `Ymath 누적 테스트 ${index + 1}회`,
      score: 30 + index,
      score_pct: 60 + index * 2,
      recorded_at: `2026-07-${String(index + 1).padStart(2, "0")}T18:00:00+09:00`,
      session_order: index + 1,
      session_regular_order: index + 1,
      session_date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    }));
    await installApi(page, "student", { studentPoints: longTrend });
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    const chartPaper = page.getByTestId("student-score-trend-chart");
    await expect(page.getByTestId("student-score-trend")).toContainText("누적14회");
    await expect.poll(() => chartPaper.evaluate((element) => {
      const scroller = element.parentElement;
      return Boolean(scroller && scroller.scrollWidth > scroller.clientWidth);
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("데스크톱에서 한 강좌는 선택 상자 대신 컴팩트한 현재 강좌 티켓으로 표시한다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installApi(page, "student", {
      studentPoints: trendA.slice(0, 2),
      lectureOptions: [
        { id: 501, title: "[26년 여름방학] 고1 Hyper 정규반 공통수학2 Routine", color: "#2563eb", chip_label: "Y" },
      ],
    });
    await page.goto(`${BASE}/student/grades?tab=stats`, { waitUntil: "domcontentloaded" });

    const chart = page.getByTestId("student-score-trend");
    const currentLecture = chart.getByTestId("student-score-trend-current-lecture");
    await expect(chart.getByRole("combobox", { name: "강좌별 성적 추이" })).toHaveCount(0);
    await expect(currentLecture).toContainText("[26년 여름방학] 고1 Hyper 정규반 공통수학2 Routine");
    await expect(currentLecture).toContainText("수강 중");
    const geometry = await chart.evaluate((node) => {
      const lecture = node.querySelector<HTMLElement>('[data-testid="student-score-trend-current-lecture"]');
      const metrics = node.querySelector<HTMLElement>('[data-testid="student-score-trend-metric-switch"]');
      if (!lecture || !metrics) return null;
      const lectureRect = lecture.getBoundingClientRect();
      const metricsRect = metrics.getBoundingClientRect();
      return {
        lectureWidth: lectureRect.width,
        sameRow: Math.abs(lectureRect.top - metricsRect.top) < 24,
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry?.lectureWidth).toBeLessThanOrEqual(520);
    expect(geometry?.sameRow).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/student-score-trend/student-single-lecture-1440.png", fullPage: true });
  });
});
