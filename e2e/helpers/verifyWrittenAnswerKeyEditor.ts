import type { APIRequestContext, Locator, Page, TestInfo } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "./firstLoginGuide";
import {
  api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, expectApi,
  QA_BASE, type QaTokens,
} from "./qaStudentParentScenario";
import { gotoAndSettle } from "./wait";

type SavedAnswerKey = { id: number; exam: number; answers: Record<string, string> };

async function expectAnswerFits(answer: Locator): Promise<void> {
  await expect.poll(() => answer.evaluate((element) => ({
    vertical: element.scrollHeight <= element.clientHeight + 1,
    horizontal: element.scrollWidth <= element.clientWidth + 1,
  }))).toEqual({ vertical: true, horizontal: true });
}

/** Reuse the guarded teacher session; this helper owns only its two disposable exams. */
export async function verifyWrittenAnswerKeyEditor(
  page: Page, request: APIRequestContext, admin: QaTokens,
  scope: { lectureId: number; sessionId: number }, testInfo: TestInfo,
): Promise<void> {
  assertQaStudentParentRuntime();
  const cleanupPaths: string[] = [];
  const failures: unknown[] = [];
  try {
    // The parent lecture is math. A separate Korean template supplies the subject
    // without changing that lecture or the existing student's 85-point scenario.
    const template = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
      title: `QA 서술형 정답 양식 ${Date.now()}`, exam_type: "template", subject: "국어",
      max_score: 100, pass_score: 50, grading_mode: "mixed", choice_question_count: 1,
    });
    cleanupPaths.push(`/exams/${template.id}/`);
    const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
      title: `QA 서술형 정답 편집 ${Date.now()}`, exam_type: "regular",
      session_id: scope.sessionId, template_exam_id: template.id,
      max_score: 100, pass_score: 50, grading_mode: "mixed", choice_question_count: 1,
      manual_grading_method: "score",
    });
    cleanupPaths.push(`/exams/${exam.id}/?session_id=${scope.sessionId}`);
    const questions = await expectApi<Array<{ id: number; number: number }>>(
      request, "POST", `/exams/${exam.id}/questions/init/`, admin.access,
      { choice_count: 1, choice_score: 50, essay_count: 1, essay_score: 50 },
    );
    questions.sort((a, b) => a.number - b.number);
    expect(questions.map(({ number }) => number)).toEqual([1, 2]);
    expect(await expectApi(request, "GET", `/exams/${exam.id}/`, admin.access)).toMatchObject({
      subject: "국어", structure_owner_id: exam.id, can_edit_structure: true,
    });

    const original = "낮은 곳은 D이다. 물은 높은 곳에서 낮은 곳으로 이동하므로 그림의 높이와 이동 방향을 함께 비교해야 한다. ".repeat(3).trim()
      + "\n그림에 표시된 근거를 문장으로 설명한다.";
    const url = `${QA_BASE}/workspace/lectures/${scope.lectureId}/sessions/${scope.sessionId}/exams?examId=${exam.id}`;
    const modal = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "저장 (총 100점)", exact: true }) });
    const answer = modal.getByRole("textbox", { name: "2번 정답", exact: true });
    const choice = modal.getByRole("checkbox", { name: "1번 2번 선택지", exact: true });
    const save = modal.getByRole("button", { name: "저장 (총 100점)", exact: true });
    let keyId: number | undefined;
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndSettle(page, url);
      await acknowledgeInitialAccountPromptsIfVisible(page);
      await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
      expect(await answer.evaluate((element) => element.tagName)).toBe("TEXTAREA");
      if (width === 1366) {
        await expect(choice).not.toBeChecked();
        await choice.click();
        await answer.fill(original);
      } else {
        await expect(choice).toBeChecked();
        await expect(answer).toHaveValue(original);
        await answer.press("ControlOrMeta+End");
        await answer.press("Enter");
        await answer.pressSequentially("추가 근거를 모바일에서 작성합니다.");
      }
      const expected = width === 1366 ? original : `${original}\n추가 근거를 모바일에서 작성합니다.`;
      await expect(answer).toHaveValue(expected);
      await expectAnswerFits(answer);
      const method = keyId === undefined ? "POST" : "PUT";
      const endpoint = keyId === undefined ? "/api/v1/exams/answer-keys/" : `/api/v1/exams/answer-keys/${keyId}/`;
      const savedResponse = page.waitForResponse((response) => response.request().method() === method
        && new URL(response.url()).pathname === endpoint);
      await save.click();
      const response = await savedResponse;
      expect(response.status()).toBe(method === "POST" ? 201 : 200);
      const saved = await response.json() as SavedAnswerKey;
      if (keyId !== undefined) expect(saved.id).toBe(keyId);
      keyId = saved.id;
      expect(keyId).toBeGreaterThan(0);
      const expectedKey = { id: keyId, exam: exam.id, answers: { [questions[0].id]: "2", [questions[1].id]: expected } };
      expect(saved).toMatchObject(expectedKey);
      await expect(page.getByText("저장·재채점되었습니다.", { exact: true })).toBeVisible();
      await expect(save).toBeEnabled();
      const persisted = await expectApi<SavedAnswerKey>(request, "GET", `/exams/answer-keys/${keyId}/`, admin.access);
      expect({ id: persisted.id, exam: persisted.exam, answers: persisted.answers }).toEqual(expectedKey);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
      await expect(answer).toHaveValue(expected);
      await expect(choice).toBeChecked();
      await expectAnswerFits(answer);
      await assertNoHorizontalOverflow(page);
      await answer.scrollIntoViewIfNeeded();
      const screenshot = testInfo.outputPath(`real-exam-answer-key-${width}.png`);
      await page.screenshot({ path: screenshot, animations: "disabled" });
      await testInfo.attach(`real-exam-answer-key-${width}`, { path: screenshot, contentType: "image/png" });
    }
  } catch (error) {
    failures.push(error);
  } finally {
    // No student submissions are created, so deletion must remove the regular
    // exam before its template. Attempt both and retain any primary failure.
    for (const path of cleanupPaths.reverse()) {
      try {
        await expectApi(request, "DELETE", path, admin.access, undefined, [204]);
        const readbackPath = `${path.split("?")[0]}?include_inactive=true`;
        expect((await api(request, "GET", readbackPath, admin.access)).status, `answer-key cleanup ${path}`).toBe(404);
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Written answer-key verification and cleanup failed");
}
