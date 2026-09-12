import type { Locator, Page, TestInfo } from "@playwright/test";
import type { ScoreBlock, SessionScoresResponse } from "../../src/shared/api/contracts/sessionScores";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const TENANT = "qa-assessment-fixture";
const LECTURE_ID = 9701;
const SESSION_ID = 9702;
const EXAM_A = 9711;
const EXAM_B = 9712;
const HOMEWORK_ID = 9721;
const SESSION_PATH = `/workspace/mobile/classes/${LECTURE_ID}/sessions/${SESSION_ID}`;
const EXAM_A_TITLE = "가상 시험 A — 일차함수 그래프와 좌표 해석의 전체 풀이 확인";
const EXAM_B_TITLE = "가상 시험 B — 도형의 성질과 서술형 사고 과정 종합 점검";
const HOMEWORK_TITLE = "가상 과제 — 이번 주 개념 정리와 오답 풀이를 모두 확인하는 과제";
const SCORE_WRITE_FAILURE = "합성 점수 저장 실패 — 다시 시도해 주세요.";

type Scenario = "mixed" | "single" | "homework-only" | "completion" | "empty";

function block(score: number | null, options: Partial<ScoreBlock> = {}): ScoreBlock {
  return {
    score,
    max_score: 100,
    passed: score == null ? null : score >= 60,
    final_pass: score == null ? null : score >= 60,
    clinic_required: false,
    meta: { status: score == null ? "PENDING" : "DONE" },
    ...options,
  };
}

function makeScores(scenario: Scenario): SessionScoresResponse {
  const exams = ["homework-only", "completion", "empty"].includes(scenario) ? [] : [
    { exam_id: EXAM_A, title: EXAM_A_TITLE, pass_score: 60, max_score: 100, display_order: 1 },
    ...(scenario === "single" ? [] : [{ exam_id: EXAM_B, title: EXAM_B_TITLE, pass_score: 60, max_score: 100, display_order: 2 }]),
  ];
  const homeworks: SessionScoresResponse["meta"]["homeworks"] = scenario === "empty" ? [] : [{
    homework_id: HOMEWORK_ID, title: HOMEWORK_TITLE, unit: null,
    grading_mode: scenario === "completion" ? "COMPLETION" : "SCORE", max_score: 100, display_order: 1,
  }];
  return {
    meta: { session_title: "4차시", lecture_title: "가상 평가 검증반", lecture_id: LECTURE_ID, exams, homeworks },
    rows: Array.from({ length: 17 }, (_, index) => {
      const names = ["가상가람긴이름확인학생", "가상나래", "가상다온", "가상라온"];
      const a = index === 0 ? block(0)
        : index === 1 ? block(null, { meta: { status: "NOT_SUBMITTED" } })
          : index === 2 ? block(35, { final_pass: true, teacher_resolved: true, correction_status: "COMPLETED" })
            : index === 3 ? block(80, { correction_status: "PENDING" })
              : index === 4 ? block(80, { final_pass: false })
              : index === 5 ? block(20, { final_pass: true })
                : index === 6 ? block(40, { final_pass: false, teacher_resolved: true })
                  : block(80);
      const b = index === 1 ? block(null) : index === 3 ? block(20)
        : index === 4 ? block(48, { is_provisional: true }) : block(87);
      const homework = scenario === "completion"
        ? block(index === 0 ? 1 : index === 1 ? 0 : null, { final_pass: index === 0 ? true : index === 1 ? false : null })
        : index === 1 ? block(null, { meta: { status: "NOT_SUBMITTED" } })
        : index === 2 ? block(0, { final_pass: true, teacher_resolved: true, correction_status: "COMPLETED" })
          : index === 3 ? block(null) : block(100);
      return {
        enrollment_id: 9800 + index,
        student_id: 9900 + index,
        student_name: names[index] ?? `가상학생${String(index + 1).padStart(2, "0")}`,
        exams: exams.filter((exam) => index !== 7 || exam.exam_id !== EXAM_A).map((exam) => ({ ...exam, block: exam.exam_id === EXAM_A ? a : b })),
        homeworks: (index === 7 ? [] : homeworks).map((entry) => ({ ...entry, block: homework })),
        updated_at: "2026-09-01T09:00:00Z",
      };
    }),
  };
}

async function installScenario(page: Page, options: { scenario?: Scenario; failScores?: boolean; wrongCompletion?: boolean; failScoreWrite?: boolean } = {}) {
  const scores = makeScores(options.scenario ?? "mixed");
  let failScores = options.failScores ?? false;
  let failScoreWrite = options.failScoreWrite ?? false;
  let scoreRequests = 0;
  const resultRequests: number[] = [];
  const enrollmentRequests: Array<{ examId: number; sessionId: number }> = [];
  const mutations: Array<{ examId: number; enrollmentId: number; score: number; max_score: number }> = [];
  const failedPatches: Array<{ examId: number; enrollmentId: number; score: number; max_score: number }> = [];
  const leaseEvents: string[] = [];
  let leaseClient: string | null = null;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: TENANT, user_id: 9700 })}.sig`;
  await page.addInitScript(({ jwt, tenant }) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", tenant);
    sessionStorage.setItem("tenantCode", tenant);
  }, { jwt: token, tenant: TENANT });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    const list = (results: unknown[]) => json({ count: results.length, next: null, previous: null, results });
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({
      tenantCode: TENANT, display_name: "가상 평가 검증 학원", is_active: true, isPlatformAdmin: false,
      ui_config: {}, feature_flags: options.wrongCompletion ? { assessment_status_display: "wrong_completion" } : {},
    });
    if (path === "/core/me/") return json({
      id: 9700, username: "qa-assessment-teacher", name: "가상교사", is_staff: true, is_superuser: false,
      tenantRole: "teacher", must_change_password: false, first_login_guide_required: false, linkedStudents: [],
    });
    if (path === "/core/tenant-info/") return json({
      id: 9700, code: TENANT, name: "가상 평가 검증 학원", pass_label: "통과", fail_label: "미통과",
    });
    if (path === `/lectures/sessions/${SESSION_ID}/`) return json({
      id: SESSION_ID, lecture: LECTURE_ID, order: 4, title: "4차시", date: "2026-09-01", lecture_title: "가상 평가 검증반",
    });
    if (path === `/lectures/lectures/${LECTURE_ID}/`) return json({ id: LECTURE_ID, title: "가상 평가 검증반", is_active: true });
    if (path === "/enrollments/session-enrollments/") {
      return list(Number(url.searchParams.get("session")) === SESSION_ID ? scores.rows.map((row, index) => ({
        id: 9950 + index, session: SESSION_ID, enrollment: row.enrollment_id,
        student_id: row.student_id, student_name: row.student_name,
      })) : []);
    }
    if (path === "/lectures/attendance/") return list([]);
    if (path === "/exams/") {
      return list(Number(url.searchParams.get("session_id")) === SESSION_ID
        ? scores.meta.exams.map((exam) => ({ id: exam.exam_id, title: exam.title, max_score: exam.max_score, pass_score: exam.pass_score })) : []);
    }
    if (path === `/exams/${EXAM_A}/` || path === `/exams/${EXAM_B}/`) {
      const exam = scores.meta.exams.find((entry) => entry.exam_id === Number(path.split("/")[2]));
      return json({ ...exam, id: exam?.exam_id, session_ids: [SESSION_ID], questions: [] });
    }
    const examEnrollmentsMatch = path.match(/^\/exams\/(\d+)\/enrollments\/$/);
    if (examEnrollmentsMatch) {
      const examId = Number(examEnrollmentsMatch[1]);
      const sessionId = Number(url.searchParams.get("session_id"));
      enrollmentRequests.push({ examId, sessionId });
      if (sessionId !== SESSION_ID || !scores.meta.exams.some((exam) => exam.exam_id === examId)) {
        return json({ detail: "fixture exam/session not found" }, 404);
      }
      return json({
        exam_id: examId, session_id: sessionId,
        items: scores.rows.map((row) => ({
          enrollment_id: row.enrollment_id, student_name: row.student_name,
          is_selected: row.exams.some((exam) => exam.exam_id === examId),
        })),
      });
    }
    if (path === "/homeworks/") {
      return list(scores.meta.homeworks.map((entry) => ({ id: entry.homework_id, title: entry.title, sessions: [SESSION_ID], meta: { default_max_score: 100 } })));
    }
    if (path === `/homeworks/${HOMEWORK_ID}/`) return json({ id: HOMEWORK_ID, title: HOMEWORK_TITLE, sessions: [SESSION_ID], meta: { default_max_score: 100 } });
    if (path === `/submissions/submissions/homework/${HOMEWORK_ID}/`) return list(scores.rows.map((row, index) => ({
      id: 9960 + index, enrollment_id: row.enrollment_id, student_name: row.student_name,
      status: index === 1 ? "pending" : "submitted", submitted_at: index === 1 ? null : "2026-09-01T09:00:00Z",
    })));
    if (path === `/results/admin/sessions/${SESSION_ID}/scores/`) {
      scoreRequests += 1;
      return failScores ? json({ detail: "합성 종합 조회 일시 실패" }, 503) : json(scores);
    }
    const resultsMatch = path.match(/^\/results\/admin\/exams\/(\d+)\/results\/$/);
    if (resultsMatch) {
      const examId = Number(resultsMatch[1]);
      resultRequests.push(examId);
      return list(scores.rows.flatMap((row) => {
        const entry = row.exams.find((exam) => exam.exam_id === examId);
        return entry ? [{
          enrollment_id: row.enrollment_id, student_name: row.student_name,
          exam_score: entry.block.score, final_score: entry.block.score, exam_max_score: entry.block.max_score,
          passed: entry.block.passed, final_pass: entry.block.final_pass, meta_status: entry.block.meta?.status,
          is_provisional: entry.block.is_provisional, teacher_resolved: entry.block.teacher_resolved,
          correction_status: entry.block.correction_status, correction_session_id: SESSION_ID,
        }] : [];
      }));
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/score-draft/` && method === "PUT") {
      const body = request.postDataJSON();
      leaseClient = request.headers()["x-score-editor-client"] ?? null;
      if (!leaseClient || body.changes?.length !== 0) return json({ detail: "invalid fixture lease" }, 409);
      leaseEvents.push("lease");
      return json({ changes: [], version: 1 });
    }
    const patchMatch = path.match(/^\/results\/admin\/exams\/(\d+)\/enrollments\/(\d+)\/score\/$/);
    if (patchMatch && method === "PATCH") {
      if (!leaseClient || request.headers()["x-score-editor-client"] !== leaseClient
        || request.headers()["x-score-session-id"] !== String(SESSION_ID)) return json({ detail: "fixture lease required" }, 409);
      const examId = Number(patchMatch[1]);
      const enrollmentId = Number(patchMatch[2]);
      const body = request.postDataJSON() as { score: number; max_score: number };
      const entry = scores.rows.find((row) => row.enrollment_id === enrollmentId)?.exams.find((exam) => exam.exam_id === examId);
      if (!entry) return json({ detail: "fixture target not found" }, 404);
      if (failScoreWrite) {
        failedPatches.push({ examId, enrollmentId, ...body });
        leaseEvents.push(`failed-patch:${examId}`);
        return json({ detail: SCORE_WRITE_FAILURE }, 503);
      }
      entry.block = block(body.score, { max_score: body.max_score });
      mutations.push({ examId, enrollmentId, ...body });
      leaseEvents.push(`patch:${examId}`);
      return json({ ok: true });
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/score-draft/commit/` && method === "POST") {
      if (request.postDataJSON().release_lease !== true || request.headers()["x-score-editor-client"] !== leaseClient) {
        return json({ detail: "invalid fixture release" }, 409);
      }
      leaseEvents.push("release");
      leaseClient = null;
      return json({ ok: true });
    }
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0 });
    if (path === "/community/notifications/unread-count/" || path === "/community/admin/reports/pending-count/") return json({ count: 0 });
    return list([]);
  });
  return {
    scores, resultRequests, enrollmentRequests, mutations, failedPatches, leaseEvents,
    scoreRequests: () => scoreRequests,
    recoverScores: () => { failScores = false; },
    recoverScoreWrite: () => { failScoreWrite = false; },
  };
}

const overviewRegion = (page: Page) => page.getByRole("region", { name: "차시 성적 종합 조회", exact: true });
const mainButton = (page: Page, name: string) => page.getByRole("main").getByRole("button", { name, exact: true });
const studentCard = (page: Page, enrollmentId: number) => page.getByTestId(`session-assessment-student-${enrollmentId}`);
const examCell = (page: Page, enrollmentId: number, examId: number) => studentCard(page, enrollmentId).getByTestId(`session-assessment-exam-${examId}`);
const homeworkCell = (page: Page, enrollmentId: number) => studentCard(page, enrollmentId).getByTestId(`session-assessment-homework-${HOMEWORK_ID}`);

async function gotoSession(page: Page, query = "") {
  await gotoAndSettle(page, `${BASE}${SESSION_PATH}${query}`, { timeout: 30_000 });
  // 전역 sidebar의 동명 버튼을 lazy route가 준비되기 전에 누르지 않는다.
  await expect(page.getByRole("main").getByRole("heading", { name: "4차시", exact: true })).toBeVisible();
}

async function expectRoute(page: Page, expected: Record<string, string>) {
  await expect.poll(() => Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject(expected);
}

async function expectCell(cell: Locator, score: string, verdict?: string) {
  await expect(cell.getByText(score, { exact: true })).toBeVisible();
  if (verdict) await expect(cell.getByText(`최종 ${verdict}`, { exact: true })).toBeVisible();
}

async function expectUnassigned(cell: Locator) {
  await expectCell(cell, "미배정");
  for (const status of ["미채점", "미입력", "최종 통과", "최종 미통과", "선생님 확인 완료", "오답 미완료", "오답 완료", "채점 대기"]) {
    await expect(cell.getByText(status, { exact: true })).toHaveCount(0);
  }
}

async function captureOverview(page: Page, testInfo: TestInfo, width: number) {
  await studentCard(page, 9800).scrollIntoViewIfNeeded();
  const comparison = page.getByRole("region", { name: "학생별 시험 및 과제 비교표", exact: true });
  await comparison.evaluate((region) => { region.scrollLeft = 0; });
  await waitForRenderSettled(page);
  const bounds = await overviewRegion(page).evaluate((region) => {
    const cards = Array.from(region.querySelectorAll<HTMLElement>('[data-testid^="session-assessment-student-"]'));
    const scrollRegion = region.querySelector<HTMLElement>('[aria-label="학생별 시험 및 과제 비교표"]')!;
    const scrollBox = scrollRegion.getBoundingClientRect();
    const main = region.closest("main")!;
    return {
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      mainWidth: main.clientWidth,
      mainScrollWidth: main.scrollWidth,
      comparison: { left: scrollBox.left, right: scrollBox.right, width: scrollBox.width, scrollWidth: scrollRegion.scrollWidth, clientWidth: scrollRegion.clientWidth },
      cards: cards.map((card) => {
        const box = card.getBoundingClientRect();
        const texts = Array.from(card.querySelectorAll<HTMLElement>("*"))
          .filter((node) => Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && !!child.textContent?.trim())
            && node.getBoundingClientRect().width > 0 && getComputedStyle(node).visibility !== "hidden")
          .map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = Array.from(range.getClientRects());
            const style = getComputedStyle(node);
            return {
              text: node.textContent?.trim(), fontSize: style.fontSize, color: style.color, backgroundColor: style.backgroundColor,
              textOverflow: style.textOverflow, lineClamp: style.webkitLineClamp,
              fitsCard: rects.every((rect) => rect.left >= box.left - 1 && rect.right <= box.right + 1),
              fitsOwnBox: node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1,
            };
          });
        return { id: card.dataset.testid, left: box.left, right: box.right, width: box.width, texts };
      }),
    };
  });
  await testInfo.attach(`overview-${width}-dom-bounds`, { body: JSON.stringify(bounds, null, 2), contentType: "application/json" });
  expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.mainScrollWidth).toBeLessThanOrEqual(bounds.mainWidth + 1);
  expect(bounds.comparison.left).toBeGreaterThanOrEqual(0);
  expect(bounds.comparison.right).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.cards).toHaveLength(17);
  for (const card of bounds.cards) {
    expect(card.left, card.id).toBeGreaterThanOrEqual(0);
    // 태블릿/PC 비교표는 내부 가로 탐색을 허용한다. 페이지 자체가 넘치면 실패한다.
    expect(card.width, card.id).toBeLessThanOrEqual(bounds.comparison.scrollWidth + 1);
    if (width < 640) expect(card.right, card.id).toBeLessThanOrEqual(bounds.viewport + 1);
    for (const text of card.texts) {
      expect(text.fitsCard, `${card.id}: ${text.text}`).toBe(true);
      if ([EXAM_A_TITLE, EXAM_B_TITLE, HOMEWORK_TITLE, "가상가람긴이름확인학생"].includes(text.text ?? "")) {
        expect(text.fitsOwnBox, `${card.id}: ${text.text}`).toBe(true);
        expect(text.textOverflow).not.toBe("ellipsis");
        expect(["none", "0", ""]).toContain(text.lineClamp);
      }
    }
  }
  await page.screenshot({ path: testInfo.outputPath(`overview-${width}-first.png`) });
  await page.screenshot({ path: testInfo.outputPath(`overview-${width}-all-students.png`), fullPage: true });
  if (width >= 640) {
    if (bounds.comparison.scrollWidth > bounds.comparison.clientWidth + 1) {
      await comparison.focus();
      await comparison.press("ArrowRight");
      await expect.poll(() => comparison.evaluate((region) => region.scrollLeft)).toBeGreaterThan(0);
    }
    const headers = comparison.getByRole("columnheader");
    for (const title of [EXAM_A_TITLE, EXAM_B_TITLE, HOMEWORK_TITLE]) {
      const link = headers.getByRole("link", { name: title, exact: true });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
      const titleBounds = await link.evaluate((element) => ({
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
        ellipsis: getComputedStyle(element).textOverflow,
      }));
      expect(titleBounds.scrollWidth).toBeLessThanOrEqual(titleBounds.clientWidth + 1);
      expect(titleBounds.scrollHeight).toBeLessThanOrEqual(titleBounds.clientHeight + 1);
      expect(titleBounds.ellipsis).not.toBe("ellipsis");
    }
    await comparison.evaluate((region) => { region.scrollLeft = region.scrollWidth; });
    await expect(headers.getByRole("link", { name: HOMEWORK_TITLE, exact: true })).toBeInViewport();
    await expect(homeworkCell(page, 9800).getByText("100/100", { exact: true })).toBeInViewport();
    await expect(studentCard(page, 9800).getByRole("rowheader")).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`overview-${width}-rightmost-assessment.png`) });
  }
  await studentCard(page, 9816).scrollIntoViewIfNeeded();
  await page.getByRole("main").evaluate((main) => { main.scrollTop = main.scrollHeight; });
  if (width < 640) await expect(studentCard(page, 9816)).toBeInViewport({ ratio: 1 });
  else await expect(studentCard(page, 9816)).toBeInViewport();
  const lastRowBounds = await studentCard(page, 9816).evaluate((row) => {
    const rowBox = row.getBoundingClientRect();
    const nav = document.querySelector<HTMLElement>('[data-analytics-placement="teacher.bottom-tab"]')!;
    const navVisible = getComputedStyle(nav).display !== "none";
    return { rowTop: rowBox.top, rowBottom: rowBox.bottom, viewportHeight: window.innerHeight, navTop: navVisible ? nav.getBoundingClientRect().top : null };
  });
  await testInfo.attach(`overview-${width}-last-row-footer-bounds`, { body: JSON.stringify(lastRowBounds), contentType: "application/json" });
  expect(lastRowBounds.rowTop).toBeGreaterThanOrEqual(0);
  expect(lastRowBounds.rowBottom).toBeLessThanOrEqual(lastRowBounds.navTop ?? lastRowBounds.viewportHeight);
  if (width >= 640) {
    await comparison.evaluate((region) => { region.scrollLeft = region.scrollWidth; });
    await expect.poll(() => comparison.evaluate((region) => region.scrollTop)).toBeGreaterThan(0);
    const homeworkHeader = comparison.getByRole("columnheader").filter({ has: page.getByRole("link", { name: HOMEWORK_TITLE, exact: true }) });
    await expect(homeworkHeader).toBeInViewport();
    await expect(homeworkCell(page, 9816).getByText("100/100", { exact: true })).toBeInViewport();
    await expect(studentCard(page, 9816).getByRole("rowheader")).toBeInViewport();
    const stickyBounds = await homeworkHeader.evaluate((header) => {
      const region = header.closest('[aria-label="학생별 시험 및 과제 비교표"]')!;
      const headerBox = header.getBoundingClientRect();
      const regionBox = region.getBoundingClientRect();
      return { headerTop: headerBox.top, regionTop: regionBox.top, scrollTop: region.scrollTop, scrollLeft: region.scrollLeft };
    });
    await testInfo.attach(`overview-${width}-sticky-header-bounds`, { body: JSON.stringify(stickyBounds), contentType: "application/json" });
    expect(stickyBounds.headerTop).toBeGreaterThanOrEqual(stickyBounds.regionTop - 1);
    expect(stickyBounds.headerTop).toBeLessThanOrEqual(stickyBounds.regionTop + 2);
  }
  await page.screenshot({ path: testInfo.outputPath(`overview-${width}-last.png`) });
}

test.beforeEach(() => {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(BASE).hostname);
});
test.use({ serviceWorkers: "block" });

test("기본 종합 조회는 시험 선택 없이 같은 학생의 시험 두 개와 과제를 보여준다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installScenario(page);
  await gotoSession(page);
  await mainButton(page, "성적").click();
  await expect(mainButton(page, "종합 조회")).toBeVisible();
  const overview = page.getByRole("region", { name: "차시 성적 종합 조회", exact: true });
  await expect(overview).toBeVisible();
  await expect(overview).toContainText(EXAM_A_TITLE);
  await expect(overview).toContainText(EXAM_B_TITLE);
  await expect(overview).toContainText(HOMEWORK_TITLE);
  await expect(overview).toContainText("가상가람긴이름확인학생");
  await expect(page.getByText("시험을 선택하세요", { exact: true })).toHaveCount(0);
  expect(api.scoreRequests()).toBeGreaterThan(0);
});

test("시험별 직접 진입은 유일한 시험을 자동 선택해 결과를 바로 조회한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installScenario(page, { scenario: "single" });
  await gotoSession(page, "?tab=scores&scoresView=exams");
  await expect(mainButton(page, `${EXAM_A_TITLE} (100점)`)).toBeVisible();
  await expect(page.getByText("0/100", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("시험을 선택하세요", { exact: true })).toHaveCount(0);
  await expect.poll(() => api.resultRequests.includes(EXAM_A)).toBe(true);
  expect(api.resultRequests).not.toContain(EXAM_B);
});

for (const [invalidExam, entryAction] of [["999999", "성적 입력"], ["not-an-exam", "점수 입력 / 수정"]] as const) {
  test(`유효하지 않은 exam=${invalidExam}은 차시의 첫 시험만 조회하고 정확한 점수 입력으로 이동한다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const api = await installScenario(page);
    const resultPaths: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "GET" && /^\/api\/v1\/results\/admin\/exams\/[^/]+\/results\/$/.test(path)) resultPaths.push(path);
    });
    const validPath = `/api/v1/results/admin/exams/${EXAM_A}/results/`;
    await gotoSession(page, `?tab=scores&scoresView=exams&exam=${invalidExam}`);
    await expect(mainButton(page, `${EXAM_A_TITLE} (100점)`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("0/100", { exact: true }).first()).toBeVisible();
    await expect.poll(() => resultPaths).toContain(validPath);
    expect(resultPaths.every((path) => path === validPath)).toBe(true);
    expect(api.resultRequests).not.toContain(EXAM_B);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(mainButton(page, `${EXAM_A_TITLE} (100점)`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("0/100", { exact: true }).first()).toBeVisible();
    await mainButton(page, entryAction).click();
    await expect(page).toHaveURL(new RegExp(`/workspace/mobile/scores/${SESSION_ID}\\?exam=${EXAM_A}$`));
    await expect(page.getByRole("main").getByRole("heading", { name: "성적 입력", exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "학생 이름 검색", exact: true }).fill("가상가람긴이름확인학생");
    await expect(page.locator("input[inputmode=decimal]")).toHaveValue("0");
    expect(resultPaths.every((path) => path === validPath)).toBe(true);
    expect(api.resultRequests.every((examId) => examId === EXAM_A)).toBe(true);
    expect(api.mutations).toEqual([]);
  });
}

for (const width of [390, 768, 1024, 1366]) {
  test(`${width}px 종합 조회는 17명 전체 평가와 원점수·최종 판정을 보존하고 선택 맥락을 복원한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const api = await installScenario(page);
    await gotoSession(page);
    await mainButton(page, "성적").click();
    await expect(overviewRegion(page)).toBeVisible();
    await expect(overviewRegion(page).getByTestId(/^session-assessment-student-/)).toHaveCount(17);
    for (const row of api.scores.rows) {
      const card = studentCard(page, row.enrollment_id);
      await expect(card).toContainText(row.student_name);
      await expect(card.getByTestId(/^session-assessment-exam-/)).toHaveCount(2);
      await expect(card.getByTestId(/^session-assessment-homework-/)).toHaveCount(1);
      await expect(card).toContainText(EXAM_A_TITLE);
      await expect(card).toContainText(EXAM_B_TITLE);
      await expect(card).toContainText(HOMEWORK_TITLE);
    }
    await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
    await expectCell(examCell(page, 9800, EXAM_B), "87/100", "통과");
    await expectCell(examCell(page, 9801, EXAM_A), "미응시");
    await expectCell(examCell(page, 9801, EXAM_B), "미채점");
    await expectCell(homeworkCell(page, 9801), "미제출");
    await expectCell(homeworkCell(page, 9803), "미입력");
    for (const cell of [examCell(page, 9801, EXAM_A), examCell(page, 9801, EXAM_B), homeworkCell(page, 9801), homeworkCell(page, 9803)]) {
      await expect(cell).not.toContainText("0/100");
    }
    await expectCell(examCell(page, 9802, EXAM_A), "35/100", "통과");
    await expect(examCell(page, 9802, EXAM_A)).toContainText("선생님 확인 완료");
    await expectCell(homeworkCell(page, 9802), "0/100", "통과");
    await expect(homeworkCell(page, 9802)).toContainText("선생님 확인 완료");
    await expectCell(examCell(page, 9803, EXAM_A), "80/100", "통과");
    await expect(examCell(page, 9803, EXAM_A).getByText("오답 미완료", { exact: true })).toBeVisible();
    // 최종 판정은 서버 계약이다. 점수 임계값이나 선생님 확인 여부로 덮어쓰지 않는다.
    await expectCell(examCell(page, 9804, EXAM_A), "80/100", "미통과");
    await expectCell(examCell(page, 9805, EXAM_A), "20/100", "통과");
    await expectCell(examCell(page, 9806, EXAM_A), "40/100", "미통과");
    await expect(examCell(page, 9806, EXAM_A)).toContainText("선생님 확인 완료");
    await expect(examCell(page, 9804, EXAM_B)).toContainText("48/100");
    await expect(examCell(page, 9804, EXAM_B)).toContainText("(임시)");
    for (const cell of [examCell(page, 9807, EXAM_A), homeworkCell(page, 9807)]) {
      await expectUnassigned(cell);
    }
    expect(api.resultRequests).toEqual([]);
    await captureOverview(page, testInfo, width);

    await mainButton(page, "시험별 조회").click();
    const a = mainButton(page, `${EXAM_A_TITLE} (100점)`);
    const b = mainButton(page, `${EXAM_B_TITLE} (100점)`);
    await expect(a).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("0/100", { exact: true }).first()).toBeVisible();
    await expectRoute(page, { tab: "scores", scoresView: "exams", exam: String(EXAM_A) });
    const selectorBounds = await b.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return { height: rect.height, width: rect.width, clientWidth: button.clientWidth, scrollWidth: button.scrollWidth };
    });
    expect(selectorBounds.height).toBeGreaterThanOrEqual(44);
    expect(selectorBounds.scrollWidth).toBeLessThanOrEqual(selectorBounds.clientWidth + 1);
    await b.click();
    await expect(b).toHaveAttribute("aria-pressed", "true");
    await expectRoute(page, { tab: "scores", scoresView: "exams", exam: String(EXAM_B) });
    await expect.poll(() => api.resultRequests.includes(EXAM_B)).toBe(true);
    await expect(page.getByText("48/100 (임시)", { exact: true })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(b).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("48/100 (임시)", { exact: true })).toBeVisible();
    await mainButton(page, "출석").click();
    await expectRoute(page, { tab: "attendance", scoresView: "exams", exam: String(EXAM_B) });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("출석 데이터가 없습니다", { exact: true })).toBeVisible();
    await mainButton(page, "성적").click();
    await expect(b).toHaveAttribute("aria-pressed", "true");
    await mainButton(page, "종합 조회").click();
    await expect(overviewRegion(page)).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(overviewRegion(page)).toBeVisible();
    await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
    expect(api.mutations).toEqual([]);
  });
}

test("시험 없이 과제만 있는 차시도 종합 조회에서 모든 학생의 과제 상태를 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installScenario(page, { scenario: "homework-only" });
  await gotoSession(page, "?tab=scores");
  await expect(overviewRegion(page)).toBeVisible();
  await expect(overviewRegion(page).getByTestId(/^session-assessment-student-/)).toHaveCount(17);
  await expect(overviewRegion(page).getByTestId(/^session-assessment-exam-/)).toHaveCount(0);
  await expectCell(homeworkCell(page, 9800), "100/100", "통과");
  await expectCell(homeworkCell(page, 9801), "미제출");
  await expectCell(homeworkCell(page, 9802), "0/100", "통과");
  await expectCell(homeworkCell(page, 9803), "미입력");
  await expect(page.getByText("이 차시에 시험이 없습니다", { exact: true })).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectCell(homeworkCell(page, 9802), "0/100", "통과");
  expect(api.resultRequests).toEqual([]);
});

test("완료형 과제는 점수 0으로 바꾸지 않고 완료·미완료·미입력을 구분한다", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 844 });
  await installScenario(page, { scenario: "completion" });
  await gotoSession(page, "?tab=scores");
  await expectCell(homeworkCell(page, 9800), "완료");
  await expectCell(homeworkCell(page, 9801), "미완료");
  await expectCell(homeworkCell(page, 9802), "미입력");
  await expect(overviewRegion(page)).not.toContainText("0/100");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectCell(homeworkCell(page, 9800), "완료");
  await expectCell(homeworkCell(page, 9801), "미완료");
  await expectCell(homeworkCell(page, 9802), "미입력");
});

test("오답 완료 표시 모드는 시험에만 적용하고 과제의 최종 판정과 미배정을 보존한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installScenario(page, { wrongCompletion: true });
  await gotoSession(page, "?tab=scores");
  await expectCell(examCell(page, 9802, EXAM_A), "35/100");
  await expect(examCell(page, 9802, EXAM_A)).toContainText("오답 완료");
  await expect(examCell(page, 9802, EXAM_A)).toContainText("선생님 확인 완료");
  await expect(examCell(page, 9802, EXAM_A)).not.toContainText("최종 통과");
  await expectCell(homeworkCell(page, 9802), "0/100", "통과");
  for (const cell of [examCell(page, 9807, EXAM_A), homeworkCell(page, 9807)]) {
    await expectUnassigned(cell);
  }
});

test("평가가 없는 차시는 빈 상태를 설명하고 기존 시험·과제 메뉴를 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installScenario(page, { scenario: "empty" });
  await gotoSession(page, "?tab=scores");
  await expect(page.getByText("이 차시에 등록된 시험과 과제가 없습니다", { exact: true })).toBeVisible();
  await expect(mainButton(page, "시험")).toBeVisible();
  await expect(mainButton(page, "과제")).toBeVisible();
  await expect(page.getByText("시험을 선택하세요", { exact: true })).toHaveCount(0);
  expect(api.scoreRequests()).toBeGreaterThan(0);
  expect(api.resultRequests).toEqual([]);
});

test("종합 조회 API 오류를 빈 성적으로 오인시키지 않고 다시 시도로 정상 복구한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installScenario(page, { failScores: true });
  const responseStatuses: number[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === `/api/v1/results/admin/sessions/${SESSION_ID}/scores/`) responseStatuses.push(response.status());
  });
  await gotoSession(page, "?tab=scores");
  await expect.poll(() => responseStatuses).toContain(503);
  await expect(page.getByText("차시 데이터를 불러오지 못했습니다", { exact: true })).toBeVisible();
  await expect(page.getByTestId(/^session-assessment-student-/)).toHaveCount(0);
  await expect(page.getByText("이 차시에 등록된 시험과 과제가 없습니다", { exact: true })).toHaveCount(0);
  const failedRequests = api.scoreRequests();
  api.recoverScores();
  await mainButton(page, "다시 시도").click();
  await expect.poll(() => responseStatuses).toContain(200);
  await expect(overviewRegion(page)).toBeVisible();
  await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
  expect(api.scoreRequests()).toBeGreaterThan(failedRequests);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
});

for (const width of [390, 1024]) {
  test(`${width}px 시험 B에서 점수를 저장하면 같은 시험으로 돌아와 종합 조회와 새로고침에 반영된다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const api = await installScenario(page);
    await gotoSession(page, `?tab=scores&scoresView=exams&exam=${EXAM_B}`);
    await expect(mainButton(page, `${EXAM_B_TITLE} (100점)`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("87/100", { exact: true }).first()).toBeVisible();
    expect(api.resultRequests).not.toContain(EXAM_A);
    await mainButton(page, "점수 입력 / 수정").click();
    await expect(page).toHaveURL(new RegExp(`/workspace/mobile/scores/${SESSION_ID}\\?exam=${EXAM_B}$`));
    await expect(page.getByRole("heading", { name: "성적 입력", exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "학생 이름 검색", exact: true }).fill("가상가람긴이름확인학생");
    const input = page.locator("input[inputmode=decimal]");
    await expect(input).toHaveCount(1);
    await expect(input).toHaveValue("87");
    await input.fill("91");
    await Promise.all([
      expect(page.getByText("가상가람긴이름확인학생 점수가 저장되었습니다.", { exact: true })).toBeVisible(),
      input.press("Enter"),
    ]);
    await expect.poll(() => api.mutations).toEqual([{ examId: EXAM_B, enrollmentId: 9800, score: 91, max_score: 100 }]);
    await expect.poll(() => api.leaseEvents).toEqual(["lease", `patch:${EXAM_B}`, "release"]);
    await page.screenshot({ path: testInfo.outputPath(`exam-b-saved-${width}.png`) });
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expectRoute(page, { tab: "scores", scoresView: "exams", exam: String(EXAM_B) });
    await expect(mainButton(page, `${EXAM_B_TITLE} (100점)`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("91/100", { exact: true })).toBeVisible();
    await mainButton(page, "종합 조회").click();
    await expectCell(examCell(page, 9800, EXAM_B), "91/100", "통과");
    await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectCell(examCell(page, 9800, EXAM_B), "91/100", "통과");
    await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
    await studentCard(page, 9800).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`exam-b-reloaded-overview-${width}.png`) });
    expect(api.mutations).toEqual([{ examId: EXAM_B, enrollmentId: 9800, score: 91, max_score: 100 }]);
  });
}

test("기존 시험·과제 탭의 상세 진입과 뒤로 가기는 같은 평가와 차시 탭을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installScenario(page);
  await gotoSession(page, "?tab=scores");
  await examCell(page, 9800, EXAM_B).getByRole("link", { name: EXAM_B_TITLE, exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/workspace/mobile/exams/${EXAM_B}`);
  await expect(page.getByRole("heading", { name: EXAM_B_TITLE, exact: true })).toBeVisible();
  await expect.poll(() => api.enrollmentRequests).toContainEqual({ examId: EXAM_B, sessionId: SESSION_ID });
  await mainButton(page, "성적 입력 열기").click();
  await expect(page).toHaveURL(new RegExp(`/workspace/mobile/scores/${SESSION_ID}\\?exam=${EXAM_B}$`));
  await expect(page.getByRole("main").getByRole("heading", { name: "성적 입력", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "학생 이름 검색", exact: true }).fill("가상가람긴이름확인학생");
  await expect(page.locator("input[inputmode=decimal]")).toHaveValue("87");
  expect(api.resultRequests).not.toContain(EXAM_A);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: EXAM_B_TITLE, exact: true })).toBeVisible();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectRoute(page, { tab: "scores" });
  await expect(overviewRegion(page)).toBeVisible();
  await mainButton(page, "시험").click();
  await expectRoute(page, { tab: "exams" });
  await page.getByRole("main").getByRole("button", { name: new RegExp(EXAM_B_TITLE) }).click();
  await expect(page).toHaveURL(`${BASE}/workspace/mobile/exams/${EXAM_B}`);
  await expect(page.getByRole("heading", { name: EXAM_B_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText("가상가람긴이름확인학생", { exact: true })).toBeVisible();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectRoute(page, { tab: "exams" });
  await mainButton(page, "과제").click();
  await expectRoute(page, { tab: "homeworks" });
  await page.getByRole("main").getByRole("button", { name: new RegExp(HOMEWORK_TITLE) }).click();
  await expect(page).toHaveURL(`${BASE}/workspace/mobile/homeworks/${HOMEWORK_ID}`);
  await expect(page.getByRole("heading", { name: HOMEWORK_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText("가상가람긴이름확인학생", { exact: true })).toBeVisible();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectRoute(page, { tab: "homeworks" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main").getByRole("button", { name: new RegExp(HOMEWORK_TITLE) })).toBeVisible();
  expect(api.mutations).toEqual([]);
});

test("390px 시험 B 저장 실패는 실패 알림과 91점 초안을 보존하고 재저장 후에만 정본을 변경한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installScenario(page, { failScoreWrite: true });
  const expectedPatch = { examId: EXAM_B, enrollmentId: 9800, score: 91, max_score: 100 };
  const patchStatuses: number[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === `/api/v1/results/admin/exams/${EXAM_B}/enrollments/9800/score/`) patchStatuses.push(response.status());
  });
  await gotoSession(page, `?tab=scores&scoresView=exams&exam=${EXAM_B}`);
  await mainButton(page, "점수 입력 / 수정").click();
  await expect(page).toHaveURL(new RegExp(`/workspace/mobile/scores/${SESSION_ID}\\?exam=${EXAM_B}$`));
  await page.getByRole("searchbox", { name: "학생 이름 검색", exact: true }).fill("가상가람긴이름확인학생");
  const input = page.locator("input[inputmode=decimal]");
  await expect(input).toHaveValue("87");
  await input.fill("91");
  await Promise.all([
    expect(page.getByText(SCORE_WRITE_FAILURE, { exact: true })).toBeVisible(),
    input.press("Enter"),
  ]);
  await expect.poll(() => api.failedPatches).toEqual([expectedPatch]);
  await expect.poll(() => api.leaseEvents).toEqual(["lease", `failed-patch:${EXAM_B}`, "release"]);
  expect(patchStatuses).toEqual([503]);
  expect(api.mutations).toEqual([]);
  await expect(input).toHaveValue("91");
  expect(api.scores.rows[0].exams.find((exam) => exam.exam_id === EXAM_B)?.block.score).toBe(87);
  await page.screenshot({ path: testInfo.outputPath("exam-b-failed-draft-390.png") });

  // 입력 초안이 아닌 서버 조회 화면에서 실패 전 원점수가 그대로임을 확인한다.
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectRoute(page, { tab: "scores", scoresView: "exams", exam: String(EXAM_B) });
  await expect(page.getByText("87/100", { exact: true }).first()).toBeVisible();
  await mainButton(page, "종합 조회").click();
  await expectCell(examCell(page, 9800, EXAM_B), "87/100", "통과");
  await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectCell(examCell(page, 9800, EXAM_B), "87/100", "통과");
  await mainButton(page, "시험별 조회").click();
  await mainButton(page, "점수 입력 / 수정").click();
  await expect(page).toHaveURL(new RegExp(`/workspace/mobile/scores/${SESSION_ID}\\?exam=${EXAM_B}$`));
  const restoredInput = page.getByRole("main").getByText("가상가람긴이름확인학생", { exact: true })
    .locator("..").locator("input[inputmode=decimal]");
  await expect(restoredInput).toHaveCount(1);
  await expect(restoredInput).toHaveValue("91");
  await expect(restoredInput).toBeFocused();
  expect(api.failedPatches).toEqual([expectedPatch]);
  api.recoverScoreWrite();
  await Promise.all([
    expect(page.getByText("가상가람긴이름확인학생 점수가 저장되었습니다.", { exact: true })).toBeVisible(),
    // 복구 이후의 명시적인 포커스 이동이 이 입력 화면의 자동 저장(onBlur)을 수행한다.
    page.getByRole("searchbox", { name: "학생 이름 검색", exact: true }).fill("가상가람긴이름확인학생"),
  ]);
  await expect.poll(() => api.mutations).toEqual([expectedPatch]);
  await expect.poll(() => api.leaseEvents).toEqual(["lease", `failed-patch:${EXAM_B}`, "release", "lease", `patch:${EXAM_B}`, "release"]);
  expect(api.failedPatches).toEqual([expectedPatch]);
  expect(patchStatuses).toEqual([503, 200]);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expectRoute(page, { tab: "scores", scoresView: "exams", exam: String(EXAM_B) });
  await expect(page.getByText("91/100", { exact: true })).toBeVisible();
  await mainButton(page, "종합 조회").click();
  await expectCell(examCell(page, 9800, EXAM_B), "91/100", "통과");
  await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectCell(examCell(page, 9800, EXAM_B), "91/100", "통과");
  await expectCell(examCell(page, 9800, EXAM_A), "0/100", "미통과");
  await studentCard(page, 9800).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("exam-b-retry-persisted-390.png") });
});
