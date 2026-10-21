/**
 * Persistent-development online exam roundtrip.
 *
 * Reuses two existing students and enrollments from one exact disposable
 * qa-ymath-realuse tenant. It creates only an exam and its submissions, proves
 * student submit -> grading -> result/history persistence, then deletes every
 * created row by exact id. It never creates accounts, sends notifications, or
 * uploads objects.
 */
import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { acknowledgeFirstLoginGuideIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForCondition, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(360_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

const ENABLED = process.env.E2E_EXAM_ROUNDTRIP_REALUSE === "1";
const BASE = (process.env.E2E_BASE_URL || "").replace(/\/+$/, "");
const API = (process.env.E2E_API_URL || "").replace(/\/+$/, "");
const CODE = (process.env.E2E_EXAM_TENANT_CODE || "").trim().toLowerCase();
const PASSWORD = process.env.E2E_EXAM_PASSWORD || "";
const ADMIN_USER = process.env.E2E_EXAM_ADMIN || "ymath-qa-teacher";
const PRIMARY_USER = process.env.E2E_EXAM_PRIMARY_STUDENT || "ymath-qa-student-01";
const PEER_USER = process.env.E2E_EXAM_PEER_STUDENT || "ymath-qa-student-02";
const LECTURE_ID = Number(process.env.E2E_EXAM_LECTURE_ID || 0);
const SESSION_ID = Number(process.env.E2E_EXAM_SESSION_ID || 0);
const PRIMARY_STUDENT_ID = Number(process.env.E2E_EXAM_PRIMARY_STUDENT_ID || 0);
const PEER_STUDENT_ID = Number(process.env.E2E_EXAM_PEER_STUDENT_ID || 0);
const MARKER = `[qa-exam-${Date.now()}]`;
const EXAM_TITLE = `${MARKER} 학생 시험 roundtrip`;

type Tokens = { access: string; refresh: string };
type ApiResult<T> = { status: number; body: T };
type EnrollmentRow = { id: number; student: { id: number } };
type QuestionRow = { id: number; number: number };

const created = {
  adminAccess: "",
  examId: 0,
  submissionIds: [] as number[],
};

function isLoopback(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function assertIsolatedRuntime(): void {
  expect(isLoopback(BASE), "exam frontend must be loopback-only").toBe(true);
  expect(isLoopback(API), "exam API must be loopback-only").toBe(true);
  expect(CODE).toMatch(/^qa-ymath-realuse-[a-z0-9-]+$/);
  expect(PASSWORD, "E2E_EXAM_PASSWORD is required").not.toBe("");
  for (const [label, value] of Object.entries({
    LECTURE_ID,
    SESSION_ID,
    PRIMARY_STUDENT_ID,
    PEER_STUDENT_ID,
  })) {
    expect(Number.isInteger(value) && value > 0, `${label} must be a positive integer`).toBe(true);
  }
  expect(PRIMARY_STUDENT_ID).not.toBe(PEER_STUDENT_ID);
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": CODE,
  };
}

function rows<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && Array.isArray((body as { results?: unknown }).results)) {
    return (body as { results: T[] }).results;
  }
  return [];
}

async function login(request: APIRequestContext, username: string): Promise<Tokens> {
  const response = await request.post(`${API}/api/v1/token/`, {
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    data: { username, password: PASSWORD, tenant_code: CODE },
    timeout: 60_000,
  });
  expect(response.status(), `login ${username}`).toBe(200);
  return await response.json() as Tokens;
}

async function api<T = unknown>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const response = await request.fetch(`${API}/api/v1${path}`, {
    method,
    headers: headers(token),
    ...(data ? { data } : {}),
    timeout: 60_000,
  });
  return {
    status: response.status(),
    body: await response.json().catch(() => null) as T,
  };
}

async function expectApi<T = unknown>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
  statuses = [200, 201],
): Promise<T> {
  const result = await api<T>(request, method, path, token, data);
  expect(statuses, `${method} ${path} -> ${result.status} ${JSON.stringify(result.body)}`).toContain(result.status);
  return result.body;
}

async function seedBrowser(page: Page, tokens: Tokens): Promise<void> {
  // The page is already on BASE. Replace the active session once; stacking
  // init scripts would replay earlier roles in an unspecified order on reload.
  await page.evaluate(({ access, refresh, code }) => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("academy:auth-") || key === "access" || key === "refresh") {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: CODE });
}

async function waitForResult(
  request: APIRequestContext,
  token: string,
  examId: number,
): Promise<Record<string, unknown>> {
  let latest: ApiResult<Record<string, unknown>> | null = null;
  await waitForCondition(async () => {
    latest = await api<Record<string, unknown>>(
      request,
      "GET",
      `/student/results/me/exams/${examId}/`,
      token,
    );
    return latest.status === 200;
  }, { timeoutMs: 30_000, intervalMs: 750, description: "student exam result sync" });
  return latest!.body;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.adminAccess) return;
  const failures: string[] = [];
  for (const submissionId of [...created.submissionIds].reverse()) {
    const result = await api(request, "DELETE", `/submissions/submissions/${submissionId}/`, created.adminAccess);
    if (![200, 204, 404].includes(result.status)) {
      failures.push(`delete submission ${submissionId} -> ${result.status}`);
    }
  }
  if (created.examId) {
    const result = await api(
      request,
      "DELETE",
      `/exams/${created.examId}/?session_id=${SESSION_ID}`,
      created.adminAccess,
    );
    if (![200, 204, 404].includes(result.status)) {
      failures.push(`delete exam ${created.examId} -> ${result.status}`);
    }
  }
  for (const submissionId of created.submissionIds) {
    const result = await api(request, "GET", `/submissions/submissions/${submissionId}/`, created.adminAccess);
    if (result.status !== 404) failures.push(`submission ${submissionId} residue -> ${result.status}`);
  }
  if (created.examId) {
    const result = await api(
      request,
      "GET",
      `/exams/${created.examId}/?session_id=${SESSION_ID}`,
      created.adminAccess,
    );
    if (result.status !== 404) failures.push(`exam ${created.examId} residue -> ${result.status}`);
  }
  expect(failures, failures.join("\n")).toEqual([]);
  created.examId = 0;
  created.submissionIds = [];
}

async function verifyWrittenRoundtrip(
  page: Page, request: APIRequestContext, admin: Tokens, student: Tokens, enrollmentId: number,
): Promise<void> {
  const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
    title: `${MARKER} 서술형 제출·교사 채점`, session_id: SESSION_ID, exam_type: "regular",
    max_score: 100, pass_score: 50, grading_mode: "mixed", choice_question_count: 1,
    manual_grading_method: "score", allow_retake: true, max_attempts: 2,
  });
  created.examId = exam.id;
  const questions = await expectApi<QuestionRow[]>(request, "POST", `/exams/${exam.id}/questions/init/`, admin.access, {
    choice_count: 1, choice_score: 50, essay_count: 1, essay_score: 50,
  });
  questions.sort((a, b) => a.number - b.number);
  await expectApi(request, "PUT", `/exams/${exam.id}/enrollments/?session_id=${SESSION_ID}`, admin.access, {
    enrollment_ids: [enrollmentId],
  });
  const answer = "첫 번째 줄에서 풀이의 근거를 설명합니다.\n두 번째 줄에서 계산 과정과 결론을 충분히 길게 작성합니다.";
  const answers = [
    { exam_question_id: questions[0].id, answer: "2" },
    { exam_question_id: questions[1].id, answer },
  ];
  // A setup error must not create a stuck submission or consume the first attempt.
  await expectApi(request, "POST", `/student/exams/${exam.id}/submit/`, student.access, { answers }, [409]);
  await expectApi(request, "POST", "/exams/answer-keys/", admin.access, { exam: exam.id, answers: {} });
  await expectApi(request, "POST", `/student/exams/${exam.id}/submit/`, student.access, { answers }, [409]);
  await expectApi(request, "POST", "/exams/answer-keys/", admin.access, {
    exam: exam.id, answers: { [questions[0].id]: "2" },
  });
  const before = await expectApi<{ attempt_count: number }>(request, "GET", `/student/exams/${exam.id}/`, student.access);
  expect(before.attempt_count).toBe(0);
  await seedBrowser(page, student);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/student/exams/${exam.id}/submit`);
  await page.getByLabel("1번 답", { exact: true }).fill("2");
  await page.locator("textarea").fill(answer);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("textarea")).toHaveValue(answer);
  const submitted = page.waitForResponse((response) => response.request().method() === "POST"
    && new URL(response.url()).pathname === `/api/v1/student/exams/${exam.id}/submit/`);
  await page.getByRole("button", { name: "제출하기" }).click();
  await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출", exact: true }).click();
  const response = await submitted;
  expect(response.status()).toBe(201);
  created.submissionIds.push(Number((await response.json() as { submission_id: number }).submission_id));
  await expect(page.getByText("서술형 채점 중입니다.")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("서술형 채점 중입니다.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const grid = await expectApi<{ rows: Array<{ enrollment_id: number; student_name: string }> }>(
    request, "GET", `/results/admin/exams/${exam.id}/manual-grading/`, admin.access,
  );
  const name = grid.rows.find((row) => row.enrollment_id === enrollmentId)!.student_name;
  await seedBrowser(page, admin);
  const gradingUrl = `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${exam.id}`;
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, gradingUrl);
    await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: name });
    await row.locator("summary").filter({ hasText: "학생 답안" }).click();
    await expect(row.locator("details[open] div")).toHaveText(answer);
    await expect(row.getByRole("spinbutton", { name: /50점 만점 점수/ })).toHaveValue("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const score = page.getByRole("row").filter({ hasText: name }).getByRole("spinbutton", { name: /50점 만점 점수/ });
  await score.fill("35");
  await page.getByRole("button", { name: "입력 내용 확인", exact: true }).click();
  const saved = page.waitForResponse((res) => res.request().method() === "POST"
    && new URL(res.url()).pathname.endsWith(`/exams/${exam.id}/manual-grading/`)
    && Boolean((res.request().postDataJSON() as { apply?: boolean }).apply));
  await page.getByRole("button", { name: "1명 성적 확정", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "채점·결과", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: name }).getByRole("spinbutton", { name: /50점 만점 점수/ })).toHaveValue("35");

  await seedBrowser(page, student);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/student/exams/${exam.id}/result`);
    const result = await waitForResult(request, student.access, exam.id);
    expect(result.total_score).toBe(85);
    await expect(page.getByText("85 / 100점", { exact: true })).toBeVisible();
    await expect(page.getByText("서술형 채점 중입니다.")).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    expect((await waitForResult(request, student.access, exam.id)).total_score).toBe(85);
    await expect(page.getByText("85 / 100점", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
}

test.describe.serial("[real-use] 학생 온라인 시험 roundtrip", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!ENABLED, "Set E2E_EXAM_ROUNDTRIP_REALUSE=1 for isolated development QA.");

  test.beforeAll(() => {
    assertIsolatedRuntime();
  });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("시험 배정, 두 학생 제출, 자동채점, 결과와 성적표 새로고침이 이어진다", async ({ page, request }) => {
    const admin = await login(request, ADMIN_USER);
    const primary = await login(request, PRIMARY_USER);
    const peer = await login(request, PEER_USER);
    created.adminAccess = admin.access;
    const strict = attachStrictBrowserGuards(page);

    const enrollmentBody = await expectApi<unknown>(
      request,
      "GET",
      `/enrollments/?lecture=${LECTURE_ID}&page_size=100`,
      admin.access,
    );
    const enrollmentRows = rows<EnrollmentRow>(enrollmentBody);
    const primaryEnrollment = enrollmentRows.find((row) => Number(row.student?.id) === PRIMARY_STUDENT_ID);
    const peerEnrollment = enrollmentRows.find((row) => Number(row.student?.id) === PEER_STUDENT_ID);
    expect(primaryEnrollment, "primary enrollment").toBeTruthy();
    expect(peerEnrollment, "peer enrollment").toBeTruthy();

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/login/${CODE}`, { timeout: 30_000 });
    await page.getByTestId("login-username").fill(ADMIN_USER);
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 30_000 });
    await acknowledgeFirstLoginGuideIfVisible(page);
    await gotoAndSettle(
      page,
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams`,
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: "시험 추가", exact: true }).first().click();
    await page.getByText("빠르게 여러 개 만들기", { exact: true }).click();
    await page.getByLabel("시험 1 제목").fill(EXAM_TITLE);
    await page.getByLabel("시험 1 만점").fill("100");
    await page.getByLabel("시험 1 커트라인").fill("50");
    const createResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/exams/")
    ));
    await page.getByRole("button", { name: "1개 시험 만들기", exact: true }).click();
    const createdExamResponse = await createResponse;
    expect(createdExamResponse.status()).toBe(201);
    created.examId = Number((await createdExamResponse.json() as { id: number }).id);
    expect(created.examId).toBeGreaterThan(0);
    await expect(page.getByText(EXAM_TITLE).first()).toBeVisible({ timeout: 20_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: EXAM_TITLE, exact: true })).toBeVisible();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    const questions = await expectApi<QuestionRow[]>(
      request,
      "POST",
      `/exams/${created.examId}/questions/init/`,
      admin.access,
      { total_questions: 5, default_score: 20 },
    );
    const questionIds = questions
      .sort((left, right) => Number(left.number) - Number(right.number))
      .map((row) => Number(row.id));
    await expectApi(request, "POST", "/exams/answer-keys/", admin.access, {
      exam: created.examId,
      answers: Object.fromEntries(questionIds.map((id, index) => [String(id), String(index + 1)])),
    });
    await expectApi(
      request,
      "PUT",
      `/exams/${created.examId}/enrollments/?session_id=${SESSION_ID}`,
      admin.access,
      { enrollment_ids: [primaryEnrollment!.id, peerEnrollment!.id] },
      [200],
    );

    const peerSubmission = await expectApi<{ submission_id: number }>(
      request,
      "POST",
      `/student/exams/${created.examId}/submit/`,
      peer.access,
      { answers: questionIds.map((id) => ({ exam_question_id: id, answer: "5" })) },
      [201],
    );
    created.submissionIds.push(Number(peerSubmission.submission_id));
    const peerResult = await waitForResult(request, peer.access, created.examId);
    expect(peerResult.total_score).toBe(20);

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await seedBrowser(page, primary);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/student/exams/${created.examId}/submit`, { timeout: 30_000 });
    await acknowledgeFirstLoginGuideIfVisible(page);
    await expect(page.getByText(EXAM_TITLE)).toBeVisible();
    for (const [index, answer] of ["1", "4", "3", "4", "1"].entries()) {
      await page.getByLabel(`${index + 1}번 답`).fill(answer);
    }
    await expect(page.getByText("5/5문항 (100%)")).toBeVisible();
    const submitResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().includes(`/api/v1/student/exams/${created.examId}/submit/`)
    ));
    await page.getByRole("button", { name: "제출하기" }).click();
    await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출" }).click();
    const submitted = await submitResponse;
    expect(submitted.status()).toBe(201);
    created.submissionIds.push(Number((await submitted.json() as { submission_id: number }).submission_id));

    await page.waitForURL(`**/student/exams/${created.examId}/result`, { timeout: 30_000 });
    await waitForRenderSettled(page, { timeout: 20_000 });
    const primaryResult = await waitForResult(request, primary.access, created.examId);
    expect(primaryResult.total_score).toBe(60);
    expect((primaryResult.analysis as { wrong_question_numbers: number[] }).wrong_question_numbers).toEqual([2, 5]);
    expect(primaryResult.rank).toBe(1);
    expect(primaryResult.cohort_size).toBe(2);
    expect(primaryResult.answers_visible).toBe(false);
    await expect(page.getByTestId("wrong-number-chip")).toHaveText(["2", "5"]);
    await expect(page.getByText("정답 내용은 비공개입니다. 틀린 번호와 내 답만 확인할 수 있습니다.")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.getByTestId("wrong-number-chip")).toHaveText(["2", "5"]);
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${BASE}/student/grades`, { timeout: 30_000 });
    const gradeCard = page.getByRole("link").filter({ hasText: EXAM_TITLE }).first();
    await expect(gradeCard).toBeVisible();
    await expect(gradeCard.getByTestId("grade-wrong-summary")).toContainText("오답 2문항");
    await expect(gradeCard.getByText("1/2등")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(gradeCard).toBeVisible();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    await cleanup(request);
    await verifyWrittenRoundtrip(page, request, admin, primary, primaryEnrollment!.id);

    const logBody = await expectApi<{ count: number }>(
      request,
      "GET",
      "/messaging/log/?page=1&page_size=1",
      admin.access,
    );
    expect(logBody.count).toBe(0);
    strict.assertZeroDefects();
  });
});
