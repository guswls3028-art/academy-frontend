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

async function chooseExamHeaderAction(
  page: Page,
  action: "정오표 작성" | "OMR 검토" | "시험 설정",
) {
  const trigger = page.getByRole("button", {
    name: "7월 진단평가 작업 선택",
  });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const menu = page.getByRole("menu", {
    name: "7월 진단평가 작업 선택",
  });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: new RegExp(`^${action}`) }).click();
}

function contrastRatio(foreground: string, background: string): number {
  const channels = (value: string): number[] => {
    const match = value.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (match == null) throw new Error(`Unsupported computed color: ${value}`);
    return match.slice(1, 4).map(Number);
  };
  const luminance = (value: string): number => {
    const linear = channels(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

type InstallApiOptions = {
  gradingMode?: "choice" | "written" | "mixed";
  manualGradingMethod?: "correctness" | "score";
  editable?: boolean;
  hasQuestions?: boolean;
  initialStates?: [GradeState, GradeState];
  segmentationStatus?: "none" | "review_required" | "ready";
  segmentationEngine?: string;
  segmentationCropAdjustable?: boolean;
  sheetSize?: {
    students: number;
    questions: number;
  };
};

async function installApi(page: Page, options: InstallApiOptions = {}) {
  let applied = false;
  let hasQuestions = options.hasQuestions ?? true;
  let manualSheetGetCount = 0;
  const postedRows: unknown[] = [];
  const examPatches: unknown[] = [];
  let gradingMode = options.gradingMode ?? "written";
  let manualGradingMethod =
    options.manualGradingMethod ?? "correctness";
  const editable = options.editable ?? true;
  const initialStates = options.initialStates ?? [null, null];
  const segmentationStatus = options.segmentationStatus ?? "ready";
  const questionEditable = () => [
    editable && gradingMode === "written",
    editable && gradingMode !== "choice",
  ] as const;

  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "manual-grading-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { token: fakeJwt() });

  const cells = (): Record<string, {
    editable: boolean;
    entry_method: "correctness" | "score" | "omr";
    state: GradeState;
    score: number | null;
    include_in_wrong_note: boolean;
  }> => ({
    [String(QUESTION_IDS[0])]: {
      editable: questionEditable()[0],
      entry_method: questionEditable()[0] ? manualGradingMethod : "omr",
      state: applied ? "correct" : initialStates[0],
      score: applied ? 40 : manualGradingMethod === "score" ? 10 : initialStates[0] === "correct" ? 40 : 0,
      include_in_wrong_note: false,
    },
    [String(QUESTION_IDS[1])]: {
      editable: questionEditable()[1],
      entry_method: questionEditable()[1] ? manualGradingMethod : "omr",
      state: applied ? "review" : initialStates[1],
      score: applied ? 60 : manualGradingMethod === "score" ? 20 : initialStates[1] === "correct" ? 60 : 0,
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
      if (method === "PATCH") {
        const body = request.postDataJSON() as {
          grading_mode?: "choice" | "written" | "mixed";
          manual_grading_method?: "correctness" | "score";
        };
        examPatches.push(body);
        gradingMode = body.grading_mode ?? gradingMode;
        manualGradingMethod =
          body.manual_grading_method ?? manualGradingMethod;
      }
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
        grading_mode: gradingMode,
        manual_grading_method: manualGradingMethod,
        choice_question_count: 0,
        segmentation_status: segmentationStatus,
        source_filename: segmentationStatus === "ready" ? "july.pdf" : "",
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
    if (path === `/exams/${EXAM_ID}/questions/init/` && method === "POST") {
      hasQuestions = true;
      await json(QUESTION_IDS.map((id, index) => ({
        id,
        sheet: 1,
        number: index + 1,
        question_kind: "choice",
        score: index === 0 ? 40 : 60,
      })));
      return;
    }
    if (path === `/exams/${EXAM_ID}/segmentation-review/`) {
      const previewSvg = encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="white"/><text x="60" y="100" font-size="48">3. Ymath 문제</text><path d="M60 180H740M60 300H740M60 420H740" stroke="black" stroke-width="8"/><text x="60" y="650" font-size="44" fill="#dc2626">선생님 원본 해설</text></svg>',
      );
      await json({
        exam_id: EXAM_ID,
        status: "review_required",
        source_filename: "ymath-teacher.hwp",
        items: [{
          id: 3001,
          position: 1,
          number: 3,
          detected_number: 3,
          page_index: 2,
          included: true,
          engine: options.segmentationEngine ?? "hwp_endnote",
          problem_crop_ratio: options.segmentationCropAdjustable === false ? 1 : 0.3,
          crop_adjustable: options.segmentationCropAdjustable ?? true,
          problem_image_url: `data:image/svg+xml,${previewSvg}`,
          explanation_text: "",
          explanation_image_url: `data:image/svg+xml,${previewSvg}`,
          has_teacher_explanation: true,
        }],
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
        manualSheetGetCount += 1;
        await json({
          exam_id: EXAM_ID,
          exam_title: "7월 진단평가",
          grading_mode: gradingMode,
          manual_grading_method: manualGradingMethod,
          has_manual_questions:
            hasQuestions && questionEditable().some(Boolean),
          exam_max_score: 100,
          question_score_total: hasQuestions ? 100 : 0,
          score_adjustment_total: 0,
          questions: !hasQuestions ? [] : options.sheetSize
            ? Array.from({ length: options.sheetSize.questions }, (_, index) => ({
                question_id: QUESTION_IDS[0] + index,
                number: index + 1,
                kind: "essay",
                answer_type: "written",
                max_score: 100 / options.sheetSize!.questions,
                editable: editable && gradingMode !== "choice",
                entry_method:
                  editable && gradingMode !== "choice"
                    ? manualGradingMethod
                    : "omr",
              }))
            : [
            {
              question_id: QUESTION_IDS[0],
              number: 1,
              kind: gradingMode === "written" ? "essay" : "choice",
              answer_type: gradingMode === "written" ? "written" : "choice",
              max_score: 40,
              editable: questionEditable()[0],
              entry_method: questionEditable()[0]
                ? manualGradingMethod
                : "omr",
            },
            {
              question_id: QUESTION_IDS[1],
              number: 2,
              kind: "essay",
              answer_type:
                gradingMode === "choice"
                  ? "numeric_short_answer"
                  : "written",
              max_score: 60,
              editable: questionEditable()[1],
              entry_method: questionEditable()[1]
                ? manualGradingMethod
                : "omr",
            },
          ],
          rows: options.sheetSize
            ? Array.from({ length: options.sheetSize.students }, (_, studentIndex) => ({
                enrollment_id: ENROLLMENT_ID + studentIndex,
                student_name:
                  studentIndex === 0
                    ? "김학생"
                    : `테스트학생 ${String(studentIndex + 1).padStart(2, "0")}`,
                school: "테스트고",
                lectures: [{
                  id: LECTURE_ID,
                  lecture_name: "공통수학2 정규반",
                  color: "#2563eb",
                  chip_label: "수2",
                }],
                expected_version: null,
                is_not_submitted: false,
                exam_not_submitted_count: 0,
                cells: Object.fromEntries(
                  Array.from({ length: options.sheetSize!.questions }, (_, questionIndex) => {
                    const questionId = QUESTION_IDS[0] + questionIndex;
                    return [
                      String(questionId),
                      {
                        editable: editable && gradingMode !== "choice",
                        entry_method:
                          editable && gradingMode !== "choice"
                            ? manualGradingMethod
                            : "omr",
                        state: null,
                        score: null,
                        include_in_wrong_note: false,
                      },
                    ];
                  }),
                ),
              }))
            : [{
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
        grading_mode: gradingMode,
        manual_grading_method: manualGradingMethod,
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
      await json({
        meta: {
          session_title: "1차시",
          lecture_title: "공통수학2 정규반",
          lecture_id: LECTURE_ID,
          exams: [{
            exam_id: EXAM_ID,
            title: "7월 진단평가",
            pass_score: 60,
            max_score: 100,
            grading_mode: gradingMode,
            manual_grading_method: manualGradingMethod,
            choice_count: gradingMode === "written" ? 0 : 2,
            essay_count: gradingMode === "choice" ? 0 : 2,
            display_order: 0,
          }],
          homeworks: [],
        },
        rows: [{
          enrollment_id: ENROLLMENT_ID,
          student_id: 100,
          student_name: "김학생",
          lecture_title: "공통수학2 정규반",
          lecture_color: "#2563eb",
          lecture_chip_label: "수2",
          exams: [{
            exam_id: EXAM_ID,
            title: "7월 진단평가",
            pass_score: 60,
            block: {
              score: applied ? 100 : null,
              max_score: 100,
              passed: applied ? true : null,
              clinic_required: false,
            },
          }],
          homeworks: [],
          updated_at: "2026-07-30T10:00:00+09:00",
        }],
      });
      return;
    }

    await json({ count: 0, results: [] });
  });

  return {
    get applied() {
      return applied;
    },
    get manualSheetGetCount() {
      return manualSheetGetCount;
    },
    examPatches,
    postedRows,
  };
}

test.describe("문항별 직접 채점", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 1100, height: 900 },
    serviceWorkers: "block",
  });

  test("학생용 문제지와 교사 HWP를 분리해 받고 잘못된 HWP 짝을 막는다", async ({ page }) => {
    await installApi(page, { segmentationStatus: "none" });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${EXAM_ID}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.getByRole("heading", { name: "7월 진단평가", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "시험지 업로드", exact: true }).click();

    const dialog = page.getByRole("dialog").filter({ hasText: "시험 자료 올리기" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("문제+해설 한 파일", { exact: true })).toBeVisible();
    await expect(dialog.getByText("문제 파일만", { exact: true })).toBeVisible();
    await expect(dialog.getByText("문제·해설 두 파일", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "문제지와 해설지가 따로 있어요" }).click();
    await expect(dialog.getByText("문제 파일", { exact: true })).toBeVisible();
    await expect(dialog.getByText("선생님 해설 파일", { exact: true })).toBeVisible();

    const fileInputs = dialog.locator('input[type="file"]');
    await expect(fileInputs).toHaveCount(2);
    await fileInputs.nth(0).setInputFiles({
      name: "teacher-marked-problems.hwp",
      mimeType: "application/x-hwp",
      buffer: Buffer.from("HWP problem fixture"),
    });
    await fileInputs.nth(1).setInputFiles({
      name: "teacher-explanations.hwp",
      mimeType: "application/x-hwp",
      buffer: Buffer.from("HWP explanation fixture"),
    });

    await expect(dialog.getByText(/해설 파일을 따로 올릴 때/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "업로드 및 문항 분석" })).toBeDisabled();
  });

  test("단일 HWP 문항은 문제 영역을 원본 해설 위에서 직접 조절한다", async ({ page }) => {
    await installApi(page, { segmentationStatus: "review_required" });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${EXAM_ID}`,
      { waitUntil: "domcontentloaded" },
    );
    const slider = page.getByRole("slider", { name: "3번 문제 영역 높이" });
    await expect(slider).toBeVisible();
    await expect(slider).toHaveValue("30");
    await slider.fill("42");
    await expect(slider).toHaveValue("42");
    await expect(page.getByText("42%", { exact: true })).toBeVisible();
    await expect(page.getByLabel("3번 문제 영역 미리보기")).toBeVisible();
  });

  test("한글 본문 문제와 미주 해설을 구조로 분리한 후보를 표시한다", async ({ page }) => {
    await installApi(page, {
      segmentationStatus: "review_required",
      segmentationEngine: "hwp_body_endnote",
      segmentationCropAdjustable: false,
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${EXAM_ID}`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(page.getByText("한글 본문·미주 분리", { exact: true })).toBeVisible();
    await expect(page.getByRole("slider", { name: "3번 문제 영역 높이" })).toHaveCount(0);
    await expect(page.getByAltText("3번 문제 후보")).toBeVisible();
    await expect(page.getByAltText("3번 선생님 원본 해설")).toBeVisible();
  });

  test("O·X·오답노트 키 입력을 미리 확인한 뒤 확정하고 재조회한다", async ({ page }) => {
    const apiState = await installApi(page);

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${EXAM_ID}`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(page.getByRole("heading", { name: "7월 진단평가", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
    await expect(page.getByRole("heading", { name: "정오 직접입력", exact: true })).toBeVisible();

    const excelImport = page.locator('section[aria-labelledby="exam-result-excel-title"]');
    await expect(excelImport).toContainText("기존 엑셀 양식의 숫자 0도 오답노트로 읽습니다.");
    await expect(excelImport).not.toContainText("Ymath");

    await page.getByRole("spinbutton", { name: "1번 배점", exact: true }).fill("30");
    await page.getByRole("spinbutton", { name: "2번 배점", exact: true }).fill("70");
    await expect(page.getByText("배점 합계 100점 / 시험 만점 100점", { exact: true })).toBeVisible();

    const studentRow = page.getByRole("row").filter({ hasText: "김학생" });
    const cells = studentRow.getByRole("button", { name: "미입력" });
    await expect(cells).toHaveCount(2);
    await page.getByRole("button", { name: "전원 결시로 설정", exact: true }).click();
    await expect(studentRow.getByRole("button", { name: "결시", exact: true })).toBeVisible();
    await page.keyboard.press("Control+z");
    await expect(studentRow.getByRole("button", { name: "응시", exact: true })).toBeVisible();
    await cells.nth(0).evaluate((element) => {
      const clipboard = new DataTransfer();
      clipboard.setData("text/plain", "\t.");
      element.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }));
    });
    await expect(studentRow.getByRole("button", { name: "O" })).toHaveCount(1);
    await expect(studentRow.getByRole("button", { name: "X" })).toHaveCount(1);
    await page.keyboard.press("Control+z");
    await expect(studentRow.getByRole("button", { name: "미입력" })).toHaveCount(2);
    await page.keyboard.press("Control+y");
    await expect(studentRow.getByRole("button", { name: "X" })).toHaveCount(1);
    await page.keyboard.press("Control+z");
    await expect(studentRow.getByRole("button", { name: "미입력" })).toHaveCount(2);

    await page.getByRole("button", { name: "빈칸 2칸 O로", exact: true }).click();
    await expect(studentRow.getByRole("button", { name: "O" })).toHaveCount(2);
    await page.keyboard.press("Control+z");
    await expect(studentRow.getByRole("button", { name: "미입력" })).toHaveCount(2);

    await cells.nth(0).press("o");
    await studentRow.getByRole("button", { name: "미입력" }).press("0");
    await expect(studentRow.getByRole("button", { name: "O" })).toHaveCount(1);
    await expect(studentRow.getByRole("button", { name: "오답노트" })).toHaveCount(1);

    await page.getByRole("button", { name: "입력 내용 확인", exact: true }).click();
    await expect(page.getByText("1명 · 결시 0명 · 성적 계산 완료", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "1명 성적 확정", exact: true }).click();

    await expect.poll(() => apiState.applied).toBe(true);
    await expect.poll(() => apiState.postedRows.length).toBe(2);
    expect(apiState.postedRows).toEqual([
      expect.objectContaining({
        apply: false,
        question_scores: {
          [String(QUESTION_IDS[0])]: 30,
          [String(QUESTION_IDS[1])]: 70,
        },
        expected_question_scores: {
          [String(QUESTION_IDS[0])]: 40,
          [String(QUESTION_IDS[1])]: 60,
        },
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
        question_scores: {
          [String(QUESTION_IDS[0])]: 30,
          [String(QUESTION_IDS[1])]: 70,
        },
        rows: [expect.objectContaining({
          enrollment_id: ENROLLMENT_ID,
          attendance: "present",
        })],
      }),
    ]);

    await expect(studentRow.getByRole("button", { name: "O" })).toHaveCount(1);
    await expect(studentRow.getByRole("button", { name: "오답노트" })).toHaveCount(1);
    await expect(page.getByText("확정 전 변경사항", { exact: true })).toHaveCount(0);
  });

  test.describe("운영체제·브라우저 단축키", { tag: "@manual-grading-shortcuts" }, () => {
    for (const shortcut of [
      { platform: "Win32", modifier: "Control", label: "Ctrl" },
      { platform: "MacIntel", modifier: "Meta", label: "⌘" },
    ] as const) {
      test(`${shortcut.label} 단축키로 실행 취소·다시 실행·확정을 처리한다`, async ({ page }) => {
        await page.addInitScript(({ platform }) => {
          Object.defineProperty(navigator, "platform", {
            configurable: true,
            get: () => platform,
          });
        }, { platform: shortcut.platform });
        const apiState = await installApi(page);

        await page.goto(
          `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${EXAM_ID}`,
          { waitUntil: "domcontentloaded" },
        );
        await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
        await expect(page.getByRole("heading", { name: "정오 직접입력", exact: true })).toBeVisible();

        const hints = page.getByLabel("정오표 입력 도움말");
        await expect(hints.getByText(`${shortcut.label}+V 엑셀 붙여넣기`, { exact: true })).toBeVisible();
        await expect(hints.getByText(`${shortcut.label}+Z 실행 취소`, { exact: true })).toBeVisible();
        await expect(hints.getByText(`${shortcut.label}+S 확인·확정`, { exact: true })).toBeVisible();

        const studentRow = page.getByRole("row").filter({ hasText: "김학생" });
        const firstCell = studentRow.locator('[data-row-index="0"][data-column-index="0"]');
        await firstCell.press("o");
        await page.keyboard.press(`${shortcut.modifier}+z`);
        await expect(firstCell).toHaveAccessibleName("김학생 1번 미입력");
        await page.keyboard.press(`${shortcut.modifier}+Shift+z`);
        await expect(firstCell).toHaveAccessibleName("김학생 1번 O");

        await page.evaluate(() => {
          window.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
              document.documentElement.dataset.saveShortcutPrevented = String(event.defaultPrevented);
            }
          });
        });
        await page.keyboard.press(`${shortcut.modifier}+s`);
        await expect(page.getByText("1명 · 결시 0명 · 성적 계산 완료", { exact: true })).toBeVisible();
        await expect.poll(() => page.locator("html").getAttribute("data-save-shortcut-prevented")).toBe("true");

        await page.keyboard.press(`${shortcut.modifier}+s`);
        await expect.poll(() => apiState.applied).toBe(true);
        await expect.poll(() => apiState.postedRows.length).toBe(2);
      });
    }
  });

  test("한글 입력 상태에서도 영문 물리키로 O·X·오답노트를 연속 입력한다", async ({ page }) => {
    await installApi(page);

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "정오표 작성");

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 정오 직접입력",
    });
    const cells = dialog.locator("[data-manual-grade-cell]");
    await expect(cells).toHaveCount(2);
    const cdp = await page.context().newCDPSession(page);
    const pressPhysicalKey = async (
      key: string,
      code: string,
      virtualKeyCode: number,
    ) => {
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code,
        windowsVirtualKeyCode: virtualKeyCode,
        nativeVirtualKeyCode: virtualKeyCode,
      });
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code,
        windowsVirtualKeyCode: virtualKeyCode,
        nativeVirtualKeyCode: virtualKeyCode,
      });
    };

    await cells.nth(0).focus();
    await pressPhysicalKey("ㅐ", "KeyO", 79);
    await expect(cells.nth(0)).toHaveAccessibleName("김학생 1번 O");
    await expect(cells.nth(1)).toBeFocused();

    await pressPhysicalKey("ㅌ", "KeyX", 88);
    await expect(cells.nth(1)).toHaveAccessibleName("김학생 2번 X");

    await cells.nth(0).focus();
    await pressPhysicalKey("0", "Digit0", 48);
    await expect(cells.nth(0)).toHaveAccessibleName("김학생 1번 오답노트");
    await expect(cells.nth(1)).toBeFocused();

    await dialog.getByRole("button", { name: "단축키 설정" }).click();
    const correctShortcut = dialog.getByRole("textbox", { name: "정답 단축키" });
    const incorrectShortcut = dialog.getByRole("textbox", { name: "오답 단축키" });
    const reviewShortcut = dialog.getByRole("textbox", { name: "오답노트 단축키" });
    await correctShortcut.press("a");
    await incorrectShortcut.press("s");
    await reviewShortcut.press("d");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(dialog.getByText("A 키", { exact: true })).toBeVisible();
    await expect(dialog.getByText("S 키", { exact: true })).toBeVisible();
    await expect(dialog.getByText("D 키", { exact: true })).toBeVisible();

    await cells.nth(0).focus();
    await pressPhysicalKey("ㅁ", "KeyA", 65);
    await expect(cells.nth(1)).toBeFocused();
    await pressPhysicalKey("ㅇ", "KeyD", 68);
    await expect(cells.nth(0)).toHaveAccessibleName("김학생 1번 O");
    await expect(cells.nth(1)).toHaveAccessibleName("김학생 2번 오답노트");
  });

  test("선택형 시험명은 직접 채점표 대신 OMR 검토를 연다", async ({ page }) => {
    await installApi(page, {
      gradingMode: "choice",
      editable: false,
      initialStates: ["correct", "incorrect"],
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "OMR 검토");

    const omrDialog = page.getByRole("dialog", { name: "OMR 검토" });
    await expect(omrDialog).toBeVisible();
    await expect(omrDialog.getByText("7월 진단평가", { exact: true })).toBeVisible();
    await expect(omrDialog.getByRole("button", { name: "OMR 답안 등록" })).toBeVisible();
    await expect(omrDialog.getByText("등록된 OMR 답안이 없습니다.", { exact: true })).toBeVisible();

    await omrDialog.getByRole("button", { name: "OMR 답안 등록" }).click();
    const uploadDialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
    await expect(uploadDialog).toBeVisible();
    await expect(uploadDialog.getByText("7월 진단평가", { exact: true })).toBeVisible();
    await expect(uploadDialog.getByText("스캔 파일 선택", { exact: true })).toBeVisible();
    await uploadDialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(omrDialog).toBeVisible();
    await expect(page.getByRole("heading", { name: "OMR 자동채점 결과" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "입력 내용 확인", exact: true })).toHaveCount(0);
  });

  test("시험명 메뉴에서 시험 설정을 열고 현재 값을 확인한다", async ({ page }) => {
    await installApi(page);

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "시험 설정");

    const settingsDialog = page.getByRole("dialog").filter({
      hasText: "시험 설정",
    });
    await expect(settingsDialog).toBeVisible();
    await expect(settingsDialog.getByRole("textbox", { name: "시험명" })).toHaveValue("7월 진단평가");
    await expect(settingsDialog.getByRole("spinbutton", { name: /^만점/ })).toHaveValue("100");
    await expect(settingsDialog.getByRole("spinbutton", { name: /^커트라인/ })).toHaveValue("60");
    await expect(
      settingsDialog.getByRole("radio", {
        name: /정오표 직접입력 \(O\/X\/오답노트\)/,
      }),
    ).toBeChecked();
    await settingsDialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(settingsDialog).toHaveCount(0);
  });

  test("시험 설정에서 OMR 시험을 정오표 직접입력으로 전환한다", async ({ page }) => {
    const apiState = await installApi(page, {
      gradingMode: "choice",
      manualGradingMethod: "score",
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );

    const examTrigger = page.getByRole("button", {
      name: "7월 진단평가 작업 선택",
    });
    await examTrigger.click();
    const actionMenu = page.getByRole("menu", {
      name: "7월 진단평가 작업 선택",
    });
    await expect(
      actionMenu.getByRole("menuitem", { name: /^정오표 작성/ }),
    ).toBeDisabled();
    await actionMenu.getByRole("menuitem", { name: /^시험 설정/ }).click();

    const settingsDialog = page.getByRole("dialog").filter({
      hasText: "시험 설정",
    });
    await settingsDialog.getByRole("radio", {
      name: /정오표 직접입력 \(O\/X\/오답노트\)/,
    }).check();
    await expect(settingsDialog.getByRole("status")).toContainText(
      "기존 문항과 입력된 성적은 삭제되지 않습니다.",
    );
    await settingsDialog.getByRole("button", {
      name: "저장",
      exact: true,
    }).click();
    await expect(settingsDialog).toHaveCount(0);
    await expect.poll(() => apiState.examPatches).toEqual([
      expect.objectContaining({
        grading_mode: "written",
        manual_grading_method: "correctness",
      }),
    ]);

    await examTrigger.click();
    const refreshedMenu = page.getByRole("menu", {
      name: "7월 진단평가 작업 선택",
    });
    const manualAction = refreshedMenu.getByRole("menuitem", {
      name: /^정오표 작성/,
    });
    await expect(manualAction).toBeEnabled();
    await manualAction.click();
    await expect(
      page.getByRole("dialog").filter({
        hasText: "7월 진단평가 정오 직접입력",
      }),
    ).toBeVisible();
  });

  test("46명 20문항 표를 10%까지 조망하고 한 스크롤 영역에서 배율을 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await installApi(page, {
      sheetSize: {
        students: 46,
        questions: 20,
      },
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "정오표 작성");

    let dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 정오 직접입력",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("학생 46명", { exact: true })).toBeVisible();
    await expect(dialog.getByText("문항 20개", { exact: true })).toBeVisible();
    await expect(dialog.getByText("오답노트", { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText("정답 · 복습", { exact: true })).toHaveCount(0);

    const scaleSelect = dialog.getByLabel("채점표 배율 선택");
    const initialScale = Number(await scaleSelect.inputValue());
    expect(initialScale).toBeGreaterThanOrEqual(50);
    expect(initialScale).toBeLessThanOrEqual(70);
    const layout = await dialog.evaluate((element) => {
      const body = element.querySelector<HTMLElement>(".scores-manual-grading-modal__body");
      const workspace = element.querySelector<HTMLElement>("[data-manual-grading-workspace]");
      const tableWrap = element.querySelector<HTMLElement>("[data-manual-grading-table-wrap]");
      const table = tableWrap?.querySelector<HTMLTableElement>("table");
      const footer = workspace?.querySelector<HTMLElement>("footer");
      if (!body || !workspace || !tableWrap || !table || !footer) return null;
      const bodyRect = body.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const tableWrapRect = tableWrap.getBoundingClientRect();
      return {
        bodyOverflowY: getComputedStyle(body).overflowY,
        footerBottomDelta: footerRect.bottom - bodyRect.bottom,
        tableHeight: tableWrap.clientHeight,
        tableVerticalOverflow: tableWrap.scrollHeight - tableWrap.clientHeight,
        tableVisualHorizontalOverflow: tableRect.width - tableWrapRect.width,
        tableZoom: getComputedStyle(table).zoom,
      };
    });
    expect(layout).not.toBeNull();
    expect(layout?.bodyOverflowY).toBe("hidden");
    expect(layout?.footerBottomDelta).toBeLessThanOrEqual(1);
    expect(layout?.tableHeight).toBeGreaterThanOrEqual(175);
    expect(layout?.tableVerticalOverflow).toBeGreaterThan(0);
    expect(layout?.tableVisualHorizontalOverflow).toBeLessThanOrEqual(20);
    expect(layout?.tableZoom).toBe(String(initialScale / 100));

    await dialog.getByRole("button", { name: "채점표 확대" }).click();
    const enlargedScale = initialScale + 10;
    await expect(scaleSelect).toHaveValue(String(enlargedScale));
    await expect.poll(() => page.evaluate(() =>
      localStorage.getItem("academy.manual-grading-table-scale.v1"),
    )).toBe(String(enlargedScale));

    await scaleSelect.selectOption("10");
    await expect(scaleSelect).toHaveValue("10");
    await expect(dialog.getByText("전체 조망 중", { exact: false })).toBeVisible();
    await expect(dialog.locator("[data-manual-grade-cell]").first()).toBeDisabled();
    await expect.poll(() => page.evaluate(() =>
      localStorage.getItem("academy.manual-grading-table-scale.v1"),
    )).toBe("10");
    const overviewLayout = await dialog.evaluate((element) => {
      const tableWrap = element.querySelector<HTMLElement>("[data-manual-grading-table-wrap]");
      const table = tableWrap?.querySelector<HTMLTableElement>("table");
      if (!tableWrap || !table) return null;
      return {
        horizontalOverflow: tableWrap.scrollWidth - tableWrap.clientWidth,
        verticalOverflow: tableWrap.scrollHeight - tableWrap.clientHeight,
        tableZoom: getComputedStyle(table).zoom,
      };
    });
    expect(overviewLayout).not.toBeNull();
    expect(overviewLayout?.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(overviewLayout?.verticalOverflow).toBeLessThan(layout?.tableVerticalOverflow ?? 0);
    expect(overviewLayout?.tableZoom).toBe("0.1");

    await dialog.getByRole("button", { name: "화면 맞춤" }).click();
    await expect(scaleSelect).toHaveValue(String(initialScale));
    await expect(dialog.getByText("전체 조망 중", { exact: false })).toHaveCount(0);
    await expect(dialog.locator("[data-manual-grade-cell]").first()).toBeEnabled();

    await dialog.getByRole("button", { name: "전체 조망" }).click();
    await expect(dialog.getByText("전체 조망 중", { exact: false })).toBeVisible();

    await scaleSelect.selectOption("50");
    await expect(dialog.getByText("전체 조망 중", { exact: false })).toHaveCount(0);
    await expect(dialog.locator("[data-manual-grade-cell]").first()).toBeEnabled();

    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await chooseExamHeaderAction(page, "정오표 작성");
    dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 정오 직접입력",
    });
    await expect(dialog.getByLabel("채점표 배율 선택")).toHaveValue("50");

    const cells = dialog.locator("[data-manual-grade-cell]");
    await cells.nth(0).click();
    for (let index = 0; index < 20; index += 1) {
      await page.keyboard.press("o");
    }
    await expect(cells.nth(19)).toHaveAccessibleName("김학생 20번 O");
    await expect(cells.nth(20)).toBeFocused();

    await cells.first().evaluate((element) => {
      const clipboard = new DataTransfer();
      clipboard.setData("text/plain", "0\t오답노트");
      element.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }));
    });
    await expect(cells.nth(0)).toHaveAccessibleName("김학생 1번 오답노트");
    await expect(cells.nth(1)).toHaveAccessibleName("김학생 2번 오답노트");
    await expect(cells.nth(0)).toHaveText("노트");
    await expect(cells.nth(1)).toHaveText("노트");
    await dialog.getByLabel("채점표 배율 선택").selectOption("10");
    await expect(dialog.getByText("전체 조망 중", { exact: false })).toBeVisible();
  });

  test("390px에서도 10% 전체 조망 컨트롤을 모두 사용할 수 있다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installApi(page, {
      sheetSize: {
        students: 31,
        questions: 20,
      },
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "정오표 작성");

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 정오 직접입력",
    });
    const scaleControl = dialog.locator('[role="group"][aria-label="채점표 배율"]');
    await expect(dialog.getByRole("button", { name: "전체 조망" })).toBeVisible();
    await expect(dialog.getByLabel("채점표 배율 선택")).toBeVisible();
    const mobileScaleLayout = await scaleControl.evaluate((element) => {
      const toolbar = element.parentElement;
      if (!toolbar) return null;
      const controlRect = element.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      return {
        height: controlRect.height,
        leftDelta: toolbarRect.left - controlRect.left,
        rightDelta: controlRect.right - toolbarRect.right,
      };
    });
    expect(mobileScaleLayout).not.toBeNull();
    expect(mobileScaleLayout?.height).toBeGreaterThanOrEqual(60);
    expect(mobileScaleLayout?.leftDelta).toBeLessThanOrEqual(1);
    expect(mobileScaleLayout?.rightDelta).toBeLessThanOrEqual(1);

    await dialog.getByLabel("채점표 배율 선택").selectOption("10");
    await expect(dialog.getByText("전체 조망 중", { exact: false })).toBeVisible();
    await expect(dialog.locator("[data-manual-grade-cell]").first()).toBeDisabled();
  });

  test("짧은 모바일 화면에서도 모든 채점 설정과 저장 버튼에 접근한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await installApi(page, {
      gradingMode: "choice",
      manualGradingMethod: "score",
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "시험 설정");

    const settingsDialog = page.getByRole("dialog").filter({
      hasText: "시험 설정",
    });
    const modalBodyScroller = settingsDialog.locator(
      ".modal-body > .overflow-y-auto",
    );
    await expect(modalBodyScroller).toHaveCSS("overflow-y", "auto");
    await expect(
      settingsDialog.getByRole("radio", {
        name: /문항별 점수 직접입력/,
      }),
    ).toBeVisible();

    const publishButton = settingsDialog.getByRole("button", {
      name: /학원 홈페이지에 성적 통계 게시/,
    });
    await publishButton.scrollIntoViewIfNeeded();
    await expect(publishButton).toBeVisible();
    const saveButton = settingsDialog.getByRole("button", {
      name: "저장",
      exact: true,
    });
    await expect(saveButton).toBeVisible();
    for (const target of [publishButton, saveButton]) {
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(600);
    }
  });

  test("혼합형은 OMR 문항을 잠그고 별도 결과 보정으로 이동한다", async ({ page }) => {
    const apiState = await installApi(page, {
      gradingMode: "mixed",
      initialStates: ["correct", null],
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "정오표 작성");

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 혼합 채점",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(
      "OMR 문항은 잠긴 상태로 확인하고, 직접 채점 문항만 입력합니다.",
      { exact: true },
    )).toBeVisible();
    await expect(dialog.locator('[aria-label="김학생 1번 자동채점 O"]')).toBeVisible();
    await expect(dialog.getByRole("button", { name: "미입력" })).toHaveCount(1);
    await expect(dialog.getByText("이 시험 작업", { exact: true })).toBeVisible();
    await expect(dialog.getByText("직접 문항 입력 중", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "OMR 답안 등록" }).click();
    const uploadDialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
    await expect(uploadDialog).toBeVisible();
    await expect(uploadDialog.getByText("7월 진단평가", { exact: true })).toBeVisible();
    await uploadDialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "OMR 결과 보정" }).click();
    const omrDialog = page.getByRole("dialog", { name: "OMR 검토" });
    await expect(omrDialog).toBeVisible();
    await omrDialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(omrDialog).toHaveCount(0);
    await expect.poll(() => apiState.manualSheetGetCount).toBeGreaterThan(1);
  });

  test("문항이 없으면 정답 등록과 문항 수 빠른 시작을 제공한다", async ({ page }) => {
    await installApi(page, {
      gradingMode: "written",
      editable: true,
      hasQuestions: false,
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "정오표 작성");

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 정오 직접입력",
    });
    await expect(dialog.getByRole("button", { name: "객관식 답안 등록" })).toBeVisible();
    await dialog.getByRole("button", { name: "문항 수로 바로 시작" }).click();
    await dialog.getByRole("spinbutton", { name: "전체 문항 수", exact: true }).fill("2");
    await dialog.getByRole("button", { name: "채점표 만들기", exact: true }).click();

    await expect(dialog.getByRole("heading", { name: "정오 직접입력", exact: true })).toBeVisible();
    await expect(dialog.getByRole("spinbutton", { name: "1번 배점", exact: true })).toHaveValue("40");
    await expect(dialog.getByRole("spinbutton", { name: "2번 배점", exact: true })).toHaveValue("60");
  });

  test("점수형 문항도 셀 전체에서 편집하고 방향키로 이동한다", async ({ page }) => {
    await installApi(page, { manualGradingMethod: "score" });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await chooseExamHeaderAction(page, "정오표 작성");

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 문항별 점수 입력",
    });
    const cells = dialog.locator("input[data-manual-grade-cell]");
    await expect(cells).toHaveCount(2);
    await expect(cells.first()).toBeFocused();
    await page.keyboard.type("25");
    await expect(cells.first()).toHaveValue("25");
    await page.keyboard.press("ArrowRight");
    await expect(cells.nth(1)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cells.first()).toBeFocused();
  });

  test("성적표 시험명에서 열고 단축키를 바꾸면 자동 이동과 함께 저장된다", async ({ page }, testInfo) => {
    await installApi(page);

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );

    const editAction = page.locator(".scores-edit-action");
    const toolsTrigger = page.getByRole("button", { name: "성적 도구", exact: true });
    const scoreTab = page.getByRole("tab", { name: "성적", exact: true, selected: true });
    const attendanceTab = page.getByRole("tab", { name: "출결", exact: true, selected: false });
    await expect(editAction).toBeVisible();
    await expect(toolsTrigger).toBeVisible();
    await expect(scoreTab).toBeVisible();
    await expect(attendanceTab).toBeVisible();
    await expect(editAction).toHaveCSS("min-height", "38px");
    await expect(toolsTrigger).toHaveCSS("border-top-width", "1px");

    const activeTabVisual = await scoreTab.evaluate((tab) => {
      const style = getComputedStyle(tab);
      return {
        backgroundImage: style.backgroundImage,
        borderRadius: style.borderRadius,
        fontWeight: Number(style.fontWeight),
      };
    });
    expect(activeTabVisual.backgroundImage).not.toBe("none");
    expect(activeTabVisual.borderRadius).not.toBe("0px");
    expect(activeTabVisual.fontWeight).toBeGreaterThanOrEqual(700);

    await attendanceTab.hover();
    const inactiveHoverVisual = await attendanceTab.evaluate((tab) => {
      const style = getComputedStyle(tab);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
      };
    });
    expect(inactiveHoverVisual.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(inactiveHoverVisual.color).not.toBe(inactiveHoverVisual.backgroundColor);

    const toolbarVisual = await toolsTrigger.evaluate((button) => {
      const label = button.querySelector<HTMLElement>(".ds-button__label");
      const chevronSlot = button.querySelector<HTMLElement>(".ds-button__right");
      if (label == null || chevronSlot == null) {
        return null;
      }
      const buttonStyle = getComputedStyle(button);
      const labelRect = label.getBoundingClientRect();
      const chevronRect = chevronSlot.getBoundingClientRect();
      return {
        boxShadow: buttonStyle.boxShadow,
        backgroundImage: buttonStyle.backgroundImage,
        centerDelta: Math.abs(
          (labelRect.top + labelRect.height / 2) -
          (chevronRect.top + chevronRect.height / 2),
        ),
        chevronWidth: chevronRect.width,
        chevronHeight: chevronRect.height,
      };
    });
    expect(toolbarVisual).not.toBeNull();
    expect(toolbarVisual?.boxShadow).not.toBe("none");
    expect(toolbarVisual?.backgroundImage).not.toBe("none");
    expect(toolbarVisual?.centerDelta).toBeLessThanOrEqual(1);
    expect(toolbarVisual?.chevronWidth).toBe(18);
    expect(toolbarVisual?.chevronHeight).toBe(18);

    const toolsColorBeforeHover = await toolsTrigger.evaluate(
      (button) => getComputedStyle(button).color,
    );
    await toolsTrigger.hover();
    await expect.poll(() => toolsTrigger.evaluate(
      (button) => getComputedStyle(button).color,
    )).toBe(toolsColorBeforeHover);

    await page.evaluate(() => {
      const probe = document.createElement("button");
      probe.type = "button";
      probe.className = "ds-button";
      probe.dataset.intent = "primary";
      probe.dataset.contrastProbe = "true";
      probe.setAttribute("aria-pressed", "true");
      probe.textContent = "선택됨";
      probe.style.position = "fixed";
      probe.style.top = "8px";
      probe.style.left = "8px";
      probe.style.zIndex = "9999";
      document.body.append(probe);
    });
    const contrastProbe = page.locator('[data-contrast-probe="true"]');
    const selectedButtonColors = await contrastProbe.evaluate((button) => {
      const style = getComputedStyle(button);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(contrastRatio(
      selectedButtonColors.color,
      selectedButtonColors.background,
    )).toBeGreaterThanOrEqual(4.5);
    await contrastProbe.hover();
    const selectedButtonHoverColors = await contrastProbe.evaluate((button) => {
      const style = getComputedStyle(button);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(contrastRatio(
      selectedButtonHoverColors.color,
      selectedButtonHoverColors.background,
    )).toBeGreaterThanOrEqual(4.5);
    await contrastProbe.evaluate((button) => button.remove());

    await toolsTrigger.click();
    await expect(page.getByRole("menu", { name: "성적 도구" })).toBeVisible();
    await expect(toolsTrigger).toHaveAttribute("aria-expanded", "true");
    await toolsTrigger.click();
    await expect(page.getByRole("menu", { name: "성적 도구" })).toBeHidden();

    for (const viewport of [
      { width: 1366, height: 900 },
      { width: 1100, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelectorAll<HTMLElement>("*").forEach((element) => {
          if (element.scrollTop !== 0) element.scrollTop = 0;
        });
      });
      const screenshotPath = testInfo.outputPath(`scores-workbench-${viewport.width}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach(`scores-workbench-${viewport.width}`, {
        path: screenshotPath,
        contentType: "image/png",
      });
      await expect(toolsTrigger).toBeVisible();
      const responsiveLayout = await toolsTrigger.evaluate((button) => {
        const label = button.querySelector<HTMLElement>(".ds-button__label");
        const chevronSlot = button.querySelector<HTMLElement>(".ds-button__right");
        const toolbar = button.closest<HTMLElement>(".domain-list-toolbar");
        if (label == null || chevronSlot == null || toolbar == null) {
          return null;
        }
        const labelRect = label.getBoundingClientRect();
        const chevronRect = chevronSlot.getBoundingClientRect();
        return {
          centerDelta: Math.abs(
            (labelRect.top + labelRect.height / 2) -
            (chevronRect.top + chevronRect.height / 2),
          ),
          toolbarOverflow: toolbar.scrollWidth - toolbar.clientWidth,
        };
      });
      expect(responsiveLayout).not.toBeNull();
      expect(responsiveLayout?.centerDelta).toBeLessThanOrEqual(1);
      expect(responsiveLayout?.toolbarOverflow).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });

    await chooseExamHeaderAction(page, "정오표 작성");

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 정오 직접입력",
    });
    await expect(dialog).toBeVisible();
    const cells = dialog.locator("[data-manual-grade-cell]");
    await expect(cells).toHaveCount(2);
    await expect(cells.first()).toBeFocused();
    const spreadsheetCell = await cells.first().evaluate((control) => {
      const tableCell = control.closest("td");
      if (!(tableCell instanceof HTMLTableCellElement)) return null;
      const controlRect = control.getBoundingClientRect();
      const cellRect = tableCell.getBoundingClientRect();
      const controlStyle = getComputedStyle(control);
      const cellStyle = getComputedStyle(tableCell);
      return {
        leftInset: Math.abs(controlRect.left - cellRect.left),
        topInset: Math.abs(controlRect.top - cellRect.top),
        rightInset: Math.abs(cellRect.right - controlRect.right),
        bottomInset: Math.abs(cellRect.bottom - controlRect.bottom),
        borderRadius: controlStyle.borderRadius,
        cursor: controlStyle.cursor,
        outlineStyle: cellStyle.outlineStyle,
        outlineWidth: cellStyle.outlineWidth,
        outlineOffset: cellStyle.outlineOffset,
      };
    });
    expect(spreadsheetCell).not.toBeNull();
    expect(spreadsheetCell?.leftInset).toBeLessThanOrEqual(1);
    expect(spreadsheetCell?.topInset).toBeLessThanOrEqual(1);
    expect(spreadsheetCell?.rightInset).toBeLessThanOrEqual(1);
    expect(spreadsheetCell?.bottomInset).toBeLessThanOrEqual(1);
    expect(spreadsheetCell?.borderRadius).toBe("0px");
    expect(spreadsheetCell?.cursor).toBe("cell");
    expect(spreadsheetCell?.outlineStyle).toBe("solid");
    expect(spreadsheetCell?.outlineWidth).toBe("2px");
    expect(spreadsheetCell?.outlineOffset).toBe("-2px");

    await page.keyboard.press("Shift+?");
    await expect(dialog.getByText("정오 입력 단축키", { exact: true })).toBeVisible();
    await dialog.getByRole("textbox", { name: "정답 단축키" }).press("a");
    await dialog.getByRole("textbox", { name: "오답 단축키" }).press("s");
    await dialog.getByRole("textbox", { name: "오답노트 단축키" }).press("d");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await expect(dialog.getByText("A 키", { exact: true })).toBeVisible();
    await expect(dialog.getByText("D 키", { exact: true })).toBeVisible();
    await expect(dialog.getByText("오답노트", { exact: true }).first()).toBeVisible();
    await cells.first().focus();
    await page.keyboard.press("a");
    await expect(cells.nth(1)).toBeFocused();
    await page.keyboard.press("d");
    await expect(cells.first()).toHaveAccessibleName("김학생 1번 O");
    await expect(cells.nth(1)).toHaveAccessibleName("김학생 2번 오답노트");

    await expect.poll(() => page.evaluate(() =>
      localStorage.getItem("academy.manual-grading-shortcuts.v1"),
    )).toBe(JSON.stringify({ correct: "A", incorrect: "S", review: "D" }));
  });
});
