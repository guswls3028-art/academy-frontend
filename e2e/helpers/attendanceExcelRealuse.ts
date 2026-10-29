import ExcelJS from "exceljs";
import { expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { assertNoHorizontalOverflow, expectApi, QA_BASE } from "./qaStudentParentScenario";
import { gotoAndSettle } from "./wait";

type ExportStudent = { id: number; name: string; phone: string; parent_phone: string };
type ExportSession = { title: string; date: string | null };

/** Exercise only the caller's disposable lecture and restore labels before downstream roles. */
export async function verifyAttendanceExcel(
  page: Page, request: APIRequestContext, access: string, testInfo: TestInfo,
  lectureId: number, lectureTitle: string, sessionId: number, studentIds: [number, number],
): Promise<void> {
  const students = await Promise.all(studentIds.map(id =>
    expectApi<ExportStudent>(request, "GET", `/students/${id}/`, access)));
  const sessionPath = `/lectures/sessions/${sessionId}/`;
  const session = await expectApi<ExportSession>(request, "GET", sessionPath, access);
  const labels = ["=1+1", "#N/A"];
  const jobs = new Set<string>();
  const failures: unknown[] = [];
  try {
    for (const [index, student] of students.entries()) {
      const saved = await expectApi<ExportStudent>(request, "PATCH", `/students/${student.id}/`, access, { name: labels[index] });
      expect(saved.name).toBe(labels[index]);
      expect(student.phone).toMatch(/^0/);
      expect(student.parent_phone).toMatch(/^0/);
    }
    const savedSession = await expectApi<ExportSession>(request, "PATCH", sessionPath, access, { title: "=1+1" });
    expect(savedSession.title).toBe("=1+1");
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${lectureId}/students`);
      const exportButton = page.getByRole("button", { name: "출결 엑셀 다운로드", exact: true });
      await expect(exportButton).toBeVisible();
      const submitted = page.waitForResponse(response => response.request().method() === "POST"
        && new URL(response.url()).pathname === "/api/v1/lectures/attendance/excel/");
      const downloaded = page.waitForEvent("download", { timeout: 120_000 });
      const [response, download] = await Promise.all([submitted, downloaded, exportButton.click()]);
      expect(response.status()).toBe(202);
      expect(response.request().postDataJSON()).toEqual({ lecture_id: lectureId });
      const job = await response.json() as { job_id: string };
      expect(job.job_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(jobs.has(job.job_id)).toBe(false);
      jobs.add(job.job_id);
      expect(await download.failure()).toBeNull();
      expect(download.suggestedFilename()).toBe(`출결_${lectureTitle}_${lectureId}.xlsx`);
      const outputPath = testInfo.outputPath(`attendance-${width}.xlsx`);
      await download.saveAs(outputPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(outputPath);
      expect(workbook.worksheets).toHaveLength(1);
      const sheet = workbook.getWorksheet("출결")!;
      expect(sheet).toBeDefined();
      expect(sheet.rowCount).toBe(3);
      expect(sheet.columnCount).toBe(4);
      expect([1, 2, 3, 4].map(column => sheet.getCell(1, column).value)).toEqual([
        "학생명", "학생번호", "학부모번호", `=1+1${session.date ? ` (${session.date})` : ""}`,
      ]);
      expect(sheet.getCell("D1").type).toBe(ExcelJS.ValueType.String);
      for (const [index, student] of students.entries()) {
        const row = sheet.getRows(2, 2)!.find(item => item.getCell(1).value === labels[index]);
        expect(row).toBeDefined();
        expect([1, 2, 3, 4].map(column => row!.getCell(column).value))
          .toEqual([labels[index], student.phone, student.parent_phone, index === 0 ? "현장" : "결석"]);
        for (const column of [1, 2, 3, 4]) {
          expect(row!.getCell(column).type).toBe(ExcelJS.ValueType.String);
        }
      }
      await assertNoHorizontalOverflow(page);
      await testInfo.attach(`attendance-export-${width}`, {
        body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
      });
      await testInfo.attach(`attendance-workbook-${width}`, {
        path: outputPath, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
    expect(jobs.size).toBe(2);
  } catch (error) {
    failures.push(error);
  } finally {
    const restored = await Promise.allSettled([
      ...students.map(async student => {
        await expectApi(request, "PATCH", `/students/${student.id}/`, access, { name: student.name });
        const current = await expectApi<ExportStudent>(request, "GET", `/students/${student.id}/`, access);
        expect(current).toMatchObject({ name: student.name, phone: student.phone, parent_phone: student.parent_phone });
      }),
      (async () => {
        await expectApi(request, "PATCH", sessionPath, access, { title: session.title });
        expect(await expectApi<ExportSession>(request, "GET", sessionPath, access))
          .toMatchObject({ title: session.title, date: session.date });
      })(),
    ]);
    failures.push(...restored.filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map(result => result.reason));

  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Attendance export verification and restoration failed");
}
