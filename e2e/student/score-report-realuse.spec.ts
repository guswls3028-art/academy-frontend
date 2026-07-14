/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 학생 성적 리포트 실사용 canary.
 *
 * 운영 API로 학원장/선생님이 만드는 구조(강의 → 차시 → 학생 → 시험 → 대상자)를 만든 뒤,
 * 학생 화면에서 실제 답안 입력 UI로 제출하고 성적표/오답 번호/석차/정답 비공개 UX를 검증한다.
 */
import { test, expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import { getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle, waitForCondition, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(180_000);

const API = getApiBaseUrl();
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "__MISSING_E2E_ADMIN_PASS__";
const STUDENT_PASS = "test1234";
const TS = Date.now();
const TODAY_KST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

const LECTURE_TITLE = `[E2E-${TS}] 성적리포트`;
const SESSION_TITLE = `[E2E-${TS}] 성적표 1차시`;
const EXAM_TITLE = `[E2E-${TS}] 5/25 성적표 실사용 검증`;
const PRIMARY_STUDENT_NAME = `[E2E-${TS}] 성적학생A`;
const PEER_STUDENT_NAME = `[E2E-${TS}] 성적학생B`;
const PRIMARY_USER = `e2esr${String(TS).slice(-8)}a`;
const PEER_USER = `e2esr${String(TS).slice(-8)}b`;
const PRIMARY_PARENT_PHONE = `010${String(TS).slice(-8)}`;
const PEER_PARENT_PHONE = `010${String(TS + 1).slice(-8)}`;
const TOKEN_MAX_ATTEMPTS = 5;

type Tokens = { access: string; refresh: string };

type CreatedState = {
  adminAccess?: string;
  lectureId?: number;
  sessionId?: number;
  examId?: number;
  primaryStudentId?: number;
  peerStudentId?: number;
  primaryEnrollmentId?: number;
  peerEnrollmentId?: number;
  sessionEnrollmentIds: number[];
};

const created: CreatedState = { sessionEnrollmentIds: [] };

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": CODE,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTokenThrottleWaitMs(responseText: string, retryAfter: string | null): number {
  const headerSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
    return Math.min(headerSeconds + 1, 75) * 1000;
  }
  const bodySeconds = Number.parseInt(responseText.match(/(\d+)\s*초/)?.[1] || "", 10);
  if (Number.isFinite(bodySeconds) && bodySeconds > 0) {
    return Math.min(bodySeconds + 1, 75) * 1000;
  }
  return 5_000;
}

async function loginToken(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<Tokens> {
  let lastFailure = "";
  for (let attempt = 0; attempt < TOKEN_MAX_ATTEMPTS; attempt += 1) {
    const resp = await request.post(`${API}/api/v1/token/`, {
      data: { username, password, tenant_code: CODE },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
      timeout: 60_000,
    });
    if (resp.status() === 200) {
      return await resp.json() as Tokens;
    }
    const body = await resp.text();
    lastFailure = `${resp.status()} ${body}`;
    if (resp.status() !== 429 || attempt === TOKEN_MAX_ATTEMPTS - 1) break;
    await sleep(parseTokenThrottleWaitMs(body, resp.headers()["retry-after"] || null));
  }
  throw new Error(`token issue failed for ${username}@${CODE}: ${lastFailure}`);
}

async function apiFetch<TBody = any>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
): Promise<{ status: number; body: TBody }> {
  const resp = await request.fetch(`${API}/api/v1${path}`, {
    method,
    headers: headers(token),
    ...(data ? { data } : {}),
    timeout: 60_000,
  });
  let body: any = null;
  try { body = await resp.json(); } catch { body = null; }
  return { status: resp.status(), body };
}

async function expectApi<TBody = any>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
  okStatuses: number[] = [200, 201],
): Promise<TBody> {
  const out = await apiFetch<TBody>(request, method, path, token, data);
  expect(
    okStatuses,
    `${method} ${path} -> ${out.status} ${JSON.stringify(out.body)}`,
  ).toContain(out.status);
  return out.body;
}

async function seedStudentBrowser(page: Page, tokens: Tokens): Promise<void> {
  await page.addInitScript(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: CODE });

  await page.goto(`${BASE}/login`, { waitUntil: "commit", timeout: 20_000 });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: CODE });
}

async function createStudent(
  request: APIRequestContext,
  token: string,
  name: string,
  psNumber: string,
  parentPhone: string,
): Promise<number> {
  const student = await expectApi<{ id: number }>(request, "POST", "/students/", token, {
    name,
    parent_phone: parentPhone,
    ps_number: psNumber,
    no_phone: true,
    school_type: "HIGH",
    grade: 1,
    initial_password: STUDENT_PASS,
    memo: "E2E score report canary. 계정 안내 필수 발송 정책과 함께 학생 성적 리포트 실사용 검증용.",
  });
  return Number(student.id);
}

async function submitAnswersByApi(
  request: APIRequestContext,
  studentToken: string,
  examId: number,
  questionIds: number[],
  answers: string[],
): Promise<void> {
  const submit = await apiFetch(
    request,
    "POST",
    `/student/exams/${examId}/submit/`,
    studentToken,
    {
      answers: questionIds.map((id, idx) => ({
        exam_question_id: id,
        answer: answers[idx] ?? "",
      })),
    },
  );
  expect(
    submit.status,
    `peer submit -> ${submit.status} ${JSON.stringify(submit.body)}`,
  ).toBe(201);
}

async function waitForResult(
  request: APIRequestContext,
  studentToken: string,
  examId: number,
): Promise<any> {
  let latest: { status: number; body: any } | null = null;
  await waitForCondition(
    async () => {
      latest = await apiFetch(request, "GET", `/student/results/me/exams/${examId}/`, studentToken);
      return latest.status === 200;
    },
    { timeoutMs: 30_000, intervalMs: 750, description: "student exam result sync" },
  );
  return latest?.body;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  const token = created.adminAccess;
  if (!token) return;

  const safe = async (
    method: string,
    path: string,
    data?: Record<string, unknown>,
    options?: { logFailure?: boolean },
  ) => {
    let out: { status: number; body: unknown };
    try {
      out = await apiFetch(request, method, path, token, data);
    } catch (error) {
      out = {
        status: 0,
        body: { error: error instanceof Error ? error.message : String(error) },
      };
    }
    if ((options?.logFailure ?? true) && ![200, 202, 204, 404].includes(out.status)) {
      console.log(`cleanup ${method} ${path}: ${out.status} ${JSON.stringify(out.body)}`);
    }
    return out;
  };

  let examRemovedFromSession = true;
  if (created.examId && created.sessionId) {
    const examDelete = await safe(
      "DELETE",
      `/exams/${created.examId}/?session_id=${created.sessionId}`,
      undefined,
      { logFailure: false },
    );
    examRemovedFromSession = [200, 204, 404].includes(examDelete.status);
    if (!examRemovedFromSession) {
      await safe("PATCH", `/exams/${created.examId}/`, {
        is_active: false,
        title: `${EXAM_TITLE} (archived)`,
        close_at: new Date(Date.now() - 60_000).toISOString(),
      });
    }
  }
  for (const id of created.sessionEnrollmentIds) {
    await safe("DELETE", `/enrollments/session-enrollments/${id}/`);
  }
  if (created.primaryEnrollmentId) await safe("DELETE", `/enrollments/${created.primaryEnrollmentId}/`);
  if (created.peerEnrollmentId) await safe("DELETE", `/enrollments/${created.peerEnrollmentId}/`);
  const studentIds = [created.primaryStudentId, created.peerStudentId]
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
  if (studentIds.length > 0) {
    await safe("POST", "/students/bulk_delete/", { ids: studentIds });
    await safe("POST", "/students/bulk_permanent_delete/", { ids: studentIds });
  }
  if (examRemovedFromSession && created.sessionId) await safe("DELETE", `/lectures/sessions/${created.sessionId}/`);
  if (examRemovedFromSession && created.lectureId) await safe("DELETE", `/lectures/lectures/${created.lectureId}/`);
}

test.describe.serial("[E2E] 학생 성적 리포트 실사용 검증", () => {
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("오답 번호, 석차, 정답 비공개 안내가 실제 제출 결과로 보인다", async ({ page, request }) => {
    const adminTokens = await loginToken(request, ADMIN_USER, ADMIN_PASS);
    created.adminAccess = adminTokens.access;

    const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", adminTokens.access, {
      title: LECTURE_TITLE,
      name: "E2E검증",
      subject: "수학",
      description: "학생 성적 리포트 실사용 canary",
      start_date: TODAY_KST,
      lecture_time: "수 19:00 ~ 21:00",
      color: "#2563eb",
      chip_label: "검증",
      is_active: true,
    });
    created.lectureId = Number(lecture.id);

    const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", adminTokens.access, {
      lecture: created.lectureId,
      title: SESSION_TITLE,
      date: TODAY_KST,
      order: 1,
    });
    created.sessionId = Number(session.id);

    created.primaryStudentId = await createStudent(
      request,
      adminTokens.access,
      PRIMARY_STUDENT_NAME,
      PRIMARY_USER,
      PRIMARY_PARENT_PHONE,
    );
    created.peerStudentId = await createStudent(
      request,
      adminTokens.access,
      PEER_STUDENT_NAME,
      PEER_USER,
      PEER_PARENT_PHONE,
    );

    const enrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/bulk_create/",
      adminTokens.access,
      {
        lecture: created.lectureId,
        students: [created.primaryStudentId, created.peerStudentId],
      },
    );
    created.primaryEnrollmentId = Number(enrollments[0].id);
    created.peerEnrollmentId = Number(enrollments[1].id);

    const sessionEnrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/session-enrollments/bulk_create/",
      adminTokens.access,
      {
        session: created.sessionId,
        enrollments: [created.primaryEnrollmentId, created.peerEnrollmentId],
      },
    );
    created.sessionEnrollmentIds = sessionEnrollments.map((row) => Number(row.id));

    const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", adminTokens.access, {
      title: EXAM_TITLE,
      description: "학생 화면 성적표/오답/석차 canary",
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
      adminTokens.access,
      { total_questions: 5, default_score: 20 },
    );
    const questionIdsByNumber = questions
      .sort((a, b) => Number(a.number) - Number(b.number))
      .map((q) => Number(q.id));

    await expectApi(request, "POST", "/exams/answer-keys/", adminTokens.access, {
      exam: created.examId,
      answers: Object.fromEntries(questionIdsByNumber.map((id, idx) => [String(id), String(idx + 1)])),
    });

    await expectApi(
      request,
      "PUT",
      `/exams/${created.examId}/enrollments/?session_id=${created.sessionId}`,
      adminTokens.access,
      { enrollment_ids: [created.primaryEnrollmentId, created.peerEnrollmentId] },
      [200],
    );

    const peerTokens = await loginToken(request, PEER_USER, STUDENT_PASS);
    await submitAnswersByApi(
      request,
      peerTokens.access,
      created.examId,
      questionIdsByNumber,
      ["5", "5", "5", "5", "5"],
    );
    const peerResult = await waitForResult(request, peerTokens.access, created.examId);
    expect(peerResult.total_score).toBe(20);

    const primaryTokens = await loginToken(request, PRIMARY_USER, STUDENT_PASS);
    await seedStudentBrowser(page, primaryTokens);
    await gotoAndSettle(page, `${BASE}/student/exams/${created.examId}/submit`, { timeout: 20_000 });

    await expect(page.getByText(EXAM_TITLE)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("1번 답").fill("1");
    await page.getByLabel("2번 답").fill("4");
    await page.getByLabel("3번 답").fill("3");
    await page.getByLabel("4번 답").fill("4");
    await page.getByLabel("5번 답").fill("1");
    await expect(page.getByText("5/5문항 (100%)")).toBeVisible();

    await page.getByRole("button", { name: "제출하기" }).click();
    await page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출" }).click();
    await page.waitForURL(`**/student/exams/${created.examId}/result`, { timeout: 30_000 });
    await waitForRenderSettled(page, { timeout: 20_000 });

    const primaryResult = await waitForResult(request, primaryTokens.access, created.examId);
    expect(primaryResult.total_score).toBe(60);
    expect(primaryResult.analysis.wrong_count).toBe(2);
    expect(primaryResult.analysis.wrong_question_numbers).toEqual([2, 5]);
    expect(primaryResult.rank).toBe(1);
    expect(primaryResult.cohort_size).toBe(2);
    expect(primaryResult.answers_visible).toBe(false);

    await expect(page.getByTestId("score-analysis-card")).toContainText("핵심 분석");
    await expect(page.getByTestId("score-analysis-card")).toContainText("정답률");
    await expect(page.getByTestId("score-analysis-card")).toContainText("오답");
    await expect(page.getByTestId("wrong-number-chip")).toHaveText(["2", "5"]);
    await expect(page.getByText("정답 내용은 비공개입니다. 틀린 번호와 내 답만 확인할 수 있습니다.")).toBeVisible();
    await expect(page.getByText("내 등수")).toBeVisible();
    await expect(page.getByText("1등")).toBeVisible();
    await expect(page.getByText("/ 2명")).toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/score-report-realuse-result-${TS}.png`, fullPage: true });

    await gotoAndSettle(page, `${BASE}/student/grades`, { timeout: 20_000 });
    await expect(page.getByText(EXAM_TITLE)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("grade-wrong-summary")).toContainText("오답 2문항");
    await expect(page.getByTestId("grade-wrong-summary")).toContainText("2, 5번");
    await expect(page.getByText("1/2등")).toBeVisible();
    await page.screenshot({ path: `e2e/screenshots/score-report-realuse-grades-${TS}.png`, fullPage: true });
  });
});
