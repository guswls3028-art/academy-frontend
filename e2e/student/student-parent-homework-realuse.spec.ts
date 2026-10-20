/**
 * Student homework media submission -> assistant discovery/preview and UI grading
 * -> student/parent projection, reload and login.
 * The browser writes only to the guarded loopback development API.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page } from "@playwright/test";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import {
  api,
  assertNoHorizontalOverflow,
  assertQaStudentParentRuntime,
  cleanupQaFamily,
  createQaFamily,
  expectApi,
  installQaStudentParentBoundary,
  loginAdmin,
  loginApi,
  loginThroughUi,
  logoutStudentApp,
  QA_API,
  QA_BASE,
  QA_TENANT,
  reloadStudentApp,
  seedBrowserAuth,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
  type QaTokens,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

test.setTimeout(360_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type HomeworkSummary = {
  homework_id: number;
  title: string;
  score: number | null;
  passed: boolean;
  achievement: string;
  submission_state?: "needs_submission" | "awaiting_review" | "reviewed";
  lecture_active?: boolean;
  submission_media_locked?: boolean;
};

type CreatedState = {
  family: QaFamily | null;
  adminAccess: string;
  lectureId?: number;
  sessionId?: number;
  homeworkId?: number;
  completionHomeworkId?: number;
  staffId?: number;
  enrollmentId?: number;
  duplicateLectureId?: number;
  duplicateSessionId?: number;
  duplicateEnrollmentId?: number;
  duplicateHomeworkId?: number;
  sessionEnrollmentIds: number[];
};

const created: CreatedState = {
  family: null,
  adminAccess: "",
  sessionEnrollmentIds: [],
};
const runStamp = Date.now();
const todayKst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const lectureTitle = `QA 과제 projection ${runStamp}`;
const sessionTitle = `QA 과제 1차시 ${runStamp}`;
const homeworkTitle = `QA 과제 제출 채점 ${runStamp}`;
const completionTitle = `QA 준비물 통과형 ${runStamp}`;
const uploadName = `qa-homework-${runStamp}.png`;
const parentUploadName = `qa-parent-homework-${runStamp}.png`;
const parentHomeworkComment = "QA 과제 피드백: 풀이 과정을 꼼꼼히 기록했습니다.\n가정에서는 틀린 문제의 계산 순서를 소리 내어 설명하고, 스스로 채점한 뒤 다시 확인하는 연습을 도와주세요.";

async function verifyHomeworkFeedback(parentPage: Page, request: APIRequestContext, admin: QaTokens, studentName: string): Promise<void> {
  const context = await parentPage.context().browser()!.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  const editors = new Set<string>();
  try {
    const staffPage = await context.newPage();
    staffPage.on("request", outgoing => {
      const editor = outgoing.headers()["x-score-editor-client"];
      if (editor) editors.add(editor);
    });
    const boundary = await installQaStudentParentBoundary(staffPage, request);
    const guards = attachStrictBrowserGuards(staffPage);
    await seedBrowserAuth(staffPage, admin);
    await gotoAndSettle(staffPage, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`);
    await acknowledgeInitialAccountPromptsIfVisible(staffPage);
    const configPath = `/results/admin/sessions/${created.sessionId}/total-config/`;
    await staffPage.getByRole("button", { name: "과제 총점 합산 설정", exact: true }).click();
    const totals = staffPage.getByRole("dialog", { name: "합산 설정", exact: true });
    await totals.getByRole("button", { name: "과제 총점 위로 이동", exact: true }).click();
    await totals.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(totals).toBeHidden();
    expect((await expectApi<{ homework_ids: number[] }>(request, "GET", configPath, admin.access)).homework_ids).toEqual([]);
    await staffPage.reload();
    await staffPage.getByRole("button", { name: "과제 총점 합산 설정", exact: true }).click();
    await totals.getByRole("button", { name: "과제 총점 아래로 이동", exact: true }).click();
    await totals.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
    await expect(totals).toBeHidden();
    expect((await expectApi<{ homework_ids: number[] }>(request, "GET", configPath, admin.access)).homework_ids).toEqual([created.homeworkId]);

    const completion = await expectApi<{ id: number; grading_mode: string }>(request, "POST", "/homeworks/", admin.access, {
      session: created.sessionId, session_id: created.sessionId, title: completionTitle,
      grading_mode: "COMPLETION", max_score: 1,
    }, [201]);
    created.completionHomeworkId = completion.id;
    expect(completion.grading_mode).toBe("COMPLETION");
    await expectApi(request, "PUT", `/homework/assignments/?homework_id=${completion.id}`, admin.access,
      { enrollment_ids: [created.enrollmentId] }, [200]);
    const originalOrder = [created.homeworkId!, completion.id];
    const scoresPath = `/results/admin/sessions/${created.sessionId}/scores/`;
    const verifyMixed = async (order: number[], selected: number[], completionScore: number) => {
      const included = new Set(selected);
      const rendered = [...order.filter(id => included.has(id)), ...order.filter(id => !included.has(id))];
      await expect.poll(() => staffPage.locator('[data-testid^="score-column-order-homework-"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-column-id"))))).toEqual(rendered);
      const config = await expectApi<{ homework_ids: number[]; homework_order: number[] }>(request, "GET", configPath, admin.access);
      expect(config.homework_ids).toEqual(selected);
      expect(config.homework_order).toEqual(order);
      const scores = await expectApi<{ meta: { homeworks: Array<{ homework_id: number; grading_mode: string }> }; rows: Array<{ enrollment_id: number; homeworks: Array<{ homework_id: number; block: { score: number | null } }>; homework_total: { score: number | null; max_score: number } }> }>(request, "GET", scoresPath, admin.access);
      expect(scores.meta.homeworks.map(item => item.homework_id)).toEqual(order);
      expect(scores.meta.homeworks.find(item => item.homework_id === completion.id)?.grading_mode).toBe("COMPLETION");
      const row = scores.rows.find(item => item.enrollment_id === created.enrollmentId)!;
      expect(row.homeworks.find(item => item.homework_id === completion.id)?.block.score).toBe(completionScore);
      if (selected.length) expect(row.homework_total).toMatchObject({ score: 92, max_score: 100 });
    };
    for (const width of [1366, 390]) {
      await staffPage.setViewportSize({ width, height: 900 });
      await staffPage.reload();
      const cell = staffPage.locator(`[data-score-cell="homework:${created.enrollmentId}:${completion.id}"]`);
      await expect(cell).toBeVisible();
      const edit = staffPage.getByRole("button", { name: "수정", exact: true });
      if (await edit.isVisible()) await edit.click();
      const state = cell.getByRole("combobox", { name: `${studentName} · ${completionTitle} 완료 상태`, exact: true });
      await state.selectOption(width === 1366 ? "통과" : "미통과");
      const scored = staffPage.waitForResponse(response => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === "/api/v1/homework/scores/quick/"
        && response.request().postDataJSON()?.homework_id === completion.id);
      await staffPage.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
      const scoreResponse = await scored;
      expect(scoreResponse.status()).toBe(200);
      expect(await scoreResponse.json()).toMatchObject({ score: width === 1366 ? 1 : 0 });
      await expect(edit).toBeVisible();
      await staffPage.reload();
      await verifyMixed(originalOrder, [created.homeworkId!], width === 1366 ? 1 : 0);
      // Put both items after the total, reorder there, and prove completion never enters the sum.
      await staffPage.getByRole("button", { name: "과제 총점 합산 설정", exact: true }).click();
      await totals.getByRole("button", { name: "과제 총점 위로 이동", exact: true }).click();
      await totals.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
      await expect(totals).toBeHidden();
      const moved = staffPage.waitForResponse(response => response.request().method() === "PUT"
        && new URL(response.url()).pathname === `/api/v1${configPath}`);
      if (width === 1366) {
        await staffPage.locator(".scores-col-drag-handle").filter({ has: staffPage.getByRole("button", { name: `${completionTitle} 작업 선택`, exact: true }) }).dragTo(staffPage.locator(".scores-col-drag-handle").filter({ has: staffPage.getByRole("button", { name: `${homeworkTitle} 작업 선택`, exact: true }) }));
      } else await staffPage.getByRole("button", { name: `${completionTitle} 이전 순서로 이동`, exact: true }).click();
      expect((await moved).status()).toBe(200);
      await staffPage.reload();
      await verifyMixed([completion.id, created.homeworkId!], [], width === 1366 ? 1 : 0);
      // Restore scoring while preserving the completion item's stored position.
      await staffPage.getByRole("button", { name: "과제 총점 합산 설정", exact: true }).click();
      await totals.getByRole("button", { name: "과제 총점 아래로 이동", exact: true }).click();
      await totals.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
      await expect(totals).toBeHidden();
      await staffPage.reload();
      await verifyMixed([completion.id, created.homeworkId!], [created.homeworkId!], width === 1366 ? 1 : 0);
      await staffPage.locator(`[data-score-cell="homework:${created.enrollmentId}:${completion.id}"]`).scrollIntoViewIfNeeded();
      await staffPage.screenshot({ path: test.info().outputPath(`real-mixed-homework-${width}.png`), animations: "disabled" });
      await staffPage.getByRole("button", { name: "개인 성적표", exact: true }).click();
      const report = staffPage.getByRole("dialog");
      await report.getByRole("combobox", { name: "성적표 학생 선택" }).selectOption(String(created.enrollmentId));
      const preview = staffPage.frameLocator(`iframe[title="${studentName} 개인 성적표 미리보기"]`);
      const completionResult = preview.locator(".assessment-row").filter({ has: preview.getByText(completionTitle, { exact: true }) });
      await expect(completionResult.locator(".assessment-score")).toHaveText(width === 1366 ? "통과 (O)" : "미통과 (X)");
      await expect(preview.locator(".session-fact").filter({ hasText: "과제 총점" })).toHaveText("과제 총점92 / 100");
      await expect(preview.locator(".session-fact").filter({ hasText: "과제 평균" })).toHaveText("과제 평균92%");
      await completionResult.scrollIntoViewIfNeeded();
      await staffPage.screenshot({ path: test.info().outputPath(`real-homework-report-${width}.png`), animations: "disabled" });
      await report.getByRole("button", { name: "닫기", exact: true }).click();
      await expect(report).toBeHidden();
      // Restore exact order via the same excluded-area UI before existing comment checks.
      await staffPage.getByRole("button", { name: "과제 총점 합산 설정", exact: true }).click();
      await totals.getByRole("button", { name: "과제 총점 위로 이동", exact: true }).click();
      await totals.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
      await expect(totals).toBeHidden();
      const restored = staffPage.waitForResponse(response => response.request().method() === "PUT"
        && new URL(response.url()).pathname === `/api/v1${configPath}`);
      if (width === 1366) {
        await staffPage.locator(".scores-col-drag-handle").filter({ has: staffPage.getByRole("button", { name: `${homeworkTitle} 작업 선택`, exact: true }) }).dragTo(staffPage.locator(".scores-col-drag-handle").filter({ has: staffPage.getByRole("button", { name: `${completionTitle} 작업 선택`, exact: true }) }));
      } else await staffPage.getByRole("button", { name: `${homeworkTitle} 이전 순서로 이동`, exact: true }).click();
      expect((await restored).status()).toBe(200);
      await staffPage.reload();
      await staffPage.getByRole("button", { name: "과제 총점 합산 설정", exact: true }).click();
      await totals.getByRole("button", { name: "과제 총점 아래로 이동", exact: true }).click();
      await totals.getByRole("button", { name: "합산 설정 저장", exact: true }).click();
      await expect(totals).toBeHidden();
      await verifyMixed(originalOrder, [created.homeworkId!], width === 1366 ? 1 : 0);

      await staffPage.getByRole("button", { name: `${homeworkTitle} 작업 선택`, exact: true }).click();
      await staffPage.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
      const comment = staffPage.getByRole("dialog", { name: "학부모 코멘트", exact: true });
      const text = `${parentHomeworkComment}\n${width}px 확인`;
      await comment.getByLabel(studentName, { exact: true }).fill(text);
      await comment.getByRole("button", { name: "학부모에게 공개", exact: true }).click();
      await expect(comment.getByRole("status")).toContainText("학부모에게 공개했습니다.");
      await staffPage.reload();
      await staffPage.getByRole("button", { name: `${homeworkTitle} 작업 선택`, exact: true }).click();
      await staffPage.getByRole("menuitem", { name: /학부모 코멘트/ }).click();
      await expect(comment.getByLabel(studentName, { exact: true })).toHaveValue(text);
      await assertNoHorizontalOverflow(staffPage);
      await staffPage.reload();

      await parentPage.setViewportSize({ width, height: 900 });
      await reloadStudentApp(parentPage);
      await parentPage.getByRole("button", { name: "과제 현황" }).click();
      await expect(parentPage.locator('aside[aria-label="학부모 코멘트"]')).toHaveCount(1);
      await expect(parentPage.locator('aside[aria-label="학부모 코멘트"]')).toContainText(text);
      await parentPage.locator("summary").filter({ hasText: "차시별 총점" }).click();
      const total = parentPage.getByRole("region", { name: `${lectureTitle} ${sessionTitle} 총점`, exact: true });
      await expect(total).toContainText("과제 총점");
      await expect(total).toContainText("92 / 100");
      const completionCard = parentPage.locator('.stu-panel[data-session-type]').filter({ has: parentPage.getByText(completionTitle, { exact: true }) });
      await expect(completionCard).toContainText("통과형 과제");
      await expect(completionCard.locator("strong")).toHaveText(width === 1366 ? "통과" : "미통과");
      await assertNoHorizontalOverflow(parentPage);
    }
    // Keep later existing single-score-card/average assertions unchanged.
    await expectApi(request, "DELETE", `/homeworks/${completion.id}/`, admin.access, undefined, [204]);
    expect((await api(request, "GET", `/homeworks/${completion.id}/`, admin.access)).status).toBe(404);
    boundary.assertClean(); guards.assertZeroDefects();
  } finally {
    try {
      for (const editor of editors) {
        const released = await request.post(`${QA_API}/api/v1/results/admin/sessions/${created.sessionId}/score-draft/commit/`, {
          headers: { Authorization: `Bearer ${admin.access}`, "X-Tenant-Code": QA_TENANT, "X-Score-Editor-Client": editor },
          data: { release_lease: true }, timeout: 60_000,
        });
        expect([200, 204]).toContain(released.status());
      }
    } finally {
      await context.close();
      await parentPage.setViewportSize({ width: 390, height: 844 });
    }
  }
}

async function waitForHomeworkSummary(
  request: APIRequestContext,
  token: string,
  predicate: (row: HomeworkSummary) => boolean,
  selectedStudentId?: number,
): Promise<HomeworkSummary> {
  let latest: HomeworkSummary | undefined;
  await waitForCondition(async () => {
    const response = await request.get(`${QA_API}/api/v1/student/grades/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-Code": QA_TENANT,
        ...(selectedStudentId ? { "X-Student-Id": String(selectedStudentId) } : {}),
      },
      timeout: 60_000,
    });
    if (response.status() !== 200) return false;
    const body = await response.json() as { homeworks?: HomeworkSummary[] };
    latest = (body.homeworks ?? []).find((row) => row.homework_id === created.homeworkId);
    return Boolean(latest && predicate(latest));
  }, { timeoutMs: 45_000, intervalMs: 750, description: "student/parent homework summary" });
  if (!latest) throw new Error("homework projection never became authoritative");
  return latest;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.adminAccess) return;
  const failures: string[] = [];
  const remove = async (method: string, path: string, accepted = [200, 202, 204, 404]) => {
    try {
      const result = await api(request, method, path, created.adminAccess);
      if (!accepted.includes(result.status)) failures.push(`${method} ${path} -> ${result.status}`);
    } catch (error) {
      failures.push(`${method} ${path} -> ${String(error)}`);
    }
  };
  if (created.completionHomeworkId) await remove("DELETE", `/homeworks/${created.completionHomeworkId}/`);
  if (created.homeworkId) await remove("DELETE", `/homeworks/${created.homeworkId}/`);
  if (created.duplicateHomeworkId) await remove("DELETE", `/homeworks/${created.duplicateHomeworkId}/`);
  for (const id of created.sessionEnrollmentIds) {
    await remove("DELETE", `/enrollments/session-enrollments/${id}/`);
  }
  if (created.enrollmentId) await remove("DELETE", `/enrollments/${created.enrollmentId}/`);
  if (created.duplicateEnrollmentId) await remove("DELETE", `/enrollments/${created.duplicateEnrollmentId}/`);
  if (created.sessionId) await remove("DELETE", `/lectures/sessions/${created.sessionId}/`);
  if (created.duplicateSessionId) await remove("DELETE", `/lectures/sessions/${created.duplicateSessionId}/`);
  if (created.lectureId) await remove("DELETE", `/lectures/lectures/${created.lectureId}/`);
  if (created.duplicateLectureId) await remove("DELETE", `/lectures/lectures/${created.duplicateLectureId}/`);
  if (created.staffId) await remove("DELETE", `/staffs/${created.staffId}/`);
  // Staff deletion deactivates membership; the exact qa-* tenant teardown owns
  // the remaining synthetic User/token/audit cleanup and its zero-residue proof.
  await cleanupQaFamily(request, created.adminAccess, created.family);
  for (const [label, path] of [
    ...(created.completionHomeworkId ? [["completion homework", `/homeworks/${created.completionHomeworkId}/`] as const] : []),
    ...(created.homeworkId ? [[`homework ${created.homeworkId}`, `/homeworks/${created.homeworkId}/`] as const] : []),
    ...(created.sessionId ? [[`session ${created.sessionId}`, `/lectures/sessions/${created.sessionId}/`] as const] : []),
    ...(created.lectureId ? [[`lecture ${created.lectureId}`, `/lectures/lectures/${created.lectureId}/`] as const] : []),
    ...(created.duplicateHomeworkId ? [["duplicate homework", `/homeworks/${created.duplicateHomeworkId}/`] as const] : []),
    ...(created.duplicateSessionId ? [["duplicate session", `/lectures/sessions/${created.duplicateSessionId}/`] as const] : []),
    ...(created.duplicateLectureId ? [["duplicate lecture", `/lectures/lectures/${created.duplicateLectureId}/`] as const] : []),
    ...(created.staffId ? [[`staff ${created.staffId}`, `/staffs/${created.staffId}/`] as const] : []),
  ]) {
    const residue = await api(request, "GET", path, created.adminAccess);
    if (residue.status !== 404) failures.push(`verify ${label} absent -> ${residue.status}`);
  }
  if (failures.length) throw new Error(`student/parent homework cleanup failed:\n${failures.join("\n")}`);
}

async function seedHomework(request: APIRequestContext, adminAccess: string, family: QaFamily): Promise<void> {
  const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", adminAccess, {
    title: lectureTitle,
    name: "QA과제",
    subject: "수학",
    description: "qa-* student submit and parent homework projection",
    start_date: todayKst,
    lecture_time: "금 19:00 ~ 21:00",
    color: "#7c3aed",
    chip_label: "과제",
    is_active: true,
  });
  created.lectureId = Number(lecture.id);
  const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", adminAccess, {
    lecture: created.lectureId,
    title: sessionTitle,
    date: todayKst,
    order: 1,
  });
  created.sessionId = Number(session.id);
  const enrollments = await expectApi<Array<{ id: number }>>(
    request,
    "POST",
    "/enrollments/bulk_create/",
    adminAccess,
    { lecture: created.lectureId, students: [family.students[0].id] },
  );
  created.enrollmentId = Number(enrollments[0].id);
  const sessionEnrollments = await expectApi<Array<{ id: number }>>(
    request,
    "POST",
    "/enrollments/session-enrollments/bulk_create/",
    adminAccess,
    { session: created.sessionId, enrollments: [created.enrollmentId] },
  );
  created.sessionEnrollmentIds = sessionEnrollments.map((row) => Number(row.id));
  const homework = await expectApi<{ id: number }>(request, "POST", "/homeworks/", adminAccess, {
    session_id: created.sessionId,
    session: created.sessionId,
    title: homeworkTitle,
  });
  created.homeworkId = Number(homework.id);
  await expectApi(
    request,
    "PUT",
    `/homework/assignments/?homework_id=${created.homeworkId}`,
    adminAccess,
    { enrollment_ids: [created.enrollmentId] },
    [200],
  );
}

async function seedSameTitleLecture(request: APIRequestContext): Promise<void> {
  const token = created.adminAccess;
  const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", token, {
    title: lectureTitle.replace("QA ", "QA  "), name: "QA동명강좌", subject: "수학", start_date: todayKst, is_active: true,
  });
  created.duplicateLectureId = lecture.id;
  const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", token, {
    lecture: lecture.id, title: `QA 동명 강좌 차시 ${runStamp}`, date: todayKst, order: 1,
  });
  created.duplicateSessionId = session.id;
  const enrollments = await expectApi<Array<{ id: number }>>(request, "POST", "/enrollments/bulk_create/", token, {
    lecture: lecture.id, students: [created.family!.students[0].id],
  });
  created.duplicateEnrollmentId = enrollments[0].id;
  const sessionEnrollments = await expectApi<Array<{ id: number }>>(request, "POST", "/enrollments/session-enrollments/bulk_create/", token, {
    session: session.id, enrollments: [created.duplicateEnrollmentId],
  });
  created.sessionEnrollmentIds.push(...sessionEnrollments.map((row) => row.id));
  const homework = await expectApi<{ id: number }>(request, "POST", "/homeworks/", token, {
    session: session.id, session_id: session.id, title: `QA 동명 강좌 과제 ${runStamp}`,
  });
  created.duplicateHomeworkId = homework.id;
  await expectApi(request, "PUT", `/homework/assignments/?homework_id=${homework.id}`, token, {
    enrollment_ids: [created.duplicateEnrollmentId],
  }, [200]);
}

async function assertSeparateHomeworkGroups(page: Page): Promise<void> {
  await expect(page.getByText(lectureTitle, { exact: true })).toHaveCount(2);
  await expect(page.getByText("1건 · 평균 득점률 92%", { exact: true })).toBeVisible();
  await expect(page.getByText(`QA 동명 강좌 과제 ${runStamp}`, { exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
}

type HomeworkGradingPhase = "navigation" | "options" | "editing" | "save" | "reload";

async function emitHomeworkGradingState(page: Page, phase: HomeworkGradingPhase, failed: boolean, cellSelector: string, documentTimeOrigin: number | null) {
  const state = await page.evaluate(({ selector, initialDocument }) => {
    const visible = (element: Element | null) => Boolean(element?.getClientRects().length);
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")];
    const options = buttons.filter((button) => button.textContent?.trim().startsWith("표시 옵션"));
    const option = options[0] ?? null;
    const rect = option?.getBoundingClientRect();
    const hit = rect ? document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) : null;
    const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(visible);
    const hasDialog = (label: string) => dialogs.some((dialog) => dialog.textContent?.includes(label));
    const cell = document.querySelector(selector);
    return {
      route: /\/sessions\/\d+\/scores\/?$/.test(location.pathname) ? "scores"
        : location.pathname.includes("/login") ? "login"
          : location.pathname.includes("/workspace/mobile") ? "mobile" : "other",
      viewport: window.innerWidth === 390 ? "390" : window.innerWidth === 1366 ? "1366" : "other",
      documentChanged: initialDocument !== null && performance.timeOrigin !== initialDocument,
      optionsCount: Math.min(options.length, 2), optionsVisible: visible(option),
      optionsEnabled: option !== null && !option.disabled,
      optionsExpanded: option?.getAttribute("aria-expanded") === "true",
      optionsInsideViewport: Boolean(rect && rect.x >= 0 && rect.y >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight),
      optionsCenterHitsControl: Boolean(option && hit && (hit === option || option.contains(hit))),
      dialogVisible: dialogs.length > 0,
      accountGuideVisible: hasDialog("계정 안내"), passwordRecommendationVisible: hasDialog("비밀번호 변경 권장"),
      scoreHelpVisible: hasDialog("성적표 보기 안내") || hasDialog("빠른 성적 입력 안내"),
      recoveryDialogVisible: dialogs.some((dialog) => /복구|이전 입력/.test(dialog.textContent ?? "")),
      editButtonVisible: buttons.some((button) => button.textContent?.trim() === "수정" && visible(button)),
      saveAndLockVisible: buttons.some((button) => button.textContent?.trim() === "저장하고 잠금" && visible(button)),
      targetCellVisible: visible(cell), targetInputVisible: visible(cell?.querySelector("input") ?? null),
    };
  }, { selector: cellSelector, initialDocument: documentTimeOrigin }).catch(() => ({ stateUnavailable: true }));
  // Fixed categories and UI booleans only: no DOM, labels, identities, URLs, or API bodies.
  console.info(JSON.stringify({ releaseHomeworkGradingState: { schema: "homework-grading-ui/v1", phase, failed, ...state } }));
}

async function gradeHomework(
  page: Page, request: APIRequestContext, username: string, password: string, staffAccess: string,
): Promise<void> {
  const context = await page.context().browser()!.newContext({ serviceWorkers: "block" });
  const staffPage = await context.newPage();
  const boundary = await installQaStudentParentBoundary(staffPage, request);
  const browser = attachStrictBrowserGuards(staffPage);
  const editors = new Set<string>();
  const cellSelector = `[data-score-cell="homework:${created.enrollmentId}:${created.homeworkId}"]`;
  let gradingPhase: HomeworkGradingPhase = "navigation";
  let documentTimeOrigin: number | null = null;
  staffPage.on("request", (outgoing) => {
    const editor = outgoing.headers()["x-score-editor-client"];
    if (editor) editors.add(editor);
  });
  try {
    await gotoAndSettle(staffPage, `${QA_BASE}/login/${QA_TENANT}`);
    await staffPage.getByTestId("login-username").fill(username);
    await staffPage.getByTestId("login-password").fill(password);
    await staffPage.getByTestId("login-submit").click();
    await expect(staffPage).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await acknowledgeInitialAccountPromptsIfVisible(staffPage);
    const clockInChoice = staffPage.getByRole("dialog", {
      name: "오늘 어떤 방식으로 시작할까요?", exact: true,
    });
    await expect(clockInChoice).toBeVisible();
    await clockInChoice.getByRole("button", { name: /^출근하지 않고 로그인/ }).click();
    await expect(clockInChoice).toBeHidden();
    for (const [width, value, previousScore] of [[390, 91, null], [1366, 92, 91]] as const) {
      gradingPhase = "navigation";
      await staffPage.setViewportSize({ width, height: 900 });
      await gotoAndSettle(staffPage, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`);
      documentTimeOrigin = await staffPage.evaluate(() => performance.timeOrigin);
      gradingPhase = "options";
      await emitHomeworkGradingState(staffPage, gradingPhase, false, cellSelector, documentTimeOrigin);
      const options = staffPage.getByRole("button", { name: /표시 옵션/ });
      if (await options.getAttribute("aria-expanded") === "false") await options.click();
      gradingPhase = "editing";
      const cell = staffPage.locator(cellSelector);
      if (previousScore !== null) {
        await expect(cell).toContainText(String(previousScore));
        await staffPage.getByRole("button", { name: "수정", exact: true }).click();
      }
      // A blank score sheet starts editing asynchronously; wait for its input
      // instead of choosing a button from an intermediate loading state.
      await expect(cell.getByRole("textbox")).toBeVisible();
      await cell.getByRole("textbox").fill(String(value));
      gradingPhase = "save";
      const saved = staffPage.waitForResponse((response) => (
        response.request().method() === "PATCH"
        && new URL(response.url()).pathname === "/api/v1/homework/scores/quick/"
      ));
      await staffPage.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
      const response = await saved;
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ score: value, passed: true });
      await expect(staffPage.getByRole("button", { name: "수정", exact: true })).toBeVisible();
      gradingPhase = "reload";
      await staffPage.reload({ waitUntil: "domcontentloaded" });
      await expect(cell).toContainText(String(value));
      await assertNoHorizontalOverflow(staffPage);
      await test.info().attach(`assistant-homework-grading-${width}`, {
        body: await staffPage.screenshot({ fullPage: true }), contentType: "image/png",
      });
    }
    await gotoAndSettle(staffPage, `${QA_BASE}/workspace/mobile/homeworks/${created.homeworkId}`);
    await expect(staffPage.getByText("점수 입력 완료", { exact: true })).toBeVisible();
    await staffPage.getByRole("button", { name: "제출물 확인" }).click();
    const scoredSheet = staffPage.getByRole("dialog").filter({ hasText: "점수가 입력되어 성적 화면에서 결과를 관리합니다." });
    await expect(scoredSheet).toBeVisible();
    await expect(scoredSheet.getByRole("button", { name: "확인 완료 취소" })).toHaveCount(0);
    await scoredSheet.getByRole("button", { name: "닫기" }).click();
    boundary.assertClean();
    browser.assertZeroDefects();
  } catch (error) {
    await emitHomeworkGradingState(staffPage, gradingPhase, true, cellSelector, documentTimeOrigin);
    throw error;
  } finally {
    try {
      for (const editor of editors) {
        const released = await request.post(`${QA_API}/api/v1/results/admin/sessions/${created.sessionId}/score-draft/commit/`, {
          headers: { Authorization: `Bearer ${staffAccess}`, "X-Tenant-Code": QA_TENANT, "X-Score-Editor-Client": editor },
          data: { release_lease: true }, timeout: 60_000,
        });
        expect([200, 204]).toContain(released.status());
      }
    } finally {
      await context.close();
    }
  }
}

test.describe.serial("[real-use] 학생과 학부모의 과제 제출", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  test.beforeAll(() => {
    assertQaStudentParentRuntime();
  });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("390px 학생·학부모 파일 제출, 직접 확인·취소, 채점·reload/relogin·desktop을 완료한다", async ({ page, request }, testInfo) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    created.adminAccess = admin.access;
    created.family = await createQaFamily(request, admin.access, "homework", 1);
    const student = created.family.students[0];
    await seedHomework(request, admin.access, created.family);

    const studentTokens = await loginApi(request, student.ps_number, student.password);
    await waitForHomeworkSummary(
      request,
      studentTokens.access,
      (row) => row.achievement === "NOT_SUBMITTED" && row.passed === false,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await loginThroughUi(page, student.ps_number, student.password);
    await gotoAndSettle(page, `${QA_BASE}/student/dashboard`, { timeout: 30_000 });
    const todo = page.locator("[data-guide='dash-todo']");
    await expect(todo.getByText(homeworkTitle, { exact: true })).toBeVisible();
    await gotoAndSettle(page, `${QA_BASE}/student/submit/assignment`, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "과제 제출" })).toBeVisible();
    await page.getByText(homeworkTitle, { exact: true }).click();
    await page.locator("input[type='file']").first().setInputFiles({
      name: uploadName,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.getByText(uploadName, { exact: true })).toBeVisible();
    const staffUsername = `qa-homework-assistant-${runStamp}`;
    const staff = await expectApi<{ id: number }>(request, "POST", "/staffs/", admin.access, {
      name: `QA 숙제 조교 ${runStamp}`,
      role: "ASSISTANT",
      username: staffUsername,
      password: student.password,
      is_manager: false,
    }, [201]);
    created.staffId = Number(staff.id);
    const staffTokens = await loginApi(request, staffUsername, student.password);
    const staffIdentity = await expectApi<{ tenantRole: string; first_login_guide_required: boolean }>(request, "GET", "/core/me/", staffTokens.access);
    expect(staffIdentity.tenantRole).toBe("staff");
    expect(staffIdentity.first_login_guide_required).toBe(true);
    const staffContext = await page.context().browser()!.newContext({
      viewport: { width: 390, height: 844 }, serviceWorkers: "block",
    });
    try {
      const staffPage = await staffContext.newPage();
      const staffBoundary = await installQaStudentParentBoundary(staffPage, request);
      const staffBrowser = attachStrictBrowserGuards(staffPage);
      await seedBrowserAuth(staffPage, staffTokens);
      await gotoAndSettle(staffPage, `${QA_BASE}/workspace/mobile/homeworks/${created.homeworkId}`, { timeout: 30_000 });
      await expect(staffPage.getByRole("heading", { name: homeworkTitle, exact: true })).toBeVisible();
      // Newly created assistants must complete the real first-login UI before
      // interacting with the detail rendered underneath its modal.
      await acknowledgeInitialAccountPromptsIfVisible(staffPage);
      const acknowledgedIdentity = await expectApi<{ first_login_guide_required: boolean }>(request, "GET", "/core/me/", staffTokens.access);
      expect(acknowledgedIdentity.first_login_guide_required).toBe(false);
      const fileRow = staffPage.locator('[class*="fileRow"]').filter({ hasText: uploadName });
      await expect(fileRow).toHaveCount(0);
      await page.getByRole("button", { name: "파일 1개 제출하기" }).click();
      await expect(page.getByText("선택한 파일을 모두 제출했습니다.")).toBeVisible({ timeout: 45_000 });
      await waitForHomeworkSummary(
        request,
        studentTokens.access,
        (row) => row.submission_state === "awaiting_review" && row.score === null,
      );
      await gotoAndSettle(page, `${QA_BASE}/student/dashboard`, { timeout: 30_000 });
      await expect(todo.getByText(homeworkTitle, { exact: true })).toHaveCount(0);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(todo.getByText(homeworkTitle, { exact: true })).toHaveCount(0);
      await assertNoHorizontalOverflow(page);
      // Keep the assistant detail open: discovery must not depend on navigation
      // or manual reload after the student's successful submission.
      await expect(fileRow).toBeVisible({ timeout: 30_000 });
      await staffPage.getByRole("button", { name: "제출물 확인" }).click();
      const preview = staffPage.getByRole("dialog", { name: `${student.name} 제출 확인` });
      const image = preview.getByRole("img", { name: /과제 제출 미리보기/ });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(preview.getByRole("button", { name: "직접 확인 완료" })).toBeEnabled();
      const completed = staffPage.waitForResponse((response) => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/v1/results/admin/sessions/${created.sessionId}/score-correction/`);
      await preview.getByRole("button", { name: "직접 확인 완료" }).click();
      await staffPage.getByRole("alertdialog").getByRole("button", { name: "확인 완료", exact: true }).click();
      expect((await completed).status()).toBe(200);
      await expect(staffPage.getByText("확인 완료", { exact: true })).toBeVisible();
      const completedRows = await expectApi<Array<{ enrollment_id: number; teacher_reviewed: boolean; teacher_review_source: string | null }>>(
        request, "GET", `/submissions/submissions/homework/${created.homeworkId}/`, staffTokens.access,
      );
      expect(completedRows).toEqual(expect.arrayContaining([expect.objectContaining({
        enrollment_id: created.enrollmentId, teacher_reviewed: true, teacher_review_source: "manual",
      })]));
      await waitForHomeworkSummary(request, studentTokens.access, (row) => row.score === null && row.submission_media_locked === true);
      await staffPage.reload({ waitUntil: "domcontentloaded" });
      await expect(fileRow).toBeVisible();
      await expect(staffPage.getByText("확인 완료", { exact: true })).toBeVisible();
      await staffPage.getByRole("button", { name: "제출물 확인" }).click();
      const reviewedSheet = staffPage.getByRole("dialog", { name: `${student.name} 제출 확인` });
      const cancelled = staffPage.waitForResponse((response) => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/v1/results/admin/sessions/${created.sessionId}/score-correction/`);
      await reviewedSheet.getByRole("button", { name: "확인 완료 취소" }).click();
      await staffPage.getByRole("alertdialog").getByRole("button", { name: "확인 취소" }).click();
      expect((await cancelled).status()).toBe(200);
      await expect(staffPage.getByText("확인 대기", { exact: true })).toBeVisible();
      await staffPage.reload({ waitUntil: "domcontentloaded" });
      await expect(staffPage.getByText("확인 대기", { exact: true })).toBeVisible();
      const cancelledRows = await expectApi<Array<{ enrollment_id: number; teacher_reviewed: boolean; teacher_review_source: string | null }>>(
        request, "GET", `/submissions/submissions/homework/${created.homeworkId}/`, staffTokens.access,
      );
      expect(cancelledRows).toEqual(expect.arrayContaining([expect.objectContaining({
        enrollment_id: created.enrollmentId, teacher_reviewed: false, teacher_review_source: null,
      })]));
      await waitForHomeworkSummary(request, studentTokens.access, (row) => row.submission_state === "awaiting_review"
        && row.score === null && row.submission_media_locked === false);
      await expect(staffPage.getByRole("dialog", { name: "계정 안내" })).toBeHidden();
      await assertNoHorizontalOverflow(staffPage);
      await testInfo.attach("assistant-homework-submission-390", {
        body: await staffPage.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await staffPage.setViewportSize({ width: 1366, height: 900 });
      await expect(fileRow).toBeVisible();
      await assertNoHorizontalOverflow(staffPage);
      await testInfo.attach("assistant-homework-submission-1366", {
        body: await staffPage.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await gotoAndSettle(staffPage, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/assignments?assessment=homework%3A${created.homeworkId}`, { timeout: 30_000 });
      await staffPage.getByRole("tab", { name: "제출관리", exact: true }).click();
      await expect(staffPage.getByRole("heading", { name: "과제 제출 검수" })).toBeVisible();
      const pcComplete = staffPage.getByRole("button", { name: "직접 확인 완료" });
      await expect(pcComplete).toBeDisabled();
      await staffPage.locator('[class*="fileRow"]').filter({ hasText: uploadName }).getByRole("button", { name: "미리보기" }).click();
      const pcPreview = staffPage.getByRole("dialog").filter({ hasText: uploadName });
      const pcImage = pcPreview.getByRole("img", { name: /과제 제출 미리보기/ });
      await expect.poll(() => pcImage.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await pcPreview.getByRole("button", { name: "닫기" }).click();
      await expect(pcComplete).toBeEnabled();
      const stalePcReview = await api(request, "PATCH", `/results/admin/sessions/${created.sessionId}/score-correction/`, staffTokens.access, {
        enrollment_id: created.enrollmentId, source_type: "homework", source_id: created.homeworkId,
        completed: true, note: "QA 오래된 파일 묶음 확인", expected_media_set_fingerprint: "0".repeat(64),
      });
      expect(stalePcReview.status).toBe(409);
      expect(stalePcReview.body).toMatchObject({ code: "HOMEWORK_MEDIA_CHANGED" });
      await waitForHomeworkSummary(request, studentTokens.access, (row) => row.score === null && row.submission_media_locked === false);
      const pcSaved = staffPage.waitForResponse((response) => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/v1/results/admin/sessions/${created.sessionId}/score-correction/`);
      await pcComplete.click();
      await staffPage.getByRole("alertdialog").getByRole("button", { name: "확인 완료", exact: true }).click();
      const pcSavedResponse = await pcSaved;
      expect(pcSavedResponse.status()).toBe(200);
      expect(pcSavedResponse.request().postDataJSON()).toMatchObject({
        completed: true, expected_media_set_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      await expect(staffPage.getByRole("button", { name: "확인 완료 취소" })).toBeEnabled();
      await waitForHomeworkSummary(request, studentTokens.access, (row) => row.score === null && row.submission_media_locked === true);
      await staffPage.reload({ waitUntil: "domcontentloaded" });
      await staffPage.getByRole("tab", { name: "제출관리", exact: true }).click();
      await expect(staffPage.getByRole("button", { name: "확인 완료 취소" })).toBeEnabled();
      await assertNoHorizontalOverflow(staffPage);
      await testInfo.attach("assistant-homework-pc-review-1366", {
        body: await staffPage.screenshot({ fullPage: true }), contentType: "image/png",
      });
      await staffPage.setViewportSize({ width: 390, height: 844 });
      await assertNoHorizontalOverflow(staffPage);
      await testInfo.attach("assistant-homework-pc-review-390", {
        body: await staffPage.screenshot({ fullPage: true }), contentType: "image/png",
      });
      const pcCancelled = staffPage.waitForResponse((response) => response.request().method() === "PATCH"
        && new URL(response.url()).pathname === `/api/v1/results/admin/sessions/${created.sessionId}/score-correction/`);
      await staffPage.getByRole("button", { name: "확인 완료 취소" }).click();
      await staffPage.getByRole("alertdialog").getByRole("button", { name: "확인 취소", exact: true }).click();
      expect((await pcCancelled).status()).toBe(200);
      await waitForHomeworkSummary(request, studentTokens.access, (row) => row.score === null && row.submission_media_locked === false);
      await staffPage.reload({ waitUntil: "domcontentloaded" });
      await staffPage.getByRole("tab", { name: "제출관리", exact: true }).click();
      await expect(staffPage.getByRole("button", { name: "직접 확인 완료" })).toBeDisabled();
      staffBoundary.assertClean();
      staffBrowser.assertZeroDefects();
    } finally {
      await staffContext.close();
    }
    await expectApi<{ files: Array<{ original_filename: string }> }>(
      request,
      "GET",
      `/submissions/submissions/homework/${created.homeworkId}/media/?enrollment_id=${created.enrollmentId}`,
      studentTokens.access,
    ).then((media) => {
      expect(media.files).toContainEqual(expect.objectContaining({ original_filename: uploadName }));
    });

    await logoutStudentApp(page);
    await loginThroughUi(page, created.family.parentPhone, created.family.parentPassword);
    const parentTokens = await loginApi(request, created.family.parentPhone, created.family.parentPassword);
    const parentSummary = await waitForHomeworkSummary(
      request,
      parentTokens.access,
      (row) => row.submission_state === "awaiting_review" && row.score === null,
      student.id,
    );
    expect(parentSummary.lecture_active).toBe(true);
    expect(parentSummary.submission_media_locked).toBe(false);
    const browserGradesResponses: Array<import("@playwright/test").Response> = [];
    page.on("response", (response) => {
      if (response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/student/grades/") {
        browserGradesResponses.push(response);
      }
    });
    await gotoAndSettle(page, `${QA_BASE}/student/submit/assignment`, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "과제 제출" })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => browserGradesResponses.length).toBeGreaterThan(0);
    const browserGradesResponse = browserGradesResponses.at(-1)!;
    expect(browserGradesResponse.request().headers()["x-student-id"]).toBe(String(student.id));
    expect(browserGradesResponse.status()).toBe(200);
    const browserGrades = await browserGradesResponse.json() as { homeworks?: HomeworkSummary[] };
    const browserHomework = browserGrades.homeworks?.find((row) => row.homework_id === created.homeworkId);
    expect(browserHomework).toMatchObject({
      title: homeworkTitle,
      submission_state: "awaiting_review",
      lecture_active: true,
      submission_media_locked: false,
    });
    await expect(page.getByText("학부모 계정은 직접 제출할 수 없습니다.")).toHaveCount(0);
    const parentHomeworkTarget = page.locator("[data-guide='submit-target'] button").filter({
      has: page.getByText(homeworkTitle, { exact: true }),
    });
    // Scope the title to a selectable target. A page-wide text locator can
    // match the same title in another surface and fail Playwright strict mode.
    await expect(parentHomeworkTarget).toHaveCount(1, { timeout: 30_000 });
    await expect(parentHomeworkTarget).toBeVisible();
    await parentHomeworkTarget.click();
    await page.locator("input[type='file']").first().setInputFiles({
      name: parentUploadName,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.getByRole("button", { name: "파일 1개 제출하기" }).click();
    await expect(page.getByText("선택한 파일을 모두 제출했습니다.")).toBeVisible({ timeout: 45_000 });

    const parentMediaResponse = await request.get(
      `${QA_API}/api/v1/submissions/submissions/homework/${created.homeworkId}/media/?enrollment_id=${created.enrollmentId}`,
      {
        headers: {
          Authorization: `Bearer ${parentTokens.access}`,
          "X-Tenant-Code": QA_TENANT,
          "X-Student-Id": String(student.id),
        },
        timeout: 60_000,
      },
    );
    expect(parentMediaResponse.status()).toBe(200);
    const parentMedia = await parentMediaResponse.json() as { files: Array<{ original_filename: string }> };
    expect(parentMedia.files.map((file) => file.original_filename)).toEqual(
      expect.arrayContaining([uploadName, parentUploadName]),
    );

    await waitForHomeworkSummary(
      request,
      parentTokens.access,
      (row) => row.submission_state === "awaiting_review" && row.score === null
        && row.lecture_active === true && row.submission_media_locked === false,
      student.id,
    );
    await reloadStudentApp(page);
    await expect(parentHomeworkTarget).toHaveCount(1, { timeout: 30_000 });
    await expect(parentHomeworkTarget).toBeVisible();
    await parentHomeworkTarget.click();
    await expect(page.getByText(uploadName, { exact: true })).toBeVisible();
    await expect(page.getByText(parentUploadName, { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await gradeHomework(page, request, staffUsername, student.password, staffTokens.access);
    await seedSameTitleLecture(request);
    await waitForHomeworkSummary(request, parentTokens.access, (row) => row.score === 92, student.id);
    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    await page.getByRole("button", { name: "과제 현황" }).click();
    const scoredHomeworkCard = page.locator('.stu-panel[data-session-type]').filter({
      has: page.getByText(homeworkTitle, { exact: true }),
    });
    await expect(scoredHomeworkCard).toHaveCount(1);
    await expect(scoredHomeworkCard.locator("strong")).toHaveText("92/100");
    await expect(scoredHomeworkCard.locator("strong")).toBeVisible();
    await assertSeparateHomeworkGroups(page);
    await verifyHomeworkFeedback(page, request, admin, student.name);

    await reloadStudentApp(page);
    await expect(page.getByText(homeworkTitle).first()).toBeVisible();
    await assertSeparateHomeworkGroups(page);
    await logoutStudentApp(page);
    await loginThroughUi(page, created.family.parentPhone, created.family.parentPassword);
    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    await page.getByRole("button", { name: "과제 현황" }).click();
    await expect(page.getByText(homeworkTitle).first()).toBeVisible();
    await expect(page.locator('aside[aria-label="학부모 코멘트"]')).toContainText(parentHomeworkComment);

    await logoutStudentApp(page);
    await loginThroughUi(page, student.ps_number, student.password);
    const graded = await waitForHomeworkSummary(
      request,
      studentTokens.access,
      (row) => row.score === 92 && row.passed === true && row.achievement === "PASS",
    );
    expect(graded.title).toBe(homeworkTitle);
    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    await page.getByRole("button", { name: "과제 현황" }).click();
    await expect(scoredHomeworkCard).toHaveCount(1);
    await expect(scoredHomeworkCard.locator("strong")).toHaveText("92/100");
    await expect(scoredHomeworkCard.locator("strong")).toBeVisible();
    await expect(page.locator('aside[aria-label="학부모 코멘트"]')).toHaveCount(0);
    await expect(page.getByText(parentHomeworkComment, { exact: false })).toHaveCount(0);

    await page.setViewportSize({ width: 1366, height: 900 });
    await assertSeparateHomeworkGroups(page);
    await test.info().attach("same-title-homework-groups-1366", {
      body: await page.screenshot({ fullPage: true }), contentType: "image/png",
    });
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
