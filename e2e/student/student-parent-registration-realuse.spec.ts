/** Seven required candidate-only journeys; never retarget legacy production suites. */
import { createHash } from "node:crypto";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle } from "../helpers/wait";
import {
  api, assertNoHorizontalOverflow, cleanupQaFamily, expectApi,
  installQaStudentParentBoundary, loginAdmin, loginApi, loginThroughUi,
  QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_TENANT, reloadStudentApp,
  type QaFamily, type QaStudent,
} from "../helpers/qaStudentParentScenario";

test.setTimeout(480_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
test.describe.configure({ mode: "serial" });

type Kind = "fixed" | "phone_last4" | "random";
type Policy = { student_mode: Kind | null; parent_mode: Kind | null; student_fixed_password: string; parent_fixed_password: string };
const policyPath = "/students/account-password-settings/";
const digest = createHash("sha256").update(QA_TENANT).digest("hex");
const prefix = `qa-account-registration-${digest.slice(0, 12)}-`;
const direct = " synthetic initial 42 ";
let admin = "";
let cleanupAuthorized = false;
let families: QaFamily[] = [];
let boundary: { assertClean: () => void };
let guards: ReturnType<typeof attachStrictBrowserGuards>;

function fixture(key: string, parentPhone?: string) {
  const hash = createHash("sha256").update(`${QA_TENANT}:${key}`).digest("hex");
  const digits = (offset: number) => String(Number.parseInt(hash.slice(offset, offset + 8), 16) % 100_000_000).padStart(8, "0");
  return { key, name: `${prefix}${key}`, username: `qa-account-${hash.slice(0, 12)}`,
    phone: `010${digits(0)}`, parentPhone: parentPhone ?? `010${digits(8)}` };
}

async function staffLogin(page: Page) {
  await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`);
  await page.getByTestId("login-username").fill(QA_ADMIN_USER);
  await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
  await acknowledgeInitialAccountPromptsIfVisible(page);
}

async function openRegistration(page: Page, row: ReturnType<typeof fixture>, withPhone = true) {
  await gotoAndSettle(page, `${QA_BASE}/workspace/students/home`);
  await page.getByRole("button", { name: "학생 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "학생 등록" });
  await dialog.getByText("1명만 등록", { exact: true }).click();
  await dialog.getByPlaceholder("이름", { exact: true }).fill(row.name);
  await dialog.getByLabel("학부모 전화 앞 4자리").fill(row.parentPhone.slice(3));
  if (withPhone) await dialog.getByLabel("학생 전화 앞 4자리").fill(row.phone.slice(3));
  else await dialog.getByPlaceholder("로그인 아이디 (선택·비우면 학생 전화번호 사용)").fill(row.username);
  await dialog.getByRole("button", { name: "등록", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "학생 등록 최종 확인" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.locator('input[type="radio"]:checked')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  expect(await confirmation.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  return confirmation;
}

async function choose(confirmation: Locator, role: "학생" | "학부모", kind: Kind, password = direct) {
  const label = { fixed: "직접 입력", phone_last4: "전화번호 뒤 4자리", random: "랜덤 번호" }[kind];
  await confirmation.getByRole("group", { name: `${role} 초기 비밀번호`, exact: true }).getByLabel(label, { exact: true }).check();
  if (kind === "fixed") await confirmation.getByLabel(`${role} 직접 입력 비밀번호`, { exact: true }).fill(password);
}

async function saveRegistration(page: Page, confirmation: Locator, row: ReturnType<typeof fixture>, kind: Kind, withPhone = true, parentPassword?: string) {
  const submitted = page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/v1\/students\/$/.test(r.url()));
  await confirmation.getByRole("button", { name: "확인하고 등록", exact: true }).click();
  const response = await submitted;
  expect(response.status(), "synthetic registration status").toBe(201);
  const student = await response.json() as QaStudent;
  families.push({ scenarioKey: row.key, parentPhone: row.parentPhone,
    parentPassword: parentPassword ?? (kind === "random" ? "" : kind === "phone_last4" ? row.parentPhone.slice(-4) : direct),
    students: [{ ...student, password: kind === "random" ? "" : kind === "phone_last4" ? row.phone.slice(-4) : direct }] });
  expect(student.name).toBe(row.name);
  expect(student.ps_number === (withPhone ? row.phone : row.username)).toBe(true);
  await expect(confirmation).not.toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  return families.at(-1)!;
}

async function proveFamily(page: Page, request: APIRequestContext, family: QaFamily, width = 390) {
  for (const role of ["student", "parent"] as const) {
    const student = family.students[0];
    const username = role === "student" ? student.ps_number : family.parentPhone;
    const password = role === "student" ? student.password : family.parentPassword;
    expect(Boolean(password), "UI login requires a known assigned credential; random values stay inside the candidate probe").toBe(true);
    const tokens = await loginApi(request, username, password);
    const me = await expectApi<{ tenantRole: string }>(request, "GET", "/core/me/", tokens.access);
    expect(me.tenantRole).toBe(role);
    const context = await page.context().browser()!.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    const rolePage = await context.newPage();
    const roleBoundary = await installQaStudentParentBoundary(rolePage, request);
    const roleGuards = attachStrictBrowserGuards(rolePage);
    try {
      await loginThroughUi(rolePage, username, password);
      if (role === "parent" && family.scenarioKey === "existing-parent-second") {
        await rolePage.getByRole("tablist", { name: "자녀 선택" }).getByRole("tab", { name: student.name, exact: true }).click();
      }
      await gotoAndSettle(rolePage, `${QA_BASE}/student/profile`);
      await expect(rolePage.getByText(student.name, { exact: true }).first()).toBeVisible();
      await reloadStudentApp(rolePage);
      await expect(rolePage.getByText(student.name, { exact: true }).first()).toBeVisible();
      await assertNoHorizontalOverflow(rolePage);
      roleBoundary.assertClean(); roleGuards.assertZeroDefects();
    } finally { await context.close(); }
  }
}

async function probe(studentId: number, mode: "verify" | "snapshot" | "compare", kind: Kind) {
  // Node-side, capability-authenticated localhost control; no production API or raw credentials.
  expect(QA_BASE).toBe("http://localhost:4173");
  const capability = process.env.E2E_ACCOUNT_PROBE_CAPABILITY;
  expect(Boolean(capability && /^[a-f0-9]{64}$/.test(capability)), "required candidate account probe capability").toBe(true);
  const response = await fetch(`${QA_BASE}/__qa__/account-registration`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(240_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${capability}` },
    body: JSON.stringify({ studentId, mode, kind }),
  });
  expect(response.status(), "required candidate account probe status").toBe(200);
  const result = await response.json() as Record<string, unknown>;
  expect(result).toMatchObject({ schema: "account-registration-development/v1", mode, kind,
    credentials_valid: true, token_me_valid: true, role_count: 2, business_mutations: 0 });
  if (kind === "random") expect(result.random_format_valid).toBe(true);
  if (mode === "compare") expect(result).toMatchObject({ parent_hash_preserved: true, snapshot_count: 0 });
}

test.beforeEach(async ({ page, request }) => {
  cleanupAuthorized = false;
  families = [];
  boundary = await installQaStudentParentBoundary(page, request);
  guards = attachStrictBrowserGuards(page);
  admin = (await loginAdmin(request)).access;
  cleanupAuthorized = true;
  await staffLogin(page);
});

test.afterEach(async ({ request }) => {
  // A rejected runtime or failed admin login must never issue cleanup requests.
  if (!cleanupAuthorized) return;
  try {
    // The exact disposable prefix also catches a persisted POST whose browser response failed.
    const listing = await expectApi<{ results: QaStudent[] }>(request, "GET", `/students/?search=${prefix}&page_size=100`, admin);
    const own = [...new Map([...families.flatMap((family) => family.students), ...listing.results.filter((student) => student.name.startsWith(prefix))].map((student) => [student.id, student])).values()];
    if (own.length) await cleanupQaFamily(request, admin, { scenarioKey: "registration-cleanup", parentPhone: "", parentPassword: "", students: own });
    const remaining = await expectApi<{ results: QaStudent[] }>(request, "GET", `/students/?search=${prefix}&page_size=100`, admin);
    expect(remaining.results.filter((student) => student.name.startsWith(prefix))).toHaveLength(0);
  } finally { boundary.assertClean(); guards.assertZeroDefects(); }
});

test("SSOT: role-only setting PATCH persists and does not preselect registration", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const before = await expectApi<Policy>(request, "GET", policyPath, admin);
  await gotoAndSettle(page, `${QA_BASE}/workspace/settings/organization`);
  await page.getByText("학생 · 학부모 초기 비밀번호 설정", { exact: true }).click();
  await page.getByLabel("학생 초기 비밀번호 방식", { exact: true }).selectOption("fixed");
  await page.getByLabel("학생 공통 초기 비밀번호", { exact: true }).fill(direct);
  const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().endsWith(policyPath));
  await page.getByRole("button", { name: "초기 비밀번호 설정 저장", exact: true }).click();
  const first = await saved;
  expect(first.status()).toBe(200);
  expect(Object.keys(first.request().postDataJSON()).sort()).toEqual(["student_fixed_password", "student_mode"]);
  const studentSaved = await expectApi<Policy>(request, "GET", policyPath, admin);
  expect(studentSaved.parent_mode).toBe(before.parent_mode);
  expect(studentSaved.parent_fixed_password === before.parent_fixed_password).toBe(true);
  await page.getByLabel("학부모 초기 비밀번호 방식", { exact: true }).selectOption("phone_last4");
  const parentSaved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().endsWith(policyPath));
  await page.getByRole("button", { name: "초기 비밀번호 설정 저장", exact: true }).click();
  const second = await parentSaved;
  expect(second.status()).toBe(200);
  expect(Object.keys(second.request().postDataJSON())).toEqual(["parent_mode"]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("학생 · 학부모 초기 비밀번호 설정", { exact: true }).click();
  await expect(page.getByLabel("학생 초기 비밀번호 방식", { exact: true })).toHaveValue("fixed");
  await expect(page.getByLabel("학부모 초기 비밀번호 방식", { exact: true })).toHaveValue("phone_last4");
  expect((await expectApi<Policy>(request, "GET", policyPath, admin)).student_fixed_password === direct).toBe(true);
  const confirmation = await openRegistration(page, fixture("settings"));
  await confirmation.getByRole("button", { name: "다시 확인", exact: true }).click();
});

test("direct: exact initial values work for Student and Parent after save and reload", async ({ page, request }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const row = fixture("fixed");
  const confirmation = await openRegistration(page, row);
  await choose(confirmation, "학생", "fixed"); await choose(confirmation, "학부모", "fixed");
  await proveFamily(page, request, await saveRegistration(page, confirmation, row, "fixed"), 1366);
});

test("own phone: Student and Parent use their respective different last four digits", async ({ page, request }) => {
  const row = fixture("phone");
  expect(row.phone.slice(-4) === row.parentPhone.slice(-4)).toBe(false);
  const confirmation = await openRegistration(page, row);
  await choose(confirmation, "학생", "phone_last4"); await choose(confirmation, "학부모", "phone_last4");
  const family = await saveRegistration(page, confirmation, row, "phone_last4");
  await proveFamily(page, request, family);
  await probe(family.students[0].id, "verify", "phone_last4");
});

test("random: both generated six-digit credentials authenticate without resetting them", async ({ page, request }) => {
  const row = fixture("random");
  const confirmation = await openRegistration(page, row);
  await choose(confirmation, "학생", "random"); await choose(confirmation, "학부모", "random");
  const family = await saveRegistration(page, confirmation, row, "random");
  const stored = await expectApi<QaStudent>(request, "GET", `/students/${family.students[0].id}/`, admin);
  expect(stored.name).toBe(row.name);
  await probe(stored.id, "verify", "random");
});

test("no phone: mandatory selection and short-input failures recover to a successful registration", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  let posts = 0;
  page.on("request", (r) => { if (r.method() === "POST" && /\/api\/v1\/students\/$/.test(r.url())) posts += 1; });
  const row = fixture("no-phone");
  let confirmation = await openRegistration(page, row, false);
  await expect(confirmation.getByRole("group", { name: "학생 초기 비밀번호", exact: true }).getByLabel("전화번호 뒤 4자리", { exact: true })).toBeDisabled();
  await confirmation.getByRole("button", { name: "확인하고 등록", exact: true }).click();
  await expect(confirmation.getByText("학생 비밀번호 방식을 선택해 주세요.", { exact: true })).toBeVisible();
  expect(posts).toBe(0);
  await choose(confirmation, "학생", "fixed", "123"); await choose(confirmation, "학부모", "fixed");
  await confirmation.getByRole("button", { name: "확인하고 등록", exact: true }).click();
  await expect(confirmation.getByText("학생 비밀번호를 4자 이상 입력해 주세요.", { exact: true })).toBeVisible();
  expect(posts).toBe(0);
  await confirmation.getByRole("button", { name: "다시 확인", exact: true }).click();
  await page.getByRole("dialog", { name: "학생 등록" }).getByRole("button", { name: "등록", exact: true }).click();
  confirmation = page.getByRole("alertdialog", { name: "학생 등록 최종 확인" });
  await expect(confirmation.locator('input[type="radio"]:checked')).toHaveCount(0);
  await choose(confirmation, "학생", "fixed"); await choose(confirmation, "학부모", "fixed");
  await proveFamily(page, request, await saveRegistration(page, confirmation, row, "fixed", false));
  expect(posts).toBe(1);
});

test("existing Parent: a new child's choice preserves the exact existing Parent hash and login", async ({ page, request }) => {
  const first = fixture("existing-parent-first");
  let confirmation = await openRegistration(page, first);
  await choose(confirmation, "학생", "fixed"); await choose(confirmation, "학부모", "fixed");
  const firstFamily = await saveRegistration(page, confirmation, first, "fixed");
  const parentBefore = await loginApi(request, first.parentPhone, direct);
  const identityBefore = await expectApi<{ id: number }>(request, "GET", "/core/me/", parentBefore.access);
  await probe(firstFamily.students[0].id, "snapshot", "fixed");
  const second = fixture("existing-parent-second", first.parentPhone);
  confirmation = await openRegistration(page, second);
  await choose(confirmation, "학생", "fixed"); await choose(confirmation, "학부모", "random");
  const secondFamily = await saveRegistration(page, confirmation, second, "fixed", true, direct);
  await probe(secondFamily.students[0].id, "compare", "fixed");
  expect((await expectApi<{ id: number }>(request, "GET", "/core/me/", parentBefore.access)).id).toBe(identityBefore.id);
  await proveFamily(page, request, secondFamily);
  await probe(secondFamily.students[0].id, "snapshot", "fixed");
  await expectApi(request, "POST", "/students/bulk_delete/", admin, { ids: [secondFamily.students[0].id] }, [200, 204]);
  await expectApi(request, "POST", "/students/bulk_restore/", admin, { ids: [secondFamily.students[0].id] }, [200]);
  await probe(secondFamily.students[0].id, "compare", "fixed");
  await proveFamily(page, request, secondFamily, 1366);
});

test("public signup: submitted Parent choice survives changed defaults and staff approval", async ({ page, request }) => {
  const settings = "/students/registration_requests/settings/";
  const original = await expectApi<{ auto_approve: boolean }>(request, "GET", settings, admin);
  const row = fixture("signup");
  let pendingId: number | undefined;
  const context = await page.context().browser()!.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: "block" });
  const signupPage = await context.newPage();
  const signupBoundary = await installQaStudentParentBoundary(signupPage, request);
  const signupGuards = attachStrictBrowserGuards(signupPage);
  try {
    await expectApi(request, "PATCH", settings, admin, { auto_approve: false });
    await gotoAndSettle(signupPage, `${QA_BASE}/login/${QA_TENANT}`);
    await signupPage.getByRole("button", { name: "회원가입", exact: true }).click();
    const dialog = signupPage.getByRole("dialog", { name: "학생 회원가입" });
    for (const [id, value] of [["name", row.name], ["username", row.username], ["pw", direct], ["pw-confirm", direct], ["high", "QA 격리고등학교"], ["address", "QA 합성 주소"]]) await dialog.locator(`#signup-${id}`).fill(value);
    await dialog.getByRole("group", { name: "성별", exact: true }).getByRole("button", { name: "여", exact: true }).click();
    await dialog.locator("#signup-grade").selectOption("1");
    if (await dialog.locator("#signup-origin").isVisible()) await dialog.locator("#signup-origin").fill("QA 격리중학교");
    for (const [label, phone] of [["휴대전화", row.phone], ["학부모 연락처", row.parentPhone]]) {
      await dialog.getByLabel(`${label} 앞 4자리`).fill(phone.slice(3, 7));
      await dialog.getByLabel(`${label} 뒤 4자리`).fill(phone.slice(7));
    }
    await dialog.getByRole("button", { name: "가입 신청", exact: true }).click();
    const confirmation = signupPage.getByRole("alertdialog", { name: "가입 신청 최종 확인" });
    await expect(confirmation.locator('input[type="radio"]:checked')).toHaveCount(0);
    await choose(confirmation, "학부모", "fixed");
    const submitted = signupPage.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/students/registration_requests/"));
    await confirmation.getByRole("button", { name: "가입 신청", exact: true }).click();
    const response = await submitted;
    expect(response.status()).toBe(201);
    pendingId = (await response.json() as { id: number }).id;
    // A later academy policy cannot rewrite the pending applicant's explicit choice.
    await expectApi(request, "PATCH", policyPath, admin, { parent_mode: "random" });
    await gotoAndSettle(page, `${QA_BASE}/workspace/students/requests`);
    await page.locator(".students-requests__card").filter({ hasText: row.name }).click();
    await page.getByRole("dialog").filter({ hasText: "가입 신청 상세" }).getByRole("button", { name: "승인", exact: true }).click();
    const approval = page.getByRole("alertdialog", { name: "가입 승인 최종 확인" });
    await expect(approval.locator('input[type="radio"]')).toHaveCount(0);
    const approved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/registration_requests/${pendingId}/approve/`));
    await approval.getByRole("button", { name: "승인", exact: true }).click();
    const approvalResponse = await approved;
    expect(approvalResponse.status()).toBe(200);
    const student = await approvalResponse.json() as QaStudent;
    const family = { scenarioKey: row.key, parentPhone: row.parentPhone, parentPassword: direct, students: [{ ...student, password: direct }] };
    families.push(family);
    await page.reload({ waitUntil: "domcontentloaded" });
    await proveFamily(page, request, family);
    await probe(student.id, "verify", "fixed");
    signupBoundary.assertClean(); signupGuards.assertZeroDefects();
  } finally {
    if (pendingId) {
      const removed = await api(request, "DELETE", `/students/registration_requests/${pendingId}/`, admin);
      expect([204, 404]).toContain(removed.status);
    }
    await expectApi(request, "PATCH", settings, admin, { auto_approve: original.auto_approve });
    await context.close();
  }
});
