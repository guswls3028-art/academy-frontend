import ExcelJS from "exceljs";
import type { APIRequestContext, Locator, Page, TestInfo } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { api, assertNoHorizontalOverflow, expectApi, QA_BASE, type QaFamily } from "../helpers/qaStudentParentScenario";
import { gotoAndSettle } from "../helpers/wait";

/** Owned by the learning case; kept separate from its manual-picker/video graph. */
export type ExcelEnrollmentState = { lectureId?: number; sessionIds: number[] };
type Enrollment = { id: number; lecture: number; student: { id: number }; status: string };
type SessionEnrollment = { id: number; session: number; enrollment: number; student_id: number };
type Ledger = {
  enrolled_count: number; created_students_count: number; total: number; excluded_count: number;
  not_found_students_count: number; ambiguous_students_count: number; session_id: number;
  enrolled_rows: Array<{ row: number; name: string; student_id: number }>;
  excluded_rows: Array<{ row: number; name: string; reason_code: string; error: string }>;
};

async function list<T>(request: APIRequestContext, token: string, path: string): Promise<T[]> {
  const value = await expectApi<T[] | { count: number; next: string | null; results: T[] }>(
    request, "GET", `${path}&page_size=100`, token,
  );
  if (Array.isArray(value)) return value;
  expect(value.next).toBeFalsy();
  expect(value.results).toHaveLength(value.count);
  return value.results;
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await assertNoHorizontalOverflow(page);
  await testInfo.attach(name, {
    body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled", fullPage: true }),
    contentType: "image/png",
  });
}

async function expectLedger(dialog: Locator, ledger: Ledger): Promise<void> {
  await expect(dialog.getByText(`전체 ${ledger.total}명`, { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("등록 결과 요약")).toContainText(new RegExp(`수강 등록\\s*${ledger.enrolled_count}명`));
  await expect(dialog.getByLabel("등록 결과 요약")).toContainText(new RegExp(`확인 필요\\s*${ledger.excluded_count}명`));
  const successful = dialog.getByRole("region", { name: "등록 완료", exact: true });
  const excluded = dialog.getByRole("region", { name: "확인 필요", exact: true });
  for (const row of ledger.enrolled_rows) {
    const item = successful.getByRole("listitem").filter({ hasText: row.name });
    await expect(item).toContainText(`${row.row}행`);
  }
  for (const row of ledger.excluded_rows) {
    const item = excluded.getByRole("listitem").filter({ hasText: `${row.row}행` });
    await expect(item).toContainText(row.name);
    await expect(item).toContainText(row.error);
  }
}

export async function verifyExcelEnrollment(
  page: Page, request: APIRequestContext, token: string, family: QaFamily,
  state: ExcelEnrollmentState, testInfo: TestInfo,
): Promise<void> {
  const title = `QA Excel enrollment ${Date.now()}`;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", token, {
    title, name: "QA엑셀", subject: "수학", is_active: true, start_date: date,
  });
  state.lectureId = lecture.id;
  expect(Number.isSafeInteger(lecture.id) && lecture.id > 0).toBe(true);
  for (const order of [1, 2]) {
    const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", token, {
      lecture: lecture.id, title: `QA Excel ${order}차시`, order, date,
    });
    state.sessionIds.push(session.id);
    expect(Number.isSafeInteger(session.id) && session.id > 0).toBe(true);
  }
  const studentCount = async () => (await expectApi<{ count: number }>(request, "GET", "/students/?page_size=1", token)).count;
  const beforeStudentCount = await studentCount();
  expect(Number.isSafeInteger(beforeStudentCount)).toBe(true);
  const enrollments = () => list<Enrollment>(request, token, `/enrollments/?lecture=${lecture.id}`);
  const sessionRows = (id: number) => list<SessionEnrollment>(request, token, `/enrollments/session-enrollments/?session=${id}`);
  expect(await enrollments()).toEqual([]);
  const [first, second] = family.students;
  const missing = `QA Excel absent ${lecture.id}`;
  let firstEnrollmentId: number | undefined;
  let secondEnrollmentId: number | undefined;
  let retainedSessionRowId: number | undefined;
  const submittedJobs = new Set<string>();

  // The last request corrects only the failed existing student in the second session.
  for (const mode of ["lecture", "session", "corrected"] as const) {
    const isLecture = mode === "lecture";
    const corrected = mode === "corrected";
    const targetSession = state.sessionIds[isLecture ? 0 : 1];
    const matched = isLecture || corrected ? first : second;
    const invalid = isLecture ? second : first;
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("학생목록").addRows([
      ["이름", "학부모 전화번호"],
      [matched.name, family.parentPhone],
      ...(!corrected ? [[invalid.name, "0101234567"], [missing, family.parentPhone], [matched.name, family.parentPhone]] : []),
    ]);
    await page.setViewportSize({ width: isLecture ? 1366 : 390, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${lecture.id}${isLecture ? "" : `/sessions/${targetSession}/attendance`}`);
    await page.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
    if (isLecture) await page.getByRole("button", { name: "엑셀로 일괄 등록", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(isLecture ? "수강생 엑셀 업로드" : "차시 수강생 등록", { exact: true })).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: `qa-excel-${mode}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });
    if (!corrected) await expect(dialog.getByText(isLecture ? "입력 확인 필요 1명" : "정상 3명 · 입력 확인 1명", { exact: true })).toBeVisible();
    const accepted = page.waitForResponse(response => response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/v1/enrollments/lecture_enroll_from_excel/");
    if (isLecture) await dialog.getByRole("button", { name: "맞아요, 등록하기" }).click();
    else {
      await dialog.getByRole("button", { name: "엑셀로 일괄 등록", exact: true }).click();
      await page.getByRole("alertdialog", { name: "엑셀 수강등록 최종 확인" })
        .getByRole("button", { name: `${corrected ? 1 : 3}명 등록 요청`, exact: true }).click();
    }
    const response = await accepted;
    expect(response.status()).toBe(202);
    const body = response.request().postData()!;
    expect(body).toContain(`name="lecture_id"\r\n\r\n${lecture.id}`);
    if (isLecture) expect(body).not.toContain('name="session_id"');
    else expect(body).toContain(`name="session_id"\r\n\r\n${targetSession}`);
    const { job_id: jobId } = await response.json() as { job_id: string };
    expect(jobId).toBeTruthy();
    expect(submittedJobs.has(jobId)).toBe(false);
    submittedJobs.add(jobId);
    let ledger: Ledger | undefined;
    await expect.poll(async () => {
      const job = await expectApi<{ status: string; result?: Ledger }>(request, "GET", `/enrollments/excel_job_status/${jobId}/`, token);
      expect(["FAILED", "ERROR"]).not.toContain(job.status);
      ledger = job.result;
      return job.status;
    }, { timeout: 90_000, message: `real ${mode} Excel worker completes` }).toBe("DONE");
    expect(ledger).toMatchObject({
      enrolled_count: 1, created_students_count: 0, session_id: targetSession,
      total: corrected ? 1 : 4, excluded_count: corrected ? 0 : 3,
      not_found_students_count: corrected ? 0 : 1, ambiguous_students_count: 0,
      enrolled_rows: [{ row: 2, name: matched.name, student_id: matched.id }],
    });
    expect(ledger!.excluded_rows.map(row => [row.row, row.name, row.reason_code])).toEqual(corrected ? [] : [
      [3, invalid.name, "invalid_row"], [4, missing, "not_found"], [5, matched.name, "duplicate_in_file"],
    ]);
    const result = page.getByRole("dialog", { name: "수강 등록 결과" });
    await expect(result).toBeVisible({ timeout: 30_000 });
    await expectLedger(result, ledger!);
    await capture(page, testInfo, `real-excel-${mode}-result-${isLecture ? 1366 : 390}`);
    await page.setViewportSize({ width: isLecture ? 390 : 1366, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(result).toBeVisible();
    await expectLedger(result, ledger!);
    await capture(page, testInfo, `real-excel-${mode}-restored-${isLecture ? 390 : 1366}`);
    const rows = await enrollments();
    expect(rows.every(row => row.lecture === lecture.id && row.status === "ACTIVE")).toBe(true);
    expect(rows.map(row => row.student.id).sort((a, b) => a - b))
      .toEqual((isLecture ? [first.id] : [first.id, second.id]).sort((a, b) => a - b));
    if (isLecture) firstEnrollmentId = rows[0].id;
    expect(rows.find(row => row.student.id === first.id)?.id).toBe(firstEnrollmentId);
    if (mode === "session") secondEnrollmentId = rows.find(row => row.student.id === second.id)!.id;
    if (!isLecture) expect(rows.find(row => row.student.id === second.id)?.id).toBe(secondEnrollmentId);
    const memberships = await sessionRows(targetSession);
    expect(memberships.every(row => row.session === targetSession)).toBe(true);
    expect(memberships.map(row => row.student_id).sort((a, b) => a - b))
      .toEqual((corrected ? [first.id, second.id] : [matched.id]).sort((a, b) => a - b));
    if (mode === "session") retainedSessionRowId = memberships[0].id;
    if (corrected) expect(memberships.find(row => row.student_id === second.id)?.id).toBe(retainedSessionRowId);
    // Explicit session uploads must not add the sibling to the default first session.
    expect((await sessionRows(state.sessionIds[0])).map(row => row.student_id)).toEqual([first.id]);
    expect(await studentCount()).toBe(beforeStudentCount);
    await result.getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByText(matched.name, { exact: true }).first()).toBeVisible();
  }
  expect(submittedJobs.size).toBe(3);
}

export async function cleanupExcelEnrollment(request: APIRequestContext, token: string, state: ExcelEnrollmentState): Promise<void> {
  if (!state.lectureId) return;
  // Scope every read/delete to ids created by this case; outer canary cleanup still proves tenant/user zero.
  for (const session of state.sessionIds) {
    const attendance = await list<{ id: number; session: number }>(request, token, `/lectures/attendance/?session=${session}`);
    const memberships = await list<SessionEnrollment>(request, token, `/enrollments/session-enrollments/?session=${session}`);
    for (const row of attendance) {
      expect(row.session).toBe(session);
      await expectApi(request, "DELETE", `/lectures/attendance/${row.id}/`, token, undefined, [204, 404]);
    }
    for (const row of memberships) {
      expect(row.session).toBe(session);
      await expectApi(request, "DELETE", `/enrollments/session-enrollments/${row.id}/`, token, undefined, [204, 404]);
    }
  }
  for (const row of await list<Enrollment>(request, token, `/enrollments/?lecture=${state.lectureId}`)) {
    expect(row.lecture).toBe(state.lectureId);
    await expectApi(request, "DELETE", `/enrollments/${row.id}/`, token, undefined, [204, 404]);
  }
  for (const session of state.sessionIds) {
    await expectApi(request, "DELETE", `/lectures/sessions/${session}/`, token, undefined, [204, 404]);
    expect((await api(request, "GET", `/lectures/sessions/${session}/`, token)).status).toBe(404);
  }
  await expectApi(request, "DELETE", `/lectures/lectures/${state.lectureId}/`, token, undefined, [204, 404]);
  expect((await api(request, "GET", `/lectures/lectures/${state.lectureId}/`, token)).status).toBe(404);
  state.lectureId = undefined;
  state.sessionIds = [];
}
