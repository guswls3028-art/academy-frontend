/**
 * Persistent-development clinic multi-slot canary.
 *
 * Provision and destroy the owning qa-ymath-realuse-* tenant with the backend
 * setup_ymath_realuse_scenario command. This spec creates only clinic rows and
 * removes them itself; the outer QA run must still destroy the tenant and prove
 * remaining.tenants/users are both zero.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";

import { getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { acknowledgeFirstLoginGuideIfVisible } from "../helpers/firstLoginGuide";
import { installAccountNotificationGuard } from "../helpers/accountNotificationSafety";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(240_000);

const ENABLED = process.env.E2E_CLINIC_MULTI_SLOT_REALUSE === "1";
const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = (process.env.E2E_CLINIC_MULTI_SLOT_TENANT_CODE || "").trim().toLowerCase();
const PASSWORD = process.env.E2E_CLINIC_MULTI_SLOT_PASSWORD || "";
const TEACHER_USER = process.env.E2E_CLINIC_MULTI_SLOT_TEACHER || "ymath-qa-teacher";
const STUDENT_USER = process.env.E2E_CLINIC_MULTI_SLOT_STUDENT || "ymath-qa-student-01";
const SECOND_STUDENT_NAME = process.env.E2E_CLINIC_MULTI_SLOT_SECOND_STUDENT || "검증학생 02";
const MARKER = `[multi-slot-${Date.now()}]`;
const CLINIC_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

type Tokens = { access: string; refresh: string };
type ApiResult<T> = { status: number; body: T };
type SessionRow = { id: number; title: string };
type ParticipantRow = { id: number; student: number; student_name?: string; status: string };

const created = {
  teacherAccess: "",
  sessionIds: [] as number[],
};

function isLoopback(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function assertIsolatedRuntime(): void {
  if (!/^qa-ymath-realuse-[a-z0-9-]+$/.test(CODE)) {
    throw new Error("E2E_CLINIC_MULTI_SLOT_TENANT_CODE must be an exact qa-ymath-realuse-* tenant.");
  }
  if (!PASSWORD) {
    throw new Error("E2E_CLINIC_MULTI_SLOT_PASSWORD is required for the disposable scenario.");
  }
  if (!isLoopback(API) || !isLoopback(BASE)) {
    throw new Error("Clinic multi-slot real-use is allowed only through loopback development API/UI.");
  }
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

async function login(
  request: APIRequestContext,
  username: string,
): Promise<Tokens> {
  const response = await request.post(`${API}/api/v1/token/`, {
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    data: { username, password: PASSWORD, tenant_code: CODE },
    timeout: 60_000,
  });
  const body = await response.json().catch(() => null);
  expect(response.status(), `login ${username} -> ${response.status()} ${JSON.stringify(body)}`).toBe(200);
  return body as Tokens;
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
  const body = await response.json().catch(() => null) as T;
  return { status: response.status(), body };
}

async function expectApi<T = unknown>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
  statuses: number[] = [200, 201],
): Promise<T> {
  const result = await api<T>(request, method, path, token, data);
  expect(statuses, `${method} ${path} -> ${result.status} ${JSON.stringify(result.body)}`).toContain(result.status);
  return result.body;
}

async function seedBrowser(page: Page, tokens: Tokens): Promise<void> {
  if (new URL(page.url()).origin !== new URL(BASE).origin) {
    await page.goto(`${BASE}/login`, { waitUntil: "commit", timeout: 20_000 });
  }
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: CODE });
}

async function participantsFor(
  request: APIRequestContext,
  sessionId: number,
): Promise<ParticipantRow[]> {
  const body = await expectApi<unknown>(
    request,
    "GET",
    `/clinic/participants/by_session/?session_id=${sessionId}`,
    created.teacherAccess,
  );
  return listFrom(body) as unknown as ParticipantRow[];
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.teacherAccess) return;
  const failures: string[] = [];
  const safe = async <T>(method: string, path: string): Promise<ApiResult<T>> => {
    try {
      return await api<T>(request, method, path, created.teacherAccess);
    } catch (error) {
      return {
        status: 0,
        body: { error: error instanceof Error ? error.message : String(error) } as T,
      };
    }
  };
  const participantIds = new Set<number>();
  for (const sessionId of created.sessionIds) {
    const result = await safe<unknown>(
      "GET",
      `/clinic/participants/by_session/?session_id=${sessionId}`,
    );
    if (result.status === 200) {
      listFrom(result.body).forEach((row) => participantIds.add(Number(row.id)));
    } else if (result.status !== 404) {
      failures.push(`list participants for session ${sessionId} -> ${result.status}`);
    }
  }
  for (const participantId of participantIds) {
    const result = await safe("DELETE", `/clinic/participants/${participantId}/`);
    if (![200, 204, 404].includes(result.status)) {
      failures.push(`delete participant ${participantId} -> ${result.status}`);
    }
  }
  for (const sessionId of [...created.sessionIds].reverse()) {
    const result = await safe("DELETE", `/clinic/sessions/${sessionId}/`);
    if (![200, 204, 404].includes(result.status)) {
      failures.push(`delete session ${sessionId} -> ${result.status}`);
    }
  }
  const sessions = await safe<unknown>(
    "GET",
    `/clinic/sessions/?date_from=${CLINIC_DATE}&date_to=${CLINIC_DATE}`,
  );
  if (sessions.status !== 200) {
    failures.push(`read back clinic sessions -> ${sessions.status}`);
  } else if (listFrom(sessions.body).some((row) => String(row.title || "").startsWith(MARKER))) {
    failures.push("owned clinic session residue remains");
  }
  expect(failures, failures.join("\n")).toEqual([]);
}

test.describe.serial("[real-use] 클리닉 여러 시간대 예약", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!ENABLED, "Set E2E_CLINIC_MULTI_SLOT_REALUSE=1 for the disposable development scenario.");

  test.beforeAll(() => {
    assertIsolatedRuntime();
  });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("학생 UI와 교직원 경로에서 ON은 저장되고 OFF는 실패 폐쇄한다", async ({ page, request, browser }) => {
    const teacher = await login(request, TEACHER_USER);
    const student = await login(request, STUDENT_USER);
    created.teacherAccess = teacher.access;

    const sessionSpecs = [
      { title: `${MARKER} 17시`, start_time: "17:00:00", allow_multi_slot_booking: true },
      { title: `${MARKER} 18시`, start_time: "18:00:00", allow_multi_slot_booking: true },
      { title: `${MARKER} 19시`, start_time: "19:00:00", allow_multi_slot_booking: false },
    ];
    const sessions: SessionRow[] = [];
    for (const spec of sessionSpecs) {
      const session = await expectApi<SessionRow>(request, "POST", "/clinic/sessions/", teacher.access, {
        ...spec,
        date: CLINIC_DATE,
        duration_minutes: 60,
        location: `${MARKER} 실사용실`,
        max_participants: 10,
        target_grade: null,
        target_school_type: null,
        target_lecture_ids: [],
      });
      sessions.push(session);
      created.sessionIds.push(Number(session.id));
    }

    await seedBrowser(page, student);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/student/clinic`, { timeout: 30_000 });
    await acknowledgeFirstLoginGuideIfVisible(page);

    const dateRegion = page.getByRole("region", {
      name: new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
        timeZone: "Asia/Seoul",
      }).format(new Date(`${CLINIC_DATE}T12:00:00+09:00`)).replace(/\.$/, ""),
    });
    const firstButton = dateRegion.getByRole("button", { name: `${MARKER} 17시` });
    const secondButton = dateRegion.getByRole("button", { name: `${MARKER} 18시` });
    const offButton = dateRegion.getByRole("button", { name: `${MARKER} 19시` });
    await firstButton.click();
    await expect(offButton).toBeDisabled();
    await secondButton.click();

    const selection = page.getByRole("region", { name: "선택한 클리닉 시간" });
    await expect(selection).toContainText("17:00–19:00");
    await expect(selection).toContainText("2개 시간대");
    await selection.scrollIntoViewIfNeeded();
    expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/clinic-multi-slot-realuse-student-390.png", fullPage: true });
    await selection.getByLabel("학원에 전할 내용 (선택)").fill("실사용 두 시간 연속 참여");
    await selection.getByRole("button", { name: "2개 시간대 예약하기" }).click();
    await expect(page.getByRole("status")).toContainText("2개 시간대 예약 신청이 접수되었습니다.");

    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.locator("article").filter({ hasText: `${MARKER} 17시` })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: `${MARKER} 18시` })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: /내 일정/ }).click();
    await expect(page.locator("article").filter({ hasText: `${MARKER} 18시` })).toContainText("실사용 두 시간 연속 참여");

    const offAttempt = await api(
      request,
      "POST",
      "/clinic/participants/",
      student.access,
      { session: sessions[2].id },
    );
    expect(offAttempt.status, JSON.stringify(offAttempt.body)).toBe(409);

    const studentsBody = await expectApi<unknown>(
      request,
      "GET",
      `/students/?search=${encodeURIComponent(SECOND_STUDENT_NAME)}&page_size=20`,
      teacher.access,
    );
    const secondStudent = listFrom(studentsBody).find((row) => row.name === SECOND_STUDENT_NAME);
    expect(secondStudent, `Missing disposable student ${SECOND_STUDENT_NAME}`).toBeTruthy();
    await expectApi(request, "POST", "/clinic/participants/bulk-create/", teacher.access, {
      session_ids: [sessions[0].id, sessions[1].id],
      student_ids: [Number(secondStudent?.id)],
    });

    for (const session of sessions.slice(0, 2)) {
      const rows = await participantsFor(request, session.id);
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.student_name)).toEqual(
        expect.arrayContaining(["검증학생 01", SECOND_STUDENT_NAME]),
      );
    }
    expect(await participantsFor(request, sessions[2].id)).toHaveLength(0);

    const teacherContext = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const teacherPage = await teacherContext.newPage();
    installAccountNotificationGuard(teacherPage.request);
    const strictTeacher = attachStrictBrowserGuards(teacherPage);
    try {
      await seedBrowser(teacherPage, teacher);
      await gotoAndSettle(teacherPage, `${BASE}/workspace/mobile/clinic`, { timeout: 30_000 });
      await acknowledgeFirstLoginGuideIfVisible(teacherPage);
      await teacherPage.getByRole("button", { name: `${MARKER} 17시` }).click();
      await waitForRenderSettled(teacherPage, { timeout: 20_000 });
      await expect(teacherPage.getByText("검증학생 01", { exact: true })).toBeVisible();
      await expect(teacherPage.getByText(SECOND_STUDENT_NAME, { exact: true })).toBeVisible();
      expect(await teacherPage.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await teacherPage.screenshot({ path: "test-results/clinic-multi-slot-realuse-teacher-1100.png", fullPage: true });
      strictTeacher.assertZeroDefects();
    } finally {
      await teacherContext.close();
    }
  });
});
