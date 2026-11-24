import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { SendPreflightResponse } from "@/app_admin/domains/messages/api/messages.api";
import { acknowledgeInitialAccountPromptsIfVisible } from "./firstLoginGuide";
import {
  assertNoHorizontalOverflow, installQaStudentParentBoundary, QA_BASE, seedBrowserAuth,
  type QaStudent, type QaTokens,
} from "./qaStudentParentScenario";
import { revealScoreManagement } from "./revealScoreManagement";
import { gotoAndSettle } from "./wait";

type NoticeScenario = {
  teacherTokens: QaTokens;
  studentTokens: QaTokens;
  student: QaStudent;
  control: QaStudent;
  homeworkId: number;
  homeworkTitle: string;
  lectureId: number;
  sessionId: number;
};

export async function verifyAcceptedHomeworkNotices(origin: Page, request: APIRequestContext, scenario: NoticeScenario) {
  const browser = origin.context().browser()!;
  const teacherContext = await browser.newContext({ serviceWorkers: "block" });
  const studentContext = await browser.newContext({ serviceWorkers: "block" });
  try {
    const teacher = await teacherContext.newPage();
    const student = await studentContext.newPage();
    const teacherBoundary = await installQaStudentParentBoundary(teacher, request);
    const studentBoundary = await installQaStudentParentBoundary(student, request);
    await seedBrowserAuth(teacher, scenario.teacherTokens);
    await seedBrowserAuth(student, scenario.studentTokens);
    const deliveryAttempts: string[] = [];
    await teacher.route(/\/messaging\/(?:send|manual-notification\/confirm)\/$/, route => {
      deliveryAttempts.push(new URL(route.request().url()).pathname);
      return route.abort("blockedbyclient");
    });

    for (const width of [1366, 390]) {
      await teacher.setViewportSize({ width, height: 900 });
      await student.setViewportSize({ width, height: 900 });
      const inboxPath = width === 390 ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
      await gotoAndSettle(teacher, `${QA_BASE}${inboxPath}?homework=${scenario.homeworkId}`);
      if (width === 1366) {
        await acknowledgeInitialAccountPromptsIfVisible(teacher);
        await teacher.getByLabel(`${scenario.student.name} 통과 대상 선택`, { exact: true }).check();
        await teacher.getByRole("button", { name: "선택 1명 통과", exact: true }).click();
        const saved = teacher.waitForResponse(res => res.request().method() === "PATCH"
          && new URL(res.url()).pathname.endsWith(`/homework/${scenario.homeworkId}/acceptance/`));
        await teacher.getByRole("alertdialog").getByRole("button", { name: "1명 통과 처리", exact: true }).click();
        expect(await (await saved).json()).toMatchObject({ teacher_accepted: true });
      }
      await teacher.reload({ waitUntil: "domcontentloaded" });
      await expect(teacher.getByText("통과 인정됨", { exact: true })).toBeVisible();
      const previewed = teacher.waitForResponse(res => res.request().method() === "POST"
        && new URL(res.url()).pathname.endsWith("/messaging/manual-notification/preview/"));
      await teacher.getByRole("button", { name: "미제출 알림 발송", exact: true }).click();
      const response = await previewed;
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON().context_source).toEqual({
        type: "assignment_not_submitted", homework_id: scenario.homeworkId,
      });
      const missing = await response.json() as { recipients: Array<{ student_id: number; full_message_body: string }> };
      expect(missing.recipients.map(row => row.student_id)).toEqual([scenario.control.id]);
      const inbox = teacher.getByRole("dialog").filter({ has: teacher.getByRole("radiogroup", { name: "미리보기 학생 선택" }) });
      await expect(inbox.getByRole("radio")).toHaveCount(1);
      await expect(inbox.getByRole("radio")).toContainText(scenario.control.name);
      await expect(inbox.locator(".kakao-alimtalk-preview__body")).toHaveText(missing.recipients[0].full_message_body);
      await expect(inbox.locator(".kakao-alimtalk-preview__body")).toContainText("미제출");
      await assertNoHorizontalOverflow(teacher);
      await teacher.screenshot({ path: test.info().outputPath(`homework-message-criteria-missing-${width}.png`) });
      await inbox.getByRole("button", { name: "취소", exact: true }).click();

      await gotoAndSettle(teacher, `${QA_BASE}/workspace/lectures/${scenario.lectureId}/sessions/${scenario.sessionId}/scores`);
      await revealScoreManagement(teacher);
      await teacher.getByRole("checkbox", { name: `${scenario.student.name} 선택`, exact: true }).check();
      await teacher.getByRole("button", { name: "수업결과 알림톡 발송", exact: true }).click();
      const composer = teacher.getByRole("dialog", { name: "알림톡 발송" });
      await composer.getByRole("checkbox", { name: "학부모", exact: true }).check();
      await composer.getByRole("checkbox", { name: "학생", exact: true }).uncheck();
      await composer.getByRole("textbox", { name: "안내문", exact: true }).fill("과제 확인 결과\n");
      const gradeResponse = teacher.waitForResponse(res => res.request().method() === "POST"
        && new URL(res.url()).pathname.endsWith("/messaging/send/preflight/")
        && res.request().postDataJSON().send_to === "parent"
        && res.request().postDataJSON().raw_body?.includes("#{과제1결과}"));
      await composer.getByRole("button", { name: `${scenario.homeworkTitle} 넣기`, exact: true }).click();
      const grade = await gradeResponse;
      expect(grade.status()).toBe(200);
      const renderedVars = grade.request().postDataJSON().alimtalk_extra_vars_per_student[scenario.student.id];
      expect(JSON.parse(renderedVars._homework_notice_states)).toEqual([[expect.any(Number), scenario.homeworkId, "accepted"]]);
      const preflight = await grade.json() as SendPreflightResponse;
      expect(preflight.blockers).toEqual([]);
      expect(preflight.preview_recipients.map(row => row.student_id)).toEqual([scenario.student.id]);
      const gradeBody = preflight.preview_recipients[0].full_message_body;
      expect(gradeBody).toContain(`${scenario.homeworkTitle}: 0/100 (0%) 통과 (교사 확인)`);
      expect(gradeBody).not.toContain("미제출");
      await expect(composer.getByLabel("현재 학생의 실제 발송 문구")).toContainText(gradeBody);
      await composer.getByRole("button", { name: "보낼 내용 확인", exact: true }).click();
      const finalPreview = teacher.getByRole("dialog", { name: "보내기 전 마지막 확인", exact: true });
      await expect(finalPreview.getByLabel("카카오톡 실제 발송 미리보기").locator(".kakao-alimtalk-preview__body")).toHaveText(gradeBody);
      await assertNoHorizontalOverflow(teacher);
      await teacher.screenshot({ path: test.info().outputPath(`homework-message-criteria-accepted-${width}.png`) });

      await gotoAndSettle(student, `${QA_BASE}/student/grades?view=homework&homework_status=all`);
      await student.reload({ waitUntil: "domcontentloaded" });
      const gradeCard = student.locator(".stu-panel[data-session-type]").filter({ has: student.getByText(scenario.homeworkTitle, { exact: true }) });
      await expect(gradeCard).toContainText("과제 통과 인정");
      await expect(gradeCard).toContainText("0/100");
      await assertNoHorizontalOverflow(student);
      await student.screenshot({ path: test.info().outputPath(`homework-criteria-student-accepted-${width}.png`) });
    }
    expect(deliveryAttempts).toEqual([]);
    teacherBoundary.assertClean();
    studentBoundary.assertClean();
  } finally {
    await Promise.all([teacherContext.close(), studentContext.close()]);
  }
}
