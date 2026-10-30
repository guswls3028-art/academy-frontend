import { writeFile } from "node:fs/promises";
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page, Route } from "@playwright/test";
import type { ScoreBlock, SessionScoresResponse } from "@/shared/api/contracts/sessionScores";
import type { SendPreflightResponse } from "@/app_admin/domains/messages/api/messages.api";
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
  studentId: number;
  comparisonStudent: { id: number; name: string; enrollmentId: number; score: number; completionScore: number };
};

type CriteriaEvidence = {
  mode: string; threshold: number; score: number; maxScore: number; passed: boolean;
  numericBlock: ScoreBlock; completionBlock: ScoreBlock;
  comparisonNumericBlock: ScoreBlock; comparisonCompletionBlock: ScoreBlock;
};

async function verifyFinalHomeworkPreview(
  page: Page, scenario: CriteriaScenario, width: number, evidence: CriteriaEvidence,
  passLabel: string, failLabel: string,
): Promise<void> {
  const { studentId, studentName, homeworkTitle, completionTitle, completionScore, comparisonStudent } = scenario;
  const selected = [studentId, comparisonStudent.id].sort((a, b) => a - b);
  const marker = `${width}px 기준 ${evidence.threshold} 과제별 판정 확인`;
  const modal = page.getByRole("dialog", { name: "알림톡 발송", exact: true });
  const confirm = page.getByRole("dialog", { name: "보내기 전 마지막 확인", exact: true });
  const finalPreviews: Array<{ studentId: number; studentName: string; body: string }> = [];
  let preflight: SendPreflightResponse | undefined;
  let inlinePreview = "";
  let sendAttempts = 0;
  // Fail closed even if a future UI change accidentally turns the review CTA into a send.
  const sendRoute = "**/api/v1/messaging/send/";
  const rejectSend = async (route: Route) => { sendAttempts += 1; await route.abort("blockedbyclient"); };
  await page.route(sendRoute, rejectSend);
  try {
    for (const name of [studentName, comparisonStudent.name]) {
      await page.getByRole("checkbox", { name: `${name} 선택`, exact: true }).check();
    }
    await page.getByRole("button", { name: "수업결과 알림톡 발송", exact: true }).click();
    await modal.getByRole("checkbox", { name: "학부모", exact: true }).check();
    await modal.getByRole("checkbox", { name: "학생", exact: true }).uncheck();
    const editor = modal.getByRole("textbox", { name: "안내문", exact: true });
    const numericResult = modal.getByRole("button", { name: `${homeworkTitle} 넣기`, exact: true });
    await expect(numericResult).toBeVisible();
    await editor.fill(`${marker}\n#{학생이름}\n`);
    await numericResult.click();
    const checked = page.waitForResponse(response => {
      if (response.request().method() !== "POST"
        || new URL(response.url()).pathname !== "/api/v1/messaging/send/preflight/") return false;
      const payload = response.request().postDataJSON();
      return payload.send_to === "parent" && payload.raw_body?.includes(marker)
        && (payload.raw_body.match(/#\{과제\d+결과\}/g) ?? []).length === 2;
    });
    await modal.getByRole("button", { name: `${completionTitle} 넣기`, exact: true }).click();
    const response = await checked;
    preflight = await response.json() as SendPreflightResponse;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().student_ids.slice().sort((a: number, b: number) => a - b)).toEqual(selected);
    expect(preflight.blockers, "Actual server preflight must be sendable; preserve blocker evidence on failure").toEqual([]);
    expect(preflight).toMatchObject({ ok: true, can_send: true, send_to: "parent",
      recipient: { selected: 2, resolved: 2, valid_phone: 2, skipped_no_phone: 0, duplicate_phone: 0, unique_phone: 2, invalid_or_deleted: 0 },
    });
    expect(preflight.preview_recipients.map(item => item.student_id).sort((a, b) => a - b)).toEqual(selected);
    const expectedStudents = [
      { id: studentId, name: studentName, score: 92, passed: evidence.passed, completionScore },
      { ...comparisonStudent, passed: false },
    ];
    for (const student of expectedStudents) {
      const recipient = preflight.preview_recipients.find(item => item.student_id === student.id)!;
      expect(recipient).toMatchObject({ student_name: student.name, excluded: false });
      expect(recipient.full_message_body).toContain(student.name);
      expect(recipient.full_message_body).toContain(`${homeworkTitle}: ${student.score}/100 (${student.score}%) · ${student.passed ? passLabel : failLabel}`);
      expect(recipient.full_message_body).toContain(`${completionTitle}: ${student.completionScore ? "통과" : "미통과"}`);
      for (const other of expectedStudents.filter(item => item.id !== student.id)) {
        expect(recipient.full_message_body).not.toContain(other.name);
        expect(recipient.full_message_body).not.toContain(`${homeworkTitle}: ${other.score}/100`);
      }
    }
    const preview = modal.getByLabel("현재 학생의 실제 발송 문구");
    await expect(preview).toContainText(`${homeworkTitle}: 92/100 (92%) · ${evidence.passed ? passLabel : failLabel}`);
    await expect(preview).toContainText(`${completionTitle}: ${completionScore ? "통과" : "미통과"}`);
    if (width === 390) {
      await modal.getByRole("button", { name: "미리보기로 이동", exact: true }).click();
      await expect(preview).toBeInViewport();
    }
    inlinePreview = await preview.innerText();
    await assertNoHorizontalOverflow(page);
    await expect(modal.locator(".send-modal__send-btn")).toBeEnabled();
    await modal.locator(".send-modal__send-btn").click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "전체 학생 열기", exact: true }).click();
    await expect(confirm.getByRole("radio")).toHaveCount(2);
    for (const student of expectedStudents) {
      const radio = confirm.getByRole("radio").filter({ hasText: student.name });
      await radio.click();
      await expect(radio).toHaveAttribute("aria-checked", "true");
      const finalPreview = confirm.getByLabel("카카오톡 실제 발송 미리보기").locator(".kakao-alimtalk-preview__body");
      const body = preflight.preview_recipients.find(item => item.student_id === student.id)!.full_message_body;
      await expect(finalPreview).toHaveText(body);
      finalPreviews.push({ studentId: student.id, studentName: student.name, body: await finalPreview.innerText() });
    }
    await assertNoHorizontalOverflow(page);
    expect(sendAttempts).toBe(0);
  } finally {
    try {
      // Persist sanitized synthetic evidence even when readiness or personalization fails.
      const evidencePath = test.info().outputPath(`homework-criteria-evidence-${width}-${evidence.threshold}.json`);
      await writeFile(evidencePath, JSON.stringify({ ...evidence, preview: inlinePreview,
        preflight: preflight ? { ok: preflight.ok, can_send: preflight.can_send, blockers: preflight.blockers,
          recipient: preflight.recipient, preview_recipients: preflight.preview_recipients?.map(item => ({
            student_id: item.student_id, student_name: item.student_name, excluded: item.excluded,
            exclude_reason: item.exclude_reason, full_message_body: item.full_message_body,
          })) } : null, finalPreviews, sendAttempts }));
      await test.info().attach(`homework-criteria-evidence-${width}-${evidence.threshold}`, { path: evidencePath, contentType: "application/json" });
      const messageImage = test.info().outputPath(`homework-message-criteria-${width}-${evidence.threshold}.png`);
      await page.screenshot({ path: messageImage, animations: "disabled" });
      await test.info().attach(`homework-message-criteria-${width}-${evidence.threshold}`, { path: messageImage, contentType: "image/png" });
      if (await confirm.isVisible()) await confirm.getByRole("button", { name: "돌아가기", exact: true }).click();
      if (await modal.isVisible()) {
        await modal.getByRole("button", { name: "취소", exact: true }).click();
        const discard = page.getByRole("alertdialog", { name: "작성한 문구를 닫을까요?", exact: true });
        if (await discard.isVisible()) await discard.getByRole("button", { name: "수정 내용 버리고 닫기", exact: true }).click();
        await expect(modal).toBeHidden();
      }
    } finally { await page.unroute(sendRoute, rejectSend); }
  }
}

/** Reuse only the caller's disposable families; preview messages without saving or sending. */
export async function verifyHomeworkCriteria(
  page: Page, parentPage: Page, request: APIRequestContext, access: string,
  scenario: CriteriaScenario, width: number,
): Promise<void> {
  const { lectureId, sessionId, enrollmentId, homeworkId, homeworkTitle,
    completionHomeworkId, completionTitle, completionScore } = scenario;
  const scoresUrl = `${QA_BASE}/workspace/lectures/${lectureId}/sessions/${sessionId}/scores`;
  const homeworkPath = `/homeworks/${homeworkId}/`;
  const completionPath = `/homeworks/${completionHomeworkId}/`;
  const completionPolicy = await expectApi(request, "GET", completionPath, access);
  const mode = width === 1366 ? "PERCENT" : "COUNT";
  const modeLabel = mode === "PERCENT" ? "퍼센트 기준" : "점수 기준";
  const inputLabel = `합격 기준 (${mode === "PERCENT" ? "%" : "점"})`;
  const completionPassed = completionScore > 0;
  const tenant = await expectApi<{ pass_label?: string; fail_label?: string }>(request, "GET", "/core/tenant-info/", access);
  const passLabel = tenant.pass_label?.trim() || "합격";
  const failLabel = tenant.fail_label?.trim() || "불합격";

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
    const comparison = scores.rows.find(item => item.enrollment_id === scenario.comparisonStudent.enrollmentId)!;
    expect(comparison.homeworks.find(item => item.homework_id === homeworkId)!.block).toMatchObject({
      score: 60, passed: false, clinic_required: true,
    });
    expect(comparison.homeworks.find(item => item.homework_id === completionHomeworkId)!.block).toMatchObject({
      score: scenario.comparisonStudent.completionScore, passed: !completionPassed, clinic_required: completionPassed,
    });
    await assertNoHorizontalOverflow(page);
    const criteriaImage = test.info().outputPath(`homework-criteria-${width}-${threshold}.png`);
    await page.screenshot({ path: criteriaImage, animations: "disabled" });
    await test.info().attach(`homework-criteria-${width}-${threshold}`, { path: criteriaImage, contentType: "image/png" });

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
    await verifyFinalHomeworkPreview(page, scenario, width, { mode, threshold, score: 92, maxScore: 100, passed,
      numericBlock: row.homeworks.find(item => item.homework_id === homeworkId)!.block,
      completionBlock: row.homeworks.find(item => item.homework_id === completionHomeworkId)!.block,
      comparisonNumericBlock: comparison.homeworks.find(item => item.homework_id === homeworkId)!.block,
      comparisonCompletionBlock: comparison.homeworks.find(item => item.homework_id === completionHomeworkId)!.block,
    }, passLabel, failLabel);
  }
  // Leave the existing fixture's score and passing state intact for report/comment checks.
  await gotoAndSettle(page, scoresUrl);
}
