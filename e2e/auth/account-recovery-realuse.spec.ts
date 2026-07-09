/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 계정복구/교사 비밀번호 변경 실사용 canary.
 *
 * 공용 비밀번호 찾기는 기존 비밀번호를 즉시 바꾸지 않고 알림톡으로만 pending
 * 임시비밀번호를 발송해야 한다. 교사 변경은 staff 권한으로 즉시 반영하되,
 * 전용 E2E 학생만 대상으로 하고 afterAll에서 원복/삭제한다.
 */
import { test, expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import { getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

test.setTimeout(240_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = "hakwonplus";
const ADMIN_USER = requiredEnv("E2E_ADMIN_USER");
const ADMIN_PASS = requiredEnv("E2E_ADMIN_PASS");
const ORIGINAL_PW = "test1234";
const STAFF_TEMP_PW = `E2Epw${String(Date.now()).slice(-6)}!`;
const TS = Date.now();

const CONTROLLED_PHONE = (process.env.E2E_ACCOUNT_RECOVERY_CONTROLLED_PHONE || "01031217466").trim();
const ALLOW_REAL_SEND = process.env.E2E_ALLOW_ACCOUNT_RECOVERY_REAL_SEND === "1";
const RECEIVED_PUBLIC_TEMP_PW = (process.env.E2E_ACCOUNT_RECOVERY_TEMP_PASSWORD || "").trim();

const STUDENT_NAME = `[E2E-${TS}] 계정복구학생`;
const STUDENT_USER = `e2ear${String(TS).slice(-8)}`;
const GENERATED_PARENT_PHONE = `010${String(TS).slice(-8)}`;
const PARENT_PHONE = isProductionApi() ? CONTROLLED_PHONE : GENERATED_PARENT_PHONE;

type Tokens = { access: string; refresh: string };

type AccountNotificationLog = {
  id: number;
  sent_at: string | null;
  success?: boolean;
  status: string;
  notification_type: string;
  recipient_summary: string;
  target_id: string;
  target_name: string;
};

const created: {
  adminAccess?: string;
  studentId?: number;
} = {};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing required env ${name}. See .env.e2e.example.`);
}

function isProductionApi(): boolean {
  try {
    return new URL(API).hostname.toLowerCase() === "api.hakwonplus.com";
  } catch {
    return false;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalOrPreviewBase(base: string): boolean {
  try {
    const hostname = new URL(base).hostname.trim().toLowerCase();
    return hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".pages.dev") ||
      hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

function getLoginUrl(): string {
  const base = trimTrailingSlash(BASE);
  return isLocalOrPreviewBase(base) ? `${base}/login/${CODE}` : `${base}/login`;
}

function headers(token?: string): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    "X-Tenant-Code": CODE,
  };
}

async function loginAttempt(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<{ status: number; body: any }> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username, password, tenant_code: CODE },
    headers: headers(),
    timeout: 60_000,
  });
  let body: any = null;
  try { body = await resp.json(); } catch { body = null; }
  return { status: resp.status(), body };
}

async function loginToken(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<Tokens> {
  const out = await loginAttempt(request, username, password);
  expect(out.status, `token login ${username} -> ${out.status} ${JSON.stringify(out.body)}`).toBe(200);
  return out.body as Tokens;
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

async function createStudent(request: APIRequestContext, token: string): Promise<number> {
  const student = await expectApi<{ id: number }>(request, "POST", "/students/", token, {
    name: STUDENT_NAME,
    parent_phone: PARENT_PHONE,
    ps_number: STUDENT_USER,
    no_phone: true,
    school_type: "HIGH",
    grade: 1,
    initial_password: ORIGINAL_PW,
    memo: isProductionApi()
      ? "E2E account recovery canary. 알림톡은 통제 번호로만 발송."
      : "E2E account recovery canary.",
  });
  return Number(student.id);
}

async function submitPublicRecoveryFromLogin(page: Page): Promise<void> {
  await gotoAndSettle(page, getLoginUrl(), { timeout: 25_000 });
  await page.getByRole("button", { name: "비밀번호 찾기" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "비밀번호 찾기" })).toBeVisible();
  await dialog.getByPlaceholder("학생 이름 *").fill(STUDENT_NAME);
  await dialog.getByLabel("학생 또는 학부모 휴대폰 번호 앞 4자리").fill(PARENT_PHONE.slice(3, 7));
  await dialog.getByLabel("학생 또는 학부모 휴대폰 번호 뒤 4자리").fill(PARENT_PHONE.slice(7));
  await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();

  await expect(dialog.getByRole("status")).toHaveText(
    "입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호 알림톡이 발송됩니다.",
    { timeout: 30_000 },
  );
}

async function waitForAccountNotification(
  request: APIRequestContext,
  token: string,
  notificationType: string,
): Promise<AccountNotificationLog> {
  let latest: AccountNotificationLog[] = [];
  let matched: AccountNotificationLog | undefined;
  await waitForCondition(
    async () => {
      const body = await expectApi<{ results: AccountNotificationLog[] }>(
        request,
        "GET",
        `/students/${created.studentId}/account-notifications/?limit=10`,
        token,
      );
      latest = Array.isArray(body.results) ? body.results : [];
      matched = latest.find((row) =>
        row.notification_type === notificationType &&
        row.target_id === `student:${created.studentId}` &&
        row.status === "sent" &&
        row.success !== false
      );
      return !!matched;
    },
    { timeoutMs: 120_000, intervalMs: 3000, description: `${notificationType} account notification log` },
  ).catch((error) => {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; latest=${JSON.stringify(latest)}`,
    );
  });
  return matched as AccountNotificationLog;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  const token = created.adminAccess;
  if (!token) return;

  const safe = async (method: string, path: string, data?: Record<string, unknown>) => {
    let out: { status: number; body: unknown };
    try {
      out = await apiFetch(request, method, path, token, data);
    } catch (error) {
      out = { status: 0, body: { error: error instanceof Error ? error.message : String(error) } };
    }
    if (![200, 202, 204, 404].includes(out.status)) {
      console.log(`cleanup ${method} ${path}: ${out.status} ${JSON.stringify(out.body)}`);
    }
  };

  if (created.studentId) {
    await safe("POST", "/students/password_reset_send/", {
      target: "student",
      student_name: STUDENT_NAME,
      student_ps_number: STUDENT_USER,
      temp_password: ORIGINAL_PW,
    });
    await safe("POST", "/students/bulk_delete/", { ids: [created.studentId] });
    await safe("POST", "/students/bulk_permanent_delete/", { ids: [created.studentId] });
  }
}

test.describe.serial("[E2E] 계정복구/교사 비밀번호 변경 실사용 검증", () => {
  test.skip(
    isProductionApi() && (!ALLOW_REAL_SEND || CONTROLLED_PHONE !== "01031217466"),
    "프로덕션 계정복구 canary는 통제 번호 01031217466 명시와 E2E_ALLOW_ACCOUNT_RECOVERY_REAL_SEND=1이 필요합니다.",
  );

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("공용 비밀번호 찾기는 실발송 후 기존 비밀번호를 유지하고 교사 변경은 즉시 반영/복원된다", async ({ page, request }) => {
    const adminTokens = await loginToken(request, ADMIN_USER, ADMIN_PASS);
    created.adminAccess = adminTokens.access;
    created.studentId = await createStudent(request, adminTokens.access);

    expect((await loginAttempt(request, STUDENT_USER, ORIGINAL_PW)).status).toBe(200);

    await submitPublicRecoveryFromLogin(page);

    const recoveryLog = await waitForAccountNotification(request, adminTokens.access, "password_reset_student");
    expect(recoveryLog.recipient_summary).toContain(`${PARENT_PHONE.slice(0, 4)}****`);
    expect(recoveryLog.recipient_summary).not.toContain(PARENT_PHONE);
    expect(recoveryLog.target_name).toBe(STUDENT_NAME);
    expect((await loginAttempt(request, STUDENT_USER, ORIGINAL_PW)).status).toBe(200);

    if (RECEIVED_PUBLIC_TEMP_PW) {
      expect((await loginAttempt(request, STUDENT_USER, RECEIVED_PUBLIC_TEMP_PW)).status).toBe(200);
      expect([400, 401]).toContain((await loginAttempt(request, STUDENT_USER, ORIGINAL_PW)).status);
    } else {
      test.info().annotations.push({
        type: "manual-canary-gap",
        description: "임시비밀번호 수신값은 보안상 API/로그에 노출되지 않는다. E2E_ACCOUNT_RECOVERY_TEMP_PASSWORD를 넣으면 pending 활성화까지 검증한다.",
      });
    }

    const staffReset = await expectApi<{ message: string }>(
      request,
      "POST",
      "/students/password_reset_send/",
      adminTokens.access,
      {
        target: "student",
        student_name: STUDENT_NAME,
        student_ps_number: STUDENT_USER,
        temp_password: STAFF_TEMP_PW,
      },
    );
    expect(staffReset.message).toContain("비밀번호가 변경되었습니다");
    expect((await loginAttempt(request, STUDENT_USER, STAFF_TEMP_PW)).status).toBe(200);
    expect([400, 401]).toContain((await loginAttempt(request, STUDENT_USER, ORIGINAL_PW)).status);

    const restore = await expectApi<{ message: string }>(
      request,
      "POST",
      "/students/password_reset_send/",
      adminTokens.access,
      {
        target: "student",
        student_name: STUDENT_NAME,
        student_ps_number: STUDENT_USER,
        temp_password: ORIGINAL_PW,
      },
    );
    expect(restore.message).toContain("비밀번호가 변경되었습니다");
    expect((await loginAttempt(request, STUDENT_USER, ORIGINAL_PW)).status).toBe(200);
  });
});
