/**
 * Public recovery request plus unchanged-password login verification for an
 * isolated qa-* student and parent account graph.
 */
import { expect, test } from "../fixtures/strictTest";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  assertQaStudentParentRuntime,
  cleanupQaFamily,
  createQaFamily,
  expectApi,
  installQaStudentParentBoundary,
  loginAdmin,
  loginApi,
  loginThroughUi,
  logoutStudentApp,
  QA_BASE,
  QA_ADMIN_USER,
  QA_ADMIN_PASSWORD,
  QA_STUDENT_PASSWORD,
  QA_TENANT,
  reloadStudentApp,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
  type QaStudent,
} from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import { verifyConsultInbox } from "../helpers/verifyConsultInbox";

test.setTimeout(480_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type AccountNotificationLog = {
  notification_type: string;
  recipient_summary: string;
  status: string;
  success?: boolean;
  target_id: string;
  target_name: string;
};

let family: QaFamily | null = null;
let adminAccess = "";
const signupFamilies: QaFamily[] = [];
const signupRequestIds: number[] = [];

async function verifyExcelSiblingImport(page: Page, request: APIRequestContext, target: QaFamily): Promise<void> {
  assertQaStudentParentRuntime();
  const context = await page.context().browser()!.newContext({ viewport: { width: 390, height: 900 } });
  const uploadPage = await context.newPage();
  const boundary = await installQaStudentParentBoundary(uploadPage, request);
  const browser = attachStrictBrowserGuards(uploadPage);
  const phone = `010${(BigInt(`0x${createHash("sha256").update(`${QA_TENANT}:excel`).digest("hex").slice(0, 12)}`) % 100000000n).toString().padStart(8, "0")}`;
  type ImportResult = { created: number; total: number; created_rows: { student_id: number }[]; duplicates: unknown[]; failed: { row: number }[] };
  try {
    await gotoAndSettle(uploadPage, `${QA_BASE}/login/${QA_TENANT}`);
    await uploadPage.getByTestId("login-username").fill(QA_ADMIN_USER);
    await uploadPage.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
    await uploadPage.getByTestId("login-submit").click();
    await expect(uploadPage).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(uploadPage);
    for (const corrected of [false, true]) {
      await gotoAndSettle(uploadPage, `${QA_BASE}/workspace/students/home`);
      await uploadPage.getByRole("button", { name: "학생 추가", exact: true }).click();
      const dialog = uploadPage.getByRole("dialog");
      await dialog.getByRole("button", { name: "엑셀 업로드", exact: true }).click();
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet("안내").addRow(["학생 명단은 다음 시트에 있습니다."]);
      const sheet = workbook.addWorksheet("학생목록");
      sheet.addRows([
        [],
        ["Guardian Name", "Student Name", "Guardian Phone", "Student Mobile", "School Type", "Grade"],
        ["QA 보호자", "QA 엑셀 첫째", Number(target.parentPhone), Number(phone), "MIDDLE", 2],
        ["QA 보호자", "QA 엑셀 둘째", Number(target.parentPhone), corrected ? "" : "0101234567", "MIDDLE", 1],
      ]);
      await dialog.locator('input[type="file"]').setInputFiles({ name: "qa-student-import.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
      if (!corrected) await expect(dialog.getByText("입력 확인 필요 1명", { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(uploadPage);
      await dialog.getByRole("button", { name: `${corrected ? 2 : 1}명 등록 요청`, exact: true }).click();
      const confirmation = uploadPage.getByRole("alertdialog", { name: "학생 일괄 등록 최종 확인" });
      await confirmation.getByRole("group", { name: "학생 초기 비밀번호" }).getByLabel("직접 입력", { exact: true }).check();
      await confirmation.getByLabel("학생 직접 입력 비밀번호", { exact: true }).fill(QA_STUDENT_PASSWORD);
      await confirmation.getByRole("group", { name: "학부모 초기 비밀번호" }).getByLabel("직접 입력", { exact: true }).check();
      await confirmation.getByLabel("학부모 직접 입력 비밀번호", { exact: true }).fill(QA_STUDENT_PASSWORD);
      const responsePromise = uploadPage.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/students/bulk_create_from_excel/");
      await confirmation.getByRole("button", { name: `${corrected ? 2 : 1}명 등록 요청`, exact: true }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(202);
      const { job_id: jobId } = await response.json() as { job_id: string };
      let result: ImportResult | undefined;
      await expect.poll(async () => {
        const job = await expectApi<{ status: string; result?: ImportResult }>(request, "GET", `/students/excel_job_status/${jobId}/`, adminAccess);
        result = job.result;
        return job.status;
      }, { timeout: 120_000, intervals: [1000, 2000, 5000] }).toBe("DONE");
      for (const row of result!.created_rows) {
        const student = await expectApi<QaStudent & { school_type: string }>(request, "GET", `/students/${row.student_id}/`, adminAccess);
        target.students.push({ ...student, password: QA_STUDENT_PASSWORD });
        expect(student.school_type).toBe("MIDDLE");
        expect(student.name).toBe(corrected ? "QA 엑셀 둘째" : "QA 엑셀 첫째");
        await loginApi(request, student.ps_number, QA_STUDENT_PASSWORD);
      }
      expect(result!.created).toBe(1);
      expect(result!.total).toBe(2);
      expect(result!.duplicates.length).toBe(corrected ? 1 : 0);
      expect(result!.failed.map((row) => row.row)).toEqual(corrected ? [] : [4]);
      const resultDialog = uploadPage.getByRole("dialog", { name: "학생 등록 결과" });
      await expect(resultDialog).toBeVisible({ timeout: 30_000 });
      const summary = resultDialog.getByLabel("등록 결과 요약");
      await expect(summary.getByText("신규 등록", { exact: true }).locator("..")).toContainText("1명");
      await expect(summary.getByText("이미 등록", { exact: true }).locator("..")).toContainText(`${corrected ? 1 : 0}명`);
      await expect(summary.getByText("확인 필요", { exact: true }).locator("..")).toContainText(`${corrected ? 0 : 1}명`);
      if (!corrected) await expect(resultDialog.getByRole("region", { name: "확인 필요", exact: true }).getByText("4행", { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(uploadPage);
      await resultDialog.getByRole("button", { name: "확인", exact: true }).click();
      await expect(resultDialog).toBeHidden();
    }
    const parent = await loginApi(request, target.parentPhone, target.parentPassword);
    const me = await expectApi<{ linkedStudents: { id: number }[] }>(request, "GET", "/core/me/", parent.access);
    expect(me.linkedStudents.map((student) => student.id).sort((a, b) => a - b)).toEqual(target.students.map((student) => student.id).sort((a, b) => a - b));
    await uploadPage.reload({ waitUntil: "domcontentloaded" });
    await expect(uploadPage.getByText("QA 엑셀 첫째", { exact: true }).first()).toBeVisible();
    await expect(uploadPage.getByText("QA 엑셀 둘째", { exact: true }).first()).toBeVisible();
    boundary.assertClean();
    browser.assertZeroDefects();
  } finally {
    await context.close();
  }
}

async function verifyOwnerOrganizationSettings(page: Page, request: APIRequestContext, student: QaFamily["students"][number]): Promise<void> {
  assertQaStudentParentRuntime();
  const ownerUser = "ymath-qa-organization-owner";
  const owner = await loginApi(request, ownerUser, QA_ADMIN_PASSWORD);
  const path = "/core/tenant-info/";
  const original = await expectApi<{
    name: string; phone: string; headquarters_phone: string;
    academies: { name: string; phone: string }[];
  }>(request, "GET", path, owner.access);
  const ownerContext = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await ownerContext.newPage();
  const boundary = await installQaStudentParentBoundary(ownerPage, request);
  const browser = attachStrictBrowserGuards(ownerPage);
  const phone = "02-0000-0000";
  let name = "";
  try {
    await gotoAndSettle(ownerPage, `${QA_BASE}/login/${QA_TENANT}`);
    await ownerPage.getByTestId("login-username").fill(ownerUser);
    await ownerPage.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
    await ownerPage.getByTestId("login-submit").click();
    await expect(ownerPage).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(ownerPage);
    for (const width of [390, 1366]) {
      name = `QA 설정 저장 ${width}`;
      await ownerPage.setViewportSize({ width, height: 900 });
      await gotoAndSettle(ownerPage, `${QA_BASE}/workspace/settings/organization`);
      await expect(ownerPage.getByRole("button", { name: "학원 추가", exact: true })).toBeVisible();
      await ownerPage.getByRole("button", { name: "수정", exact: true }).first().click();
      await ownerPage.getByRole("textbox", { name: "학원명", exact: true }).fill(name);
      await ownerPage.getByRole("textbox", { name: "학원문의 전화번호", exact: true }).fill(phone);
      const before = await expectApi<typeof original>(request, "GET", path, owner.access);
      const concurrentName = `QA 동시 수정 ${width}`;
      const concurrent = [{ name: concurrentName, phone }, ...before.academies.slice(1)];
      await expectApi(request, "PATCH", path, owner.access, {
        academies: concurrent, expected_academies: before.academies,
      });
      const conflictResponse = ownerPage.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/v1/core/tenant-info/");
      await ownerPage.getByRole("button", { name: "저장", exact: true }).click();
      expect((await conflictResponse).status()).toBe(409);
      await expect(ownerPage.getByRole("textbox", { name: "학원명", exact: true })).toHaveValue(name);
      expect((await expectApi<typeof original>(request, "GET", path, owner.access)).academies).toEqual(concurrent);
      await ownerPage.getByRole("button", { name: "최신 목록에서 다시 수정", exact: true }).click();
      await expect(ownerPage.getByText(`${concurrentName} · ${phone}`, { exact: true })).toBeVisible();
      await ownerPage.getByRole("button", { name: "수정", exact: true }).first().click();
      await ownerPage.getByRole("textbox", { name: "학원명", exact: true }).fill(name);
      await ownerPage.getByRole("button", { name: "저장", exact: true }).click();
      await expect(ownerPage.getByText(`${name} · ${phone}`, { exact: true })).toBeVisible();
      await ownerPage.reload({ waitUntil: "domcontentloaded" });
      await expect(ownerPage.getByText(`${name} · ${phone}`, { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(ownerPage);
      const saved = await expectApi<typeof original>(request, "GET", path, owner.access);
      expect(saved.academies[0]).toEqual({ name, phone });
      expect(saved.academies.slice(1)).toEqual(original.academies.slice(1));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await loginThroughUi(page, student.ps_number, student.password);
    await gotoAndSettle(page, `${QA_BASE}/student`);
    await expect(page.locator('a[href="tel:0200000000"]').filter({ hasText: name })).toBeVisible();
    await reloadStudentApp(page);
    await expect(page.locator('a[href="tel:0200000000"]').filter({ hasText: name })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();
  } finally {
    try {
      await expectApi(request, "PATCH", path, owner.access, {
        name: original.name, phone: original.phone, headquarters_phone: original.headquarters_phone,
        academies: original.academies,
      });
      const restored = await expectApi<typeof original>(request, "GET", path, owner.access);
      expect(restored.academies).toEqual(original.academies);
    } finally {
      await ownerContext.close();
    }
  }
}

async function verifySignupAndApproval(page: Page, request: APIRequestContext): Promise<void> {
  const settingsPath = "/students/registration_requests/settings/";
  const original = await expectApi<{ auto_approve: boolean }>(request, "GET", settingsPath, adminAccess);
  const adminContext = await page.context().browser()!.newContext({ viewport: { width: 1366, height: 900 } });
  const adminPage = await adminContext.newPage();
  const boundary = await installQaStudentParentBoundary(adminPage, request);
  const browser = attachStrictBrowserGuards(adminPage);
  try {
    await gotoAndSettle(adminPage, `${QA_BASE}/login/${QA_TENANT}`);
    await adminPage.getByTestId("login-username").fill(QA_ADMIN_USER);
    await adminPage.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
    await adminPage.getByTestId("login-submit").click();
    await expect(adminPage).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(adminPage);

    for (const autoApprove of [false, true]) {
      await gotoAndSettle(adminPage, `${QA_BASE}/workspace/students/requests`);
      const toggle = adminPage.getByRole("switch", { name: "자동 승인" });
      await expect(toggle).toBeEnabled();
      if ((await toggle.getAttribute("aria-checked") === "true") !== autoApprove) {
        const saved = adminPage.waitForResponse((response) => (
          response.request().method() === "PATCH" && response.url().endsWith(settingsPath)
        ));
        await toggle.click();
        expect((await saved).status()).toBe(200);
      }
      await adminPage.reload({ waitUntil: "domcontentloaded" });
      await expect(toggle).toHaveAttribute("aria-checked", String(autoApprove));
      expect((await expectApi<{ auto_approve: boolean }>(request, "GET", settingsPath, adminAccess)).auto_approve).toBe(autoApprove);

      const scenarioKey = autoApprove ? "signup-auto" : "signup-manual";
      const hash = createHash("sha256").update(`${QA_TENANT}:${scenarioKey}`).digest("hex");
      const digits = (offset: number) => String(Number.parseInt(hash.slice(offset, offset + 8), 16) % 100_000_000).padStart(8, "0");
      const username = `qa-signup-${hash.slice(0, 10)}`;
      const name = `QA ${scenarioKey} 학생`;
      const phone = `010${digits(0)}`;
      const parentPhone = `010${digits(8)}`;
      await page.setViewportSize({ width: autoApprove ? 1366 : 390, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`);
      await page.getByRole("button", { name: "회원가입", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "학생 회원가입" });
      await dialog.locator("#signup-name").fill(name);
      await dialog.locator("#signup-username").fill(username);
      await dialog.locator("#signup-pw").fill(QA_STUDENT_PASSWORD);
      await dialog.locator("#signup-pw-confirm").fill(`${QA_STUDENT_PASSWORD}x`);
      await dialog.getByRole("group", { name: "성별", exact: true }).getByRole("button", { name: "여", exact: true }).click();
      for (const [label, number] of [["휴대전화", phone], ["학부모 연락처", parentPhone]]) {
        await dialog.getByLabel(`${label} 앞 4자리`).fill(number.slice(3, 7));
        await dialog.getByLabel(`${label} 뒤 4자리`).fill(number.slice(7));
      }
      await dialog.locator("#signup-high").fill("QA 격리고등학교");
      await dialog.locator("#signup-grade").selectOption("1");
      if (await dialog.locator("#signup-origin").isVisible()) {
        await dialog.locator("#signup-origin").fill("QA 격리중학교");
      }
      await dialog.locator("#signup-address").fill("QA 합성 주소");
      await dialog.getByRole("button", { name: "가입 신청", exact: true }).click();
      await expect(dialog.getByRole("alert")).toHaveText("비밀번호가 일치하지 않습니다.");
      await expect(dialog.locator("#signup-name")).toHaveValue(name);
      await expect(dialog.locator("#signup-username")).toHaveValue(username);
      await expect(dialog.locator("#signup-address")).toHaveValue("QA 합성 주소");
      await assertNoHorizontalOverflow(page);
      await test.info().attach(`signup-validation-${autoApprove ? 1366 : 390}`, {
        body: await page.screenshot({ fullPage: true }), contentType: "image/png",
      });
      await dialog.locator("#signup-pw-confirm").fill(QA_STUDENT_PASSWORD);
      await dialog.getByRole("button", { name: "가입 신청", exact: true }).click();
      const passwordChoice = page.getByRole("alertdialog", { name: "가입 신청 최종 확인" });
      await expect(passwordChoice).toBeVisible();
      await expect(passwordChoice.getByText("학생 비밀번호는 유지합니다.", { exact: true })).toBeVisible();
      const parentPassword = passwordChoice.getByRole("group", { name: "학부모 초기 비밀번호", exact: true });
      await expect(parentPassword.getByRole("radio", { checked: true })).toHaveCount(0);
      await parentPassword.getByRole("radio", { name: "직접 입력", exact: true }).check();
      await parentPassword.getByLabel("학부모 직접 입력 비밀번호", { exact: true }).fill(QA_STUDENT_PASSWORD);
      const submitted = page.waitForResponse((response) => (
        response.request().method() === "POST" && response.url().endsWith("/students/registration_requests/")
      ));
      await passwordChoice.getByRole("button", { name: "가입 신청", exact: true }).click();
      const response = await submitted;
      expect(response.status(),
        `POST /students/registration_requests/ returned ${response.status()}`,
      ).toBe(autoApprove ? 200 : 201);
      let student = await response.json() as { id: number; name: string; ps_number: string; parent_phone: string };
      await expect(dialog.getByRole("status")).toHaveText(autoApprove
        ? "가입이 완료되었습니다. 지금 로그인할 수 있습니다."
        : "신청이 완료되었습니다. 승인 후 로그인해 주세요.");
      if (!autoApprove) {
        const requestId = student.id;
        signupRequestIds.push(requestId);
        await adminPage.reload({ waitUntil: "domcontentloaded" });
        await adminPage.locator(".students-requests__card").filter({ hasText: name }).click();
        await adminPage.getByRole("dialog").filter({ hasText: "가입 신청 상세" }).getByRole("button", { name: "승인", exact: true }).click();
        const approvalDialog = adminPage.getByRole("alertdialog", { name: "가입 승인 최종 확인", exact: true });
        await expect(approvalDialog).toBeVisible();
        await expect(approvalDialog.getByText("학생 비밀번호는 유지합니다.", { exact: true })).toBeVisible();
        await expect(approvalDialog.getByText("학부모의 가입 신청 비밀번호 선택도 유지합니다.", { exact: true })).toBeVisible();
        const [approvalResponse] = await Promise.all([
          adminPage.waitForResponse((result) => (
            result.request().method() === "POST" && result.url().endsWith(`/registration_requests/${requestId}/approve/`)
          )),
          approvalDialog.getByRole("button", { name: "승인", exact: true }).click(),
        ]);
        expect(approvalResponse.status()).toBe(200);
        student = await approvalResponse.json() as typeof student;
      }
      signupFamilies.push({ scenarioKey, parentPhone, parentPassword: QA_STUDENT_PASSWORD,
        students: [{ ...student, password: QA_STUDENT_PASSWORD }] });
      expect(student.ps_number).toBe(username);
      expect(student.parent_phone).toBe(parentPhone);
      await expect(dialog.getByRole("button", { name: autoApprove ? "로그인하기" : "확인", exact: true })).toBeEnabled();
      await dialog.getByRole("button", { name: autoApprove ? "로그인하기" : "확인", exact: true }).click();
      await loginThroughUi(page, username, QA_STUDENT_PASSWORD);
      await gotoAndSettle(page, `${QA_BASE}/student/profile`);
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
      await reloadStudentApp(page);
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await logoutStudentApp(page);
      await loginThroughUi(page, parentPhone, QA_STUDENT_PASSWORD);
      await expect(page.locator(".stu-topbar__name")).toContainText(name);
      await reloadStudentApp(page);
      await expect(page.locator(".stu-topbar__name")).toContainText(name);
      await logoutStudentApp(page);
    }
    boundary.assertClean();
    browser.assertZeroDefects();
  } finally {
    try {
      await expectApi(request, "PATCH", settingsPath, adminAccess, { auto_approve: original.auto_approve });
    } finally {
      await adminContext.close();
    }
  }
}

async function waitForAccountReceipt(
  request: APIRequestContext,
  studentId: number,
  expected: Pick<AccountNotificationLog, "notification_type" | "target_id" | "target_name">,
): Promise<AccountNotificationLog> {
  let matched: AccountNotificationLog | undefined;
  await waitForCondition(async () => {
    const body = await expectApi<{ results: AccountNotificationLog[] }>(
      request,
      "GET",
      `/students/${studentId}/account-notifications/?limit=20`,
      adminAccess,
    );
    matched = body.results.find((row) => (
      row.notification_type === expected.notification_type
      && row.target_id === expected.target_id
      && row.target_name === expected.target_name
      && row.status === "sent"
      && row.success !== false
    ));
    return Boolean(matched);
  }, { timeoutMs: 120_000, intervalMs: 2_000, description: "mock-provider recovery receipt" });
  if (!matched) throw new Error("account recovery receipt was not persisted");
  return matched;
}

test.describe.serial("[real-use] 학생/학부모 계정과 복구", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  test.beforeAll(() => {
    assertQaStudentParentRuntime();
  });

  test.afterAll(async ({ request }) => {
    for (const requestId of signupRequestIds) {
      const row = await expectApi<{ status: string }>(request, "GET", `/students/registration_requests/${requestId}/`, adminAccess);
      if (row.status === "pending") {
        await expectApi(request, "POST", `/students/registration_requests/${requestId}/reject/`, adminAccess);
      }
    }
    // Registration history belongs to the exact disposable tenant; the owning
    // runner removes that tenant graph and verifies zero users/storage residue.
    for (const signupFamily of signupFamilies) await cleanupQaFamily(request, adminAccess, signupFamily);
    await cleanupQaFamily(request, adminAccess, family);
  });

  test("복구 요청은 mock receipt를 남기고 기존 학생/학부모 로그인은 유지된다", async ({ page, request }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    adminAccess = admin.access;
    family = await createQaFamily(request, admin.access, "account", 1);
    const student = family.students[0];

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`, { timeout: 30_000 });
    await page.getByRole("button", { name: "비밀번호 찾기" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "비밀번호 찾기" })).toBeVisible();
    await dialog.getByPlaceholder("학생 이름 *").fill(student.name);
    await dialog.getByLabel("학생 또는 학부모 휴대폰 번호 앞 4자리").fill(family.parentPhone.slice(3, 7));
    await dialog.getByLabel("학생 또는 학부모 휴대폰 번호 뒤 4자리").fill(family.parentPhone.slice(7));
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();
    await expect(dialog.getByRole("status")).toHaveText(
      "입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호 알림톡이 발송됩니다.",
      { timeout: 30_000 },
    );

    const receipt = await waitForAccountReceipt(request, student.id, {
      notification_type: "password_reset_student",
      target_id: `student:${student.id}`,
      target_name: student.name,
    });
    expect(receipt.recipient_summary).toContain(`${family.parentPhone.slice(0, 4)}****`);
    expect(receipt.recipient_summary).not.toContain(family.parentPhone);

    await loginApi(request, student.ps_number, student.password);
    await loginApi(request, family.parentPhone, family.parentPassword);
    const staffParentPassword = `Qp${String(Date.now()).slice(-8)}`;
    try {
      await expectApi(request, "POST", "/students/password_reset_send/", adminAccess, {
        target: "parent",
        student_name: student.name,
        parent_phone: family.parentPhone,
        temp_password: staffParentPassword,
      });
      await waitForAccountReceipt(request, student.id, {
        notification_type: "password_reset_parent",
        target_id: `parent:${student.id}`,
        target_name: student.name,
      });
      await loginApi(request, family.parentPhone, staffParentPassword);
    } finally {
      await expectApi(request, "POST", "/students/password_reset_send/", adminAccess, {
        target: "parent",
        student_name: student.name,
        parent_phone: family.parentPhone,
        temp_password: family.parentPassword,
      });
    }
    await loginApi(request, family.parentPhone, family.parentPassword);
    await loginThroughUi(page, student.ps_number, student.password);
    await gotoAndSettle(page, `${QA_BASE}/student/profile`, { timeout: 30_000 });
    await expect(page.getByText(student.name, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "편집", exact: true }).click();
    await expect(page.getByText("학부모 계정 연결을 바꾸려면 학원에 요청해 주세요.")).toBeVisible();
    await expect(page.getByLabel("학부모 전화번호 앞 4자리")).toHaveCount(0);
    // The profile editor offers the same cancel action at its header and footer.
    const cancelProfileEdit = page.getByRole("button", { name: "취소", exact: true });
    await expect(cancelProfileEdit).toHaveCount(2);
    await cancelProfileEdit.first().click();
    await expect(page.getByRole("button", { name: "편집", exact: true })).toBeVisible();
    await expect(cancelProfileEdit).toHaveCount(0);
    await reloadStudentApp(page);
    await expect(page.getByText(student.name, { exact: true }).first()).toBeVisible();

    await logoutStudentApp(page);
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await expect(page.locator(".stu-topbar__name")).toContainText(student.name);
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/student/profile`, { timeout: 30_000 });
    await expect(page.getByText(student.name, { exact: true }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await logoutStudentApp(page);
    await verifySignupAndApproval(page, request);
    await verifyOwnerOrganizationSettings(page, request, student);
    await verifyConsultInbox(page, request, admin);
    await verifyExcelSiblingImport(page, request, family);
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
