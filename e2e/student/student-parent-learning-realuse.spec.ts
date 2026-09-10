/**
 * Lecture, attendance, video-progress, and materials projection for a student
 * and the same child's parent. All records are synthetic and tenant-local.
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
  reloadStudentApp,
  selectParentStudentThroughUi,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle } from "../helpers/wait";
import { guardUnmockedYouTubeRequests, installYouTubeSdkFixture } from "../helpers/youtubeSdkFixture";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });

type CreatedState = {
  family: QaFamily | null;
  adminAccess: string;
  lectureId?: number;
  sessionId?: number;
  enrollmentIds: number[];
  sessionEnrollmentIds: number[];
  attendanceIds: number[];
  videoId?: number;
  materialId?: number;
};

const created: CreatedState = {
  family: null,
  adminAccess: "",
  enrollmentIds: [],
  sessionEnrollmentIds: [],
  attendanceIds: [],
};

const runStamp = Date.now();
const todayKst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const lectureTitle = `QA 학습 projection ${runStamp}`;
const sessionTitle = `QA 학습 1차시 ${runStamp}`;
const videoTitle = `QA 학습 영상 ${runStamp}`;
const materialTitle = `QA 학습 자료 ${runStamp}`;
const materialBody = `qa-* 학생/학부모 자료 본문 ${runStamp}`;

async function selectedGet<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  selectedStudentId: number,
): Promise<T> {
  const response = await request.get(`${QA_API}/api/v1${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Code": QA_TENANT,
      "X-Student-Id": String(selectedStudentId),
    },
    timeout: 60_000,
  });
  expect(response.status(), `selected child GET ${path}`).toBe(200);
  return await response.json() as T;
}

async function selectedPost<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  selectedStudentId: number,
  data: Record<string, unknown>,
): Promise<T> {
  const response = await request.post(`${QA_API}/api/v1${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Code": QA_TENANT,
      "X-Student-Id": String(selectedStudentId),
    },
    data,
    timeout: 60_000,
  });
  expect([200, 201], `selected child POST ${path}`).toContain(response.status());
  return await response.json() as T;
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

  if (created.materialId) await remove("DELETE", `/community/posts/${created.materialId}/`);
  if (created.videoId) await remove("DELETE", `/media/videos/${created.videoId}/`);
  for (const id of created.attendanceIds) await remove("DELETE", `/lectures/attendance/${id}/`);
  for (const id of created.sessionEnrollmentIds) {
    await remove("DELETE", `/enrollments/session-enrollments/${id}/`);
  }
  for (const id of created.enrollmentIds) await remove("DELETE", `/enrollments/${id}/`);
  // Video deletion is intentionally soft so learning history remains protected.
  // The fixed isolated-tenant cleanup removes those protected ancestors and proves zero residue.
  if (!created.videoId && created.sessionId) {
    await remove("DELETE", `/lectures/sessions/${created.sessionId}/`);
  }
  if (!created.videoId && created.lectureId) {
    await remove("DELETE", `/lectures/lectures/${created.lectureId}/`);
  }
  await cleanupQaFamily(request, created.adminAccess, created.family);

  for (const [label, path] of [
    ...(created.materialId ? [[`material ${created.materialId}`, `/community/posts/${created.materialId}/`] as const] : []),
    ...(created.videoId ? [[`video ${created.videoId}`, `/media/videos/${created.videoId}/`] as const] : []),
    ...(!created.videoId && created.sessionId ? [[`session ${created.sessionId}`, `/lectures/sessions/${created.sessionId}/`] as const] : []),
    ...(!created.videoId && created.lectureId ? [[`lecture ${created.lectureId}`, `/lectures/lectures/${created.lectureId}/`] as const] : []),
  ]) {
    const residue = await api(request, "GET", path, created.adminAccess);
    if (residue.status !== 404) failures.push(`verify ${label} absent -> ${residue.status}`);
  }
  if (failures.length) throw new Error(`student/parent learning cleanup failed:\n${failures.join("\n")}`);
}

async function seedLearningGraph(request: APIRequestContext, adminAccess: string, family: QaFamily): Promise<void> {
  const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", adminAccess, {
    title: lectureTitle,
    name: "QA학습",
    subject: "수학",
    description: "qa-* student/parent learning projection",
    start_date: todayKst,
    lecture_time: "목 19:00 ~ 21:00",
    color: "#0f766e",
    chip_label: "학습",
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
    { lecture: created.lectureId, students: family.students.map((student) => student.id) },
  );
  created.enrollmentIds = enrollments.map((row) => Number(row.id));
  const sessionEnrollments = await expectApi<Array<{ id: number }>>(
    request,
    "POST",
    "/enrollments/session-enrollments/bulk_create/",
    adminAccess,
    { session: created.sessionId, enrollments: created.enrollmentIds },
  );
  created.sessionEnrollmentIds = sessionEnrollments.map((row) => Number(row.id));

  const attendance = await expectApi<Array<{ id: number }>>(
    request,
    "POST",
    "/lectures/attendance/bulk_create/",
    adminAccess,
    { session: created.sessionId, students: family.students.map((student) => student.id) },
    [201],
  );
  created.attendanceIds = attendance.map((row) => Number(row.id));
  await expectApi(request, "PATCH", `/lectures/attendance/${created.attendanceIds[0]}/`, adminAccess, {
    status: "PRESENT",
  });
  await expectApi(request, "PATCH", `/lectures/attendance/${created.attendanceIds[1]}/`, adminAccess, {
    status: "ABSENT",
  });

  const videoResponse = await expectApi<{ video: { id: number } }>(
    request,
    "POST",
    "/media/videos/youtube/",
    adminAccess,
    {
      session: created.sessionId,
      title: videoTitle,
      url: "https://youtu.be/VnqgmOJaMGc",
      show_watermark: false,
      allow_skip: true,
      max_speed: 1,
    },
    [201],
  );
  created.videoId = Number(videoResponse.video.id);

  const material = await expectApi<{ id: number }>(request, "POST", "/community/posts/", adminAccess, {
    post_type: "materials",
    title: materialTitle,
    content: materialBody,
    node_ids: [],
    status: "published",
  }, [201]);
  created.materialId = Number(material.id);
}

test.describe.serial("[real-use] 학생/학부모 학습 projection", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Enable only inside the isolated qa-* development runner.");

  test.beforeAll(() => {
    assertQaStudentParentRuntime();
  });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("강의·출결·영상 진행률·자료를 자녀별로 저장/조회하고 reload/relogin한다", async ({ page, request }) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const unexpectedYouTubeRequests = await guardUnmockedYouTubeRequests(page);
    await page.route(/https:\/\/(?:i\.ytimg\.com|img\.youtube\.com)\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
      });
    });
    const youtube = await installYouTubeSdkFixture(page);
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    created.adminAccess = admin.access;
    created.family = await createQaFamily(request, admin.access, "learning", 2);
    const [primary, sibling] = created.family.students;
    await seedLearningGraph(request, admin.access, created.family);

    const primaryTokens = await loginApi(request, primary.ps_number, primary.password);
    await expectApi(request, "POST", `/student/video/videos/${created.videoId}/progress/`, primaryTokens.access, {
      progress: 20,
      last_position: 60,
      enrollment_id: created.enrollmentIds[0],
    }, [200, 201]);

    const primaryVideos = await expectApi<{ items: Array<{ id: number; progress: number }> }>(
      request,
      "GET",
      `/student/video/sessions/${created.sessionId}/videos/?enrollment=${created.enrollmentIds[0]}`,
      primaryTokens.access,
    );
    expect(primaryVideos.items.find((video) => video.id === created.videoId)?.progress).toBeGreaterThanOrEqual(20);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginThroughUi(page, primary.ps_number, primary.password);
    await gotoAndSettle(page, `${QA_BASE}/student/attendance`, { timeout: 30_000 });
    const attendanceLink = page.getByRole("link").filter({ hasText: lectureTitle }).first();
    await expect(attendanceLink).toBeVisible();
    await expect(attendanceLink).toContainText("출석");
    await attendanceLink.click();
    await expect(page.getByText(sessionTitle, { exact: true }).first()).toBeVisible();

    await gotoAndSettle(page, `${QA_BASE}/student/video/courses/${created.lectureId}`, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: lectureTitle })).toBeVisible();
    await expect(page.getByText(sessionTitle, { exact: true })).toBeVisible();
    await gotoAndSettle(
      page,
      `${QA_BASE}/student/video/sessions/${created.sessionId}?enrollment=${created.enrollmentIds[0]}`,
      { timeout: 30_000 },
    );
    await expect(page.getByText(videoTitle, { exact: true })).toBeVisible();
    await expect(page.getByText("20% 진행", { exact: true }).first()).toBeVisible();

    await gotoAndSettle(page, `${QA_BASE}/student/community`, { timeout: 30_000 });
    await page.getByRole("button", { name: "자료실" }).click();
    await expect(page.getByText(materialTitle, { exact: true })).toBeVisible();
    await page.getByText(materialTitle, { exact: true }).click();
    await expect(page.getByText(materialBody, { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await logoutStudentApp(page);
    await loginThroughUi(page, created.family.parentPhone, created.family.parentPassword);
    await selectParentStudentThroughUi(page, primary);
    const parentTokens = await loginApi(request, created.family.parentPhone, created.family.parentPassword);
    const parentProgress = await selectedPost<{
      progress: number;
      progress_percent?: number;
      last_position: number;
      enrollment_id: number;
    }>(
      request,
      parentTokens.access,
      `/student/video/videos/${created.videoId}/progress/`,
      primary.id,
      {
        progress: 55,
        last_position: 165,
        enrollment_id: created.enrollmentIds[0],
      },
    );
    expect(parentProgress.enrollment_id).toBe(created.enrollmentIds[0]);
    expect(parentProgress.progress_percent ?? parentProgress.progress).toBeGreaterThanOrEqual(55);
    expect(parentProgress.last_position).toBe(165);
    const primaryAttendance = await selectedGet<{
      recent: Array<{ lecture_title: string; status: string }>;
    }>(request, parentTokens.access, "/student/attendance/summary/", primary.id);
    expect(primaryAttendance.recent).toContainEqual(expect.objectContaining({
      lecture_title: lectureTitle,
      status: "PRESENT",
    }));
    const parentPrimaryVideos = await selectedGet<{ items: Array<{ id: number; progress: number }> }>(
      request,
      parentTokens.access,
      `/student/video/sessions/${created.sessionId}/videos/?enrollment=${created.enrollmentIds[0]}`,
      primary.id,
    );
    expect(parentPrimaryVideos.items.find((video) => video.id === created.videoId)?.progress).toBeGreaterThanOrEqual(55);

    await gotoAndSettle(page, `${QA_BASE}/student/attendance`, { timeout: 30_000 });
    await expect(page.getByRole("link").filter({ hasText: lectureTitle }).first()).toContainText("출석");
    await gotoAndSettle(
      page,
      `${QA_BASE}/student/video/sessions/${created.sessionId}?enrollment=${created.enrollmentIds[0]}`,
      { timeout: 30_000 },
    );
    await expect(page.getByText("55% 진행", { exact: true }).first()).toBeVisible();
    await page.getByText(videoTitle, { exact: true }).click();
    await expect(page.getByRole("heading", { name: videoTitle })).toBeVisible();
    await expect.poll(async () => (await youtube.snapshot()).players.some((player) => player.ready && !player.destroyed)).toBe(true);
    await expect(page.getByText("재생 화면을 준비하고 있어요…", { exact: true })).toBeHidden();
    // Unrestricted YouTube playback keeps the provider's native controls; the
    // Academy play button is reserved for monitored/budgeted-seek sessions.
    await expect(page.locator("[data-youtube-sdk-fixture]")).toBeVisible();
    await expect(page.getByRole("button", { name: "재생", exact: true })).toHaveCount(0);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await selectParentStudentThroughUi(page, sibling);
    await gotoAndSettle(page, `${QA_BASE}/student/attendance`, { timeout: 30_000 });
    await expect(page.getByRole("link").filter({ hasText: lectureTitle }).first()).toContainText("결석");
    const siblingAttendance = await selectedGet<{
      recent: Array<{ lecture_title: string; status: string }>;
    }>(request, parentTokens.access, "/student/attendance/summary/", sibling.id);
    expect(siblingAttendance.recent).toContainEqual(expect.objectContaining({
      lecture_title: lectureTitle,
      status: "ABSENT",
    }));
    const siblingVideos = await selectedGet<{ items: Array<{ id: number; progress: number }> }>(
      request,
      parentTokens.access,
      `/student/video/sessions/${created.sessionId}/videos/?enrollment=${created.enrollmentIds[1]}`,
      sibling.id,
    );
    expect(siblingVideos.items.find((video) => video.id === created.videoId)?.progress ?? 0).toBe(0);

    await reloadStudentApp(page);
    await expect(page.getByRole("tab", { name: sibling.name })).toHaveAttribute("aria-selected", "true");
    await logoutStudentApp(page);
    await loginThroughUi(page, created.family.parentPhone, created.family.parentPassword);
    await expect(page.getByRole("tab", { name: sibling.name })).toHaveAttribute("aria-selected", "true");
    await selectParentStudentThroughUi(page, primary);
    await gotoAndSettle(
      page,
      `${QA_BASE}/student/video/sessions/${created.sessionId}?enrollment=${created.enrollmentIds[0]}`,
      { timeout: 30_000 },
    );
    await expect(page.getByText("55% 진행", { exact: true }).first()).toBeVisible();

    await logoutStudentApp(page);
    await loginThroughUi(page, primary.ps_number, primary.password);
    await gotoAndSettle(
      page,
      `${QA_BASE}/student/video/sessions/${created.sessionId}?enrollment=${created.enrollmentIds[0]}`,
      { timeout: 30_000 },
    );
    await expect(page.getByText("55% 진행", { exact: true }).first()).toBeVisible();

    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, `${QA_BASE}/student/community`, { timeout: 30_000 });
    await page.getByRole("button", { name: "자료실" }).click();
    await expect(page.getByText(materialTitle, { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    boundary.assertClean();
    browser.assertZeroDefects();
    expect(unexpectedYouTubeRequests).toEqual([]);
  });
});
