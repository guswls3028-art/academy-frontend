import type { Locator, Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 9970;
const SESSION_ID = 9971;
const EXAM_ID = 9972;

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type MockState = {
  exam: Record<string, unknown>;
  examPatchPayloads: Array<Record<string, unknown>>;
  examPatchFailure?: { status: number; body: unknown };
  selectedEnrollmentIds: number[];
  recalculations?: number;
  failRecalculation?: boolean;
  answerKeyPresent?: boolean;
  failExamRead?: boolean;
  examReadGate?: Promise<void>;
  examReadCount?: number;
  secondExam?: Record<string, unknown>;
  templateSaves?: Array<Record<string, unknown>>;
  pdfUploads?: number;
  savedAnswers?: Record<string, string>;
  answerWrites?: number;
  failAnswerWrite?: boolean;
};

const session = {
  id: SESSION_ID,
  lecture: LECTURE_ID,
  title: "3차시",
  display_label: "3차시",
  order: 3,
  regular_order: 3,
  session_type: "REGULAR",
  date: "2026-08-03",
  section: null,
};

async function installApi(page: Page, state: MockState) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (path === `/exams/${EXAM_ID}/save-as-template/` && method === "POST") {
      state.templateSaves ??= [];
      state.templateSaves.push(request.postDataJSON());
      state.exam = { ...state.exam, template_exam_id: 9990 };
      return json(state.exam);
    }
    if (path === `/exams/${EXAM_ID}/structure/ensure/` && method === "POST") {
      return json(state.exam);
    }
    if (path === "/exams/pdf-extract/" && method === "POST") {
      state.pdfUploads = (state.pdfUploads ?? 0) + 1;
      return json({ status: "source_saved", message: "원본 저장 완료" });
    }
    if (state.secondExam && path === `/exams/${EXAM_ID + 1}/`) return json(state.secondExam);
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === `/lectures/lectures/${LECTURE_ID}/`) {
      return json({
        id: LECTURE_ID,
        title: "고1 Hyper 정규반",
        name: "김준혁",
        subject: "수학",
        is_active: true,
      });
    }
    if (path === "/lectures/lectures/") {
      return json([{ id: LECTURE_ID, title: "고1 Hyper 정규반", is_active: true }]);
    }
    if (path === "/lectures/sessions/") return json([session]);
    if (path === `/lectures/sessions/${SESSION_ID}/`) return json(session);
    if (path === "/lectures/sections/") return json([]);
    if (path === `/results/admin/sessions/${SESSION_ID}/exams/`) {
      return json([{
        exam_id: EXAM_ID,
        title: state.exam.title,
        open_at: state.exam.open_at,
        close_at: state.exam.close_at,
        allow_retake: state.exam.allow_retake,
        max_attempts: state.exam.max_attempts,
      }, ...(state.secondExam ? [{ exam_id: EXAM_ID + 1, title: state.secondExam.title }] : [])]);
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/exams/summary/`) {
      return json({
        exams: [{
          exam_id: EXAM_ID,
          title: state.exam.title,
          max_score: state.exam.max_score,
          participant_count: 0,
        }],
      });
    }
    if (path === "/homeworks/") return json({ count: 0, results: [] });
    if (path === `/exams/${EXAM_ID}/` && method === "PATCH") {
      const expectedUpdatedAt = request.headers()["x-expected-updated-at"];
      if (!expectedUpdatedAt) {
        return json({ detail: "수정 기준 시각이 필요합니다." }, 428);
      }
      if (expectedUpdatedAt !== state.exam.updated_at) {
        return json({
          detail: "다른 화면에서 변경된 시험입니다.",
          code: "stale_resource",
          current_updated_at: state.exam.updated_at,
        }, 409);
      }
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.examPatchPayloads.push(payload);
      if (state.examPatchFailure) {
        return json(state.examPatchFailure.body, state.examPatchFailure.status);
      }
      state.exam = { ...state.exam, ...payload, updated_at: "2026-08-03T01:00:00Z" };
      return json(state.exam);
    }
    if (path === `/exams/${EXAM_ID}/recalculate/` && method === "POST") {
      state.recalculations = (state.recalculations ?? 0) + 1;
      return json({ exam_id: EXAM_ID, total: 2, graded: state.failRecalculation ? 1 : 2, skipped: 0,
        failed: state.failRecalculation ? [{ submission_id: 601, status: "done", detail: "fixture failure" }] : [] });
    }
    if (path === `/exams/${EXAM_ID}/`) {
      state.examReadCount = (state.examReadCount ?? 0) + 1;
      if (state.examReadGate) await state.examReadGate;
      return state.failExamRead ? json({ detail: "시험 설정 조회 실패" }, 503) : json(state.exam);
    }
    if (path === `/exams/${EXAM_ID}/questions/` || (state.secondExam && path === `/exams/${EXAM_ID + 1}/questions/`)) {
      return json([
        { id: 1, sheet: 1, number: 1, question_kind: "choice", score: 50 },
        { id: 2, sheet: 1, number: 2, question_kind: "essay", score: 50 },
      ]);
    }
    if (path === `/exams/${EXAM_ID}/explanations/`) return json([]);
    if (path === "/exams/answer-keys/9980/" && method === "PUT") {
      state.answerWrites = (state.answerWrites ?? 0) + 1;
      if (state.failAnswerWrite) return json({ detail: "정답 저장에 실패했습니다. 다시 시도해 주세요." }, 400);
      state.savedAnswers = (request.postDataJSON() as { answers: Record<string, string> }).answers;
      return json({ id: 9980, exam: EXAM_ID, answers: state.savedAnswers });
    }
    if (path === "/exams/answer-keys/" && method === "GET") {
      return json(state.answerKeyPresent === false ? [] : [{
        id: 9980,
        exam: EXAM_ID,
        answers: state.savedAnswers ?? { "1": "1" },
        created_at: "2026-08-02T00:00:00Z",
        updated_at: "2026-08-02T00:00:00Z",
      }]);
    }
    if (path === `/exams/${EXAM_ID}/assets/`) return json([]);
    if (path === `/exams/${EXAM_ID}/enrollments/` && method === "PUT") {
      const payload = request.postDataJSON() as { enrollment_ids?: number[] };
      state.selectedEnrollmentIds = payload.enrollment_ids ?? [];
      return json({ selected_count: state.selectedEnrollmentIds.length });
    }
    if (path === `/exams/${EXAM_ID}/enrollments/`) {
      const selected = new Set(state.selectedEnrollmentIds);
      return json({
        exam_id: EXAM_ID,
        session_id: SESSION_ID,
        items: [
          { enrollment_id: 601, student_name: "김민준", school: "한빛고", grade: 1, is_selected: selected.has(601) },
          { enrollment_id: 602, student_name: "이서윤", school: "한빛고", grade: 1, is_selected: selected.has(602) },
        ],
      });
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/enrollments/" || path === "/enrollments/session-enrollments/") return json([]);
    return json({ count: 0, results: [] });
  });
}

async function openExam(page: Page, state: MockState, initialFailure = false) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "평가 운영 워크스페이스 route-mock 검증은 로컬 dev 서버 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, state);
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?assessment=exam%3A${EXAM_ID}`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );
  await waitForRenderSettled(page, { timeout: 30_000 });
  if (initialFailure) return;
  await expect(page.locator('[aria-label="시험 운영 준비"]')).toBeVisible({ timeout: 30_000 });
  const settings = page.locator("#assessment-policy > details");
  await expect(settings).not.toHaveAttribute("open", "");
  await expect(settings.locator(":scope > summary")).toContainText("설정 변경");
  await settings.locator(":scope > summary").click();
}

test("시험 준비 상태와 전체 운영 정책을 저장·재조회하고 모바일에서도 정돈된 순서를 유지한다", async ({ page }, testInfo) => {
  const state: MockState = {
    exam: {
      id: EXAM_ID,
      title: "중간 점검",
      description: "",
      subject: "",
      exam_type: "regular",
      is_active: true,
      allow_retake: false,
      max_attempts: 1,
      pass_score: 80,
      max_score: 100,
      grading_mode: "choice",
      manual_grading_method: "score",
      choice_question_count: 0,
      segmentation_status: "ready",
      source_filename: "중간점검.pdf",
      display_order: 0,
      open_at: null,
      close_at: null,
      template_exam_id: null,
      structure_owner_id: EXAM_ID,
      can_edit_structure: true,
      answer_visibility: "hidden",
      student_results_published: true,
      created_at: "2026-08-02T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
    },
    examPatchPayloads: [],
    selectedEnrollmentIds: [601, 602],
    answerKeyPresent: false,
  };

  await page.setViewportSize({ width: 1366, height: 900 });
  await openExam(page, state);

  await expect(page.getByText("정답표 등록 필요", { exact: true })).toBeVisible();
  await expect(page.getByText("2개 문항 · 정답표 없음", { exact: true })).toBeVisible();
  state.answerKeyPresent = true;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#assessment-policy > details > summary").click();

  await expect(page.getByText("시험 운영 준비 완료", { exact: true })).toBeVisible();
  const readiness = page.locator('details[aria-label="시험 운영 준비"]');
  await expect(readiness).not.toHaveAttribute("open", "");
  await readiness.locator("summary").click();
  await expect(page.getByRole("button", { name: /대상 학생: 2명 등록/ })).toBeVisible();
  await readiness.locator("summary").click();
  await expect(page.getByText("시험 운영 설정", { exact: true })).toBeVisible();
  await expect(page.getByLabel("학생 성적 공개")).toBeChecked();
  await page.getByTestId("student-results-visibility-control").screenshot({
    path: testInfo.outputPath("student-results-visibility-1366.png"),
  });
  const gradingGroup = page.getByRole("group", { name: "시험 채점 방식" });
  await expect(gradingGroup.getByRole("button", { name: /^OMR 자동 채점/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("assessment-primary-action").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("assessment-workspace-1366.png"),
    fullPage: true,
  });

  const workflow = page.getByRole("navigation", { name: "시험 업무 흐름" });
  const primaryAction = page.getByTestId("assessment-primary-action");
  await expect(workflow).toBeVisible();
  await expect(primaryAction).toHaveText("제출 현황 보기");
  await expect.poll(() => primaryAction.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
  await page.setViewportSize({ width: 1366, height: 900 });
  await primaryAction.click();
  await expect(page.getByRole("tab", { name: "제출관리", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(primaryAction).toHaveText("채점·결과 보기");
  await primaryAction.click();
  await expect(page.getByRole("tab", { name: "채점·결과", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(primaryAction).toHaveText("운영 설정 보기");
  await primaryAction.click();
  await expect(page.getByRole("tab", { name: "운영", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.locator("#assessment-policy > details > summary").click();

  await gradingGroup.getByRole("button", { name: /^OMR \+ 직접 채점/ }).click();
  await expect(page.getByLabel("앞쪽 선택형 문항 수")).toHaveValue("1");
  await expect(page.getByLabel("앞쪽 선택형 문항 수")).toBeDisabled();

  await page.getByLabel("합격 기준").fill("");
  await expect(page.getByRole("alert")).toContainText("합격 기준을 입력해 주세요.");
  await expect(page.getByRole("button", { name: "운영 설정 저장", exact: true })).toBeDisabled();
  await page.getByLabel("합격 기준").fill("80");

  await gradingGroup.getByRole("button", { name: /^직접 정오 입력/ }).click();
  await page.getByText("응시 기간·정답 공개·재응시", { exact: false }).click();
  await page.getByLabel("응시 시작").fill("2026-08-03T09:00");
  await page.getByRole("textbox", { name: /^마감 비워/ }).fill("2026-08-03T22:00");
  await page.getByLabel("정답 공개").selectOption("after_closed");
  await page.getByLabel("학생 성적 공개").uncheck();
  await page.getByLabel("재응시 허용").check();
  await page.getByLabel("최대 응시 횟수").fill("3");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();

  await expect.poll(() => state.examPatchPayloads.length).toBe(1);
  expect(state.examPatchPayloads[0]).toMatchObject({
    grading_mode: "written",
    manual_grading_method: "correctness",
    allow_retake: true,
    max_attempts: 3,
    answer_visibility: "after_closed",
    student_results_published: false,
  });
  expect(state.examPatchPayloads[0].open_at).toEqual(expect.any(String));
  expect(state.examPatchPayloads[0].close_at).toEqual(expect.any(String));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#assessment-policy > details > summary").click();
  await expect(
    page.getByRole("group", { name: "시험 채점 방식" }).getByRole("button", { name: /^직접 정오 입력/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("재응시 허용")).toBeChecked();
  await expect(page.getByLabel("학생 성적 공개")).not.toBeChecked();
  await expect(page.getByLabel("최대 응시 횟수")).toHaveValue("3");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("시험 운영 준비 완료", { exact: true })).toBeVisible();
  await expect(page.getByText("시험 운영 설정", { exact: true })).toBeVisible();
  if (await page.locator("#assessment-policy > details").getAttribute("open") === null) {
    await page.locator("#assessment-policy > details > summary").click();
  }
  await expect(page.getByRole("navigation", { name: "시험 업무 흐름" })).toBeVisible();
  await expect.poll(() => page.getByTestId("assessment-primary-action").evaluate(
    (element) => element.getBoundingClientRect().height,
  )).toBeGreaterThanOrEqual(44);
  await page.getByTestId("student-results-visibility-control").screenshot({
    path: testInfo.outputPath("student-results-visibility-390.png"),
  });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
  await page.getByTestId("assessment-primary-action").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("assessment-workspace-390.png"),
    fullPage: true,
  });
});

test("0점 합격 기준을 저장하고 서버 필드 오류를 입력값과 함께 보존한다", async ({ page }) => {
  const state: MockState = {
    exam: {
      id: EXAM_ID,
      title: "중3 공개 시험",
      description: "",
      subject: "수학",
      exam_type: "regular",
      is_active: true,
      allow_retake: false,
      max_attempts: 1,
      pass_score: 0,
      max_score: 15,
      grading_mode: "written",
      manual_grading_method: "correctness",
      choice_question_count: 0,
      segmentation_status: "ready",
      source_filename: "",
      display_order: 0,
      open_at: null,
      close_at: null,
      template_exam_id: null,
      structure_owner_id: EXAM_ID,
      can_edit_structure: true,
      answer_visibility: "hidden",
      student_results_published: true,
      created_at: "2026-08-02T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
    },
    examPatchPayloads: [],
    selectedEnrollmentIds: [601, 602],
  };

  await openExam(page, state);
  await expect(page.getByLabel("합격 기준")).toHaveValue("0");
  await page.getByLabel("만점").fill("16");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();

  await expect.poll(() => state.examPatchPayloads.length).toBe(1);
  expect(state.examPatchPayloads[0]).toMatchObject({ max_score: 16, pass_score: 0 });
  await expect(page.getByLabel("만점")).toHaveValue("16");
  await expect(page.getByRole("button", { name: "전체 재채점", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "전체 재채점", exact: true }).click();
  const regradeDialog = page.getByRole("alertdialog", { name: "시험 전체 재채점" });
  await expect(regradeDialog).toContainText("아직 저장하지 않은 변경은 반영되지 않습니다.");
  await regradeDialog.getByRole("button", { name: "재채점 실행", exact: true }).click();
  await expect.poll(() => state.recalculations).toBe(1);
  await expect(page.getByText("저장된 정답·배점 기준으로 전체 재채점을 완료했습니다.", { exact: true })).toBeVisible();
  state.failRecalculation = true;
  await page.getByRole("button", { name: "전체 재채점", exact: true }).click();
  await regradeDialog.getByRole("button", { name: "재채점 실행", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "재채점 1건" })).toContainText("실패 1건");
  state.failRecalculation = false;
  await page.getByRole("button", { name: "전체 재채점", exact: true }).click();
  await regradeDialog.getByRole("button", { name: "재채점 실행", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "재채점 2건" })).toContainText("실패 0건");

  state.examPatchFailure = {
    status: 400,
    body: { max_score: ["문항 배점 합계와 만점이 일치하지 않습니다."] },
  };
  await page.getByLabel("만점").fill("17");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();

  await expect(page.getByText("문항 배점 합계와 만점이 일치하지 않습니다.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("만점")).toHaveValue("17");
  expect(state.exam.max_score).toBe(16);
});

function recoveryExamState(): MockState {
  return {
    exam: {
      id: EXAM_ID, title: "재조회 복구 평가", description: "", subject: "",
      exam_type: "regular", is_active: true, allow_retake: false, max_attempts: 1,
      pass_score: 80, max_score: 100, grading_mode: "choice", manual_grading_method: "score",
      choice_question_count: 0, segmentation_status: "ready", source_filename: "평가.pdf",
      display_order: 0, open_at: null, close_at: null, template_exam_id: null,
      structure_owner_id: EXAM_ID, can_edit_structure: true, answer_visibility: "hidden",
      created_at: "2026-08-02T00:00:00Z", updated_at: "2026-08-02T00:00:00Z",
    },
    examPatchPayloads: [],
    selectedEnrollmentIds: [601, 602],
  };
}

for (const width of [1366, 1100, 390]) {
  test(`@assessment-workspace-layout ${width}px 시험 목록과 작업 영역을 배치하고 선택을 복원한다`, async ({ page }, testInfo) => {
    const state = recoveryExamState();
    state.exam.title = "수학 기초 개념과 서술형 풀이 과정을 함께 확인하는 평가";
    state.secondExam = { ...state.exam, id: EXAM_ID + 1, title: "다음 평가", pass_score: 65 };
    await page.setViewportSize({ width, height: 900 });
    await openExam(page, state);
    const navigation = page.getByTestId("session-assessment-remote");
    const workspace = page.locator(".session-assessment-workspace");
    // Opening settings may scroll the workspace while the list stays sticky.
    await navigation.evaluate(element => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) parent.scrollTop = 0;
    });
    const navBox = await navigation.boundingBox();
    const workspaceBox = await workspace.boundingBox();
    if (width > 1000) {
      expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(workspaceBox!.x);
      expect(Math.abs(navBox!.y - workspaceBox!.y)).toBeLessThanOrEqual(1);
    } else {
      await expect(navigation.getByRole("combobox", { name: "시험 선택", exact: true })).toBeVisible();
      expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(workspaceBox!.y);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await navigation.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`exam-workspace-${width}.png`), animations: "disabled" });
    const selectNext = async () => {
      if (width > 1000) await navigation.getByRole("button").filter({ hasText: "다음 평가" }).click();
      else await navigation.getByRole("combobox", { name: "시험 선택", exact: true }).selectOption(String(EXAM_ID + 1));
    };
    await page.getByLabel("합격 기준").fill("77");
    await selectNext();
    await page.getByRole("alertdialog").getByRole("button", { name: "계속 편집", exact: true }).click();
    await expect(page.getByLabel("합격 기준")).toHaveValue("77");
    if (width === 390) await expect(navigation.getByRole("combobox", { name: "시험 선택", exact: true })).toHaveValue(String(EXAM_ID));
    await selectNext();
    await page.getByRole("alertdialog").getByRole("button", { name: "저장하지 않고 이동", exact: true }).click();
    await expect(page.getByRole("heading", { name: "다음 평가", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "다음 평가", exact: true })).toBeVisible();
    expect(state.examPatchPayloads).toEqual([]);
  });
}

async function expectWrittenAnswerFits(answer: Locator) {
  await expect.poll(() => answer.evaluate((element) => ({
    vertical: element.scrollHeight <= element.clientHeight + 1,
    horizontal: element.scrollWidth <= element.clientWidth + 1,
  }))).toEqual({ vertical: true, horizontal: true });
  const row = answer.locator("xpath=ancestor::li");
  const answerBox = await answer.boundingBox();
  const rowBox = await row.boundingBox();
  expect(answerBox).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(answerBox!.width).toBeGreaterThan(rowBox!.width - 20);
}

for (const width of [1366, 1100, 390]) {
  test(`@essay-answer ${width}px 긴 서술형 정답을 읽고 줄바꿈 편집·저장 실패 복구·재조회를 한다`, async ({ page }, testInfo) => {
    const state = recoveryExamState();
    state.exam.subject = "국어";
    const original = "낮은 곳은 D이다. 물은 높은 곳에서 낮은 곳으로 이동하므로 그림의 높이와 이동 방향을 함께 비교해야 한다. ".repeat(3).trim()
      + "\n그림에 표시된 근거를 문장으로 설명한다.";
    state.savedAnswers = { "1": "1", "2": original };
    await page.setViewportSize({ width, height: 900 });
    await openExam(page, state);
    await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
    const modal = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "저장 (총 100점)", exact: true }) });
    const answer = modal.getByRole("textbox", { name: "2번 정답", exact: true });
    await expect(answer).toHaveValue(original);
    await expectWrittenAnswerFits(answer);
    await answer.fill("짧은 답");
    const shortHeight = (await answer.boundingBox())!.height;
    await answer.fill(original);
    await expectWrittenAnswerFits(answer);
    expect((await answer.boundingBox())!.height).toBeGreaterThan(shortHeight);
    await answer.press("ControlOrMeta+End");
    await answer.press("Enter");
    await answer.pressSequentially("추가 근거");
    const edited = `${original}\n추가 근거`;
    await expect(answer).toHaveValue(edited);
    await answer.press("ArrowUp");
    await expect(answer).toBeFocused();
    expect(state.answerWrites ?? 0).toBe(0);
    await expectWrittenAnswerFits(answer);
    await answer.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`essay-answer-${width}.png`), animations: "disabled" });

    if (width === 1366) {
      await page.setViewportSize({ width: 390, height: 900 });
      await expectWrittenAnswerFits(answer);
      await page.setViewportSize({ width, height: 900 });
      await expectWrittenAnswerFits(answer);
    }

    const save = modal.getByRole("button", { name: "저장 (총 100점)", exact: true });
    state.failAnswerWrite = true;
    await save.click();
    await expect(page.getByText("정답 저장에 실패했습니다. 다시 시도해 주세요.", { exact: true })).toBeVisible();
    await expect(answer).toHaveValue(edited);
    expect(state.savedAnswers["2"]).toBe(original);
    state.failAnswerWrite = false;
    await save.click();
    await expect.poll(() => state.answerWrites).toBe(2);
    await expect.poll(() => state.savedAnswers?.["2"]).toBe(edited);
    await expect(page.getByText("저장되었습니다.", { exact: true })).toBeVisible();
    await expect(save).toBeEnabled();
    await page.reload();
    await expect(page.locator('[aria-label="시험 운영 준비"]')).toBeVisible();
    await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
    await expect(answer).toHaveValue(edited);
    await expectWrittenAnswerFits(answer);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });
}

test("@essay-answer 수학 단답은 한 줄 숫자 입력과 저장을 유지한다", async ({ page }) => {
  const state = recoveryExamState();
  state.exam.subject = "수학";
  state.savedAnswers = { "1": "1", "2": "0" };
  await openExam(page, state);
  await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
  const answer = page.getByRole("textbox", { name: "2번 숫자 정답", exact: true });
  await expect(answer).toHaveValue("0");
  expect(await answer.evaluate((element) => element.tagName)).toBe("INPUT");
  await answer.fill("999");
  await answer.press("Enter");
  // The shared modal handles numeric-input Enter in document capture phase.
  await expect.poll(() => state.answerWrites).toBe(1);
  const save = page.getByRole("button", { name: "저장 (총 100점)", exact: true });
  await expect.poll(() => state.savedAnswers?.["2"]).toBe("999");
  await expect(page.getByText("저장되었습니다.", { exact: true })).toBeVisible();
  await expect(save).toBeEnabled();
  await page.reload();
  await expect(page.locator('[aria-label="시험 운영 준비"]')).toBeVisible();
  await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
  await expect(answer).toHaveValue("999");
  await answer.fill("0");
  await save.click();
  await expect.poll(() => state.answerWrites).toBe(2);
  await expect.poll(() => state.savedAnswers?.["2"]).toBe("0");
  await expect(page.getByText("저장되었습니다.", { exact: true })).toBeVisible();
  await expect(save).toBeEnabled();
  await page.reload();
  await expect(page.locator('[aria-label="시험 운영 준비"]')).toBeVisible();
  await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
  await expect(answer).toHaveValue("0");
});

for (const width of [1366, 390]) {
test(`@policy-recovery ${width}px 최신 시험 설정 조회 실패는 작성 중인 값을 유지하고 복구 후 다시 저장한다`, async ({ page }, testInfo) => {
  const state = recoveryExamState();
  await page.setViewportSize({ width, height: 844 });
  await openExam(page, state);
  const input = page.getByLabel("합격 기준");
  await input.fill("79");
  state.exam = { ...state.exam, pass_score: 75, updated_at: "2026-08-02T00:10:00Z" };
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "다른 화면에서 설정이 변경되었습니다" })).toBeVisible();
  state.failExamRead = true;
  await page.getByRole("button", { name: "최신 설정 불러오기", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "최신 설정 불러오기", exact: true }).click();
  await expect(input).toHaveValue("79");
  await expect(page.getByRole("button", { name: "운영 설정 저장", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toBeVisible();
  await expect(input).toHaveValue("79");
  await expect.poll(async () => {
    const box = await page.getByRole("button", { name: "다시 시도", exact: true }).boundingBox();
    return Boolean(box && box.height >= 44 && box.y >= 0 && box.y + box.height <= page.viewportSize()!.height);
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`exam-policy-read-failure-${width}.png`), animations: "disabled" });
  state.failExamRead = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(input).toHaveValue("79");
  let releaseRead!: () => void;
  state.examReadGate = new Promise<void>(resolve => { releaseRead = resolve; });
  const readsBefore = state.examReadCount ?? 0;
  await page.getByRole("button", { name: "최신 설정 불러오기", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "최신 설정 불러오기", exact: true }).click();
  try {
    await expect(input).toBeDisabled();
    await expect(page.getByRole("button", { name: "최신 설정 불러오기", exact: true })).toBeDisabled();
    await expect.poll(() => state.examReadCount).toBe(readsBefore + 1);
    await expect(input).toHaveValue("79");
  } finally { state.examReadGate = undefined; releaseRead(); }
  await expect(input).toHaveValue("75");
  await input.fill("76");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  await expect.poll(() => state.exam.pass_score).toBe(76);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#assessment-policy > details > summary").click();
  await expect(input).toHaveValue("76");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
}

test("@policy-recovery 최초 시험 조회 실패도 재시도 후 설정을 편집·저장한다", async ({ page }) => {
  const state = recoveryExamState();
  state.failExamRead = true;
  await openExam(page, state, true);
  await expect(page.getByText("시험을 불러오지 못했습니다.", { exact: true })).toBeVisible();
  state.failExamRead = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await page.locator("#assessment-policy > details > summary").click();
  await page.getByLabel("합격 기준").fill("77");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  await expect.poll(() => state.exam.pass_score).toBe(77);
});

test("미저장 시험 설정은 탭 이동 전에 확인하고 동시 수정은 덮어쓰지 않는다", async ({ page }) => {
  const state: MockState = {
    exam: {
      id: EXAM_ID,
      title: "중간 점검",
      description: "",
      subject: "",
      exam_type: "regular",
      is_active: true,
      allow_retake: false,
      max_attempts: 1,
      pass_score: 80,
      max_score: 100,
      grading_mode: "choice",
      manual_grading_method: "score",
      choice_question_count: 0,
      segmentation_status: "ready",
      source_filename: "중간점검.pdf",
      display_order: 0,
      open_at: null,
      close_at: null,
      template_exam_id: null,
      structure_owner_id: EXAM_ID,
      can_edit_structure: true,
      answer_visibility: "hidden",
      created_at: "2026-08-02T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
    },
    examPatchPayloads: [],
    selectedEnrollmentIds: [601, 602],
  };

  await openExam(page, state);
  await page.getByLabel("합격 기준").fill("79");

  await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
  const discardDialog = page.getByRole("alertdialog", { name: "저장하지 않은 설정이 있습니다" });
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(page.getByLabel("합격 기준")).toHaveValue("79");

  state.exam = { ...state.exam, pass_score: 75, updated_at: "2026-08-02T00:10:00Z" };
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "다른 화면에서 설정이 변경되었습니다" }),
  ).toBeVisible();
  expect(state.examPatchPayloads).toHaveLength(0);

  await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
  await page.getByRole("alertdialog", { name: "저장하지 않은 설정이 있습니다" })
    .getByRole("button", { name: "저장하지 않고 이동", exact: true })
    .click();
  await expect(page.getByRole("tab", { name: "채점·결과", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("브라우저가 종료되어도 같은 계정·같은 서버 버전의 시험 초안만 복구한다", async ({ page }, testInfo) => {
  const state: MockState = {
    exam: {
      id: EXAM_ID,
      title: "중간 점검",
      description: "",
      subject: "",
      exam_type: "regular",
      is_active: true,
      allow_retake: false,
      max_attempts: 1,
      pass_score: 80,
      max_score: 100,
      grading_mode: "choice",
      manual_grading_method: "score",
      choice_question_count: 0,
      segmentation_status: "ready",
      source_filename: "중간점검.pdf",
      display_order: 0,
      open_at: null,
      close_at: null,
      template_exam_id: null,
      structure_owner_id: EXAM_ID,
      can_edit_structure: true,
      answer_visibility: "hidden",
      created_at: "2026-08-02T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
    },
    examPatchPayloads: [],
    selectedEnrollmentIds: [601, 602],
  };

  await openExam(page, state);
  await page.getByLabel("합격 기준").fill("79");
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find((candidate) =>
      candidate.startsWith("assessment-policy-draft:v1:exam:9972:"));
    if (!key) return null;
    const stored = JSON.parse(localStorage.getItem(key) ?? "null") as { form?: { passScore?: string } } | null;
    return stored?.form?.passScore ?? null;
  })).toBe("79");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#assessment-policy > details > summary").click();
  const recovery = page.getByTestId("assessment-draft-recovery");
  await expect(recovery).toContainText("저장되지 않은 시험 설정이 있습니다");
  await page.screenshot({
    path: testInfo.outputPath("assessment-draft-recovery-1366.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.locator("#assessment-policy > details").getAttribute("open") === null) {
    await page.locator("#assessment-policy > details > summary").click();
  }
  await expect(page.getByTestId("assessment-draft-recovery")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  await recovery.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("assessment-draft-recovery-390.png"),
    fullPage: true,
  });
  await recovery.getByRole("button", { name: "이어서 편집", exact: true }).click();
  await expect(page.getByLabel("합격 기준")).toHaveValue("79");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  await expect.poll(() => state.examPatchPayloads.length).toBe(1);
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).some((candidate) =>
      candidate.startsWith("assessment-policy-draft:v1:exam:9972:")),
  )).toBe(false);

  await page.getByLabel("합격 기준").fill("78");
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).some((candidate) =>
      candidate.startsWith("assessment-policy-draft:v1:exam:9972:")),
  )).toBe(true);
  state.exam = { ...state.exam, pass_score: 77, updated_at: "2026-08-03T02:00:00Z" };
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#assessment-policy > details > summary").click();
  await expect(page.getByTestId("assessment-draft-recovery")).toHaveCount(0);
  await expect(page.getByLabel("합격 기준")).toHaveValue("77");

  await page.getByLabel("합격 기준").fill("76");
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).some((candidate) =>
      candidate.startsWith("assessment-policy-draft:v1:exam:9972:")),
  )).toBe(true);
  await page.getByLabel("합격 기준").fill("77");
  await expect.poll(() => page.evaluate(() =>
    Object.keys(localStorage).some((candidate) =>
      candidate.startsWith("assessment-policy-draft:v1:exam:9972:")),
  )).toBe(false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#assessment-policy > details > summary").click();
  await expect(page.getByTestId("assessment-draft-recovery")).toHaveCount(0);
});

async function reconnectWithStaleQuery(page: Page) {
  await page.clock.install();
  await page.clock.setFixedTime(new Date(Date.now() + 20_000));
  await page.context().setOffline(true);
  await page.context().setOffline(false);
}

test("@policy-recovery 열린 시험 템플릿은 재조회 실패 후 이름을 보존하고 복구 후 저장한다", async ({ page }) => {
  const state = recoveryExamState();
  await openExam(page, state);
  await page.getByRole("button", { name: "템플릿으로 저장", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "템플릿으로 저장" });
  const name = modal.getByRole("textbox");
  await name.fill("보존할 시험 템플릿");
  state.failExamRead = true;
  await reconnectWithStaleQuery(page);
  await expect(modal.getByRole("alert")).toContainText("현재 설정을 확인하지 못했습니다");
  await expect(modal.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  expect(state.templateSaves ?? []).toHaveLength(0);
  await expect(name).toHaveValue("보존할 시험 템플릿");
  state.failExamRead = false;
  await modal.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(modal.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
  await modal.getByRole("button", { name: "저장", exact: true }).click();
  await expect(modal).not.toBeVisible();
  expect(state.templateSaves).toEqual([{ title: "보존할 시험 템플릿" }]);
  await page.reload();
  await expect(page.getByRole("button", { name: "템플릿으로 저장됨" })).toBeVisible();
});

test("@policy-recovery 390px 열린 원본 업로드는 재조회 실패 동안 파일을 보존하고 복구 후 업로드한다", async ({ page }, testInfo) => {
  const state = recoveryExamState();
  state.exam.segmentation_status = "none";
  await page.setViewportSize({ width: 390, height: 844 });
  await openExam(page, state);
  await page.getByRole("button", { name: "시험 자료 업로드", exact: true }).click();
  const modal = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "닫기", exact: true }) });
  await modal.locator('input[type="file"]').first().setInputFiles({ name: "보존할-원본.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  state.failExamRead = true;
  await reconnectWithStaleQuery(page);
  await expect(modal.getByRole("alert")).toContainText("선택한 파일은 유지됩니다");
  const upload = modal.getByRole("button", { name: "원본 보존 및 번호 인식", exact: true });
  await expect(upload).toBeDisabled();
  expect(state.pdfUploads ?? 0).toBe(0);
  await expect(modal.getByText("보존할-원본.pdf", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("pdf-read-error-file-preserved-390.png"), animations: "disabled" });
  state.failExamRead = false;
  await modal.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(upload).toBeEnabled();
  await upload.click();
  await expect(modal.getByText("원본 저장 완료", { exact: true })).toBeVisible();
  expect(state.pdfUploads).toBe(1);
});


test("@policy-recovery 캐시된 A→B→A 전환 후 옛 A 최신조회는 새 초안을 덮지 않는다", async ({ page }) => {
  const state = recoveryExamState();
  state.secondExam = { ...state.exam, id: EXAM_ID + 1, title: "비교 시험", pass_score: 65 };
  await openExam(page, state);
  const select = (title: string) => page.getByRole("button").filter({ has: page.getByText(title, { exact: true }) });
  await select("비교 시험").click();
  await expect(page.getByRole("heading", { name: "비교 시험", exact: true })).toBeVisible();
  await select(String(state.exam.title)).click();
  await expect(page.getByRole("heading", { name: String(state.exam.title), exact: true })).toBeVisible();
  const details = page.locator("#assessment-policy > details");
  if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click();
  const input = page.getByLabel("합격 기준");
  await expect(input).toHaveValue("80");
  await input.fill("79");
  state.exam = { ...state.exam, pass_score: 75, updated_at: "2026-08-02T00:10:00Z" };
  const conflictResponse = page.waitForResponse(response => response.url().endsWith(`/exams/${EXAM_ID}/`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  const conflict = await conflictResponse;
  expect(conflict.request().headers()["x-expected-updated-at"]).toBe("2026-08-02T00:00:00Z");
  expect(conflict.status()).toBe(409);
  await expect(page.getByRole("button", { name: "최신 설정 불러오기", exact: true })).toBeVisible();
  let releaseRead!: () => void;
  state.examReadGate = new Promise<void>(resolve => { releaseRead = resolve; });
  await page.getByRole("button", { name: "최신 설정 불러오기", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "최신 설정 불러오기", exact: true }).click();
  await expect(input).toBeDisabled();
  await select("비교 시험").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "저장하지 않고 이동", exact: true }).click();
  await expect(page.getByRole("heading", { name: "비교 시험", exact: true })).toBeVisible();
  await select(String(state.exam.title)).click();
  await expect(page.getByRole("heading", { name: String(state.exam.title), exact: true })).toBeVisible();
  if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click();
  await expect(input).toBeEnabled();
  await input.fill("78");
  const lateResponse = page.waitForResponse(response => response.url().endsWith(`/exams/${EXAM_ID}/`) && response.request().method() === "GET");
  state.examReadGate = undefined;
  releaseRead();
  await (await lateResponse).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(input).toHaveValue("78");
  await expect(page.getByRole("button", { name: "운영 설정 저장", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
  await expect.poll(() => state.exam.pass_score).toBe(78);
  await page.reload();
  await expect(page.locator('[aria-label="시험 운영 준비"]')).toBeVisible();
  await page.locator("#assessment-policy > details > summary").click();
  await expect(page.getByLabel("합격 기준")).toHaveValue("78");
});


for (const width of [1366, 390]) {
  test(`@policy-recovery ${width}px 열린 답안 등록은 시험 조회 실패 후 입력을 보존하고 복구 뒤 저장한다`, async ({ page }, testInfo) => {
    const state = recoveryExamState();
    await page.setViewportSize({ width, height: 844 });
    await openExam(page, state);
    await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
    const modal = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "저장 (총 100점)", exact: true }) });
    const bubble = modal.getByRole("checkbox", { name: "1번 2번 선택지", exact: true });
    await expect(bubble).toBeEnabled();
    await bubble.click();
    await expect(bubble).toBeChecked();
    state.failExamRead = true;
    await reconnectWithStaleQuery(page);
    await expect(modal.getByRole("alert").filter({ hasText: "시험 정보를 확인하지 못했습니다" })).toBeVisible();
    await expect(bubble).toBeDisabled();
    await expect(bubble).toBeChecked();
    const save = modal.getByRole("button", { name: "저장 (총 100점)", exact: true });
    await expect(save).toBeDisabled();
    await modal.focus();
    await page.keyboard.press("Enter");
    expect(state.answerWrites ?? 0).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`answer-key-read-failure-${width}.png`), animations: "disabled" });
    state.failExamRead = false;
    await modal.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(bubble).toBeEnabled();
    await expect(bubble).toBeChecked();
    await save.click();
    await expect.poll(() => state.answerWrites).toBe(1);
    expect(state.savedAnswers?.["1"]).toContain("2");
    await expect(save).toBeEnabled();
    await page.reload();
    await expect(page.locator('[aria-label="시험 운영 준비"]')).toBeVisible();
    await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
    await expect(bubble).toBeChecked();
  });
}
