import { createHash } from "node:crypto";

import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "./firstLoginGuide";
import {
  installReleaseContextGuard,
  installReleaseRequestGuard,
  releaseBoundaryFromEnv,
} from "./releaseApiBoundary";
import { gotoAndSettle, waitForRenderSettled } from "./wait";

export type QaTokens = { access: string; refresh: string };

export type QaStudent = {
  id: number;
  name: string;
  ps_number: string;
  parent_phone: string;
  password: string;
};

export type QaFamily = {
  scenarioKey: string;
  parentPhone: string;
  parentPassword: string;
  students: QaStudent[];
};

type QaFamilyOptions = {
  withStudentPhones?: boolean;
};

type ApiResult<T> = { status: number; body: T };

export const STUDENT_PARENT_REALUSE_ENABLED =
  process.env.E2E_STUDENT_PARENT_REALUSE === "1";

export const QA_BASE = (process.env.E2E_BASE_URL || "").replace(/\/+$/, "");
export const QA_API = (process.env.E2E_API_URL || "").replace(/\/+$/, "");
export const QA_TENANT = (process.env.E2E_TENANT_CODE || "").trim().toLowerCase();
export const QA_ADMIN_USER = (process.env.E2E_ADMIN_USER || "ymath-qa-teacher").trim();
export const QA_ADMIN_PASSWORD = (process.env.E2E_ADMIN_PASS || "").trim();
export const QA_STUDENT_PASSWORD = (process.env.E2E_STUDENT_PASS || "").trim();

const TOKEN_MAX_ATTEMPTS = 5;

function stableDigits(value: string, length: number): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 14);
  const ceiling = 10n ** BigInt(length);
  return (BigInt(`0x${hex}`) % ceiling).toString().padStart(length, "0");
}

function headers(token?: string): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    "X-Tenant-Code": QA_TENANT,
  };
}

export function assertQaStudentParentRuntime(): void {
  const boundary = releaseBoundaryFromEnv(process.env);
  expect(boundary?.mode, "student/parent real-use requires the release development boundary").toBe("development");
  expect(boundary?.tenantCode).toBe(QA_TENANT);
  expect(QA_TENANT).toMatch(/^qa-ymath-realuse-[a-z0-9-]+$/);
  expect(QA_ADMIN_PASSWORD, "E2E_ADMIN_PASS is required").not.toBe("");
  expect(QA_STUDENT_PASSWORD, "E2E_STUDENT_PASS is required").not.toBe("");
  expect(process.env.E2E_ALLOW_PRODUCTION_WRITES).toBe("0");
  expect(
    process.env.E2E_ALLOW_REAL_ALIMTALK,
    "student/parent real-use requires real Alimtalk to be explicitly disabled",
  ).toBe("0");
}

export async function installQaStudentParentBoundary(
  page: Page,
  request: APIRequestContext,
): Promise<{ assertClean: () => void }> {
  assertQaStudentParentRuntime();
  const boundary = releaseBoundaryFromEnv(process.env);
  if (!boundary || boundary.mode !== "development") {
    throw new Error("qa-* student/parent boundary could not be resolved");
  }
  installReleaseRequestGuard(request, boundary);
  return installReleaseContextGuard(page.context(), boundary);
}

export async function api<T = unknown>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const response = await request.fetch(`${QA_API}/api/v1${path}`, {
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

export async function expectApi<T = unknown>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
  statuses = [200, 201],
): Promise<T> {
  const result = await api<T>(request, method, path, token, data);
  const body = result.body && typeof result.body === "object"
    ? result.body as Record<string, unknown>
    : {};
  const failure = {
    code: body.code,
    detail: body.detail,
    error_type: body.error_type,
  };
  expect(
    statuses,
    `${method} ${path} returned ${result.status}: ${JSON.stringify(failure)}`,
  ).toContain(result.status);
  return result.body;
}

export async function loginApi(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<QaTokens> {
  let lastFailure = "";
  for (let attempt = 0; attempt < TOKEN_MAX_ATTEMPTS; attempt += 1) {
    const response = await request.post(`${QA_API}/api/v1/token/`, {
      headers: headers(),
      data: { username, password, tenant_code: QA_TENANT },
      timeout: 60_000,
    });
    if (response.status() === 200) return await response.json() as QaTokens;

    const responseText = await response.text();
    lastFailure = `${response.status()} ${responseText}`;
    if (response.status() !== 429 || attempt === TOKEN_MAX_ATTEMPTS - 1) break;

    const retryAfter = Number.parseInt(response.headers()["retry-after"] || "", 10);
    const bodySeconds = Number.parseInt(responseText.match(/(\d+)\s*초/)?.[1] || "", 10);
    const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter + 1
      : Number.isFinite(bodySeconds) && bodySeconds > 0
        ? bodySeconds + 1
        : 5;
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitSeconds, 75) * 1000));
  }
  throw new Error(`login failed for synthetic ${QA_TENANT} account: ${lastFailure}`);
}

export async function loginAdmin(request: APIRequestContext): Promise<QaTokens> {
  return loginApi(request, QA_ADMIN_USER, QA_ADMIN_PASSWORD);
}

export async function seedBrowserAuth(page: Page, tokens: QaTokens): Promise<void> {
  await page.addInitScript(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: QA_TENANT });
}

export async function loginThroughUi(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`, { timeout: 45_000 });
  await page.getByTestId("login-username").fill(username);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/student(?:\/|$)/, { timeout: 45_000 });
  await acknowledgeInitialAccountPromptsIfVisible(page);
  await waitForRenderSettled(page, { timeout: 20_000 });
}

export async function reloadStudentApp(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await acknowledgeInitialAccountPromptsIfVisible(page);
  await waitForRenderSettled(page, { timeout: 20_000 });
}

export async function logoutStudentApp(page: Page): Promise<void> {
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const drawer = page.getByRole("dialog", { name: "메뉴" });
  await drawer.getByRole("button", { name: "로그아웃" }).click();
  await page.locator(".stu-logout-dialog__confirm").click();
  await expect(page).toHaveURL(`${QA_BASE}/`, { timeout: 45_000 });
}

export async function createQaFamily(
  request: APIRequestContext,
  adminAccess: string,
  scenarioKey: string,
  childCount: 1 | 2,
  options: QaFamilyOptions = {},
): Promise<QaFamily> {
  const slug = stableDigits(`${QA_TENANT}:${scenarioKey}`, 8);
  const parentPhone = `010${slug}`;
  const students: QaStudent[] = [];

  try {
    for (let index = 1; index <= childCount; index += 1) {
      const studentPhone = options.withStudentPhones
        ? `010${stableDigits(`${QA_TENANT}:${scenarioKey}:student:${index}`, 8)}`
        : "";
      const createdStudent = await expectApi<Omit<QaStudent, "password">>(request, "POST", "/students/", adminAccess, {
        name: `QA ${scenarioKey} 자녀 ${index}`,
        ps_number: `qa-sp-${scenarioKey}-${slug.slice(-4)}-${index}`,
        no_phone: !studentPhone,
        phone: studentPhone,
        parent_phone: parentPhone,
        initial_password: QA_STUDENT_PASSWORD,
        school_type: "HIGH",
        grade: index,
        gender: index % 2 ? "F" : "M",
        high_school: "QA 격리고등학교",
        memo: `qa-* student/parent real-use ${scenarioKey}`,
      }, [201]);
      expect(createdStudent.id).toBeGreaterThan(0);
      expect(createdStudent.parent_phone).toBe(parentPhone);
      students.push({ ...createdStudent, password: QA_STUDENT_PASSWORD });
    }
  } catch (creationError) {
    if (students.length > 0) {
      try {
        await cleanupQaFamily(request, adminAccess, {
          scenarioKey,
          parentPhone,
          parentPassword: QA_STUDENT_PASSWORD,
          students,
        });
      } catch (cleanupError) {
        throw new AggregateError(
          [creationError, cleanupError],
          `qa-* family creation and partial cleanup both failed for ${scenarioKey}`,
        );
      }
    }
    throw creationError;
  }

  try {
    for (const student of students) {
      await loginApi(request, student.ps_number, student.password);
    }
    await loginApi(request, parentPhone, QA_STUDENT_PASSWORD);
  } catch (stabilizationError) {
    try {
      await cleanupQaFamily(request, adminAccess, {
        scenarioKey,
        parentPhone,
        parentPassword: QA_STUDENT_PASSWORD,
        students,
      });
    } catch (cleanupError) {
      throw new AggregateError(
        [stabilizationError, cleanupError],
        `qa-* password stabilization and cleanup both failed for ${scenarioKey}`,
      );
    }
    throw stabilizationError;
  }

  return {
    scenarioKey,
    parentPhone,
    parentPassword: QA_STUDENT_PASSWORD,
    students,
  };
}

export async function selectParentStudentThroughUi(page: Page, student: QaStudent): Promise<void> {
  const tab = page
    .getByRole("tablist", { name: "자녀 선택" })
    .getByRole("tab", { name: student.name, exact: true });
  await expect(tab).toBeVisible();
  if (await tab.getAttribute("aria-selected") !== "true") {
    await tab.click();
  }
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

export async function assertAuthoritativeStudent(
  request: APIRequestContext,
  adminAccess: string,
  expected: QaStudent,
): Promise<void> {
  const student = await expectApi<QaStudent>(
    request,
    "GET",
    `/students/${expected.id}/`,
    adminAccess,
  );
  expect(student).toMatchObject({
    id: expected.id,
    name: expected.name,
    ps_number: expected.ps_number,
    parent_phone: expected.parent_phone,
  });
}

export async function assertParentProjection(
  request: APIRequestContext,
  parentAccess: string,
  student: QaStudent,
  selectedStudentId?: number,
): Promise<void> {
  const response = await request.get(`${QA_API}/api/v1/student/me/`, {
    headers: {
      ...headers(parentAccess),
      ...(selectedStudentId ? { "X-Student-Id": String(selectedStudentId) } : {}),
    },
    timeout: 60_000,
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ id: student.id, name: student.name });
}

export async function cleanupQaFamily(
  request: APIRequestContext,
  adminAccess: string,
  family: QaFamily | null,
): Promise<void> {
  if (!family?.students.length) return;
  const ids = family.students.map((student) => student.id);
  await expectApi(request, "POST", "/students/bulk_delete/", adminAccess, { ids }, [200, 204]);
  await expectApi(request, "POST", "/students/bulk_permanent_delete/", adminAccess, { ids }, [200]);
  for (const id of ids) {
    const residue = await api(request, "GET", `/students/${id}/`, adminAccess);
    expect(residue.status, `student ${id} residue`).toBe(404);
  }
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  expect(await page.locator("html").evaluate((element) => (
    element.scrollWidth <= element.clientWidth + 1
  ))).toBe(true);
}
