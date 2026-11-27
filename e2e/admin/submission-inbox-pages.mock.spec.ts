import { readFile } from "node:fs/promises";
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
    if (path === "/submissions/submissions/homework/review-queue/") {
      if (state.pendingHomework === null) return json({ detail: "QA 제출 목록 조회 실패" }, 503);
      const results = Array.from({ length: state.pendingHomework }, (_, index) => ({
        homework_id: index ? 72 : 71, enrollment_id: 10 + index,
        student_name: `QA 제출 학생 ${index + 1}`, homework_title: "QA 워크북",
        lecture_title: index ? "QA 영어" : "QA 수학", session_title: "첫 차시",
        submitted_at: "2026-10-09T00:00:00Z", file_count: 2,
      }));
      return json({ count: results.length, page: 1, pages: 1, results });
    }
    if (path === "/results/admin/sessions/32/scores/") return json({ meta: { exams: [], homeworks: [] }, rows: [] });
    if (path === "/results/admin/sessions/31/scores/") return json({
      meta: { exams: [], homeworks: [] },
      rows: [{ enrollment_id: 10, student_name: "QA 과제 제출 학생", exams: [], homeworks: [] }],
    });
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

for (const role of ["owner", "teacher", "staff"] as const) {
  const mobile = role !== "owner";
  test(`제출함에서 다른 강의의 과제를 찾아 검토 화면으로 바로 연다 ${role}`, async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1366, height: 900 });
    const state = await setup(page, role);
    const path = mobile ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
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
    const missingNotice = page.getByRole("button", { name: "미제출 알림 발송", exact: true });
    if (role === "staff") {
      await expect(missingNotice).toHaveCount(0);
    } else {
      await page.route("**/messaging/manual-notification/preview/", route => {
        expect(route.request().postDataJSON()).toMatchObject({
          trigger: "assignment_not_submitted", context_source: { type: "assignment_not_submitted", homework_id: 71 },
        });
        expect(route.request().postDataJSON()).not.toHaveProperty("student_ids");
        const recipients = mobile ? [{
          student_id: 91, student_name: "QA 미제출 학생", full_message_body: "QA 워크북 미제출 안내",
          phone_masked: "010-****-0091", excluded: false,
        }] : [];
        return route.fulfill({ json: { preview_token: recipients.length ? "qa-preview" : null,
          recipients, total_count: recipients.length, sendable_count: recipients.length, excluded_count: 0 } });
      });
      await missingNotice.click();
      if (mobile) {
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("radio")).toHaveCount(1);
        await expect(dialog.getByRole("radio")).toContainText("QA 미제출 학생");
        await expect(dialog.locator(".kakao-alimtalk-preview__body")).toHaveText("QA 워크북 미제출 안내");
      } else {
        await expect(page.getByText("발송 가능한 대상이 없습니다. 제외 사유를 확인해 주세요.")).toBeVisible();
      }
      await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
    }
    expect(new Set(state.homeworkSubmissionRequests)).toEqual(new Set([71]));
    await page.goBack();
    await expect(math).toBeVisible();
    await page.getByRole("button", { name: "제출함으로 돌아가기", exact: true }).click();
    await expect(page.getByText("QA 학생 001", { exact: true })).toBeVisible();
    if (mobile) {
      await gotoAndSettle(page, `${BASE}/workspace/mobile/notifications`);
      await page.getByRole("button", { name: "과제 제출 확인", exact: true }).click();
      await expect(math).toBeVisible();
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(state.mutations).toEqual([]);
  });
}

for (const teacher of [false, true]) {
  test(`확인 대기 과제의 빨간 배지가 첫 방문·새로고침·처리 후 건수를 반영한다 ${teacher ? "staff" : "owner"}`, async ({ page }) => {
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
    await expect(toast).toHaveCount(0);
    const badge = page.getByRole("link", { name: "확인 대기 과제 제출 1건 열기", exact: true });
    await expect(badge).toBeVisible();
    await badge.click();
    const math = page.getByRole("link", { name: /QA 워크북.*QA 수학/ });
    await expect(math).toContainText("QA 제출 학생 1");
    await expect(math).toContainText("파일 2개");
    await expect(math).toHaveAttribute("href", /reviewEnrollment=10/);
    await expect(page.getByRole("link", { name: /QA 워크북.*QA 영어/ })).toHaveCount(0);
    expect(state.homeworkSubmissionRequests).toEqual([]);

    await page.reload();
    await expect(math).toBeVisible();
    await expect(badge).toBeVisible();
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
    await expect(page.getByText("확인 대기 제출물을 불러오지 못했습니다", { exact: true })).toBeVisible();
    state.pendingHomework = 2;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByText("확인 대기 2건", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /QA 제출 학생 2.*QA 영어/ })).toBeVisible();
    await expect(page.getByText(/확인 대기 과제 제출 \d건 추가/)).toHaveCount(0);
    state.pendingHomework = 0;
    await page.clock.fastForward(31_000);
    await expect(page.getByText("확인 대기 과제가 없습니다", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /확인 대기 과제 제출 .*건 열기/ })).toHaveCount(0);
  });
}

for (const mobile of [false, true]) {
  test(`과제 사진 자동 표시와 일괄 통과의 일부 충돌 복구 ${mobile ? "390px" : "desktop"}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: mobile ? 390 : 1366, height: 900 });
    await setup(page, mobile ? "teacher" : "owner");
    const rows = [11, 12, 13].map((id, i) => ({
      id, enrollment_id: id, student_id: id + 30, student_name: `QA 학생 ${id}`,
      status: "submitted", submitted_at: "2026-10-09T00:00:00Z", teacher_accepted: false,
      teacher_accepted_updated_at: null, media_set_fingerprint: "a".repeat(64),
      files: [{ id: String(id), position: 0, media_kind: "image", mime_type: "image/png",
        original_filename: "풀이.png", status: i === 2 ? "uploading" : "uploaded" }],
    }));
    const calls: number[] = [];
    await page.route(/\/submissions\/submissions\/homework\/71\/\?/, route =>
      route.fulfill({ json: { count: rows.length, results: rows, next: null } }));
    const picture = await readFile(new URL("../fixtures/documents/public-resource-bars.png", import.meta.url));
    await page.route("**/submissions/submissions/homework/71/media/*/preview/", route =>
      route.fulfill({ json: { url: `data:image/png;base64,${picture.toString("base64")}`, expires_in: 600, media_kind: "image" } }));
    await page.route("**/submissions/submissions/homework/71/acceptance/", route => {
      const body = route.request().postDataJSON();
      const row = rows.find(item => item.enrollment_id === body.enrollment_id)!;
      calls.push(row.enrollment_id);
      expect(body.accepted).toBe(true);
      expect(body.expected_media_set_fingerprint).toBe(row.media_set_fingerprint);
      if (row.enrollment_id === 12 && calls.filter(id => id === 12).length === 1) {
        row.media_set_fingerprint = "b".repeat(64);
        return route.fulfill({ status: 409, json: { detail: "제출 파일이 변경되었습니다." } });
      }
      row.teacher_accepted = true;
      return route.fulfill({ json: { teacher_accepted: true } });
    });
    const path = mobile ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
    await gotoAndSettle(page, `${BASE}${path}`);
    await page.getByRole("button", { name: "과제 제출 확인", exact: true }).click();
    await page.getByRole("link", { name: /QA 워크북.*QA 수학/ }).click();
    const photo = page.getByRole("img", { name: "1번 제출 사진" }).first();
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.getByLabel(/통과 대상 전체 선택/).check();
    await expect(page.getByLabel("QA 학생 13 통과 대상 선택")).toHaveCount(0);
    if (!mobile) {
      const first = await page.locator("article").filter({ has: page.getByLabel("QA 학생 11 통과 대상 선택") }).boundingBox();
      const second = await page.locator("article").filter({ has: page.getByLabel("QA 학생 12 통과 대상 선택") }).boundingBox();
      expect(first && second && second.x > first.x && Math.abs(second.y - first.y) < 2).toBe(true);
    }
    await testInfo.attach("homework-bulk-selection", { body: await page.screenshot(), contentType: "image/png" });
    await page.getByText("QA 학생 13", { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("group", { name: "과제 일괄 통과" })).toBeInViewport();
    await page.getByRole("button", { name: "선택 2명 통과" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "2명 통과 처리" }).click();
    await expect(page.getByText("통과 1명 · 저장 실패 1명")).toBeVisible();
    await expect(page.getByLabel("QA 학생 12 통과 대상 선택")).not.toBeChecked();
    await page.getByLabel("QA 학생 12 통과 대상 선택").check();
    await page.getByRole("button", { name: "선택 1명 통과" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "1명 통과 처리" }).click();
    await expect(page.getByText("통과 인정됨", { exact: true })).toHaveCount(2);
    await page.reload();
    await expect(page.getByText("통과 인정됨", { exact: true })).toHaveCount(2);
    expect(calls.slice().sort()).toEqual([11, 12, 12]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
for (const mobile of [false, true]) {
  test(`같은 이름 과제의 학생별 제출물과 다음 제출·목록 위치를 유지한다 ${mobile ? "390px" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1366, height: 900 });
    const state = await setup(page, mobile ? "staff" : "owner");
    state.pendingHomework = 32;
    state.submissionPending = 0;
    const submittedAt = "2026-10-09T00:00:00Z";
    const queue = Array.from({ length: 32 }, (_, index) => ({
      homework_id: index === 31 ? 72 : 71,
      enrollment_id: 100 + index,
      student_name: `QA 대기 학생 ${index + 1}`,
      homework_title: "QA 워크북",
      lecture_title: index === 31 ? "QA 영어" : "QA 수학",
      session_title: "첫 차시",
      submitted_at: submittedAt,
      file_count: 1,
    }));
    await page.route(/\/homework\/review-queue\/\?/, route => {
      const current = Number(new URL(route.request().url()).searchParams.get("page"));
      return route.fulfill({ json: { page: current, pages: 2, count: 32, results: queue.slice((current - 1) * 30, current * 30) } });
    });
    await page.route("**/homeworks/72/", route => route.fulfill({ json: {
      id: 72, title: "QA 워크북", homework_type: "regular", session: 32,
    } }));
    const scopedRequests: string[] = [];
    await page.route(/\/submissions\/submissions\/homework\/(71|72)\/\?/, route => {
      const url = new URL(route.request().url());
      const homework = Number(url.pathname.split("/").at(-2));
      const enrollment = Number(url.searchParams.get("enrollment_id"));
      scopedRequests.push(`${homework}/${enrollment}`);
      const matching = queue.filter(row => row.homework_id === homework && row.enrollment_id === enrollment);
      const results = matching.map(row => ({
        ...row, id: row.enrollment_id, student_id: row.enrollment_id + 200, status: "submitted",
        created_at: submittedAt, homework_lecture_title: row.lecture_title, teacher_accepted: false,
        media_set_fingerprint: "a".repeat(64), files: [{
          id: String(row.enrollment_id), position: 0, media_kind: "image", mime_type: "application/pdf",
          original_filename: `${row.student_name} 풀이.pdf`, status: "uploaded", file_size: 1024,
        }],
      }));
      return route.fulfill({ json: { count: results.length, results, next: null } });
    });

    const path = mobile ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
    await gotoAndSettle(page, `${BASE}${path}`);
    await page.getByRole("link", { name: "확인 대기 과제 제출 32건 열기", exact: true }).click();
    const pager = page.getByRole("navigation", { name: "제출 목록 페이지" });
    await pager.getByRole("button", { name: "다음", exact: true }).click();
    await expect(page).toHaveURL(/[?&]queuePage=2(?:&|$)/);
    await expect(pager).toContainText("2 / 2");
    const list = page.getByRole("list", { name: "확인 대기 학생 제출물" });
    const math = list.getByRole("link").filter({ hasText: "QA 수학" });
    const english = list.getByRole("link").filter({ hasText: "QA 영어" });
    await expect(math).toContainText("QA 대기 학생 31");
    await expect(english).toContainText("QA 대기 학생 32");
    await expect(math).toContainText("QA 워크북");
    await expect(english).toContainText("QA 워크북");
    await math.click();

    async function expectFocused(index: number) {
      const row = queue[index];
      await expect(page).toHaveURL(new RegExp(`reviewEnrollment=${row.enrollment_id}.*queuePage=2`));
      await expect(page.getByText(`${row.student_name} 풀이.pdf`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${row.lecture_title} · ${row.session_title}`, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "미리보기", exact: true })).toHaveCount(1);
      await expect(page.getByRole("group", { name: "과제 일괄 통과" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "전체 과제 보기", exact: true })).toBeVisible();
      expect(scopedRequests).toContain(`${row.homework_id}/${row.enrollment_id}`);
    }

    await expectFocused(30);
    await page.getByRole("link", { name: "다음 대기 제출 · QA 대기 학생 32", exact: true }).click();
    await expectFocused(31);
    await expect(page.getByText("QA 대기 학생 31 풀이.pdf", { exact: true })).toHaveCount(0);
    const refreshedRow = queue[31];
    await Promise.all([
      page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.ok() && url.pathname.endsWith(`/submissions/submissions/homework/${refreshedRow.homework_id}/`)
          && url.searchParams.get("enrollment_id") === String(refreshedRow.enrollment_id);
      }),
      page.reload(),
    ]);
    await expectFocused(31);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: mobile ? "뒤로 가기" : "과제 목록으로 돌아가기", exact: true }).click();
    await expect(page).toHaveURL(/homework=pending.*queuePage=2|queuePage=2.*homework=pending/);
    await expect(math).toBeVisible();
    await expect(english).toBeVisible();
    expect(state.mutations).toEqual([]);
  });
}

test("390px 교사는 공유 시험의 조회 차시와 저장된 수강 성적을 구분한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, "teacher");
  await page.route("**/api/v1/submissions/submissions/pending/**", async route => {
    const row = { id: 811, target_type: "exam", target_id: 71, target_title: "공유 시험",
      target_resolved: true, status: "done", student_name: "이수강", enrollment_id: 10,
      lecture_id: null, session_id: null, session_resolution: "ambiguous", session_origin_recorded: false,
      score_lecture_id: 21, source: "online", created_at: "2026-10-09T00:00:00Z", session_choices: [
        { lecture_id: 21, lecture_title: "수학 A", session_id: 31, session_title: "첫 차시" },
        { lecture_id: 22, lecture_title: "수학 B", session_id: 32, session_title: "둘째 차시" },
      ] };
    await route.fulfill({ json: { results: [row], count: 1, page: 1, pages: 1, page_size: 50,
      has_next: false, has_previous: false, summary: { failed: 0, real_failed: 0, discarded: 0 } } });
  });
  await page.route("**/api/v1/exams/71/", route => route.fulfill({ json: { id: 71, title: "공유 시험", session_ids: [31, 32] } }));
  await page.route("**/api/v1/lectures/sessions/32/", route => route.fulfill({ json: { id: 32, title: "둘째 차시" } }));
  let storedScore = 81;
  const writes: number[] = [];
  const resultScopes: Array<string | null> = [];
  await page.route("**/api/v1/results/admin/exams/71/results/**", route => {
    resultScopes.push(new URL(route.request().url()).searchParams.get("lecture_id"));
    return route.fulfill({ json: [
    { enrollment_id: 10, student_name: "이수강", exam_max_score: 100, final_score: storedScore, lecture_title: "수학 A", correction_session_id: 31 },
    { enrollment_id: 11, student_name: "다른학생", final_score: 72, lecture_title: "수학 B", correction_session_id: 32 },
  ] }); });
  await page.route("**/api/v1/exams/?**", route => route.fulfill({ json: { results: [{ id: 71, title: "공유 시험", max_score: 100 }] } }));
  await page.route("**/api/v1/enrollments/session-enrollments/**", route => route.fulfill({ json: { results: [
    { enrollment: 10, student_name: "이수강" }, { enrollment: 11, student_name: "다른학생" },
  ] } }));
  await page.route("**/api/v1/results/admin/sessions/31/scores/**", route => route.fulfill({ json: {
    meta: { exams: [{ exam_id: 71, title: "공유 시험", max_score: 100 }], homeworks: [] },
    rows: [{ enrollment_id: 10, student_name: "이수강", exams: [{ exam_id: 71, block: { score: storedScore, max_score: 100 } }], homeworks: [] }],
  } }));
  await page.route("**/api/v1/results/admin/sessions/31/score-draft/**", route => route.fulfill({ json: { changes: [] } }));
  await page.route("**/api/v1/results/admin/exams/71/enrollments/10/score/", route => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().headers()["x-score-session-id"]).toBe("31");
    storedScore = route.request().postDataJSON().score;
    writes.push(storedScore);
    return route.fulfill({ json: { ok: true, saved: true, projection_ready: true } });
  });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/submissions?filter=done`);
  await expect(page.getByText("응시 차시 미확인", { exact: true })).toBeVisible();
  const result = page.getByRole("button", { name: "결과", exact: true });
  await expect(result).toBeDisabled();
  await page.getByRole("combobox", { name: "열어볼 강의·차시" }).selectOption({ label: "수학 B · 둘째 차시" });
  await result.click();
  await expect(page.getByText("조회 차시 · 둘째 차시")).toBeVisible();
  expect(resultScopes).toContain("21");
  await expect(page.getByRole("heading", { name: "이수강 · 저장된 성적" })).toBeVisible();
  await expect(page.getByText("다른학생", { exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "저장된 수강 성적 입력" }).click();
  await expect(page).toHaveURL(/\/mobile\/scores\/31\?exam=71&reviewEnrollment=10$/);
  const score = page.getByRole("textbox", { name: "이수강 합산 점수 입력" });
  await expect(score).toHaveValue("81");
  await expect(page.getByText("다른학생", { exact: true })).toHaveCount(0);
  await score.fill("85");
  await score.blur();
  await expect.poll(() => writes).toEqual([85]);
  await page.reload();
  await expect(score).toHaveValue("85");
});

for (const width of [1366, 1100, 390]) {
  test(`과제 대기목록의 파일 확인·다음 제출·부분 통과 복구 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page, "owner");
    state.submissionPending = 0;
    const submittedAt = "2026-11-25T07:24:00Z";
    const picture = await readFile(new URL("../fixtures/documents/public-resource-bars.png", import.meta.url));
    const inputs = [
      { homework: 71, enrollment: 201, name: "김서윤", lecture: "중등수학 A반", session: "4차시", title: "개념 확인", fileCount: 2 },
      { homework: 72, enrollment: 201, name: "김서윤", lecture: "중등수학 A반", session: "5차시", title: "응용 문제", fileCount: 1 },
      { homework: 73, enrollment: 202, name: "김서윤", lecture: "중등수학 B반", session: "4차시", title: "개념 확인", fileCount: 1 },
      { homework: 71, enrollment: 203, name: "이현우", lecture: "중등수학 A반", session: "4차시", title: "개념 확인", fileCount: 1 },
      { homework: 73, enrollment: 204, name: "박지민", lecture: "중등수학 B반", session: "4차시", title: "개념 확인", fileCount: 1 },
    ];
    const rows = inputs.map((input, i) => ({
      homework_id: input.homework, enrollment_id: input.enrollment, student_id: input.enrollment + 400,
      student_name: input.name, lecture_title: input.lecture, session_title: input.session, homework_title: input.title,
      submitted_at: submittedAt, file_count: input.fileCount, teacher_accepted: false, teacher_reviewed: false,
      teacher_accepted_updated_at: null, media_set_fingerprint: String(i + 1).repeat(64),
      files: Array.from({ length: input.fileCount }, (_, j) => ({
        id: String(7000 + i * 10 + j), position: j, status: "uploaded", media_kind: "image", mime_type: "image/png",
        original_filename: `${input.lecture} ${input.title} 풀이 ${j + 1}.png`, file_size: picture.length,
      })),
    }));
    state.pendingHomework = rows.length;
    const failedIndex = 2;
    const attempted: string[] = [];
    const detailReads: string[] = [];
    await page.route(/\/submissions\/submissions\/homework\/review-queue\/\?/, route => {
      const remaining = rows.filter(r => !r.teacher_accepted);
      return route.fulfill({ json: { count: remaining.length, page: 1, pages: 1, results: remaining } });
    });
    await page.route(/\/homeworks\/(71|72|73)\/$/, route => {
      const id = Number(new URL(route.request().url()).pathname.split("/").at(-2));
      return route.fulfill({ json: { id, title: rows.find(r => r.homework_id === id)!.homework_title, homework_type: "regular", session: id - 40 } });
    });
    await page.route(/\/submissions\/submissions\/homework\/(71|72|73)\/\?/, route => {
      const url = new URL(route.request().url());
      const id = Number(url.pathname.split("/").at(-2));
      const enrollment = Number(url.searchParams.get("enrollment_id"));
      detailReads.push(`${id}/${enrollment}`);
      const results = rows.filter(r => r.homework_id === id && r.enrollment_id === enrollment).map(r => ({
        ...r, id: r.student_id, homework_lecture_title: r.lecture_title, status: "submitted", created_at: submittedAt,
      }));
      return route.fulfill({ json: { count: results.length, results, next: null } });
    });
    await page.route(/\/homework\/(71|72|73)\/media\/\d+\/preview\//, route =>
      route.fulfill({ json: { url: `data:image/png;base64,${picture.toString("base64")}`, media_kind: "image", expires_in: 600 } }));
    await page.route(/\/homework\/(71|72|73)\/acceptance\//, route => {
      const id = Number(new URL(route.request().url()).pathname.split("/").at(-3));
      const body = route.request().postDataJSON();
      const row = rows.find(r => r.homework_id === id && r.enrollment_id === body.enrollment_id)!;
      const key = `${id}/${row.enrollment_id}`;
      expect(body).toMatchObject({ accepted: true, expected_media_set_fingerprint: row.media_set_fingerprint });
      attempted.push(key);
      if (row === rows[failedIndex] && attempted.filter(k => k === key).length === 1) {
        row.media_set_fingerprint = "b".repeat(64);
        return route.fulfill({ status: 409, json: { detail: "제출 파일이 변경되었습니다." } });
      }
      row.teacher_accepted = true;
      state.pendingHomework = rows.filter(entry => !entry.teacher_accepted).length;
      return route.fulfill({ json: { teacher_accepted: true } });
    });
    const path = "/workspace/results/submissions?homework=pending";
    const list = page.getByRole("list", { name: "확인 대기 학생 제출물" });
    const baseline = process.env.E2E_HOMEWORK_QUEUE_BASELINE_URL;
    if (baseline) {
      expect(new URL(baseline).hostname).toBe("127.0.0.1");
      await gotoAndSettle(page, `${baseline}${path}`);
      await expect(list.getByRole("link")).toHaveCount(rows.length);
      await page.screenshot({ path: testInfo.outputPath(`queue-before-${width}.png`), animations: "disabled" });
    }
    await gotoAndSettle(page, `${BASE}${path}`);
    await expect(list.getByRole("link")).toHaveCount(rows.length);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`queue-after-${width}.png`), animations: "disabled" });

    function checkbox(i: number) {
      const r = rows[i];
      return list.getByRole("checkbox", { name: `${r.student_name} · ${r.lecture_title} · ${r.session_title} · ${r.homework_title} 선택`, exact: true });
    }
    const first = list.getByRole("listitem").filter({ has: page.getByRole("checkbox", { name: "김서윤 · 중등수학 A반 · 4차시 · 개념 확인 선택", exact: true }) });
    await first.getByRole("button", { name: "김서윤 제출 파일 2개 미리보기" }).click();
    await expect(first.getByRole("button", { name: "미리보기", exact: true })).toHaveCount(2);
    const photo = first.getByRole("img", { name: "1번 제출 사진" });
    await expect.poll(() => photo.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await first.getByRole("button", { name: "미리보기", exact: true }).nth(1).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toContainText(rows[0].files[1].original_filename);
    await expect(modal).toContainText("김서윤 · 중등수학 A반 · 4차시 · 개념 확인");
    const fullImage = modal.getByRole("img", { name: `${rows[0].files[1].original_filename} 과제 제출 미리보기` });
    await expect.poll(() => fullImage.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await modal.getByRole("button", { name: "닫기", exact: true }).last().click();
    await first.getByRole("link").click();
    await expect(page.getByText(rows[0].files[1].original_filename, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "다음 대기 제출 · 김서윤", exact: true }).click();
    await expect(page).toHaveURL(/homework=72.*reviewEnrollment=201/);
    await expect(page.getByText(rows[1].files[0].original_filename, { exact: true })).toBeVisible();
    expect(detailReads).toContain("71/201");
    expect(detailReads).toContain("72/201");
    await page.getByRole("button", { name: "과제 목록으로 돌아가기", exact: true }).click();

    await page.getByRole("checkbox", { name: "이 페이지 전체 선택" }).check();
    const accept = page.getByRole("button", { name: "선택 5건 통과", exact: true });
    await expect(accept).toBeEnabled();
    for (let i = 0; i < rows.length; ++i) await expect(checkbox(i)).toBeChecked();
    await accept.click();
    await page.getByRole("button", { name: "5건 통과 처리", exact: true }).click();
    await expect(page.getByText("통과 4건 · 저장 실패 1건", { exact: true })).toBeVisible();
    await expect(list.getByRole("link")).toHaveCount(1);
    await expect(checkbox(failedIndex)).not.toBeChecked();
    await page.reload();
    await expect(list.getByRole("link")).toHaveCount(1);
    await checkbox(failedIndex).check();
    await page.getByRole("button", { name: "선택 1건 통과", exact: true }).click();
    await page.getByRole("button", { name: "1건 통과 처리", exact: true }).click();
    await expect(page.getByText("확인 대기 과제가 없습니다", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("확인 대기 과제가 없습니다", { exact: true })).toBeVisible();
    expect(attempted.sort()).toEqual(["71/201", "71/203", "72/201", "73/202", "73/202", "73/204"]);
    expect(state.mutations).toEqual([]);
  });
}
