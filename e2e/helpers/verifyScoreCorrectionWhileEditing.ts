import type { Page, Response } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { reloadStudentApp } from "./qaStudentParentScenario";

export type CorrectionScores = { rows: Array<{ enrollment_id: number; homeworks: Array<{
  homework_id: number; block: { score: number | null; passed: boolean | null; correction_status: string | null; correction_note: string; teacher_resolved: boolean };
}> }> };

export function isExplicitScoreFinish(response: Response, sessionId: number) {
  const request = response.request();
  if (request.method() !== "POST" || new URL(response.url()).pathname !== `/api/v1/results/admin/sessions/${sessionId}/score-draft/commit/`) return false;
  const payload = request.postDataJSON();
  return payload?.release_lease === true && payload.release_if_empty !== true;
}

/** Shared by the disposable release scenario and its closed browser regression. */
export async function verifyScoreCorrectionWhileEditing(
  page: Page, parentPage: Page, readScores: () => Promise<CorrectionScores>,
  target: { sessionId: number; enrollmentId: number; homeworkId: number; homeworkTitle: string; studentName: string; maxScore: number },
) {
  const readBlock = async () => {
    const scores = await readScores();
    return scores.rows.find(row => row.enrollment_id === target.enrollmentId)!
      .homeworks.find(homework => homework.homework_id === target.homeworkId)!.block;
  };
  const before = await readBlock();
  expect(before).toMatchObject({ score: 92, passed: true, teacher_resolved: false });
  const scoreCell = page.locator(`[data-score-cell="homework:${target.enrollmentId}:${target.homeworkId}"]`);
  const expectOriginalScore = async () => {
    await expect(scoreCell).toHaveAttribute("data-pass-status", "pass");
    await expect(scoreCell).not.toHaveAttribute("data-achievement");
    await expect(scoreCell.getByText("통과 인정", { exact: true })).toHaveCount(0);
  };
  await expectOriginalScore();
  const open = async () => {
    await page.locator('tbody tr[role="button"] [data-col-type="name"]')
      .filter({ hasText: target.studentName }).click();
    const drawer = page.locator(".student-scores-drawer");
    await drawer.locator(".student-scores-drawer__hw-card")
      .getByText(target.homeworkTitle, { exact: true }).click();
    return drawer;
  };
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const drawer = await open();
  const complete = drawer.getByRole("button", { name: "완료로 표시", exact: true });
  await expect(complete).toBeEnabled();
  await expect(drawer.getByRole("button", { name: "성적 발송", exact: true })).toBeDisabled();
  const note = "QA 수정 중 보완 검사 완료";
  await drawer.getByRole("textbox", { name: "과제 완료 상태 사유" }).fill(note);
  const saved = page.waitForResponse(response => response.request().method() === "PATCH"
    && new URL(response.url()).pathname === `/api/v1/results/admin/sessions/${target.sessionId}/score-correction/`);
  await complete.click();
  expect((await saved).status()).toBe(200);
  await expect(complete).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "점수 입력 마침", exact: true })).toBeVisible();
  expect(await readBlock()).toMatchObject({ score: before.score, correction_status: "COMPLETED", correction_note: note, teacher_resolved: true });
  await expect(scoreCell).toHaveAttribute("data-achievement", "REMEDIATED");
  await expect(scoreCell.getByText("통과 인정", { exact: true })).toBeVisible();
  await reloadStudentApp(parentPage);
  await parentPage.getByRole("button", { name: "과제 현황" }).click();
  const parentCard = parentPage.locator('.stu-panel[data-session-type]')
    .filter({ has: parentPage.getByText(target.homeworkTitle, { exact: true }) });
  await expect(parentCard).toHaveCount(0);
  await parentPage.getByRole("group", { name: "과제 상태 필터" }).getByRole("button", { name: /^전체 / }).click();
  await expect(parentCard.locator('strong[class*="homeworkScore"]')).toHaveText(`${before.score}/${target.maxScore}`);
  await expect(parentCard.getByText("완료", { exact: true })).toBeVisible();
  // A 390px drawer covers the toolbar until its ordinary Close action completes.
  await drawer.getByRole("button", { name: "학생 성적 상세 닫기 (Esc)", exact: true }).click();
  await expect(drawer).toBeHidden();
  const finish = page.getByRole("button", { name: "점수 입력 마침", exact: true });
  await expect(finish).toBeEnabled();
  const [released] = await Promise.all([
    page.waitForResponse(response => isExplicitScoreFinish(response, target.sessionId)),
    finish.click(),
  ]);
  expect(released.status()).toBe(204);
  await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible();
  await page.reload();
  await expect(scoreCell).toHaveAttribute("data-achievement", "REMEDIATED");
  await expect(scoreCell.getByText("통과 인정", { exact: true })).toBeVisible();
  const reopened = await open();
  await expect(reopened.getByRole("button", { name: "완료로 표시", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(reopened.getByRole("textbox", { name: "과제 완료 상태 사유" })).toHaveValue(note);
  // Return to pending so the existing score-based parent/report assertions still run.
  await reopened.getByRole("textbox", { name: "과제 완료 상태 사유" }).fill("");
  await reopened.getByRole("button", { name: "미완료로 표시", exact: true }).click();
  await expect(reopened.getByRole("button", { name: "미완료로 표시", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await readBlock()).toMatchObject({ score: before.score, correction_status: "PENDING", correction_note: "", teacher_resolved: false });
  await page.reload();
  await expectOriginalScore();
}
