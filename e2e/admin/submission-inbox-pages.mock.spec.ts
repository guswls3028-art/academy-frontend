import { expect, test, type Page } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5198";
test.use({ serviceWorkers: "block" });

async function setup(page: Page, role: "owner" | "teacher" | "staff") {
  await installTenantOneInitScript(page);
  const token = `e30.${Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url")}.sig`;
  await page.addInitScript((access) => { localStorage.setItem("access", access); localStorage.setItem("refresh", `${access}-refresh`); }, token);
  const rows = Array.from({ length: 205 }, (_, index) => ({ id: 205 - index,
    student_name: `QA 학생 ${String(205 - index).padStart(3, "0")}`, enrollment_id: 10,
    target_type: "exam", target_id: 71, target_title: "QA 수학 시험", lecture_id: 21,
    lecture_title: "QA 수학", session_id: 31, target_resolved: true, source: "omr_scan",
    status: "needs_identification", is_discarded: false, has_file: false,
    created_at: "2026-10-09T00:00:00+09:00" }));
  const extra = ["done", "failed", "failed"].map((status, index) => ({ ...rows[0], id: 301 + index,
    student_name: `QA ${status} ${index}`, status, is_discarded: index === 2 }));
  const all = [...rows, ...extra];
  const state = { failPage: 0, failHomeworkList: false, pendingHomework: 0 as number | null, submissionPending: 205, homeworkSubmissionRequests: [] as number[], mutations: [] as string[] };
  const homework = { id: 71, title: "QA 워크북", homework_type: "regular", session: 31 };
  const otherHomework = { ...homework, id: 72, session: 32 };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (data: unknown, status = 200) => route.fulfill({ json: data, status });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (request.method() !== "GET") { state.mutations.push(path); return json({ detail: "Unexpected mutation" }, 400); }
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "QA 학원", is_active: true, feature_flags: {}, ui_config: {} });
    if (path === "/core/me/") return json({ id: 12, name: "QA 교직원", username: "qa-staff", tenantRole: role, is_staff: true, must_change_password: false, first_login_guide_required: false });
    if (path === "/core/subscription/") return json({ plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 });
    if (path === "/core/landing/admin/consult/") return json({ items: [], summary: { total: 0, unread: 0 } });
    if (path === "/results/admin/teacher-dashboard-counts/") {
      return json({
        video_failed: 0, qna_pending: 0, counsel_pending: 0, submission_pending: state.submissionPending,
        ...(state.pendingHomework === null ? {} : {
          homework_review_pending: state.pendingHomework,
          homework_review_by_homework: state.pendingHomework ? { 71: state.pendingHomework } : {},
        }),
      });
    }
    if (path === "/lectures/attendance/arrival-overview/") return json({
      generated_at: "2026-10-09T09:00:00+09:00", soon_window_minutes: 60,
      today: "2026-10-09", tomorrow: "2026-10-10", range_end: "2026-10-15", range_days: 7,
      summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 }, items: [],
    });
    if (path === "/homeworks/") {
      if (state.failHomeworkList) return json({ detail: "QA 과제 목록 조회 실패" }, 400);
      expect(url.searchParams.get("homework_type")).toBe("regular");
      expect(url.searchParams.has("session_id")).toBe(false);
      return json({ results: [homework, otherHomework], count: 2, next: null });
    }
    if (path === "/homeworks/71/") return json(homework);
    if (path === "/lectures/sessions/") return json([
      { id: 31, lecture: 21, title: "첫 차시" }, { id: 32, lecture: 22, title: "첫 차시" },
    ]);
    if (path === "/lectures/lectures/") return json([
      { id: 21, title: "QA 수학" }, { id: 22, title: "QA 영어" },
    ]);
    const homeworkSubmission = /^\/submissions\/submissions\/homework\/(\d+)\/$/.exec(path);
    if (homeworkSubmission) {
      state.homeworkSubmissionRequests.push(Number(homeworkSubmission[1]));
      return json({ results: [{
        id: 501, student_name: "QA 과제 제출 학생", enrollment_id: 10,
        status: "submitted", submitted_at: "2026-10-09T00:00:00+09:00", files: [],
      }], count: 1, next: null });
    }
    if (path === "/submissions/submissions/pending/") {
      if (!url.searchParams.has("page")) return json(rows.slice(0, 200));
      const requested = Number(url.searchParams.get("page") || 1);
      if (state.failPage === requested) return json({ detail: "QA 목록 조회 실패" }, 400);
      const filter = url.searchParams.get("filter") || "all";
      let selected = all.filter((row) => filter === "all" || (filter === "pending" ? row.status === "needs_identification" : row.status === filter));
      const kind = url.searchParams.get("failed_type") || "all";
      if (filter === "failed" && kind !== "all") selected = selected.filter((row) => row.is_discarded === (kind === "discarded"));
      const pages = Math.max(1, Math.ceil(selected.length / 50));
      const current = Math.min(requested, pages);
      return json({ results: selected.slice((current - 1) * 50, current * 50), count: selected.length,
        page: current, page_size: 50, pages, has_next: current < pages, has_previous: current > 1,
        summary: { failed: 2, real_failed: 1, discarded: 1 } });
    }
    return json({ count: 0, results: [] });
  });
  return state;
}

for (const teacher of [false, true]) {
  for (const width of [390, 1366]) {
    test(`제출함은 200건 이후와 전체 상태 필터·reload·조회 복구를 보존한다 ${teacher ? "teacher" : "admin"} ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const state = await setup(page, teacher ? "teacher" : "owner");
      const path = teacher ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
      await gotoAndSettle(page, `${BASE}${path}?page=5`);
      await expect(page.getByText("대기 중인 시험 답안은 모두 표시합니다. 완료·실패·폐기는 최근 24시간에 접수된 답안만 표시합니다.", { exact: true })).toBeVisible();
      await expect(page.getByText("QA 학생 001", { exact: true })).toBeVisible();
      const pager = page.getByRole("navigation", { name: "제출 목록 페이지", exact: true });
      await expect(pager).toContainText("전체 205건");
      await page.reload();
      await expect(page.getByText("QA 학생 001", { exact: true })).toBeVisible();
      if (!teacher) {
        await page.getByRole("checkbox", { name: "row 선택", exact: true }).first().check();
        await expect(page.getByText("1건 선택됨", { exact: true })).toBeVisible();
      }
      state.failPage = 4;
      await pager.getByRole("button", { name: "이전 페이지", exact: true }).click();
      await expect(page.getByText("제출 목록을 불러올 수 없습니다.", { exact: true })).toBeVisible();
      await expect(page.getByText("QA 학생 001", { exact: true })).toHaveCount(0);
      state.failPage = 0;
      await page.getByRole("button", { name: "다시 시도", exact: true }).click();
      await expect(page.getByText("QA 학생 055", { exact: true })).toBeVisible();
      if (!teacher) await expect(page.getByText("1건 선택됨", { exact: true })).toHaveCount(0);
      await page.getByRole(teacher ? "button" : "tab", { name: "완료", exact: true }).click();
      await expect(page.getByText("QA done 0", { exact: true })).toBeVisible();
      await expect(pager).toContainText("전체 1건");
      await page.getByRole(teacher ? "button" : "tab", { name: "실패/폐기", exact: true }).click();
      await expect(page.getByText("QA failed 1", { exact: true })).toBeVisible();
      if (!teacher) {
        await page.getByRole("button", { name: "폐기됨 1", exact: true }).click();
        await expect(page.getByText("QA failed 1", { exact: true })).toHaveCount(0);
        await expect(page.getByText("QA failed 2", { exact: true })).toBeVisible();
      }
      await page.reload();
      await expect(page.getByText("QA failed 2", { exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      for (const button of await pager.getByRole("button").all()) expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: test.info().outputPath(`submission-pages-${teacher}-${width}.png`), animations: "disabled" });
      expect(state.mutations).toEqual([]);
    });
  }
}

for (const teacher of [false, true]) {
  test(`제출함에서 다른 강의의 과제를 찾아 검토 화면으로 바로 연다 ${teacher ? "teacher" : "admin"}`, async ({ page }) => {
    await page.setViewportSize({ width: teacher ? 390 : 1366, height: 900 });
    const state = await setup(page, teacher ? "staff" : "owner");
    const path = teacher ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
    await gotoAndSettle(page, `${BASE}${path}?page=5`);
    state.failHomeworkList = true;
    await page.getByRole("button", { name: "과제 제출 확인", exact: true }).click();
    await expect(page.getByText("과제 목록을 불러오지 못했습니다", { exact: true })).toBeVisible();
    state.failHomeworkList = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    const math = page.getByRole("link", { name: /QA 워크북.*QA 수학/ });
    await expect(math).toBeVisible();
    await expect(page.getByRole("link", { name: /QA 워크북.*QA 영어/ })).toBeVisible();
    await page.reload();
    await expect(math).toBeVisible();
    expect(state.homeworkSubmissionRequests).toEqual([]);
    await math.click();
    await expect(page.getByText("QA 과제 제출 학생", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("QA 과제 제출 학생", { exact: true })).toBeVisible();
    expect(new Set(state.homeworkSubmissionRequests)).toEqual(new Set([71]));
    await page.goBack();
    await expect(math).toBeVisible();
    await page.getByRole("button", { name: "제출함으로 돌아가기", exact: true }).click();
    await expect(page.getByText("QA 학생 001", { exact: true })).toBeVisible();
    if (teacher) {
      await gotoAndSettle(page, `${BASE}/workspace/mobile/notifications`);
      await page.getByRole("button", { name: "과제 제출 확인", exact: true }).click();
      await expect(math).toBeVisible();
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(state.mutations).toEqual([]);
  });
}

for (const teacher of [false, true]) {
  test(`확인 대기 과제는 기존 알림에 집계되고 새 증가만 전면에서 한 번 알린다 ${teacher ? "staff" : "owner"}`, async ({ page }) => {
    await page.setViewportSize({ width: teacher ? 390 : 1366, height: 900 });
    await page.clock.install();
    const state = await setup(page, teacher ? "staff" : "owner");
    state.submissionPending = 0;
    const path = teacher ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
    await gotoAndSettle(page, `${BASE}${path}?homework=pending`);
    await expect(page.getByText("확인 대기 과제가 없습니다", { exact: true })).toBeVisible();

    state.pendingHomework = 1;
    await page.clock.fastForward(31_000);
    const toast = page.getByText("확인 대기 과제 제출 1건 추가", { exact: true });
    await expect(toast).toHaveCount(1);
    await page.getByRole("button", { name: "확인 대기 과제 보기", exact: true }).click();
    const math = page.getByRole("link", { name: /QA 워크북.*QA 수학/ });
    await expect(math).toContainText("확인 대기 1건");
    await expect(page.getByRole("link", { name: /QA 워크북.*QA 영어/ })).toHaveCount(0);
    expect(state.homeworkSubmissionRequests).toEqual([]);

    await page.reload();
    await expect(math).toBeVisible();
    await expect(toast).toHaveCount(0);
    if (teacher) {
      await page.getByRole("button", { name: "알림 1건", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "알림", exact: true }).click();
    }
    const pendingItem = page.getByRole("button", { name: /확인 대기 과제 제출/ });
    await expect(pendingItem).toContainText("1건");
    await pendingItem.click();
    await expect(math).toBeVisible();
    state.pendingHomework = null;
    await page.clock.fastForward(31_000);
    await expect(page.getByText("확인 대기 과제를 불러오지 못했습니다", { exact: true })).toBeVisible();
    state.pendingHomework = 2;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(math).toContainText("확인 대기 2건");
    await expect(page.getByText(/확인 대기 과제 제출 \d건 추가/)).toHaveCount(0);
    state.pendingHomework = 0;
    await page.clock.fastForward(31_000);
    await expect(page.getByText("확인 대기 과제가 없습니다", { exact: true })).toBeVisible();
  });
}
