/**
 * Public recovery request plus unchanged-password login verification for an
 * isolated qa-* student and parent account graph.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext } from "@playwright/test";
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
  QA_TENANT,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForCondition, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(300_000);
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

async function waitForRecoveryReceipt(
  request: APIRequestContext,
  studentId: number,
  studentName: string,
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
      row.notification_type === "password_reset_student"
      && row.target_id === `student:${studentId}`
      && row.target_name === studentName
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

    const receipt = await waitForRecoveryReceipt(request, student.id, student.name);
    expect(receipt.recipient_summary).toContain(`${family.parentPhone.slice(0, 4)}****`);
    expect(receipt.recipient_summary).not.toContain(family.parentPhone);

    await loginApi(request, student.ps_number, student.password);
    await loginApi(request, family.parentPhone, family.parentPassword);
    await loginThroughUi(page, student.ps_number, student.password);
    await expect(page.locator(".stu-topbar__name")).toContainText(student.name);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.locator(".stu-topbar__name")).toContainText(student.name);

    await logoutStudentApp(page);
    await loginThroughUi(page, family.parentPhone, family.parentPassword);
    await expect(page.locator(".stu-topbar__name")).toContainText(student.name);
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/student/profile`, { timeout: 30_000 });
    await expect(page.getByText(student.name, { exact: true }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
