/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 학생 과제 제출 실사용 canary.
 *
 * Admin API로 최소 fixture(강의 -> 차시 -> 학생 -> 과제 -> 배정)를 만들고,
 * 학생 UI에서 실제 파일 제출 후 관리자 점수 입력 API와 학생 성적 화면 반영까지 검증한다.
 * Setup/cleanup은 API, 학생 제출과 학생 projection은 UI/API로 확인한다.
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
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const STUDENT_PASS = "test1234";
const TS = Date.now();
const TODAY_KST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

const LECTURE_TITLE = `[E2E-${TS}] 과제체인`;
const SESSION_TITLE = `[E2E-${TS}] 과제 1차시`;
const HOMEWORK_TITLE = `[E2E-${TS}] 과제 제출 채점 검증`;
const STUDENT_NAME = `[E2E-${TS}] 과제학생`;
const STUDENT_USER = `e2ehw${String(TS).slice(-8)}`;
const PARENT_PHONE = `010${String(TS).slice(-8)}`;

type Tokens = { access: string; refresh: string };

type CreatedState = {
  adminAccess?: string;
  lectureId?: number;
  sessionId?: number;
  homeworkId?: number;
  studentId?: number;
  enrollmentId?: number;
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
  expect(resp.status(), `token ${username} -> ${resp.status()} ${await resp.text().catch(() => "")}`).toBe(200);
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

  let homeworkRemovedFromSession = true;
  if (created.homeworkId) {
    const hwDelete = await safe("DELETE", `/homeworks/${created.homeworkId}/`, undefined, { logFailure: false });
    homeworkRemovedFromSession = [200, 204, 404].includes(hwDelete.status);
  }
  for (const id of created.sessionEnrollmentIds) {
    await safe("DELETE", `/enrollments/session-enrollments/${id}/`);
  }
  if (created.enrollmentId) await safe("DELETE", `/enrollments/${created.enrollmentId}/`);
  if (created.studentId) {
    await safe("POST", "/students/bulk_delete/", { ids: [created.studentId] });
    await safe("POST", "/students/bulk_permanent_delete/", { ids: [created.studentId] });
  }
  if (homeworkRemovedFromSession && created.sessionId) await safe("DELETE", `/lectures/sessions/${created.sessionId}/`);
  if (homeworkRemovedFromSession && created.lectureId) await safe("DELETE", `/lectures/lectures/${created.lectureId}/`);
}

async function waitForHomeworkSummary(
  request: APIRequestContext,
  studentToken: string,
  predicate: (row: any) => boolean,
): Promise<any> {
  let latest: any | undefined;
  await waitForCondition(
    async () => {
      const out = await apiFetch<any>(request, "GET", "/student/grades/", studentToken);
      if (out.status !== 200) return false;
      latest = (out.body?.homeworks ?? []).find((row: any) => Number(row.homework_id) === created.homeworkId);
      return !!latest && predicate(latest);
    },
    { timeoutMs: 30_000, intervalMs: 750, description: "student homework summary sync" },
  );
  return latest;
}

test.describe.serial("[E2E] 학생 과제 제출 실사용 검증", () => {
  test.describe.configure({ retries: 0 });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("과제 배정, 학생 파일 제출, 관리자 채점, 학생 성적 반영이 이어진다", async ({ page, request }) => {
    const adminTokens = await loginToken(request, ADMIN_USER, ADMIN_PASS);
    created.adminAccess = adminTokens.access;

    const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", adminTokens.access, {
      title: LECTURE_TITLE,
      name: "E2E검증",
      subject: "수학",
      description: "학생 과제 제출 실사용 canary",
      start_date: TODAY_KST,
      lecture_time: "목 19:00 ~ 21:00",
      color: "#0f766e",
      chip_label: "과제",
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
      send_welcome_message: false,
      memo: "E2E homework submission canary. 알림톡 발송 없이 과제 제출/채점/학생 성적 반영 검증용.",
    });
    created.studentId = Number(student.id);

    const enrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/bulk_create/",
      adminTokens.access,
      {
        lecture: created.lectureId,
        students: [created.studentId],
      },
    );
    created.enrollmentId = Number(enrollments[0].id);

    const sessionEnrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/session-enrollments/bulk_create/",
      adminTokens.access,
      {
        session: created.sessionId,
        enrollments: [created.enrollmentId],
      },
    );
    created.sessionEnrollmentIds = sessionEnrollments.map((row) => Number(row.id));

    const homework = await expectApi<{ id: number }>(request, "POST", "/homeworks/", adminTokens.access, {
      session_id: created.sessionId,
      session: created.sessionId,
      title: HOMEWORK_TITLE,
    });
    created.homeworkId = Number(homework.id);

    await expectApi(
      request,
      "PUT",
      `/homework/assignments/?homework_id=${created.homeworkId}`,
      adminTokens.access,
      { enrollment_ids: [created.enrollmentId] },
      [200],
    );

    const studentTokens = await loginToken(request, STUDENT_USER, STUDENT_PASS);
    await waitForHomeworkSummary(
      request,
      studentTokens.access,
      (row) => row.achievement === "NOT_SUBMITTED" && row.passed === false,
    );

    await seedStudentBrowser(page, studentTokens);
    await gotoAndSettle(page, `${BASE}/student/submit/assignment`, { timeout: 30_000 });
    await waitForRenderSettled(page, { timeout: 20_000 });

    await expect(page.getByRole("heading", { name: "과제 제출" })).toBeVisible();
    await expect(page.getByText(HOMEWORK_TITLE)).toBeVisible({ timeout: 15_000 });
    await page.getByText(HOMEWORK_TITLE).click();

    const fileInput = page.locator("input[type='file']").first();
    await fileInput.setInputFiles({
      name: `homework-${TS}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.getByText(`homework-${TS}.png`).first()).toBeVisible();

    await page.getByRole("button", { name: "제출하기" }).click();
    await expect(page.getByText("제출이 완료되었습니다.").first()).toBeVisible({ timeout: 30_000 });

    const score = await expectApi<any>(
      request,
      "PATCH",
      "/homework/scores/quick/",
      adminTokens.access,
      {
        session_id: created.sessionId,
        enrollment_id: created.enrollmentId,
        homework_id: created.homeworkId,
        score: 92,
        max_score: 100,
      },
      [200],
    );
    expect(Number(score.score)).toBe(92);
    expect(score.passed).toBe(true);

    const passedSummary = await waitForHomeworkSummary(
      request,
      studentTokens.access,
      (row) => Number(row.score) === 92 && row.passed === true && row.achievement === "PASS",
    );
    expect(passedSummary.title).toBe(HOMEWORK_TITLE);

    await gotoAndSettle(page, `${BASE}/student/grades`, { timeout: 30_000 });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await page.getByRole("button", { name: "과제 현황" }).click();
    await expect(page.getByText(HOMEWORK_TITLE).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/92\s*\/\s*100|92점|92/).first()).toBeVisible({ timeout: 15_000 });
  });
});
