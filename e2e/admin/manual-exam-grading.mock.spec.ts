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

type InstallApiOptions = {
  gradingMode?: "choice" | "written";
  manualGradingMethod?: "correctness" | "score";
  editable?: boolean;
  hasQuestions?: boolean;
  initialStates?: [GradeState, GradeState];
};

async function installApi(page: Page, options: InstallApiOptions = {}) {
  let applied = false;
  let hasQuestions = options.hasQuestions ?? true;
  const postedRows: unknown[] = [];
  const gradingMode = options.gradingMode ?? "written";
  const manualGradingMethod = options.manualGradingMethod ?? "correctness";
  const editable = options.editable ?? true;
  const initialStates = options.initialStates ?? [null, null];

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
      editable,
      entry_method: editable ? manualGradingMethod : "omr",
      state: applied ? "correct" : initialStates[0],
      score: applied ? 40 : manualGradingMethod === "score" ? 10 : initialStates[0] === "correct" ? 40 : 0,
      include_in_wrong_note: false,
    },
    [String(QUESTION_IDS[1])]: {
      editable,
      entry_method: editable ? manualGradingMethod : "omr",
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
          grading_mode: gradingMode,
          manual_grading_method: manualGradingMethod,
          has_manual_questions: hasQuestions && editable,
          exam_max_score: 100,
          question_score_total: hasQuestions ? 100 : 0,
          score_adjustment_total: 0,
          questions: hasQuestions ? [
            {
              question_id: QUESTION_IDS[0],
              number: 1,
              kind: gradingMode === "choice" ? "choice" : "essay",
              answer_type: gradingMode === "choice" ? "choice" : "written",
              max_score: 40,
              editable,
              entry_method: editable ? manualGradingMethod : "omr",
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
              editable,
              entry_method: editable ? manualGradingMethod : "omr",
            },
          ] : [],
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
            choice_count: 0,
            essay_count: 2,
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
    await expect(page.getByRole("heading", { name: "정오표 워크스페이스", exact: true })).toBeVisible();

    await page.getByRole("spinbutton", { name: "1번 배점", exact: true }).fill("30");
    await page.getByRole("spinbutton", { name: "2번 배점", exact: true }).fill("70");
    await expect(page.getByText("배점 합계 100점 / 시험 만점 100점", { exact: true })).toBeVisible();

    const studentRow = page.getByRole("row").filter({ hasText: "김학생" });
    const cells = studentRow.getByRole("button", { name: "미입력" });
    await expect(cells).toHaveCount(2);
    await cells.nth(0).evaluate((element) => {
      const clipboard = new DataTransfer();
      clipboard.setData("text/plain", "O\t.");
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
    await expect(studentRow.getByRole("button", { name: "0" })).toHaveCount(1);
    await expect(page.getByText("확정 전 변경사항", { exact: true })).toHaveCount(0);
  });

  test("선택형 자동채점 정오를 직접 채점이 잠긴 상태에서도 표시한다", async ({ page }) => {
    await installApi(page, {
      gradingMode: "choice",
      editable: false,
      initialStates: ["correct", "incorrect"],
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await page.getByRole("button", {
      name: "7월 진단평가 문항별 채점표 열기",
    }).click();

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 문항별 채점",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(
      "자동채점 결과를 읽기 전용으로 표시하고 있습니다. 문항별 O/X와 점수는 그대로 확인할 수 있습니다.",
      { exact: true },
    )).toBeVisible();
    await expect(dialog.getByText("객관식", { exact: true })).toBeVisible();
    await expect(dialog.getByText("단답형", { exact: true })).toBeVisible();
    await expect(dialog.locator('[aria-label="김학생 1번 자동채점 O"]')).toBeVisible();
    await expect(dialog.locator('[aria-label="김학생 2번 자동채점 X"]')).toBeVisible();
    await expect(dialog.getByRole("button", { name: "입력 내용 확인", exact: true })).toHaveCount(0);
  });

  test("문항이 없으면 정답 등록과 문항 수 빠른 시작을 제공한다", async ({ page }) => {
    await installApi(page, {
      gradingMode: "choice",
      editable: true,
      hasQuestions: false,
    });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await page.getByRole("button", {
      name: "7월 진단평가 문항별 채점표 열기",
    }).click();

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 문항별 채점",
    });
    await expect(dialog.getByRole("button", { name: "객관식 답안 등록" })).toBeVisible();
    await dialog.getByRole("button", { name: "문항 수로 바로 시작" }).click();
    await dialog.getByRole("spinbutton", { name: "전체 문항 수", exact: true }).fill("2");
    await dialog.getByRole("button", { name: "채점표 만들기", exact: true }).click();

    await expect(dialog.getByRole("heading", { name: "정오표 워크스페이스", exact: true })).toBeVisible();
    await expect(dialog.getByRole("spinbutton", { name: "1번 배점", exact: true })).toHaveValue("40");
    await expect(dialog.getByRole("spinbutton", { name: "2번 배점", exact: true })).toHaveValue("60");
  });

  test("점수형 문항도 셀 전체에서 편집하고 방향키로 이동한다", async ({ page }) => {
    await installApi(page, { manualGradingMethod: "score" });

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await page.getByRole("button", {
      name: "7월 진단평가 문항별 채점표 열기",
    }).click();

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 문항별 채점",
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

  test("성적표 시험명에서 열고 단축키를 바꾸면 자동 이동과 함께 저장된다", async ({ page }) => {
    await installApi(page);

    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );

    const editAction = page.locator(".scores-edit-action");
    const toolsTrigger = page.getByRole("button", { name: "성적 도구", exact: true });
    await expect(editAction).toBeVisible();
    await expect(toolsTrigger).toBeVisible();
    await expect(editAction).toHaveCSS("min-height", "38px");
    await expect(toolsTrigger).toHaveCSS("border-top-width", "1px");

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
    expect(toolbarVisual?.chevronWidth).toBe(24);
    expect(toolbarVisual?.chevronHeight).toBe(24);

    await toolsTrigger.click();
    await expect(page.getByRole("menu", { name: "성적 도구" })).toBeVisible();
    await expect(toolsTrigger).toHaveAttribute("aria-expanded", "true");
    await toolsTrigger.click();
    await expect(page.getByRole("menu", { name: "성적 도구" })).toBeHidden();

    for (const viewport of [
      { width: 1100, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
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

    const gradingEntry = page.getByRole("button", {
      name: "7월 진단평가 문항별 채점표 열기",
    });
    await expect(gradingEntry).toBeVisible();
    await gradingEntry.click();

    const dialog = page.getByRole("dialog").filter({
      hasText: "7월 진단평가 문항별 채점",
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
    await dialog.getByRole("textbox", { name: "정답 + 오답노트 단축키" }).press("d");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await expect(dialog.getByText("A 정답", { exact: true })).toBeVisible();
    await expect(dialog.getByText("D 정답 · 복습", { exact: true })).toBeVisible();
    await cells.first().focus();
    await page.keyboard.press("a");
    await expect(cells.nth(1)).toBeFocused();
    await page.keyboard.press("d");
    await expect(cells.first()).toHaveAccessibleName("김학생 1번 O");
    await expect(cells.nth(1)).toHaveAccessibleName("김학생 2번 0");

    await expect.poll(() => page.evaluate(() =>
      localStorage.getItem("academy.manual-grading-shortcuts.v1"),
    )).toBe(JSON.stringify({ correct: "A", incorrect: "S", review: "D" }));
  });
});
