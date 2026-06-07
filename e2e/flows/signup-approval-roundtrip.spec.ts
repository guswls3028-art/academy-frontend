/**
 * Public signup -> staff approval -> student login real-use canary.
 *
 * Production safety:
 * - signup approval can enqueue account Alimtalk messages;
 * - when the API target is production, this spec refuses to run unless the
 *   controlled recipient is explicitly set to 01031217466.
 */
import { test, expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(240_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "koreaseoul97";
const CONTROLLED_PHONE = (process.env.E2E_SIGNUP_CONTROLLED_PHONE || "").replace(/\D/g, "");
const ALLOW_REAL_SEND = process.env.E2E_ALLOW_SIGNUP_APPROVAL_REAL_SEND === "1";
const TS = Date.now();
const SUFFIX = String(TS).slice(-8);
const STUDENT_NAME = `[E2E-${TS}] 가입승인학생`;
const STUDENT_USER = `e2esign${SUFFIX}`;
const STUDENT_PASS = "test1234";
const DEFAULT_STUDENT_PHONE = `010${SUFFIX}`;
const DEFAULT_PARENT_PHONE = `010${String(Number(SUFFIX) + 1).padStart(8, "0").slice(-8)}`;

type Tokens = { access: string; refresh: string };

type CreatedState = {
  adminAccess?: string;
  requestId?: number;
  studentId?: number;
};

const created: CreatedState = {};

function isProductionApi(): boolean {
  try {
    return new URL(API).hostname === "api.hakwonplus.com";
  } catch {
    return false;
  }
}

function phoneForRun(kind: "student" | "parent"): string {
  if (isProductionApi()) return CONTROLLED_PHONE;
  return kind === "student" ? DEFAULT_STUDENT_PHONE : DEFAULT_PARENT_PHONE;
}

function phoneBlocks(phone: string): { mid: string; last: string } {
  const tail = phone.replace(/\D/g, "").slice(3);
  return { mid: tail.slice(0, 4), last: tail.slice(4, 8) };
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": CODE,
  };
}

async function loginToken(request: APIRequestContext): Promise<Tokens> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    timeout: 60_000,
  });
  if (resp.status() !== 200) {
    throw new Error(`admin token -> ${resp.status()} ${await resp.text()}`);
  }
  return await resp.json() as Tokens;
}

async function apiFetch<TBody = unknown>(
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
  let body: unknown = null;
  try { body = await resp.json(); } catch { body = null; }
  return { status: resp.status(), body: body as TBody };
}

async function publicApiFetch<TBody = unknown>(
  request: APIRequestContext,
  method: string,
  path: string,
  data?: Record<string, unknown>,
): Promise<{ status: number; body: TBody }> {
  const resp = await request.fetch(`${API}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    ...(data ? { data } : {}),
    timeout: 60_000,
  });
  let body: unknown = null;
  try { body = await resp.json(); } catch { body = null; }
  return { status: resp.status(), body: body as TBody };
}

async function fillSignupForm(page: Page, studentPhone: string, parentPhone: string): Promise<void> {
  await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 25_000 });
  await page.getByRole("button", { name: "회원가입" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "학생 회원가입" })).toBeVisible();

  const student = phoneBlocks(studentPhone);
  const parent = phoneBlocks(parentPhone);

  await dialog.getByLabel("이름 *").fill(STUDENT_NAME);
  await dialog.getByRole("button", { name: "남" }).click();
  await dialog.getByLabel("아이디 (희망 로그인 ID) *").fill(STUDENT_USER);
  await dialog.getByLabel("비밀번호 *").fill(STUDENT_PASS);
  await dialog.getByLabel("휴대전화 앞 4자리").fill(student.mid);
  await dialog.getByLabel("휴대전화 뒤 4자리").fill(student.last);
  await dialog.getByLabel("학부모 연락처 앞 4자리").fill(parent.mid);
  await dialog.getByLabel("학부모 연락처 뒤 4자리").fill(parent.last);
  await dialog.getByLabel("고등학교명 *").fill("E2E검증고");
  await dialog.getByLabel("학년 *").selectOption("1");
  const origin = dialog.getByLabel("출신중학교 *");
  if (await origin.isVisible().catch(() => false)) {
    await origin.fill("E2E검증중");
  }
  await dialog.getByLabel("주소 *").fill("서울시 E2E 검증로");
}

async function submitSignup(page: Page): Promise<void> {
  const signupResponse = page.waitForResponse((response) => {
    return response.request().method() === "POST" &&
      response.url().includes("/api/v1/students/registration_requests/") &&
      !response.url().includes("check_duplicate");
  }, { timeout: 60_000 });

  await page.getByRole("dialog").getByRole("button", { name: "가입 신청" }).click();
  const response = await signupResponse;
  if (response.status() !== 201) {
    throw new Error(`signup request -> ${response.status()} ${await response.text()}`);
  }
  const body = await response.json() as { id?: number; status?: string };
  expect(body.status).toBe("pending");
  created.requestId = Number(body.id);

  await expect(page.getByRole("dialog").getByText("신청이 완료되었습니다. 승인 후 로그인해 주세요.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "확인" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

async function approveFromAdminUi(page: Page): Promise<void> {
  if (!created.requestId) throw new Error("registration request id is missing");
  await loginViaUI(page, "admin", { landingPath: "/admin/students/requests" });

  const card = page.locator(".students-requests__card", { hasText: STUDENT_NAME }).first();
  await expect(card, "new signup request card").toBeVisible({ timeout: 30_000 });

  await card.getByRole("button", { name: "승인" }).click();
  const confirm = page.locator("[data-confirm-dialog]");
  await expect(confirm.getByText("승인 확인")).toBeVisible();

  const approveResponse = page.waitForResponse((response) => {
    return response.request().method() === "POST" &&
      response.url().includes(`/api/v1/students/registration_requests/${created.requestId}/approve/`);
  }, { timeout: 90_000 });
  await confirm.getByRole("button", { name: "승인" }).click();
  const response = await approveResponse;
  if (response.status() !== 200) {
    throw new Error(`approve request -> ${response.status()} ${await response.text()}`);
  }
  const body = await response.json() as { id?: number; name?: string; ps_number?: string };
  created.studentId = Number(body.id);
  expect(body.name).toBe(STUDENT_NAME);
  expect(body.ps_number).toBe(STUDENT_USER);

  await expect(page.getByText("승인되었습니다. 학생이 등록되었습니다.")).toBeVisible({ timeout: 20_000 });
  await expect(card).toBeHidden({ timeout: 20_000 });
}

async function loginAsApprovedStudent(page: Page): Promise<void> {
  await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 25_000 });
  await page.getByTestId("login-username").fill(STUDENT_USER);
  await page.getByTestId("login-password").fill(STUDENT_PASS);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/student(\/)?($|\?)/, { timeout: 30_000 });
  await waitForRenderSettled(page, { timeout: 20_000 });
  await expect(page.locator("[class*='tabbar'], [class*='tab-bar'], nav").first()).toBeVisible();
  await page.goto(`${BASE}/student/profile`, { waitUntil: "load", timeout: 25_000 });
  await waitForRenderSettled(page, { timeout: 20_000 });
  await expect(page.getByText("내 정보").first()).toBeVisible();
  await expect(page.getByDisplayValue(STUDENT_NAME).first()).toBeVisible({ timeout: 15_000 });
}

async function waitForApprovalLogs(page: Page): Promise<void> {
  if (!created.studentId || process.env.E2E_SIGNUP_EXPECT_ALIMTALK !== "1") return;

  const studentTarget = `student:${created.studentId}`;
  const parentTarget = `parent:${created.studentId}:${phoneForRun("parent")}`;
  const sameRecipient = phoneForRun("student") === phoneForRun("parent");
  const expectedTargets = new Set(sameRecipient ? [parentTarget] : [studentTarget, parentTarget]);

  await waitForCondition(
    async () => {
      const tokens = await page.evaluate(() => ({
        access: localStorage.getItem("access") || "",
      }));
      const out = await apiFetch<{ results?: Array<{ success?: boolean; status?: string; target_id?: string }> }>(
        page.request,
        "GET",
        "/messaging/log/?page_size=50&status=success",
        tokens.access,
      );
      if (out.status !== 200 || !Array.isArray(out.body.results)) return false;
      const targets = new Set(
        out.body.results
          .filter((row) => row.success === true && row.status === "sent")
          .map((row) => row.target_id || ""),
      );
      if (!Array.from(expectedTargets).every((target) => targets.has(target))) return false;
      return !(sameRecipient && targets.has(studentTarget));
    },
    {
      timeoutMs: 120_000,
      intervalMs: 3_000,
      description: "registration approval Alimtalk NotificationLog",
    },
  );
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.studentId && !created.requestId) return;
  const access = created.adminAccess || (await loginToken(request)).access;
  if (created.studentId) {
    const softDeleted = await apiFetch(request, "POST", "/students/bulk_delete/", access, { ids: [created.studentId] });
    expect([200, 204], `cleanup bulk_delete -> ${softDeleted.status} ${JSON.stringify(softDeleted.body)}`).toContain(softDeleted.status);
    const permanent = await apiFetch(request, "POST", "/students/bulk_permanent_delete/", access, { ids: [created.studentId] });
    expect(permanent.status, `cleanup bulk_permanent_delete -> ${permanent.status} ${JSON.stringify(permanent.body)}`).toBe(200);
  } else if (created.requestId) {
    const rejected = await apiFetch(request, "POST", `/students/registration_requests/${created.requestId}/reject/`, access);
    expect([200, 400, 404], `cleanup registration request -> ${rejected.status} ${JSON.stringify(rejected.body)}`).toContain(rejected.status);
  }
}

test.describe.serial("[E2E] 회원가입 승인 라운드트립", () => {
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("public signup request is approved by staff and can log in as student", async ({ page, browser, request }) => {
    if (isProductionApi()) {
      expect(ALLOW_REAL_SEND, "production signup approval can send Alimtalk; set E2E_ALLOW_SIGNUP_APPROVAL_REAL_SEND=1").toBe(true);
      expect(CONTROLLED_PHONE, "production signup approval recipient must be the controlled phone").toBe("01031217466");
    }

    const adminTokens = await loginToken(request);
    created.adminAccess = adminTokens.access;

    const studentPhone = phoneForRun("student");
    const parentPhone = phoneForRun("parent");
    const duplicate = await publicApiFetch<{
      username?: { available?: boolean; reason?: string };
      phone?: { available?: boolean; reason?: string };
    }>(
      request,
      "POST",
      "/students/registration_requests/check_duplicate/",
      { username: STUDENT_USER, phone: studentPhone },
    );
    expect(duplicate.status, `duplicate check -> ${duplicate.status} ${JSON.stringify(duplicate.body)}`).toBe(200);
    expect(duplicate.body.username?.available, `username unavailable: ${duplicate.body.username?.reason ?? ""}`).toBe(true);
    expect(duplicate.body.phone?.available, `controlled phone unavailable: ${duplicate.body.phone?.reason ?? ""}`).toBe(true);

    await fillSignupForm(page, studentPhone, parentPhone);
    await submitSignup(page);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await approveFromAdminUi(adminPage);
      await waitForApprovalLogs(adminPage);
    } finally {
      await adminContext.close();
    }

    await loginAsApprovedStudent(page);
  });
});
