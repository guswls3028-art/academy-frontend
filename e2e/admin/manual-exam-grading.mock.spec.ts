import { expect, test, type Page } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const LECTURE_ID = 501;
const SESSION_ID = 701;
const EXAM_ID = 801;
const ENROLLMENT_ID = 901;
const QUESTION_IDS = [1001, 1002] as const;

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
  return `e30.${payload}.manual-grading`;
}

type GradeState = "correct" | "incorrect" | "review" | null;

async function installApi(page: Page) {
  let applied = false;
  const postedRows: unknown[] = [];

  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "manual-grading-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { token: fakeJwt() });

  const cells = (): Record<string, {
    editable: boolean;
    entry_method: "correctness";
    state: GradeState;
    score: number | null;
    include_in_wrong_note: boolean;
  }> => ({
    [String(QUESTION_IDS[0])]: {
      editable: true,
      entry_method: "correctness",
      state: applied ? "correct" : null,
      score: applied ? 40 : null,
      include_in_wrong_note: false,
    },
    [String(QUESTION_IDS[1])]: {
      editable: true,
      entry_method: "correctness",
      state: applied ? "review" : null,
      score: applied ? 60 : null,
      include_in_wrong_note: applied,
    },
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === "/core/program/") {
      await json({
        tenantCode: "hakwonplus",
        display_name: "Academy",
        is_active: true,
        ui_config: {},
        feature_flags: {},
      });
      return;
    }
    if (path === "/core/me/") {
      await json({
        id: 1,
        username: "manual-grading-admin",
        name: "채점 관리자",
        is_staff: true,
        is_superuser: false,
        tenantRole: "admin",
        must_change_password: false,
      });
      return;
    }
    if (path === `/lectures/lectures/${LECTURE_ID}/`) {
      await json({
        id: LECTURE_ID,
        title: "공통수학2 정규반",
        name: "공통수학2 정규반",
        subject: "MATH",
        color: "#2563eb",
        chip_label: "수2",
        is_active: true,
      });
      return;
    }
    if (path === "/lectures/lectures/") {
      await json({
        count: 1,
        results: [{
          id: LECTURE_ID,
          title: "공통수학2 정규반",
          name: "공통수학2 정규반",
          subject: "MATH",
          color: "#2563eb",
          chip_label: "수2",
          is_active: true,
        }],
      });
      return;
    }
    if (path === `/lectures/sessions/${SESSION_ID}/`) {
      await json({
        id: SESSION_ID,
        lecture: LECTURE_ID,
        order: 1,
        regular_order: 1,
        title: "1차시",
        display_label: "1차시",
        date: "2026-07-30",
        lecture_title: "공통수학2 정규반",
        lecture_color: "#2563eb",
        lecture_chip_label: "수2",
      });
      return;
    }
    if (path === "/lectures/sessions/") {
      await json({
        count: 1,
        results: [{
          id: SESSION_ID,
          lecture: LECTURE_ID,
          order: 1,
          regular_order: 1,
          title: "1차시",
          display_label: "1차시",
          date: "2026-07-30",
        }],
      });
      return;
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/exams/`) {
      await json([{
        exam_id: EXAM_ID,
        title: "7월 진단평가",
        open_at: null,
        close_at: null,
        allow_retake: false,
        max_attempts: 1,
        display_order: 0,
      }]);
      return;
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/exams/summary/`) {
      await json({
        session_id: SESSION_ID,
        exams: [{
          exam_id: EXAM_ID,
          max_score: 100,
          pass_score: 60,
          participant_count: applied ? 1 : 0,
        }],
      });
      return;
    }
    if (path === "/homework/policies/" || path === "/homeworks/") {
      await json({ count: 0, results: [] });
      return;
    }
    if (path === `/exams/${EXAM_ID}/`) {
      await json({
        id: EXAM_ID,
        title: "7월 진단평가",
        description: "답변형 정오 입력 검증",
        subject: "MATH",
        exam_type: "regular",
        is_active: true,
        allow_retake: false,
        max_attempts: 1,
        pass_score: 60,
        max_score: 100,
        grading_mode: "written",
        manual_grading_method: "correctness",
        choice_question_count: 0,
        segmentation_status: "ready",
        source_filename: "july.pdf",
        display_order: 0,
        open_at: null,
        close_at: null,
        template_exam_id: null,
        structure_owner_id: EXAM_ID,
        can_edit_structure: true,
        answer_visibility: "hidden",
        created_at: "2026-07-30T09:00:00+09:00",
        updated_at: "2026-07-30T09:00:00+09:00",
      });
      return;
    }
    if (
      path === `/exams/${EXAM_ID}/questions/` ||
      path === `/exams/${EXAM_ID}/explanations/`
    ) {
      await json([]);
      return;
    }
    if (path === "/exams/answer-keys/") {
      await json([]);
      return;
    }
    if (path === `/results/admin/exams/${EXAM_ID}/manual-grading/`) {
      if (method === "GET") {
        await json({
          exam_id: EXAM_ID,
          exam_title: "7월 진단평가",
          grading_mode: "written",
          manual_grading_method: "correctness",
          has_manual_questions: true,
          questions: [
            {
              question_id: QUESTION_IDS[0],
              number: 1,
              kind: "essay",
              max_score: 40,
              editable: true,
              entry_method: "correctness",
            },
            {
              question_id: QUESTION_IDS[1],
              number: 2,
              kind: "essay",
              max_score: 60,
              editable: true,
              entry_method: "correctness",
            },
          ],
          rows: [{
            enrollment_id: ENROLLMENT_ID,
            student_name: "김학생",
            school: "테스트고",
            lectures: [{
              id: LECTURE_ID,
              lecture_name: "공통수학2 정규반",
              color: "#2563eb",
              chip_label: "수2",
            }],
            expected_version: applied ? "2026-07-30T10:00:00+09:00" : null,
            is_not_submitted: false,
            exam_not_submitted_count: 0,
            cells: cells(),
          }],
        });
        return;
      }

      const body = request.postDataJSON() as {
        apply?: boolean;
        rows?: Array<{ cells?: Record<string, { state?: string }> }>;
      };
      postedRows.push(body);
      if (body.apply === true) applied = true;
      await json({
        ok: true,
        applied: body.apply === true,
        exam_id: EXAM_ID,
        exam_title: "7월 진단평가",
        grading_mode: "written",
        manual_grading_method: "correctness",
        matched_count: 1,
        question_count: 2,
        overwrite_count: 0,
        not_submitted_count: 0,
        errors: [],
        rows: [{
          enrollment_id: ENROLLMENT_ID,
          student_name: "김학생",
          correct_count: 2,
          wrong_count: 0,
          wrong_questions: [],
          review_count: 1,
          review_questions: [2],
          total_score: 100,
          max_score: 100,
          will_overwrite: false,
          is_not_submitted: false,
        }],
      });
      return;
    }
    if (path === `/results/admin/exams/${EXAM_ID}/summary/`) {
      await json({
        avg_score: applied ? 100 : 0,
        max_score: applied ? 100 : 0,
        participant_count: applied ? 1 : 0,
        pass_count: applied ? 1 : 0,
        fail_count: 0,
      });
      return;
    }
    if (
      path === `/results/admin/exams/${EXAM_ID}/results/` ||
      path === `/results/admin/exams/${EXAM_ID}/questions/`
    ) {
      await json([]);
      return;
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/scores/`) {
      await json({ meta: { exams: [], homeworks: [] }, rows: [] });
      return;
    }

    await json({ count: 0, results: [] });
  });

  return {
    get applied() {
      return applied;
    },
    postedRows,
  };
}

test.describe("문항별 직접 채점", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 1100, height: 900 },
    serviceWorkers: "block",
  });

  test("O·X·0 키 입력을 미리 확인한 뒤 확정하고 재조회한다", async ({ page }) => {
    const apiState = await installApi(page);

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${EXAM_ID}`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(page.getByRole("heading", { name: "7월 진단평가", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
    await expect(page.getByRole("heading", { name: "문항별 직접 채점", exact: true })).toBeVisible();

    const studentRow = page.getByRole("row").filter({ hasText: "김학생" });
    const cells = studentRow.getByRole("button", { name: "미입력" });
    await expect(cells).toHaveCount(2);
    await cells.nth(0).press("o");
    await studentRow.getByRole("button", { name: "미입력" }).press("0");
    await expect(studentRow.getByRole("button", { name: "O" })).toHaveCount(1);
    await expect(studentRow.getByRole("button", { name: "0" })).toHaveCount(1);

    await page.getByRole("button", { name: "입력 내용 확인", exact: true }).click();
    await expect(page.getByText("1명 · 결시 0명 · 성적 계산 완료", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "1명 성적 확정", exact: true }).click();

    await expect.poll(() => apiState.applied).toBe(true);
    await expect.poll(() => apiState.postedRows.length).toBe(2);
    expect(apiState.postedRows).toEqual([
      expect.objectContaining({
        apply: false,
        rows: [expect.objectContaining({
          enrollment_id: ENROLLMENT_ID,
          attendance: "present",
          cells: {
            [String(QUESTION_IDS[0])]: { state: "correct" },
            [String(QUESTION_IDS[1])]: { state: "review" },
          },
        })],
      }),
      expect.objectContaining({
        apply: true,
        rows: [expect.objectContaining({
          enrollment_id: ENROLLMENT_ID,
          attendance: "present",
        })],
      }),
    ]);

    await expect(studentRow.getByRole("button", { name: "O" })).toHaveCount(1);
    await expect(studentRow.getByRole("button", { name: "0" })).toHaveCount(1);
    await expect(page.getByText("확정 전 변경사항", { exact: true })).toHaveCount(0);
  });
});
