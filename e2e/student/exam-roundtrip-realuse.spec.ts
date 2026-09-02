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

test.setTimeout(240_000);
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
  await page.addInitScript(({ access, refresh, code }) => {
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

    const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
      title: `${MARKER} 학생 시험 roundtrip`,
      description: "격리 QA 학생 제출/채점/결과 확인",
      exam_type: "regular",
      session_id: SESSION_ID,
      pass_score: 50,
      max_score: 100,
      answer_visibility: "hidden",
    });
    created.examId = Number(exam.id);

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

    await seedBrowser(page, primary);
    const strict = attachStrictBrowserGuards(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/student/exams/${created.examId}/submit`, { timeout: 30_000 });
    await acknowledgeFirstLoginGuideIfVisible(page);
    await expect(page.getByText(`${MARKER} 학생 시험 roundtrip`)).toBeVisible();
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
    await expect(page.getByText(`${MARKER} 학생 시험 roundtrip`)).toBeVisible();
    await expect(page.getByTestId("grade-wrong-summary")).toContainText("오답 2문항");
    await expect(page.getByText("1/2등")).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.getByText(`${MARKER} 학생 시험 roundtrip`)).toBeVisible();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

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
