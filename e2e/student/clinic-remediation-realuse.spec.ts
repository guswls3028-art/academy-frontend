/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 학생 클리닉 보강 실사용 canary.
 *
 * 실패 성적 -> ClinicLink 대상 생성 -> 학생 클리닉 예약 -> 교사·조교 출석/완료 ->
 * 클리닉 재시험 통과 -> 학생 결과/성적 화면의 REMEDIATED 반영까지 하나의 체인으로 봉인한다.
 */
import { test, expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import { getApiBaseUrl, getBaseUrl, loginTokenViaRequest } from "../helpers/auth";
import { installAccountNotificationGuard } from "../helpers/accountNotificationSafety";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { acknowledgeFirstLoginGuideIfVisible } from "../helpers/firstLoginGuide";
import { gotoAndSettle, waitForCondition, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(480_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const DEVELOPMENT_MODE = process.env.E2E_CLINIC_REMEDIATION_DEVELOPMENT === "1";
const CODE = DEVELOPMENT_MODE
  ? (process.env.E2E_CLINIC_REMEDIATION_TENANT_CODE || "").trim().toLowerCase()
  : "hakwonplus";
const DEVELOPMENT_PASSWORD = process.env.E2E_CLINIC_REMEDIATION_PASSWORD || "";
const ADMIN_USER = process.env.E2E_CLINIC_REMEDIATION_ADMIN || "ymath-qa-teacher";
const STUDENT_PASS = DEVELOPMENT_MODE ? DEVELOPMENT_PASSWORD : "test1234";
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
const ASSISTANT_NAME = `[E2E-${TS}] 조교`;
const ASSISTANT_USER = `e2eas${String(TS).slice(-8)}`;
const SEEDED_STUDENT_NAME = "검증학생 01";
const GENERATED_PARENT_PHONE = `010${String(TS).slice(-8)}`;
const PARENT_PHONE = isProductionApi() ? CONTROLLED_PHONE : GENERATED_PARENT_PHONE;
const TODAY_KST = kstYmd(0);
const CLINIC_DATE = kstYmd(1);

type Tokens = { access: string; refresh: string };

type CreatedState = {
  adminAccess?: string;
  assistantId?: number;
  lectureId?: number;
  sourceSessionId?: number;
  clinicSessionId?: number;
  clinicSessionIds: number[];
  examId?: number;
  studentId?: number;
  enrollmentId?: number;
  sessionEnrollmentIds: number[];
  participantId?: number;
  clinicLinkId?: number;
};

const created: CreatedState = { clinicSessionIds: [], sessionEnrollmentIds: [] };

function isProductionApi(): boolean {
  try {
    const host = new URL(API).hostname.toLowerCase();
    return host === "api.hakwonplus.com";
  } catch {
    return false;
  }
}

function isLoopback(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function assertDevelopmentRuntime(): void {
  if (!DEVELOPMENT_MODE) return;
  if (!/^qa-ymath-realuse-[a-z0-9-]+$/.test(CODE)) {
    throw new Error("Development clinic remediation requires an exact qa-ymath-realuse-* tenant.");
  }
  if (!DEVELOPMENT_PASSWORD) {
    throw new Error("E2E_CLINIC_REMEDIATION_PASSWORD is required in development mode.");
  }
  if (!isLoopback(API) || !isLoopback(BASE)) {
    throw new Error("Development clinic remediation is allowed only through loopback API/UI.");
  }
  if (ALLOW_REAL_NOTIFICATIONS) {
    throw new Error("Real notifications must remain disabled in the isolated development scenario.");
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

function listFrom(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>;
  if (body && typeof body === "object" && Array.isArray((body as { results?: unknown }).results)) {
    return (body as { results: Array<Record<string, unknown>> }).results;
  }
  return [];
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

async function seedBrowser(page: Page, tokens: Tokens): Promise<void> {
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

async function acknowledgeStudentAccountPromptsIfVisible(page: Page): Promise<void> {
  await acknowledgeFirstLoginGuideIfVisible(page);
  const passwordDialog = page.getByRole("dialog", { name: "비밀번호 변경 권장" });
  if (!await passwordDialog.isVisible({ timeout: 2_000 }).catch(() => false)) return;

  await passwordDialog.getByRole("button", { name: "위험을 이해했고 나중에" }).click();
  await expect(passwordDialog).toBeHidden();
  await acknowledgeFirstLoginGuideIfVisible(page);
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
  for (const clinicSessionId of created.clinicSessionIds.reverse()) {
    await safe("DELETE", `/clinic/sessions/${clinicSessionId}/`);
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
  if (created.assistantId) {
    await safe("DELETE", `/staffs/${created.assistantId}/`);
  }
}

test.describe.serial("[E2E] 학생 클리닉 보강 실사용 검증", () => {
  test.describe.configure({ retries: 0 });

  test.beforeAll(() => {
    assertDevelopmentRuntime();
  });

  test.skip(
    isProductionApi() && (!ALLOW_REAL_NOTIFICATIONS || CONTROLLED_PHONE !== "01031217466"),
    "프로덕션 클리닉 canary는 통제 번호 01031217466 명시와 E2E_ALLOW_CLINIC_REAL_NOTIFICATIONS=1이 필요합니다.",
  );

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("실패 성적이 교사·조교의 클리닉 예약/출석/완료 처리 후 학생 패스카드와 함께 바뀐다", async ({ page, request, browser }) => {
    const adminTokens = DEVELOPMENT_MODE
      ? await loginToken(request, ADMIN_USER, DEVELOPMENT_PASSWORD)
      : await loginTokenViaRequest(request, "admin");
    created.adminAccess = adminTokens.access;

    let assistantTokens: Tokens | null = null;
    if (DEVELOPMENT_MODE) {
      const assistant = await expectApi<{ id: number }>(request, "POST", "/staffs/", adminTokens.access, {
        name: ASSISTANT_NAME,
        role: "ASSISTANT",
        username: ASSISTANT_USER,
        password: DEVELOPMENT_PASSWORD,
      });
      created.assistantId = Number(assistant.id);
      assistantTokens = await loginToken(request, ASSISTANT_USER, DEVELOPMENT_PASSWORD);
      const assistantMe = await expectApi<{ is_staff: boolean; tenantRole: string }>(
        request,
        "GET",
        "/core/me/",
        assistantTokens.access,
      );
      expect(assistantMe.is_staff).toBe(false);
      expect(assistantMe.tenantRole).toBe("staff");
    }
    const clinicOperatorAccess = assistantTokens?.access ?? adminTokens.access;

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

    const target = await waitForClinicTarget(request, clinicOperatorAccess);
    created.clinicLinkId = Number(target.clinic_link_id);
    expect(target.student_name).toBe(STUDENT_NAME);
    expect(target.exam_score).toBe(20);
    expect(target.cutline_score).toBe(80);
    expect(target.name_highlight_clinic_target).toBe(true);

    const idcardBeforeBooking = await expectApi<any>(
      request,
      "GET",
      "/clinic/idcard/",
      studentTokens.access,
    );
    expect(idcardBeforeBooking.current_result).toBe("FAIL");
    expect(idcardBeforeBooking.passcard_state).toBe("CLINIC_REQUIRED");
    expect(idcardBeforeBooking.current_targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clinic_link_id: created.clinicLinkId,
          enrollment_id: created.enrollmentId,
          lecture_id: created.lectureId,
          source_type: "exam",
        }),
      ]),
    );

    await seedBrowser(page, studentTokens);
    await gotoAndSettle(page, `${BASE}/student/exams/${created.examId}/result`, { timeout: 25_000 });
    await expect(page.getByRole("heading", { name: "시험 결과" })).toBeVisible({ timeout: 10_000 });
    await acknowledgeStudentAccountPromptsIfVisible(page);
    await expect(page.getByText("20 / 100점")).toBeVisible();
    const clinicCta = page.getByRole("link")
      .filter({ hasText: "클리닉 페이지에서 일정을 예약하세요." });
    await expect(clinicCta).toContainText(/보강 클리닉 대상|오답 미완료/);

    const clinicSlots = [
      { title: `${CLINIC_TITLE} 13시`, startTime: "13:20" },
      { title: `${CLINIC_TITLE} 17시`, startTime: "17:20" },
      { title: `${CLINIC_TITLE} 19시`, startTime: "19:20" },
    ];
    for (const slot of clinicSlots) {
      const clinicSession = await expectApi<{ id: number }>(request, "POST", "/clinic/sessions/", adminTokens.access, {
        title: slot.title,
        date: CLINIC_DATE,
        start_time: slot.startTime,
        duration_minutes: 60,
        location: CLINIC_LOCATION,
        max_participants: 3,
        target_grade: null,
        target_school_type: null,
        target_lecture_ids: [created.lectureId],
      });
      created.clinicSessionIds.push(Number(clinicSession.id));
    }
    created.clinicSessionId = created.clinicSessionIds[1];

    if (assistantTokens) {
      const studentsBody = await expectApi<unknown>(
        request,
        "GET",
        `/students/?search=${encodeURIComponent(SEEDED_STUDENT_NAME)}&page_size=20`,
        assistantTokens.access,
      );
      const seededStudent = listFrom(studentsBody).find((row) => row.name === SEEDED_STUDENT_NAME);
      expect(seededStudent, `Missing disposable student ${SEEDED_STUDENT_NAME}`).toBeTruthy();
      await expectApi(request, "POST", "/clinic/participants/bulk-create/", assistantTokens.access, {
        session_ids: [created.clinicSessionIds[0]],
        student_ids: [Number(seededStudent?.id)],
      });
      const addedRows = await expectApi<unknown>(
        request,
        "GET",
        `/clinic/participants/by_session/?session_id=${created.clinicSessionIds[0]}`,
        assistantTokens.access,
      );
      expect(listFrom(addedRows).some((row) => row.student_name === SEEDED_STUDENT_NAME)).toBe(true);
    }

    await clinicCta.click();
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/student\/clinic/);
    await expect(page.getByRole("tab", { name: "예약하기", exact: true })).toBeVisible();
    await expect(page.getByText("보강이 필요한 항목 1개")).toBeVisible();
    await expect(page.getByText(SESSION_TITLE)).toBeVisible();
    await expect(page.getByText("시험 보강")).toBeVisible();

    const [clinicYear, clinicMonth, clinicDay] = CLINIC_DATE.split("-").map(Number);
    const clinicWeekday = ["일", "월", "화", "수", "목", "금", "토"][
      new Date(clinicYear, clinicMonth - 1, clinicDay).getDay()
    ];
    const clinicDateRegion = page.getByRole("region", {
      name: `${clinicYear}년 ${clinicMonth}월 ${clinicDay}일 ${clinicWeekday}요일`,
    });
    await expect(clinicDateRegion).toContainText("3개 수업");
    await expect(clinicDateRegion.getByRole("button")).toContainText([
      "13:20–14:20",
      "17:20–18:20",
      "19:20–20:20",
    ]);
    const clinicSessionButton = clinicDateRegion.getByRole("button", {
      // CLINIC_TITLE starts with an E2E marker in square brackets. A plain
      // accessible-name match avoids treating that marker as a regex class.
      name: `${CLINIC_TITLE} 17시`,
    });
    await expect(clinicSessionButton).toBeVisible();
    await expect(clinicSessionButton.getByText("내 보강과 맞음")).toBeVisible();
    await clinicSessionButton.click();
    await page.getByLabel("학원에 전할 내용 (선택)").fill("E2E 보강 예약 중복/반영 검증");

    const bookingButton = page.getByRole("button", { name: "이 일정 예약하기" });
    const box = await bookingButton.boundingBox();
    await bookingButton.click();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 2 });
    }
    await expect(page.getByRole("tab", { name: /내 일정/ })).toContainText("1", { timeout: 15_000 });
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.getByText(/승인 대기|예약 확정/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(CLINIC_LOCATION)).toBeVisible();

    const participant = await waitForParticipant(request, clinicOperatorAccess);
    created.participantId = Number(participant.id);
    expect(["pending", "booked"]).toContain(participant.status);
    expect(participant.name_highlight_clinic_target).toBe(participant.status === "pending");
    expect(Number(participant.enrollment_id)).toBe(created.enrollmentId);

    let confirmedParticipant = participant;
    if (participant.status === "pending" && assistantTokens) {
      const assistantContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const assistantPage = await assistantContext.newPage();
      installAccountNotificationGuard(assistantPage.request);
      const strictAssistant = attachStrictBrowserGuards(assistantPage);
      try {
        await seedBrowser(assistantPage, assistantTokens);
        await assistantPage.evaluate((tenantCode) => {
          localStorage.setItem(`${tenantCode}:theme`, "modern-white");
          document.documentElement.setAttribute("data-theme", "modern-white");
        }, CODE);
        await gotoAndSettle(assistantPage, `${BASE}/workspace/mobile/clinic`, { timeout: 30_000 });
        await acknowledgeFirstLoginGuideIfVisible(assistantPage);
        const dateInputs = assistantPage.locator('input[type="date"]');
        await dateInputs.nth(0).fill(CLINIC_DATE);
        await dateInputs.nth(1).fill(CLINIC_DATE);
        await assistantPage.getByRole("button", { name: `${CLINIC_TITLE} 17시` }).click();

        const participantRow = assistantPage.getByTestId(`teacher-clinic-participant-${created.participantId}`);
        await expect(participantRow).toContainText("승인 대기");
        const lightHighlight = participantRow.locator(".ds-student-name--clinic-highlight");
        await expect(lightHighlight).toHaveText(STUDENT_NAME);
        const lightHighlightColor = await lightHighlight.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        );
        expect(lightHighlightColor).not.toBe("rgba(0, 0, 0, 0)");
        await participantRow.getByRole("button", { name: "예약 승인" }).click();
        await expect(participantRow).toContainText("미등원", { timeout: 15_000 });
        await expect(participantRow.locator(".ds-student-name--clinic-highlight")).toHaveCount(0);
        expect(await assistantPage.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        const bookedCard = await expectApi<any>(request, "GET", "/clinic/idcard/", studentTokens.access);
        expect(bookedCard.passcard_state).toBe("BOOKING_CONFIRMED");
        expect(bookedCard.booking_status).toBe("booked");

        await page.evaluate(() => {
          localStorage.setItem("hakwonplus:student-theme-mode", "light");
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoAndSettle(page, `${BASE}/student/idcard`, { timeout: 20_000 });
        const bookedPasscard = page.getByTestId("clinic-passcard");
        await expect(bookedPasscard.getByRole("heading", { name: "예약완료" })).toBeVisible();
        await expect(bookedPasscard.locator(".ds-student-name--clinic-highlight")).toHaveCount(0);
        expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        const readBookedPalette = () => bookedPasscard.evaluate((passcard) => {
          const selectors = [
            ".clinic-idcard__aurora",
            ".clinic-idcard__header",
            ".clinic-idcard__verdict",
            ".clinic-idcard__booking",
            ".clinic-idcard__history",
          ];
          return selectors.map((selector) => {
            const element = passcard.querySelector<HTMLElement>(selector);
            if (!element) throw new Error(`Missing passcard element: ${selector}`);
            const style = getComputedStyle(element);
            return [style.backgroundColor, style.backgroundImage, style.borderColor, style.color];
          });
        });
        const lightBookedPalette = await readBookedPalette();
        await page.evaluate(() => {
          localStorage.setItem("hakwonplus:student-theme-mode", "dark");
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator('[data-app="student"][data-student-dark="true"]')).toBeVisible();
        await expect(bookedPasscard.getByRole("heading", { name: "예약완료" })).toBeVisible();
        expect(await readBookedPalette()).toEqual(lightBookedPalette);

        await assistantPage.reload({ waitUntil: "domcontentloaded" });
        await dateInputs.nth(0).fill(CLINIC_DATE);
        await dateInputs.nth(1).fill(CLINIC_DATE);
        await assistantPage.getByRole("button", { name: `${CLINIC_TITLE} 17시` }).click();
        await expect(participantRow).toContainText("미등원");

        await participantRow.getByRole("button", { name: "등원" }).click();
        await assistantPage.getByRole("dialog", { name: "등원 처리" })
          .getByRole("button", { name: "등원 확정" }).click();
        await expect(participantRow).toContainText("등원", { timeout: 15_000 });
        const attendedRow = await waitForParticipant(request, clinicOperatorAccess);
        expect(attendedRow.status).toBe("attended");
        expect(attendedRow.name_highlight_clinic_target).toBe(false);
        const attendedCard = await expectApi<any>(request, "GET", "/clinic/idcard/", studentTokens.access);
        expect(attendedCard.passcard_state).toBe("BOOKING_CONFIRMED");
        expect(attendedCard.booking_status).toBe("attended");
        await participantRow.getByRole("button", { name: "자율학습 완료" }).click();
        await expect(participantRow.getByRole("button", { name: "완료 취소" })).toBeVisible({ timeout: 15_000 });
        await expect(participantRow.locator(".ds-student-name--clinic-highlight")).toHaveText(STUDENT_NAME);

        await assistantPage.evaluate((tenantCode) => {
          localStorage.setItem(`${tenantCode}:theme`, "modern-dark");
          document.documentElement.setAttribute("data-theme", "modern-dark");
        }, CODE);
        await assistantPage.reload({ waitUntil: "domcontentloaded" });
        await dateInputs.nth(0).fill(CLINIC_DATE);
        await dateInputs.nth(1).fill(CLINIC_DATE);
        await assistantPage.getByRole("button", { name: `${CLINIC_TITLE} 17시` }).click();
        await expect(participantRow.getByRole("button", { name: "완료 취소" })).toBeVisible();
        const darkHighlight = participantRow.locator(".ds-student-name--clinic-highlight");
        await expect(darkHighlight).toHaveText(STUDENT_NAME);
        expect(await darkHighlight.evaluate((element) => getComputedStyle(element).backgroundColor))
          .toBe(lightHighlightColor);
        expect(await assistantPage.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

        await assistantPage.setViewportSize({ width: 1366, height: 900 });
        await expect(participantRow).toBeVisible();
        expect(await assistantPage.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        await assistantPage.screenshot({
          path: `e2e/screenshots/clinic-remediation-assistant-${TS}.png`,
          fullPage: true,
        });
        strictAssistant.assertZeroDefects();
      } finally {
        await assistantContext.close();
      }
      confirmedParticipant = await waitForParticipant(request, clinicOperatorAccess);
      expect(confirmedParticipant.status).toBe("attended");
      expect(confirmedParticipant.completed_at).toBeTruthy();
    } else if (participant.status === "pending") {
      confirmedParticipant = await expectApi<any>(
        request,
        "PATCH",
        `/clinic/participants/${created.participantId}/set_status/`,
        clinicOperatorAccess,
        { status: "booked", memo: "E2E 승인" },
      );
      expect(confirmedParticipant.status).toBe("booked");
    }
    expect(confirmedParticipant.name_highlight_clinic_target).toBe(
      Boolean(confirmedParticipant.completed_at),
    );

    if (!confirmedParticipant.completed_at) {
      await gotoAndSettle(page, `${BASE}/student/clinic`, { timeout: 20_000 });
      await page.getByRole("tab", { name: /내 일정/ }).click();
      await expect(page.getByText("예약 확정").first()).toBeVisible({ timeout: 15_000 });

      const idcardAfterBooking = await expectApi<any>(
        request,
        "GET",
        "/clinic/idcard/",
        studentTokens.access,
      );
      expect(idcardAfterBooking.passcard_state).toBe("BOOKING_CONFIRMED");
      expect(idcardAfterBooking.booking_status).toBe("booked");
    }

    const attended = confirmedParticipant.status === "attended"
      ? confirmedParticipant
      : await expectApi<any>(
          request,
          "PATCH",
          `/clinic/participants/${created.participantId}/set_status/`,
          clinicOperatorAccess,
          { status: "attended", memo: "E2E 등원" },
        );
    expect(attended.status).toBe("attended");
    expect(attended.name_highlight_clinic_target).toBe(Boolean(attended.completed_at));

    if (!attended.completed_at) {
      const idcardDuringClinic = await expectApi<any>(
        request,
        "GET",
        "/clinic/idcard/",
        studentTokens.access,
      );
      expect(idcardDuringClinic.passcard_state).toBe("BOOKING_CONFIRMED");
      expect(idcardDuringClinic.booking_status).toBe("attended");
    }

    const completed = attended.completed_at
      ? attended
      : await expectApi<any>(
          request,
          "POST",
          `/clinic/participants/${created.participantId}/complete/`,
          clinicOperatorAccess,
        );
    expect(completed.status).toBe("attended");
    expect(completed.completed_at).toBeTruthy();
    expect(completed.name_highlight_clinic_target).toBe(true);

    const idcardAfterUnresolvedCompletion = await expectApi<any>(
      request,
      "GET",
      "/clinic/idcard/",
      studentTokens.access,
    );
    expect(idcardAfterUnresolvedCompletion.current_result).toBe("FAIL");
    expect(idcardAfterUnresolvedCompletion.passcard_state).toBe("CLINIC_REQUIRED");
    expect(idcardAfterUnresolvedCompletion.booking_status).toBe("required");

    await gotoAndSettle(page, `${BASE}/student/idcard`, { timeout: 20_000 });
    const unresolvedPasscard = page.getByTestId("clinic-passcard");
    await expect(unresolvedPasscard.getByRole("heading", { name: /대상자|오답 미완료/ })).toBeVisible();
    await expect(unresolvedPasscard.locator(".ds-student-name--clinic-highlight")).toHaveText(STUDENT_NAME);
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(unresolvedPasscard.getByRole("heading", { name: /대상자|오답 미완료/ })).toBeVisible();
    await expect(unresolvedPasscard.locator(".ds-student-name--clinic-highlight")).toHaveText(STUDENT_NAME);

    const retake = await expectApi<any>(
      request,
      "POST",
      `/progress/clinic-links/${created.clinicLinkId}/submit-retake/`,
      clinicOperatorAccess,
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

    const idcardAfterRemediation = await expectApi<any>(
      request,
      "GET",
      "/clinic/idcard/",
      studentTokens.access,
    );
    expect(idcardAfterRemediation.current_result).toBe("SUCCESS");
    expect(idcardAfterRemediation.passcard_state).toBe("PASSED");

    await gotoAndSettle(page, `${BASE}/student/idcard`, { timeout: 20_000 });
    const passedPasscard = page.getByTestId("clinic-passcard");
    await expect(passedPasscard.getByRole("heading", { name: /합격자|오답 완료/ })).toBeVisible();
    await expect(passedPasscard.locator(".ds-student-name--clinic-highlight")).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(passedPasscard.getByRole("heading", { name: /합격자|오답 완료/ })).toBeVisible();
    await expect(passedPasscard.locator(".ds-student-name--clinic-highlight")).toHaveCount(0);
    await page.setViewportSize({ width: 1366, height: 900 });
    await expect(passedPasscard).toBeVisible();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    await gotoAndSettle(page, `${BASE}/student/exams/${created.examId}/result`, { timeout: 25_000 });
    await expect(page.getByText("20 / 100점")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link").filter({ hasText: "클리닉 페이지에서 일정을 예약하세요." }))
      .toHaveCount(0);

    await gotoAndSettle(page, `${BASE}/student/grades`, { timeout: 25_000 });
    await expect(page.getByText(EXAM_TITLE)).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: `e2e/screenshots/clinic-remediation-realuse-${TS}.png`, fullPage: true });
  });
});
