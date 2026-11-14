import { expect, test, type Page, type Route } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const LECTURE_ID = 9811;
const SESSION_ID = 9812;
const CHOICE_EXAM_ID = 9813;
const WRITTEN_EXAM_ID = 9814;
const MIXED_EXAM_ID = 9815;
const UNENTERED_ENROLLMENT_ID = 9910;
const PENDING_ENROLLMENT_ID = 9912;

type ScoreRouteOptions = { choicePending?: boolean; extraManualRows?: boolean };
type ManualScoreRequest = {
  apply: boolean;
  rows: Array<{
    enrollment_id: number;
    expected_version: string | null;
    attendance: "present" | "absent";
    cells: Record<string, { score?: number }>;
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

const exams = [
  {
    exam_id: CHOICE_EXAM_ID,
    title: "중대부고 2회차 객관식",
    grading_mode: "choice",
    manual_grading_method: "score",
    choice_count: 20,
    essay_count: 0,
    objective_max_score: 100,
    subjective_max_score: 0,
  },
  {
    exam_id: WRITTEN_EXAM_ID,
    title: "중대부고 2회차 서술형",
    grading_mode: "written",
    manual_grading_method: "score",
    choice_count: 0,
    essay_count: 2,
    objective_max_score: 0,
    subjective_max_score: 20,
  },
  {
    exam_id: MIXED_EXAM_ID,
    title: "중대부고 2회차 혼합형",
    grading_mode: "mixed",
    manual_grading_method: "score",
    choice_count: 20,
    essay_count: 2,
    objective_max_score: 80,
    subjective_max_score: 20,
  },
] as const;

async function installRoutes(page: Page, options: ScoreRouteOptions = {}) {
  const unexpectedMutations: string[] = [];
  let savedSubjectiveScore: number | null = null;
  let savedAbsence = false;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, json: body });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/scores/`) && method === "GET") {
      return fulfill({
        meta: {
          session_title: "2회차",
          lecture_title: "중대부고 통합과학",
          lecture_id: LECTURE_ID,
          exams: exams.map((exam, index) => ({
            ...exam,
            pass_score: 60,
            max_score: 100,
            score_shape_source: "question",
            display_order: index + 1,
          })),
          homeworks: [],
        },
        rows: [{
          enrollment_id: 9911,
          student_id: 9912,
          attendance_status: "PRESENT",
          student_name: "테스트 학생",
          lecture_title: "중대부고 통합과학",
          lecture_color: "#2563eb",
          lecture_chip_label: "중",
          exams: exams.map((exam) => ({
            exam_id: exam.exam_id,
            title: exam.title,
            pass_score: 60,
            attempt_count: 1,
            clinic_link_id: null,
            block: {
              score: exam.exam_id === MIXED_EXAM_ID ? 80 + (savedSubjectiveScore ?? 0) : exam.exam_id === CHOICE_EXAM_ID && options.choicePending ? 80 : null,
              max_score: 100,
              passed: null,
              clinic_required: false,
              is_locked: false,
              objective_score: exam.exam_id === MIXED_EXAM_ID || (exam.exam_id === CHOICE_EXAM_ID && options.choicePending) ? 80 : null,
              subjective_score: exam.exam_id === MIXED_EXAM_ID ? savedSubjectiveScore : null,
              is_provisional: exam.exam_id === MIXED_EXAM_ID && savedSubjectiveScore == null,
              grading_status: (exam.exam_id === MIXED_EXAM_ID && savedSubjectiveScore == null)
                || (exam.exam_id === CHOICE_EXAM_ID && options.choicePending) ? "subjective_pending" : null,
              correction_status: "NOT_REQUIRED",
              meta: {},
            },
          })),
          homeworks: [],
          clinic_required: false,
          progress_completed: false,
          updated_at: "2026-09-01T12:00:00+09:00",
        }],
      });
    }
    if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/`) && method === "GET") {
      return fulfill({ changes: [], stale: false, active_editors: [] });
    }
    if (path.endsWith(`/results/admin/exams/${MIXED_EXAM_ID}/manual-grading/`) && method === "GET") {
      const unenteredRow = {
        enrollment_id: UNENTERED_ENROLLMENT_ID,
        student_name: "미입력 학생",
        school: "",
        lectures: [],
        expected_version: savedAbsence ? "absent-1" : null,
        is_not_submitted: savedAbsence,
        exam_not_submitted_count: 2,
        cells: {
          "10001": { editable: false, entry_method: "omr", state: null, score: null, include_in_wrong_note: false },
          "10002": { editable: true, entry_method: "score", state: null, score: null, include_in_wrong_note: false },
        },
      };
      const pendingRow = {
        ...unenteredRow,
        enrollment_id: PENDING_ENROLLMENT_ID,
        student_name: "서술형 대기 학생",
        expected_version: "omr-pending",
        is_not_submitted: false,
        exam_not_submitted_count: 0,
        cells: {
          ...unenteredRow.cells,
          "10001": { ...unenteredRow.cells["10001"], state: "correct", score: 80 },
        },
      };
      return fulfill({
        exam_id: MIXED_EXAM_ID,
        exam_title: "중대부고 2회차 혼합형",
        grading_mode: "mixed",
        manual_grading_method: "score",
        has_manual_questions: true,
        exam_max_score: 100,
        question_score_total: 100,
        score_adjustment_total: 0,
        questions: [
          {
            question_id: 10001,
            number: 1,
            kind: "choice",
            answer_type: "choice",
            max_score: 80,
            editable: false,
            entry_method: "omr",
          },
          {
            question_id: 10002,
            number: 2,
            kind: "essay",
            answer_type: "written",
            max_score: 20,
            editable: true,
            entry_method: "score",
          },
        ],
        rows: [
          ...(options.extraManualRows ? [unenteredRow] : []),
          {
            enrollment_id: 9911,
            student_name: "테스트 학생",
            school: "중대부고",
            lectures: [{
              id: LECTURE_ID,
              lecture_name: "중대부고 통합과학",
              color: "#2563eb",
              chip_label: "중",
            }],
            expected_version: savedSubjectiveScore == null ? "omr-1" : "saved-1",
            is_not_submitted: false,
            exam_not_submitted_count: 0,
            cells: {
              "10001": {
                editable: false,
                entry_method: "omr",
                state: "correct",
                score: 80,
                include_in_wrong_note: false,
              },
              "10002": {
                editable: true,
                entry_method: "score",
                state: savedSubjectiveScore == null ? null : "incorrect",
                score: savedSubjectiveScore,
                include_in_wrong_note: false,
              },
            },
          },
          ...(options.extraManualRows ? [pendingRow] : []),
        ],
      });
    }
    if (path.endsWith(`/results/admin/exams/${MIXED_EXAM_ID}/manual-grading/`) && method === "POST") {
      const body = request.postDataJSON() as ManualScoreRequest;
      const errors = body.rows.flatMap((row, index) => {
        if (row.attendance === "absent") return [];
        const score = row.cells["10002"]?.score;
        if (row.enrollment_id === UNENTERED_ENROLLMENT_ID) {
          return [{ row: index + 1, field: "omr", message: "선택형 OMR 채점을 먼저 완료해 주세요: 1번" }];
        }
        if (typeof score !== "number" || score < 0 || score > 20) {
          return [{ row: index + 1, field: "question_2", message: "2번: 0점 이상 20점 이하의 점수를 입력해 주세요." }];
        }
        return [];
      });
      const rows = errors.length ? [] : body.rows.map((row) => {
        const absent = row.attendance === "absent";
        const score = row.cells["10002"]?.score ?? 0;
        if (body.apply && absent && row.enrollment_id === UNENTERED_ENROLLMENT_ID) savedAbsence = true;
        if (body.apply && !absent && row.enrollment_id === 9911) savedSubjectiveScore = score;
        return {
          enrollment_id: row.enrollment_id,
          student_name: absent ? "미입력 학생" : "테스트 학생",
          correct_count: absent ? 0 : 1,
          wrong_count: 0, wrong_questions: [], review_count: 0, review_questions: [],
          total_score: absent ? 0 : 80 + score, max_score: 100, will_overwrite: false,
          is_not_submitted: absent,
        };
      });
      return fulfill({
        ok: errors.length === 0, applied: body.apply && errors.length === 0, exam_id: MIXED_EXAM_ID,
        exam_title: "중대부고 2회차 혼합형", grading_mode: "mixed", manual_grading_method: "score",
        matched_count: rows.length, question_count: 2, overwrite_count: 0,
        not_submitted_count: rows.filter((row) => row.is_not_submitted).length, errors, rows,
      }, body.apply && errors.length ? 400 : 200);
    }
    if (
      path.endsWith(`/results/admin/exams/${MIXED_EXAM_ID}/enrollments/9911/`)
      && method === "GET"
    ) {
      return fulfill({
        target_type: "exam",
        target_id: MIXED_EXAM_ID,
        enrollment_id: 9911,
        attempt_id: 10011,
        total_score: 80,
        max_score: 100,
        submitted_at: "2026-09-01T12:00:00+09:00",
        items: [
          {
            question_id: 10001,
            question_number: 1,
            question_kind: "choice",
            answer: "1",
            correct_answer: "1",
            is_correct: true,
            score: 80,
            max_score: 80,
            is_editable: false,
          },
          {
            question_id: 10002,
            question_number: 2,
            question_kind: "essay",
            answer: "",
            correct_answer: "해설참조",
            is_correct: false,
            score: 0,
            max_score: 20,
            is_editable: true,
          },
        ],
        questions: [
          { question_id: 10001, number: 1, max_score: 80, kind: "choice" },
          { question_id: 10002, number: 2, max_score: 20, kind: "essay" },
        ],
        score_shape: {
          total_questions: 2,
          choice_count: 1,
          essay_count: 1,
          objective_max_score: 80,
          subjective_max_score: 20,
          total_max_score: 100,
        },
        submission_id: 10021,
        submission_status: "answers_ready",
        edit_state: { can_edit: true, lock_reason: null },
        passed: true,
        remediated: true,
        final_pass: true,
        achievement: "PASS",
        clinic_retake: {
          score: 100,
          pass_score: 90,
          resolution_type: "MANUAL_OVERRIDE",
        },
        is_provisional: true,
        grading_status: "subjective_pending",
        meta_status: null,
      });
    }
    if (path.endsWith("/results/admin/attempt-history/") && method === "GET") {
      return fulfill({
        source_type: "exam",
        source_id: MIXED_EXAM_ID,
        source_title: "중대부고 2회차 혼합형",
        pass_score: 90,
        max_score: 100,
        attempts: [{
          attempt_index: 1,
          score: 80,
          max_score: 100,
          pass_score: 90,
          passed: null,
          at: "2026-09-01T12:00:00+09:00",
          source: "grade",
        }],
        clinic_link_id: null,
        resolved: null,
      });
    }
    if (path.endsWith(`/exams/${MIXED_EXAM_ID}/questions/`) && method === "GET") {
      return fulfill([
        { id: 10001, number: 1, score: 80, kind: "choice" },
        { id: 10002, number: 2, score: 20, kind: "essay" },
      ]);
    }
    if (path.endsWith("/lectures/attendance/") && method === "GET") {
      return fulfill({ count: 1, results: [{ id: 9921, enrollment_id: 9911, status: "PRESENT" }] });
    }
    if (path.endsWith(`/lectures/lectures/${LECTURE_ID}/`) && method === "GET") {
      return fulfill({ id: LECTURE_ID, title: "중대부고 통합과학", color: "#2563eb", chip_label: "중" });
    }
    if (path.endsWith(`/lectures/sessions/${SESSION_ID}/`) && method === "GET") {
      return fulfill({
        id: SESSION_ID,
        lecture: LECTURE_ID,
        order: 2,
        regular_order: 2,
        title: "2회차",
        display_label: "2회차",
        date: "2026-09-01",
      });
    }
    if (path.endsWith("/lectures/sessions/") && method === "GET") {
      return fulfill({ count: 1, results: [] });
    }
    if (path.endsWith("/enrollments/session-enrollments/") && method === "GET") {
      return fulfill({ count: 1, results: [] });
    }
    if (path.endsWith("/staffs/currently-working/") && method === "GET") return fulfill([]);

    if (!["GET", "OPTIONS"].includes(method)) {
      unexpectedMutations.push(`${method} ${path}`);
      return fulfill({ detail: "unexpected mutation" }, 500);
    }
    return route.fallback();
  });

  return unexpectedMutations;
}

async function openScores(page: Page, options: ScoreRouteOptions & { gradingExamId?: number } = {}) {
  const baseUrl = getBaseUrl("admin");
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl),
    "OMR·서술형 진입 route-mock은 로컬 dev 서버 전용",
  );
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, createLocalJwt());
  const unexpectedMutations = await installRoutes(page, options);
  await page.goto(
    `${baseUrl}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores${options.gradingExamId ? `?gradingExamId=${options.gradingExamId}` : ""}`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );
  await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_ID}/scores`));
  const omrButton = page.getByRole("button", { name: "OMR 스캔 등록" });
  await expect(omrButton).toBeVisible({ timeout: 30_000 });
  await expect(omrButton).toBeEnabled();
  return unexpectedMutations;
}

test.describe("OMR와 서술형 점수 입력 진입", () => {
  for (const { width, failure } of [
    { width: 1366, failure: null }, { width: 390, failure: null },
    { width: 1366, failure: "conflict" }, { width: 390, failure: "network" },
    { width: 390, failure: "refresh" },
  ]) {
    test(`잠긴 성적표에서 답안 입력·보존·재시도 후 다시 조회한다 (${width}px, ${failure ?? "empty"})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const unexpectedMutations = await openScores(page);
      let savedAnswer = failure ? "2" : "";
      let leaseAcquired = false;
      let rejectLease = Boolean(failure && failure !== "refresh");
      let rejectDetail = failure === "refresh";
      let rejectedLeases = 0;
      const writes: string[] = [];
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const method = request.method();
        if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/`) && method === "PUT") {
          if (rejectLease) {
            rejectLease = false;
            rejectedLeases += 1;
            if (failure === "network") return route.abort("aborted");
            // Another teacher saves while this editor waits for the lease.
            savedAnswer = "3";
            return route.fulfill({ status: 409, json: { code: "SCORE_EDIT_LOCKED" } });
          }
          if (!leaseAcquired && failure === "refresh") savedAnswer = "3";
          leaseAcquired = true;
          return route.fulfill({ json: { changes: [], active_editors: [] } });
        }
        if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/commit/`) && method === "POST") {
          return route.fulfill({ json: { ok: true } });
        }
        if (path.endsWith(`/results/admin/exams/${CHOICE_EXAM_ID}/enrollments/9911/items/10031/`) && method === "PATCH") {
          expect(leaseAcquired).toBe(true);
          expect(request.headers()["x-score-session-id"]).toBe(String(SESSION_ID));
          savedAnswer = (request.postDataJSON() as { answer: string }).answer;
          writes.push(savedAnswer);
          return route.fulfill({ json: { saved: true, ok: true, score: 100, total_score: 100 } });
        }
        if (path.endsWith(`/results/admin/exams/${CHOICE_EXAM_ID}/enrollments/9911/`) && method === "GET") {
          if (leaseAcquired && rejectDetail) {
            return route.fulfill({ status: 500, json: { detail: "synthetic detail read failure" } });
          }
          return route.fulfill({ json: {
            target_type: "exam", target_id: CHOICE_EXAM_ID, enrollment_id: 9911,
            attempt_id: null, total_score: savedAnswer === "4" ? 100 : 0, max_score: 100,
            items: savedAnswer ? [{ question_id: 10031, question_number: 1, question_kind: "choice",
              answer: savedAnswer, score: savedAnswer === "4" ? 100 : 0, max_score: 100, is_correct: savedAnswer === "4", is_editable: true }] : [],
            questions: [{ question_id: 10031, number: 1, max_score: 100, kind: "choice" }],
            correct_answers: { "10031": "4" },
            score_shape: { total_questions: 1, choice_count: 1, essay_count: 0,
              objective_max_score: 100, subjective_max_score: 0, total_max_score: 100 },
            edit_state: { can_edit: true }, is_provisional: false,
            achievement: savedAnswer ? "PASS" : "NOT_SUBMITTED",
          } });
        }
        return route.fallback();
      });
      const openAnswer = async () => {
        await page.getByText("테스트 학생", { exact: true }).first().click();
        const drawer = page.locator(".student-scores-drawer");
        await drawer.locator(".student-scores-drawer__exam-header")
          .filter({ hasText: "중대부고 2회차 객관식" }).click();
        await drawer.getByRole("button", { name: "답안 보기·입력" }).click();
        return page.getByRole("dialog").filter({ hasText: "중대부고 2회차 객관식 답안 상세" });
      };
      const dialog = await openAnswer();
      const start = dialog.getByRole("button", { name: failure ? "성적 수정" : "답안 입력 시작", exact: true });
      if (failure) {
        await expect(dialog.locator(".srd-read__choice-ans")).toHaveText("2");
        await start.click();
        if (failure === "refresh") {
          await expect(dialog.getByRole("alert")).toContainText("답안과 문항 정보를 불러오지 못했습니다.");
          await expect(dialog.locator(".srd-edit__choice-row")).toHaveCount(0);
          expect(leaseAcquired).toBe(true);
          expect(writes).toEqual([]);
          expect(savedAnswer).toBe("3");
          rejectDetail = false;
          await dialog.getByRole("button", { name: "다시 시도", exact: true }).click();
          await expect(dialog.locator(".srd-read__choice-ans")).toHaveText("3");
          await expect(dialog.locator(".srd-edit__choice-row")).toHaveCount(0);
        } else {
          await expect.poll(() => rejectedLeases).toBe(1);
          await expect(page.getByText("답안 수정 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.", { exact: true })).toBeVisible();
          await expect(start).toBeEnabled();
          await expect(dialog.locator(".srd-edit__choice-row")).toHaveCount(0);
          await expect(dialog.locator(".srd-read__choice-ans")).toHaveText("2");
          expect(leaseAcquired).toBe(false);
          expect(writes).toEqual([]);
          expect(savedAnswer).toBe(failure === "conflict" ? "3" : "2");
        }
      }
      await start.click();
      await expect(dialog.locator(".srd-edit__choice-row")).toBeVisible();
      if (failure === "conflict" || failure === "refresh") {
        await expect(dialog.locator(".srd-edit__bubble--wrong")).toHaveText("3");
        expect(writes).toEqual([]);
      }
      if (failure === "network") {
        await dialog.locator(".srd-edit__choice-row").getByRole("button", { name: "2", exact: true }).click();
        await expect.poll(() => writes).toEqual([""]);
      }
      await dialog.locator(".srd-edit__choice-row").getByRole("button", { name: "4", exact: true }).click();
      if (failure === "conflict" || failure === "refresh") {
        await expect.poll(() => writes).toEqual(["3,4"]);
        expect(savedAnswer).toBe("3,4");
        await dialog.locator(".srd-edit__choice-row").getByRole("button", { name: "3", exact: true }).click();
        await expect.poll(() => writes).toEqual(["3,4", "4"]);
      } else {
        await expect.poll(() => writes).toEqual(failure === "network" ? ["", "4"] : ["4"]);
      }
      await expect(dialog.locator(".srd-edit__bubble--correct")).toHaveText("4");
      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      await page.reload({ waitUntil: "domcontentloaded" });
      const reloaded = await openAnswer();
      await expect(reloaded.locator(".srd-stateB")).toHaveCount(0);
      await expect(reloaded.locator(".srd-read")).toContainText("100");
      expect(unexpectedMutations).toEqual([]);
    });
  }
  test.setTimeout(90_000);

  test("작업박스 링크로 해당 시험의 서술형 입력을 바로 연다", async ({ page }) => {
    await openScores(page, { gradingExamId: MIXED_EXAM_ID });
    await expect(page.getByRole("region", { name: "혼합 채점 워크스페이스" })).toBeVisible();
    await expect(page).not.toHaveURL(/gradingExamId=/);
  });

  test("OMR 복수 선택과 빈칸을 확인하고 오래된 검수와 편집에서 복구한다", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const unexpectedMutations = await openScores(page);
    const submissionId = 10021;
    const savedAnswers: string[] = [];
    const confirmedVersions: string[] = [];
    const editVersions: Array<string | undefined> = [];
    let editRevision = "edit-1";
    let detailMode: "ok" | "failure" | "mismatch" | "retired" = "ok";
    let firstAnswer = "1";
    let reviewVersion: string | null = "review-1";
    const scan = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="white"/></svg>',
    );
    await page.route("**/api/v1/submissions/submissions/**", async (route) => {
      const url = new URL(route.request().url());
      const review = { required: reviewVersion != null, reasons: reviewVersion ? ["ANSWER_SCORE_AMBIGUOUS"] : [] };
      const status = review.required ? "answers_ready" : "done";
      if (url.pathname.endsWith(`/exams/${MIXED_EXAM_ID}/`)) {
        const row = {
          id: submissionId, enrollment_id: 9911, student_name: "테스트 학생",
          status, source: "omr_scan", score: review.required ? null : 27, created_at: "2026-09-01T12:00:00+09:00",
          has_file: true, manual_review_required: review.required, manual_review_reasons: review.reasons,
          identifier_status: "matched",
        };
        if (url.searchParams.get("review_issues") === "1") {
          return route.fulfill({ json: {
            items: review.required ? [row] : [], total: Number(review.required), next_cursor: null,
          } });
        }
        return route.fulfill({ json: [row] });
      }
      if (url.pathname.endsWith(`/${submissionId}/manual-edit/`)) {
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as {
            answer_review_version?: string;
            expected_edit_revision?: string;
            answers?: Array<{ exam_question_id: number; answer: string }>;
          };
          if (body.answer_review_version) {
            expect(body.answers).toBeUndefined();
            confirmedVersions.push(body.answer_review_version);
            if (reviewVersion === "review-1") {
              reviewVersion = "review-2";
              return route.fulfill({ status: 409, json: {
                code: "OMR_ANSWER_REVIEW_CHANGED", detail: "답안지 검수 상태가 바뀌었습니다. 최신 답안지를 확인해 주세요.",
              } });
            }
            expect(body.answer_review_version).toBe("review-2");
            reviewVersion = null;
            return route.fulfill({ json: { status: "done", graded: true, score: 27 } });
          }
          expect(body.answers).toEqual([{ exam_question_id: 10001, answer: expect.any(String) }]);
          editVersions.push(body.expected_edit_revision);
          if (editRevision === "edit-1") {
            editRevision = "edit-2";
            firstAnswer = "3";
            return route.fulfill({ status: 409, json: { code: "OMR_EDIT_CHANGED" } });
          }
          if (savedAnswers.length === 4) {
            detailMode = "retired";
            return route.fulfill({ status: 409, json: { code: "OMR_EDIT_CHANGED" } });
          }
          expect(body.expected_edit_revision).toBe(editRevision);
          firstAnswer = body.answers![0].answer;
          savedAnswers.push(firstAnswer);
          return route.fulfill({ json: { graded: true, score: firstAnswer === "1" ? 27 : 26 } });
        }
        if (detailMode === "failure") return route.fulfill({ status: 503, json: {} });
        return route.fulfill({ json: {
          submission_id: detailMode === "mismatch" ? submissionId + 1 : submissionId,
          submission_status: detailMode === "retired" ? "superseded" : status, enrollment_id: 9911,
          target_type: "exam", target_id: MIXED_EXAM_ID, identifier: {},
          scan_image_url: scan, scan_image_size: { width: 900, height: 1200 },
          scan_image_is_aligned: true, meta: { manual_review: review }, duplicate_siblings: [],
          answer_review_version: reviewVersion,
          edit_revision: detailMode === "retired" ? null : editRevision,
          answers: Array.from({ length: 30 }, (_, index) => ({
            question_id: 10001 + index, question_no: index + 1,
            answer: [firstAnswer, "", "3,5", "3,5"][index] ?? "1",
            omr: index === 1 ? { marking: "blank", confidence: 0, status: "blank" }
              : index === 2 || index === 3
                ? { marking: "multi", confidence: 0.9, status: "ambiguous", expected_multi_answer: index === 3 }
                : { marking: "single", confidence: 1, status: "ok" },
          })),
        } });
      }
      return route.fallback();
    });

    await page.getByTestId("subjective-pending-banner")
      .getByRole("button", { name: "중대부고 2회차 혼합형 문항별 점수 입력" }).click();
    await expect(page.getByRole("region", { name: "혼합 채점 워크스페이스" })).toBeVisible();
    await page.getByRole("button", { name: "OMR 결과 보정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "OMR 검토", exact: true });
    await expect(dialog).toBeVisible();
    const answerRows = dialog.locator(".orw-q-row");
    await expect(answerRows).toHaveCount(30);
    const scanImage = page.getByRole("img", { name: "OMR 스캔 원본", exact: true });
    await expect(scanImage).toBeVisible();
    await expect.poll(() => scanImage.evaluate((element: HTMLImageElement) => (
      element.complete && element.naturalWidth > 0 && element.naturalHeight > 0
    ))).toBe(true);
    await expect(answerRows.nth(1)).toContainText("미응답");
    await expect(answerRows.nth(1)).not.toHaveClass(/orw-q-row--flag/);
    await expect(answerRows.nth(2)).toContainText("복수 선택");
    await expect(answerRows.nth(2)).toHaveClass(/orw-q-row--flag/);
    await expect(answerRows.nth(3)).not.toHaveClass(/orw-q-row--flag/);
    const confirmReview = dialog.getByRole("button", { name: "이상 없음", exact: true });
    await expect(confirmReview).toBeEnabled();
    await dialog.screenshot({ path: testInfo.outputPath("omr-confirm-desktop.png") });
    await confirmReview.press("Enter");
    await expect(page.getByText("답안지 검수 상태가 바뀌었습니다. 최신 답안지를 확인해 주세요.")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await dialog.getByRole("tab", { name: "확인", exact: true }).click();
    await expect(confirmReview).toBeEnabled();
    await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.screenshot({ path: testInfo.outputPath("omr-confirm-mobile.png") });
    await confirmReview.click();
    await expect(dialog.getByRole("button", { name: "변경 사항 없음", exact: true })).toBeDisabled();
    expect(confirmedVersions).toEqual(["review-1", "review-2"]);
    await expect(dialog.locator(".orw-q-row--flag")).toHaveCount(0);
    await expect(answerRows.nth(2).getByRole("button", { name: "3", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(answerRows.nth(2).getByRole("button", { name: "5", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(answerRows.nth(1)).toContainText("미응답");

    const firstAnswerRow = answerRows.first();
    await firstAnswerRow.getByRole("button", { name: "2", exact: true }).click();
    const saveEdit = dialog.getByRole("button", { name: "저장 + 재채점", exact: true });
    await saveEdit.press("Enter");
    await expect(dialog.getByRole("alert").filter({ hasText: "입력한 답안은 유지됩니다." })).toBeVisible();
    await expect(saveEdit).toBeDisabled();
    await expect(firstAnswerRow.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const reviewLatest = dialog.getByRole("button", { name: "최신 답안 확인" });
    const preservedChoice = firstAnswerRow.getByRole("button", { name: "2", exact: true });
    const detailFailure = dialog.getByText("답안 상세를 새로 불러오지 못했습니다. 입력한 답안은 유지됩니다.");
    detailMode = "failure";
    await reviewLatest.press("Enter");
    await expect(detailFailure).toBeVisible();
    await expect(preservedChoice).toHaveAttribute("aria-pressed", "true");
    await expect(saveEdit).toBeDisabled();

    detailMode = "mismatch";
    await reviewLatest.press("Enter");
    await expect(reviewLatest).toBeEnabled();
    await expect(detailFailure).toBeVisible();
    await expect(preservedChoice).toHaveAttribute("aria-pressed", "true");
    expect(editVersions).toEqual(["edit-1"]);

    detailMode = "ok";
    await dialog.getByRole("button", { name: "다시 시도" }).click();
    await expect(detailFailure).toHaveCount(0);
    await expect(preservedChoice).toHaveAttribute("aria-pressed", "true");
    await expect(saveEdit).toBeDisabled();
    await reviewLatest.press("Enter");
    const compare = page.getByRole("alertdialog", { name: "최신 답안지와 내 수정 확인" });
    await expect(compare).toContainText("1번: 3 → 1,2");
    await page.setViewportSize({ width: 1366, height: 900 });
    await expect(compare).toContainText("1번: 3 → 1,2");
    await compare.getByRole("button", { name: "내 수정 유지" }).press("Enter");
    expect(savedAnswers).toEqual([]);
    await saveEdit.click();
    await expect(dialog.getByRole("button", { name: "변경 사항 없음", exact: true })).toBeDisabled();
    expect(editVersions.slice(0, 2)).toEqual(["edit-1", "edit-2"]);
    for (const [choice, expected] of [["2", "1"], ["1", ""], ["1", "1"]]) {
      await firstAnswerRow.getByRole("button", { name: choice, exact: true }).click();
      await page.getByRole("button", { name: "저장 + 재채점", exact: true }).click();
      await expect(page.getByRole("button", { name: "변경 사항 없음", exact: true })).toBeDisabled();
      expect(savedAnswers.at(-1)).toBe(expected);
    }
    expect(savedAnswers).toEqual(["1,2", "1", "", "1"]);
    await firstAnswerRow.getByRole("button", { name: "4", exact: true }).click();
    await saveEdit.click();
    await reviewLatest.click();
    await expect(dialog.getByText("보관된 답안지", { exact: true })).toBeVisible();
    await expect(dialog.getByText("저장하지 않은 수정", { exact: true })).toBeVisible();
    await expect(dialog.getByText("1번: 1,4", { exact: true })).toBeVisible();
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 390) await dialog.getByRole("tab", { name: "확인", exact: true }).click();
      await expect(dialog.getByText("1번: 1,4", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /저장 \+ 재채점|답안지 폐기|이 답안 채택|이 방향으로 다시 읽기/ })).toHaveCount(0);
      await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    expect(editVersions).toHaveLength(6);
    expect(savedAnswers).toEqual(["1,2", "1", "", "1"]);
    expect(unexpectedMutations).toEqual([]);
  });

  test("390px OMR 검토에서 최근 목록 밖의 미식별 답안을 찾는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openScores(page);
    await page.route("**/api/v1/submissions/submissions/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith(`/exams/${MIXED_EXAM_ID}/`)) {
        if (url.searchParams.get("review_issues") === "1") {
          return route.fulfill({ json: { items: [{
            id: 10020, enrollment_id: 0, student_name: "", status: "needs_identification",
            source: "omr_scan", score: null, created_at: "2026-09-01T11:00:00+09:00",
            file_key: "old-scan.jpg", has_file: true, manual_review_required: true,
            manual_review_reasons: ["identifier_no_match"], identifier_status: "no_match",
          }], total: 1, next_cursor: null } });
        }
        return route.fulfill({ json: [{
          id: 10021, enrollment_id: 9911, student_name: "테스트 학생", status: "done",
          source: "omr_scan", score: 30, created_at: "2026-09-01T12:00:00+09:00",
          file_key: "recent-scan.jpg", has_file: true, manual_review_required: false,
          manual_review_reasons: [], identifier_status: "matched",
        }] });
      }
      if (url.pathname.endsWith("/10020/manual-edit/")) {
        return route.fulfill({ json: {
          submission_id: 10020, submission_status: "needs_identification", enrollment_id: null,
          target_type: "exam", target_id: MIXED_EXAM_ID, identifier: {},
          scan_image_url: "", scan_image_is_aligned: false, meta: {}, duplicate_siblings: [],
          answers: [{ question_id: 10001, question_no: 1, answer: "1", omr: null }],
        } });
      }
      return route.fallback();
    });
    await page.getByRole("button", { name: "중대부고 2회차 혼합형 문항별 점수 입력" }).click();
    await expect(page.getByRole("region", { name: "혼합 채점 워크스페이스" })).toBeVisible();
    await page.getByRole("button", { name: "OMR 결과 보정", exact: true }).click();
    const review = page.getByRole("dialog", { name: "OMR 검토", exact: true });
    await expect(review).toContainText("미해결 전체 1건", { timeout: 30_000 });
    await expect(review.getByText("미식별 학생", { exact: true })).toBeVisible();
    await expect(review.getByRole("button", { name: "검토 현황 새로고침" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  for (const width of [1366, 390]) {
    test(`${width}px OMR 검토에서 보관 답안은 기록만 열고 활성 문제를 유지한다`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const unexpectedMutations = await openScores(page);
      const scan = "data:image/svg+xml," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="120"><rect width="90" height="120" fill="white"/></svg>',
      );
      const makeRow = (
        id: number, status: string, archived: boolean, identifierStatus: string,
        manualReviewRequired: boolean,
      ) => ({
        id, enrollment_id: id === 10032 ? 9911 : 0,
        student_name: id === 10032 ? "테스트 학생" : "",
        status, archived, source: "omr_scan", score: id === 10032 ? 30 : null,
        created_at: "2026-09-01T12:00:00+09:00", file_key: `scan-${id}.jpg`, has_file: true,
        manual_review_required: manualReviewRequired,
        manual_review_reasons: manualReviewRequired ? ["identifier_no_match"] : [],
        identifier_status: identifierStatus,
      });
      const rows = [
        makeRow(10032, "done", false, "matched", false),
        makeRow(10031, "needs_identification", false, "missing", true),
        makeRow(10030, "failed", false, "no_match", true),
        makeRow(10029, "failed", true, "missing", true),
        makeRow(10028, "superseded", true, "no_match", true),
      ];
      await page.route("**/api/v1/submissions/submissions/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith(`/exams/${MIXED_EXAM_ID}/`)) {
          if (url.searchParams.get("review_issues") === "1") {
            return route.fulfill({ json: { items: [rows[1], rows[2]], total: 2, next_cursor: null } });
          }
          return route.fulfill({ json: rows });
        }
        const row = rows.find((item) => url.pathname.endsWith(`/${item.id}/manual-edit/`));
        if (row && route.request().method() === "GET") {
          return route.fulfill({ json: {
            submission_id: row.id, submission_status: row.status,
            enrollment_id: row.enrollment_id || null, target_type: "exam", target_id: MIXED_EXAM_ID,
            identifier: {}, scan_image_url: scan, original_scan_image_url: scan,
            scan_image_size: { width: 90, height: 120 }, scan_image_is_aligned: true,
            meta: { identifier_status: row.identifier_status, discarded: row.id === 10029 || row.id === 10031 },
            duplicate_siblings: [],
            answers: [{ question_id: 10001, question_no: 1, answer: "1", omr: null }],
          } });
        }
        if (row && route.request().method() === "POST") {
          return route.fulfill({ status: 409, json: { code: "OMR_EDIT_CHANGED" } });
        }
        return route.fallback();
      });

      const openReview = async () => {
        await page.getByRole("button", { name: "중대부고 2회차 혼합형 문항별 점수 입력" }).click();
        await expect(page.getByRole("region", { name: "혼합 채점 워크스페이스" })).toBeVisible();
        await page.getByRole("button", { name: "OMR 결과 보정", exact: true }).click();
        return page.getByRole("dialog", { name: "OMR 검토", exact: true });
      };
      let review = await openReview();
      await expect(review).toContainText("표시 완료 1 / 3 · 미해결 전체 2건");
      await expect(review.locator(".orw-filter-chip").filter({ hasText: /^식별실패\s*1$/ })).toHaveCount(1);
      await expect(review.locator(".orw-filter-chip").filter({ hasText: /^실패\s*1$/ })).toHaveCount(1);
      await expect(review.locator(".orw-filter-chip").filter({ hasText: /^보관\s*2$/ })).toHaveCount(1);
      const completedRow = review.locator(".orw-list-row").filter({ hasText: "테스트 학생" });
      const anotherRow = review.locator(".orw-list-row").filter({ hasText: "미식별 학생" }).first();
      await completedRow.click();
      const draft = review.getByRole("button", { name: "2", exact: true });
      await draft.click();
      await review.getByRole("button", { name: "저장 + 재채점" }).click();
      const conflict = review.getByText("다른 변경 사항이 저장되었습니다. 입력한 답안은 유지됩니다.");
      await expect(conflict).toBeVisible();
      const confirmNavigation = page.getByRole("alertdialog", { name: "다른 답안지로 이동" });
      await page.keyboard.press("k");
      await expect(confirmNavigation).toBeVisible();
      await confirmNavigation.getByRole("button", { name: "계속 편집" }).click();
      await expect(draft).toHaveAttribute("aria-pressed", "true");
      await expect(conflict).toBeVisible();
      if (width === 390) await review.getByRole("tab", { name: "대상 목록" }).click();
      await anotherRow.click();
      await confirmNavigation.getByRole("button", { name: "이동", exact: true }).click();
      await expect(review.getByRole("button", { name: "학생 검색·연결" })).toBeVisible();
      if (width === 390) await review.getByRole("tab", { name: "대상 목록" }).click();
      await completedRow.click();
      await expect(draft).toHaveAttribute("aria-pressed", "false");
      await expect(conflict).toHaveCount(0);
      if (width === 390) await review.getByRole("tab", { name: "대상 목록" }).click();
      await review.locator(".orw-filter-chip").filter({ hasText: "보관" }).click();
      await expect(review.locator(".orw-list-row")).toHaveCount(2);
      await review.locator(".orw-list-row").first().click();
      await expect(review.getByText("보관된 답안지", { exact: true })).toBeVisible();
      if (width === 390) await review.getByRole("tab", { name: "원본" }).click();
      await expect(review.getByRole("img", { name: "OMR 스캔 원본", exact: true })).toBeVisible();
      await expect(review.getByRole("button", { name: "답안지 폐기" })).toHaveCount(0);
      await expect(review.getByRole("button", { name: "저장 + 재채점" })).toHaveCount(0);
      await expect(review.getByRole("button", { name: "학생 검색·연결" })).toHaveCount(0);
      await review.getByRole("button", { name: "오른쪽으로 90도 회전" }).click();
      await expect(review.getByRole("button", { name: "이 방향으로 다시 읽기" })).toHaveCount(0);
      if (width === 390) await review.getByRole("tab", { name: "확인" }).click();
      await page.screenshot({ path: testInfo.outputPath(`omr-archived-${width}.png`) });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.reload({ waitUntil: "domcontentloaded" });
      review = await openReview();
      await expect(review).toContainText("표시 완료 1 / 3 · 미해결 전체 2건");
      await review.locator(".orw-filter-chip").filter({ hasText: "식별실패" }).click();
      await expect(review.locator(".orw-list-row")).toHaveCount(1);
      await review.locator(".orw-list-row").first().click();
      await expect(review.getByRole("button", { name: "학생 검색·연결" })).toBeVisible();
      await review.locator(".orw-filter-chip").filter({ hasText: /^실패\s*1$/ }).click();
      await expect(review.locator(".orw-list-row")).toHaveCount(1);
      expect(unexpectedMutations).toEqual([]);
    });
  }

  test("시험별 남은 채점을 보여주고 혼합형은 한 화면에서 이어진다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const unexpectedMutations = await openScores(page);

    const omrButton = page.getByRole("button", { name: "OMR 스캔 등록" });
    const mixedButton = page.getByRole("button", { name: "중대부고 2회차 혼합형 문항별 점수 입력" });
    await expect(mixedButton).toBeVisible();
    await expect(page.getByText("객관식 저장 완료 · 서술형 1명 남음")).toBeVisible();
    await expect(page.getByRole("button", { name: "중대부고 2회차 서술형 문항별 점수 입력" })).toBeVisible();
    await expect(page.getByRole("button", { name: "중대부고 2회차 객관식 문항별 점수 입력" })).toHaveCount(0);

    await omrButton.click();
    const omrPicker = page.getByRole("listbox", { name: "OMR 시험 선택" });
    await expect(omrPicker.getByText(/등록 대상 시험 선택/)).toBeVisible();
    await expect(omrPicker.getByRole("option", { name: /객관식/ })).toBeVisible();
    await expect(omrPicker.getByRole("option", { name: /혼합형/ })).toBeVisible();
    await expect(omrPicker.getByRole("option", { name: /서술형/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await mixedButton.click();

    const gradingDialog = page.getByRole("dialog").filter({ hasText: "중대부고 2회차 혼합형 혼합 채점" });
    await expect(gradingDialog).toBeVisible();
    await expect(gradingDialog.getByText("직접 문항 입력 중", { exact: true })).toBeVisible();
    await expect(gradingDialog.getByRole("button", { name: "OMR 답안 등록" })).toBeVisible();
    await expect(gradingDialog.getByRole("button", { name: "OMR 결과 보정" })).toBeVisible();
    await gradingDialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(gradingDialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_ID}/scores`));
    await expect(mixedButton).toBeVisible();
    expect(unexpectedMutations).toEqual([]);
  });

  test("390px에서도 OMR과 시험별 채점 진입점이 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const unexpectedMutations = await openScores(page);

    for (const button of [
      page.getByRole("button", { name: "OMR 스캔 등록" }),
      page.getByRole("button", { name: "중대부고 2회차 혼합형 문항별 점수 입력" }),
    ]) {
      const box = await button.boundingBox();
      expect(box?.height, await button.getAttribute("aria-label") ?? await button.innerText()).toBeGreaterThanOrEqual(44);
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }

    await page.getByRole("button", { name: "중대부고 2회차 혼합형 문항별 점수 입력" }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "중대부고 2회차 혼합형 혼합 채점" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "채점표 배율 선택" })).toHaveValue("80");
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))).toEqual({ body: 0, document: 0 });
    expect(unexpectedMutations).toEqual([]);
  });

  test("객관식만 판독된 혼합형은 최종점수 대신 서술형 입력 동선을 바로 제공한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const unexpectedMutations = await openScores(page);

    const banner = page.getByTestId("subjective-pending-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("1명의 서술형 점수 입력이 필요합니다");
    await expect(banner).toContainText("학생 공개·석차·클리닉 반영이 보류됩니다");
    await expect(page.getByText("객관 80", { exact: true })).toBeVisible();
    await expect(page.getByText("서술형 입력", { exact: true })).toBeVisible();

    await page.getByRole("checkbox", { name: "테스트 학생 선택" }).check();
    const scoreAlimtalkButton = page.getByRole("button", { name: "수업결과 알림톡 발송" });
    await expect(scoreAlimtalkButton).toBeDisabled();
    await expect(scoreAlimtalkButton).toHaveAttribute(
      "title",
      "서술형 점수 입력을 완료한 뒤 알림톡을 발송할 수 있습니다.",
    );

    await banner.getByRole("button", { name: "중대부고 2회차 혼합형 문항별 점수 입력" }).click();

    const gradingDialog = page.getByRole("dialog").filter({ hasText: "중대부고 2회차 혼합형 혼합 채점" });
    await expect(gradingDialog).toBeVisible();
    await expect(gradingDialog.getByText("직접 문항 입력 중", { exact: true })).toBeVisible();
    expect(unexpectedMutations).toEqual([]);
  });

  for (const width of [1366, 390]) {
    test(`${width}px 혼합 채점에서 빈 행은 유지하고 수정한 점수와 결시를 확정한다`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const unexpectedMutations = await openScores(page, { extraManualRows: true });
      await page.getByTestId("subjective-pending-banner")
        .getByRole("button", { name: "중대부고 2회차 혼합형 문항별 점수 입력" }).click();

      const dialog = page.getByRole("dialog").filter({ hasText: "중대부고 2회차 혼합형 혼합 채점" });
      await dialog.getByRole("combobox", { name: "채점표 배율 선택" }).selectOption(width === 390 ? "80" : "100");
      const unenteredRow = dialog.getByRole("row").filter({ hasText: "미입력 학생" });
      const scoreInput = dialog.getByRole("row").filter({ hasText: "테스트 학생" })
        .locator("input[data-manual-grade-cell]");
      const pendingRow = dialog.getByRole("row").filter({ hasText: "서술형 대기 학생" });
      const review = dialog.getByRole("button", { name: "입력 내용 확인", exact: true });
      const captureRequest = (apply: boolean) => page.waitForRequest((request) =>
        request.method() === "POST" && new URL(request.url()).pathname.endsWith(`/${MIXED_EXAM_ID}/manual-grading/`)
        && request.postDataJSON().apply === apply,
      ).then((request) => request.postDataJSON() as ManualScoreRequest);

      await expect(unenteredRow.getByRole("button", { name: "미입력", exact: true })).toBeVisible();
      await expect(pendingRow.getByRole("button", { name: "응시", exact: true })).toBeVisible();
      await expect(review).toBeDisabled();
      await scoreInput.fill("21");
      await review.click();
      await expect(dialog.getByRole("alert").filter({ hasText: "확정 전에 수정할 항목이 있습니다." }))
        .toContainText("테스트 학생 · 2번: 0점 이상 20점 이하의 점수를 입력해 주세요.");
      await expect(scoreInput).toHaveValue("21");

      const score = width === 390 ? 0 : 14;
      await scoreInput.fill(String(score));
      await expect(dialog.getByText("확인 대상 1명 · 나머지 2명 유지", { exact: true })).toBeVisible();
      const preview = captureRequest(false);
      await review.click();
      await expect(dialog.getByText("1명 · 결시 0명 · 성적 계산 완료", { exact: true })).toBeVisible();
      const reviewed = await preview;
      expect(reviewed.rows).toEqual([expect.objectContaining({
        enrollment_id: 9911, attendance: "present", cells: { "10002": { score, include_in_wrong_note: false } },
      })]);
      const apply = captureRequest(true);
      await dialog.getByRole("button", { name: "1명 성적 확정", exact: true }).click();
      expect(await apply).toEqual({ ...reviewed, apply: true });
      await expect(page.getByTestId("subjective-pending-banner")).toHaveCount(0);
      await expect(unenteredRow.getByRole("button", { name: "미입력", exact: true })).toBeEnabled();
      await expect(pendingRow.locator("input[data-manual-grade-cell]")).toHaveValue("");
      await testInfo.attach(`mixed-grading-${width}px`, { body: await dialog.screenshot(), contentType: "image/png" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await unenteredRow.getByRole("button", { name: "미입력", exact: true }).click();
      await expect(unenteredRow.locator("input[data-manual-grade-cell]")).toBeDisabled();
      await review.click();
      await expect(dialog.getByText("1명 · 결시 1명 · 성적 계산 완료", { exact: true })).toBeVisible();
      const absence = captureRequest(true);
      await dialog.getByRole("button", { name: "1명 성적 확정", exact: true }).click();
      expect((await absence).rows).toEqual([expect.objectContaining({
        enrollment_id: UNENTERED_ENROLLMENT_ID, attendance: "absent", expected_version: null,
      })]);
      await expect(unenteredRow.getByRole("button", { name: "결시", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: "닫기", exact: true }).click();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("subjective-pending-banner")).toHaveCount(0);
      await expect(page.locator(`[data-score-cell="exam:9911:${MIXED_EXAM_ID}:total:"]`)).toContainText(String(80 + score));
      expect(unexpectedMutations).toEqual([]);
    });
  }

  test("서술형 입력 셀은 채점창만 열고 학생 드로어까지 함께 열지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const unexpectedMutations = await openScores(page);

    await page.locator(`[data-score-cell="exam:9911:${MIXED_EXAM_ID}:total:"]`).click();

    await expect(
      page.getByRole("dialog").filter({ hasText: "중대부고 2회차 혼합형 혼합 채점" }),
    ).toBeVisible();
    await expect(page.locator(".student-scores-drawer")).toHaveCount(0);
    expect(unexpectedMutations).toEqual([]);
  });

  test("OMR 전용 설정과 서술형 대기 상태가 충돌하면 채점 불가 사유와 복구 경로를 보인다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const unexpectedMutations = await openScores(page, { choicePending: true });
    const banner = page.getByTestId("subjective-pending-banner");
    await expect(banner.getByText("서술형 채점 대기 상태와 OMR 전용 설정이 맞지 않습니다", { exact: false })).toBeVisible();
    await expect(banner.getByRole("button", { name: "중대부고 2회차 객관식 문항별 점수 입력" })).toHaveCount(0);

    await page.locator(`[data-score-cell="exam:9911:${CHOICE_EXAM_ID}:total:"]`).click();
    await expect(page.getByRole("alert").filter({ hasText: "시험명을 눌러 문항 유형과 채점 방식을 확인해 주세요" })).toBeVisible();
    await expect(page.getByRole("dialog").filter({ hasText: "혼합 채점" })).toHaveCount(0);
    expect(unexpectedMutations).toEqual([]);
  });

  test("서술형 미완료 답안 상세는 객관 점수만 표시하고 최종 PASS를 숨긴다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const unexpectedMutations = await openScores(page);

    await page.getByText("테스트 학생", { exact: true }).first().click();
    const studentDrawer = page.locator(".student-scores-drawer");
    await expect(studentDrawer).toBeVisible();
    await studentDrawer
      .locator(".student-scores-drawer__exam-header")
      .filter({ hasText: "중대부고 2회차 혼합형" })
      .click();
    await studentDrawer.getByRole("button", { name: "답안 상세 보기" }).click();

    const answerDialog = page.getByRole("dialog").filter({
      hasText: "중대부고 2회차 혼합형 답안 상세",
    });
    await expect(answerDialog).toBeVisible();
    await expect(answerDialog.getByText("객관 80점", { exact: true })).toBeVisible();
    await expect(answerDialog.getByText("서술형 입력 필요", { exact: true }).first()).toBeVisible();
    await expect(answerDialog.locator(".srd-read__score-max")).toHaveCount(0);
    await expect(answerDialog.locator(".srd-read__score-pct")).toHaveCount(0);
    await expect(answerDialog.getByText("보강 합격", { exact: true })).toHaveCount(0);
    await expect(answerDialog.getByText("PASS", { exact: true })).toHaveCount(0);
    expect(unexpectedMutations).toEqual([]);
  });

  for (const mode of ["delay-close", "delay-done", "delay-attempt", "500", "409", "quota", "readback", "auth-switch", "tenant-switch"] as const) {
    test(`기존 답안 수정은 저장 완료 전 닫기·잠금을 보류하고 실패를 복구한다 (${mode})`, async ({ page }) => {
      await page.setViewportSize({ width: mode === "409" || mode === "delay-done" ? 390 : 1366, height: 900 });
      const unexpectedMutations = await openScores(page);
      const storageFailure = mode === "quota" || mode === "readback";
      const authSwitch = mode === "auth-switch" || mode === "tenant-switch";
      if (storageFailure) {
        await page.getByRole("tab", { name: "출결", exact: true }).click();
        await page.getByRole("tab", { name: "성적", exact: true }).click();
        await expect(page.getByRole("button", { name: "OMR 스캔 등록" })).toBeVisible();
        await page.evaluate((failure) => {
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key: string, value: string) {
            if (this === window.sessionStorage && key.startsWith("answer-draft:")
                && !window.sessionStorage.getItem("qa-answer-storage-restored")) {
              if (failure === "quota") throw new DOMException("synthetic quota", "QuotaExceededError");
              return;
            }
            original.call(this, key, value);
          };
        }, mode);
      }
      let answer = "1";
      const patchActors: number[] = [];
      const patchTenants: string[] = [];
      let failPatch = mode === "500" || mode === "409" || storageFailure;
      const events: string[] = [];
      let finishPatch!: () => void;
      const delay = new Promise<void>((resolve) => { finishPatch = resolve; });
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const method = request.method();
        if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/`) && method === "PUT") {
          return route.fulfill({ json: { changes: [], active_editors: [] } });
        }
        if (path.endsWith(`/results/admin/sessions/${SESSION_ID}/score-draft/commit/`) && method === "POST") {
          if (request.postDataJSON().release_lease) events.push("release");
          return route.fulfill({ json: { ok: true } });
        }
        if (path.endsWith(`/results/admin/exams/${MIXED_EXAM_ID}/enrollments/9911/items/10001/`) && method === "PATCH") {
          events.push("patch-start");
          const token = request.headers().authorization?.replace(/^Bearer /, "") ?? "";
          patchActors.push(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).user_id);
          patchTenants.push(request.headers()["x-tenant-code"] ?? "");
          if (mode.startsWith("delay") || authSwitch) await delay;
          if (failPatch) {
            return route.fulfill({ status: mode === "409" ? 409 : 500, json: { detail: "synthetic save failure", code: "SCORE_EDIT_LOCKED" } });
          }
          answer = request.postDataJSON().answer;
          events.push("patch-ok");
          return route.fulfill({ json: { saved: true, score: 100, total_score: 100 } });
        }
        if (path.endsWith(`/exams/${MIXED_EXAM_ID}/questions/`) && method === "GET") {
          return route.fulfill({ json: [{ id: 10001, number: 1, score: 100, kind: "choice" }] });
        }
        if (path.endsWith("/results/admin/attempt-history/") && method === "GET") {
          return route.fulfill({ json: {
            source_type: "exam", source_id: MIXED_EXAM_ID, max_score: 100,
            attempts: [1, 2].map((attempt_index) => ({ attempt_index, score: 0, max_score: 100, passed: false })),
          } });
        }
        if (path.endsWith(`/results/admin/exams/${MIXED_EXAM_ID}/enrollments/9911/`) && method === "GET") {
          return route.fulfill({ json: {
            target_type: "exam", target_id: MIXED_EXAM_ID, enrollment_id: 9911,
            attempt_id: 10011, total_score: answer === "1,4" ? 100 : 0, max_score: 100,
            items: [{ question_id: 10001, question_number: 1, question_kind: "choice", answer,
              score: answer === "1,4" ? 100 : 0, max_score: 100, is_correct: answer === "1,4", is_editable: true }],
            questions: [{ question_id: 10001, number: 1, max_score: 100, kind: "choice" }],
            correct_answers: { "10001": "1,4" }, edit_state: { can_edit: true },
            is_provisional: false, grading_status: "graded",
            score_shape: { total_questions: 1, choice_count: 1, essay_count: 0,
              objective_max_score: 100, subjective_max_score: 0, total_max_score: 100 },
          } });
        }
        return route.fallback();
      });
      await page.getByRole("button", { name: "수정", exact: true }).click();
      const openAnswer = async () => {
        await page.getByText("테스트 학생", { exact: true }).first().click();
        const drawer = page.locator(".student-scores-drawer");
        await drawer.locator(".student-scores-drawer__exam-header").filter({ hasText: "중대부고 2회차 혼합형" }).click();
        await drawer.getByRole("button", { name: "답안 상세 보기", exact: true }).click();
        return page.getByRole("dialog").filter({ hasText: "중대부고 2회차 혼합형 답안 상세" });
      };
      const dialog = await openAnswer();
      await dialog.getByRole("button", { name: "성적 수정", exact: true }).click();
      await dialog.locator(".srd-edit__choice-row").getByRole("button", { name: "4", exact: true }).click();
      await expect.poll(() => events.filter((event) => event === "patch-start").length).toBe(1);
      if (authSwitch) {
        await dialog.locator(".srd-edit__choice-row").getByRole("button", { name: "5", exact: true }).click();
        const switchLogin = async (userId: number, generation: string, tenant = "hakwonplus") => {
          await page.evaluate(async ({ userId, generation, sessionId, tenant }) => {
            const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
            const access = `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, user_id: userId, tenant_code: tenant })}.sig`;
            const refresh = `${access}-refresh`;
            localStorage.setItem(`academy:auth-tokens:v1:${generation}`, JSON.stringify({ access, refresh, generation }));
            localStorage.setItem("academy:auth-active-generation:v1", generation);
            localStorage.setItem("access", access);
            localStorage.setItem("refresh", refresh);
            sessionStorage.setItem("tenantCode", tenant);
            await fetch(`/api/v1/results/admin/sessions/${sessionId}/score-draft/`, {
              method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${access}` },
              body: JSON.stringify({ changes: [] }),
            });
          }, { userId, generation, sessionId: SESSION_ID, tenant });
        };
        if (mode === "tenant-switch") await switchLogin(12, "qa-other-tenant", "qa-other-academy");
        else await switchLogin(99, "qa-other-account");
        finishPatch();
        await expect(dialog.getByRole("button", { name: "다시 저장", exact: true })).toBeVisible();
        await expect(dialog.getByRole("status")).toHaveCount(0);
        expect(patchActors).toEqual([12]);
        expect(patchTenants).toEqual(["hakwonplus"]);
        expect(answer).toBe("1,4");
        await dialog.getByRole("button", { name: "다시 저장", exact: true }).click();
        await expect(dialog.getByRole("status")).toHaveCount(0);
        expect(patchActors).toEqual([12]);
        expect(patchTenants).toEqual(["hakwonplus"]);
        await switchLogin(12, "qa-original-account-returned");
        await dialog.getByRole("button", { name: "다시 저장", exact: true }).click();
        await expect.poll(() => answer).toBe("1,4,5");
        expect(patchActors).toEqual([12, 12]);
        expect(patchTenants).toEqual(["hakwonplus", "hakwonplus"]);
        await dialog.getByRole("button", { name: "닫기", exact: true }).click();
        await expect(dialog).toHaveCount(0);
      } else if (mode.startsWith("delay")) {
        if (mode === "delay-attempt") await dialog.getByRole("button", { name: /2차 재시험/ }).click();
        else await dialog.getByRole("button", { name: mode === "delay-close" ? "닫기" : "수정 완료", exact: true }).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.locator(".srd-edit__choice-row")).toBeVisible();
        expect(answer).toBe("1");
        expect(events).not.toContain("release");
        finishPatch();
        if (mode === "delay-close") await expect(dialog).toHaveCount(0);
        else {
          if (mode === "delay-attempt") {
            await expect(dialog.locator(".srd-edit__choice-row")).toHaveCount(0);
            await dialog.getByRole("button", { name: /1차 응시/ }).click();
          }
          await expect(dialog.locator(".srd-read__choice-ans")).toHaveText("1,4");
          await dialog.getByRole("button", { name: "닫기", exact: true }).click();
        }
      } else {
        await expect(dialog.getByRole("button", { name: "다시 저장", exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "닫기", exact: true }).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.locator(".srd-edit__bubble--correct")).toHaveText(["1", "4"]);
        expect(answer).toBe("1");
        expect(events).not.toContain("release");
        if (storageFailure) {
          await expect(dialog.getByRole("alert").filter({ hasText: "브라우저에 복구 답안을 보관하지 못했습니다" })).toBeVisible();
          await page.goBack();
          await expect(page).not.toHaveURL(/\/scores/);
          expect(await page.evaluate(() => {
            const event = new Event("beforeunload", { cancelable: true });
            window.dispatchEvent(event);
            return event.defaultPrevented;
          })).toBe(true);
          await page.goForward();
          await expect(page.getByRole("button", { name: "OMR 스캔 등록" })).toBeVisible();
          await page.getByRole("button", { name: "수정", exact: true }).click();
          const restored = await openAnswer();
          await restored.getByRole("button", { name: "성적 수정", exact: true }).click();
          await expect(restored.locator(".srd-edit__bubble--correct")).toHaveText(["1", "4"]);
          await expect(restored.getByRole("alert").filter({ hasText: "복원했습니다" })).toBeVisible();
          await page.evaluate(() => window.sessionStorage.setItem("qa-answer-storage-restored", "1"));
        }
        failPatch = false;
        await dialog.getByRole("button", { name: "다시 저장", exact: true }).click();
        await expect.poll(() => answer).toBe("1,4");
        await dialog.getByRole("button", { name: "닫기", exact: true }).click();
        await expect(dialog).toHaveCount(0);
      }
      await page.locator(".student-scores-drawer").getByRole("button", { name: "학생 성적 상세 닫기 (Esc)", exact: true }).click();
      await page.getByRole("button", { name: "점수 입력 마침", exact: true }).click();
      await expect.poll(() => events.includes("release")).toBe(true);
      expect(events.indexOf("release")).toBeGreaterThan(events.indexOf("patch-ok"));
      expect(await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      })).toBe(false);
      await page.reload({ waitUntil: "domcontentloaded" });
      const readback = await openAnswer();
      await expect(readback.locator(".srd-read__choice-ans")).toHaveText(authSwitch ? "1,4,5" : "1,4");
      await expect(readback.locator(".srd-read__score-val")).toHaveText(authSwitch ? "0" : "100");
      expect(unexpectedMutations).toEqual([]);
    });
  }
});
