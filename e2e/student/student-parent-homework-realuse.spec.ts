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
};

type CreatedState = {
  family: QaFamily | null;
  adminAccess: string;
  lectureId?: number;
  sessionId?: number;
  homeworkId?: number;
  staffId?: number;
  enrollmentId?: number;
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
const uploadName = `qa-homework-${runStamp}.png`;
const parentUploadName = `qa-parent-homework-${runStamp}.png`;

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
  if (created.homeworkId) await remove("DELETE", `/homeworks/${created.homeworkId}/`);
  for (const id of created.sessionEnrollmentIds) {
    await remove("DELETE", `/enrollments/session-enrollments/${id}/`);
  }
  if (created.enrollmentId) await remove("DELETE", `/enrollments/${created.enrollmentId}/`);
  if (created.sessionId) await remove("DELETE", `/lectures/sessions/${created.sessionId}/`);
  if (created.lectureId) await remove("DELETE", `/lectures/lectures/${created.lectureId}/`);
  if (created.staffId) await remove("DELETE", `/staffs/${created.staffId}/`);
  // Staff deletion deactivates membership; the exact qa-* tenant teardown owns
  // the remaining synthetic User/token/audit cleanup and its zero-residue proof.
  await cleanupQaFamily(request, created.adminAccess, created.family);
  for (const [label, path] of [
    ...(created.homeworkId ? [[`homework ${created.homeworkId}`, `/homeworks/${created.homeworkId}/`] as const] : []),
    ...(created.sessionId ? [[`session ${created.sessionId}`, `/lectures/sessions/${created.sessionId}/`] as const] : []),
    ...(created.lectureId ? [[`lecture ${created.lectureId}`, `/lectures/lectures/${created.lectureId}/`] as const] : []),
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

  test("390px 학생·학부모 파일 제출, 채점·reload/relogin·desktop을 완료한다", async ({ page, request }, testInfo) => {
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
      await fileRow.getByRole("button", { name: "미리보기" }).click();
      const preview = staffPage.getByRole("dialog").filter({ hasText: uploadName });
      const image = preview.getByRole("img", { name: /과제 제출 미리보기/ });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await preview.getByRole("button", { name: "닫기" }).click();
      await staffPage.reload({ waitUntil: "domcontentloaded" });
      await expect(fileRow).toBeVisible();
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
    await waitForHomeworkSummary(
      request,
      parentTokens.access,
      (row) => row.submission_state === "awaiting_review" && row.score === null,
      student.id,
    );
    await gotoAndSettle(page, `${QA_BASE}/student/submit/assignment`, { timeout: 30_000 });
    await expect(page.getByText("학부모 계정은 직접 제출할 수 없습니다.")).toHaveCount(0);
    await expect(page.getByText(homeworkTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByText(homeworkTitle, { exact: true }).click();
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

    await reloadStudentApp(page);
    await page.getByText(homeworkTitle, { exact: true }).click();
    await expect(page.getByText(uploadName, { exact: true })).toBeVisible();
    await expect(page.getByText(parentUploadName, { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await gradeHomework(page, request, staffUsername, student.password, staffTokens.access);
    await waitForHomeworkSummary(request, parentTokens.access, (row) => row.score === 92, student.id);
    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    await page.getByRole("button", { name: "과제 현황" }).click();
    await expect(page.getByText(homeworkTitle).first()).toBeVisible();
    await expect(page.getByText(/92\s*\/\s*100|92점|92/).first()).toBeVisible();

    await reloadStudentApp(page);
    await expect(page.getByText(homeworkTitle).first()).toBeVisible();
    await logoutStudentApp(page);
    await loginThroughUi(page, created.family.parentPhone, created.family.parentPassword);
    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    await page.getByRole("button", { name: "과제 현황" }).click();
    await expect(page.getByText(homeworkTitle).first()).toBeVisible();

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
    await expect(page.getByText(homeworkTitle).first()).toBeVisible();
    await expect(page.getByText(/92\s*\/\s*100|92점|92/).first()).toBeVisible();

    await page.setViewportSize({ width: 1366, height: 900 });
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();
  });
});
