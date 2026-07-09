/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fixture-backed destructive/state-changing button audit.
 *
 * This spec intentionally clicks save/delete/send/upload/approve/logout buttons,
 * but only against records created with a unique [E2E-*] marker. External sends
 * are avoided by using scheduled+cancelled messaging or the controlled phone.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

test.setTimeout(360_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = "hakwonplus";
const ADMIN_USER = requiredEnv("E2E_ADMIN_USER");
const ADMIN_PASS = requiredEnv("E2E_ADMIN_PASS");
const TS = Date.now();
const RUN = `[E2E-DEST-${TS}]`;
const CONTROLLED_PHONE = (process.env.E2E_DESTRUCTIVE_CONTROLLED_PHONE || "01031217466").trim();
const ORIGINAL_PW = "test1234";

type Tokens = { access: string; refresh: string };
type StudentRow = {
  id: number;
  name: string;
  ps_number?: string;
  parent_phone?: string;
  phone?: string | null;
  is_managed?: boolean;
  deleted_at?: string | null;
};
type RegistrationRow = {
  id: number;
  name: string;
  status: "pending" | "approved" | "rejected";
  student?: number | null;
};
type ScheduledItem = {
  id: number;
  status: "pending" | "sent" | "failed" | "cancelled";
  target_id: string;
  target_name: string;
  message_preview?: string;
};
type PostRow = {
  id: number;
  title: string;
  attachments?: Array<{ id: number; original_name: string }>;
};
type MessageTemplateRow = {
  id: number;
  category: string;
  name: string;
  body: string;
  solapi_template_id?: string;
  solapi_status?: string;
};

const created = {
  access: "",
  studentIds: new Set<number>(),
  registrationIds: new Set<number>(),
  scheduledIds: new Set<number>(),
  postIds: new Set<number>(),
  registrationAutoApproveOriginal: undefined as boolean | undefined,
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing required env ${name}. See frontend/.env.e2e.example.`);
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

function suffix(extra = ""): string {
  return `${String(TS).slice(-8)}${extra}`;
}

function generatedPhone(offset: number): string {
  const n = (Number(String(TS).slice(-8)) + offset) % 100_000_000;
  return `010${String(n).padStart(8, "0")}`;
}

function localDateTimeInput(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  let body: any = null;
  const text = await resp.text().catch(() => "");
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

async function safeApi(
  request: APIRequestContext,
  method: string,
  pathName: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!created.access) return;
  const out = await apiFetch(request, method, pathName, created.access, data);
  if (![200, 202, 204, 400, 404].includes(out.status)) {
    console.log(`cleanup ${method} ${pathName}: ${out.status} ${JSON.stringify(out.body)}`);
  }
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.access) {
    await loginToken(request).catch(() => undefined);
  }
  if (!created.access) return;

  for (const scheduledId of [...created.scheduledIds]) {
    await safeApi(request, "POST", `/messaging/scheduled/${scheduledId}/cancel/`);
    created.scheduledIds.delete(scheduledId);
  }

  for (const postId of [...created.postIds]) {
    await safeApi(request, "DELETE", `/community/posts/${postId}/`);
    created.postIds.delete(postId);
  }

  for (const registrationId of [...created.registrationIds]) {
    await safeApi(request, "DELETE", `/students/registration_requests/${registrationId}/`);
    created.registrationIds.delete(registrationId);
  }

  const ids = [...created.studentIds].filter((id) => Number.isFinite(id));
  if (ids.length > 0) {
    await safeApi(request, "POST", "/students/bulk_delete/", { ids });
    await safeApi(request, "POST", "/students/bulk_permanent_delete/", { ids });
    created.studentIds.clear();
  }

  if (created.registrationAutoApproveOriginal !== undefined) {
    await safeApi(request, "PATCH", "/students/registration_requests/settings/", {
      auto_approve: created.registrationAutoApproveOriginal,
    });
    created.registrationAutoApproveOriginal = undefined;
  }
}

async function createStudentApi(
  request: APIRequestContext,
  token: string,
  name: string,
  username: string,
  parentPhone = CONTROLLED_PHONE,
): Promise<StudentRow> {
  const student = await expectApi<StudentRow>(request, "POST", "/students/", token, {
    name,
    parent_phone: parentPhone,
    ps_number: username,
    no_phone: true,
    school_type: "HIGH",
    high_school: "E2E고",
    grade: 1,
    gender: "M",
    initial_password: ORIGINAL_PW,
    memo: `${RUN} fixture student. Account notice follows the mandatory delivery path.`,
  });
  created.studentIds.add(Number(student.id));
  return student;
}

async function createRegistrationRequest(
  request: APIRequestContext,
  name: string,
  username: string,
  phone: string,
  parentPhone = phone,
): Promise<{ status: number; body: RegistrationRow | any }> {
  const out = await apiFetch<RegistrationRow>(request, "POST", "/students/registration_requests/", undefined, {
    name,
    username,
    initial_password: ORIGINAL_PW,
    parent_phone: parentPhone,
    phone,
    school_type: "HIGH",
    high_school: "E2E고",
    origin_middle_school: "E2E중",
    grade: 1,
    gender: "M",
    address: `${RUN} fixture address`,
    memo: `${RUN} 가입신청 버튼 감사 fixture`,
  });
  if (out.status === 201 && out.body?.id) created.registrationIds.add(Number(out.body.id));
  return out;
}

async function findStudent(
  request: APIRequestContext,
  token: string,
  name: string,
  deleted = false,
): Promise<StudentRow | undefined> {
  const params = new URLSearchParams({
    search: name,
    page_size: "20",
    ordering: "-id",
  });
  if (deleted) params.set("deleted", "true");
  const body = await expectApi<any>(request, "GET", `/students/?${params.toString()}`, token);
  return listFromBody<StudentRow>(body).find((row) => row.name === name);
}

async function waitForStudent(
  request: APIRequestContext,
  token: string,
  name: string,
  deleted = false,
): Promise<StudentRow> {
  let found: StudentRow | undefined;
  await waitForCondition(
    async () => {
      found = await findStudent(request, token, name, deleted);
      return !!found;
    },
    { timeoutMs: 30_000, intervalMs: 1000, description: `${name} student row` },
  );
  return found as StudentRow;
}

async function waitForStudentManaged(
  request: APIRequestContext,
  token: string,
  studentId: number,
  expected: boolean,
): Promise<void> {
  await waitForCondition(
    async () => {
      const detail = await expectApi<StudentRow>(request, "GET", `/students/${studentId}/`, token);
      return detail.is_managed === expected;
    },
    { timeoutMs: 20_000, intervalMs: 750, description: `student ${studentId} is_managed=${expected}` },
  );
}

async function confirmAction(page: Page, confirmText: string): Promise<void> {
  const dialog = page.locator("[data-confirm-dialog]").last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: confirmText, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

async function latestDialog(page: Page, text: string): Promise<Locator> {
  const dialog = page.getByRole("dialog").filter({ hasText: text }).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

async function setFirstSwitch(dialog: Locator, checked: boolean): Promise<void> {
  const sw = dialog.getByRole("switch").first();
  await expect(sw).toBeVisible();
  const current = (await sw.getAttribute("aria-checked")) === "true";
  if (current !== checked) await sw.click();
}

async function fillParentPhone(dialog: Locator, phone: string): Promise<void> {
  await dialog.getByLabel("학부모 전화 앞 4자리").fill(phone.slice(3, 7));
  await dialog.getByLabel("학부모 전화 뒤 4자리").fill(phone.slice(7));
}

async function gotoStudents(page: Page, deleted = false): Promise<void> {
  await gotoAndSettle(page, `${BASE}${deleted ? "/admin/students/deleted" : "/admin/students/home"}`, { timeout: 45_000 });
  await expect(page.locator("[data-guide='students-search']")).toBeVisible({ timeout: 15_000 });
}

async function searchStudentInUi(page: Page, name: string, deleted = false): Promise<void> {
  await gotoStudents(page, deleted);
  const search = page.locator("[data-guide='students-search']");
  await search.click({ clickCount: 3 });
  await search.fill(name);
  await waitForCondition(
    async () => {
      const rows = page.locator("tbody tr");
      const rowCount = await rows.count();
      const hasFixtureRow = await studentTableRow(page, name).isVisible().catch(() => false);
      return rowCount === 1 && hasFixtureRow;
    },
    { timeoutMs: 20_000, intervalMs: 500, description: `student table filtered to ${name}` },
  );
  await expect(page.getByText("0명 선택됨", { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function selectStudentInUi(page: Page, name: string, deleted = false): Promise<void> {
  await searchStudentInUi(page, name, deleted);
  const row = studentTableRow(page, name);
  await expect(row).toBeVisible({ timeout: 10_000 });
  const checkbox = row.getByRole("checkbox", { name: `${name} 선택`, exact: true });
  await checkbox.click({ force: true });
  await expect(checkbox).toBeChecked({ timeout: 10_000 });
  await expect(page.getByText("1명 선택됨", { exact: true })).toBeVisible({ timeout: 10_000 });
}

function studentTableRow(page: Page, name: string): Locator {
  return page.locator("tbody tr").filter({ hasText: name }).first();
}

async function closeWithdrawalPreviewIfOpen(page: Page): Promise<void> {
  const preview = page.getByRole("dialog").filter({ hasText: "퇴원 처리 완료 안내 발송" }).last();
  if (await preview.isVisible().catch(() => false)) {
    await preview.getByRole("button", { name: "취소", exact: true }).click();
    await expect(preview).toBeHidden({ timeout: 10_000 });
  }
}

async function waitForScheduledMessage(
  request: APIRequestContext,
  token: string,
  studentId: number,
  marker: string,
): Promise<ScheduledItem> {
  let matched: ScheduledItem | undefined;
  await waitForCondition(
    async () => {
      const body = await expectApi<any>(
        request,
        "GET",
        "/messaging/scheduled/?status=pending&page_size=50",
        token,
      );
      matched = listFromBody<ScheduledItem>(body).find(
        (item) => item.target_id === String(studentId) && (item.message_preview || "").includes(marker),
      );
      return !!matched;
    },
    { timeoutMs: 30_000, intervalMs: 1000, description: `pending scheduled message for student ${studentId}` },
  );
  return matched as ScheduledItem;
}

function templateVarNames(body: string): string[] {
  return [...body.matchAll(/#\{([^}]+)\}/g)].map((match) => match[1]);
}

async function findApprovedMessageTemplate(
  request: APIRequestContext,
  token: string,
): Promise<MessageTemplateRow> {
  const body = await expectApi<any>(
    request,
    "GET",
    "/messaging/templates/?include_system=true&page_size=300",
    token,
  );
  const approved = listFromBody<MessageTemplateRow>(body).filter(
    (template) => template.solapi_status === "APPROVED" && Boolean((template.solapi_template_id || "").trim()),
  );
  const noVarTemplate = approved.find((template) => templateVarNames(template.body || "").length === 0);
  const selected = noVarTemplate ?? approved[0];
  expect(selected, "예약 발송 버튼 검증에 사용할 승인 알림톡 템플릿이 있어야 함").toBeTruthy();
  return selected;
}

async function applyMessageTemplateFromPicker(page: Page, dialog: Locator, template: MessageTemplateRow): Promise<void> {
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

async function setRecipientTarget(dialog: Locator, targetLabel: "학부모" | "학생", checked: boolean): Promise<void> {
  const label = dialog.locator("label.send-modal__check").filter({ hasText: targetLabel }).first();
  const input = label.locator("input[type='checkbox']");
  await expect(label).toBeVisible({ timeout: 10_000 });
  if ((await input.isChecked().catch(() => false)) === checked) return;

  await label.click();
  if (checked) {
    await expect(input).toBeChecked({ timeout: 10_000 });
  } else {
    await expect(input).not.toBeChecked({ timeout: 10_000 });
  }
}

async function findMaterialPost(
  request: APIRequestContext,
  token: string,
  title: string,
): Promise<PostRow | undefined> {
  const params = new URLSearchParams({
    post_type: "materials",
    q: title,
    page_size: "20",
  });
  const body = await expectApi<any>(request, "GET", `/community/admin/posts/?${params.toString()}`, token);
  return listFromBody<PostRow>(body).find((post) => post.title === title);
}

test.describe.serial("[E2E] fixture 기반 파괴/상태변경 버튼 전수 감사", () => {
  test.beforeAll(async ({ request }) => {
    await loginToken(request);
  });

  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test("학생 생성/저장/활성토글/비밀번호변경/삭제/복원/영구삭제/로그아웃 버튼이 fixture에만 적용된다", async ({ page, request }) => {
    const token = created.access || (await loginToken(request)).access;
    const originalName = `${RUN} 학생버튼`;
    const updatedName = `${RUN} 학생버튼 저장됨`;
    const username = `e2ed${suffix("s")}`;
    const tempPassword = `Pw${suffix("!")}`;

    await loginViaUI(page, "admin", { landingPath: "/admin/students/home" });
    await page.getByRole("button", { name: "학생 추가", exact: true }).click();
    const createDialog = await latestDialog(page, "학생 등록");
    await createDialog.getByText("1명만 등록", { exact: true }).click();
    await setFirstSwitch(createDialog, false);
    await createDialog.getByPlaceholder("이름").fill(originalName);
    await createDialog.getByPlaceholder("로그인 아이디").fill(username);
    await createDialog.getByPlaceholder("초기 비밀번호").fill(ORIGINAL_PW);
    await fillParentPhone(createDialog, CONTROLLED_PHONE);
    await createDialog.getByRole("button", { name: "남자" }).click();
    await createDialog.locator("select").nth(1).selectOption("1");
    await createDialog.getByPlaceholder("메모").fill(`${RUN} UI 생성 버튼 감사`);
    await createDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(createDialog).toBeHidden({ timeout: 30_000 });

    const createdStudent = await waitForStudent(request, token, originalName);
    created.studentIds.add(createdStudent.id);

    await gotoAndSettle(page, `${BASE}/admin/students/${createdStudent.id}`, { timeout: 45_000 });
    await page.getByRole("button", { name: "수정", exact: true }).click();
    const editDialog = await latestDialog(page, "학생 수정");
    await editDialog.getByPlaceholder("이름").fill(updatedName);
    await editDialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(editDialog).toBeHidden({ timeout: 20_000 });
    await waitForStudent(request, token, updatedName);

    await searchStudentInUi(page, updatedName);
    const row = studentTableRow(page, updatedName);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: "비활성으로 변경", exact: true }).click();
    await waitForStudentManaged(request, token, createdStudent.id, false);
    await row.getByRole("button", { name: "활성으로 변경", exact: true }).click();
    await waitForStudentManaged(request, token, createdStudent.id, true);

    await selectStudentInUi(page, updatedName);
    await page.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
    const pwDialog = await latestDialog(page, "비밀번호 일괄 변경");
    await pwDialog.getByPlaceholder("비워두면 자동 생성").fill(tempPassword);
    await setFirstSwitch(pwDialog, false);
    await pwDialog.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
    await expect(pwDialog).toBeHidden({ timeout: 30_000 });
    await loginTokenForStudent(request, username, tempPassword);

    await selectStudentInUi(page, updatedName);
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await confirmAction(page, "삭제");
    await closeWithdrawalPreviewIfOpen(page);
    await waitForStudent(request, token, updatedName, true);

    await selectStudentInUi(page, updatedName, true);
    await page.getByRole("button", { name: "복원", exact: true }).click();
    await confirmAction(page, "복원");
    await waitForStudent(request, token, updatedName, false);

    await selectStudentInUi(page, updatedName);
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await confirmAction(page, "삭제");
    await closeWithdrawalPreviewIfOpen(page);
    await waitForStudent(request, token, updatedName, true);

    await selectStudentInUi(page, updatedName, true);
    await page.getByRole("button", { name: "즉시 삭제", exact: true }).click();
    await confirmAction(page, "영구 삭제");
    await waitForCondition(
      async () => !(await findStudent(request, token, updatedName, true)),
      { timeoutMs: 30_000, intervalMs: 1000, description: "student permanently removed from deleted list" },
    );
    created.studentIds.delete(createdStudent.id);

    const profileButton = page.locator(".app-header button").filter({ hasText: /admin|사용자|원장|선생|관리자/i }).last();
    await profileButton.click();
    await page.getByRole("menuitem", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/\/login(?:\/hakwonplus)?/, { timeout: 15_000 });
    await expect(page.evaluate(() => localStorage.getItem("access"))).resolves.toBeNull();
  });

  test("가입신청 승인/거절 버튼은 pending fixture만 처리하고 승인 학생은 cleanup된다", async ({ page, request }) => {
    const token = created.access || (await loginToken(request)).access;
    const settings = await expectApi<{ auto_approve: boolean }>(
      request,
      "GET",
      "/students/registration_requests/settings/",
      token,
    );
    created.registrationAutoApproveOriginal = settings.auto_approve;
    if (settings.auto_approve) {
      const updated = await expectApi<{ auto_approve: boolean }>(
        request,
        "PATCH",
        "/students/registration_requests/settings/",
        token,
        { auto_approve: false },
      );
      expect(updated.auto_approve).toBe(false);
    }

    const rejectName = `${RUN} 가입거절`;
    const approveName = `${RUN} 가입승인`;
    const rejectReq = await createRegistrationRequest(
      request,
      rejectName,
      `e2erej${suffix("r")}`,
      generatedPhone(101),
      generatedPhone(102),
    );
    expect(rejectReq.status, `reject registration create -> ${rejectReq.status} ${JSON.stringify(rejectReq.body)}`).toBe(201);

    const approveReq = await createRegistrationRequest(
      request,
      approveName,
      `e2eapp${suffix("a")}`,
      generatedPhone(201),
      CONTROLLED_PHONE,
    );
    expect(approveReq.status, `approve registration create -> ${approveReq.status} ${JSON.stringify(approveReq.body)}`).toBe(201);

    await loginViaUI(page, "admin", { landingPath: "/admin/students/requests" });
    await expect(page.getByText(rejectName, { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(approveName, { exact: false })).toBeVisible({ timeout: 20_000 });

    const rejectCard = page.locator(".students-requests__card").filter({ hasText: rejectName });
    await rejectCard.getByRole("button", { name: "거절", exact: true }).click();
    await confirmAction(page, "거절");
    await waitForCondition(
      async () => {
        const row = await expectApi<RegistrationRow>(request, "GET", `/students/registration_requests/${rejectReq.body.id}/`, token);
        return row.status === "rejected";
      },
      { timeoutMs: 20_000, intervalMs: 1000, description: "registration rejected" },
    );

    const approveCard = page.locator(".students-requests__card").filter({ hasText: approveName });
    await approveCard.getByRole("button", { name: "승인", exact: true }).click();
    await confirmAction(page, "승인");
    await waitForCondition(
      async () => {
        const row = await expectApi<RegistrationRow>(request, "GET", `/students/registration_requests/${approveReq.body.id}/`, token);
        return row.status === "approved" && !!row.student;
      },
      { timeoutMs: 30_000, intervalMs: 1000, description: "registration approved" },
    );
    const approvedStudent = await waitForStudent(request, token, approveName);
    created.studentIds.add(approvedStudent.id);
  });

  test("학생 메시지 발송 버튼은 예약 큐를 만들고 즉시 취소할 수 있다", async ({ page, request }) => {
    const token = created.access || (await loginToken(request)).access;
    const name = `${RUN} 예약발송`;
    const username = `e2emsg${suffix("m")}`;
    const marker = `${RUN} 예약 발송 버튼 검증`;
    const student = await createStudentApi(request, token, name, username);
    const approvedTemplate = await findApprovedMessageTemplate(request, token);

    await loginViaUI(page, "admin", { landingPath: "/admin/students/home" });
    await selectStudentInUi(page, name);
    await page.getByRole("button", { name: "메시지 발송", exact: true }).click();
    const dialog = await latestDialog(page, "알림톡 발송");

    await setRecipientTarget(dialog, "학생", false);
    await setRecipientTarget(dialog, "학부모", true);

    await dialog.locator("[aria-label='발송 시점']").getByRole("button", { name: "예약", exact: true }).click();
    await dialog.getByLabel("예약 발송 시각").fill(localDateTimeInput(7));
    await applyMessageTemplateFromPicker(page, dialog, approvedTemplate);

    const textarea = dialog.locator("textarea").first();
    if (!(await textarea.inputValue()).trim()) {
      const direct = dialog.getByText("직접 작성하기", { exact: true });
      if (await direct.isVisible().catch(() => false)) await direct.click();
    }
    await textarea.fill(`${marker}\n실제 발송 전 즉시 취소되는 E2E fixture입니다.`);

    const reserveButton = dialog.getByRole("button", { name: /학부모 1명에게 알림톡 예약/ });
    await expect(reserveButton).toBeEnabled({ timeout: 45_000 });
    await reserveButton.click();
    await page.getByRole("button", { name: "예약하기", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const scheduled = await waitForScheduledMessage(request, token, student.id, marker);
    created.scheduledIds.add(scheduled.id);
    const cancelled = await expectApi<ScheduledItem>(
      request,
      "POST",
      `/messaging/scheduled/${scheduled.id}/cancel/`,
      token,
    );
    expect(cancelled.status).toBe("cancelled");
    created.scheduledIds.delete(scheduled.id);
  });

  test("자료실 파일 업로드/첨부삭제/자료삭제 버튼은 fixture 자료만 변경한다", async ({ page, request }, testInfo) => {
    const token = created.access || (await loginToken(request)).access;
    const title = `${RUN} 자료실 업로드`;
    const fileName = `e2e-material-${suffix()}.txt`;
    const fixturePath = path.join(testInfo.outputDir, fileName);
    await fs.mkdir(testInfo.outputDir, { recursive: true });
    await fs.writeFile(fixturePath, `${RUN} material attachment fixture\n`, "utf8");

    await loginViaUI(page, "admin", { landingPath: "/admin/community/materials" });
    await page.getByRole("button", { name: "+ 자료 등록", exact: true }).click();
    await page.getByPlaceholder("자료 제목을 입력하세요").fill(title);
    await page.getByRole("button", { name: "등록", exact: true }).click();

    let post: PostRow | undefined;
    await waitForCondition(
      async () => {
        post = await findMaterialPost(request, token, title);
        return !!post;
      },
      { timeoutMs: 45_000, intervalMs: 1500, description: "material post created" },
    );
    created.postIds.add((post as PostRow).id);

    await page.getByLabel("자료실 검색").fill(title);
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByText(title, { exact: true }).click();
    const uploadChooser = page.waitForEvent("filechooser");
    await page.locator(".cms-attach__section").getByRole("button", { name: "+ 파일 추가", exact: true }).click();
    await (await uploadChooser).setFiles(fixturePath);
    await waitForCondition(
      async () => {
        const detail = await expectApi<PostRow>(request, "GET", `/community/posts/${(post as PostRow).id}/`, token);
        return (detail.attachments ?? []).some((att) => att.original_name === fileName);
      },
      { timeoutMs: 45_000, intervalMs: 1500, description: "material attachment uploaded" },
    );
    await expect(page.getByText(fileName, { exact: true })).toBeVisible({ timeout: 20_000 });

    const removeAttachment = page.locator(".cms-attach__item-remove").first();
    await removeAttachment.click();
    await confirmAction(page, "삭제");
    await waitForCondition(
      async () => {
        const detail = await expectApi<PostRow>(request, "GET", `/community/posts/${(post as PostRow).id}/`, token);
        return (detail.attachments ?? []).length === 0;
      },
      { timeoutMs: 30_000, intervalMs: 1000, description: "attachment deleted" },
    );

    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await confirmAction(page, "삭제");
    await waitForCondition(
      async () => {
        const out = await apiFetch(request, "GET", `/community/posts/${(post as PostRow).id}/`, token);
        return out.status === 404;
      },
      { timeoutMs: 30_000, intervalMs: 1000, description: "material post deleted" },
    );
    created.postIds.delete((post as PostRow).id);
  });

  test("결제/카드 영역은 fixture 카드가 없으면 실결제 버튼을 클릭하지 않고 차단 상태를 확인한다", async ({ page, request }) => {
    const token = created.access || (await loginToken(request)).access;
    await loginViaUI(page, "admin", { landingPath: "/admin/settings/billing" });
    await expect(page.getByRole("heading", { name: "결제 / 구독", exact: true })).toBeVisible({ timeout: 20_000 });

    const cardsBody = await expectApi<any>(request, "GET", "/billing/cards/", token);
    const cards = listFromBody<any>(cardsBody).filter((card) => card.is_active !== false);
    if (cards.length === 0) {
      await expect(page.getByText("등록된 카드가 없습니다.", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "카드 등록", exact: true })).toBeVisible();
    } else {
      test.info().annotations.push({
        type: "destructive-fixture-guard",
        description: `활성 결제 카드 ${cards.length}건은 fixture가 아니므로 삭제 버튼을 클릭하지 않음`,
      });
      await expect(page.getByRole("button", { name: "삭제", exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /결제하기|즉시 결제/ })).toHaveCount(0);
  });
});

async function loginTokenForStudent(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<Tokens> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username, password, tenant_code: CODE },
    headers: headers(),
    timeout: 60_000,
  });
  const body = await resp.json().catch(() => null);
  expect(resp.status(), `student token ${username} -> ${resp.status()} ${JSON.stringify(body)}`).toBe(200);
  return body as Tokens;
}
