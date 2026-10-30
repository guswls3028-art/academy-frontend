import ExcelJS from "exceljs";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { assertNoHorizontalOverflow, expectApi, installQaStudentParentBoundary, QA_BASE, seedBrowserAuth, type QaTokens } from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle } from "../helpers/wait";

type Preview = {
  ok: boolean; applied: boolean; exam_id: number; matched_count: number; errors: unknown[];
  rows: Array<{ enrollment_id: number; student_name: string; total_score: number; wrong_questions: number[] }>;
};
type AdminResult = { enrollment_id: number; student_name: string; final_score: number | null };

async function downloadWorkbook(page: Page, label: string, testInfo: TestInfo, name: string): Promise<ExcelJS.Workbook> {
  const downloading = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: label, exact: true }).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const path = testInfo.outputPath(`${name}.xlsx`);
  await download.saveAs(path);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  await testInfo.attach(name, { path, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return workbook;
}

/** Uses the assessment case's family/session; its afterAll owns the new exam id immediately. */
export async function verifyExcelAssessment(
  parentPage: Page, request: APIRequestContext, admin: QaTokens, student: QaTokens,
  scope: { lectureId: number; sessionId: number; enrollmentId: number; studentName: string },
  registerExam: (id: number) => void, testInfo: TestInfo,
): Promise<void> {
  const title = `QA Excel assessment ${Date.now()}`;
  const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
    title, exam_type: "regular", session_id: scope.sessionId, grading_mode: "choice",
    max_score: 100, pass_score: 50, answer_visibility: "hidden", open_at: new Date().toISOString(),
  });
  registerExam(exam.id);
  expect(Number.isSafeInteger(exam.id) && exam.id > 0).toBe(true);
  const questions = await expectApi<Array<{ id: number; number: number }>>(request, "POST", `/exams/${exam.id}/questions/init/`, admin.access, {
    total_questions: 5, default_score: 20,
  });
  expect(questions).toHaveLength(5);
  await expectApi(request, "POST", "/exams/answer-keys/", admin.access, {
    exam: exam.id, answers: Object.fromEntries(questions.map(question => [String(question.id), "1"])),
  });
  await expectApi(request, "PUT", `/exams/${exam.id}/enrollments/?session_id=${scope.sessionId}`, admin.access, {
    enrollment_ids: [scope.enrollmentId],
  });
  const resultsPath = `/results/admin/exams/${exam.id}/results/`;
  const readResults = async () => {
    const response = await expectApi<AdminResult[] | { results: AdminResult[] }>(request, "GET", resultsPath, admin.access);
    const rows = Array.isArray(response) ? response : response.results;
    expect(Array.isArray(rows)).toBe(true);
    return rows.map(row => ({ enrollment_id: row.enrollment_id, student_name: row.student_name, final_score: row.final_score }));
  };
  const before = await readResults();
  const context = await parentPage.context().browser()!.newContext({ serviceWorkers: "block", viewport: { width: 1366, height: 900 } });
  try {
    const page = await context.newPage();
    const boundary = await installQaStudentParentBoundary(page, request);
    const guards = attachStrictBrowserGuards(page);
    await seedBrowserAuth(page, admin);
    await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${scope.lectureId}/sessions/${scope.sessionId}/exams?examId=${exam.id}&examTab=results`);
    const importer = page.getByRole("region", { name: "엑셀로 채점 결과 넣기", exact: true });
    await expect(importer).toBeVisible();
    const template = await downloadWorkbook(page, "전용 양식 받기", testInfo, "real-exam-excel-template");
    const sheet = template.worksheets.find(item => item.getCell(8, 1).value === "수강등록ID");
    expect(sheet).toBeDefined();
    const data = sheet!.getRows(9, sheet!.rowCount - 8)!.filter(row => typeof row.getCell(1).value === "number");
    expect(data.map(row => row.getCell(1).value)).toEqual([scope.enrollmentId]);
    expect(data[0].getCell(3).value).toBe(scope.studentName);
    data[0].getCell(7).value = "";
    for (const number of [1, 2, 3, 4, 5]) {
      expect(sheet!.getCell(8, 7 + number).value).toBe(number);
      data[0].getCell(7 + number).value = number === 5 ? "X" : "O";
    }
    const importPath = `/api/v1/results/admin/exams/${exam.id}/result-import/`;
    const previewResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === importPath);
    await importer.locator('input[type="file"]').setInputFiles({
      name: "qa-exam-result.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await template.xlsx.writeBuffer()),
    });
    const previewResponseBody = await previewResponse;
    expect(previewResponseBody.status()).toBe(200);
    const preview = await previewResponseBody.json() as Preview;
    expect(preview).toMatchObject({ ok: true, applied: false, exam_id: exam.id, matched_count: 1, errors: [] });
    expect(preview.rows).toMatchObject([{ enrollment_id: scope.enrollmentId, student_name: scope.studentName, total_score: 80, wrong_questions: [5] }]);
    await expect(importer.getByText("1명 · 5문항을 확인했습니다", { exact: true })).toBeVisible();
    expect(await readResults()).toEqual(before);
    await testInfo.attach("real-exam-excel-preview", {
      body: await importer.screenshot({ path: testInfo.outputPath("real-exam-excel-preview.png"), animations: "disabled" }), contentType: "image/png",
    });
    const appliedResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === importPath);
    await importer.getByRole("button", { name: "1명 결과 반영", exact: true }).click();
    const applied = await appliedResponse;
    expect(applied.status()).toBe(200);
    expect(await applied.json()).toMatchObject({ ok: true, applied: true, exam_id: exam.id, matched_count: 1, errors: [], rows: preview.rows });
    await expect(importer.getByText("채점 결과를 반영했습니다", { exact: true })).toBeVisible();
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(importer).toBeVisible();
      await expect(importer.getByRole("button", { name: "1명 결과 반영", exact: true })).toHaveCount(0);
      expect(await readResults()).toEqual([{ enrollment_id: scope.enrollmentId, student_name: scope.studentName, final_score: 80 }]);
      const resultRow = page.getByRole(width === 390 ? "button" : "row")
        .filter({ has: page.getByText(scope.studentName, { exact: true }) });
      await expect(resultRow).toContainText("80");
      await assertNoHorizontalOverflow(page);
      await testInfo.attach(`real-exam-excel-persisted-${width}`, {
        body: await page.screenshot({ path: testInfo.outputPath(`real-exam-excel-persisted-${width}.png`), fullPage: true, animations: "disabled" }), contentType: "image/png",
      });
    }
    const wrongNotes = await downloadWorkbook(page, "학생별 틀린 문항 (엑셀)", testInfo, "real-exam-wrong-notes");
    const wrongSheet = wrongNotes.getWorksheet("학생별 오답")!;
    expect(wrongSheet).toBeDefined();
    const wrongRows: ExcelJS.Row[] = [];
    wrongSheet.eachRow(row => { if (row.getCell(1).value === scope.enrollmentId) wrongRows.push(row); });
    expect(wrongRows).toHaveLength(1);
    expect([3, 6, 7, 8, 9].map(column => wrongRows[0].getCell(column).value)).toEqual([scope.studentName, 80, 100, 1, "5"]);
    const analysis = await downloadWorkbook(page, "수업 분석 리포트 (엑셀)", testInfo, "real-exam-analysis");
    const ranked = analysis.getWorksheet("학생별 등수")!;
    expect(ranked).toBeDefined();
    const rankedRows: ExcelJS.Row[] = [];
    ranked.eachRow(row => { if (row.getCell(3).value === scope.studentName) rankedRows.push(row); });
    expect(rankedRows).toHaveLength(1);
    expect([5, 6, 11, 12].map(column => rankedRows[0].getCell(column).value)).toEqual([80, 100, "완료", "5"]);
    boundary.assertClean();
    guards.assertZeroDefects();
  } finally { await context.close(); }

  const studentContext = await parentPage.context().browser()!.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await studentContext.newPage();
    const boundary = await installQaStudentParentBoundary(page, request);
    const guards = attachStrictBrowserGuards(page);
    await seedBrowserAuth(page, student);
    await gotoAndSettle(page, `${QA_BASE}/student/exams/${exam.id}/result`);
    await expect(page.getByTestId("wrong-number-chip")).toHaveText(["5번"]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("wrong-number-chip")).toHaveText(["5번"]);
    expect(await expectApi(request, "GET", `/student/results/me/exams/${exam.id}/`, student.access)).toMatchObject({
      total_score: 80, analysis: { wrong_count: 1, wrong_question_numbers: [5] },
    });
    await assertNoHorizontalOverflow(page);
    await testInfo.attach("real-exam-excel-student-reloaded-390", {
      body: await page.screenshot({ path: testInfo.outputPath("real-exam-excel-student-reloaded-390.png"), animations: "disabled", fullPage: true }), contentType: "image/png",
    });
    boundary.assertClean();
    guards.assertZeroDefects();
  } finally { await studentContext.close(); }
}
