/**
 * Public recovery request plus unchanged-password login verification for an
 * isolated qa-* student and parent account graph.
 */
import { expect, test } from "../fixtures/strictTest";
import { createHash } from "node:crypto";
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
} from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

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
      const submitted = page.waitForResponse((response) => (
        response.request().method() === "POST" && response.url().endsWith("/students/registration_requests/")
      ));
      await dialog.getByRole("button", { name: "가입 신청", exact: true }).click();
      const response = await submitted;
      expect(response.status()).toBe(autoApprove ? 200 : 201);
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
        const approved = adminPage.waitForResponse((result) => (
          result.request().method() === "POST" && result.url().endsWith(`/registration_requests/${requestId}/approve/`)
        ));
        await adminPage.getByRole("alertdialog", { name: "승인 확인" }).getByRole("button", { name: "승인", exact: true }).click();
        const approvalResponse = await approved;
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
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
