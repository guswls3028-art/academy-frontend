/**
 * Student submission -> persisted result -> parent selected-child projection.
 * Runs only in the disposable production-shaped development tenant.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
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
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
  type QaStudent,
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
  enrollmentIds: number[];
  sessionEnrollmentIds: number[];
  submissionIds: number[];
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
  if (created.examId && created.sessionId) {
    await remove("DELETE", `/exams/${created.examId}/?session_id=${created.sessionId}`);
  }
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
    ...(created.sessionId ? [[`session ${created.sessionId}`, `/lectures/sessions/${created.sessionId}/`] as const] : []),
    ...(created.lectureId ? [[`lecture ${created.lectureId}`, `/lectures/lectures/${created.lectureId}/`] as const] : []),
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

  const enrollments = await expectApi<Array<{ id: number }>>(
    request,
    "POST",
    "/enrollments/bulk_create/",
    adminAccess,
    { lecture: created.lectureId, students: family.students.map((student) => student.id) },
  );
  created.enrollmentIds = enrollments.map((row) => Number(row.id));

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
  await gotoAndSettle(page, `${QA_BASE}/student/exams/${examId}/submit`, { timeout: 30_000 });
  await expect(page.getByText(examTitle)).toBeVisible();
  for (const [number, answer] of [[1, "1"], [2, "4"], [3, "3"], [4, "4"], [5, "1"]] as const) {
    await page.getByLabel(`${number}번 답`).fill(answer);
  }
  await expect(page.getByText("5/5문항 (100%)")).toBeVisible();
  const submitResponse = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).pathname.endsWith(`/api/v1/student/exams/${examId}/submit/`)
  ));
  await page.getByRole("button", { name: "제출하기" }).click();
  await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출" }).click();
  const submitted = await submitResponse;
  expect(submitted.status()).toBe(201);
  const submissionId = Number((await submitted.json() as { submission_id: number }).submission_id);
  expect(submissionId).toBeGreaterThan(0);
  await page.waitForURL(`**/student/exams/${examId}/result`, { timeout: 45_000 });
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

    created.submissionIds.push(await submitFirstStudentThroughUi(page, primary, created.examId!));
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
    ));
    await page.getByRole("button", { name: "제출하기" }).click();
    await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출" }).click();
    const parentSubmitted = await parentSubmitResponse;
    expect(parentSubmitted.status()).toBe(201);
    expect(parentSubmitted.request().headers()["x-student-id"]).toBe(String(peer.id));
    const parentSubmissionId = Number((await parentSubmitted.json() as { submission_id: number }).submission_id);
    expect(parentSubmissionId).toBeGreaterThan(0);
    created.submissionIds.push(parentSubmissionId);
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
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
