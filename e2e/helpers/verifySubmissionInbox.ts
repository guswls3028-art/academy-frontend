import type { APIRequestContext, Page, Response } from "@playwright/test";
import { expect } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "./firstLoginGuide";
import { attachStrictBrowserGuards } from "./strictBrowser";
import { gotoAndSettle } from "./wait";
import { assertNoHorizontalOverflow, assertQaStudentParentRuntime, expectApi,
  installQaStudentParentBoundary, loginApi, QA_ADMIN_PASSWORD, QA_BASE, seedBrowserAuth, type QaTokens } from "./qaStudentParentScenario";

/** Reuse the scenario's submitted/graded exam; its existing cleanup owns the row. */
export async function verifySubmissionInbox(parentPage: Page, request: APIRequestContext, admin: QaTokens, submissionId: number) {
  assertQaStudentParentRuntime();
  const data = await expectApi<{ results: Array<{ id: number }>; count: number; page: number }>(
    request, "GET", "/submissions/submissions/pending/?filter=done&page=1&page_size=50", admin.access,
  );
  expect(data.page).toBe(1);
  expect(data.count).toBeGreaterThan(0);
  expect(data.results.some((row) => row.id === submissionId)).toBe(true);
  const context = await parentPage.context().browser()!.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  try {
    await seedBrowserAuth(page, admin);
    for (const path of ["/workspace/results/submissions", "/workspace/mobile/submissions"]) {
      for (const width of [390, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndSettle(page, `${QA_BASE}${path}?filter=done&page=1`);
        await expect(page.getByTestId(`submission-inbox-${submissionId}`)).toBeVisible();
        await expect(page.getByRole("navigation", { name: "제출 목록 페이지", exact: true })).toContainText(/전체 \d+건 · 1 \/ \d+ 페이지/);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByTestId(`submission-inbox-${submissionId}`)).toBeVisible();
        await assertNoHorizontalOverflow(page);
      }
    }
    boundary.assertClean();
    guards.assertZeroDefects();
  } finally {
    await context.close();
  }
}

type ExamEntryIssue = "detail" | "identity" | "target-in-session" | "list" | "target-in-list" | "selection" | "link";

async function openStudentSessionExam(
  page: Page, session: number, exam: number, title: string, studentId: number,
  request: APIRequestContext, student: QaTokens,
) {
  const reads: { detail?: Response; list?: Response } = {};
  const observe = (response: Response) => {
    if (response.request().method() !== "GET") return;
    const url = new URL(response.url());
    if (url.pathname === `/api/v1/student/sessions/${session}/`) reads.detail = response;
    if (url.pathname === "/api/v1/student/exams/" && url.searchParams.get("session_id") === String(session)) reads.list = response;
  };
  let issue: ExamEntryIssue = "detail";
  let sessionCount: number | null = null, listCount: number | null = null;
  let targetInSession: boolean | null = null, targetListed: boolean | null = null, identityMatches: boolean | null = null;
  page.on("response", observe);
  try {
    await gotoAndSettle(page, `${QA_BASE}/student/sessions/${session}`);
    await acknowledgeInitialAccountPromptsIfVisible(page);
    await expect.poll(() => Boolean(reads.detail)).toBe(true);
    expect(reads.detail!.status()).toBe(200);
    const detail = await reads.detail!.json();
    expect(detail.id === session && Array.isArray(detail.exam_ids)).toBe(true);
    const ids: number[] = detail.exam_ids;
    sessionCount = Math.min(99, ids.length);
    expect(ids.every(id => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length).toBe(true);
    issue = "identity";
    const me = await expectApi<{ id: number }>(request, "GET", "/student/me/", student.access, undefined, [200]);
    const matchesStudent = (response: Response) => {
      const selected = response.request().headers()["x-student-id"];
      return selected === undefined || selected === String(studentId);
    };
    identityMatches = me.id === studentId && matchesStudent(reads.detail!);
    expect(identityMatches).toBe(true);

    issue = "target-in-session";
    targetInSession = ids.includes(exam);
    expect(targetInSession).toBe(true);
    issue = "list";
    await expect.poll(() => Boolean(reads.list)).toBe(true);
    expect(reads.list!.status()).toBe(200);
    const { items } = await reads.list!.json();
    expect(Array.isArray(items)).toBe(true);
    listCount = Math.min(99, items.length);
    issue = "identity";
    identityMatches = matchesStudent(reads.list!);
    expect(identityMatches).toBe(true);
    issue = "target-in-list";
    targetListed = items.some((item: { id: number; title: string }) => item.id === exam && item.title === title);
    expect(targetListed).toBe(true);

    const actions = page.getByRole("list", { name: "차시 학습" });
    const href = `/student/exams/${exam}?entry_session_id=${session}`;
    if (ids.length > 1) {
      issue = "selection";
      const chooser = actions.locator("details").filter({ has: page.locator(`a[href="${href}"]`) });
      await chooser.locator("summary").click();
    }
    issue = "link";
    const link = actions.getByRole("link", { name: ids.length > 1 ? title : "시험 보기", exact: true })
      .and(actions.locator(`a[href="${href}"]`));
    await expect(link).toHaveAttribute("href", href);
    await link.click();
  } catch (error) {
    console.log(JSON.stringify({ releaseStudentExamEntry: {
      issue, detailStatus: reads.detail?.status() ?? null, listStatus: reads.list?.status() ?? null,
      sessionCount, listCount, targetInSession, targetListed, identityMatches,
    } }));
    throw error;
  } finally {
    page.off("response", observe);
  }
}

/** Uses the secondary course immediately before its scenario-owned teardown. */
export async function verifyWithdrawnSubmission(
  parent: Page, request: APIRequestContext, admin: QaTokens, student: QaTokens,
  scope: { session: number; enrollment: number; lecture: number; studentId: number; title: string; sessionTitle: string;
    onExam: (id: number) => void; onSubmission: (id: number) => void },
) {
  assertQaStudentParentRuntime();
  const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", admin.access, {
    title: scope.title, exam_type: "regular", session_id: scope.session, max_score: 100, pass_score: 50,
    open_at: new Date().toISOString(),
  });
  scope.onExam(exam.id);
  const [question] = await expectApi<Array<{ id: number }>>(request, "POST", `/exams/${exam.id}/questions/init/`, admin.access,
    { total_questions: 1, default_score: 100 });
  await expectApi(request, "POST", "/exams/answer-keys/", admin.access, { exam: exam.id, answers: { [question.id]: "1" } });
  await expectApi(request, "PUT", `/exams/${exam.id}/enrollments/?session_id=${scope.session}`, admin.access,
    { enrollment_ids: [scope.enrollment] });
  const browser = parent.context().browser()!;
  const studentContext = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  let sid: number;
  try {
    const page = await studentContext.newPage();
    const boundary = await installQaStudentParentBoundary(page, request);
    const guard = attachStrictBrowserGuards(page);
    await seedBrowserAuth(page, student);
    await openStudentSessionExam(page, scope.session, exam.id, scope.title, scope.studentId, request, student);
    await page.getByRole("link", { name: "답안 입력하기" }).click();
    await page.getByLabel("1번 답").fill("1");
    await page.getByRole("button", { name: "제출하기" }).click();
    const [accepted] = await Promise.all([
      page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/v1/student/exams/${exam.id}/submit/`),
      page.locator("[data-confirm-dialog]").getByRole("button", { name: "제출" }).click(),
    ]);
    expect(accepted.status()).toBe(201);
    expect(accepted.request().postDataJSON()).toMatchObject({ entry_session_id: scope.session });
    sid = (await accepted.json()).submission_id;
    expect(sid).toBeGreaterThan(0);
    scope.onSubmission(sid);
    boundary.assertClean();
    guard.assertZeroDefects();
  } finally { await studentContext.close(); }
  await expect.poll(async () => (await expectApi<{ total_score: number | null }>(request, "GET",
    `/results/admin/exams/${exam.id}/enrollments/${scope.enrollment}/`, admin.access)).total_score).toBe(100);
  const attendance = await expectApi<{ results: Array<{ id: number; session: number; enrollment_id: number }> }>(
    request, "GET", `/lectures/attendance/?session=${scope.session}`, admin.access);
  const exact = attendance.results.filter(r => r.session === scope.session && r.enrollment_id === scope.enrollment);
  expect(exact).toHaveLength(1);
  await expectApi(request, "PATCH", `/lectures/attendance/${exact[0].id}/`, admin.access,
    { status: "SECESSION", confirm_secession: true, secession_scope: "lecture" });
  const teacher = await loginApi(request, "ymath-qa-resource-publisher", QA_ADMIN_PASSWORD);
  const pending = await expectApi<{ results: Array<{ id: number }> }>(request, "GET",
    "/submissions/submissions/pending/?filter=done&page=1&page_size=50&session_choices=1", teacher.access);
  expect(pending.results.find(row => row.id === sid)).toMatchObject({
    target_id: exam.id, enrollment_id: scope.enrollment, lecture_id: scope.lecture,
    session_id: scope.session, session_origin_recorded: true, session_history_only: true,
  });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: mobile ? 390 : 1366, height: 900 } });
    try {
      const page = await context.newPage();
      const boundary = await installQaStudentParentBoundary(page, request);
      const guard = attachStrictBrowserGuards(page);
      await seedBrowserAuth(page, mobile ? teacher : admin);
      const path = mobile ? "/workspace/mobile/submissions" : "/workspace/results/submissions";
      await gotoAndSettle(page, QA_BASE + path + "?filter=done");
      await acknowledgeInitialAccountPromptsIfVisible(page);
      const row = page.getByTestId(`submission-inbox-${sid}`);
      await expect(row).toContainText(scope.sessionTitle);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(row).toContainText(scope.sessionTitle);
      await expect(row.getByText("응시 차시 미확인")).toHaveCount(0);
      await expect(row.getByRole("button", { name: /^(결과 보기|결과|폐기)$/ })).toHaveCount(0);
      const [response] = await Promise.all([
        page.waitForResponse(r => {
          const url = new URL(r.url());
          return r.request().method() === "GET" && url.pathname === `/api/v1/submissions/submissions/exams/${exam.id}/`
            && url.searchParams.get("focus_id") === String(sid);
        }),
        row.getByRole("button", { name: "저장된 성적 보기" }).click(),
      ]);
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual([expect.objectContaining({ id: sid, enrollment_id: scope.enrollment, score: 100 })]);
      const dialog = page.getByRole("dialog", { name: "저장된 성적" });
      await expect(dialog).toContainText("이 제출의 저장 점수: 100점");
      await assertNoHorizontalOverflow(page);
      await dialog.getByRole("button", { name: "닫기", exact: true }).last().click();
      await expect(dialog).toHaveCount(0);
      boundary.assertClean();
      guard.assertZeroDefects();
    } finally { await context.close(); }
  }
}
