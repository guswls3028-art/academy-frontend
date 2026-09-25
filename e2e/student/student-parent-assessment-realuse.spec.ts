/**
 * Student submission -> persisted result -> parent selected-child projection.
 * Runs only in the disposable production-shaped development tenant.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import type { SendPreflightResponse } from "../../src/app_admin/domains/messages/api/messages.api";
import type { ManualGradeSheet } from "../../src/app_admin/domains/results/api/manualExamGrading";
import type { ExamsListResponse } from "../../src/app_student/domains/exams/api/exams.api";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import {
  api,
  assertNoHorizontalOverflow,
  assertQaStudentParentRuntime,
  cleanupQaFamily,
  createQaFamily,
  expectApi,
  installQaStudentParentBoundary,
  loginAdmin,
  loginApi,
  loginThroughUi,
  logoutStudentApp,
  QA_API,
  QA_BASE,
  QA_TENANT,
  reloadStudentApp,
  selectParentStudentThroughUi,
  seedBrowserAuth,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
  type QaStudent,
  type QaTokens,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForCondition, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type CreatedState = {
  family: QaFamily | null;
  adminAccess: string;
  lectureId?: number;
  sessionId?: number;
  examId?: number;
  manualExamId?: number;
  manualStaffId?: number;
  primaryEnrollmentId?: number;
  enrollmentIds: number[];
  sessionEnrollmentIds: number[];
  submissionIds: number[];
  messageTemplateId?: number;
};

type ResultBody = {
  total_score: number;
  rank: number;
  cohort_size: number;
  analysis: {
    wrong_count: number;
    wrong_question_numbers: number[];
  };
};

const created: CreatedState = {
  family: null,
  adminAccess: "",
  enrollmentIds: [],
  sessionEnrollmentIds: [],
  submissionIds: [],
};

const runStamp = Date.now();
const todayKst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const lectureTitle = `QA 학부모 평가 ${runStamp}`;
const sessionTitle = `QA 학부모 평가 1차시 ${runStamp}`;
const examTitle = `QA 학부모 성적 projection ${runStamp}`;
const manualExamTitle = `QA 서술형 소수 배점 ${runStamp}`;

async function waitForResult(
  request: APIRequestContext,
  token: string,
  examId: number,
  selectedStudentId?: number,
): Promise<ResultBody> {
  let latest: ResultBody | null = null;
  await waitForCondition(async () => {
    const response = await request.get(`${QA_API}/api/v1/student/results/me/exams/${examId}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-Code": QA_TENANT,
        ...(selectedStudentId ? { "X-Student-Id": String(selectedStudentId) } : {}),
      },
      timeout: 60_000,
    });
    if (response.status() !== 200) return false;
    latest = await response.json() as ResultBody;
    return true;
  }, { timeoutMs: 45_000, intervalMs: 750, description: "student/parent exam result projection" });
  if (!latest) throw new Error("student/parent exam result never became authoritative");
  return latest;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.adminAccess) return;
  const failures: string[] = [];
  const remove = async (method: string, path: string, accepted = [200, 202, 204, 404]) => {
    try {
      const result = await api(request, method, path, created.adminAccess);
      if (!accepted.includes(result.status)) failures.push(`${method} ${path} -> ${result.status}`);
    } catch (error) {
      failures.push(`${method} ${path} -> ${String(error)}`);
    }
  };

  for (const id of [...created.submissionIds].reverse()) {
    await remove("DELETE", `/submissions/submissions/${id}/`);
  }
  if (created.messageTemplateId) {
    await remove("DELETE", `/messaging/templates/${created.messageTemplateId}/`);
  }
  if (created.examId && created.sessionId) {
    await remove("DELETE", `/exams/${created.examId}/?session_id=${created.sessionId}`);
  }
  if (created.manualExamId && created.sessionId) {
    await remove("DELETE", `/exams/${created.manualExamId}/?session_id=${created.sessionId}`);
  }
  // Staff deletion deactivates tenant access; the outer owned-tenant cleanup proves User zero.
  if (created.manualStaffId) await remove("DELETE", `/staffs/${created.manualStaffId}/`);
  for (const id of created.sessionEnrollmentIds) {
    await remove("DELETE", `/enrollments/session-enrollments/${id}/`);
  }
  for (const id of created.enrollmentIds) {
    await remove("DELETE", `/enrollments/${id}/`);
  }
  if (created.sessionId) await remove("DELETE", `/lectures/sessions/${created.sessionId}/`);
  if (created.lectureId) await remove("DELETE", `/lectures/lectures/${created.lectureId}/`);

  await cleanupQaFamily(request, created.adminAccess, created.family);
  for (const [label, path] of [
    ...created.submissionIds.map((id) => [
      `submission ${id}`,
      `/submissions/submissions/${id}/`,
    ] as const),
    ...(created.examId && created.sessionId
      ? [[`exam ${created.examId}`, `/exams/${created.examId}/?session_id=${created.sessionId}`] as const]
      : []),
    ...(created.manualExamId && created.sessionId
      ? [[`manual exam ${created.manualExamId}`, `/exams/${created.manualExamId}/?session_id=${created.sessionId}`] as const]
      : []),
    ...(created.manualStaffId ? [[`manual staff ${created.manualStaffId}`, `/staffs/${created.manualStaffId}/`] as const] : []),
    ...(created.sessionId ? [[`session ${created.sessionId}`, `/lectures/sessions/${created.sessionId}/`] as const] : []),
    ...(created.lectureId ? [[`lecture ${created.lectureId}`, `/lectures/lectures/${created.lectureId}/`] as const] : []),
    ...(created.messageTemplateId ? [[`message template ${created.messageTemplateId}`, `/messaging/templates/${created.messageTemplateId}/`] as const] : []),
  ]) {
    const residue = await api(request, "GET", path, created.adminAccess);
    if (residue.status !== 404) failures.push(`verify ${label} absent -> ${residue.status}`);
  }
  if (failures.length) throw new Error(`student/parent assessment cleanup failed:\n${failures.join("\n")}`);
}

async function seedAssessment(
  request: APIRequestContext,
  adminAccess: string,
  family: QaFamily,
): Promise<number[]> {
  const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", adminAccess, {
    title: lectureTitle,
    name: "QA평가",
    subject: "수학",
    description: "qa-* student/parent assessment projection",
    start_date: todayKst,
    lecture_time: "수 19:00 ~ 21:00",
    color: "#2563eb",
    chip_label: "QA",
    is_active: true,
  });
  created.lectureId = Number(lecture.id);

  const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", adminAccess, {
    lecture: created.lectureId,
    title: sessionTitle,
    date: todayKst,
    order: 1,
  });
  created.sessionId = Number(session.id);

  const enrollments = await expectApi<Array<{ id: number; student: { id: number } }>>(
    request,
    "POST",
    "/enrollments/bulk_create/",
    adminAccess,
    { lecture: created.lectureId, students: family.students.map((student) => student.id) },
  );
  created.enrollmentIds = enrollments.map((row) => Number(row.id));
  created.primaryEnrollmentId = Number(enrollments.find((row) => Number(row.student.id) === family.students[0].id)?.id);
  expect(created.primaryEnrollmentId).toBeGreaterThan(0);

  const sessionEnrollments = await expectApi<Array<{ id: number }>>(
    request,
    "POST",
    "/enrollments/session-enrollments/bulk_create/",
    adminAccess,
    { session: created.sessionId, enrollments: created.enrollmentIds },
  );
  created.sessionEnrollmentIds = sessionEnrollments.map((row) => Number(row.id));

  const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", adminAccess, {
    title: examTitle,
    description: "qa-* student submit and parent result projection",
    exam_type: "regular",
    session_id: created.sessionId,
    pass_score: 50,
    max_score: 100,
    answer_visibility: "hidden",
    open_at: new Date().toISOString(),
  });
  created.examId = Number(exam.id);

  const questions = await expectApi<Array<{ id: number; number: number }>>(
    request,
    "POST",
    `/exams/${created.examId}/questions/init/`,
    adminAccess,
    { total_questions: 5, default_score: 20 },
  );
  const questionIds = questions
    .sort((left, right) => Number(left.number) - Number(right.number))
    .map((question) => Number(question.id));
  await expectApi(request, "POST", "/exams/answer-keys/", adminAccess, {
    exam: created.examId,
    answers: Object.fromEntries(questionIds.map((id, index) => [String(id), String(index + 1)])),
  });
  await expectApi(
    request,
    "PUT",
    `/exams/${created.examId}/enrollments/?session_id=${created.sessionId}`,
    adminAccess,
    { enrollment_ids: created.enrollmentIds },
    [200],
  );
  return questionIds;
}

async function submitFirstStudentThroughUi(
  page: Page,
  student: QaStudent,
  examId: number,
): Promise<number> {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginThroughUi(page, student.ps_number, student.password);
  await gotoAndSettle(page, `${QA_BASE}/student/dashboard`, { timeout: 30_000 });
  await expect(page.locator("[data-guide='dash-todo']").getByText(examTitle, { exact: true })).toBeVisible();
  await gotoAndSettle(page, `${QA_BASE}/student/exams/${examId}/submit`, { timeout: 30_000 });
  await expect(page.getByText(examTitle)).toBeVisible();
  for (const [number, answer] of [[1, "1"], [2, "4"], [3, "3"], [4, "4"], [5, "1"]] as const) {
    await page.getByLabel(`${number}번 답`).fill(answer);
  }
  await expect(page.getByText("5/5문항 (100%)")).toBeVisible();
  const submitResponse = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).pathname.endsWith(`/api/v1/student/exams/${examId}/submit/`)
  )).then(async (response) => {
    expect(response.status()).toBe(201);
    const id = Number((await response.json() as { submission_id: number }).submission_id);
    if (Number.isInteger(id) && id > 0) created.submissionIds.push(id);
    expect(id).toBeGreaterThan(0);
    return id;
  });
  await page.getByRole("button", { name: "제출하기" }).click();
  await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출" }).click();
  const submissionId = await submitResponse;
  await page.waitForURL(`**/student/exams/${examId}/result`, { timeout: 45_000 });
  const expectSubmittedDashboard = async (navigate: () => Promise<unknown>) => {
    // Consume the browser response before a later reload can discard its body.
    const exams = page.waitForResponse((response) => response.request().method() === "GET"
      && new URL(response.url()).pathname === "/api/v1/student/exams/").then(async (response) => {
      expect(response.status()).toBe(200);
      return await response.json() as ExamsListResponse;
    });
    await navigate();
    const submittedExam = (await exams).items.find((item) => item.id === examId);
    expect(submittedExam).toBeDefined();
    expect(submittedExam!.attempt_count).toBeGreaterThan(0);
    expect(submittedExam!.has_result === true || submittedExam!.submission_pending === true).toBe(true);
    const todo = page.locator("[data-guide='dash-todo']");
    await expect(todo.getByRole("heading", { name: /^(오늘 확인할 일이 있어요|오늘은 급한 일이 없어요)$/ })).toBeVisible();
    // A submitted exam may still require a retest or wrong-answer correction.
    const upcoming = todo.getByRole("link", { name: /^다가오는 시험 / });
    await expect(upcoming.filter({ hasText: examTitle })).toHaveCount(0);
  };
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await expectSubmittedDashboard(() => gotoAndSettle(page, `${QA_BASE}/student/dashboard`, { timeout: 30_000 }));
    await expectSubmittedDashboard(() => reloadStudentApp(page));
    await assertNoHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${QA_BASE}/student/exams/${examId}/result`, { timeout: 30_000 });
  await waitForRenderSettled(page, { timeout: 20_000 });
  await expect(page.getByTestId("wrong-number-chip")).toHaveText(["2", "5"]);
  await assertNoHorizontalOverflow(page);
  return submissionId;
}

test.describe.serial("[real-use] 학생과 학부모의 시험 제출", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  test.beforeAll(() => {
    assertQaStudentParentRuntime();
  });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("390px 학생·학부모 자녀별 제출·결과·reload/relogin·desktop을 완료한다", async ({ page, request }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    created.adminAccess = admin.access;
    created.family = await createQaFamily(request, admin.access, "assessment", 2);
    const [primary, peer] = created.family.students;
    await seedAssessment(request, admin.access, created.family);

    await submitFirstStudentThroughUi(page, primary, created.examId!);
    const primaryTokens = await loginApi(request, primary.ps_number, primary.password);
    const primaryResult = await waitForResult(request, primaryTokens.access, created.examId!);
    expect(primaryResult).toMatchObject({
      total_score: 60,
      analysis: { wrong_count: 2, wrong_question_numbers: [2, 5] },
    });

    await logoutStudentApp(page);
    await loginThroughUi(page, created.family.parentPhone, created.family.parentPassword);
    const parentTokens = await loginApi(request, created.family.parentPhone, created.family.parentPassword);
    await selectParentStudentThroughUi(page, peer);
    await gotoAndSettle(page, `${QA_BASE}/student/exams/${created.examId}/submit`, { timeout: 30_000 });
    await expect(page.getByText(examTitle)).toBeVisible();
    await expect(page.getByText("학부모 계정은 시험을 제출할 수 없습니다.")).toHaveCount(0);
    for (const number of [1, 2, 3, 4, 5]) {
      await page.getByLabel(`${number}번 답`).fill("5");
    }
    const parentSubmitResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith(`/api/v1/student/exams/${created.examId}/submit/`)
    )).then(async (response) => {
      expect(response.status()).toBe(201);
      const id = Number((await response.json() as { submission_id: number }).submission_id);
      if (Number.isInteger(id) && id > 0) created.submissionIds.push(id);
      expect(response.request().headers()["x-student-id"]).toBe(String(peer.id));
      expect(id).toBeGreaterThan(0);
      return id;
    });
    await page.getByRole("button", { name: "제출하기" }).click();
    await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출" }).click();
    const parentSubmissionId = await parentSubmitResponse;
    await page.waitForURL(`**/student/exams/${created.examId}/result`, { timeout: 45_000 });
    await expect(page.getByTestId("wrong-number-chip")).toHaveText(["1", "2", "3", "4"]);
    expect(await waitForResult(request, parentTokens.access, created.examId!, peer.id)).toMatchObject({
      total_score: 20,
      analysis: { wrong_count: 4 },
    });
    const teacherProjection = await expectApi<{
      user: number;
      target_type: string;
      target_id: number;
      meta: { submitted_by_user_id?: number };
    }>(request, "GET", `/submissions/submissions/${parentSubmissionId}/`, admin.access);
    expect(teacherProjection).toMatchObject({
      target_type: "exam",
      target_id: created.examId,
    });
    expect(teacherProjection.user).toBeGreaterThan(0);
    expect(teacherProjection.meta.submitted_by_user_id).toBeGreaterThan(0);
    expect(teacherProjection.meta.submitted_by_user_id).not.toBe(teacherProjection.user);

    await reloadStudentApp(page);
    await expect(page.getByRole("tab", { name: peer.name })).toHaveAttribute("aria-selected", "true");

    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    await expect(page.getByRole("link").filter({ hasText: examTitle }).first()).toBeVisible();
    await selectParentStudentThroughUi(page, primary);
    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    const firstCard = page.getByRole("link").filter({ hasText: examTitle }).first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.getByTestId("grade-wrong-summary")).toContainText("오답 2문항");
    await expect(firstCard.getByText("1/2등")).toBeVisible();
    expect(await waitForResult(request, parentTokens.access, created.examId!, primary.id)).toMatchObject({
      total_score: 60,
      rank: 1,
      cohort_size: 2,
      analysis: { wrong_question_numbers: [2, 5] },
    });
    await gotoAndSettle(page, `${QA_BASE}/student/notifications`, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "새 성적" })).toBeVisible();
    await expect(page.getByText(examTitle, { exact: true })).toBeVisible();

    await reloadStudentApp(page);
    await expect(page.getByRole("tab", { name: primary.name })).toHaveAttribute("aria-selected", "true");
    await logoutStudentApp(page);
    await loginThroughUi(page, created.family.parentPhone, created.family.parentPassword);
    await expect(page.getByRole("tab", { name: primary.name })).toHaveAttribute("aria-selected", "true");

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    await expect(page.getByRole("link").filter({ hasText: examTitle }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await verifyScoreMessageTemplate(page, request, admin, primary);
    await verifyManualScorePrecision(page, request, admin, primary, primaryTokens, parentTokens);
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});

async function verifyManualScorePrecision(
  parentPage: Page,
  request: APIRequestContext,
  admin: QaTokens,
  student: QaStudent,
  studentTokens: QaTokens,
  parentTokens: QaTokens,
): Promise<void> {
  const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
    title: manualExamTitle, description: "qa-* exact manual score precision",
    exam_type: "regular", session_id: created.sessionId,
    grading_mode: "written", manual_grading_method: "score",
    max_score: 100, pass_score: 50, answer_visibility: "hidden",
  }, [201]);
  created.manualExamId = Number(exam.id);
  const questions = await expectApi<Array<{ id: number; number: number; score: number }>>(
    request, "POST", `/exams/${exam.id}/questions/init/`, admin.access,
    { total_questions: 6, question_types: Array(6).fill("essay"), default_score: 100 / 6 },
  );
  expect(questions).toHaveLength(6);
  for (const question of questions) expect(question.score).toBe(100 / 6);
  await expectApi(request, "PUT", `/exams/${exam.id}/enrollments/?session_id=${created.sessionId}`, admin.access,
    { enrollment_ids: [created.primaryEnrollmentId] }, [200]);

  const username = `qa-score-assistant-${runStamp}`;
  const staff = await expectApi<{ id: number }>(request, "POST", "/staffs/", admin.access, {
    name: `QA 점수 조교 ${runStamp}`, role: "ASSISTANT", username,
    password: student.password, is_manager: false,
  }, [201]);
  created.manualStaffId = Number(staff.id);
  const staffTokens = await loginApi(request, username, student.password);
  const identity = await expectApi<{ tenantRole: string }>(request, "GET", "/core/me/", staffTokens.access);
  expect(identity.tenantRole).toBe("staff");
  const context = await parentPage.context().browser()!.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const scoresPath = `/results/admin/sessions/${created.sessionId}/scores/`;
  const manualPath = `/results/admin/exams/${exam.id}/manual-grading/`;
  const openSheet = async (width: number) => {
    await page.setViewportSize({ width, height: 900 });
    const ready = page.waitForResponse((response) => response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/v1${scoresPath}`).then(async (response) => {
      expect(response.status()).toBe(200);
      return await response.json() as { meta: { exams: Array<{ exam_id: number }> } };
    });
    await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`, { timeout: 30_000 });
    expect((await ready).meta.exams.some((item) => item.exam_id === exam.id)).toBe(true);
    await page.getByRole("button", { name: `${manualExamTitle} 작업 선택`, exact: true }).click();
    await page.getByRole("menu", { name: `${manualExamTitle} 작업 선택`, exact: true })
      .getByRole("menuitem", { name: /^문항별 점수 입력/ }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: `${manualExamTitle} 문항별 점수 입력` });
    await expect(dialog.locator("input[data-manual-grade-cell]")).toHaveCount(6);
    await dialog.getByRole("combobox", { name: "채점표 배율 선택" }).selectOption(width === 390 ? "50" : "100");
    return dialog;
  };
  try {
    await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`, { timeout: 45_000 });
    await page.getByTestId("login-username").fill(username);
    await page.getByTestId("login-password").fill(student.password);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(page);
    const clockIn = page.getByRole("dialog", { name: "오늘 어떤 방식으로 시작할까요?", exact: true });
    await expect(clockIn).toBeVisible();
    await clockIn.getByRole("button", { name: /^출근하지 않고 로그인/ }).click();
    await expect(clockIn).toBeHidden();
    for (const width of [1366, 390]) {
      let dialog = await openSheet(width);
      const expectedMaximum = width === 390 ? 16.6667 : 100 / 6;
      const weights = dialog.getByRole("spinbutton", { name: /^\d+번 배점$/ });
      const cells = dialog.locator("input[data-manual-grade-cell]");
      for (let index = 0; index < 6; index += 1) {
        const maximum = await weights.nth(index).inputValue();
        expect(Number(maximum)).toBe(100 / 6);
        if (width === 390) await weights.nth(index).fill(String(expectedMaximum));
        await cells.nth(index).fill(width === 390 && index === 0 ? "0" : String(expectedMaximum));
      }
      await dialog.getByRole("button", { name: "입력 내용 확인", exact: true }).click();
      await expect(dialog.getByText("1명 · 결시 0명 · 성적 계산 완료", { exact: true })).toBeVisible();
      const saved = page.waitForResponse((response) => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/v1${manualPath}`
        && response.request().postDataJSON()?.apply === true).then(async (response) => {
        expect(response.status()).toBe(200);
        const payload = response.request().postDataJSON() as {
          question_scores?: Record<string, number>;
          expected_question_scores?: Record<string, number>;
          rows: Array<{ enrollment_id: number; cells: Record<string, { score: number }> }>;
        };
        expect(payload.rows).toHaveLength(1);
        expect(payload.rows[0].enrollment_id).toBe(created.primaryEnrollmentId);
        for (const question of questions) {
          expect(payload.rows[0].cells[String(question.id)].score).toBe(width === 390 && question.number === 1 ? 0 : expectedMaximum);
        }
        if (width === 390) {
          expect(payload.question_scores).toEqual(Object.fromEntries(questions.map((question) => [String(question.id), 16.6667])));
          expect(payload.expected_question_scores).toEqual(Object.fromEntries(questions.map((question) => [String(question.id), 100 / 6])));
        } else expect(payload).not.toHaveProperty("question_scores");
        return await response.json() as { applied: boolean; rows: Array<{ total_score: number }> };
      });
      await dialog.getByRole("button", { name: "1명 성적 확정", exact: true }).click();
      const result = await saved;
      // The manual-grading service rounds the sum to two decimal places.
      const expectedTotal = width === 390 ? 83.33 : 100;
      expect(result.applied).toBe(true);
      expect(result.rows[0].total_score).toBe(expectedTotal);
      await expect(dialog.getByText("현재 저장된 성적 기준", { exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "닫기", exact: true }).click();
      dialog = await openSheet(width);
      for (let index = 0; index < 6; index += 1) {
        await expect(dialog.locator("input[data-manual-grade-cell]").nth(index))
          .toHaveValue(width === 390 && index === 0 ? "0" : String(expectedMaximum));
        await expect(dialog.getByRole("spinbutton", { name: /^\d+번 배점$/ }).nth(index)).toHaveValue(String(expectedMaximum));
      }
      const persisted = await expectApi<ManualGradeSheet>(request, "GET", manualPath, staffTokens.access);
      expect(persisted.questions.map((question) => question.max_score)).toEqual(Array(6).fill(expectedMaximum));
      expect((await waitForResult(request, studentTokens.access, exam.id)).total_score).toBe(expectedTotal);
      expect((await waitForResult(request, parentTokens.access, exam.id, student.id)).total_score).toBe(expectedTotal);
      await assertNoHorizontalOverflow(page);
      await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    }
    await gotoAndSettle(parentPage, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    const parentCard = parentPage.getByRole("link").filter({ hasText: manualExamTitle }).first();
    await expect(parentCard).toBeVisible();
    await expect(parentCard).toContainText(/83\.3/);
    boundary.assertClean();
    guards.assertZeroDefects();
  } finally {
    await context.close();
  }
}

async function verifyScoreMessageTemplate(
  parentPage: Page,
  request: APIRequestContext,
  admin: QaTokens,
  student: QaStudent,
): Promise<void> {
  const context = await parentPage.context().browser()!.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const templateName = `qa-message-editor-${runStamp}`;
  try {
    await seedBrowserAuth(page, admin);
    await gotoAndSettle(page, `${QA_BASE}/workspace/message/templates`, { timeout: 30_000 });
    await page.getByRole("navigation", { name: "문구 카테고리" }).getByRole("button", { name: "성적", exact: true }).click();
    await page.getByRole("button", { name: "새 문구", exact: true }).click();
    const creation = page.getByRole("dialog", { name: "문구 추가", exact: true });
    await creation.getByPlaceholder("예: 출석 안내, 시험 일정 공지").fill(templateName);
    const body = creation.getByRole("textbox", { name: "안내문" });
    await body.fill("학생 #{학생이름3} 점수 ");
    await body.press("Control+End");
    await creation.getByRole("button", { name: "시험 총점", exact: true }).click();
    await expect(body.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
    await body.press("Control+z");
    await expect(body.locator('[data-message-variable="시험총점"]')).toHaveCount(0);
    await creation.getByRole("button", { name: "다시 실행", exact: true }).click();
    await expect(body.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
    const creationResponse = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/messaging/templates/"));
    await creation.getByRole("button", { name: "저장", exact: true }).click();
    const savedResponse = await creationResponse;
    const saved = await savedResponse.json() as { id: number; body: string };
    if (Number.isInteger(saved.id) && saved.id > 0) created.messageTemplateId = saved.id;
    expect(savedResponse.status()).toBe(201);
    expect(saved.body).toBe("학생 #{학생이름3} 점수 #{시험총점}");
    await expect(creation).toBeHidden();
    // Crossing the admin layout breakpoint remounts the page; reopen the saved draft after resizing.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("navigation", { name: "문구 카테고리" }).getByRole("button", { name: "성적", exact: true }).click();
    await page.getByLabel("저장 문구 검색").fill(templateName);
    await page.getByRole("button", { name: "수정", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "문구 수정", exact: true });
    const editor = edit.getByRole("textbox", { name: "안내문" });
    await expect(editor.locator('[data-message-variable="학생이름3"]')).toHaveAttribute("contenteditable", "false");
    await expect(editor.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
    await editor.click();
    await editor.press("Control+End");
    await page.keyboard.insertText(" 확인 완료");
    await assertNoHorizontalOverflow(page);
    await edit.getByRole("button", { name: "수정", exact: true }).click();
    await expect(edit).toBeHidden();
    const persisted = await expectApi<{ body: string }>(request, "GET", `/messaging/templates/${saved.id}/`, admin.access);
    expect(persisted.body).toBe("학생 #{학생이름3} 점수 #{시험총점} 확인 완료");

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`, { timeout: 30_000 });
    await page.getByRole("checkbox", { name: `${student.name} 선택`, exact: true }).check();
    await page.getByRole("button", { name: "수업결과 알림톡 발송", exact: true }).click();
    const send = page.getByRole("dialog", { name: "알림톡 발송" });
    // This family fixture has parent phones only. Verify the normal authorized recipient journey.
    await send.getByRole("checkbox", { name: "학생", exact: true }).uncheck();
    await send.getByRole("checkbox", { name: "학부모", exact: true }).check();
    await send.getByRole("button", { name: /문구 변경|문구 선택/, exact: true }).click();
    const picker = page.getByRole("dialog").filter({ has: page.locator(".tpl-picker__layout") });
    await picker.getByRole("button", { name: new RegExp(templateName) }).click();
    await expect(picker.locator(".template-preview-kakao__body")).toContainText(`학생 ${student.name} 점수 60 확인 완료`);
    // Start the response timer at the action that selects this non-default template.
    const preflightResponse = page.waitForResponse((response) => {
      if (response.request().method() !== "POST"
        || !new URL(response.url()).pathname.endsWith("/api/v1/messaging/send/preflight/")) return false;
      const payload = response.request().postDataJSON() as {
        send_to?: string;
        template_id?: number;
        alimtalk_extra_vars_per_student?: Record<string, { _body_subst?: string }>;
      };
      return payload.send_to === "parent" && payload.template_id === saved.id
        && payload.alimtalk_extra_vars_per_student?.[String(student.id)]?._body_subst
          === `학생 ${student.name} 점수 60 확인 완료`;
    });
    await picker.getByRole("button", { name: "이 문구로 작성하기", exact: true }).click();
    await expect(picker).toBeHidden();
    await expect(send.locator(".send-modal__card--preview")).toContainText(student.name);
    const checkedResponse = await preflightResponse;
    expect(checkedResponse.status()).toBe(200);
    const checked = await checkedResponse.json() as SendPreflightResponse;
    expect(checked).toMatchObject({
      ok: true,
      can_send: true,
      send_to: "parent",
      recipient: { selected: 1, resolved: 1, valid_phone: 1, unique_phone: 1, skipped_no_phone: 0, invalid_or_deleted: 0 },
      template: { ok: true, source: "unified", solapi_status: "APPROVED", template_type: "score" },
      blockers: [],
    });
    expect(checked.preview_recipients).toHaveLength(1);
    expect(checked.preview_recipients[0]).toMatchObject({ student_id: student.id, excluded: false });
    expect(checked.preview_recipients[0].full_message_body).toContain(`학생 ${student.name} 점수 60 확인 완료`);
    await expect(send.locator(".send-modal__send-btn")).toBeEnabled();
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    guards.assertZeroDefects();
  } finally {
    await context.close();
    if (created.messageTemplateId) {
      const id = created.messageTemplateId;
      await expectApi(request, "DELETE", `/messaging/templates/${id}/`, admin.access, undefined, [204]);
      const residue = await api(request, "GET", `/messaging/templates/${id}/`, admin.access);
      expect(residue.status).toBe(404);
      created.messageTemplateId = undefined;
    }
  }
}
