/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OMR 업로드/검토/재채점 실사용 canary.
 *
 * 운영 API로 강의/차시/학생/시험/OMR PDF를 만들고, 학원장 UI에서 실제 업로드와
 * OMR 검토 워크스페이스 저장을 통과한 뒤 학생 성적 projection까지 확인한다.
 */
import { test, expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import { getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(360_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const STUDENT_PASS = "test1234";
const TS = Date.now();
const TODAY_KST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

const LECTURE_TITLE = `[E2E-${TS}] OMR실사용`;
const SESSION_TITLE = `[E2E-${TS}] OMR 1차시`;
const EXAM_TITLE = `[E2E-${TS}] OMR 업로드 검토 재채점`;
const STUDENT_NAME = `[E2E-${TS}] OMR학생`;
const STUDENT_USER = `e2eomr${String(TS).slice(-8)}`;
const PARENT_PHONE = `010${String(TS).slice(-8)}`;
const EXPECTED_ANSWERS = ["1", "2", "4", "4", "1"];
const EXPECTED_SCORE = 60;

type Tokens = { access: string; refresh: string };

type CreatedState = {
  adminAccess?: string;
  lectureId?: number;
  sessionId?: number;
  examId?: number;
  studentId?: number;
  enrollmentId?: number;
  sessionEnrollmentIds: number[];
  submissionIds: number[];
};

const created: CreatedState = { sessionEnrollmentIds: [], submissionIds: [] };

function headers(token: string, contentType = "application/json"): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": contentType,
    "X-Tenant-Code": CODE,
  };
}

async function loginToken(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<Tokens> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username, password, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  return await resp.json() as Tokens;
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
    timeout: 90_000,
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

async function seedBrowser(page: Page, tokens: Tokens, landingPath: string): Promise<void> {
  const payload = { access: tokens.access, refresh: tokens.refresh, code: CODE };
  await page.addInitScript(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, payload);

  await page.goto(`${BASE}/login`, { waitUntil: "commit", timeout: 30_000 });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, payload);
  await gotoAndSettle(page, `${BASE}${landingPath}`, { timeout: 45_000 });
}

async function downloadOmrPdf(
  request: APIRequestContext,
  token: string,
  examId: number,
): Promise<Buffer> {
  const resp = await request.post(`${API}/api/v1/exams/${examId}/omr/pdf/`, {
    data: {
      exam_title: EXAM_TITLE,
      lecture_name: LECTURE_TITLE,
      session_name: SESSION_TITLE,
      mc_count: 5,
      essay_count: 0,
      n_choices: 5,
    },
    headers: headers(token),
    timeout: 180_000,
  });
  expect(resp.status(), `OMR PDF generation -> ${resp.status()} ${await resp.text().catch(() => "")}`).toBe(200);
  return await resp.body();
}

async function waitForOmrAnswers(
  request: APIRequestContext,
  token: string,
  submissionId: number,
  expectedCount: number,
): Promise<any> {
  const deadline = Date.now() + 240_000;
  let latest: { status: number; body: any } | null = null;

  while (Date.now() < deadline) {
    latest = await apiFetch(request, "GET", `/submissions/submissions/${submissionId}/manual-edit/`, token);
    if (
      latest.status === 200 &&
      Array.isArray(latest.body?.answers) &&
      latest.body.answers.length >= expectedCount
    ) {
      return latest.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error(
    `OMR worker did not persist ${expectedCount} answers for submission ${submissionId}. ` +
    `latest=${JSON.stringify(latest?.body ?? null).slice(0, 1200)}`,
  );
}

async function waitForStudentResult(
  request: APIRequestContext,
  studentToken: string,
  examId: number,
): Promise<any> {
  const deadline = Date.now() + 60_000;
  let latest: { status: number; body: any } | null = null;
  while (Date.now() < deadline) {
    latest = await apiFetch(request, "GET", `/student/results/me/exams/${examId}/`, studentToken);
    if (latest.status === 200) return latest.body;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`student result not visible: ${JSON.stringify(latest?.body ?? null)}`);
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

  for (const id of created.submissionIds) {
    await safe("DELETE", `/submissions/submissions/${id}/`, undefined, { logFailure: false });
  }
  if (created.examId && created.sessionId) {
    const examDelete = await safe(
      "DELETE",
      `/exams/${created.examId}/?session_id=${created.sessionId}`,
      undefined,
      { logFailure: false },
    );
    if (![200, 204, 404].includes(examDelete.status)) {
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
  if (created.enrollmentId) await safe("DELETE", `/enrollments/${created.enrollmentId}/`);
  if (created.studentId) {
    await safe("POST", "/students/bulk_delete/", { ids: [created.studentId] });
    await safe("POST", "/students/bulk_permanent_delete/", { ids: [created.studentId] });
  }
  if (created.sessionId) await safe("DELETE", `/lectures/sessions/${created.sessionId}/`, undefined, { logFailure: false });
  if (created.lectureId) await safe("DELETE", `/lectures/lectures/${created.lectureId}/`, undefined, { logFailure: false });
}

test.describe.serial("[E2E] OMR 업로드/검토/재채점 실사용 검증", () => {
  test.describe.configure({ retries: 0 });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("OMR PDF 업로드 후 운영자 리뷰 저장이 성적과 학생 화면에 반영된다", async ({ page, request }) => {
    const adminTokens = await loginToken(request, ADMIN_USER, ADMIN_PASS);
    created.adminAccess = adminTokens.access;

    const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", adminTokens.access, {
      title: LECTURE_TITLE,
      name: "E2E검증",
      subject: "수학",
      description: "OMR 업로드/검토/재채점 실사용 canary",
      start_date: TODAY_KST,
      lecture_time: "목 19:00 ~ 21:00",
      color: "#0f766e",
      chip_label: "OM",
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

    const student = await expectApi<{ id: number }>(request, "POST", "/students/", adminTokens.access, {
      name: STUDENT_NAME,
      parent_phone: PARENT_PHONE,
      ps_number: STUDENT_USER,
      no_phone: true,
      school_type: "HIGH",
      grade: 1,
      initial_password: STUDENT_PASS,
      memo: "E2E OMR canary. 계정 안내 필수 발송 정책과 함께 OMR 업로드/검토 검증용.",
    });
    created.studentId = Number(student.id);

    const enrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/bulk_create/",
      adminTokens.access,
      { lecture: created.lectureId, students: [created.studentId] },
    );
    created.enrollmentId = Number(enrollments[0].id);

    const sessionEnrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/session-enrollments/bulk_create/",
      adminTokens.access,
      { session: created.sessionId, enrollments: [created.enrollmentId] },
    );
    created.sessionEnrollmentIds = sessionEnrollments.map((row) => Number(row.id));

    const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", adminTokens.access, {
      title: EXAM_TITLE,
      description: "OMR blank PDF -> manual review -> regrade canary",
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
      { enrollment_ids: [created.enrollmentId] },
      [200],
    );

    const pdfBuffer = await downloadOmrPdf(request, adminTokens.access, created.examId);

    await seedBrowser(
      page,
      adminTokens,
      `/admin/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`,
    );
    await expect(page.getByRole("button", { name: "OMR 스캔 등록" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "OMR 스캔 등록" }).click();
    await expect(page.locator(".admin-omr-upload").getByText("스캔 파일 선택")).toBeVisible({ timeout: 10_000 });

    await page.locator(".admin-omr-upload input[type='file']").setInputFiles({
      name: `omr-realuse-${TS}.pdf`,
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });
    await expect(page.getByText(`omr-realuse-${TS}.pdf`)).toBeVisible();

    const uploadResponsePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === "POST" &&
        resp.url().includes(`/submissions/submissions/exams/${created.examId}/omr/batch/`),
      { timeout: 90_000 },
    );
    await page.getByRole("button", { name: "등록 시작" }).click();
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    const uploadBody = await uploadResponse.json() as { submission_ids?: number[] };
    created.submissionIds = (uploadBody.submission_ids ?? []).map((id) => Number(id));
    expect(created.submissionIds.length).toBe(1);

    const submissionId = created.submissionIds[0];
    await expect(page.getByText("등록을 시작했습니다. 잠시 후 성적표에 반영됩니다.")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "닫기" }).click();

    const reviewDetail = await waitForOmrAnswers(
      request,
      adminTokens.access,
      submissionId,
      questionIdsByNumber.length,
    );
    expect(reviewDetail.answers.map((row: any) => Number(row.question_id)).sort((a: number, b: number) => a - b))
      .toEqual([...questionIdsByNumber].sort((a, b) => a - b));

    await gotoAndSettle(
      page,
      `${BASE}/admin/lectures/${created.lectureId}/sessions/${created.sessionId}/exams?examId=${created.examId}`,
      { timeout: 45_000 },
    );
    await page.getByRole("tab", { name: "채점·결과" }).click();
    await expect(page.getByText("OMR 검토")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /처리하기|OMR 다시 보기/ }).click();
    await expect(page.getByRole("dialog", { name: "OMR 검토" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".orw-q-row")).toHaveCount(questionIdsByNumber.length, { timeout: 30_000 });

    const pickButton = page.getByRole("button", { name: "학생 검색·연결" });
    if (await pickButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pickButton.click();
      await page.locator(".spm-search").fill(STUDENT_NAME);
      await expect(page.getByRole("button", { name: new RegExp(STUDENT_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }))
        .toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: new RegExp(STUDENT_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
      await expect(page.locator(".orw-identifier__picked")).toContainText(STUDENT_NAME, { timeout: 10_000 });
    }

    for (let i = 0; i < EXPECTED_ANSWERS.length; i += 1) {
      const row = page.locator(".orw-q-row").nth(i);
      const bubbleCount = await row.locator(".orw-bubble").count();
      if (bubbleCount > 0) {
        await row.getByRole("button", { name: EXPECTED_ANSWERS[i], exact: true }).click();
      } else {
        await row.locator("input.orw-essay-input").fill(EXPECTED_ANSWERS[i]);
      }
    }

    const saveResponsePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === "POST" &&
        resp.url().includes(`/submissions/submissions/${submissionId}/manual-edit/`),
      { timeout: 90_000 },
    );
    await page.getByRole("button", { name: "저장 + 재채점" }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(200);
    const saveBody = await saveResponse.json() as { graded?: boolean; score?: number; total_score?: number };
    expect(saveBody.graded).toBe(true);
    expect(saveBody.score ?? saveBody.total_score).toBe(EXPECTED_SCORE);

    await expect(page.getByText(`저장 + 재채점 완료: ${EXPECTED_SCORE}점`)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".orw-list-row__score").filter({ hasText: `${EXPECTED_SCORE}점` }))
      .toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `e2e/screenshots/omr-review-realuse-admin-${TS}.png`, fullPage: true });

    const studentTokens = await loginToken(request, STUDENT_USER, STUDENT_PASS);
    const studentResult = await waitForStudentResult(request, studentTokens.access, created.examId);
    expect(studentResult.total_score).toBe(EXPECTED_SCORE);
    expect(studentResult.analysis.wrong_question_numbers).toEqual([3, 5]);

    await seedBrowser(page, studentTokens, "/student/grades");
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.getByText(EXAM_TITLE)).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `e2e/screenshots/omr-review-realuse-student-${TS}.png`, fullPage: true });
  });
});
