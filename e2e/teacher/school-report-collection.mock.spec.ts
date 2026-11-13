import { expect, test, type Page } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5187";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(base), "Local synthetic API only");
test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });

async function mockSchoolReports(page: Page, role: "teacher" | "student") {
  await installTenantOneInitScript(page);
  const payload = Buffer.from(JSON.stringify({ exp: 4_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, `e30.${payload}.signature`);
  const state = {
    reminders: [] as unknown[],
    directSaves: [] as unknown[],
    selectedLectures: [] as string[],
    scores: [] as Array<{ id: number; subject: string; score: number; max_score: number; grade_rank: null }>,
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const reply = (data: unknown) => route.fulfill({ json: data });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return reply({ tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} });
    if (path === "/core/me/") return reply({ id: 12, name: "검증 계정", username: "qa-score", is_staff: role === "teacher", tenantRole: role, must_change_password: false, first_login_guide_required: false });
    if (path === "/core/subscription/") return reply({ plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 });
    if (path === "/student/me/") return reply({ id: 12, name: "검증 학생", ps_number: "qa-score", first_login_guide_required: false });
    if (path === "/lectures/lectures/") return reply([{ id: 71, title: "검증 강의", is_active: true }]);
    if (path === "/results/school-reports/requests/") {
      state.reminders.push(request.postDataJSON());
      return reply({ requested: 1, skipped: 0 });
    }
    if (path === "/results/school-reports/") {
      const lecture = url.searchParams.get("lecture_id");
      if (lecture) state.selectedLectures.push(lecture);
      const requested_at = state.reminders.length ? "2026-11-13T08:00:00Z" : null;
      return reply({ count: 2, next: null, previous: null, total_count: 2, missing_count: 1, submitted_count: 1, results: [
        { student_id: 12, name: "미제출 학생", school: "검증고", grade: 1, status: "missing", can_request: !requested_at, requested_at, score_count: 0 },
        { student_id: 13, name: "제출 학생", school: "검증고", grade: 1, status: "submitted", can_request: false, requested_at: null, score_count: 1 },
      ] });
    }
    if (path === "/results/school-reports/me/") {
      if (request.method() === "PUT") {
        const data = request.postDataJSON();
        state.directSaves.push({ period: Object.fromEntries(url.searchParams), data });
        state.scores = data.subjects.map((subject: { subject: string; score: number; max_score: number }, index: number) => ({
          ...subject, id: index + 1, grade_rank: null,
        }));
      }
      const scores = url.searchParams.get("exam_round") === "first" ? state.scores : [];
      return reply({ ...Object.fromEntries(url.searchParams), student_name: "검증 학생", status: scores.length ? "submitted" : "missing",
        submitted_at: null, requested_at: null, scores, direct_scores: scores });
    }
    return reply([]);
  });
  return state;
}

test("미제출 대상만 선택하고 확인한 경우에만 앱 알림을 요청한다", async ({ page }) => {
  const state = await mockSchoolReports(page, "teacher");
  await gotoAndSettle(page, `${base}/workspace/mobile/results`);
  const reportsTab = page.getByRole("button", { name: "성적표 취합", exact: true });
  await expect(reportsTab).toBeVisible({ timeout: 20_000 });
  await reportsTab.click();
  await page.getByRole("button", { name: "2학기 중간", exact: true }).click();
  await page.getByRole("combobox", { name: "강의", exact: true }).selectOption("71");
  await expect(page.getByRole("checkbox", { name: "제출 학생 선택", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "이 페이지 선택", exact: true }).check();
  await expect(page.getByText("1명 선택", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "앱으로 제출 요청" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "성적표 제출 요청" });
  await confirmation.getByRole("button", { name: "취소" }).click();
  expect(state.reminders).toEqual([]);
  await page.getByRole("button", { name: "앱으로 제출 요청" }).click();
  await confirmation.getByRole("button", { name: "앱 알림 보내기" }).click();
  await expect(page.getByText("요청함", { exact: true })).toBeVisible();
  expect(state.reminders).toEqual([{ academic_year: expect.any(Number), semester: 2, exam_round: "first", student_ids: [12] }]);
  expect(state.selectedLectures).toContain("71");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

test("학생이 파일 없이 0점과 소수점을 제출하며 시험 구분이 섞이지 않는다", async ({ page }) => {
  const state = await mockSchoolReports(page, "student");
  await gotoAndSettle(page, `${base}/student/submit/school-report?academic_year=2026&semester=2&exam_round=first`);
  await page.getByRole("button", { name: "점수 직접 입력" }).click();
  await page.getByRole("textbox", { name: "과목 1" }).fill("수학");
  await page.getByRole("button", { name: "성적표 제출", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("1번째 과목명과 점수");
  expect(state.directSaves).toEqual([]);
  await page.getByRole("textbox", { name: "받은 점수 1" }).fill("0");
  await page.getByRole("button", { name: "+ 과목 추가" }).click();
  await page.getByRole("textbox", { name: "과목 2" }).fill("과학");
  await page.getByRole("textbox", { name: "받은 점수 2" }).fill("92.5");
  await page.getByRole("button", { name: "성적표 제출", exact: true }).click();
  await expect(page.getByText("성적표를 제출했습니다.", { exact: true })).toBeVisible();
  expect(state.directSaves).toEqual([{
    period: { academic_year: "2026", semester: "2", exam_round: "first" },
    data: { subjects: [{ subject: "수학", score: 0, max_score: 100 }, { subject: "과학", score: 92.5, max_score: 100 }] },
  }]);
  await page.getByRole("button", { name: "2학기 기말", exact: true }).click();
  await expect(page.getByText("미제출", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2학기 중간", exact: true }).click();
  await expect(page.getByText("92.5", { exact: true })).toBeVisible();
  expect(state.reminders).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});
