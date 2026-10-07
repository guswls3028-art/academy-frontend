/** Disposable staff accounts and payroll facts in the isolated development tenant. */
import { test, expect } from "../fixtures/strictTest";
import {
  api, assertNoHorizontalOverflow, assertQaStudentParentRuntime,
  installQaStudentParentBoundary, loginAdmin, loginApi,
  QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_STUDENT_PASSWORD, QA_TENANT,
  STUDENT_PARENT_REALUSE_ENABLED,
} from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { gotoAndSettle } from "../helpers/wait";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type Staff = { id: number; name: string; is_active: boolean };
type RecordRow = { id: number; end_date: string; end_time: string; amount: number; resolved_hourly_wage: number };
type OverviewRow = { staff_id: number; work_amount: number; reference_deduction_total: number;
  reference_net_work_amount: number; approved_expense_amount: number; reference_transfer_amount: number;
  settlement_status: string; is_active: boolean };

test.describe("[real-use] 직원 계정·근태·급여", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the isolated qa-* development runner.");
  test.beforeAll(() => assertQaStudentParentRuntime());

  test("계정 생성·본인 출퇴근·일괄 시급·날짜 정정·공제 전후·월마감·퇴사 이력을 검증한다", async ({ page, request }, testInfo) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const admin = (await loginAdmin(request)).access;
    const suffix = Date.now().toString(36);
    const firstName = `QA 급여 갑 ${suffix}`;
    const secondName = `QA 급여 을 ${suffix}`;
    const username = `staff-payroll-${suffix}`;
    const first = await api<Staff>(request, "POST", "/staffs/", admin, {
      name: firstName, phone: "", role: "ASSISTANT", position: "ASSISTANT", pay_type: "HOURLY",
      username, password: QA_STUDENT_PASSWORD,
    });
    expect(first.status).toBe(201);
    const second = await api<Staff>(request, "POST", "/staffs/", admin, {
      name: secondName, phone: "", role: "ASSISTANT", position: "ASSISTANT", pay_type: "HOURLY",
    });
    expect(second.status).toBe(201);
    const workTypeName = `QA 시급 ${suffix}`;
    const workType = await api<{ id: number }>(request, "POST", "/staffs/work-types/", admin, {
      name: workTypeName, base_hourly_wage: 12345, is_active: true, color: "#2563eb",
    });
    expect(workType.status).toBe(201);

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`, { timeout: 45_000 });
    await page.getByTestId("login-username").fill(QA_ADMIN_USER);
    await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(page);
    await gotoAndSettle(page, `${QA_BASE}/workspace/staff/home`);
    await page.getByRole("checkbox", { name: `${firstName} 선택`, exact: true }).check();
    await page.getByRole("checkbox", { name: `${secondName} 선택`, exact: true }).check();
    await page.getByPlaceholder("이름 / 전화번호 검색").fill(secondName);
    await page.getByRole("button", { name: "시급 태그 추가", exact: true }).click();
    const assignment = page.getByRole("dialog", { name: "시급 태그 추가" });
    await expect(assignment).toContainText(firstName);
    await expect(assignment).toContainText(secondName);
    await assignment.getByRole("button", { name: `${workTypeName} (12,345원/시간)`, exact: true }).click();
    await assignment.getByRole("button", { name: "2명에게 추가", exact: true }).click();
    await expect(assignment).toBeHidden();

    const staffToken = (await loginApi(request, username, QA_STUDENT_PASSWORD)).access;
    expect((await api(request, "GET", "/staffs/payroll-overview/?year=2026&month=8", staffToken)).status).toBe(403);
    const started = await api<RecordRow>(request, "POST", `/staffs/${first.body.id}/work-records/start-work/`, staffToken, {
      work_type: workType.body.id,
    });
    expect([200, 201]).toContain(started.status);
    const current = await api<{ status: string; work_record_id: number }>(request, "GET", `/staffs/${first.body.id}/work-records/current/`, staffToken);
    expect(current.status).toBe(200);
    expect(current.body.status).toBe("WORKING");
    expect(current.body.work_record_id).toBe(started.body.id);
    const ended = await api<RecordRow>(request, "POST", `/staffs/work-records/${started.body.id}/end_work/`, staffToken, {});
    expect(ended.status).toBe(200);
    expect(ended.body.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ended.body.resolved_hourly_wage).toBe(12345);
    // Remove only this exact synthetic clock record before deterministic monthly arithmetic.
    expect((await api(request, "DELETE", `/staffs/work-records/${started.body.id}/`, admin)).status).toBe(204);

    const record = await api<RecordRow>(request, "POST", "/staffs/work-records/", admin, {
      staff: first.body.id, work_type: workType.body.id,
      date: "2026-08-20", start_time: "09:00", end_time: "10:00", break_minutes: 0,
    });
    expect(record.status).toBe(201);
    expect(record.body.amount).toBe(12345);
    await gotoAndSettle(page, `${QA_BASE}/workspace/staff/attendance?staffId=${first.body.id}&year=2026&month=8`);
    const recordRow = page.getByTestId(`staff-work-record-${record.body.id}`);
    await recordRow.getByRole("button", { name: "수정", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "근무 기록 수정" });
    await edit.locator("#work-record-end-date").click();
    await page.getByRole("dialog", { name: "날짜 선택" }).getByRole("button", { name: "21", exact: true }).click();
    await edit.getByRole("button", { name: "저장", exact: true }).click();
    await expect(edit).toBeHidden();
    await expect(recordRow).toContainText("2026-08-21 퇴근");
    await expect(recordRow).toContainText("308,625");
    await page.reload();
    await expect(recordRow).toContainText("2026-08-21 퇴근");

    const expense = await api<{ id: number; status: string }>(request, "POST", "/staffs/expense-records/", admin, {
      staff: first.body.id, date: "2026-08-20", title: "QA 개인 선결제 환급", amount: 2500,
    });
    expect(expense.status).toBe(201);
    expect(expense.body.status).toBe("PENDING");
    expect((await api(request, "PATCH", `/staffs/expense-records/${expense.body.id}/`, admin, { status: "APPROVED" })).status).toBe(200);
    const overview = await api<{ rows: OverviewRow[] }>(request, "GET", "/staffs/payroll-overview/?year=2026&month=8", admin);
    expect(overview.status).toBe(200);
    expect(overview.body.rows.find((row) => row.staff_id === first.body.id)).toMatchObject({
      work_amount: 308625, reference_deduction_total: 10185, reference_net_work_amount: 298440,
      approved_expense_amount: 2500, reference_transfer_amount: 300940,
    });
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/staff/attendance?year=2026&month=8`);
      const payroll = page.getByTestId("staff-payroll-overview");
      await payroll.getByRole("searchbox", { name: "직원 이름 검색" }).fill(firstName);
      const staffRow = width === 390
        ? payroll.getByTestId("payroll-mobile-row").filter({ hasText: firstName })
        : payroll.getByRole("row").filter({ hasText: firstName });
      for (const value of ["308,625원", "10,185원", "298,440원", "2,500원", "300,940원"]) {
        await expect(staffRow).toContainText(value);
      }
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`staff-payroll-${width}.png`) });
    }
    await gotoAndSettle(page, `${QA_BASE}/workspace/staff/attendance?staffId=${first.body.id}&year=2026&month=8`);
    await page.getByRole("tab", { name: "월 마감 탭", exact: true }).click();
    await page.getByRole("button", { name: "월 마감", exact: true }).click();
    const closeResponse = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/staffs/work-month-locks/"));
    await page.getByRole("alertdialog", { name: "2026년 8월 마감" }).getByRole("button", { name: "월 마감", exact: true }).click();
    expect((await closeResponse).ok()).toBe(true);
    await page.reload();
    const closed = await api<{ rows: OverviewRow[] }>(request, "GET", "/staffs/payroll-overview/?year=2026&month=8", admin);
    expect(closed.body.rows.find((row) => row.staff_id === first.body.id)).toMatchObject({ settlement_status: "CLOSED", work_amount: 308625 });
    expect((await api(request, "PATCH", `/staffs/work-records/${record.body.id}/`, admin, { end_date: "2026-08-20" })).status).toBe(400);
    expect((await api(request, "PATCH", `/staffs/${first.body.id}/`, admin, { is_active: false })).status).toBe(200);
    const retired = await api<{ rows: OverviewRow[] }>(request, "GET", "/staffs/payroll-overview/?year=2026&month=8", admin);
    expect(retired.body.rows.find((row) => row.staff_id === first.body.id)).toMatchObject({
      is_active: false, settlement_status: "CLOSED", reference_transfer_amount: 300940,
    });
    expect([401, 403]).toContain((await api(request, "GET", "/staffs/me/", staffToken)).status);
    // Financial/audit history remains immutable. The existing SSM scenario teardown
    // deletes this exact disposable tenant's bounded payroll graph and verifies user/tenant zero.
    boundary.assertClean();
  });
});
