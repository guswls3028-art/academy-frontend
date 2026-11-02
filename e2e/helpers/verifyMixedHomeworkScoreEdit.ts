import type { Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { isExplicitScoreFinish, type CorrectionScores } from "./verifyScoreCorrectionWhileEditing";

/** Edit both students' numeric and completion grades through the same score table. */
export async function verifyMixedHomeworkScoreEdit(staffPage: Page, width: number, readScores: () => Promise<CorrectionScores>,
  { sessionId, enrollmentId, comparisonEnrollmentId, homeworkId, completionId, studentName, comparisonName, homeworkTitle, completionTitle }: {
    sessionId: number; enrollmentId: number; comparisonEnrollmentId: number; homeworkId: number; completionId: number;
    studentName: string; comparisonName: string; homeworkTitle: string; completionTitle: string;
  }) {
  await staffPage.setViewportSize({ width, height: 900 });
  await staffPage.reload();
  const cell = staffPage.locator(`[data-score-cell="homework:${enrollmentId}:${completionId}"]`);
  await expect(cell).toBeVisible();
  const edit = staffPage.getByRole("button", { name: "수정", exact: true });
  if (await edit.isVisible()) await edit.click();
  const numeric = staffPage.getByRole("textbox", { name: `${studentName} · ${homeworkTitle} 점수 입력`, exact: true });
  const readNumericScore = async () => {
    const data = await readScores();
    return data.rows.find(row => row.enrollment_id === enrollmentId)!.homeworks.find(item => item.homework_id === homeworkId)!.block.score;
  };
  await numeric.click();
  await numeric.fill("97");
  await numeric.press("Escape");
  await expect(numeric).toHaveText("92");
  await staffPage.getByRole("button", { name: "점수 입력 마침", exact: true }).click();
  await expect(edit).toBeVisible();
  expect(await readNumericScore()).toBe(92);
  await edit.click();
  await numeric.click();
  await numeric.fill("92.5%");
  const fractionalSave = staffPage.waitForResponse(response => response.request().method() === "PATCH"
    && new URL(response.url()).pathname === "/api/v1/homework/scores/quick/"
    && response.request().postDataJSON()?.homework_id === homeworkId);
  await staffPage.getByRole("button", { name: "점수 입력 마침", exact: true }).click();
  expect((await fractionalSave).status()).toBe(200);
  await expect(edit).toBeVisible();
  expect(await readNumericScore()).toBe(92.5);
  await staffPage.reload();
  await edit.click();
  await expect(numeric).toHaveText("92.5");
  await numeric.click();
  await numeric.fill("92");
  const previewNumeric = staffPage.getByRole("textbox", { name: `${comparisonName} · ${homeworkTitle} 점수 입력`, exact: true });
  await previewNumeric.click();
  await previewNumeric.fill("60");
  const peerOption = staffPage.getByRole("group", { name: `${comparisonName} · ${completionTitle} 완료 상태`, exact: true })
    .getByRole("button", { name: width === 1366 ? "미통과" : "통과", exact: true });
  await peerOption.click();
  await expect(peerOption).toBeFocused();
  await expect(peerOption).toHaveAttribute("aria-pressed", "true");
  await expect(staffPage.locator(".student-scores-drawer")).toHaveCount(0);
  const state = cell.getByRole("group", { name: `${studentName} · ${completionTitle} 완료 상태`, exact: true });
  const scored = staffPage.waitForResponse(response => response.request().method() === "PATCH"
    && new URL(response.url()).pathname === "/api/v1/homework/scores/quick/"
    && response.request().postDataJSON()?.homework_id === completionId
    && response.request().postDataJSON()?.enrollment_id === enrollmentId);
  if (width === 1366) {
    await state.locator('button[aria-pressed="true"]').focus();
    await staffPage.keyboard.press("1");
  } else await state.getByRole("button", { name: "미통과", exact: true }).click();
  await expect(state.getByRole("button", { name: width === 1366 ? "통과" : "미통과", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(staffPage.locator(".student-scores-drawer")).toHaveCount(0);
  const [scoreResponse, released] = await Promise.all([scored,
    staffPage.waitForResponse(response => isExplicitScoreFinish(response, sessionId)),
    staffPage.getByRole("button", { name: "점수 입력 마침", exact: true }).click(),
  ]);
  expect(scoreResponse.status()).toBe(200);
  expect(released.status()).toBe(204);
  expect(await scoreResponse.json()).toMatchObject({ score: width === 1366 ? 1 : 0 });
  await expect(edit).toBeVisible();
  await staffPage.reload();
  const saved = await readScores();
  const score = (rowId: number, id: number) => saved.rows.find(row => row.enrollment_id === rowId)?.homeworks.find(item => item.homework_id === id)?.block.score;
  expect([score(enrollmentId, homeworkId), score(enrollmentId, completionId)]).toEqual([92, width === 1366 ? 1 : 0]);
  expect([score(comparisonEnrollmentId, homeworkId), score(comparisonEnrollmentId, completionId)]).toEqual([60, width === 1366 ? 0 : 1]);
}
