import ExcelJS from "exceljs";
import { expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { assertNoHorizontalOverflow, expectApi, QA_BASE } from "./qaStudentParentScenario";
import { gotoAndSettle } from "./wait";
import { safeNativeTransportKind } from "./releaseApiBoundary";

const LEARNING_FLOW_PHASES = [
  "teacher-thumbnail", "teacher-classes-open", "teacher-classes-persisted",
  "teacher-attendance-save", "teacher-attendance-undo", "teacher-session-summary",
  "teacher-video-list", "teacher-video-reload", "teacher-attendance-export",
  "attendance-prepare", "attendance-submit", "attendance-download", "attendance-workbook", "attendance-restore",
] as const;
export type LearningFlowPhase = typeof LEARNING_FLOW_PHASES[number];

export function emitLearningFlowFailure(error: unknown, phase: LearningFlowPhase, viewport: 390 | 1366 | null): void {
  try {
    if (!LEARNING_FLOW_PHASES.includes(phase) || ![null, 390, 1366].includes(viewport)) return;
    const message = error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : "";
    const kind = /Release API boundary failed:|Release request rejected/.test(message) ? "boundary"
      : /expect\(|Expected values|AssertionError/.test(message) ? "assertion"
      : /locator\.[a-z]+:.*(?:Timeout|timeout)/.test(message) ? "locator-timeout"
      : safeNativeTransportKind(error) !== "other" ? "transport" : "other";
    console.info(JSON.stringify({ releaseLearningFlowFailure: {
      schema: "learning-flow-failure/v1", phase, viewport, kind,
    } }));
  } catch {
    // Diagnostic collection must never replace the primary or cleanup failure.
  }
}

type ExportStudent = { id: number; name: string; phone: string; parent_phone: string };
type ExportSession = { title: string; date: string | null };

/** Exercise only the caller's disposable lecture and restore labels before downstream roles. */
export async function verifyAttendanceExcel(
  page: Page, request: APIRequestContext, access: string, testInfo: TestInfo,
  lectureId: number, lectureTitle: string, sessionId: number, studentIds: [number, number],
): Promise<void> {
  let phase: LearningFlowPhase = "attendance-prepare";
  let viewport: 390 | 1366 | null = null;
  const preparationFailed = (error: unknown): never => {
    emitLearningFlowFailure(error, phase, viewport);
    throw error;
  };
  const students = await Promise.all(studentIds.map(id =>
    expectApi<ExportStudent>(request, "GET", `/students/${id}/`, access))).catch(preparationFailed);
  const sessionPath = `/lectures/sessions/${sessionId}/`;
  const session = await expectApi<ExportSession>(request, "GET", sessionPath, access).catch(preparationFailed);
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
    for (const width of [1366, 390] as const) {
      viewport = width;
      phase = "attendance-submit";
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
      phase = "attendance-download";
      expect(await download.failure()).toBeNull();
      expect(download.suggestedFilename()).toBe(`출결_${lectureTitle}_${lectureId}.xlsx`);
      const outputPath = testInfo.outputPath(`attendance-${width}.xlsx`);
      await download.saveAs(outputPath);
      phase = "attendance-workbook";
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
      const screenshotPath = testInfo.outputPath(`attendance-export-${width}.png`);
      await page.screenshot({ path: screenshotPath, animations: "disabled" });
      await testInfo.attach(`attendance-export-${width}`, { path: screenshotPath, contentType: "image/png" });
      await testInfo.attach(`attendance-workbook-${width}`, {
        path: outputPath, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
    expect(jobs.size).toBe(2);
  } catch (error) {
    emitLearningFlowFailure(error, phase, viewport);
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
    const restoreFailures = restored.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (restoreFailures.length) emitLearningFlowFailure(restoreFailures[0].reason, "attendance-restore", viewport);
    failures.push(...restoreFailures.map(result => result.reason));

  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Attendance export verification and restoration failed");
}
