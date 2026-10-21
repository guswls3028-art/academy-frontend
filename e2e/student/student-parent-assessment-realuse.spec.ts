/**
 * Student submission -> persisted result -> parent selected-child projection.
 * Runs only in the disposable production-shaped development tenant.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page, Route, TestInfo } from "@playwright/test";
import type { SendPreflightResponse } from "../../src/app_admin/domains/messages/api/messages.api";
import type { ManualGradeSheet } from "../../src/app_admin/domains/results/api/manualExamGrading";
import type { ExamsListResponse } from "../../src/app_student/domains/exams/api/exams.api";
import type { MyGradesSummary } from "../../src/app_student/domains/grades/api/grades.api";
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
import { verifyAssessmentCopy } from "../helpers/verifyAssessmentCopy";
import { verifySubmissionInbox } from "../helpers/verifySubmissionInbox";

// This scenario now spans submission, feedback, templates, grading, copy and
// attendance journeys. Budget the combined flow without relaxing any individual
// action, navigation, API or assertion deadline.
test.setTimeout(540_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type CreatedState = {
  family: QaFamily | null;
  otherFamily: QaFamily | null;
  adminAccess: string;
  lectureId?: number;
  sessionId?: number;
  examId?: number;
  manualExamId?: number;
  manualStaffId?: number;
  primaryEnrollmentId?: number;
  enrollmentIds: number[];
  sessionEnrollmentIds: number[];
  attendanceIds: number[];
  copySessionIds: number[];
  submissionIds: number[];
  messageTemplateId?: number;
  messageTemplateRetryIds: number[];
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
  otherFamily: null,
  adminAccess: "",
  enrollmentIds: [],
  sessionEnrollmentIds: [],
  attendanceIds: [],
  copySessionIds: [],
  submissionIds: [],
  messageTemplateRetryIds: [],
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
  for (const id of created.messageTemplateRetryIds) {
    await remove("DELETE", `/messaging/templates/${id}/`);
  }
  if (created.examId && created.sessionId) {
    await remove("DELETE", `/exams/${created.examId}/?session_id=${created.sessionId}`);
  }
  if (created.manualExamId && created.sessionId) {
    await remove("DELETE", `/exams/${created.manualExamId}/?session_id=${created.sessionId}`);
  }
  // Staff deletion deactivates tenant access; the outer owned-tenant cleanup proves User zero.
  if (created.manualStaffId) await remove("DELETE", `/staffs/${created.manualStaffId}/`);
  for (const id of created.attendanceIds) await remove("DELETE", `/lectures/attendance/${id}/`);
  for (const id of created.sessionEnrollmentIds) {
    await remove("DELETE", `/enrollments/session-enrollments/${id}/`);
  }
  for (const id of created.enrollmentIds) {
    await remove("DELETE", `/enrollments/${id}/`);
  }
  for (const id of created.copySessionIds) {
    await remove("DELETE", `/lectures/sessions/${id}/`);
  }
  if (created.sessionId) await remove("DELETE", `/lectures/sessions/${created.sessionId}/`);
  if (created.lectureId) await remove("DELETE", `/lectures/lectures/${created.lectureId}/`);

  for (const family of [created.otherFamily, created.family]) {
    try {
      await cleanupQaFamily(request, created.adminAccess, family);
    } catch (error) {
      failures.push(`family ${family?.scenarioKey} cleanup -> ${String(error)}`);
    }
  }
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
    ...created.copySessionIds.map((id) => [`copy session ${id}`, `/lectures/sessions/${id}/`] as const),
    ...(created.lectureId ? [[`lecture ${created.lectureId}`, `/lectures/lectures/${created.lectureId}/`] as const] : []),
    ...(created.messageTemplateId ? [[`message template ${created.messageTemplateId}`, `/messaging/templates/${created.messageTemplateId}/`] as const] : []),
    ...created.messageTemplateRetryIds.map(id => [`retry message template ${id}`, `/messaging/templates/${id}/`] as const),
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
    await expect(todo.getByRole("heading", { name: /^(확인할 일이 있어요|오늘은 급한 일이 없어요)$/ })).toBeVisible();
    // A submitted exam may still require a retest or wrong-answer correction.
    const upcoming = todo.getByRole("link", { name: /^확인할 시험 / });
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
  await expect(page.getByTestId("wrong-number-chip")).toHaveText(["2번", "5번"]);
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

  test("390px 학생·학부모 자녀별 제출·결과·reload/relogin·desktop을 완료한다", async ({ page, request }, testInfo) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    created.adminAccess = admin.access;
    created.family = await createQaFamily(request, admin.access, "assessment", 2);
    const [primary, peer] = created.family.students;
    await seedAssessment(request, admin.access, created.family);

    await test.step("student submission and persisted result", () => submitFirstStudentThroughUi(page, primary, created.examId!));
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
    await expect(page.getByTestId("wrong-number-chip")).toHaveText(["1번", "2번", "3번", "4번"]);
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
    await test.step("teacher submission inbox", () => verifySubmissionInbox(page, request, admin, parentSubmissionId));

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
    await test.step("parent-only assessment feedback", () => verifyAssessmentFeedback(page, request, admin, primary, peer, primaryTokens, parentTokens, testInfo));
    await test.step("score message template and defaults", () => verifyScoreMessageTemplate(page, request, admin, primary, testInfo));
    await test.step("manual score precision and retake totals", () => verifyManualScorePrecision(page, request, admin, primary, primaryTokens, parentTokens));
    await test.step("exam order and total-boundary persistence", () => verifyExamOrderPersistence(page, request, admin, parentTokens, testInfo));
    await test.step("assessment copy", () => verifyAssessmentCopy(page, request, admin, primaryTokens, {
      lectureId: created.lectureId!, sessionId: created.sessionId!, examId: created.examId!,
      examTitle, enrollmentIds: created.enrollmentIds, date: todayKst,
    }, (sessionId) => { created.copySessionIds.push(sessionId); }));
    await test.step("attendance priority and absent scores", () => verifyAttendancePriorityAndAbsentScores(page, request, admin, created.family!, testInfo));
    await test.step("ended-course todos and restored eligibility", () => verifyEndedCourseTodos(page, request, admin, primary, primaryTokens));
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});

async function verifyAttendancePriorityAndAbsentScores(
  parentPage: Page, request: APIRequestContext, admin: QaTokens, family: QaFamily, testInfo: TestInfo,
): Promise<void> {
  const [present, absent] = family.students;
  for (const [student, status] of [[present, "PRESENT"], [absent, "ABSENT"]] as const) {
    const rows = await expectApi<Array<{ id: number }>>(
      request, "POST", "/lectures/attendance/bulk_create/", admin.access,
      { session: created.sessionId, students: [student.id] }, [201],
    );
    expect(rows).toHaveLength(1);
    created.attendanceIds.push(rows[0].id);
    await expectApi(request, "PATCH", `/lectures/attendance/${rows[0].id}/`, admin.access, { status });
  }
  const context = await parentPage.context().browser()!.newContext({ serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    await seedBrowserAuth(page, admin);
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/attendance`);
      const links = page.locator('tbody a[aria-label$=" 학생 상세 열기"]');
      const priority = page.getByRole("button", { name: "미도착 우선", exact: true });
      await expect(links.first()).toHaveAttribute("aria-label", `${present.name} 학생 상세 열기`);
      await priority.click();
      await expect(priority).toHaveAttribute("aria-pressed", "true");
      await expect(links.first()).toHaveAttribute("aria-label", `${absent.name} 학생 상세 열기`);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(priority).toHaveAttribute("aria-pressed", "true");
      await expect(links.first()).toHaveAttribute("aria-label", `${absent.name} 학생 상세 열기`);
      await links.first().scrollIntoViewIfNeeded();
      await assertNoHorizontalOverflow(page);
      await testInfo.attach(`attendance-priority-realuse-${width}`, {
        body: await page.screenshot({ fullPage: true }), contentType: "image/png",
      });
      await priority.click();
      await expect(links.first()).toHaveAttribute("aria-label", `${present.name} 학생 상세 열기`);

      await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`);
      const summary = page.getByRole("group", { name: "마지막 열 표시" });
      if (!(await summary.isVisible())) await page.getByRole("button", { name: /표시 옵션/ }).click();
      await summary.getByRole("button", { name: "테스트 오답", exact: true }).click();
      const row = page.locator("tbody tr").filter({ hasText: absent.name });
      await expect(row).toBeVisible();
      await expect(page.getByRole("group", { name: "테스트 오답 확인 학생 필터" })
        .getByRole("button", { name: "전체 2명" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('td[data-col-type="exam-review"]')).toHaveCount(2);
      await expect(row.getByRole("checkbox", { name: `${absent.name} 선택`, exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "현재 결과 선택", exact: true }).click();
      await expect(page.getByRole("checkbox", { name: `${present.name} 선택`, exact: true })).toBeChecked();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(row).toBeVisible();
      await expect(page.locator('td[data-col-type="exam-review"]')).toHaveCount(2);
      await row.scrollIntoViewIfNeeded();
      await assertNoHorizontalOverflow(page);
      await testInfo.attach(`absent-score-review-realuse-${width}`, {
        body: await page.screenshot({ fullPage: true }), contentType: "image/png",
      });
    }
    boundary.assertClean();
    browser.assertZeroDefects();
  } finally {
    await context.close();
  }
}

async function verifyEndedCourseTodos(
  page: Page, request: APIRequestContext, admin: QaTokens, student: QaStudent, studentTokens: QaTokens,
): Promise<void> {
  const before = await expectApi<MyGradesSummary>(request, "GET", "/student/grades/", studentTokens.access);
  const original = before.exams.find((exam) => exam.exam_id === created.examId);
  expect(original?.learning_todo_eligible).toBe(true);
  const yesterday = new Date(Date.parse(`${todayKst}T12:00:00+09:00`) - 86_400_000).toISOString().slice(0, 10);
  await expectApi(request, "PATCH", `/lectures/lectures/${created.lectureId}/`, admin.access, {
    start_date: yesterday, end_date: yesterday, is_active: true,
  }, [200]);
  const ended = await expectApi<MyGradesSummary>(request, "GET", "/student/grades/", studentTokens.access);
  expect(ended.exams.find((exam) => exam.exam_id === created.examId)).toMatchObject({
    lecture_active: false, learning_todo_eligible: false, total_score: original!.total_score,
  });
  const upcoming = await expectApi<ExamsListResponse>(request, "GET", "/student/exams/?include_upcoming=true", studentTokens.access);
  expect(upcoming.items.some((exam) => exam.id === created.examId)).toBe(false);
  for (const role of ["parent", "student"] as const) {
    if (role === "student") {
      await logoutStudentApp(page);
      await loginThroughUi(page, student.ps_number, student.password);
    }
    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/student/dashboard`, { timeout: 30_000 });
      await reloadStudentApp(page);
      const summary = role === "student" ? page.locator("[data-guide='dash-todo']") : page.getByRole("region", { name: "우리 아이 요약" });
      await expect(summary.getByText("정리됨", { exact: true })).toBeVisible();
      await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
      await page.locator("summary").filter({ hasText: "종료된 강의" }).click();
      await expect(page.getByRole("link").filter({ hasText: examTitle }).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  }
  // End date is inclusive: restore today's boundary and verify persisted eligibility again.
  await expectApi(request, "PATCH", `/lectures/lectures/${created.lectureId}/`, admin.access, { end_date: todayKst }, [200]);
  const restored = await expectApi<MyGradesSummary>(request, "GET", "/student/grades/", studentTokens.access);
  expect(restored.exams.find((exam) => exam.exam_id === created.examId)).toMatchObject({
    lecture_active: true, learning_todo_eligible: true, total_score: original!.total_score,
  });
}

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

/** Real server order persistence; restore the existing selection before later copy/attendance checks. */
async function verifyExamOrderPersistence(parentPage: Page, request: APIRequestContext, admin: QaTokens, parentTokens: QaTokens, testInfo: TestInfo): Promise<void> {
  const context = await parentPage.context().browser()!.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const configPath = `/results/admin/sessions/${created.sessionId}/total-config/`;
  const scoresPath = `/results/admin/sessions/${created.sessionId}/scores/`;
  type Config = { exam_ids: number[]; exam_order: number[] };
  const original = await expectApi<Config>(request, "GET", configPath, admin.access);
  expect(original.exam_order).toEqual([created.examId, created.manualExamId]);
  expect(original.exam_ids).toEqual([created.examId]);
  const openTotals = async () => {
    await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
    return page.getByRole("dialog", { name: "합산 설정", exact: true });
  };
  const save = async (modal: ReturnType<Page["getByRole"]>) => {
    await modal.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(modal).toBeHidden();
  };
  const verify = async (order: number[], selected: number[]) => {
    await expect.poll(() => page.locator('[data-testid^="score-column-order-exam-"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-column-id"))))).toEqual(order);
    const config = await expectApi<Config>(request, "GET", configPath, admin.access);
    expect(config.exam_order).toEqual(order);
    expect(config.exam_ids).toEqual(selected);
    const scores = await expectApi<{ meta: { exams: Array<{ exam_id: number }> } }>(request, "GET", scoresPath, admin.access);
    expect(scores.meta.exams.map(exam => exam.exam_id)).toEqual(order);
  };
  const verifyParentTotal = async (score: number | null, maximum: number, selectedCount: number) => {
    const response = await request.get(`${QA_API}/api/v1/student/grades/`, {
      headers: { Authorization: `Bearer ${parentTokens.access}`, "X-Tenant-Code": QA_TENANT, "X-Student-Id": String(created.family!.students[0].id) },
    });
    expect(response.status()).toBe(200);
    const grades = await response.json() as MyGradesSummary;
    expect(grades.session_totals?.find(item => item.session_id === created.sessionId)?.exam_total)
      .toMatchObject({ score, max_score: maximum, selected_count: selectedCount });
    await gotoAndSettle(parentPage, `${QA_BASE}/student/grades`);
    const section = parentPage.locator(`section[aria-label="${lectureTitle} ${sessionTitle} 총점"]`);
    if (selectedCount) {
      const disclosure = parentPage.locator("details").filter({ has: section });
      if (!await disclosure.evaluate(node => (node as HTMLDetailsElement).open)) await disclosure.locator("summary").click();
      await expect(section).toContainText(`${score} / ${maximum}`);
    } else {
      await expect(section).toHaveCount(0);
    }
  };
  try {
    await seedBrowserAuth(page, admin);
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await parentPage.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`);
      await verify(original.exam_order, original.exam_ids);
      await verifyParentTotal(60, 100, 1);
      // Start with the second exam excluded: this move must cross the rendered
      // total boundary and change both the saved order and included assessment set.
      if (width === 1366) {
        await page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${manualExamTitle} 작업 선택`, exact: true }) }).dragTo(page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${examTitle} 작업 선택`, exact: true }) }));
      } else await page.getByRole("button", { name: `${manualExamTitle} 이전 순서로 이동`, exact: true }).click();
      const reversed = [created.manualExamId!, created.examId!];
      await verify(reversed, reversed);
      await page.reload();
      await verify(reversed, reversed);
      await verifyParentTotal(143.33, 200, 2);
      const rosterWarning = page.getByRole("region", { name: "응시·제출 대상 미배정 안내", exact: true });
      const assignAll = rosterWarning.getByRole("button", { name: "누락 전부 배정", exact: true });
      await expect(assignAll).toBeVisible();
      const warningBounds = await rosterWarning.boundingBox();
      const buttonBounds = await assignAll.boundingBox();
      expect(warningBounds).not.toBeNull();
      expect(buttonBounds).not.toBeNull();
      expect(buttonBounds!.x).toBeGreaterThanOrEqual(warningBounds!.x);
      expect(buttonBounds!.x + buttonBounds!.width).toBeLessThanOrEqual(warningBounds!.x + warningBounds!.width);
      await page.getByRole("button", { name: `${manualExamTitle} 작업 선택`, exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`real-exam-order-${width}.png`), animations: "disabled" });
      // Reverse the same UI move, then restore the exact original sum boundary.
      if (width === 1366) {
        await page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${examTitle} 작업 선택`, exact: true }) }).dragTo(page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${manualExamTitle} 작업 선택`, exact: true }) }));
      } else await page.getByRole("button", { name: `${examTitle} 이전 순서로 이동`, exact: true }).click();
      await verify(original.exam_order, original.exam_order);
      const restore = await openTotals();
      for (let index = original.exam_ids.length; index < 2; index++) await restore.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
      await save(restore);
      await verify(original.exam_order, original.exam_ids);
      // Moving the included exam past an excluded one crosses the boundary in
      // the other direction; neither score may remain in the displayed total.
      if (width === 1366) {
        await page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${examTitle} 작업 선택`, exact: true }) }).dragTo(page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${manualExamTitle} 작업 선택`, exact: true }) }));
      } else await page.getByRole("button", { name: `${examTitle} 다음 순서로 이동`, exact: true }).click();
      await verify(reversed, []);
      await page.reload();
      await verify(reversed, []);
      await verifyParentTotal(null, 0, 0);
      if (width === 1366) {
        await page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${manualExamTitle} 작업 선택`, exact: true }) }).dragTo(page.locator(".scores-col-drag-handle").filter({ has: page.getByRole("button", { name: `${examTitle} 작업 선택`, exact: true }) }));
      } else await page.getByRole("button", { name: `${manualExamTitle} 다음 순서로 이동`, exact: true }).click();
      await verify(original.exam_order, []);
      const finalRestore = await openTotals();
      await finalRestore.getByRole("button", { name: "시험 총점 아래로 이동", exact: true }).click();
      await save(finalRestore);
      await page.reload();
      await verify(original.exam_order, original.exam_ids);
      await verifyParentTotal(60, 100, 1);
      await assertNoHorizontalOverflow(page);
    }
    boundary.assertClean(); guards.assertZeroDefects();
  } finally { await context.close(); }
}

async function verifyScoreMessageTemplate(
  parentPage: Page,
  request: APIRequestContext,
  admin: QaTokens,
  student: QaStudent,
  testInfo: TestInfo,
): Promise<void> {
  const context = await parentPage.context().browser()!.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const templateName = `qa-message-editor-${runStamp}`;
  let previousDefaultId: number | undefined;
  try {
    const currentLesson = await expectApi<{ title: string; date: string; section: number | null }>(
      request, "GET", `/lectures/sessions/${created.sessionId}/`, admin.access,
    );
    const dateAfter = (days: number) => {
      const date = new Date(`${currentLesson.date}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    // Unrelated titles and nonconsecutive lesson numbers must resolve through
    // actual same-lecture/section rows, not title/lesson-number arithmetic.
    const futureLessons = [
      { title: `QA 탐구 마무리 ${runStamp}`, date: dateAfter(7), regular_order: 1001 },
      { title: `QA 기초 연결 ${runStamp}`, date: dateAfter(14), regular_order: 2001 },
    ];
    for (const lesson of futureLessons) {
      const future = await expectApi<{ id: number; regular_order: number; title: string; date: string }>(request, "POST", "/lectures/sessions/", admin.access, {
        lecture: created.lectureId, section: currentLesson.section, ...lesson,
      });
      // Existing scenario cleanup deletes these exact rows before lecture cleanup.
      created.copySessionIds.push(future.id);
      expect(future).toMatchObject(lesson);
    }
    const previous = await expectApi<Array<{ id: number; category: string; is_user_default: boolean; is_system: boolean }>>(request, "GET", "/messaging/templates/?category=grades", admin.access);
    previousDefaultId = previous.find(item => item.category === "grades" && item.is_user_default && !item.is_system)?.id;
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
    await send.getByRole("button", { name: "안내문 바꾸기", exact: true }).click();
    const picker = page.getByRole("dialog").filter({ has: page.locator(".tpl-picker__layout") });
    await picker.getByRole("button", { name: new RegExp(templateName) }).click();
    await expect(picker.getByLabel("선택할 안내문 내용"))
      .toContainText("학생 #{학생이름3} 점수 #{시험총점} 확인 완료");
    await expect(picker.getByLabel("카카오톡 실제 발송 미리보기")).toHaveCount(0);
    // Consume both promises immediately: a payload mismatch must fail explicitly,
    // rather than hiding behind an unhandled response-wait timeout.
    const [checkedResponse] = await Promise.all([
      page.waitForResponse((response) => {
        if (response.request().method() !== "POST"
          || !new URL(response.url()).pathname.endsWith("/api/v1/messaging/send/preflight/")) return false;
        const payload = response.request().postDataJSON() as { send_to?: string; template_id?: number };
        return payload.send_to === "parent" && payload.template_id === saved.id;
      }).then(response => {
        const payload = response.request().postDataJSON() as {
          raw_body?: string;
          alimtalk_extra_vars_per_student?: Record<string, { _body_subst?: string }>;
        };
        expect(payload.raw_body).toBe("학생 #{학생이름3} 점수 #{시험총점} 확인 완료");
        expect(payload.alimtalk_extra_vars_per_student?.[String(student.id)]?._body_subst)
          .toBe(`학생 ${student.name} 점수 60 확인 완료`);
        return response;
      }),
      (async () => {
        await picker.getByRole("button", { name: "이 안내문 적용", exact: true }).click();
        await expect(picker).toBeHidden();
        await expect(send.getByLabel("현재 학생의 실제 발송 문구"))
          .toContainText(`학생 ${student.name} 점수 60 확인 완료`);
      })(),
    ]);
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
    const draft = send.getByRole("textbox", { name: "안내문", exact: true });
    const lessonBody = [
      "학생 #{학생이름3} 점수 #{시험총점} 확인 완료",
      "현재 수업 #{현재차시명} · 수업 날짜 #{현재차시날짜}",
      "다음 수업 #{다음차시명} · 수업 날짜 #{다음차시날짜}",
      "두 차시 뒤 수업 #{2차시후명} · 수업 날짜 #{2차시후날짜}",
      "발송 날짜 #{날짜}",
    ].join("\n");
    const lessonPreflight = page.waitForResponse(response => {
      if (response.request().method() !== "POST"
        || !new URL(response.url()).pathname.endsWith("/api/v1/messaging/send/preflight/")) return false;
      const payload = response.request().postDataJSON() as { session_id?: number; send_to?: string; raw_body?: string };
      return payload.session_id === created.sessionId && payload.send_to === "parent" && payload.raw_body === lessonBody;
    });
    await draft.fill(lessonBody);
    const lessonResponse = await lessonPreflight;
    expect(lessonResponse.status()).toBe(200);
    const resolvedLessons = await lessonResponse.json() as SendPreflightResponse;
    expect(resolvedLessons).toMatchObject({ ok: true, can_send: true, blockers: [] });
    const expectedLessonLines = [
      `현재 수업 ${currentLesson.title} · 수업 날짜 ${currentLesson.date}`,
      `다음 수업 ${futureLessons[0].title} · 수업 날짜 ${futureLessons[0].date}`,
      `두 차시 뒤 수업 ${futureLessons[1].title} · 수업 날짜 ${futureLessons[1].date}`,
    ];
    const recipient = resolvedLessons.preview_recipients.find(item => item.student_id === student.id);
    expect(recipient).toBeDefined();
    const actualMessage = send.getByLabel("현재 학생의 실제 발송 문구");
    for (const line of expectedLessonLines) {
      expect(recipient!.full_message_body).toContain(line);
      await expect(actualMessage).toContainText(line);
    }
    expect(recipient!.full_message_body).not.toMatch(/#\{(?:현재|다음|2차시후)/);
    await expect(send.locator(".send-modal__send-btn")).toBeEnabled();
    await actualMessage.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("message-real-lesson-dates-1366.png"), animations: "disabled" });
    await draft.fill("학생 #{학생이름3} 점수 #{시험총점} 확인 완료 · #{99차시후명}");
    await expect(send.getByText(/99차시 뒤 수업이 없습니다/).first()).toBeVisible();
    await expect(send.locator(".send-modal__send-btn")).toBeDisabled();
    await expect(draft).toContainText("#{99차시후명}");
    await draft.fill("학생 #{학생이름3} 점수 #{시험총점} 확인 완료");
    await expect(send.locator(".send-modal__send-btn")).toBeEnabled();
    // A second staff editing session saves the same owned synthetic template.
    // No external messages or production rows participate in this conflict.
    const beforeConcurrent = await expectApi<{ updated_at: string }>(request, "GET", `/messaging/templates/${saved.id}/`, admin.access);
    const concurrentBody = "학생 #{학생이름3} 점수 #{시험총점} 확인 완료 · 다음 수업 안내도 확인해 주세요.";
    const concurrent = await expectApi<{ updated_at: string }>(request, "PATCH", `/messaging/templates/${saved.id}/`, admin.access, {
      body: concurrentBody, expected_updated_at: beforeConcurrent.updated_at,
    });
    const draftBody = "학생 #{학생이름3} 점수 #{시험총점} 확인 완료 · 과제도 함께 확인해 주세요.";
    await draft.fill(draftBody);
    const [conflictResponse] = await Promise.all([
      page.waitForResponse(response => response.request().method() === "PATCH"
        && new URL(response.url()).pathname.endsWith(`/api/v1/messaging/templates/${saved.id}/`)),
      send.getByRole("button", { name: "변경 내용 저장", exact: true }).click(),
    ]);
    expect(conflictResponse.status()).toBe(409);
    expect(conflictResponse.request().postDataJSON().expected_updated_at).toBe(beforeConcurrent.updated_at);
    const conflict = send.getByRole("region", { name: "문구 수정 충돌" });
    await expect(conflict).toContainText(concurrentBody);
    await expect(draft).toContainText(draftBody);
    const unchanged = await expectApi<{ body: string; updated_at: string }>(request, "GET", `/messaging/templates/${saved.id}/`, admin.access);
    expect(unchanged).toMatchObject({ body: concurrentBody, updated_at: concurrent.updated_at });
    const combinedBody = `${concurrentBody}\n과제도 함께 확인해 주세요.`;
    await draft.fill(combinedBody);
    await send.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
    const [combinedResponse] = await Promise.all([
      page.waitForResponse(response => response.request().method() === "PATCH"
        && new URL(response.url()).pathname.endsWith(`/api/v1/messaging/templates/${saved.id}/`)),
      page.getByRole("alertdialog", { name: "현재 초안으로 저장할까요?" })
        .getByRole("button", { name: "이 초안 저장", exact: true }).click(),
    ]);
    expect(combinedResponse.status()).toBe(200);
    expect(combinedResponse.request().postDataJSON().expected_updated_at).toBe(concurrent.updated_at);
    await expect(conflict).toBeHidden();
    const combinedReadback = await expectApi<{ body: string }>(request, "GET", `/messaging/templates/${saved.id}/`, admin.access);
    expect(combinedReadback.body).toBe(combinedBody);
    const defaultResponse = page.waitForResponse(response => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith(`/api/v1/messaging/templates/${saved.id}/set-default/`));
    await send.getByRole("button", { name: "성적 안내 기본으로 지정", exact: true }).click();
    const defaultSaved = await defaultResponse;
    expect(defaultSaved.status()).toBe(200);
    expect(await defaultSaved.json()).toMatchObject({ id: saved.id, is_user_default: true });
    const defaultRead = await expectApi<{ is_user_default: boolean }>(request, "GET", `/messaging/templates/${saved.id}/`, admin.access);
    expect(defaultRead.is_user_default).toBe(true);
    await page.reload();
    await page.getByRole("checkbox", { name: `${student.name} 선택`, exact: true }).check();
    // Hold the caller's actual v1 GET acknowledgement while another editor
    // commits v2. Forward the unchanged real response, never a fabricated body.
    const entryRaceBody = `${combinedBody}\n진입 중 다른 직원이 보완한 안내`;
    let callerVersion: string | undefined;
    let entryRaceVersion: string | undefined;
    const entryRaceRoute = "**/api/v1/messaging/templates/?category=grades";
    const holdCallerSnapshot = async (route: Route) => {
      if (route.request().method() !== "GET" || callerVersion) return route.fallback();
      const actual = await api<Array<{ id: number; body: string; updated_at: string }>>(
        request, "GET", "/messaging/templates/?category=grades", admin.access,
      );
      expect(actual.status).toBe(200);
      const callerTemplate = actual.body.find(item => item.id === saved.id);
      expect(callerTemplate?.body).toBe(combinedBody);
      callerVersion = callerTemplate!.updated_at;
      const newer = await expectApi<{ updated_at: string }>(request, "PATCH", `/messaging/templates/${saved.id}/`, admin.access, {
        body: entryRaceBody, expected_updated_at: callerVersion,
      });
      entryRaceVersion = newer.updated_at;
      expect(entryRaceVersion).not.toBe(callerVersion);
      await route.fulfill({ status: actual.status, json: actual.body });
    };
    await page.route(entryRaceRoute, holdCallerSnapshot);
    try {
      const [modalTemplates] = await Promise.all([
        page.waitForResponse(response => response.request().method() === "GET"
          && new URL(response.url()).pathname.endsWith("/api/v1/messaging/templates/")
          && !new URL(response.url()).searchParams.has("category")),
        page.getByRole("button", { name: "수업결과 알림톡 발송", exact: true }).click(),
      ]);
      expect(modalTemplates.status()).toBe(200);
      const latestList = await modalTemplates.json() as Array<{ id: number; body: string; updated_at: string }>;
      expect(latestList.find(item => item.id === saved.id)).toMatchObject({ body: entryRaceBody, updated_at: entryRaceVersion });
      const entryDraft = send.getByRole("textbox", { name: "안내문", exact: true });
      await expect(entryDraft).toContainText("과제도 함께 확인해 주세요.");
      await expect(entryDraft).not.toContainText("진입 중 다른 직원이 보완한 안내");
      await entryDraft.fill(`${combinedBody}\n진입 전 본문으로 작성한 초안`);
      const [entryConflictResponse] = await Promise.all([
        page.waitForResponse(response => response.request().method() === "PATCH"
          && new URL(response.url()).pathname.endsWith(`/api/v1/messaging/templates/${saved.id}/`)),
        send.getByRole("button", { name: "변경 내용 저장", exact: true }).click(),
      ]);
      expect(entryConflictResponse.status()).toBe(409);
      expect(entryConflictResponse.request().postDataJSON().expected_updated_at).toBe(callerVersion);
      const entryConflict = send.getByRole("region", { name: "문구 수정 충돌" });
      await expect(entryConflict).toContainText(entryRaceBody);
      await expect(entryDraft).toContainText("진입 전 본문으로 작성한 초안");
      const retained = await expectApi<{ body: string; updated_at: string }>(request, "GET", `/messaging/templates/${saved.id}/`, admin.access);
      expect(retained).toMatchObject({ body: entryRaceBody, updated_at: entryRaceVersion });
      // Explicitly restore the original owned scenario content, preserving all
      // downstream default/reload and lost-ack assertions below.
      await entryDraft.fill(combinedBody);
      await send.getByRole("button", { name: "변경 내용 저장", exact: true }).click();
      const [restoredResponse] = await Promise.all([
        page.waitForResponse(response => response.request().method() === "PATCH"
          && new URL(response.url()).pathname.endsWith(`/api/v1/messaging/templates/${saved.id}/`)),
        page.getByRole("alertdialog", { name: "현재 초안으로 저장할까요?" })
          .getByRole("button", { name: "이 초안 저장", exact: true }).click(),
      ]);
      expect(restoredResponse.status()).toBe(200);
      expect(restoredResponse.request().postDataJSON().expected_updated_at).toBe(entryRaceVersion);
      await expect(entryConflict).toBeHidden();
      expect((await expectApi<{ body: string }>(request, "GET", `/messaging/templates/${saved.id}/`, admin.access)).body).toBe(combinedBody);
    } finally {
      await page.unroute(entryRaceRoute, holdCallerSnapshot);
    }
    const restoredDraft = send.getByRole("textbox", { name: "안내문", exact: true });
    // Reopening restores the template; recipient choices start fresh for this send.
    await send.getByRole("checkbox", { name: "학생", exact: true }).uncheck();
    await send.getByRole("checkbox", { name: "학부모", exact: true }).check();
    await expect(restoredDraft).toContainText("확인 완료");
    await expect(restoredDraft).toContainText("다음 수업 안내도 확인해 주세요.");
    await expect(restoredDraft).toContainText("과제도 함께 확인해 주세요.");
    await expect(restoredDraft.locator('[data-message-variable="시험총점"]')).toHaveCount(1);
    await expect(restoredDraft.locator('[data-message-variable="학생이름3"]')).toHaveCount(1);
    await expect(send.getByLabel("현재 학생의 실제 발송 문구"))
      .toContainText(`학생 ${student.name} 점수 60 확인 완료`);
    await expect(send.locator(".send-modal__send-btn")).toBeEnabled();
    await expect(send).toContainText(templateName);
    await assertNoHorizontalOverflow(page);

    // Forward each UI POST through the same guarded, isolated real API, then
    // lose only its first acknowledgement. No response body is mocked.
    const retryName = `${templateName}-retry`;
    const createRequests: Array<Record<string, unknown>> = [];
    const createStatuses: number[] = [];
    await page.route("**/api/v1/messaging/templates/", async route => {
      if (route.request().method() !== "POST") return route.fallback();
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      if (payload.name !== retryName) return route.fallback();
      createRequests.push(payload);
      const result = await api<{ id?: number }>(request, "POST", "/messaging/templates/", admin.access, payload);
      createStatuses.push(result.status);
      if (Number.isInteger(result.body?.id) && result.body.id! > 0
        && !created.messageTemplateRetryIds.includes(result.body.id!)) created.messageTemplateRetryIds.push(result.body.id!);
      if (createRequests.length === 1) return route.abort("aborted");
      return route.fulfill({ status: result.status, json: result.body });
    });
    await send.getByRole("button", { name: "성적 안내문 저장", exact: true }).click();
    await send.getByPlaceholder("예: 출결 알림, 성적표 안내").fill(retryName);
    await send.getByRole("checkbox", { name: "성적 안내 기본으로 지정 · 이 학원 직원 공통", exact: true }).check();
    await send.getByRole("button", { name: "저장", exact: true }).click();
    await expect(send.getByRole("button", { name: "저장 확인·재시도", exact: true })).toBeVisible();
    expect(createStatuses).toEqual([201]);
    await expect(restoredDraft).toHaveAttribute("contenteditable", "false");
    await send.getByRole("button", { name: "저장 확인·재시도", exact: true }).click();
    await expect(send.locator(".send-modal__tpl-bar-name")).toHaveText(retryName);
    expect(createStatuses).toEqual([201, 200]);
    expect(createRequests).toHaveLength(2);
    expect(createRequests[0].client_request_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(createRequests[1]).toEqual(createRequests[0]);
    const retryRows = await expectApi<Array<{ id: number; name: string; body: string; is_user_default: boolean }>>(request, "GET", "/messaging/templates/?category=grades", admin.access);
    expect(retryRows.filter(row => row.name === retryName)).toEqual([
      expect.objectContaining({ id: created.messageTemplateRetryIds[0], body: combinedBody, is_user_default: true }),
    ]);
    expect(created.messageTemplateRetryIds).toHaveLength(1);
    await page.reload();
    await page.getByRole("checkbox", { name: `${student.name} 선택`, exact: true }).check();
    await page.getByRole("button", { name: "수업결과 알림톡 발송", exact: true }).click();
    await expect(send.locator(".send-modal__tpl-bar-name")).toHaveText(retryName);
    await expect(restoredDraft).toContainText("다음 수업 안내도 확인해 주세요.");
    await expect(restoredDraft).toContainText("과제도 함께 확인해 주세요.");
    boundary.assertClean();
    guards.assertZeroDefects();
  } finally {
    await context.close();
    if (previousDefaultId) {
      const previousState = await expectApi<{ is_user_default: boolean }>(request, "GET", `/messaging/templates/${previousDefaultId}/`, admin.access);
      if (!previousState.is_user_default) await expectApi(request, "POST", `/messaging/templates/${previousDefaultId}/set-default/`, admin.access, {});
    }
    if (created.messageTemplateId) {
      const id = created.messageTemplateId;
      await expectApi(request, "DELETE", `/messaging/templates/${id}/`, admin.access, undefined, [204]);
      const residue = await api(request, "GET", `/messaging/templates/${id}/`, admin.access);
      expect(residue.status).toBe(404);
      created.messageTemplateId = undefined;
    }
    for (const id of created.messageTemplateRetryIds) {
      await expectApi(request, "DELETE", `/messaging/templates/${id}/`, admin.access, undefined, [204]);
      expect((await api(request, "GET", `/messaging/templates/${id}/`, admin.access)).status).toBe(404);
    }
    created.messageTemplateRetryIds = [];
  }
}


/** Same owned scenario and cascade cleanup; never calls the external send endpoint. */
async function verifyAssessmentFeedback(parentPage: Page, request: APIRequestContext, admin: QaTokens,
  student: QaStudent, peer: QaStudent, studentTokens: QaTokens, parentTokens: QaTokens, testInfo: TestInfo): Promise<void> {
  const context = await parentPage.context().browser()!.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const commentsPath = `/results/admin/sessions/${created.sessionId}/exam/${created.examId}/parent-comments/`;
  const configPath = `/results/admin/sessions/${created.sessionId}/total-config/`;
  try {
    created.otherFamily = await createQaFamily(request, admin.access, "assessment-other-family", 1);
    const otherParent = await loginApi(request, created.otherFamily.parentPhone, created.otherFamily.parentPassword);
    const privateMemos = {
      attendance: `QA 출결 전용 메모 ${runStamp}`,
      student: `QA 학생 내부 메모 ${runStamp}`,
    };
    const attendance = await expectApi<Array<{ id: number }>>(request, "POST", "/lectures/attendance/bulk_create/", admin.access,
      { session: created.sessionId, students: [student.id] }, [201]);
    expect(attendance).toHaveLength(1);
    created.attendanceIds.push(attendance[0].id);
    const memoRecords = [
      { path: `/lectures/attendance/${attendance[0].id}/`, field: "memo", value: privateMemos.attendance },
      { path: `/students/${student.id}/`, field: "memo", value: privateMemos.student },
    ];
    for (const record of memoRecords) {
      await expectApi(request, "PATCH", record.path, admin.access, { [record.field]: record.value });
      const persisted = await expectApi<Record<string, unknown>>(request, "GET", record.path, admin.access);
      expect(persisted[record.field]).toBe(record.value);
    }
    await seedBrowserAuth(page, admin);
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`, { timeout: 30_000 });
      await acknowledgeInitialAccountPromptsIfVisible(page);
      await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
      const totals = page.getByRole("dialog", { name: "합산 설정", exact: true });
      await totals.getByRole("button", { name: "시험 총점 위로 이동", exact: true }).click();
      await totals.getByTitle("최소화", { exact: true }).click();
      const search = page.getByRole("searchbox", { name: "학생 이름 검색" });
      await search.fill(`검색결과없는합산학생-${runStamp}`);
      const restoreTotals = page.locator(".modal-taskbar__tab-restore").filter({ hasText: "합산 설정" });
      await expect(restoreTotals).toBeVisible();
      await restoreTotals.click();
      await expect(totals.getByRole("group", { name: "시험 총점 · 0개 합산", exact: true })).toBeVisible();
      await totals.getByTitle("최소화", { exact: true }).click();
      await search.fill("");
      await page.getByRole("tab", { name: "출결", exact: true }).click();
      await expect(page).toHaveURL(/\/attendance$/);
      // A URL change precedes the React route commit. Prove that the editor
      // actually unmounted before testing recovery from its scoped memory.
      await expect(page.getByRole("tab", { name: "출결", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("button", { name: "시험 총점 합산 설정", exact: true })).toHaveCount(0);
      await page.goBack();
      await expect(page).toHaveURL(/\/scores$/);
      await expect(page.getByRole("tab", { name: "성적", exact: true })).toHaveAttribute("aria-selected", "true");
      await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
      await expect(totals.getByRole("group", { name: "시험 총점 · 0개 합산", exact: true })).toBeVisible();
      await totals.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
      await expect(totals).toBeHidden();
      const excluded = await expectApi<{ version: number; exam_ids: number[] }>(request, "GET", configPath, admin.access);
      expect(excluded.exam_ids).toEqual([]);
      await page.reload();
      await page.getByRole("button", { name: "시험 총점 합산 설정", exact: true }).click();
      await totals.getByRole("button", { name: "시험 총점 아래로 이동", exact: true }).click();
      await totals.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
      await expect(totals).toBeHidden();
      const restored = await expectApi<{ version: number; exam_ids: number[] }>(request, "GET", configPath, admin.access);
      expect(restored.exam_ids).toEqual([created.examId]);
      expect(restored.version).toBe(excluded.version + 1);
      await page.getByRole("button", { name: `${examTitle} 작업 선택`, exact: true }).click();
      await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
      const comment = page.getByRole("dialog", { name: "학부모 코멘트", exact: true });
      const text = `QA 관찰 ${width}: 계산 과정을 차근차근 설명해 주세요.`;
      await comment.getByLabel(student.name, { exact: true }).fill(text);
      await comment.locator(".parent-comment-row").filter({ has: page.getByLabel(student.name, { exact: true }) }).getByRole("button", { name: "학부모에게 공개", exact: true }).click();
      await expect(comment.getByText("학부모에게 공개했습니다.", { exact: true })).toBeVisible();
      const staffRead = await expectApi<{ items: Array<{ enrollment_id: number; text: string }> }>(request, "GET", commentsPath, admin.access);
      expect(staffRead.items.find(row => row.enrollment_id === created.primaryEnrollmentId)?.text).toBe(text);
      await page.reload();
      await page.getByRole("button", { name: `${examTitle} 작업 선택`, exact: true }).click();
      await page.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
      await expect(comment.getByLabel(student.name, { exact: true })).toHaveValue(text);
      await parentPage.setViewportSize({ width, height: 900 });
      await gotoAndSettle(parentPage, `${QA_BASE}/student/grades`, { timeout: 30_000 });
      await expect(parentPage.getByRole("link").filter({ hasText: examTitle }).first().locator("..").locator('aside[aria-label="학부모 코멘트"]')).toContainText(text);
      await reloadStudentApp(parentPage);
      await expect(parentPage.getByText(text, { exact: true })).toBeVisible();
      for (const child of [student, peer]) {
        const response = await request.get(`${QA_API}/api/v1/results/parent/assessment-comments/`, { headers: { Authorization: `Bearer ${parentTokens.access}`, "X-Tenant-Code": QA_TENANT, "X-Student-Id": String(child.id) } });
        expect(response.status()).toBe(200);
        const result = await response.json() as { items: Array<{ text: string; assessment_id: number; session_id: number }> };
        for (const memo of Object.values(privateMemos)) expect(JSON.stringify(result)).not.toContain(memo);
        if (child.id === student.id) expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ text, assessment_id: created.examId, session_id: created.sessionId })]));
        else expect(result.items.some(item => item.text === text)).toBe(false);
      }
      const parentGrades = await request.get(`${QA_API}/api/v1/student/grades/`, {
        headers: { Authorization: `Bearer ${parentTokens.access}`, "X-Tenant-Code": QA_TENANT, "X-Student-Id": String(student.id) },
      });
      expect(parentGrades.status()).toBe(200);
      const parentGradeBody = JSON.stringify(await parentGrades.json());
      for (const memo of Object.values(privateMemos)) {
        expect(parentGradeBody).not.toContain(memo);
        await expect(parentPage.locator("body")).not.toContainText(memo);
      }
      for (const path of ["/results/parent/assessment-comments/", "/student/grades/"]) {
        const forbidden = await request.get(`${QA_API}/api/v1${path}`, {
          headers: { Authorization: `Bearer ${otherParent.access}`, "X-Tenant-Code": QA_TENANT, "X-Student-Id": String(student.id) },
        });
        expect(forbidden.status(), `other family cannot select this student: ${path}`).toBe(403);
        expect(JSON.stringify(await forbidden.json())).not.toContain(text);
        const ownChild = await request.get(`${QA_API}/api/v1${path}`, {
          headers: { Authorization: `Bearer ${otherParent.access}`, "X-Tenant-Code": QA_TENANT, "X-Student-Id": String(created.otherFamily.students[0].id) },
        });
        expect(ownChild.status()).toBe(200);
        const ownChildBody = JSON.stringify(await ownChild.json());
        expect(ownChildBody).not.toContain(text);
        for (const memo of Object.values(privateMemos)) expect(ownChildBody).not.toContain(memo);
      }
      await assertNoHorizontalOverflow(page);
      await assertNoHorizontalOverflow(parentPage);
      await page.screenshot({ path: testInfo.outputPath(`real-assessment-staff-${width}.png`), fullPage: true });
      await parentPage.screenshot({ path: testInfo.outputPath(`real-assessment-parent-${width}.png`), fullPage: true });
    }
    const denied = await request.get(`${QA_API}/api/v1/results/parent/assessment-comments/`, { headers: { Authorization: `Bearer ${studentTokens.access}`, "X-Tenant-Code": QA_TENANT } });
    expect(denied.status()).toBe(403);
    const studentGrades = await expectApi<MyGradesSummary>(request, "GET", "/student/grades/", studentTokens.access);
    expect(JSON.stringify(studentGrades)).not.toContain("QA 관찰");
    for (const memo of Object.values(privateMemos)) expect(JSON.stringify(studentGrades)).not.toContain(memo);
    const studentContext = await parentPage.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    try {
      const studentPage = await studentContext.newPage();
      const studentBoundary = await installQaStudentParentBoundary(studentPage, request);
      const studentGuards = attachStrictBrowserGuards(studentPage);
      const commentRequests: string[] = [];
      studentPage.on("request", entry => { if (new URL(entry.url()).pathname.endsWith("/results/parent/assessment-comments/")) commentRequests.push(entry.url()); });
      await seedBrowserAuth(studentPage, studentTokens);
      await gotoAndSettle(studentPage, `${QA_BASE}/student/grades`, { timeout: 30_000 });
      await expect(studentPage.getByRole("link").filter({ hasText: examTitle }).first()).toBeVisible();
      await reloadStudentApp(studentPage);
      await expect(studentPage.locator('aside[aria-label="학부모 코멘트"]')).toHaveCount(0);
      expect(commentRequests).toEqual([]);
      await studentPage.screenshot({ path: testInfo.outputPath("real-assessment-student-390.png"), fullPage: true });
      studentBoundary.assertClean(); studentGuards.assertZeroDefects();
    } finally { await studentContext.close(); }
    boundary.assertClean(); guards.assertZeroDefects();
  } finally { await context.close(); }
}
