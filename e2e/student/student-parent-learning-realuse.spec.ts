/**
 * Lecture, attendance, video-progress, and materials projection for a student
 * and the same child's parent. All records are synthetic and tenant-local.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
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
  selectParentStudentThroughUi,
  STUDENT_PARENT_REALUSE_ENABLED,
  type QaFamily,
} from "../helpers/qaStudentParentScenario";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { gotoAndSettle } from "../helpers/wait";
import { verifyStudentLearningSummary } from "../helpers/studentLearningSummary";
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

async function seedLearningGraph(request: APIRequestContext, adminAccess: string, family: QaFamily, enrollmentPage: Page, testInfo: TestInfo): Promise<void> {
  // Create through the teacher UI while an unrelated past-lecture search is active.
  // The saved lecture must become visible without asking the teacher to clear it.
  await enrollmentPage.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(enrollmentPage, `${QA_BASE}/workspace/mobile/classes?tab=past&q=qa-no-match-${runStamp}`, { timeout: 30_000 });
  await enrollmentPage.getByRole("button", { name: "강의 추가", exact: true }).click();
  await enrollmentPage.getByLabel("강의명 *", { exact: true }).fill(`${lectureTitle} 수정 전`);
  await enrollmentPage.getByLabel("강사 *", { exact: true }).fill("QA학습");
  await enrollmentPage.getByLabel("과목 *", { exact: true }).fill("수학");
  await enrollmentPage.getByLabel("수업 시간 *", { exact: true }).fill("19:00~21:00");
  await enrollmentPage.getByLabel("강의 딱지 2글자", { exact: true }).fill("학습");
  await enrollmentPage.getByLabel("시작일", { exact: true }).fill(todayKst);
  await enrollmentPage.getByLabel("종료일", { exact: true }).fill(todayKst);
  const createResponse = enrollmentPage.waitForResponse((response) =>
    response.url().endsWith("/lectures/lectures/") && response.request().method() === "POST",
  );
  await enrollmentPage.getByRole("button", { name: "생성", exact: true }).click();
  const response = await createResponse;
  expect(response.status()).toBe(201);
  created.lectureId = Number((await response.json()).id);
  expect(created.lectureId).toBeGreaterThan(0);
  await expect(enrollmentPage).toHaveURL(/\/workspace\/mobile\/classes$/);
  await expect(enrollmentPage.getByRole("searchbox", { name: "강의 찾기" })).toHaveValue("");
  await enrollmentPage.reload({ waitUntil: "domcontentloaded" });
  await expect(enrollmentPage.getByRole("button").filter({ has: enrollmentPage.getByText(`${lectureTitle} 수정 전`, { exact: true }) })).toBeVisible();
  // Seed only the admin-editor fixture fields not offered by the teacher form.
  await expectApi(request, "PATCH", `/lectures/lectures/${created.lectureId}/`, adminAccess, {
    description: "qa-* student/parent learning projection",
    color: "#0f766e",
  });

  // Edit through the same-artifact staff UI; all later student/parent checks
  // consume this saved title and the existing tenant-local learning graph.
  await enrollmentPage.setViewportSize({ width: 1366, height: 900 });
  await gotoAndSettle(enrollmentPage, `${QA_BASE}/workspace/lectures`, { timeout: 30_000 });
  await enrollmentPage.getByRole("button", { name: `${lectureTitle} 수정 전 설정`, exact: true }).click();
  await enrollmentPage.getByRole("menuitem", { name: "강의 수정", exact: true }).click();
  const editor = enrollmentPage.getByRole("dialog", { name: "강의 수정", exact: true });
  await expect(editor.getByLabel("강의 이름 (필수)")).toHaveValue(`${lectureTitle} 수정 전`);
  await expect(editor.getByLabel("과목 (필수)")).toHaveValue("수학");
  await expect(editor.getByLabel("담당 강사 (필수)")).toContainText("QA학습");
  await expect(editor.getByLabel("설명", { exact: true })).toHaveValue("qa-* student/parent learning projection");
  await editor.screenshot({ path: testInfo.outputPath("lecture-edit-desktop.png") });
  await enrollmentPage.setViewportSize({ width: 390, height: 844 });
  await editor.getByLabel("강의 이름 (필수)").fill(lectureTitle);
  await editor.getByRole("button", { name: "종료일 지우기", exact: true }).click();
  await assertNoHorizontalOverflow(enrollmentPage);
  await editor.screenshot({ path: testInfo.outputPath("lecture-edit-390.png") });
  const editResponse = enrollmentPage.waitForResponse((response) =>
    response.url().endsWith(`/lectures/lectures/${created.lectureId}/`) && response.request().method() === "PATCH",
  );
  await editor.getByRole("button", { name: "수정", exact: true }).click();
  expect((await editResponse).status()).toBe(200);
  await expect(editor).toHaveCount(0);
  const persisted = await expectApi<Record<string, unknown>>(request, "GET", `/lectures/lectures/${created.lectureId}/`, adminAccess);
  expect(persisted).toMatchObject({ title: lectureTitle, name: "QA학습", subject: "수학", end_date: null, chip_label: "학습", color: "#0f766e", lecture_time: "19:00~21:00" });
  await enrollmentPage.reload({ waitUntil: "domcontentloaded" });
  await expect(enrollmentPage.getByRole("link", { name: `${lectureTitle} 강의 열기`, exact: true })).toBeVisible();

  // Exercise the staff entry before any session exists, then consume the same
  // persisted enrollments throughout teacher/student/parent learning checks.
  await enrollmentPage.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(enrollmentPage, `${QA_BASE}/workspace/lectures/${created.lectureId}`, { timeout: 30_000 });
  await enrollmentPage.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
  const picker = enrollmentPage.getByRole("dialog", { name: "수강생 등록", exact: true });
  for (const student of family.students) {
    await picker.getByRole("textbox", { name: "학생 검색" }).fill(student.name);
    await picker.getByRole("checkbox", { name: `${student.name} 선택`, exact: true }).check();
  }
  await assertNoHorizontalOverflow(enrollmentPage);
  await expect(picker.getByRole("textbox", { name: "학생 검색" })).toBeInViewport();
  await expect(picker.getByRole("button", { name: "2명 강의에 추가", exact: true })).toBeInViewport();
  expect(await picker.locator(".modal-body").evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await picker.screenshot({ path: testInfo.outputPath("lecture-enrollment-390.png") });
  const enrollmentResponse = enrollmentPage.waitForResponse((response) =>
    response.url().endsWith("/enrollments/bulk_create/") && response.request().method() === "POST",
  );
  await picker.getByRole("button", { name: "2명 강의에 추가", exact: true }).click();
  const saved = await enrollmentResponse;
  expect(saved.status()).toBe(201);
  const enrollments = await saved.json() as Array<{ id: number; student: { id: number }; status: string }>;
  created.enrollmentIds = enrollments.map((row) => Number(row.id));
  expect(enrollments).toHaveLength(2);
  expect(enrollments.every((row) => row.status === "ACTIVE")).toBe(true);
  created.enrollmentIds = family.students.map((student) => enrollments.find((row) => row.student.id === student.id)!.id);
  await expect(picker).toHaveCount(0);
  await enrollmentPage.reload({ waitUntil: "domcontentloaded" });
  for (const student of family.students) await expect(enrollmentPage.getByText(student.name, { exact: true }).first()).toBeVisible();
  await enrollmentPage.setViewportSize({ width: 1366, height: 900 });
  await enrollmentPage.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
  await picker.getByRole("textbox", { name: "학생 검색" }).fill(family.students[0].name);
  await expect(picker.getByRole("checkbox", { name: `${family.students[0].name} 선택`, exact: true })).toBeDisabled();
  await assertNoHorizontalOverflow(enrollmentPage);
  await picker.screenshot({ path: testInfo.outputPath("lecture-enrollment-desktop.png") });
  await picker.getByRole("button", { name: "취소", exact: true }).click();
  const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", adminAccess, {
    lecture: created.lectureId,
    title: sessionTitle,
    date: todayKst,
    order: 1,
  });
  created.sessionId = Number(session.id);


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

  // The unmocked server must order the full Korean name, including its letter
  // suffix, before pagination. Creation order is intentionally the reverse.
  await gotoAndSettle(enrollmentPage, `${QA_BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/attendance`);
  const alphabetical = enrollmentPage.getByRole("button", { name: "가나다순", exact: true });
  const names = enrollmentPage.locator('tbody a[aria-label$=" 학생 상세 열기"]');
  const expectedNames = ["김가온A 학생 상세 열기", "황가온 학생 상세 열기"];
  const expectNameOrder = async () => {
    await expect.poll(() => names.evaluateAll((links) => links.map((link) => link.getAttribute("aria-label")))).toEqual(expectedNames);
  };
  await alphabetical.click();
  await expectNameOrder();
  await enrollmentPage.getByRole("columnheader", { name: /이름/ }).click();
  await expect(names.first()).toHaveAttribute("aria-label", "황가온 학생 상세 열기");
  await alphabetical.click();
  await expectNameOrder();
  await enrollmentPage.reload({ waitUntil: "domcontentloaded" });
  await expect(alphabetical).toHaveAttribute("aria-pressed", "true");
  await expectNameOrder();
  for (const width of [1366, 390]) {
    await enrollmentPage.setViewportSize({ width, height: 844 });
    await expect(alphabetical).toBeInViewport();
    await assertNoHorizontalOverflow(enrollmentPage);
    await names.first().scrollIntoViewIfNeeded();
    await enrollmentPage.screenshot({ path: testInfo.outputPath(`attendance-letter-suffix-realuse-${width}.png`), fullPage: true });
  }

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

  test("강의·출결·영상 진행률·자료를 자녀별로 저장/조회하고 reload/relogin한다", async ({ page, request }, testInfo) => {
    const boundary = await installQaStudentParentBoundary(page, request);
    const unexpectedYouTubeRequests = await guardUnmockedYouTubeRequests(page);
    await page.route(/https:\/\/(?:i\.ytimg\.com|img\.youtube\.com)\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
      });
    });
    const youtube = await installYouTubeSdkFixture(page, { renderNativeControls: true });
    const browser = attachStrictBrowserGuards(page);
    const admin = await loginAdmin(request);
    created.adminAccess = admin.access;
    created.family = await createQaFamily(request, admin.access, "learning", 2);
    for (const [index, name] of ["황가온", "김가온A"].entries()) {
      const student = created.family.students[index];
      const renamed = await expectApi<{ name: string }>(request, "PATCH", `/students/${student.id}/`, admin.access, { name });
      expect(renamed.name).toBe(name);
      student.name = name;
    }
    const [primary, sibling] = created.family.students;
    const enrollmentContext = await page.context().browser()!.newContext({ serviceWorkers: "block" });
    try {
      const enrollmentPage = await enrollmentContext.newPage();
      const enrollmentBoundary = await installQaStudentParentBoundary(enrollmentPage, request);
      const enrollmentBrowser = attachStrictBrowserGuards(enrollmentPage);
      await seedBrowserAuth(enrollmentPage, admin);
      await seedLearningGraph(request, admin.access, created.family, enrollmentPage, testInfo);
      enrollmentBoundary.assertClean();
      enrollmentBrowser.assertZeroDefects();
    } finally {
      await enrollmentContext.close();
    }

    // The same synthetic video must also reach the teacher list through the real
    // API. Failure/retry injection remains in public-video-preparation.mock.spec.
    const teacherContext = await page.context().browser()!.newContext({ serviceWorkers: "block" });
    try {
      const teacherPage = await teacherContext.newPage();
      const teacherBoundary = await installQaStudentParentBoundary(teacherPage, request);
      const teacherBrowser = attachStrictBrowserGuards(teacherPage);
      await teacherPage.route(/https:\/\/(?:i\.ytimg\.com|img\.youtube\.com)\//, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "image/gif",
          body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
        });
      });
      // The separate long-playback fixture has no worker-produced list thumbnail.
      // Keep its exact synthetic image local; the list response remains real.
      const longVideoId = process.env.E2E_LONG_VIDEO_ID ?? "";
      const longVideoTenantId = process.env.E2E_LONG_VIDEO_TENANT_ID ?? "";
      expect(longVideoId).toMatch(/^[1-9][0-9]*$/);
      expect(longVideoTenantId).toMatch(/^[1-9][0-9]*$/);
      const longVideo = await expectApi<{ thumbnail_url: string | null }>(
        request, "GET", `/media/videos/${longVideoId}/`, admin.access,
      );
      if (longVideo.thumbnail_url) {
        const thumbnail = new URL(longVideo.thumbnail_url);
        expect(thumbnail.protocol).toBe("https:");
        expect(thumbnail.pathname).toBe(`/tenants/${longVideoTenantId}/video/hls/${longVideoId}/thumbnail.jpg`);
        await teacherPage.route((url) => (
          // The signature expiry changes between the detail and list responses.
          url.origin === thumbnail.origin && url.pathname === thumbnail.pathname
        ), async (route) => {
          expect(route.request().method()).toBe("GET");
          expect(route.request().resourceType()).toBe("image");
          await route.fulfill({
            status: 200,
            contentType: "image/gif",
            body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
          });
        });
      }
      await seedBrowserAuth(teacherPage, admin);
      for (const width of [390, 1366]) {
        await teacherPage.setViewportSize({ width, height: 900 });
        await gotoAndSettle(teacherPage, `${QA_BASE}/workspace/mobile/classes`, { timeout: 30_000 });
        await teacherPage.getByRole("searchbox", { name: "강의 찾기" }).fill(lectureTitle);
        const lectureEntry = teacherPage.getByRole("button").filter({ has: teacherPage.getByText(lectureTitle, { exact: true }) });
        await expect(lectureEntry).toBeVisible();
        await lectureEntry.click();
        await expect(teacherPage.getByRole("button", { name: "수강생 (2)", exact: true })).toBeVisible();
        await teacherPage.getByRole("button", { name: "수강생 (2)", exact: true }).click();
        await teacherPage.reload({ waitUntil: "domcontentloaded" });
        await expect(teacherPage.getByRole("button", { name: "수강생 (2)", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(teacherPage.getByText(primary.name, { exact: true })).toBeVisible();
        await teacherPage.getByRole("button", { name: "뒤로 가기", exact: true }).click();
        await expect(teacherPage.getByRole("searchbox", { name: "강의 찾기" })).toHaveValue(lectureTitle);
        await assertNoHorizontalOverflow(teacherPage);
        await gotoAndSettle(teacherPage, `${QA_BASE}/workspace/mobile/attendance/${created.sessionId}`, { timeout: 30_000 });
        await expect(teacherPage.getByText("총 2명", { exact: true })).toBeVisible();
        for (const [label, status, absentCount] of [["결석", "ABSENT", 2], ["출석", "PRESENT", 1]] as const) {
          await teacherPage.getByText(primary.name, { exact: true }).click();
          const saved = teacherPage.waitForResponse((response) => (
            response.request().method() === "PATCH"
            && new URL(response.url()).pathname === `/api/v1/lectures/attendance/${created.attendanceIds[0]}/`
          ));
          await teacherPage.getByRole("button", { name: label, exact: true }).click();
          expect((await saved).status()).toBe(200);
          const persisted = await expectApi<{ status: string }>(
            request, "GET", `/lectures/attendance/${created.attendanceIds[0]}/`, admin.access,
          );
          expect(persisted.status).toBe(status);
          await teacherPage.reload();
          await expect(teacherPage.getByText("총 2명", { exact: true })).toBeVisible();
          await expect(teacherPage.getByText(`결석 ${absentCount}`, { exact: true })).toBeVisible();
        }
        // Exercise the actual undo control before leaving the successful save's window.
        await teacherPage.getByText(primary.name, { exact: true }).click();
        const absentSaved = teacherPage.waitForResponse((response) => (
          response.request().method() === "PATCH"
          && new URL(response.url()).pathname === `/api/v1/lectures/attendance/${created.attendanceIds[0]}/`
        ));
        await teacherPage.getByRole("button", { name: "결석", exact: true }).click();
        expect((await absentSaved).status()).toBe(200);
        await expect(teacherPage.getByText("결석 2", { exact: true })).toBeVisible();
        const undoSaved = teacherPage.waitForResponse((response) => (
          response.request().method() === "PATCH"
          && new URL(response.url()).pathname === `/api/v1/lectures/attendance/${created.attendanceIds[0]}/`
        ));
        await teacherPage.getByRole("button", { name: "되돌리기", exact: true }).click();
        expect((await undoSaved).status()).toBe(200);
        const restored = await expectApi<{ status: string }>(
          request, "GET", `/lectures/attendance/${created.attendanceIds[0]}/`, admin.access,
        );
        expect(restored.status).toBe("PRESENT");
        await teacherPage.reload();
        await expect(teacherPage.getByText("총 2명", { exact: true })).toBeVisible();
        await expect(teacherPage.getByText("결석 1", { exact: true })).toBeVisible();
        await assertNoHorizontalOverflow(teacherPage);
        await gotoAndSettle(teacherPage, `${QA_BASE}/workspace/mobile/classes/${created.lectureId}/sessions/${created.sessionId}`, { timeout: 30_000 });
        await expect(teacherPage.getByRole("button").filter({ has: teacherPage.getByText(primary.name, { exact: true }) })).toContainText("출석");
        const responsePromise = teacherPage.waitForResponse((response) => (
          response.request().method() === "GET"
          && new URL(response.url()).pathname === "/api/v1/media/videos/"
        ));
        await gotoAndSettle(teacherPage, `${QA_BASE}/workspace/mobile/videos`, { timeout: 30_000 });
        expect((await responsePromise).status()).toBe(200);
        const videoButton = teacherPage.getByRole("button", { name: videoTitle, exact: true });
        await expect(videoButton).toBeVisible();
        await expect(teacherPage.getByText("등록된 영상이 없습니다", { exact: true })).toHaveCount(0);
        await expect(teacherPage.getByText(/영상 목록을 (?:새로 )?불러오지 못했습니다/)).toHaveCount(0);
        await teacherPage.reload({ waitUntil: "domcontentloaded" });
        await expect(videoButton).toBeVisible();
        await assertNoHorizontalOverflow(teacherPage);
        await testInfo.attach(`teacher-video-list-${width}`, {
          body: await teacherPage.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }
      teacherBoundary.assertClean();
      teacherBrowser.assertZeroDefects();
    } finally {
      await teacherContext.close();
    }

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
    await verifyStudentLearningSummary(page, QA_BASE);
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
    await page.setViewportSize({ width: 1366, height: 900 });
    await verifyStudentLearningSummary(page, QA_BASE);
    await page.setViewportSize({ width: 390, height: 844 });
    const parentTokens = await loginApi(request, created.family.parentPhone, created.family.parentPassword);
    const missingSelection = await request.get(
      `${QA_API}/api/v1/student/video/sessions/${created.sessionId}/videos/?enrollment=${created.enrollmentIds[0]}`,
      {
        headers: {
          Authorization: `Bearer ${parentTokens.access}`,
          "X-Tenant-Code": QA_TENANT,
        },
        timeout: 60_000,
      },
    );
    expect(missingSelection.status()).toBe(403);
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
    await expect.poll(async () => (await youtube.snapshot()).players.some((player) => (
      player.ready
      && !player.destroyed
      && player.controls === 1
      && player.disableKeyboard === 0
    ))).toBe(true);
    await expect(page.getByText("재생 화면을 준비하고 있어요…", { exact: true })).toBeHidden();
    // Unrestricted YouTube playback keeps the provider's native controls; the
    // Academy play button is reserved for monitored/budgeted-seek sessions.
    await expect(page.locator("[data-youtube-sdk-fixture]")).toBeVisible();
    await expect(page.getByRole("button", { name: "재생", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "YouTube 재생", exact: true }).click();
    await expect.poll(async () => (await youtube.snapshot()).players.some((player) => (
      player.ready && !player.destroyed && player.state === 1 && player.calls.includes("playVideo")
    ))).toBe(true);
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
