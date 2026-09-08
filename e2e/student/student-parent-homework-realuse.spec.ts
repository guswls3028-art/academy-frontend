/**
 * Student homework media submission -> staff grading -> parent projection.
 * The browser writes only to the guarded loopback development API.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext } from "@playwright/test";
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
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle, waitForCondition, waitForRenderSettled } from "../helpers/wait";

test.setTimeout(360_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type HomeworkSummary = {
  homework_id: number;
  title: string;
  score: number | null;
  passed: boolean;
  achievement: string;
};

type CreatedState = {
  family: QaFamily | null;
  adminAccess: string;
  lectureId?: number;
  sessionId?: number;
  homeworkId?: number;
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
  await cleanupQaFamily(request, created.adminAccess, created.family);
  for (const [label, path] of [
    ...(created.homeworkId ? [[`homework ${created.homeworkId}`, `/homeworks/${created.homeworkId}/`] as const] : []),
    ...(created.sessionId ? [[`session ${created.sessionId}`, `/lectures/sessions/${created.sessionId}/`] as const] : []),
    ...(created.lectureId ? [[`lecture ${created.lectureId}`, `/lectures/lectures/${created.lectureId}/`] as const] : []),
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

async function gradeHomework(request: APIRequestContext, adminAccess: string): Promise<void> {
  const editor = `qa-student-parent-homework-${runStamp}`;
  const headers = {
    Authorization: `Bearer ${adminAccess}`,
    "Content-Type": "application/json",
    "X-Tenant-Code": QA_TENANT,
    "X-Score-Editor-Client": editor,
  };
  const draft = await request.put(`${QA_API}/api/v1/results/admin/sessions/${created.sessionId}/score-draft/`, {
    headers,
    data: { changes: [] },
    timeout: 60_000,
  });
  expect(draft.status()).toBe(200);
  try {
    const score = await request.patch(`${QA_API}/api/v1/homework/scores/quick/`, {
      headers,
      data: {
        session_id: created.sessionId,
        enrollment_id: created.enrollmentId,
        homework_id: created.homeworkId,
        score: 92,
        max_score: 100,
      },
      timeout: 60_000,
    });
    expect(score.status()).toBe(200);
    expect(await score.json()).toMatchObject({ score: 92, passed: true });
  } finally {
    const commit = await request.post(
      `${QA_API}/api/v1/results/admin/sessions/${created.sessionId}/score-draft/commit/`,
      { headers, data: { release_lease: true }, timeout: 60_000 },
    );
    expect([200, 204]).toContain(commit.status());
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

  test("390px 학생·학부모 파일 제출, 채점·reload/relogin·desktop을 완료한다", async ({ page, request }) => {
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
    await page.getByRole("button", { name: "파일 1개 제출하기" }).click();
    await expect(page.getByText("선택한 파일을 모두 제출했습니다.")).toBeVisible({ timeout: 45_000 });
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
    await gotoAndSettle(page, `${QA_BASE}/student/submit/assignment`, { timeout: 30_000 });
    await expect(page.getByText("학부모 계정은 직접 제출할 수 없습니다.")).toHaveCount(0);
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

    const parentTokens = await loginApi(request, created.family.parentPhone, created.family.parentPassword);
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

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await page.getByText(homeworkTitle, { exact: true }).click();
    await expect(page.getByText(uploadName, { exact: true })).toBeVisible();
    await expect(page.getByText(parentUploadName, { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await gradeHomework(request, admin.access);
    await waitForHomeworkSummary(request, parentTokens.access, (row) => row.score === 92, student.id);
    await gotoAndSettle(page, `${QA_BASE}/student/grades`, { timeout: 30_000 });
    await page.getByRole("button", { name: "과제 현황" }).click();
    await expect(page.getByText(homeworkTitle).first()).toBeVisible();
    await expect(page.getByText(/92\s*\/\s*100|92점|92/).first()).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
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
