/** Past-due generation through the real admin UI in the isolated qa-* runtime. */
import { expect, test } from "../fixtures/strictTest";
import {
  api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, cleanupQaFamily,
  createQaFamily, installQaStudentParentBoundary, loginAdmin,
  QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_TENANT,
  STUDENT_PARENT_REALUSE_ENABLED, type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle } from "../helpers/wait";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type Invoice = { id: number; student: number; status: string; due_date: string; paid_amount: number; total_amount: number };
type List<T> = T[] | { count: number; results: T[] };
const rows = <T,>(value: List<T>): T[] => Array.isArray(value) ? value : value.results;
let family: QaFamily | null = null;
let access = "";
let templateId: number | null = null;
let studentFeeId: number | null = null;
let invoiceId: number | null = null;

test.describe.serial("[real-use] 납기 경과 청구 즉시 연체", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the isolated qa-* development runner.");
  test.beforeAll(() => assertQaStudentParentRuntime());
  test.afterAll(async ({ request }) => {
    if (!access) return;
    await cleanupQaFamily(request, access, family);
    for (const [kind, id] of [["invoices", invoiceId], ["student-fees", studentFeeId]] as const) {
      if (id != null) expect((await api(request, "GET", `/fees/${kind}/${id}/`, access)).status).toBe(404);
    }
    if (templateId != null) {
      expect((await api(request, "DELETE", `/fees/templates/${templateId}/`, access)).status).toBe(204);
      const inactive = await api<{ is_active: boolean }>(request, "GET", `/fees/templates/${templateId}/`, access);
      expect(inactive.status).toBe(200);
      expect(inactive.body.is_active).toBe(false);
      // Templates are audit-preserving soft deletes. The runner then destroys
      // this exact disposable tenant and verifies tenant/user cleanup zero.
    }
  });

  test("기한 지난 청구 생성은 연체 목록·대시보드와 desktop/390px reload에 즉시 반영된다", async ({ page, request }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    access = (await loginAdmin(request)).access;
    family = await createQaFamily(request, access, "fees-overdue", 1);
    const student = family.students[0];
    const before = await api<List<{ id: number }>>(request, "GET", "/fees/student-fees/", access);
    expect(before.status).toBe(200);
    expect(rows(before.body)).toHaveLength(0);
    const templateName = `QA overdue ${student.id}`;
    const template = await api(request, "POST", "/fees/templates/", access, {
      name: templateName, fee_type: "TUITION", billing_cycle: "MONTHLY",
      amount: 120000, is_active: true, auto_assign: false,
    });
    expect(template.status).toBe(201);
    const templates = await api<List<{ id: number; name: string }>>(request, "GET", "/fees/templates/", access);
    expect(templates.status).toBe(200);
    const ownedTemplates = rows(templates.body).filter((item) => item.name === templateName);
    expect(ownedTemplates).toHaveLength(1);
    templateId = ownedTemplates[0].id;
    const assigned = await api<{ id: number }>(request, "POST", "/fees/student-fees/", access, {
      student: student.id, fee_template: templateId,
    });
    expect(assigned.status).toBe(201);
    studentFeeId = assigned.body.id;
    const assignmentPath = `/fees/student-fees/${studentFeeId}/`;
    const endMonth = `${new Date().getUTCFullYear() + 1}-12`;
    // Independent partial edits must both survive before invoice generation.
    const edits = await Promise.all([
      api(request, "PATCH", assignmentPath, access, { discount_amount: 20000 }),
      api(request, "PATCH", assignmentPath, access, { billing_end_month: endMonth }),
    ]);
    for (const edited of edits) expect(edited.status).toBe(200);
    const reloadedAssignment = await api(request, "GET", assignmentPath, access);
    expect(reloadedAssignment.status).toBe(200);
    expect(reloadedAssignment.body).toMatchObject({ discount_amount: 20000, billing_end_month: endMonth, effective_amount: 100000 });

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`, { timeout: 45_000 });
    await page.getByTestId("login-username").fill(QA_ADMIN_USER);
    await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(page);
    await gotoAndSettle(page, `${QA_BASE}/workspace/fees/invoices`);
    await page.getByRole("button", { name: "월 청구서 생성", exact: true }).click();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await page.locator('input[type="date"]').fill(yesterday);
    const generatedPromise = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/fees/invoices/generate/"));
    await page.getByRole("button", { name: "생성", exact: true }).click();
    const generated = await generatedPromise;
    expect(generated.ok()).toBe(true);
    expect(await generated.json()).toMatchObject({ created: 1, skipped: 0, errors: [] });
    const period = generated.request().postDataJSON() as { billing_year: number; billing_month: number };
    const invoices = await api<List<Invoice>>(request, "GET", `/fees/invoices/?student=${student.id}`, access);
    expect(invoices.status).toBe(200);
    expect(rows(invoices.body)).toHaveLength(1);
    const invoice = rows(invoices.body)[0];
    invoiceId = invoice.id;
    expect(invoice).toMatchObject({ student: student.id, status: "OVERDUE", due_date: yesterday, paid_amount: 0, total_amount: 100000 });
    const invoiceRow = page.getByRole("row").filter({ hasText: student.name });
    await expect(invoiceRow).toHaveAttribute("data-status", "OVERDUE");
    await expect(invoiceRow.getByText("연체", { exact: true })).toBeVisible();

    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(invoiceRow).toHaveAttribute("data-status", "OVERDUE");
      await assertNoHorizontalOverflow(page);
    }
    await gotoAndSettle(page, `${QA_BASE}/workspace/fees`);
    await expect(page.getByRole("row").filter({ hasText: student.name }).getByText("연체", { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    const dashboard = await api<{ overdue_count: number; total_outstanding: number }>(request, "GET",
      `/fees/dashboard/?year=${period.billing_year}&month=${period.billing_month}`, access);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body).toMatchObject({ overdue_count: 1, total_outstanding: 100000 });
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
