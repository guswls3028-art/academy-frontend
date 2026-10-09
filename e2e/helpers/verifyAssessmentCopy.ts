import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { attachStrictBrowserGuards } from "./strictBrowser";
import { gotoAndSettle } from "./wait";
import { emitReleaseTestFailure } from "./releaseApiBoundary";
import {
  api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, expectApi,
  installQaStudentParentBoundary, QA_BASE, seedBrowserAuth, type QaTokens,
} from "./qaStudentParentScenario";

/** Exercise the existing copy controls using only this scenario's disposable records. */
export async function verifyAssessmentCopy(
  parentPage: Page,
  request: APIRequestContext,
  admin: QaTokens,
  student: QaTokens,
  source: { lectureId: number; sessionId: number; examId: number; examTitle: string; enrollmentIds: number[]; date: string },
  registerSessionCleanup: (sessionId: number) => void,
): Promise<void> {
  assertQaStudentParentRuntime();
  const context = await parentPage.context().browser()!.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const cleanupPaths: string[] = [];
  const cleanupFailures: Error[] = [];
  let workflowError: unknown;
  try {
    const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", admin.access, {
      lecture: source.lectureId, title: "QA 평가 복사 대상", date: source.date, order: 2,
    });
    // Roster creation also creates attendance. The parent removes the owned
    // lecture enrollments before deleting this session, preserving delete guards.
    registerSessionCleanup(session.id);
    const enrollments = await expectApi<Array<{ id: number }>>(request, "POST", "/enrollments/session-enrollments/bulk_create/", admin.access, {
      session: session.id, enrollments: source.enrollmentIds,
    });
    for (const row of enrollments) cleanupPaths.push(`/enrollments/session-enrollments/${row.id}/`);
    const homeworkTitle = "QA 복사 과제";
    const homework = await expectApi<{ id: number }>(request, "POST", "/homeworks/", admin.access, {
      session_id: source.sessionId, title: homeworkTitle, grading_mode: "SCORE", max_score: 100,
      cutline_mode: "PERCENT", cutline_value: 80,
    });
    cleanupPaths.push(`/homeworks/${homework.id}/`);
    await seedBrowserAuth(page, admin);
    for (const kind of ["exam", "homework"] as const) {
      const label = kind === "exam" ? "시험" : "과제";
      const title = kind === "exam" ? source.examTitle : homeworkTitle;
      const endpoint = kind === "exam" ? "/exams/" : "/homeworks/";
      await page.setViewportSize({ width: kind === "exam" ? 390 : 1366, height: 900 });
      await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${source.lectureId}/sessions/${session.id}/${kind === "exam" ? "exams" : "assignments"}`);
      await page.getByRole("button", { name: `${label} 추가`, exact: true }).first().click();
      const dialog = page.getByRole("dialog").filter({ hasText: "다른 차시에서 복사" });
      await dialog.getByText("다른 차시에서 복사", { exact: true }).click();
      await dialog.getByRole("combobox", { name: "강의 선택", exact: true }).selectOption(String(source.lectureId));
      await dialog.getByRole("combobox", { name: "차시 선택", exact: true }).selectOption(String(source.sessionId));
      await dialog.getByRole("checkbox", { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).check();
      await expect(dialog.getByText("1개 선택됨", { exact: true })).toBeVisible();
      const saved = page.waitForResponse((response) => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/v1${endpoint}`).then(async (response) => {
        expect(response.status()).toBe(201);
        const row = await response.json() as { id: number; title: string };
        expect(row.id).toBeGreaterThan(0);
        cleanupPaths.push(`${endpoint}${row.id}/${kind === "exam" ? `?session_id=${session.id}` : ""}`);
        expect(row.title).toBe(title);
        return row;
      });
      await dialog.getByRole("button", { name: "불러오기", exact: true }).click();
      const copied = await saved;
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
      expect(await expectApi<{ title: string }>(request, "GET", `${endpoint}${copied.id}/`, admin.access)).toMatchObject({ title });
      if (kind === "exam") {
        const original = await expectApi<Array<{ number: number; score: number }>>(request, "GET", `/student/exams/${source.examId}/questions/`, student.access);
        const questions = await expectApi<Array<{ number: number; score: number }>>(request, "GET", `/student/exams/${copied.id}/questions/`, student.access);
        expect(questions.map(({ number, score }) => ({ number, score }))).toEqual(original.map(({ number, score }) => ({ number, score })));
        expect(questions.length).toBeGreaterThan(0);
      } else {
        const grades = await expectApi<{ homeworks: Array<{ homework_id: number; title: string }> }>(request, "GET", "/student/grades/", student.access);
        expect(grades.homeworks.find((row) => row.homework_id === copied.id)).toMatchObject({ title });
      }
    }
    boundary.assertClean();
    guards.assertZeroDefects();
  } catch (error) {
    emitReleaseTestFailure(error, "assessment-copy");
    workflowError = error;
  } finally {
    await context.close().catch(() => { cleanupFailures.push(new Error("Assessment copy context did not close")); });
    for (const path of cleanupPaths.reverse()) {
      try {
        await expectApi(request, "DELETE", path, admin.access, undefined, [200, 204, 404]);
        expect((await api(request, "GET", path, admin.access)).status).toBe(404);
      } catch (error) {
        cleanupFailures.push(error instanceof Error ? error : new Error("Assessment copy cleanup failed"));
      }
    }
  }
  for (const error of cleanupFailures) emitReleaseTestFailure(error, "assessment-copy-cleanup");
  // Preserve the original assertion/location after attempting every cleanup.
  if (workflowError) throw workflowError;
  if (cleanupFailures.length) throw cleanupFailures[0];
}
