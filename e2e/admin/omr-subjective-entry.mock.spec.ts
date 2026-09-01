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

async function installRoutes(page: Page) {
  const unexpectedMutations: string[] = [];

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
              score: null,
              max_score: 100,
              passed: null,
              clinic_required: false,
              is_locked: false,
              objective_score: null,
              subjective_score: null,
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
        rows: [{
          enrollment_id: 9911,
          student_name: "테스트 학생",
          school: "중대부고",
          lectures: [{
            id: LECTURE_ID,
            lecture_name: "중대부고 통합과학",
            color: "#2563eb",
            chip_label: "중",
          }],
          expected_version: null,
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
              state: null,
              score: null,
              include_in_wrong_note: false,
            },
          },
        }],
      });
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

async function openScores(page: Page) {
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
  const unexpectedMutations = await installRoutes(page);
  await page.goto(
    `${baseUrl}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );
  await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_ID}/scores`));
  const omrButton = page.getByRole("button", { name: "OMR 스캔 등록" });
  await expect(omrButton).toBeVisible({ timeout: 30_000 });
  await expect(omrButton).toBeEnabled();
  return unexpectedMutations;
}

test.describe("OMR와 서술형 점수 입력 진입", () => {
  test.setTimeout(90_000);

  test("시험 계약으로 가능한 작업만 자동 노출하고 혼합형은 한 화면에서 이어진다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const unexpectedMutations = await openScores(page);

    const omrButton = page.getByRole("button", { name: "OMR 스캔 등록" });
    const subjectiveButton = page.getByRole("button", { name: "서술형 점수 입력" });
    await expect(subjectiveButton).toBeVisible();

    await omrButton.click();
    const omrPicker = page.getByRole("listbox", { name: "OMR 시험 선택" });
    await expect(omrPicker.getByText("OMR 등록할 시험 선택", { exact: true })).toBeVisible();
    await expect(omrPicker.getByRole("option", { name: /객관식/ })).toBeVisible();
    await expect(omrPicker.getByRole("option", { name: /혼합형/ })).toBeVisible();
    await expect(omrPicker.getByRole("option", { name: /서술형/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await subjectiveButton.click();
    const subjectivePicker = page.getByRole("listbox", { name: "직접 채점 시험 선택" });
    await expect(subjectivePicker.getByText("직접 채점할 시험 선택", { exact: true })).toBeVisible();
    await expect(subjectivePicker.getByRole("option", { name: /서술형/ })).toBeVisible();
    await expect(subjectivePicker.getByRole("option", { name: /혼합형/ })).toBeVisible();
    await expect(subjectivePicker.getByRole("option", { name: /객관식/ })).toHaveCount(0);
    await subjectivePicker.getByRole("option", { name: /혼합형/ }).click();

    const gradingDialog = page.getByRole("dialog").filter({ hasText: "중대부고 2회차 혼합형 혼합 채점" });
    await expect(gradingDialog).toBeVisible();
    await expect(gradingDialog.getByText("직접 문항 입력 중", { exact: true })).toBeVisible();
    await expect(gradingDialog.getByRole("button", { name: "OMR 답안 등록" })).toBeVisible();
    await expect(gradingDialog.getByRole("button", { name: "OMR 결과 보정" })).toBeVisible();
    await gradingDialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(gradingDialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_ID}/scores`));
    await expect(subjectiveButton).toBeVisible();
    expect(unexpectedMutations).toEqual([]);
  });

  test("390px에서도 두 작업 진입점과 시험 선택이 넘치지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const unexpectedMutations = await openScores(page);

    for (const button of [
      page.getByRole("button", { name: "OMR 스캔 등록" }),
      page.getByRole("button", { name: "서술형 점수 입력" }),
    ]) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    }

    await page.getByRole("button", { name: "서술형 점수 입력" }).click();
    const picker = page.getByRole("listbox", { name: "직접 채점 시험 선택" });
    await expect(picker).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))).toEqual({ body: 0, document: 0 });
    expect(unexpectedMutations).toEqual([]);
  });
});
