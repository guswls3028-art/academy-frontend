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

async function installStudentApi(
  page: Page,
  options: { profileId?: () => number; examId?: number } = {},
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
        display_name: "학원플러스",
        is_active: true,
        ui_config: {},
        feature_flags: {},
      } });
      return;
    }
    if (path.endsWith("/core/me/")) {
      await route.fulfill({ json: {
        id: profileId,
        username: `student-${profileId}`,
        name: `학생 ${profileId}`,
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        linkedStudents: [],
      } });
      return;
    }
    if (path.endsWith("/student/me/")) {
      await route.fulfill({ json: {
        id: profileId,
        username: `student-${profileId}`,
        name: `학생 ${profileId}`,
        displayName: `학생 ${profileId}`,
        is_student: true,
        isParentReadOnly: false,
      } });
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
      await route.fulfill({ json: emptyGrades(options.examId) });
      return;
    }
    if (path.endsWith("/student/grades/analytics/")) {
      await route.fulfill({ json: {
        summary: { exam_count: 0, scored_exam_count: 0, avg_score_pct: null, median_score_pct: null, pass_rate_pct: null, not_submitted_count: 0, risk_level: "insufficient" },
        trends: [], lecture_breakdown: [], weak_questions: [],
        homework: { assigned_count: 0, graded_count: 0, avg_score_pct: null, pass_rate_pct: null },
        highlights: { latest_exam: null, best_exam: null, weakest_exam: null },
        insights: [],
      } });
      return;
    }
    if (path.endsWith("/clinic/participants/")) {
      await route.fulfill({ json: [] });
      return;
    }
    if (path.endsWith("/community/posts/")) {
      await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
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
    await page.goto(`${BASE}/student/notices/77`, { waitUntil: "domcontentloaded" });

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
});
