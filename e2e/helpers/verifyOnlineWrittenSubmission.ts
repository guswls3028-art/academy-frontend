import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "./firstLoginGuide";
import {
  assertNoHorizontalOverflow, expectApi, installQaStudentParentBoundary,
  QA_BASE, seedBrowserAuth, type QaTokens,
} from "./qaStudentParentScenario";
import { gotoAndSettle } from "./wait";

/** Part of the mandatory same-artifact assessment case; outer cleanup owns each id. */
export async function verifyOnlineWrittenSubmission(
  parentPage: Page, request: APIRequestContext, admin: QaTokens, student: QaTokens,
  scope: { lectureId: number; sessionId: number; enrollmentId: number; studentName: string },
  registerExam: (id: number) => void, registerSubmission: (id: number) => void,
  testInfo: TestInfo,
): Promise<void> {
  const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
    title: `QA 온라인 서술형 ${Date.now()}`, session_id: scope.sessionId, exam_type: "regular",
    max_score: 100, pass_score: 50, grading_mode: "mixed", choice_question_count: 1,
    manual_grading_method: "score", allow_retake: true, max_attempts: 2,
    open_at: new Date().toISOString(),
  });
  registerExam(exam.id);
  const questions = await expectApi<Array<{ id: number; number: number }>>(
    request, "POST", `/exams/${exam.id}/questions/init/`, admin.access,
    { choice_count: 1, choice_score: 50, essay_count: 1, essay_score: 50 },
  );
  questions.sort((a, b) => a.number - b.number);
  expect(questions).toHaveLength(2);
  await expectApi(request, "PUT", `/exams/${exam.id}/enrollments/?session_id=${scope.sessionId}`, admin.access, {
    enrollment_ids: [scope.enrollmentId],
  });
  const answer = "첫 번째 줄에서 풀이의 근거를 설명합니다.\n두 번째 줄에서 계산 과정과 결론을 충분히 길게 작성합니다.";
  const answers = [
    { exam_question_id: questions[0].id, answer: "2" },
    { exam_question_id: questions[1].id, answer },
  ];
  await expectApi(request, "POST", `/student/exams/${exam.id}/submit/`, student.access, { answers }, [409]);
  const answerKey = await expectApi<{ id: number }>(request, "POST", "/exams/answer-keys/", admin.access, {
    exam: exam.id, answers: {},
  });
  await expectApi(request, "POST", `/student/exams/${exam.id}/submit/`, student.access, { answers }, [409]);
  // Match the teacher editor: update an existing answer key by its id.
  await expectApi(request, "PUT", `/exams/answer-keys/${answerKey.id}/`, admin.access, {
    exam: exam.id, answers: { [questions[0].id]: "2" },
  }, [200]);
  const before = await expectApi<{ attempt_count: number }>(request, "GET", `/student/exams/${exam.id}/`, student.access);
  expect(before.attempt_count).toBe(0);

  // Separate contexts keep student and teacher sessions independent on every reload.
  const browser = parentPage.context().browser()!;
  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const teacherContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  try {
    const studentPage = await studentContext.newPage();
    const teacherPage = await teacherContext.newPage();
    const studentBoundary = await installQaStudentParentBoundary(studentPage, request);
    const teacherBoundary = await installQaStudentParentBoundary(teacherPage, request);
    await seedBrowserAuth(studentPage, student);
    await seedBrowserAuth(teacherPage, admin);
    await gotoAndSettle(studentPage, `${QA_BASE}/student/exams/${exam.id}/submit`);
    await acknowledgeInitialAccountPromptsIfVisible(studentPage);
    await studentPage.getByLabel("1번 답", { exact: true }).fill("2");
    await studentPage.locator("textarea").fill(answer);
    await studentPage.reload({ waitUntil: "domcontentloaded" });
    await expect(studentPage.locator("textarea")).toHaveValue(answer);
    await assertNoHorizontalOverflow(studentPage);
    const submitted = studentPage.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/v1/student/exams/${exam.id}/submit/`).then(async (response) => {
      expect(response.status()).toBe(201);
      const id = Number((await response.json() as { submission_id: number }).submission_id);
      expect(id).toBeGreaterThan(0);
      registerSubmission(id);
    });
    await studentPage.getByRole("button", { name: "제출하기" }).click();
    await studentPage.locator("[data-confirm-dialog]").getByRole("button", { name: "제출", exact: true }).click();
    await submitted;
    await expect(studentPage.getByText("서술형 채점 중입니다.")).toBeVisible();
    await studentPage.reload({ waitUntil: "domcontentloaded" });
    await expect(studentPage.getByText("서술형 채점 중입니다.")).toBeVisible();

    const sheet = await expectApi<{
      rows: Array<{ enrollment_id: number; student_name: string; cells: Record<string, { answer: string; score: number | null }> }>;
    }>(request, "GET", `/results/admin/exams/${exam.id}/manual-grading/`, admin.access);
    const pendingRow = sheet.rows.find((row) => row.enrollment_id === scope.enrollmentId);
    expect(pendingRow?.student_name).toBe(scope.studentName);
    expect(pendingRow?.cells[String(questions[1].id)]).toMatchObject({ answer, score: null });

    const gradingUrl = `${QA_BASE}/workspace/lectures/${scope.lectureId}/sessions/${scope.sessionId}/exams?examId=${exam.id}`;
    const teacherRow = teacherPage.getByRole("region", { name: "혼합 채점 워크스페이스", exact: true })
      .getByRole("row").filter({ hasText: scope.studentName });
    for (const width of [390, 1366]) {
      await teacherPage.setViewportSize({ width, height: 900 });
      await gotoAndSettle(teacherPage, gradingUrl);
      await acknowledgeInitialAccountPromptsIfVisible(teacherPage);
      await teacherPage.getByRole("tab", { name: "채점·결과", exact: true }).click();
      await expect(teacherPage).toHaveURL(gradingUrl);
      await expect(teacherRow).toHaveCount(1);
      const summary = teacherRow.locator("summary").filter({ hasText: "학생 답안" });
      await summary.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
      await expect.poll(() => summary.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        return rect.width > 0 && [rect.left + 1, rect.right - 1].every((x) =>
          element.contains(document.elementFromPoint(x, rect.top + rect.height / 2)));
      })).toBe(true);
      await summary.click();
      await expect(teacherRow.locator("details[open] div")).toHaveText(answer);
      await expect(teacherRow.getByRole("spinbutton", { name: /50점 만점 점수/ })).toHaveValue("");
      await assertNoHorizontalOverflow(teacherPage);
      await testInfo.attach(`online-written-teacher-${width}`, {
        body: await teacherPage.screenshot({ fullPage: true }), contentType: "image/png",
      });
    }
    await teacherRow.getByRole("spinbutton", { name: /50점 만점 점수/ }).fill("35");
    await teacherPage.getByRole("button", { name: "입력 내용 확인", exact: true }).click();
    const saved = teacherPage.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith(`/exams/${exam.id}/manual-grading/`)
      && Boolean((response.request().postDataJSON() as { apply?: boolean }).apply));
    await teacherPage.getByRole("button", { name: "1명 성적 확정", exact: true }).click();
    expect((await saved).status()).toBe(200);
    await teacherPage.reload({ waitUntil: "domcontentloaded" });
    await teacherPage.getByRole("tab", { name: "채점·결과", exact: true }).click();
    await expect(teacherRow.getByRole("spinbutton", { name: /50점 만점 점수/ })).toHaveValue("35");

    for (const width of [1366, 390]) {
      await studentPage.setViewportSize({ width, height: 900 });
      await gotoAndSettle(studentPage, `${QA_BASE}/student/exams/${exam.id}/result`);
      await expect(studentPage.getByText("85 / 100점", { exact: true })).toBeVisible();
      await studentPage.reload({ waitUntil: "domcontentloaded" });
      await expect(studentPage.getByText("85 / 100점", { exact: true })).toBeVisible();
      const result = await expectApi<{ total_score: number }>(request, "GET", `/student/results/me/exams/${exam.id}/`, student.access);
      expect(result.total_score).toBe(85);
      await assertNoHorizontalOverflow(studentPage);
      await testInfo.attach(`online-written-result-${width}`, {
        body: await studentPage.screenshot({ fullPage: true }), contentType: "image/png",
      });
    }
    studentBoundary.assertClean();
    teacherBoundary.assertClean();
  } finally {
    await studentContext.close();
    await teacherContext.close();
  }
}
