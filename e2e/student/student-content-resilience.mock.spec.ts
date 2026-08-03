import { expect, test, type Page } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const IS_LOCAL_BASE = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE);

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  })).toString("base64url");
  return `e30.${payload}.student-content`;
}

function emptyGrades(examId?: number) {
  return {
    exams: examId == null ? [] : [{
      exam_id: examId,
      enrollment_id: 301,
      title: "공통 진단평가",
      total_score: 80,
      max_score: 100,
      is_pass: true,
      achievement: "PASS",
      meta_status: null,
      session_title: "1차시",
      lecture_title: "수학",
      submitted_at: new Date().toISOString(),
    }],
    homeworks: [],
    exam_trend: [],
    exam_summary: {
      scored_count: examId == null ? 0 : 1,
      average_score_pct: examId == null ? null : 80,
      latest_score_pct: examId == null ? null : 80,
      change_pct_points: null,
      best_score_pct: examId == null ? null : 80,
    },
  };
}

function escapedHtml(text: string, tag = "span"): string {
  return `&amp;amp;lt;${tag} style=&amp;amp;quot;color: red&amp;amp;quot;&amp;amp;gt;${text}&amp;amp;lt;/${tag}&amp;amp;gt;`;
}

async function assertNoRenderedHtmlLeak(page: Page) {
  const leakPattern = /<\/?(?:p|div|span|strong|em|table|tr|td|h[1-6])\b|&(?:amp;)*(?:lt|gt);/i;
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(leakPattern);
  const attributeLeaks = await page.locator("[aria-label], [title], [alt], [placeholder]").evaluateAll((elements) => (
    elements.flatMap((element) => ["aria-label", "title", "alt", "placeholder"].map((attribute) => ({
      attribute,
      value: element.getAttribute(attribute) ?? "",
    }))).filter(({ value }) => /<\/?(?:p|div|span|strong|em|table|tr|td|h[1-6])\b|&(?:amp;)*(?:lt|gt);/i.test(value))
  ));
  expect(attributeLeaks).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function installStudentApi(
  page: Page,
  options: { profileId?: () => number; examId?: number; legacyHtml?: boolean; failDataRequests?: boolean } = {},
) {
  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "student-content-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { token: fakeJwt() });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const profileId = options.profileId?.() ?? 11;

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith("/core/program/")) {
      await route.fulfill({ json: {
        tenantCode: "hakwonplus",
        display_name: options.legacyHtml ? escapedHtml("학원플러스", "strong") : "학원플러스",
        is_active: true,
        ui_config: options.legacyHtml ? { login_title: escapedHtml("학원플러스", "span") } : {},
        feature_flags: {},
      } });
      return;
    }
    if (path.endsWith("/core/me/")) {
      await route.fulfill({ json: {
        id: profileId,
        username: `student-${profileId}`,
        name: options.legacyHtml ? escapedHtml("학생 이름", "strong") : `학생 ${profileId}`,
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        linkedStudents: [],
      } });
      return;
    }
    if (options.failDataRequests) {
      await route.fulfill({ status: 503, json: { detail: "temporary student API failure" } });
      return;
    }
    if (path.endsWith("/student/me/")) {
      await route.fulfill({ json: {
        id: profileId,
        username: `student-${profileId}`,
        name: options.legacyHtml ? escapedHtml("학생 이름", "strong") : `학생 ${profileId}`,
        displayName: options.legacyHtml ? escapedHtml("학생 이름", "span") : `학생 ${profileId}`,
        is_student: true,
        isParentReadOnly: false,
      } });
      return;
    }
    if (path.endsWith("/student/dashboard/")) {
      await route.fulfill({ json: options.legacyHtml ? {
        notices: [{ id: 81, title: escapedHtml("이번 주 안내", "strong"), created_at: "2026-08-03T09:00:00+09:00", is_urgent: true }],
        today_sessions: [{ id: 24, title: escapedHtml("정규 수업", "p"), date: "2026-08-03", status: "OPEN", type: "session", start_time: "18:00:00" }],
        badges: {},
        tenant_info: { name: escapedHtml("학원플러스", "span"), phone: "02-0000-0000", headquarters_phone: "02-0000-0000", academies: [] },
      } : { notices: [], today_sessions: [], badges: {}, tenant_info: null } });
      return;
    }
    if (path.endsWith("/student/sessions/me/")) {
      await route.fulfill({ json: options.legacyHtml ? [{
        id: 24,
        title: escapedHtml("정규 수업", "p"),
        date: "2026-08-03",
        status: "OPEN",
        type: "session",
        start_time: "18:00:00",
      }] : [] });
      return;
    }
    if (path.endsWith("/student/sessions/24/")) {
      await route.fulfill({ json: {
        id: 24,
        title: options.legacyHtml ? escapedHtml("정규 수업", "p") : "정규 수업",
        date: "2026-08-03",
        status: "OPEN",
        type: "session",
        start_time: "18:00:00",
      } });
      return;
    }
    if (path.endsWith("/student/attendance/summary/")) {
      await route.fulfill({ json: options.legacyHtml ? {
        summary: { total: 1, present: 1, absent: 0, late: 0, early_leave: 0, runaway: 0 },
        recent: [{ session_id: 24, lecture_title: escapedHtml("수학 강의", "strong"), session_title: escapedHtml("정규 수업", "p"), date: "2026-08-03", status: "PRESENT" }],
      } : { summary: { total: 0, present: 0, absent: 0, late: 0, early_leave: 0, runaway: 0 }, recent: [] } });
      return;
    }
    if (path.endsWith("/student/exams/")) {
      await route.fulfill({ json: { items: options.legacyHtml ? [{
        id: 501,
        title: escapedHtml("진단 평가", "strong"),
        description: escapedHtml("시험 안내", "p"),
        open_at: "2026-08-01T09:00:00+09:00",
        close_at: "2026-08-31T23:59:00+09:00",
        allow_retake: false,
        max_attempts: 1,
        pass_score: 60,
        max_score: 100,
        status: "OPEN",
        has_result: false,
        attempt_count: 0,
      }] : [] } });
      return;
    }
    if (path.endsWith("/student/video/me/")) {
      await route.fulfill({ json: {
        public: null,
        lectures: [{
          id: 71,
          title: "&amp;amp;lt;strong style=&amp;amp;quot;color: red&amp;amp;quot;&amp;amp;gt;고등 수학&amp;amp;lt;/strong&amp;amp;gt;",
          enrollment_id: 301,
          video_count: 1,
          total_duration: 420,
          thumbnail_url: null,
          sessions: [{
            id: 24,
            title: "&amp;amp;lt;p&amp;amp;gt;1차시 · 미적분&amp;amp;lt;/p&amp;amp;gt;",
            order: 1,
            date: "2026-08-03",
          }],
        }],
      } });
      return;
    }
    if (path.endsWith("/student/video/sessions/24/videos/")) {
      await route.fulfill({ json: { items: [{
        id: 501,
        session_id: 24,
        enrollment_id: 301,
        title: "&amp;amp;lt;span class=&amp;amp;quot;legacy-title&amp;amp;quot;&amp;amp;gt;극한의 기본&amp;amp;lt;/span&amp;amp;gt;",
        status: "READY",
        source_type: "YOUTUBE",
        youtube_video_id: "dQw4w9WgXcQ",
        youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        thumbnail_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        duration: 420,
        progress: 0,
        completed: false,
        allow_skip: true,
        max_speed: 2,
        show_watermark: false,
        access_mode: "FREE_REVIEW",
        order: 1,
        view_count: 0,
        like_count: 0,
        comment_count: 0,
        is_liked: false,
        created_at: "2026-08-03T09:00:00+09:00",
      }] } });
      return;
    }
    if (path.endsWith("/student/video/videos/501/playback/")) {
      await route.fulfill({ json: {
        video: {
          id: 501,
          session_id: 24,
          enrollment_id: 301,
          title: "&amp;amp;lt;span&amp;amp;gt;극한의 기본&amp;amp;lt;/span&amp;amp;gt;",
          status: "READY",
          source_type: "YOUTUBE",
          youtube_video_id: "dQw4w9WgXcQ",
          youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          thumbnail_url: null,
          duration: 420,
          progress: 0,
          completed: false,
          allow_skip: true,
          max_speed: 2,
          show_watermark: false,
          access_mode: "FREE_REVIEW",
          order: 1,
          view_count: 0,
          like_count: 0,
          comment_count: 0,
          is_liked: false,
          created_at: "2026-08-03T09:00:00+09:00",
        },
        policy: {
          allow_seek: true,
          playback_rate: { max: 2, ui_control: true },
          watermark: { enabled: false, mode: "overlay", fields: [] },
          concurrency: { max_sessions: 1, max_devices: 1 },
          access_mode: "FREE_REVIEW",
          source: {
            type: "YOUTUBE",
            provider: "youtube",
            youtube_video_id: "dQw4w9WgXcQ",
          },
        },
      } });
      return;
    }
    if (path.endsWith("/student/video/videos/501/comments/")) {
      await route.fulfill({ json: { comments: [], total: 0 } });
      return;
    }
    if (path.endsWith("/clinic/sessions/")) {
      await route.fulfill({ json: options.legacyHtml ? [{
        id: 91,
        title: escapedHtml("보강 클리닉", "strong"),
        date: "2026-08-10",
        start_time: "18:00:00",
        end_time: "19:00:00",
        location: escapedHtml("2층 학습실", "span"),
        participant_count: 0,
        booked_count: 0,
        max_participants: 8,
        is_full: false,
        target_lecture_names: [{ id: 71, title: escapedHtml("수학 강의", "strong"), chip_label: escapedHtml("수학", "span") }],
      }] : [] });
      return;
    }
    if (path.endsWith("/clinic/idcard/")) {
      await route.fulfill({ json: options.legacyHtml ? {
        current_targets: [{
          clinic_link_id: 1,
          enrollment_id: 301,
          lecture_id: 71,
          lecture_title: escapedHtml("수학 강의", "strong"),
          lecture_chip_label: escapedHtml("수학", "span"),
          session_id: 24,
          session_order: 1,
          session_title: escapedHtml("정규 수업", "p"),
          source_type: "exam",
        }],
        current_result: "FAIL",
      } : { current_targets: [], current_result: "SUCCESS" } });
      return;
    }
    if (path.endsWith("/community/posts/77/")) {
      await route.fulfill({ json: {
        id: 77,
        title: "긴 안내문",
        content: "&amp;amp;lt;p style=&amp;amp;quot;width: 960px; margin-left: 240px; font-size: 44px&amp;amp;quot;&amp;amp;gt;학생과 학부모님께 드리는 안내입니다.&amp;amp;lt;/p&amp;amp;gt;&amp;amp;lt;table style=&amp;amp;quot;width: 900px&amp;amp;quot;&amp;amp;gt;&amp;amp;lt;tbody&amp;amp;gt;&amp;amp;lt;tr&amp;amp;gt;&amp;amp;lt;td&amp;amp;gt;아주긴주소https://example.com/abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789&amp;amp;lt;/td&amp;amp;gt;&amp;amp;lt;td&amp;amp;gt;두 번째 칸도 화면 안에서 읽혀야 합니다.&amp;amp;lt;/td&amp;amp;gt;&amp;amp;lt;/tr&amp;amp;gt;&amp;amp;lt;/tbody&amp;amp;gt;&amp;amp;lt;/table&amp;amp;gt;",
        post_type: "notice",
        created_at: "2026-08-02T09:00:00+09:00",
        updated_at: "2026-08-02T09:00:00+09:00",
        is_pinned: false,
        is_urgent: false,
        mappings: [],
        attachments: [],
      } });
      return;
    }
    if (path.endsWith("/student/grades/")) {
      await route.fulfill({ json: options.legacyHtml ? {
        exams: [{
          exam_id: 501,
          enrollment_id: 301,
          title: escapedHtml("중간고사", "strong"),
          total_score: 80,
          max_score: 100,
          is_pass: true,
          achievement: "PASS",
          meta_status: null,
          session_title: escapedHtml("정규 수업", "p"),
          lecture_title: escapedHtml("수학 강의", "strong"),
          submitted_at: "2026-08-03T09:00:00+09:00",
        }],
        homeworks: [{
          homework_id: 601,
          enrollment_id: 301,
          title: escapedHtml("과제 제목", "strong"),
          score: null,
          max_score: 100,
          passed: false,
          achievement: "NOT_SUBMITTED",
          session_title: escapedHtml("정규 수업", "p"),
          lecture_title: escapedHtml("수학 강의", "strong"),
        }],
        exam_trend: [],
        exam_summary: { scored_count: 1, average_score_pct: 80, latest_score_pct: 80, change_pct_points: null, best_score_pct: 80 },
        lecture_options: [{ id: 71, title: escapedHtml("수학 강의", "strong"), color: null, chip_label: escapedHtml("수학", "span") }],
        labels: { pass: escapedHtml("통과", "span"), fail: escapedHtml("재도전", "span") },
      } : emptyGrades(options.examId) });
      return;
    }
    if (path.endsWith("/student/grades/analytics/")) {
      await route.fulfill({ json: {
        summary: { exam_count: 0, scored_exam_count: 0, avg_score_pct: null, median_score_pct: null, pass_rate_pct: null, not_submitted_count: 0, risk_level: "insufficient" },
        trends: options.legacyHtml ? [{ exam_id: 501, title: escapedHtml("중간고사", "strong"), lecture_title: escapedHtml("수학 강의", "strong"), submitted_at: "2026-08-03T09:00:00+09:00", score_pct: 80, cohort_avg_pct: 70, rank: 1, percentile: 90, cohort_size: 10 }] : [],
        lecture_breakdown: options.legacyHtml ? [{ lecture_title: escapedHtml("수학 강의", "strong"), exam_count: 1, avg_score_pct: 80 }] : [],
        weak_questions: [],
        homework: { assigned_count: 0, graded_count: 0, avg_score_pct: null, pass_rate_pct: null },
        highlights: options.legacyHtml ? { latest_exam: { exam_id: 501, title: escapedHtml("중간고사", "strong"), score_pct: 80 }, best_exam: null, weakest_exam: null } : { latest_exam: null, best_exam: null, weakest_exam: null },
        insights: options.legacyHtml ? [escapedHtml("학습 흐름이 안정적입니다", "p")] : [],
      } });
      return;
    }
    if (path.endsWith("/clinic/participants/")) {
      await route.fulfill({ json: options.legacyHtml ? [{
        id: 301,
        session: 91,
        session_title: escapedHtml("보강 클리닉", "strong"),
        session_date: "2026-08-10",
        session_start_time: "18:00:00",
        session_location: escapedHtml("2층 학습실", "span"),
        status: "pending",
        memo: escapedHtml("복습 요청", "p"),
        created_at: "2026-08-03T09:00:00+09:00",
      }] : [] });
      return;
    }
    if (path.endsWith("/community/posts/notices/") || path.endsWith("/community/posts/board/") || path.endsWith("/community/posts/materials/")) {
      await route.fulfill({ json: options.legacyHtml ? [{
        id: 81,
        post_type: path.includes("notices") ? "notice" : path.includes("materials") ? "materials" : "board",
        title: escapedHtml("커뮤니티 안내", "strong"),
        content: "<p>안내 본문</p>",
        created_by: 1,
        created_by_display: escapedHtml("담당 선생님", "span"),
        created_at: "2026-08-03T09:00:00+09:00",
        mappings: [{ id: 1, post: 81, node: 1, created_at: "2026-08-03T09:00:00+09:00", node_detail: { id: 1, level: "SESSION", lecture: 71, session: 24, lecture_title: escapedHtml("수학 강의", "strong"), session_title: escapedHtml("정규 수업", "p") } }],
        attachments: [],
      }] : [] });
      return;
    }
    if (path.endsWith("/community/posts/")) {
      await route.fulfill({ json: { count: options.legacyHtml ? 1 : 0, next: null, previous: null, results: options.legacyHtml ? [{
        id: 82,
        post_type: "qna",
        title: escapedHtml("질문 제목", "strong"),
        content: "<p>질문 본문</p>",
        created_by: 11,
        created_by_display: escapedHtml("학생 이름", "span"),
        created_at: "2026-08-03T09:00:00+09:00",
        replies_count: 0,
        mappings: [],
        attachments: [],
      }] : [] } });
      return;
    }
    if (path.endsWith("/community/posts/my-activity/")) {
      await route.fulfill({ json: {
        is_student: true,
        days: 30,
        post_count: 1,
        reply_count: 0,
        received_likes: 0,
        rank: 1,
        total_active_students: 1,
        badges: options.legacyHtml ? [{ key: "first-post", label: escapedHtml("첫 글", "span") }] : [],
      } });
      return;
    }
    await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });
}

test.describe("학생·학부모 콘텐츠 안정성", () => {
  test.skip(!IS_LOCAL_BASE, "Local route-mock contract spec.");
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  test("여러 번 이스케이프된 공지 HTML을 안전하게 복원하고 붙여넣기 레이아웃을 격리한다", async ({ page }) => {
    await installStudentApi(page);
    await page.goto(`${BASE}/student/notices/77`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const content = page.locator(".stu-html-content");
    await expect(content).toContainText("학생과 학부모님께 드리는 안내입니다.");
    await expect(content).not.toContainText("<p style=");
    await expect(content.locator("p")).toHaveCount(1);
    await expect(content.locator("[style]")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.setViewportSize({ width: 320, height: 720 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect.poll(() => content.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= window.innerWidth + 1;
    })).toBe(true);
  });

  test("같은 기기의 다른 학생은 동일 시험의 새 성적 읽음 상태를 공유하지 않는다", async ({ page }) => {
    let profileId = 11;
    await installStudentApi(page, { profileId: () => profileId, examId: 501 });

    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("1개의 알림")).toBeVisible();

    await page.goto(`${BASE}/student/notifications`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("공통 진단평가", { exact: true })).toBeVisible();
    await expect(page.getByLabel("1개의 알림")).toHaveCount(0);

    profileId = 22;
    await page.goto(`${BASE}/student/grades`, { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("1개의 알림")).toBeVisible();
  });

  test("영상 홈·차시·재생목록은 다중 이스케이프 HTML을 일반 텍스트로만 표시한다", async ({ page }) => {
    await installStudentApi(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/student/video`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    await expect(page.getByText("고등 수학", { exact: true })).toBeVisible();
    await assertNoRenderedHtmlLeak(page);

    await page.getByRole("link", { name: /고등 수학/ }).click();
    await expect(page.getByRole("heading", { name: "고등 수학" })).toBeVisible();
    await expect(page.getByText("1차시 · 미적분", { exact: true })).toBeVisible();
    await assertNoRenderedHtmlLeak(page);

    await page.getByRole("link", { name: /1차시 · 미적분/ }).click();
    await expect(page.getByText("극한의 기본", { exact: true })).toBeVisible();
    await assertNoRenderedHtmlLeak(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoRenderedHtmlLeak(page);
  });

  test("학생·학부모 주요 목록은 레거시 HTML 제목과 범위명을 노출하지 않는다", async ({ page }) => {
    test.setTimeout(4 * 60_000);
    await installStudentApi(page, { legacyHtml: true });
    const routes = [
      ["/student/dashboard", "이번 주 안내"],
      ["/student/sessions/24", "정규 수업"],
      ["/student/attendance", "수학 강의"],
      ["/student/exams", "진단 평가"],
      ["/student/grades", "중간고사"],
      ["/student/submit/assignment", "과제 제목"],
      ["/student/clinic", "보강 클리닉"],
      ["/student/qna", "질문 제목"],
      ["/student/notifications", "중간고사"],
      ["/student/profile", "학생 이름"],
    ] as const;

    for (const [path, expectedText] of routes) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await assertNoRenderedHtmlLeak(page);
      await expect(page.locator("body"), path).toContainText(expectedText);
    }

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`${BASE}/student/dashboard`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await assertNoRenderedHtmlLeak(page);
  });

  test("주요 학생 화면은 API 장애에도 빈 화면 대신 다시 시도 동작을 제공한다", async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await installStudentApi(page, { failDataRequests: true });
    const routes = [
      ["/student/dashboard", "정보를 불러오지 못했어요."],
      ["/student/sessions", "일정을 불러오지 못했습니다."],
      ["/student/attendance", "출결 정보를 불러오지 못했습니다"],
      ["/student/exams", "시험을 불러오지 못했습니다"],
      ["/student/grades", "성적을 불러올 수 없습니다."],
      ["/student/notices", "공지를 불러오지 못했습니다."],
      ["/student/community", "공지사항을 불러오지 못했습니다"],
      ["/student/notifications", "알림을 불러오지 못했습니다"],
      ["/student/clinic", "클리닉 정보를 불러오지 못했습니다"],
      ["/student/fees", "청구서를 불러오지 못했습니다"],
      ["/student/profile", "프로필을 불러오지 못했습니다."],
      ["/student/video/sessions/24", "재생 목록을 불러오지 못했어요"],
    ] as const;

    for (const [path, errorText] of routes) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await expect(page.locator("body"), path).toContainText(errorText);
      await expect(page.getByRole("button", { name: "다시 시도" }), path).toBeVisible();
      await assertNoRenderedHtmlLeak(page);
    }
  });
});
