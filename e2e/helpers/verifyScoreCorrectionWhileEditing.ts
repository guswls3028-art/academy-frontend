import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { expectApi } from "./qaStudentParentScenario";

/** Called only with the existing isolated, disposable homework scenario. */
export async function verifyScoreCorrectionWhileEditing(
  page: Page, request: APIRequestContext, access: string,
  target: { sessionId: number; enrollmentId: number; homeworkId: number; homeworkTitle: string; studentName: string },
) {
  const scoresPath = `/results/admin/sessions/${target.sessionId}/scores/`;
  type Scores = { rows: Array<{ enrollment_id: number; homeworks: Array<{
    homework_id: number; block: { score: number | null; correction_status: string | null; correction_note: string };
  }> }> };
  const readBlock = async () => {
    const scores = await expectApi<Scores>(request, "GET", scoresPath, access);
    return scores.rows.find(row => row.enrollment_id === target.enrollmentId)!
      .homeworks.find(homework => homework.homework_id === target.homeworkId)!.block;
  };
  const before = await readBlock();
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
  const complete = drawer.getByRole("button", { name: "완료 확정", exact: true });
  await expect(complete).toBeEnabled();
  await expect(drawer.getByRole("button", { name: "성적 발송", exact: true })).toBeDisabled();
  const note = "QA 수정 중 보완 검사 완료";
  await drawer.getByRole("textbox", { name: "교사 완료 판정 비고" }).fill(note);
  const saved = page.waitForResponse(response => response.request().method() === "PATCH"
    && new URL(response.url()).pathname === `/api/v1/results/admin/sessions/${target.sessionId}/score-correction/`);
  await complete.click();
  expect((await saved).status()).toBe(200);
  await expect(complete).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "점수 입력 마침", exact: true })).toBeVisible();
  expect(await readBlock()).toMatchObject({ score: before.score, correction_status: "COMPLETED", correction_note: note });
  await page.getByRole("button", { name: "점수 입력 마침", exact: true }).click();
  await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible();
  await page.reload();
  const reopened = await open();
  await expect(reopened.getByRole("button", { name: "완료 확정", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(reopened.getByRole("textbox", { name: "교사 완료 판정 비고" })).toHaveValue(note);
  // Return to pending so the existing score-based parent/report assertions still run.
  await reopened.getByRole("textbox", { name: "교사 완료 판정 비고" }).fill("");
  await reopened.getByRole("button", { name: "미완료", exact: true }).click();
  await expect(reopened.getByRole("button", { name: "미완료", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await readBlock()).toMatchObject({ score: before.score, correction_status: "PENDING", correction_note: "" });
  await page.reload();
}
