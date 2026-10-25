/**
 * Required isolated development QA: teacher-app UI score writes -> reload ->
 * student/parent projections. Setup/readback/cleanup APIs are not score writes.
 * The fixed QA operator has admin authority; this does not prove a teacher-only role.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page, Response, TestInfo } from "@playwright/test";
import type { SessionScoresResponse } from "../../src/shared/api/contracts/sessionScores";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import {
  api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, cleanupQaFamily,
  createQaFamily, expectApi, installQaStudentParentBoundary, loginAdmin,
  loginThroughUi, QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_TENANT,
  reloadStudentApp, selectParentStudentThroughUi, STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily, type QaStudent,
} from "../helpers/qaStudentParentScenario";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(420_000);
// No credential-bearing auth traces/video. Capture only explicit synthetic UI states.
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

const STAMP = Date.now();
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const LECTURE_TITLE = `QA 교사 성적 실사용 ${STAMP}`;
const EXAM_A_TITLE = `QA 시험 A — 일차함수 그래프와 좌표 해석의 전체 풀이 확인 ${STAMP}`;
const EXAM_B_TITLE = `QA 시험 B — 도형의 성질과 서술형 사고 과정 종합 점검 ${STAMP}`;

type Enrollment = { id: number; student: { id: number } };
type Exam = { id: number; title: string };
type ScoreWrite = { examId: number; enrollmentId: number; score: number; max_score: number };
type GradeRow = { exam_id: number; enrollment_id: number; total_score: number | null; max_score: number };

const owned = {
  family: null as QaFamily | null,
  adminAccess: "",
  lectureId: 0,
  sessionId: 0,
  exams: [] as Exam[],
  enrollments: [] as Enrollment[],
  sessionEnrollmentIds: [] as number[],
};

function mainButton(page: Page, name: string) {
  return page.getByRole("main").getByRole("button", { name, exact: true });
}

function enrollmentFor(student: QaStudent): number {
  const matches = owned.enrollments.filter((row) => row.student.id === student.id);
  expect(matches, "fixture enrollment must identify this exact student").toHaveLength(1);
  return matches[0].id;
}

function scoreCell(page: Page, student: QaStudent, exam: Exam) {
  return page.getByTestId(`session-assessment-student-${enrollmentFor(student)}`)
    .getByTestId(`session-assessment-exam-${exam.id}`);
}

function apiResponse(page: Page, path: string, method = "GET") {
  return page.waitForResponse((response) => response.request().method() === method
    && new URL(response.url()).pathname === `/api/v1${path}`, { timeout: 30_000 });
}

async function checkResponseScope(response: Response, expectedStatus: 200 | 204, selectedChild?: QaStudent): Promise<void> {
  expect(response.status()).toBe(expectedStatus);
  const headers = await response.request().allHeaders();
  expect(headers["x-tenant-code"]).toBe(QA_TENANT);
  if (selectedChild) expect(headers["x-student-id"]).toBe(String(selectedChild.id));
}

async function seedFixture(request: APIRequestContext): Promise<void> {
  const admin = await loginAdmin(request);
  owned.adminAccess = admin.access;
  owned.family = await createQaFamily(request, admin.access, `teacher-score-${STAMP}`, 2);
  const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", admin.access, {
    title: LECTURE_TITLE, name: "QA 성적", subject: "수학", start_date: TODAY,
    lecture_time: "수 19:00 ~ 21:00", is_active: true,
    description: "qa-* teacher-app score write and selected-child projection",
  });
  owned.lectureId = lecture.id;
  const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", admin.access, {
    lecture: lecture.id, title: "1차시", date: TODAY, order: 1,
  });
  owned.sessionId = session.id;
  owned.enrollments = await expectApi<Enrollment[]>(request, "POST", "/enrollments/bulk_create/", admin.access, {
    lecture: lecture.id, students: owned.family.students.map((student) => student.id),
  });
  expect(owned.enrollments).toHaveLength(2);
  for (const student of owned.family.students) enrollmentFor(student);
  const sessionEnrollments = await expectApi<Array<{ id: number }>>(
    request, "POST", "/enrollments/session-enrollments/bulk_create/", admin.access,
    { session: session.id, enrollments: owned.enrollments.map((row) => row.id) },
  );
  owned.sessionEnrollmentIds = sessionEnrollments.map((row) => row.id);
  expect(owned.sessionEnrollmentIds).toHaveLength(2);
  for (const title of [EXAM_A_TITLE, EXAM_B_TITLE]) {
    const exam = await expectApi<Exam>(request, "POST", "/exams/", admin.access, {
      title, description: "qa-* offline score entry, no online attempts",
      exam_type: "regular", session_id: session.id, pass_score: 50, max_score: 100,
      student_results_published: true, answer_visibility: "hidden",
    });
    owned.exams.push(exam);
    await expectApi(request, "PUT", `/exams/${exam.id}/enrollments/?session_id=${session.id}`, admin.access,
      { enrollment_ids: owned.enrollments.map((row) => row.id) }, [200]);
  }
  // No score/result/submission API writes in setup. The first score is entered through UI.
  const sheet = await expectApi<SessionScoresResponse>(request, "GET",
    `/results/admin/sessions/${session.id}/scores/`, admin.access);
  expect(sheet.rows).toHaveLength(2);
  for (const row of sheet.rows) {
    for (const exam of owned.exams) {
      expect(row.exams.find((entry) => entry.exam_id === exam.id)?.block.score ?? null).toBeNull();
    }
  }
}

async function cleanupFixture(request: APIRequestContext, testInfo: TestInfo): Promise<void> {
  if (!owned.adminAccess) return;
  const failures: string[] = [];
  const archivedExamIds: number[] = [];
  for (const exam of owned.exams.slice().reverse()) {
    try {
      const deletion = await api<{ action?: string }>(request, "DELETE",
        `/exams/${exam.id}/?session_id=${owned.sessionId}`, owned.adminAccess);
      if (![200, 204, 404].includes(deletion.status)) failures.push(`DELETE exam ${exam.id}: ${deletion.status}`);
      const residue = await api<{ id: number; is_active: boolean }>(request, "GET",
        `/exams/${exam.id}/?include_inactive=true`, owned.adminAccess);
      if (residue.status === 200 && deletion.body?.action === "archived"
        && residue.body.id === exam.id && residue.body.is_active === false) {
        // Product history protection is valid. The outer capability-owning tenant
        // Cleanup must remove these exact rows; do not disguise archive as zero residue.
        archivedExamIds.push(exam.id);
      } else if (residue.status !== 404) failures.push(`exam ${exam.id}: unexpected retained state ${residue.status}`);
    } catch { failures.push(`exam ${exam.id}: cleanup/readback transport failed`); }
  }
  const paths = [
    ...owned.sessionEnrollmentIds.map((id) => `/enrollments/session-enrollments/${id}/`),
    ...owned.enrollments.map((row) => `/enrollments/${row.id}/`),
    ...(owned.sessionId ? [`/lectures/sessions/${owned.sessionId}/`] : []),
    ...(owned.lectureId ? [`/lectures/lectures/${owned.lectureId}/`] : []),
  ];
  for (const path of paths) {
    try {
      const result = await api(request, "DELETE", path, owned.adminAccess);
      if (![200, 202, 204, 404].includes(result.status)) failures.push(`DELETE ${path}: ${result.status}`);
    } catch { failures.push(`DELETE ${path}: transport failed`); }
  }
  try { await cleanupQaFamily(request, owned.adminAccess, owned.family); }
  catch { failures.push("exact synthetic family cleanup failed"); }
  for (const path of paths) {
    try {
      const result = await api(request, "GET", path, owned.adminAccess);
      if (result.status !== 404) failures.push(`GET ${path}: expected absent, got ${result.status}`);
    } catch { failures.push(`GET ${path}: absence not verified`); }
  }
  const retainedExamIds: number[] = [];
  for (const exam of owned.exams) {
    try {
      const residue = await api<{ id: number; is_active: boolean }>(request, "GET",
        `/exams/${exam.id}/?include_inactive=true`, owned.adminAccess);
      if (residue.status === 200 && archivedExamIds.includes(exam.id)
        && residue.body.id === exam.id && residue.body.is_active === false) retainedExamIds.push(exam.id);
      else if (residue.status !== 404) failures.push(`final exam ${exam.id}: unexpected residue ${residue.status}`);
    } catch { failures.push(`final exam ${exam.id}: residue not verified`); }
  }
  await testInfo.attach("teacher-score-fixture-cleanup", {
    body: JSON.stringify({ archivedExamIds, retainedExamIds, outerTenantCleanupRequired: true,
      tenantUserZeroProvenByThisSpec: false, failures }),
    contentType: "application/json",
  });
  expect(failures, "fixture cleanup is separate from outer tenant/user/token/activity/R2 cleanup").toEqual([]);
}

async function openTeacherSessionThroughUi(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${QA_BASE}/login/${QA_TENANT}`, { timeout: 45_000 });
  await page.getByTestId("login-username").fill(QA_ADMIN_USER);
  await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
  await acknowledgeInitialAccountPromptsIfVisible(page);
  await gotoAndSettle(page, `${QA_BASE}/workspace/mobile`, { timeout: 30_000 });
  await expect(page.locator('[data-app="teacher"]')).toBeVisible();
  await page.getByRole("navigation", { name: "하단 메뉴" }).getByRole("link", { name: "강의", exact: true }).click();
  const lecture = page.getByRole("main").getByRole("button").filter({ hasText: LECTURE_TITLE });
  await expect(lecture).toHaveCount(1);
  await lecture.click();
  await expect(page).toHaveURL(`${QA_BASE}/workspace/mobile/classes/${owned.lectureId}`);
  await page.getByRole("main").getByRole("button").filter({ hasText: "1차시" }).click();
  await expect(page).toHaveURL(`${QA_BASE}/workspace/mobile/classes/${owned.lectureId}/sessions/${owned.sessionId}`);
  for (const student of owned.family!.students) {
    await expect(page.getByRole("main").getByText(student.name, { exact: true })).toBeVisible();
  }
  await mainButton(page, "성적").click();
  await expect(mainButton(page, "종합 조회")).toHaveAttribute("aria-pressed", "true");
}

async function enterScoreThroughUi(page: Page, student: QaStudent, exam: Exam, score: number): Promise<void> {
  const input = page.locator('input[inputmode="decimal"]');
  await page.getByRole("searchbox", { name: "학생 이름 검색", exact: true }).fill(student.name);
  await expect(input).toHaveCount(1);
  await expect(input).toHaveValue("");
  const savedToast = page.getByText(`${student.name} 점수가 저장되었습니다.`, { exact: true });
  await expect(savedToast, "a previous save notification must not satisfy this save").toBeHidden();
  await input.fill(String(score));
  const [lease, patched, released] = await Promise.all([
    apiResponse(page, `/results/admin/sessions/${owned.sessionId}/score-draft/`, "PUT"),
    apiResponse(page, `/results/admin/exams/${exam.id}/enrollments/${enrollmentFor(student)}/score/`, "PATCH"),
    apiResponse(page, `/results/admin/sessions/${owned.sessionId}/score-draft/commit/`, "POST"),
    input.press("Enter"),
    expect(savedToast).toBeVisible(),
  ]);
  await checkResponseScope(lease, 200);
  await checkResponseScope(patched, 200);
  await checkResponseScope(released, 204);
  expect(patched.request().postDataJSON()).toEqual({ score, max_score: 100 });
  expect(await patched.request().headerValue("x-score-session-id")).toBe(String(owned.sessionId));
  expect(await patched.request().headerValue("x-score-editor-client")).toBeTruthy();
  expect(await patched.json()).toMatchObject({
    ok: true, exam_id: exam.id, enrollment_id: enrollmentFor(student), total_score: score, max_score: 100,
    progress: { dispatched: true, error: null },
  });
  await expect(input).toHaveValue(String(score));
}

async function captureSurface(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await assertNoHorizontalOverflow(page);
  const bounds = await page.getByRole("main").evaluate((main) => ({
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
    mainWidth: main.clientWidth, mainScrollWidth: main.scrollWidth,
  }));
  expect(bounds.mainScrollWidth).toBeLessThanOrEqual(bounds.mainWidth + 1);
  await testInfo.attach(`${name}-bounds`, { body: JSON.stringify(bounds), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
}

async function verifyTeacherOverview(page: Page, request: APIRequestContext, testInfo: TestInfo): Promise<void> {
  const [primary, peer] = owned.family!.students;
  const [examA, examB] = owned.exams;
  for (const width of [390, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(mainButton(page, "종합 조회")).toHaveAttribute("aria-pressed", "true");
    await expect(scoreCell(page, primary, examA)).toContainText("0/100");
    await expect(scoreCell(page, primary, examB)).toContainText("91/100");
    await expect(scoreCell(page, peer, examB)).toContainText("37/100");
    await expect(page.getByTestId(/^session-assessment-student-/)).toHaveCount(2);
    const comparison = page.getByRole("region", { name: "학생별 시험 및 과제 비교표", exact: true });
    for (const exam of owned.exams) {
      const title = width < 640
        ? scoreCell(page, primary, exam).getByRole("link", { name: exam.title, exact: true })
        : comparison.getByRole("columnheader").getByRole("link", { name: exam.title, exact: true });
      await title.scrollIntoViewIfNeeded();
      await expect(title).toBeInViewport();
      expect(await title.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
    await page.getByRole("main").evaluate((main) => { main.scrollTop = 0; });
    await captureSurface(page, testInfo, `teacher-overview-${width}-first`);
    const last = page.getByTestId(`session-assessment-student-${enrollmentFor(peer)}`);
    await last.scrollIntoViewIfNeeded();
    await page.getByRole("main").evaluate((main) => { main.scrollTop = main.scrollHeight; });
    const lastBounds = await last.evaluate((row) => {
      const nav = document.querySelector<HTMLElement>('[data-analytics-placement="teacher.bottom-tab"]')!;
      const navTop = getComputedStyle(nav).display === "none" ? window.innerHeight : nav.getBoundingClientRect().top;
      const box = row.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, navTop };
    });
    expect(lastBounds.top).toBeGreaterThanOrEqual(0);
    expect(lastBounds.bottom).toBeLessThanOrEqual(lastBounds.navTop);
    await testInfo.attach(`teacher-${width}-last-row`, { body: JSON.stringify(lastBounds), contentType: "application/json" });
    await captureSurface(page, testInfo, `teacher-overview-${width}-last`);
  }
  const sheet = await expectApi<SessionScoresResponse>(request, "GET",
    `/results/admin/sessions/${owned.sessionId}/scores/`, owned.adminAccess);
  for (const [student, exam, score] of [[primary, examA, 0], [primary, examB, 91], [peer, examB, 37]] as const) {
    expect(sheet.rows.find((row) => row.enrollment_id === enrollmentFor(student))
      ?.exams.find((entry) => entry.exam_id === exam.id)?.block.score).toBe(score);
  }
}

async function verifyConsumer(page: Page, testInfo: TestInfo, student: QaStudent, exam: Exam, expectedScore: number,
  role: "student" | "parent", width: number): Promise<void> {
  await page.setViewportSize({ width, height: 844 });
  await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
  // A valid client cache need not issue GET on navigation. Reload deliberately
  // requests the authoritative selected-child response without bypassing the UI.
  const gradesResponse = apiResponse(page, "/student/grades/");
  await reloadStudentApp(page);
  const grades = await gradesResponse;
  await checkResponseScope(grades, 200, role === "parent" ? student : undefined);
  const body = await grades.json() as { exams: GradeRow[] };
  expect(body.exams.filter((row) => row.exam_id === exam.id)).toEqual([
    expect.objectContaining({ exam_id: exam.id, enrollment_id: enrollmentFor(student), total_score: expectedScore, max_score: 100 }),
  ]);
  const card = page.locator(`a[href="/student/exams/${exam.id}/result"]`).filter({ hasText: exam.title });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(`${expectedScore}/100점`);
  await card.scrollIntoViewIfNeeded();
  await captureSurface(page, testInfo, `${role}-${width}-${expectedScore}-grades`);
  await card.click();
  await expect(page).toHaveURL(`${QA_BASE}/student/exams/${exam.id}/result`);
  await expect(page.getByRole("heading", { name: "시험 결과", exact: true })).toBeVisible();
  await expect(page.getByText(`${expectedScore} / 100점`, { exact: true })).toBeVisible();
  const reloadedResponse = apiResponse(page, `/student/results/me/exams/${exam.id}/`);
  await reloadStudentApp(page);
  const reloaded = await reloadedResponse;
  await checkResponseScope(reloaded, 200, role === "parent" ? student : undefined);
  expect(await reloaded.json()).toMatchObject({ total_score: expectedScore, max_score: 100 });
  await expect(page.getByText(`${expectedScore} / 100점`, { exact: true })).toBeVisible();
  if (role === "parent") await expect(page.getByRole("tab", { name: student.name, exact: true })).toHaveAttribute("aria-selected", "true");
  await captureSurface(page, testInfo, `${role}-${width}-${expectedScore}-result-reloaded`);
}

test.describe.serial("[real-use] teacher-app UI score save and student/parent projection", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the isolated qa-* development runner.");
  test.beforeAll(() => {
    assertQaStudentParentRuntime();
  });
  test.afterAll(async ({ request }, testInfo) => { await cleanupFixture(request, testInfo); });

  test("교사 UI 저장·reload와 두 자녀의 학생·학부모 성적을 390·768·1366px에서 확인한다", async ({ page, browser, request }, testInfo) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    // The required development runner binds this browser to the exact candidate artifact.
    const guards = attachStrictBrowserGuards(page);
    await seedFixture(request);
    const [primary, peer] = owned.family!.students;
    const [examA, examB] = owned.exams;
    const writes: ScoreWrite[] = [];
    page.on("request", (outgoing) => {
      const match = new URL(outgoing.url()).pathname.match(/^\/api\/v1\/results\/admin\/exams\/(\d+)\/enrollments\/(\d+)\/score\/$/);
      if (outgoing.method() === "PATCH" && match) {
        writes.push({ examId: Number(match[1]), enrollmentId: Number(match[2]), ...outgoing.postDataJSON() });
      }
    });
    await openTeacherSessionThroughUi(page);
    await mainButton(page, "시험별 조회").click();
    await mainButton(page, `${examA.title} (100점)`).click();
    await mainButton(page, "성적 입력").click();
    await expect(page).toHaveURL(`${QA_BASE}/workspace/mobile/scores/${owned.sessionId}?exam=${examA.id}`);
    await enterScoreThroughUi(page, primary, examA, 0);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(mainButton(page, `${examA.title} (100점)`)).toHaveAttribute("aria-pressed", "true");
    await mainButton(page, `${examB.title} (100점)`).click();
    await mainButton(page, "성적 입력").click();
    await expect(page).toHaveURL(`${QA_BASE}/workspace/mobile/scores/${owned.sessionId}?exam=${examB.id}`);
    await enterScoreThroughUi(page, primary, examB, 91);
    await captureSurface(page, testInfo, "teacher-score-390-saved-91");
    await enterScoreThroughUi(page, peer, examB, 37);
    for (const width of [390, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(`${QA_BASE}/workspace/mobile/scores/${owned.sessionId}?exam=${examB.id}`);
      await page.getByRole("searchbox", { name: "학생 이름 검색", exact: true }).fill(primary.name);
      await expect(page.locator('input[inputmode="decimal"]')).toHaveValue("91");
      await waitForRenderSettled(page, { timeout: 20_000 });
      await captureSurface(page, testInfo, `teacher-score-${width}-reloaded-91`);
    }
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(mainButton(page, `${examB.title} (100점)`)).toHaveAttribute("aria-pressed", "true");
    await mainButton(page, "종합 조회").click();
    await verifyTeacherOverview(page, request, testInfo);

    const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const studentPage = await studentContext.newPage();
      const studentBoundary = await installQaStudentParentBoundary(studentPage, request);
      const studentGuards = attachStrictBrowserGuards(studentPage);
      await loginThroughUi(studentPage, primary.ps_number, primary.password);
      await verifyConsumer(studentPage, testInfo, primary, examA, 0, "student", 390);
      await verifyConsumer(studentPage, testInfo, primary, examB, 91, "student", 390);
      studentBoundary.assertClean(); studentGuards.assertZeroDefects();
    } finally { await studentContext.close(); }
    const parentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const parentPage = await parentContext.newPage();
      const parentBoundary = await installQaStudentParentBoundary(parentPage, request);
      const parentGuards = attachStrictBrowserGuards(parentPage);
      await loginThroughUi(parentPage, owned.family!.parentPhone, owned.family!.parentPassword);
      await selectParentStudentThroughUi(parentPage, primary);
      await verifyConsumer(parentPage, testInfo, primary, examA, 0, "parent", 390);
      for (const [student, score, width] of [[primary, 91, 390], [peer, 37, 768], [primary, 91, 1366]] as const) {
        await selectParentStudentThroughUi(parentPage, student);
        await verifyConsumer(parentPage, testInfo, student, examB, score, "parent", width);
      }
      parentBoundary.assertClean(); parentGuards.assertZeroDefects();
    } finally { await parentContext.close(); }
    expect(writes).toEqual([
      { examId: examA.id, enrollmentId: enrollmentFor(primary), score: 0, max_score: 100 },
      { examId: examB.id, enrollmentId: enrollmentFor(primary), score: 91, max_score: 100 },
      { examId: examB.id, enrollmentId: enrollmentFor(peer), score: 37, max_score: 100 },
    ]);
    await testInfo.attach("teacher-score-realuse-evidence", {
      body: JSON.stringify({ operatorAuthority: "qa-admin-in-teacher-app",
        viewports: [390, 768, 1366], uiScoreWrites: writes, consumerScores: { student: [0, 91], parent: [0, 91, 37, 91] },
        setupScoreWrites: 0, notes: "Login and student activity POSTs are real writes, not read-only observations." }),
      contentType: "application/json",
    });
    boundary.assertClean(); guards.assertZeroDefects();
  });
});
