import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import type { SessionScoresResponse } from "@/shared/api/contracts/sessionScores";
import { assertNoHorizontalOverflow, expectApi, QA_BASE, reloadStudentApp } from "./qaStudentParentScenario";
import { gotoAndSettle } from "./wait";

type CriteriaScenario = {
  lectureId: number;
  sessionId: number;
  enrollmentId: number;
  homeworkId: number;
  homeworkTitle: string;
  completionHomeworkId: number;
  completionTitle: string;
  completionScore: number;
  studentName: string;
};

/** Reuse only the caller's disposable family; preview messages without saving or sending. */
export async function verifyHomeworkCriteria(
  page: Page, parentPage: Page, request: APIRequestContext, access: string,
  scenario: CriteriaScenario, width: number,
): Promise<void> {
  const { lectureId, sessionId, enrollmentId, homeworkId, homeworkTitle,
    completionHomeworkId, completionTitle, completionScore, studentName } = scenario;
  const scoresUrl = `${QA_BASE}/workspace/lectures/${lectureId}/sessions/${sessionId}/scores`;
  const homeworkPath = `/homeworks/${homeworkId}/`;
  const completionPath = `/homeworks/${completionHomeworkId}/`;
  const completionPolicy = await expectApi(request, "GET", completionPath, access);
  const mode = width === 1366 ? "PERCENT" : "COUNT";
  const modeLabel = mode === "PERCENT" ? "퍼센트 기준" : "점수 기준";
  const inputLabel = `합격 기준 (${mode === "PERCENT" ? "%" : "점"})`;
  const completionPassed = completionScore > 0;

  for (const threshold of [95, 90]) {
    const passed = threshold <= 92;
    await gotoAndSettle(page, `${QA_BASE}/workspace/lectures/${lectureId}/sessions/${sessionId}/assignments?homeworkId=${homeworkId}`);
    await page.getByRole("tab", { name: "운영", exact: true }).click();
    const policy = page.locator("#assessment-policy");
    await expect(policy.getByRole("heading", { name: "과제 운영 설정", exact: true })).toBeVisible();
    await policy.getByRole("group", { name: "과제 합격 기준 방식", exact: true })
      .getByRole("button", { name: new RegExp(modeLabel) }).click();
    const criterion = policy.getByLabel(inputLabel, { exact: true });
    const save = policy.getByRole("button", { name: "운영 설정 저장", exact: true });
    if (threshold === 95) {
      // A rejected local value must preserve the saved policy and allow correction.
      const before = await expectApi(request, "GET", homeworkPath, access);
      await criterion.fill("101");
      await expect(policy.getByRole("alert")).toContainText(mode === "PERCENT"
        ? "퍼센트 합격 기준은 100% 이하" : "점수 합격 기준은 만점을 넘을 수 없습니다");
      await expect(save).toBeDisabled();
      expect(await expectApi(request, "GET", homeworkPath, access)).toEqual(before);
    }
    await criterion.fill(String(threshold));
    const saved = page.waitForResponse(response => response.request().method() === "PATCH"
      && new URL(response.url()).pathname === `/api/v1${homeworkPath}`);
    await save.click();
    expect((await saved).status()).toBe(200);
    await expect(save).toBeDisabled();
    await page.reload();
    await expect(criterion).toHaveValue(String(threshold));
    await expect(policy.getByRole("button", { name: new RegExp(modeLabel) })).toHaveAttribute("aria-pressed", "true");
    expect(await expectApi(request, "GET", homeworkPath, access)).toMatchObject({
      grading_mode: "SCORE", max_score: 100, cutline_mode: mode, cutline_value: threshold,
    });
    expect(await expectApi(request, "GET", completionPath, access)).toEqual(completionPolicy);
    const scores = await expectApi<SessionScoresResponse>(request, "GET", `/results/admin/sessions/${sessionId}/scores/`, access);
    const row = scores.rows.find(item => item.enrollment_id === enrollmentId)!;
    expect(row.homeworks.find(item => item.homework_id === homeworkId)!.block).toMatchObject({
      score: 92, passed, clinic_required: !passed,
    });
    expect(row.homeworks.find(item => item.homework_id === completionHomeworkId)!.block).toMatchObject({
      score: completionScore, passed: completionPassed, clinic_required: !completionPassed,
    });
    await assertNoHorizontalOverflow(page);
    await test.info().attach(`homework-criteria-${width}-${threshold}`, {
      body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
    });

    await parentPage.setViewportSize({ width, height: 900 });
    await reloadStudentApp(parentPage);
    await parentPage.getByRole("button", { name: "과제 현황" }).click();
    const card = parentPage.locator('.stu-panel[data-session-type]')
      .filter({ has: parentPage.getByText(homeworkTitle, { exact: true }) });
    await expect(card.locator("strong")).toHaveText("92/100");
    await expect(card.getByText(passed ? "완료" : "미완료", { exact: true })).toBeVisible();
    const completionCard = parentPage.locator('.stu-panel[data-session-type]')
      .filter({ has: parentPage.getByText(completionTitle, { exact: true }) });
    await expect(completionCard.locator("strong")).toHaveText(completionPassed ? "통과" : "미통과");

    await gotoAndSettle(page, scoresUrl);
    await page.getByRole("checkbox", { name: `${studentName} 선택`, exact: true }).check();
    await page.getByRole("button", { name: "수업결과 알림톡 발송", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "알림톡 발송", exact: true });
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    const numericResult = modal.getByRole("button", { name: `${homeworkTitle} 넣기`, exact: true });
    await expect(numericResult).toBeVisible();
    await editor.fill(`${width}px 과제별 판정 확인\n`);
    await numericResult.click();
    await modal.getByRole("button", { name: `${completionTitle} 넣기`, exact: true }).click();
    const preview = modal.getByLabel("현재 학생의 실제 발송 문구");
    await expect(preview).toContainText(`${homeworkTitle}: ${passed ? "통과" : "미통과"}`);
    await expect(preview).toContainText(`${completionTitle}: ${completionPassed ? "통과" : "미통과"}`);
    if (width === 390) {
      await modal.getByRole("button", { name: "미리보기로 이동", exact: true }).click();
      await expect(preview).toBeInViewport();
    }
    await assertNoHorizontalOverflow(page);
    await test.info().attach(`homework-message-criteria-${width}-${threshold}`, {
      body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
    });
    await modal.getByRole("button", { name: "취소", exact: true }).click();
    await page.getByRole("alertdialog", { name: "작성한 문구를 닫을까요?", exact: true })
      .getByRole("button", { name: "수정 내용 버리고 닫기", exact: true }).click();
    await expect(modal).toBeHidden();
  }
  // Leave the existing fixture's score and passing state intact for report/comment checks.
  await gotoAndSettle(page, scoresUrl);
}
