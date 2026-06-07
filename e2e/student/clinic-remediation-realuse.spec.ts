/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 학생 클리닉 보강 실사용 canary.
 *
 * 실패 성적 -> ClinicLink 대상 생성 -> 학생 클리닉 예약 -> 선생 출석/완료 ->
 * 클리닉 재시험 통과 -> 학생 결과/성적 화면의 REMEDIATED 반영까지 하나의 체인으로 봉인한다.
 */
import { test, expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import { getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle, waitForCondition, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(240_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = "hakwonplus";
const ADMIN_USER = requiredEnv("E2E_ADMIN_USER");
const ADMIN_PASS = requiredEnv("E2E_ADMIN_PASS");
const STUDENT_PASS = "test1234";
const TS = Date.now();

const CONTROLLED_PHONE = (process.env.E2E_CLINIC_CONTROLLED_PHONE || "01031217466").trim();
const ALLOW_REAL_NOTIFICATIONS = process.env.E2E_ALLOW_CLINIC_REAL_NOTIFICATIONS === "1";

const LECTURE_TITLE = `[E2E-${TS}] 클리닉보강`;
const SESSION_TITLE = `[E2E-${TS}] 보강원천 1차시`;
const EXAM_TITLE = `[E2E-${TS}] 보강 필요 시험`;
const CLINIC_TITLE = `[E2E-${TS}] 보강 클리닉`;
const CLINIC_LOCATION = `[E2E-${TS}] 보강실`;
const STUDENT_NAME = `[E2E-${TS}] 보강학생`;
const STUDENT_USER = `e2ecl${String(TS).slice(-8)}`;
const GENERATED_PARENT_PHONE = `010${String(TS).slice(-8)}`;
const PARENT_PHONE = isProductionApi() ? CONTROLLED_PHONE : GENERATED_PARENT_PHONE;
const TODAY_KST = kstYmd(0);
const CLINIC_DATE = kstYmd(1);

type Tokens = { access: string; refresh: string };

type CreatedState = {
  adminAccess?: string;
  lectureId?: number;
  sourceSessionId?: number;
  clinicSessionId?: number;
  examId?: number;
  studentId?: number;
  enrollmentId?: number;
  sessionEnrollmentIds: number[];
  participantId?: number;
  clinicLinkId?: number;
};

const created: CreatedState = { sessionEnrollmentIds: [] };

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing required env ${name}. See .env.e2e.example.`);
}

function isProductionApi(): boolean {
  try {
    const host = new URL(API).hostname.toLowerCase();
    return host === "api.hakwonplus.com";
  } catch {
    return false;
  }
}

function kstYmd(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
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

async function createStudent(request: APIRequestContext, token: string): Promise<number> {
  const student = await expectApi<{ id: number }>(request, "POST", "/students/", token, {
    name: STUDENT_NAME,
    parent_phone: PARENT_PHONE,
    ps_number: STUDENT_USER,
    no_phone: true,
    school_type: "HIGH",
    grade: 1,
    initial_password: STUDENT_PASS,
    send_welcome_message: false,
    memo: isProductionApi()
      ? "E2E clinic remediation canary. 알림 경로는 통제 번호로만 제한."
      : "E2E clinic remediation canary.",
  });
  return Number(student.id);
}

async function submitAnswersByApi(
  request: APIRequestContext,
  studentToken: string,
  examId: number,
  questionIds: number[],
): Promise<void> {
  const submit = await apiFetch(
    request,
    "POST",
    `/student/exams/${examId}/submit/`,
    studentToken,
    {
      answers: questionIds.map((id) => ({
        exam_question_id: id,
        answer: "5",
      })),
    },
  );
  expect(submit.status, `student submit -> ${submit.status} ${JSON.stringify(submit.body)}`).toBe(201);
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
    { timeoutMs: 45_000, intervalMs: 750, description: "student clinic source result sync" },
  );
  return latest?.body;
}

async function waitForClinicTarget(
  request: APIRequestContext,
  token: string,
): Promise<any> {
  let target: any | null = null;
  await waitForCondition(
    async () => {
      const rows = await expectApi<any[]>(request, "GET", "/results/admin/clinic-targets/", token);
      target = rows.find((row) =>
        Number(row.enrollment_id) === created.enrollmentId &&
        Number(row.source_id) === created.examId &&
        row.source_type === "exam" &&
        Number(row.clinic_link_id) > 0
      ) ?? null;
      return !!target;
    },
    { timeoutMs: 60_000, intervalMs: 1000, description: "ClinicLink target generation" },
  );
  return target;
}

async function waitForParticipant(
  request: APIRequestContext,
  token: string,
): Promise<any> {
  let participant: any | null = null;
  await waitForCondition(
    async () => {
      const rows = await expectApi<any[]>(
        request,
        "GET",
        `/clinic/participants/by_session/?session_id=${created.clinicSessionId}`,
        token,
      );
      participant = rows.find((row) => Number(row.student) === created.studentId) ?? null;
      return !!participant;
    },
    { timeoutMs: 30_000, intervalMs: 750, description: "student clinic booking participant" },
  );
  return participant;
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

  if (created.participantId) {
    await safe("DELETE", `/clinic/participants/${created.participantId}/`);
  }
  if (created.clinicSessionId) {
    await safe("DELETE", `/clinic/sessions/${created.clinicSessionId}/`);
  }

  let examRemovedFromSession = true;
  if (created.examId && created.sourceSessionId) {
    const examDelete = await safe(
      "DELETE",
      `/exams/${created.examId}/?session_id=${created.sourceSessionId}`,
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
  if (created.enrollmentId) await safe("DELETE", `/enrollments/${created.enrollmentId}/`);
  if (created.studentId) {
    await safe("POST", "/students/bulk_delete/", { ids: [created.studentId] });
    await safe("POST", "/students/bulk_permanent_delete/", { ids: [created.studentId] });
  }
  if (examRemovedFromSession && created.sourceSessionId) {
    await safe("DELETE", `/lectures/sessions/${created.sourceSessionId}/`);
  }
  if (examRemovedFromSession && created.lectureId) {
    await safe("DELETE", `/lectures/lectures/${created.lectureId}/`);
  }
}

test.describe.serial("[E2E] 학생 클리닉 보강 실사용 검증", () => {
  test.skip(
    isProductionApi() && (!ALLOW_REAL_NOTIFICATIONS || CONTROLLED_PHONE !== "01031217466"),
    "프로덕션 클리닉 canary는 통제 번호 01031217466 명시와 E2E_ALLOW_CLINIC_REAL_NOTIFICATIONS=1이 필요합니다.",
  );

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("실패 성적이 클리닉 예약/출석/재시험 통과 후 학생 결과에서 보강 합격으로 바뀐다", async ({ page, request }) => {
    const adminTokens = await loginToken(request, ADMIN_USER, ADMIN_PASS);
    created.adminAccess = adminTokens.access;

    const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", adminTokens.access, {
      title: LECTURE_TITLE,
      name: "E2E검증",
      subject: "수학",
      description: "학생 클리닉 보강 실사용 canary",
      start_date: TODAY_KST,
      lecture_time: "화 19:00 ~ 21:00",
      color: "#0f766e",
      chip_label: "보강",
      is_active: true,
    });
    created.lectureId = Number(lecture.id);

    const sourceSession = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", adminTokens.access, {
      lecture: created.lectureId,
      title: SESSION_TITLE,
      date: TODAY_KST,
      order: 1,
    });
    created.sourceSessionId = Number(sourceSession.id);

    created.studentId = await createStudent(request, adminTokens.access);

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
      { session: created.sourceSessionId, enrollments: [created.enrollmentId] },
    );
    created.sessionEnrollmentIds = sessionEnrollments.map((row) => Number(row.id));

    const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", adminTokens.access, {
      title: EXAM_TITLE,
      description: "보강 대상 생성 및 해소 canary",
      exam_type: "regular",
      session_id: created.sourceSessionId,
      pass_score: 80,
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
      `/exams/${created.examId}/enrollments/?session_id=${created.sourceSessionId}`,
      adminTokens.access,
      { enrollment_ids: [created.enrollmentId] },
      [200],
    );

    const studentTokens = await loginToken(request, STUDENT_USER, STUDENT_PASS);
    await submitAnswersByApi(request, studentTokens.access, created.examId, questionIdsByNumber);

    const failedResult = await waitForResult(request, studentTokens.access, created.examId);
    expect(failedResult.total_score).toBe(20);
    expect(failedResult.is_pass).toBe(false);

    const target = await waitForClinicTarget(request, adminTokens.access);
    created.clinicLinkId = Number(target.clinic_link_id);
    expect(target.student_name).toBe(STUDENT_NAME);
    expect(target.exam_score).toBe(20);
    expect(target.cutline_score).toBe(80);
    expect(target.name_highlight_clinic_target).toBe(true);

    await seedStudentBrowser(page, studentTokens);
    await gotoAndSettle(page, `${BASE}/student/exams/${created.examId}/result`, { timeout: 25_000 });
    await expect(page.getByRole("heading", { name: "시험 결과" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("20 / 100점")).toBeVisible();
    await expect(page.getByText("보강 클리닉 대상")).toBeVisible();
    await expect(page.getByText("클리닉 페이지에서 일정을 예약하세요.")).toBeVisible();

    const clinicSession = await expectApi<{ id: number }>(request, "POST", "/clinic/sessions/", adminTokens.access, {
      title: CLINIC_TITLE,
      date: CLINIC_DATE,
      start_time: "16:20",
      duration_minutes: 60,
      location: CLINIC_LOCATION,
      max_participants: 3,
      target_grade: null,
      target_school_type: null,
      target_lecture_ids: [created.lectureId],
    });
    created.clinicSessionId = Number(clinicSession.id);

    await page.getByRole("link", { name: /보강 클리닉 대상/ }).click();
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/student\/clinic/);
    await expect(page.getByRole("button", { name: "예약" })).toBeVisible();

    await page.getByRole("button", { name: String(Number(CLINIC_DATE.slice(-2))), exact: true }).click();
    await expect(page.getByText(`${CLINIC_DATE} 예약하기`)).toBeVisible();
    const clinicSessionButton = page.locator("button").filter({ hasText: CLINIC_TITLE }).first();
    await expect(clinicSessionButton).toBeVisible();
    await clinicSessionButton.click();
    await page.getByPlaceholder("예약 시 참고사항을 입력해주세요.").fill("E2E 보강 예약 중복/반영 검증");

    const bookingButton = page.getByRole("button", { name: "예약 신청하기" });
    const box = await bookingButton.boundingBox();
    await bookingButton.click();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 2 });
    }
    await expect(page.getByRole("button", { name: /내 일정/ })).toContainText("1", { timeout: 15_000 });
    await page.getByRole("button", { name: /내 일정/ }).click();
    await expect(page.getByText(/승인 대기|승인됨/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(CLINIC_LOCATION)).toBeVisible();

    const participant = await waitForParticipant(request, adminTokens.access);
    created.participantId = Number(participant.id);
    expect(["pending", "booked"]).toContain(participant.status);
    expect(participant.name_highlight_clinic_target).toBe(true);
    expect(Number(participant.enrollment_id)).toBe(created.enrollmentId);

    if (participant.status === "pending") {
      const booked = await expectApi<any>(
        request,
        "PATCH",
        `/clinic/participants/${created.participantId}/set_status/`,
        adminTokens.access,
        { status: "booked", memo: "E2E 승인" },
      );
      expect(booked.status).toBe("booked");
    }

    await gotoAndSettle(page, `${BASE}/student/clinic`, { timeout: 20_000 });
    await page.getByRole("button", { name: /내 일정/ }).click();
    await expect(page.getByText("승인됨").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("확정")).toBeVisible();

    const completed = await expectApi<any>(
      request,
      "POST",
      `/clinic/participants/${created.participantId}/complete/`,
      adminTokens.access,
    );
    expect(completed.status).toBe("attended");
    expect(completed.completed_at).toBeTruthy();
    expect(completed.name_highlight_clinic_target).toBe(false);

    const retake = await expectApi<any>(
      request,
      "POST",
      `/progress/clinic-links/${created.clinicLinkId}/submit-retake/`,
      adminTokens.access,
      { score: 90, max_score: 100, pass_score: 80 },
    );
    expect(retake.passed).toBe(true);
    expect(retake.resolution_type).toBe("EXAM_PASS");
    expect(retake.attempt_index).toBe(2);

    let remediatedResult: any | null = null;
    let remediatedStatus = 0;
    try {
      await waitForCondition(
        async () => {
          const out = await apiFetch(request, "GET", `/student/results/me/exams/${created.examId}/`, studentTokens.access);
          remediatedStatus = out.status;
          remediatedResult = out.body;
          return out.status === 200 &&
            remediatedResult.remediated === true &&
            remediatedResult.final_pass === true &&
            remediatedResult.clinic_required === false;
        },
        { timeoutMs: 45_000, intervalMs: 1000, description: "student remediated result projection" },
      );
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; latest=${JSON.stringify({
          status: remediatedStatus,
          remediated: remediatedResult?.remediated,
          final_pass: remediatedResult?.final_pass,
          clinic_required: remediatedResult?.clinic_required,
          clinic_retake: remediatedResult?.clinic_retake,
          achievement: remediatedResult?.achievement,
        })}`,
      );
    }
    expect(remediatedResult?.clinic_retake?.score).toBe(90);
    expect(remediatedResult?.clinic_retake?.pass_score).toBe(80);

    const unresolvedRows = await expectApi<any[]>(request, "GET", "/results/admin/clinic-targets/", adminTokens.access);
    expect(unresolvedRows.some((row) => Number(row.clinic_link_id) === created.clinicLinkId)).toBe(false);

    await gotoAndSettle(page, `${BASE}/student/exams/${created.examId}/result`, { timeout: 25_000 });
    await expect(page.getByText("클리닉 재시험 통과")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("90점")).toBeVisible();
    await expect(page.getByText("보강 클리닉 대상")).not.toBeVisible();

    await gotoAndSettle(page, `${BASE}/student/grades`, { timeout: 25_000 });
    await expect(page.getByText(EXAM_TITLE)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("보강 합격")).toBeVisible();

    await page.screenshot({ path: `e2e/screenshots/clinic-remediation-realuse-${TS}.png`, fullPage: true });
  });
});
