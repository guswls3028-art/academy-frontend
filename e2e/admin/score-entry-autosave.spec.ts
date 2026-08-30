import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

type ScoreRouteOptions = {
  initialScores?: Array<number | null>;
  initialCorrectionStatuses?: Array<"PENDING" | "COMPLETED" | "NOT_REQUIRED" | null>;
  initialDraft?: unknown[];
  includeHomework?: boolean;
  homeworkMaxScore?: number;
  initialHomeworkScores?: Array<number | null>;
  homeworkAssignedRows?: boolean[];
  homeworkGradingMode?: "SCORE" | "COMPLETION";
  scoreSummaryColumnDefault?: "exam_wrong";
  nullScoresPassedFalse?: boolean;
  nullHomeworkScoresPassedFalse?: boolean;
  activeEditors?: Array<{
    client_id: string;
    editor_user_id: number;
    editor_name: string;
    active_cell: { type: "homework"; enrollmentId: number; homeworkId: number };
  }>;
};

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp: now + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function openScores(
  page: Page,
  routeOptions: ScoreRouteOptions = {},
  navigationTimeoutMs = 45_000,
): Promise<void> {
  const baseUrl = getBaseUrl("admin");
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl), "성적 입력 route-mock 검증은 로컬 dev 서버 전용");
  await installLocalAuthApiStubs(page, {
    programFeatureFlags: routeOptions.scoreSummaryColumnDefault
      ? { score_summary_column_default: routeOptions.scoreSummaryColumnDefault }
      : {},
  });
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, createLocalJwt());
  await installScoreRoutes(page, routeOptions);
  await page.goto(`${baseUrl}/workspace/lectures/9001/sessions/9002/scores`, {
    waitUntil: "domcontentloaded",
    timeout: navigationTimeoutMs,
  });
  await expect(page).toHaveURL(/\/workspace\/lectures\/9001\/sessions\/9002\/scores/);
}

async function ensureScoreEditing(page: Page, loadingTimeoutMs = 30_000): Promise<void> {
  const cells = page.locator(".ds-scores-cell-editable");
  const saveAndLockButton = page.getByRole("button", { name: "저장하고 잠금", exact: true });
  const isStableEditingState = await saveAndLockButton.isVisible().catch(() => false)
    && await cells.first().isVisible().catch(() => false);
  if (isStableEditingState) return;

  const editButton = page.getByRole("button", { name: "수정", exact: true });
  await expect(editButton).toBeVisible({ timeout: loadingTimeoutMs });
  await editButton.click();
  await expect(saveAndLockButton).toBeVisible({ timeout: loadingTimeoutMs });
  await expect(cells.first()).toBeVisible({ timeout: loadingTimeoutMs });
}

const scorePatches: Array<Record<string, unknown>> = [];
const homeworkPatches: Array<Record<string, unknown>> = [];
const assignmentPuts: Array<{ path: string; enrollmentIds: number[] }> = [];
const scorePatchHeaders: Array<Record<string, string>> = [];
const draftPuts: Array<Record<string, unknown>> = [];
const draftCommits: Array<Record<string, unknown>> = [];
let currentScores: Array<number | null> = [65, 52];
let currentCorrectionStatuses: Array<"PENDING" | "COMPLETED" | "NOT_REQUIRED" | null> = ["PENDING", "PENDING"];
let currentDraft: unknown[] = [];
let failNextDraftCommit = false;
let failNextLeaseRelease = false;
let failNextDraftPut = false;
let delayNextScorePatchMs = 0;
let includeHomework = false;
let homeworkMaxScore = 100;
let homeworkGradingMode: "SCORE" | "COMPLETION" = "SCORE";
let homeworkAssignedRows = [false, true];
let currentHomeworkScores: Array<number | null> = [null, 45];
let currentHomeworkVersions: Array<string | null> = [null, "2026-08-30T09:00:02+09:00"];
let homeworkVersionCounter = 2;
let activeEditors: NonNullable<ScoreRouteOptions["activeEditors"]> = [];

async function installScoreRoutes(page: Page, options: ScoreRouteOptions = {}): Promise<void> {
  scorePatches.length = 0;
  homeworkPatches.length = 0;
  assignmentPuts.length = 0;
  scorePatchHeaders.length = 0;
  draftPuts.length = 0;
  draftCommits.length = 0;
  currentScores = [...(options.initialScores ?? [65, 52])];
  currentCorrectionStatuses = [...(
    options.initialCorrectionStatuses
    ?? currentScores.map((score) => (score == null ? null : score >= 100 ? "NOT_REQUIRED" : "PENDING"))
  )];
  currentDraft = [...(options.initialDraft ?? [])];
  failNextDraftCommit = false;
  failNextLeaseRelease = false;
  failNextDraftPut = false;
  delayNextScorePatchMs = 0;
  includeHomework = options.includeHomework ?? false;
  homeworkMaxScore = options.homeworkMaxScore ?? 100;
  homeworkGradingMode = options.homeworkGradingMode ?? "SCORE";
  homeworkAssignedRows = [...(options.homeworkAssignedRows ?? [false, true])];
  currentHomeworkScores = [...(options.initialHomeworkScores ?? [null, 45])];
  currentHomeworkVersions = currentHomeworkScores.map((score, index) => (
    score == null ? null : `2026-08-30T09:00:${String(index + 1).padStart(2, "0")}+09:00`
  ));
  homeworkVersionCounter = currentHomeworkScores.length;
  activeEditors = [...(options.activeEditors ?? [])];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (/\/api\/v1\/results\/admin\/sessions\/\d+\/scores\/$/.test(path) && method === "GET") {
      await route.fulfill({
        json: {
          meta: {
            session_title: "자동 저장 검증 차시",
            lecture_title: "자동 저장 검증반",
            lecture_id: 9001,
            exams: [{
              exam_id: 9101,
              title: "주간 확인",
              pass_score: 60,
              max_score: 100,
              objective_max_score: 100,
              subjective_max_score: 0,
              display_order: 1,
            }],
            homeworks: includeHomework ? [{
              homework_id: 9151,
              title: "단원 복습",
              unit: "점",
              grading_mode: homeworkGradingMode,
              max_score: homeworkMaxScore,
              display_order: 2,
            }] : [],
          },
          rows: currentScores.map((score, index) => ({
            enrollment_id: 9201 + index,
            student_id: 9301 + index,
            student_name: `자동저장학생${index + 1}`,
            lecture_title: "자동 저장 검증반",
            lecture_color: "#2563eb",
            lecture_chip_label: "자",
            exams: [{
              exam_id: 9101,
              title: "주간 확인",
              pass_score: 60,
              attempt_count: 1,
              clinic_link_id: null,
              block: {
                score,
                max_score: 100,
                passed: score == null
                  ? options.nullScoresPassedFalse ? false : null
                  : score >= 60,
                achievement: score == null && options.nullScoresPassedFalse ? "FAIL" : undefined,
                clinic_required: score == null ? false : score < 60,
                is_locked: false,
                objective_score: score,
                subjective_score: score == null ? null : 0,
                correction_status: currentCorrectionStatuses[index] ?? null,
                meta: {},
              },
              attempt_count: score == null ? 0 : 1,
            }],
            homeworks: includeHomework && homeworkAssignedRows[index] ? [{
              homework_id: 9151,
              title: "단원 복습",
              block: {
                score: currentHomeworkScores[index],
                max_score: homeworkMaxScore,
                passed: currentHomeworkScores[index] == null
                  ? options.nullHomeworkScoresPassedFalse ? false : null
                  : homeworkGradingMode === "COMPLETION"
                    ? currentHomeworkScores[index]! >= 1
                    : currentHomeworkScores[index]! >= 60,
                clinic_required: currentHomeworkScores[index] == null
                  ? false
                  : homeworkGradingMode === "COMPLETION"
                    ? currentHomeworkScores[index]! < 1
                    : currentHomeworkScores[index]! < 60,
                is_locked: false,
                meta: {},
                updated_at: currentHomeworkVersions[index],
              },
            }] : [],
            clinic_required: score == null ? false : score < 60,
            progress_completed: false,
            updated_at: "2026-07-25T12:00:00+09:00",
          })),
        },
      });
      return;
    }

    if (path.endsWith("/score-draft/commit/") && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      draftCommits.push(body);
      if (failNextLeaseRelease && body.release_lease === true) {
        failNextLeaseRelease = false;
        await route.fulfill({ status: 500, json: { detail: "lease release failed once" } });
        return;
      }
      if (failNextDraftCommit) {
        failNextDraftCommit = false;
        await route.fulfill({ status: 500, json: { detail: "commit failed once" } });
        return;
      }
      currentDraft = [];
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (path.endsWith("/score-draft/")) {
      if (method === "GET") {
        await route.fulfill({ json: { changes: currentDraft, active_editors: activeEditors } });
        return;
      }
      if (method === "PUT") {
        const body = request.postDataJSON() as { changes?: unknown[] };
        if (failNextDraftPut && (body.changes?.length ?? 0) > 0) {
          failNextDraftPut = false;
          await route.fulfill({ status: 500, json: { detail: "draft put failed once" } });
          return;
        }
        draftPuts.push(body as Record<string, unknown>);
        currentDraft = body.changes ?? [];
        await route.fulfill({ json: { changes: currentDraft, active_editors: activeEditors } });
        return;
      }
    }

    if (/\/api\/v1\/results\/admin\/exams\/9101\/enrollments\/92\d+\/score\/$/.test(path) && method === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const delayMs = delayNextScorePatchMs;
      delayNextScorePatchMs = 0;
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      scorePatches.push(body);
      scorePatchHeaders.push(request.headers());
      const enrollmentId = Number(path.match(/enrollments\/(\d+)\/score/)?.[1]);
      const rowIndex = enrollmentId - 9201;
      if (rowIndex >= 0 && rowIndex < currentScores.length && typeof body.score === "number") {
        currentScores[rowIndex] = body.score;
      }
      await route.fulfill({
        json: {
          ok: true,
          exam_id: 9101,
          enrollment_id: enrollmentId,
          total_score: currentScores[rowIndex],
          max_score: 100,
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/homework/scores/quick/") && method === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      homeworkPatches.push(body);
      const enrollmentId = Number(body.enrollment_id);
      const rowIndex = enrollmentId - 9201;
      const expectedUpdatedAt = body.expected_updated_at == null
        ? null
        : String(body.expected_updated_at);
      const currentUpdatedAt = currentHomeworkVersions[rowIndex] ?? null;
      if (expectedUpdatedAt !== currentUpdatedAt) {
        await route.fulfill({
          status: 409,
          json: {
            detail: "다른 화면에서 이 과제 점수가 먼저 저장되었습니다.",
            code: "SCORE_CELL_CONFLICT",
            server_value: {
              score: currentHomeworkScores[rowIndex] ?? null,
              max_score: homeworkMaxScore,
              meta_status: null,
              updated_at: currentUpdatedAt,
            },
            expected_updated_at: expectedUpdatedAt,
          },
        });
        return;
      }
      if (rowIndex >= 0 && rowIndex < currentHomeworkScores.length) {
        currentHomeworkScores[rowIndex] = typeof body.score === "number" ? body.score : null;
        homeworkVersionCounter += 1;
        currentHomeworkVersions[rowIndex] = `2026-08-30T09:01:${String(homeworkVersionCounter).padStart(2, "0")}+09:00`;
      }
      await route.fulfill({
        json: {
          score: currentHomeworkScores[rowIndex] ?? null,
          max_score: homeworkMaxScore,
          meta: null,
          updated_at: currentHomeworkVersions[rowIndex] ?? null,
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/enrollments/session-enrollments/") && method === "GET") {
      await route.fulfill({
        json: {
          count: currentScores.length,
          results: currentScores.map((_, index) => ({
            id: 9501 + index,
            session: 9002,
            enrollment: 9201 + index,
            student_id: 9301 + index,
            student_name: `자동저장학생${index + 1}`,
          })),
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/exams/9101/enrollments/") && method === "PUT") {
      const body = request.postDataJSON() as { enrollment_ids?: number[] };
      assignmentPuts.push({ path, enrollmentIds: body.enrollment_ids ?? [] });
      await route.fulfill({ json: { ok: true } });
      return;
    }

    if (path.endsWith("/api/v1/homework/assignments/") && method === "PUT") {
      const body = request.postDataJSON() as { enrollment_ids?: number[] };
      assignmentPuts.push({ path, enrollmentIds: body.enrollment_ids ?? [] });
      homeworkAssignedRows = currentScores.map(() => true);
      await route.fulfill({ json: { ok: true } });
      return;
    }

    if (path.endsWith("/api/v1/lectures/attendance/") && method === "GET") {
      await route.fulfill({
        json: {
          count: 2,
          results: currentScores.map((_, index) => ({
            id: 9401 + index,
            enrollment_id: 9201 + index,
            status: "PRESENT",
          })),
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/lectures/9001/") && method === "GET") {
      await route.fulfill({
        json: { id: 9001, title: "자동 저장 검증반", color: "#2563eb", chip_label: "자" },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/sessions/9002/") && method === "GET") {
      await route.fulfill({
        json: { id: 9002, lecture: 9001, order: 1, title: "자동 저장 검증 차시", date: "2026-07-30" },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/sessions/") && method === "GET") {
      await route.fulfill({
        json: [{ id: 9002, lecture: 9001, order: 1, title: "자동 저장 검증 차시", date: "2026-07-30" }],
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/attendance/arrival-overview/") && method === "GET") {
      await route.fulfill({
        json: {
          generated_at: "2026-07-30T09:00:00+09:00",
          today: "2026-07-30",
          tomorrow: "2026-07-31",
          range_end: "2026-08-06",
          range_days: 7,
          soon_window_minutes: 30,
          summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
          items: [],
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/staffs/currently-working/") && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith("/api/v1/staffs/me/") && method === "GET") {
      await route.fulfill({
        json: {
          is_authenticated: true,
          is_superuser: true,
          is_staff: true,
          is_payroll_manager: true,
          is_owner: true,
          owner_display_name: "관리자",
          staff_id: 12,
        },
      });
      return;
    }

    // Workspace chrome loads these counters/lists independently of the score route.
    // Keep this route-mock test self-contained instead of waiting on a local API proxy.
    if (path.endsWith("/api/v1/clinic/participants/") && method === "GET") {
      await route.fulfill({ json: { count: 0, results: [] } });
      return;
    }

    if (path.endsWith("/api/v1/students/registration_requests/") && method === "GET") {
      await route.fulfill({ json: { count: 0, results: [] } });
      return;
    }

    if (path.endsWith("/api/v1/submissions/submissions/pending/") && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }

    if (path.endsWith("/api/v1/results/admin/teacher-dashboard-counts/") && method === "GET") {
      await route.fulfill({ json: { video_failed: 0 } });
      return;
    }

    if (
      (path.endsWith("/api/v1/community/admin/reports/pending-count/")
        || path.endsWith("/api/v1/community/notifications/unread-count/"))
      && method === "GET"
    ) {
      await route.fulfill({ json: { count: 0 } });
      return;
    }

    if (path.endsWith("/api/v1/community/admin/posts/") && method === "GET") {
      await route.fulfill({ json: { count: 0, results: [] } });
      return;
    }

    await route.fallback();
  });
}

test("같은 계정의 다른 화면이 선택한 과제 셀을 표시하고 다른 셀은 입력한다", async ({ page }) => {
  await openScores(page, {
    includeHomework: true,
    homeworkAssignedRows: [true, true],
    activeEditors: [{
      client_id: "other-screen",
      editor_user_id: 12,
      editor_name: "박철",
      active_cell: { type: "homework", enrollmentId: 9201, homeworkId: 9151 },
    }],
  });
  await ensureScoreEditing(page);

  const occupiedCell = page.locator('[data-score-cell="homework:9201:9151"]');
  const availableCell = page.locator('[data-score-cell="homework:9202:9151"]');
  await expect(occupiedCell).toHaveAttribute("data-collaborator-active", "true");
  await expect(occupiedCell).toContainText("박철 입력 중");
  await expect(occupiedCell).not.toHaveAttribute("data-editable", "true");
  await expect(availableCell).toHaveAttribute("data-editable", "true");

  await availableCell.click();
  await expect.poll(
    () => draftPuts.some((put) => JSON.stringify(put.active_cell) === JSON.stringify({
      type: "homework",
      enrollmentId: 9202,
      homeworkId: 9151,
    })),
  ).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(occupiedCell).toBeVisible();
  const occupiedBox = await occupiedCell.boundingBox();
  const labelBox = await occupiedCell.locator(".ds-scores-collaborator-label").boundingBox();
  expect(occupiedBox).not.toBeNull();
  expect(labelBox).not.toBeNull();
  expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(occupiedBox!.x + occupiedBox!.width + 1);
});

test("두 브라우저가 서로 다른 과제 셀 저장을 실시간 수렴하고 reload 뒤에도 유지한다", async ({ browser }) => {
  test.setTimeout(300_000);
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const routeOptions: ScoreRouteOptions = {
      includeHomework: true,
      homeworkAssignedRows: [true, true],
      initialHomeworkScores: [10, 20],
    };
    await openScores(pageA, routeOptions, 90_000);
    await ensureScoreEditing(pageA, 90_000);
    await openScores(pageB, routeOptions, 90_000);
    await ensureScoreEditing(pageB, 90_000);

    const pageAFirst = pageA.getByRole("textbox", { name: "자동저장학생1 · 단원 복습 점수 입력" });
    const pageASecondCell = pageA.locator('[data-score-cell="homework:9202:9151"]');
    const pageBFirstCell = pageB.locator('[data-score-cell="homework:9201:9151"]');
    const pageBSecond = pageB.getByRole("textbox", { name: "자동저장학생2 · 단원 복습 점수 입력" });

    await pageAFirst.fill("71");
    await pageA.keyboard.press("Control+s");
    await expect.poll(() => currentHomeworkScores[0]).toBe(71);
    await expect(pageBFirstCell).toContainText("71", { timeout: 10_000 });

    await pageBSecond.fill("82");
    await pageB.keyboard.press("Control+s");
    await expect.poll(() => currentHomeworkScores[1]).toBe(82);
    await expect(pageASecondCell).toContainText("82", { timeout: 10_000 });

    await pageA.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await pageB.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(pageA.locator('[data-score-cell="homework:9201:9151"]')).toContainText("71", { timeout: 90_000 });
    await expect(pageA.locator('[data-score-cell="homework:9202:9151"]')).toContainText("82", { timeout: 90_000 });
    await expect(pageB.locator('[data-score-cell="homework:9201:9151"]')).toContainText("71", { timeout: 90_000 });
    await expect(pageB.locator('[data-score-cell="homework:9202:9151"]')).toContainText("82", { timeout: 90_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("같은 과제 셀 경쟁은 conflict로 서버값을 보존하고 내 초안을 명시적으로 재적용한다", async ({ browser }) => {
  test.setTimeout(300_000);
  // Presence 전파 전에 두 화면이 같은 version을 읽은 race window를 재현한다.
  // 동일 셀 선택 자체의 SCORE_EDIT_LOCKED는 backend test_score_draft_edit_lease.py가 별도로 봉인한다.
  const contextA = await browser.newContext({ serviceWorkers: "block" });
  const contextB = await browser.newContext({ serviceWorkers: "block" });
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const routeOptions: ScoreRouteOptions = {
      includeHomework: true,
      homeworkAssignedRows: [true, true],
      initialHomeworkScores: [10, 20],
    };
    await openScores(pageA, routeOptions, 90_000);
    await ensureScoreEditing(pageA, 90_000);
    await openScores(pageB, routeOptions, 90_000);
    await ensureScoreEditing(pageB, 90_000);

    const pageAInput = pageA.getByRole("textbox", { name: "자동저장학생1 · 단원 복습 점수 입력" });
    const pageBInput = pageB.getByRole("textbox", { name: "자동저장학생1 · 단원 복습 점수 입력" });
    let pageBScoreReads = 0;
    pageB.on("response", (response) => {
      if (/\/results\/admin\/sessions\/9002\/scores\/$/.test(new URL(response.url()).pathname)) {
        pageBScoreReads += 1;
      }
    });

    await pageBInput.fill("88");
    const readsBeforeWinner = pageBScoreReads;
    await pageAInput.fill("77");
    await pageA.keyboard.press("Control+s");
    await expect.poll(() => currentHomeworkScores[0]).toBe(77);
    await expect.poll(() => pageBScoreReads, { timeout: 10_000 }).toBeGreaterThan(readsBeforeWinner);
    await expect(pageBInput).toHaveText("88");

    await pageB.keyboard.press("Control+s");
    const conflict = pageB.getByRole("alert").filter({ hasText: "최신 서버값 77" });
    await expect(conflict).toContainText("내 입력 88");
    await expect(pageBInput).toHaveText("88");
    expect(currentHomeworkScores[0]).toBe(77);

    await conflict.getByRole("button", { name: "내 점수 다시 적용" }).click();
    await pageB.keyboard.press("Control+s");
    await expect.poll(() => currentHomeworkScores[0]).toBe(88);
    await expect(pageA.locator('[data-score-cell="homework:9201:9151"]')).toContainText("88", { timeout: 10_000 });

    await pageA.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await pageB.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(pageA.locator('[data-score-cell="homework:9201:9151"]')).toContainText("88", { timeout: 90_000 });
    await expect(pageB.locator('[data-score-cell="homework:9201:9151"]')).toContainText("88", { timeout: 90_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test.describe("성적 입력 잠금과 Excel 단축키", () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });

  test("입력 이력이 전혀 없으면 바로 수정 상태로 열리고 저장 후 잠금은 유지된다", async ({ page }, testInfo) => {
    await openScores(page, { initialScores: [null, null] });

    const saveAndLockButton = page.getByRole("button", { name: "저장하고 잠금", exact: true });
    await expect(saveAndLockButton).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("status")).toContainText("수정 중 · 자동 저장 준비");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "OMR 스캔 등록" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("score-entry-empty-auto-edit-1366.png"), fullPage: true });

    await saveAndLockButton.click();
    await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
  });

  test("변경 없는 자동 수정 상태에서는 빈 lease를 해제하고 OMR 등록을 연다", async ({ page }) => {
    await openScores(page, { initialScores: [null, null] });

    const omrButton = page.getByRole("button", { name: "OMR 스캔 등록" });
    await expect(omrButton).toBeEnabled({ timeout: 10_000 });
    await omrButton.click();

    await expect(page.locator(".admin-omr-upload").getByText("스캔 파일 선택")).toBeVisible();
    await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible();
    await expect
      .poll(
        () => draftCommits.filter((commit) => commit.release_lease === true).length,
        { timeout: 2_000 },
      )
      .toBe(1);
  });

  test("빈 성적표라도 복구 초안이 있으면 자동 수정하지 않는다", async ({ page }) => {
    await openScores(page, {
      initialScores: [null, null],
      initialDraft: [{
        type: "examTotal",
        examId: 9101,
        enrollmentId: 9201,
        score: 88,
        maxScore: 100,
      }],
    });

    await expect(page.getByRole("dialog", { name: /임시저장된 변경 1건/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "수정", exact: true })).toBeDisabled();
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
  });

  test("0점은 입력된 데이터로 보고 잠금 상태를 유지한다", async ({ page }) => {
    await openScores(page, { initialScores: [0, null] });

    await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
  });

  test("값이 없는 시험·과제 셀은 실패 판정이 와도 흰색으로 남고 0점은 미달로 표시한다", async ({ page }) => {
    await openScores(page, {
      initialScores: [0, null],
      nullScoresPassedFalse: true,
      includeHomework: true,
      homeworkAssignedRows: [true, true],
      initialHomeworkScores: [0, null],
      nullHomeworkScoresPassedFalse: true,
    });

    const scoredRow = page.locator("tbody tr").filter({ hasText: "자동저장학생1" });
    const emptyRow = page.locator("tbody tr").filter({ hasText: "자동저장학생2" });
    const scoredCells = scoredRow.locator('td[data-col-type="score"]');
    const emptyCells = emptyRow.locator('td[data-col-type="score"]');

    await expect(scoredCells).toHaveCount(2);
    await expect(scoredCells.nth(0)).toHaveAttribute("data-pass-status", "fail");
    await expect(scoredCells.nth(1)).toHaveAttribute("data-pass-status", "fail");
    await expect(emptyCells).toHaveCount(2);
    await expect(emptyCells.nth(0)).not.toHaveAttribute("data-pass-status");
    await expect(emptyCells.nth(0)).not.toHaveAttribute("data-achievement");
    await expect(emptyCells.nth(1)).not.toHaveAttribute("data-pass-status");
    await expect.poll(() => emptyCells.evaluateAll((cells) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--color-bg-surface)";
      document.body.appendChild(probe);
      const surface = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return cells.every((cell) => getComputedStyle(cell).backgroundColor === surface);
    })).toBe(true);
  });

  test("미입력 점수가 있으면 수업결과 알림톡 모달을 열지 않는다", async ({ page }) => {
    await openScores(page, {
      initialScores: [65, null],
      nullScoresPassedFalse: true,
    });

    await page.getByRole("checkbox", { name: "자동저장학생2 선택" }).check();
    await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();

    await expect(page.getByText(/점수가 입력되지 않은 시험·과제가 1건 있습니다/)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "알림톡 발송" })).toHaveCount(0);
  });

  test("성적 알림 모달은 보호자만 선택하고 학생 수신을 잠근다", async ({ page }) => {
    await openScores(page, { initialScores: [65, 52] });

    await page.getByRole("checkbox", { name: "자동저장학생1 선택" }).check();
    await page.getByRole("button", { name: "수업결과 알림톡 발송" }).click();

    const dialog = page.getByRole("dialog", { name: "알림톡 발송" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "학부모" })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "학생" })).not.toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "학생" })).toBeDisabled();
    await expect(dialog).toContainText("성적 알림은 보호자에게만 발송됩니다.");
  });

  test("마지막 열을 테스트 오답으로 바꾸면 실제 오답 확인 완료 상태가 사용자별로 유지된다", async ({ page }, testInfo) => {
    await openScores(page, {
      initialScores: [52, 80, 100, null],
      initialCorrectionStatuses: ["PENDING", "COMPLETED", "NOT_REQUIRED", null],
      includeHomework: true,
      initialHomeworkScores: [100, 20],
    });

    const failingScoreCell = page.getByRole("cell", { name: "52/100", exact: true });
    const passingScoreCell = page.getByRole("cell", { name: "80/100", exact: true });
    await expect(failingScoreCell).toHaveAttribute("data-score-progress", "true");
    await expect(failingScoreCell).toHaveAttribute("data-pass-status", "fail");
    await expect(failingScoreCell.locator(".ds-score-value__earned")).toHaveText("52");
    await expect(failingScoreCell.locator(".ds-score-value__max")).toHaveText("100");
    await expect.poll(
      () => failingScoreCell.evaluate((cell) => getComputedStyle(cell).getPropertyValue("--score-progress").trim()),
    ).toBe("52%");
    await expect(passingScoreCell).toHaveAttribute("data-pass-status", "pass");
    await expect.poll(
      () => passingScoreCell.evaluate((cell) => getComputedStyle(cell).getPropertyValue("--score-progress").trim()),
    ).toBe("80%");

    await expect(page.getByRole("columnheader", { name: /^판정/ })).toBeVisible();
    await page.getByRole("button", { name: /표시 옵션/ }).click();
    const summaryMode = page.getByRole("group", { name: "마지막 열 표시" });
    await summaryMode.getByRole("button", { name: "테스트 오답", exact: true }).click();

    await expect(page.getByRole("columnheader", { name: /^테스트 오답/ })).toBeVisible();
    const reviewCells = page.locator('td[data-col-type="exam-review"]');
    await expect(reviewCells).toHaveCount(4);
    await expect(reviewCells.nth(0)).toContainText("미완료");
    await expect(reviewCells.nth(0)).toContainText("미완료 1");
    await expect(reviewCells.nth(1)).toContainText("완료");
    await expect(reviewCells.nth(1)).toContainText("완료 1");
    await expect(reviewCells.nth(2)).toContainText("오답 없음");
    await expect(reviewCells.nth(3)).toContainText("채점 대기");

    const reviewFilter = page.getByRole("group", { name: "테스트 오답 확인 학생 필터" });
    await expect(reviewFilter.getByRole("button", { name: "전체 4명" })).toHaveAttribute("aria-pressed", "true");
    await expect(reviewFilter.getByRole("button", { name: "미완료 1명" })).toBeEnabled();
    await expect(reviewFilter.getByRole("button", { name: "채점 대기 1명" })).toBeEnabled();
    await expect(reviewFilter.getByRole("button", { name: "처리됨 2명" })).toBeEnabled();

    await reviewFilter.getByRole("button", { name: "미완료 1명" }).click();
    await expect(reviewCells).toHaveCount(1);
    await expect(page.getByText("자동저장학생1", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "현재 결과 선택" }).click();
    await expect(page.getByText("1명 선택됨", { exact: true })).toBeVisible();

    await page.getByRole("searchbox", { name: "학생 이름 검색" }).fill("학생2");
    await expect(reviewFilter.getByRole("button", { name: "전체 1명" })).toBeVisible();
    await expect(reviewFilter.getByRole("button", { name: "미완료 0명" })).toBeDisabled();
    await expect(page.getByText("조건에 맞는 학생이 없습니다")).toBeVisible();
    await reviewFilter.getByRole("button", { name: "처리됨 1명" }).click();
    await expect(page.getByText("자동저장학생2", { exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "학생 이름 검색" }).fill("");
    await page.screenshot({ path: testInfo.outputPath("score-test-wrong-column-1366.png"), fullPage: true });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("columnheader", { name: /^테스트 오답/ })).toBeVisible();
    await expect(page.getByRole("group", { name: "마지막 열 표시" }).getByRole("button", { name: "테스트 오답", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "테스트 오답 확인 학생 필터" }).getByRole("button", { name: "전체 4명" })).toHaveAttribute("aria-pressed", "true");

    await page.setViewportSize({ width: 390, height: 844 });
    const wrongTools = page.getByLabel("테스트 오답 빠른 필터");
    await wrongTools.scrollIntoViewIfNeeded();
    await expect(wrongTools).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("score-test-wrong-tools-390.png") });
    const tableScroller = page.locator(".ds-table-wrap--domain-scroll").filter({ has: page.locator(".ds-scores-table") });
    await tableScroller.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await expect(page.getByRole("columnheader", { name: /^테스트 오답/ })).toBeVisible();
    await tableScroller.screenshot({ path: testInfo.outputPath("score-test-wrong-column-390.png") });
  });

  test("Ymath 테넌트 기본값은 오답 확인이고 명시적 직원 설정은 유지된다", async ({ page }) => {
    await openScores(page, {
      initialScores: [52],
      initialCorrectionStatuses: ["PENDING"],
      scoreSummaryColumnDefault: "exam_wrong",
    });

    await expect(page.getByRole("columnheader", { name: /^테스트 오답/ })).toBeVisible();
    await page.getByRole("button", { name: /표시 옵션/ }).click();
    const summaryMode = page.getByRole("group", { name: "마지막 열 표시" });
    await expect(summaryMode.getByRole("button", { name: "테스트 오답", exact: true })).toHaveAttribute("aria-pressed", "true");

    await summaryMode.getByRole("button", { name: "종합 판정", exact: true }).click();
    await expect(page.getByRole("columnheader", { name: /^판정/ })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("columnheader", { name: /^판정/ })).toBeVisible();
  });

  test("미배정 시험·과제는 셀과 상단에서 드러나고 누락 전부 배정으로 복구된다", async ({ page }, testInfo) => {
    await openScores(page, { includeHomework: true });

    await expect(page.getByText("총 2명", { exact: true })).toBeVisible();
    const assignmentNotice = page.getByRole("region", { name: "응시·제출 대상 미배정 안내" });
    await expect(assignmentNotice).toContainText("1명의 응시·제출 배정이 누락됐습니다");
    await expect(assignmentNotice).toContainText("시험 0칸 · 과제 1칸");
    await expect(page.getByRole("cell", { name: "자동저장학생1 · 단원 복습 제출 대상 미배정" })).toContainText("미배정");
    await page.screenshot({ path: testInfo.outputPath("score-entry-unassigned-visible-1366.png"), fullPage: true });

    await assignmentNotice.getByRole("button", { name: "누락 전부 배정" }).click();
    await expect.poll(() => assignmentPuts.length).toBe(2);
    expect(assignmentPuts.every((request) => request.enrollmentIds.join(",") === "9201,9202")).toBe(true);
    await expect(assignmentNotice).toHaveCount(0);
  });

  test("키보드 이동은 미배정 칸을 건너뛰고 배정된 과제 점수는 셀에서 저장한다", async ({ page }) => {
    await openScores(page, {
      includeHomework: true,
      homeworkMaxScore: 43,
      initialHomeworkScores: [null, 41],
    });
    await expect(page.getByRole("cell", { name: "41/43", exact: true })).toBeVisible();
    await ensureScoreEditing(page);

    const firstExamCell = page.getByRole("textbox", { name: "자동저장학생1 · 주간 확인 점수 입력" });
    const secondExamCell = page.getByRole("textbox", { name: "자동저장학생2 · 주간 확인 점수 입력" });
    const assignedHomeworkCell = page.getByRole("textbox", { name: "자동저장학생2 · 단원 복습 점수 입력" });

    await firstExamCell.click();
    await firstExamCell.press("Tab");
    await expect(secondExamCell).toBeFocused();

    await assignedHomeworkCell.fill("42");
    await page.keyboard.press("Control+s");
    await expect.poll(() => homeworkPatches.at(-1)?.score, { timeout: 10_000 }).toBe(42);
    expect(homeworkPatches.at(-1)).toMatchObject({
      session_id: 9002,
      enrollment_id: 9202,
      homework_id: 9151,
      score: 42,
      max_score: 43,
    });
  });

  test("과제 미제출은 슬래시 뒤 Tab으로 확정하고 오른쪽 다음 셀로 이어간다", async ({ page }) => {
    await openScores(page, {
      includeHomework: true,
      homeworkMaxScore: 43,
      initialHomeworkScores: [null, 41],
      homeworkAssignedRows: [true, true],
    });
    await ensureScoreEditing(page);

    const firstHomeworkCell = page.getByRole("textbox", { name: "자동저장학생1 · 단원 복습 점수 입력" });
    const secondExamCell = page.getByRole("textbox", { name: "자동저장학생2 · 주간 확인 점수 입력" });
    await firstHomeworkCell.scrollIntoViewIfNeeded();
    await firstHomeworkCell.click();
    await page.keyboard.type("/");
    await firstHomeworkCell.press("Tab");

    await expect(firstHomeworkCell).toHaveText("미제출");
    await expect(secondExamCell).toBeFocused();
    await page.keyboard.press("Control+s");
    await expect.poll(() => homeworkPatches.at(-1)?.meta_status, { timeout: 10_000 }).toBe("NOT_SUBMITTED");
    expect(homeworkPatches.at(-1)).toMatchObject({
      session_id: 9002,
      enrollment_id: 9201,
      homework_id: 9151,
      score: null,
      max_score: 43,
      meta_status: "NOT_SUBMITTED",
    });
  });

  test("완료형 과제는 숫자 칸 대신 완료 상태 선택기로 저장한다", async ({ page }) => {
    await openScores(page, {
      includeHomework: true,
      homeworkMaxScore: 1,
      homeworkGradingMode: "COMPLETION",
      initialHomeworkScores: [null, 0],
    });
    await ensureScoreEditing(page);

    const completionSelect = page.getByRole("combobox", {
      name: "자동저장학생2 · 단원 복습 완료 상태",
    });
    await expect(completionSelect).toHaveValue("미완료");
    await completionSelect.selectOption("완료");

    await expect.poll(() => homeworkPatches.at(-1)?.score, { timeout: 10_000 }).toBe(1);
    expect(homeworkPatches.at(-1)).toMatchObject({
      enrollment_id: 9202,
      homework_id: 9151,
      max_score: 1,
    });
    await expect(completionSelect).toHaveValue("완료");
    await page.screenshot({ path: "test-results/homework-completion/scores-completion-select.png", fullPage: true });
  });

  test("수정 중 자동 저장·단축키를 지원하고 완료하면 다시 잠긴다", async ({ page }, testInfo) => {
    await openScores(page);

    const editButton = page.getByRole("button", { name: "수정", exact: true });
    await expect(editButton).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("score-entry-locked-1366.png"), fullPage: true });
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(editButton).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("score-entry-locked-1100.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(editButton).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("score-entry-locked-390.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 900 });

    await editButton.click();
    await expect(page.getByRole("button", { name: "저장하고 잠금", exact: true })).toBeVisible();
    await expect(page.getByText("Ctrl+S 저장 · Ctrl+Z 실행 취소")).toBeVisible();
    await expect(page.getByRole("button", { name: "OMR 스캔 등록" })).toBeEnabled();
    const cells = page.locator(".ds-scores-cell-editable");
    await expect(cells.first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("score-entry-editing-1366.png"), fullPage: true });
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.getByRole("button", { name: "저장하고 잠금", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("score-entry-editing-1100.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureScoreEditing(page);
    await expect(page.getByRole("button", { name: "저장하고 잠금", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("score-entry-editing-390.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    await ensureScoreEditing(page);

    await expect(cells.nth(0)).toHaveAttribute("role", "textbox", { timeout: 30_000 });
    await expect(cells.nth(0)).toHaveAttribute("aria-label", /자동저장학생1.*주간 확인/);
    await cells.nth(0).fill("");
    await page.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
    await expect(page.getByRole("button", { name: "저장하고 잠금", exact: true })).toBeVisible();
    await expect(cells.nth(0)).toHaveText("65");
    expect(scorePatches).toHaveLength(0);

    failNextDraftCommit = true;
    await cells.nth(0).click();
    await cells.nth(0).press("Control+a");
    await page.keyboard.type("7");
    // eslint-disable-next-line no-restricted-syntax -- 다자리 입력 중간값이 autosave idle(900ms)을 지나도 PATCH되지 않는지 검증.
    await page.waitForTimeout(1_200);
    expect(scorePatches).toHaveLength(0);
    await page.keyboard.type("4");
    await cells.nth(0).press("Enter");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(1);
    expect(scorePatches[0]).toMatchObject({ score: 74, max_score: 100 });
    await expect(page.getByRole("status")).toContainText("자동 저장 실패");
    await page.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
    await expect(editButton).toBeVisible();
    expect(scorePatches).toHaveLength(1);
    await editButton.click();
    await expect(page.getByRole("status")).toContainText("저장됨");

    await page.keyboard.press("Control+z");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(2);
    expect(scorePatches[1]).toMatchObject({ score: 65, max_score: 100 });
    await expect(cells.nth(0)).toHaveText("65");

    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(3);
    expect(scorePatches[2]).toMatchObject({ score: 74, max_score: 100 });
    await expect(cells.nth(0)).toHaveText("74");

    await cells.nth(0).fill("77");
    await page.keyboard.press("Control+s");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(4);
    expect(scorePatches[3]).toMatchObject({ score: 77, max_score: 100 });
    expect(draftPuts.length).toBeGreaterThanOrEqual(4);

    await cells.nth(0).click();
    await page.keyboard.press("Control+z");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(74);
    await page.keyboard.press("Control+z");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(65);
    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(74);
    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(77);

    const patchCountBeforeNativeUndo = scorePatches.length;
    const searchInput = page.getByRole("searchbox", { name: "학생 이름 검색" });
    await searchInput.fill("자동");
    await searchInput.press("Control+z");
    await expect
      .poll(() => scorePatches.length)
      .toBe(patchCountBeforeNativeUndo);

    await page.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
    await expect(editButton).toBeVisible();
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
    await expect(page.getByRole("cell", { name: /77\/100/ }).first()).toBeVisible();

    await editButton.click();
    await cells.nth(0).fill("77.5");
    await page.keyboard.press("Control+s");
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(77.5);
    await page.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
    await expect(editButton).toBeVisible();
    await expect(page.getByRole("cell", { name: /77\.5\/100/ }).first()).toBeVisible();

    await editButton.click();
    delayNextScorePatchMs = 1_500;
    await cells.nth(0).fill("79");
    await cells.nth(0).press("Enter");
    await expect(page.getByRole("status")).toContainText("자동 저장 중");
    await cells.nth(1).fill("81");
    await page.getByRole("tab", { name: "출결", exact: true }).first().click();
    await expect(page).toHaveURL(/\/attendance/);
    await expect.poll(() => scorePatches.at(-2)?.score, { timeout: 10_000 }).toBe(79);
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(81);
    await page.getByRole("tab", { name: "성적", exact: true }).first().click();
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("cell", { name: /79\/100/ }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /81\/100/ }).first()).toBeVisible();

    await editButton.click();
    failNextDraftPut = true;
    await cells.nth(0).fill("83");
    await page.getByRole("tab", { name: "출결", exact: true }).first().click();
    await expect(page).toHaveURL(/\/attendance/);
    await page.getByRole("tab", { name: "성적", exact: true }).first().click();
    const recoveryDialog = page.getByRole("dialog", { name: /임시저장된 변경 1건/ });
    await expect(recoveryDialog).toBeVisible({ timeout: 30_000 });
    await expect(editButton).toBeDisabled();
    await expect(page.getByRole("button", { name: "OMR 스캔 등록" })).toBeDisabled();
    const releasedBeforeRecoveryNavigation = draftCommits.filter(
      (commit) => commit.release_lease === true,
    ).length;
    await page
      .getByRole("tab", { name: "출결", exact: true })
      .first()
      .evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page).toHaveURL(/\/attendance/);
    await expect
      .poll(
        () => draftCommits.filter((commit) => commit.release_lease === true).length,
        { timeout: 2_000 },
      )
      .toBe(releasedBeforeRecoveryNavigation);
    await page.getByRole("tab", { name: "성적", exact: true }).first().click();
    await expect(recoveryDialog).toBeVisible({ timeout: 10_000 });
    failNextDraftCommit = true;
    await recoveryDialog.getByRole("button", { name: "버리기" }).click();
    await expect(recoveryDialog).toBeVisible();
    await expect(recoveryDialog.getByRole("alert")).toContainText(/실패|failed|500/i);
    await recoveryDialog.getByRole("button", { name: "복원 후 수정" }).click();
    await expect(page.getByRole("button", { name: "저장하고 잠금", exact: true })).toBeVisible();
    await expect.poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 }).toBe(83);
    await page.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
    await expect(page.getByRole("cell", { name: /83\/100/ }).first()).toBeVisible();
    await expect(page.getByRole("dialog", { name: /임시저장된 변경/ })).toHaveCount(0);

    await editButton.click();
    failNextLeaseRelease = true;
    await page.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
    await expect(page.getByRole("button", { name: "잠금 다시 시도", exact: true })).toBeVisible();
    await expect(page.locator(".ds-scores-cell-editable").first()).toBeVisible();
    await page.getByRole("button", { name: "잠금 다시 시도", exact: true }).click();
    await expect(editButton).toBeVisible();
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");

    expect(scorePatchHeaders.length).toBeGreaterThan(0);
    for (const headers of scorePatchHeaders) {
      expect(headers["x-score-editor-client"]).toBeTruthy();
      expect(headers["x-score-session-id"]).toMatch(/^\d+$/);
    }
  });
});
