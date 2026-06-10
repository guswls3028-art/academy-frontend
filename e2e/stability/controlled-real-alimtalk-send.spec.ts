/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Controlled production Alimtalk send proof.
 *
 * This is the only E2E spec that intentionally performs a real immediate
 * Alimtalk send. The recipient is hard-guarded to the controlled phone number
 * and the fixture student is deleted afterwards. The NotificationLog remains
 * as provider evidence.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

test.setTimeout(240_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = "hakwonplus";
const ADMIN_USER = requiredEnv("E2E_ADMIN_USER");
const ADMIN_PASS = requiredEnv("E2E_ADMIN_PASS");
const CONTROLLED_PHONE = (process.env.E2E_REAL_ALIMTALK_CONTROLLED_PHONE || "01031217466").trim();
const TS = Date.now();
const RUN = `[E2E-REALMSG-${TS}]`;
const STUDENT_NAME = `${RUN} 통제발송`;
const STUDENT_USER = `e2erm${String(TS).slice(-8)}`;

type Tokens = { access: string; refresh: string };
type StudentRow = { id: number; name: string };
type TemplateRow = {
  id: number;
  category: string;
  name: string;
  body: string;
  solapi_template_id?: string;
  solapi_status?: string;
};
type NotificationLogRow = {
  id: number;
  success: boolean;
  status: "processing" | "sent" | "failed" | string;
  provider_message_id?: string;
  recipient_summary?: string;
  message_body?: string;
  message_mode?: string;
  target_id?: string;
  target_name?: string;
  failure_reason?: string;
};
type OperationsStatus = {
  worker?: { status?: string; last_seen_at?: string | null; age_seconds?: number | null };
  templates?: { approved?: number; owner_approved?: number; freeform_available?: boolean };
  risks?: Array<{ code?: string; title?: string; detail?: string }>;
};

const created = {
  access: "",
  studentId: 0,
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing required env ${name}. See frontend/.env.e2e.example.`);
}

function isProductionApi(): boolean {
  try {
    return new URL(API).hostname.toLowerCase() === "api.hakwonplus.com";
  } catch {
    return false;
  }
}

function headers(token?: string): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    "X-Tenant-Code": CODE,
  };
}

function listFromBody<T>(body: any): T[] {
  if (Array.isArray(body)) return body as T[];
  if (Array.isArray(body?.results)) return body.results as T[];
  return [];
}

async function loginToken(request: APIRequestContext): Promise<Tokens> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: CODE },
    headers: headers(),
    timeout: 60_000,
  });
  const body = await resp.json().catch(() => null);
  expect(resp.status(), `admin token -> ${resp.status()} ${JSON.stringify(body)}`).toBe(200);
  created.access = (body as Tokens).access;
  return body as Tokens;
}

async function apiFetch<TBody = any>(
  request: APIRequestContext,
  method: string,
  pathName: string,
  token: string | undefined,
  data?: Record<string, unknown>,
): Promise<{ status: number; body: TBody }> {
  const resp = await request.fetch(`${API}/api/v1${pathName}`, {
    method,
    headers: headers(token),
    ...(data ? { data } : {}),
    timeout: 60_000,
  });
  const text = await resp.text().catch(() => "");
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: resp.status(), body: body as TBody };
}

async function expectApi<TBody = any>(
  request: APIRequestContext,
  method: string,
  pathName: string,
  token: string | undefined,
  data?: Record<string, unknown>,
  okStatuses: number[] = [200, 201],
): Promise<TBody> {
  const out = await apiFetch<TBody>(request, method, pathName, token, data);
  expect(okStatuses, `${method} ${pathName} -> ${out.status} ${JSON.stringify(out.body)}`).toContain(out.status);
  return out.body;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.access) {
    await loginToken(request).catch(() => undefined);
  }
  if (!created.access || !created.studentId) return;
  await apiFetch(request, "POST", "/students/bulk_delete/", created.access, { ids: [created.studentId] });
  await apiFetch(request, "POST", "/students/bulk_permanent_delete/", created.access, { ids: [created.studentId] });
  created.studentId = 0;
}

async function createControlledStudent(request: APIRequestContext, token: string): Promise<StudentRow> {
  const student = await expectApi<StudentRow>(request, "POST", "/students/", token, {
    name: STUDENT_NAME,
    parent_phone: CONTROLLED_PHONE,
    ps_number: STUDENT_USER,
    no_phone: true,
    school_type: "HIGH",
    high_school: "E2E고",
    grade: 1,
    gender: "M",
    initial_password: "test1234",
    send_welcome_message: false,
    memo: `${RUN} controlled real Alimtalk fixture. Welcome notification disabled.`,
  });
  created.studentId = Number(student.id);
  return student;
}

function templateVarNames(body: string): string[] {
  return [...body.matchAll(/#\{([^}]+)\}/g)].map((match) => match[1]);
}

async function findApprovedSendTemplate(request: APIRequestContext, token: string): Promise<TemplateRow> {
  const body = await expectApi<any>(request, "GET", "/messaging/templates/?include_system=true&page_size=300", token);
  const approved = listFromBody<TemplateRow>(body).filter(
    (tpl) => tpl.solapi_status === "APPROVED" && Boolean((tpl.solapi_template_id || "").trim()),
  );
  const contentEnvelope = approved.find((tpl) =>
    /#\{(공지내용|내용|선생님메모|선생님메모1)\}/.test(tpl.body || ""),
  );
  const noVarTemplate = approved.find((tpl) => templateVarNames(tpl.body || "").length === 0);
  const selected = contentEnvelope ?? noVarTemplate ?? approved[0];
  expect(selected, "통제번호 실발송에 사용할 승인 알림톡 템플릿이 있어야 함").toBeTruthy();
  return selected;
}

async function latestDialog(page: Page, text: string): Promise<Locator> {
  const dialog = page.getByRole("dialog").filter({ hasText: text }).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

async function applyTemplateFromPicker(page: Page, dialog: Locator, template: TemplateRow): Promise<void> {
  await dialog.getByRole("button", { name: /^(양식 변경|양식 선택)$/ }).click();
  const picker = await latestDialog(page, "양식 선택");
  await picker.getByLabel("전체 카테고리 보기").check({ force: true });
  await picker.getByPlaceholder("양식 이름").fill(template.name);
  const card = picker.locator(".tpl-picker__card").filter({ hasText: template.name }).filter({ hasText: "승인" }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await picker.getByRole("button", { name: "이 양식 적용", exact: true }).click();
  await expect(picker).toBeHidden({ timeout: 15_000 });
}

async function selectStudentInUi(page: Page, name: string): Promise<void> {
  await gotoAndSettle(page, `${BASE}/admin/students/home`, { timeout: 45_000 });
  const search = page.locator("[data-guide='students-search']");
  await expect(search).toBeVisible({ timeout: 15_000 });
  await search.click({ clickCount: 3 });
  await search.fill(name);
  const row = page.locator("tbody tr").filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  const checkbox = row.getByRole("checkbox", { name: `${name} 선택`, exact: true });
  await checkbox.click({ force: true });
  await expect(checkbox).toBeChecked({ timeout: 10_000 });
  await expect(page.getByText("1명 선택됨", { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function waitForRealSendLog(
  request: APIRequestContext,
  token: string,
  studentId: number,
  marker: string,
): Promise<NotificationLogRow> {
  let matched: NotificationLogRow | undefined;
  await waitForCondition(
    async () => {
      const body = await expectApi<any>(request, "GET", "/messaging/log/?page_size=50", token);
      matched = listFromBody<NotificationLogRow>(body).find((row) =>
        row.target_id === String(studentId) &&
        row.target_name === STUDENT_NAME &&
        (row.message_body || "").includes(marker),
      );
      return !!matched && matched.status !== "processing";
    },
    { timeoutMs: 180_000, intervalMs: 3000, description: "controlled real Alimtalk NotificationLog finalized" },
  );
  return matched as NotificationLogRow;
}

test.describe.serial("[E2E] 통제번호 실제 알림톡 발송 검증", () => {
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("학생 선택 UI에서 즉시 발송하고 provider id가 있는 성공 로그를 확인한다", async ({ page, request }) => {
    if (isProductionApi()) {
      expect(CONTROLLED_PHONE, "운영 실발송은 통제번호 한 곳만 허용").toBe("01031217466");
    }

    const token = (await loginToken(request)).access;
    const operations = await expectApi<OperationsStatus>(request, "GET", "/messaging/operations/status/", token);
    expect(operations.worker?.status, `messaging worker status ${JSON.stringify(operations.worker)}`).toBe("ok");
    expect(
      (operations.templates?.approved ?? 0) + (operations.templates?.owner_approved ?? 0),
      "승인 알림톡 템플릿이 있어야 함",
    ).toBeGreaterThan(0);

    const student = await createControlledStudent(request, token);
    const approvedTemplate = await findApprovedSendTemplate(request, token);
    const marker = `${RUN} 통제번호 실제 알림톡 발송`;

    await loginViaUI(page, "admin", { landingPath: "/admin/students/home" });
    await selectStudentInUi(page, STUDENT_NAME);
    await page.getByRole("button", { name: "메시지 발송", exact: true }).click();

    const dialog = await latestDialog(page, "알림톡 발송");
    const studentTarget = dialog.locator("label.send-modal__check").filter({ hasText: "학생" }).locator("input[type='checkbox']");
    if (await studentTarget.isChecked().catch(() => false)) await studentTarget.uncheck({ force: true });
    const parentTarget = dialog.locator("label.send-modal__check").filter({ hasText: "학부모" }).locator("input[type='checkbox']");
    if (!(await parentTarget.isChecked().catch(() => false))) await parentTarget.check({ force: true });

    await dialog.locator("[aria-label='발송 시점']").getByRole("button", { name: "즉시", exact: true }).click();
    await applyTemplateFromPicker(page, dialog, approvedTemplate);
    await dialog.locator("textarea").first().fill(
      `${marker}\n이 메시지는 운영 발송 경로 확인을 위한 통제번호 전용 1건입니다.`,
    );

    const sendButton = dialog.getByRole("button", { name: /학부모 1명에게 알림톡 발송/ });
    await expect(sendButton).toBeEnabled({ timeout: 45_000 });
    await sendButton.click();
    await page.getByRole("button", { name: "발송하기", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 45_000 });

    const log = await waitForRealSendLog(request, token, student.id, marker);
    expect(log.success, `failure_reason=${log.failure_reason || ""}`).toBe(true);
    expect(log.status).toBe("sent");
    expect(log.message_mode).toBe("alimtalk");
    expect(log.recipient_summary || "").toMatch(/010\d?\*{4}/);
    expect(log.recipient_summary || "").not.toContain(CONTROLLED_PHONE);
    expect((log.provider_message_id || "").trim(), "Solapi/provider group id").not.toBe("");
  });
});
