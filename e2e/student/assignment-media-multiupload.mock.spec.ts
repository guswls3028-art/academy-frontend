import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const HOMEWORK_ID = 8501;
const ENROLLMENT_ID = 8601;

test.use({ serviceWorkers: "block" });

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 72,
  })}.sig`;
}

function multipartValue(body: string, field: string): string {
  return body.match(new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]+)`))?.[1] ?? "";
}

function multipartFilename(body: string): string {
  return body.match(/filename="([^"]+)"/)?.[1] ?? "제출 파일";
}

type Media = Record<string, unknown>;
type Viewer = "student" | "parent";

async function installApi(
  page: Page,
  firstUploadDelayMs = 450,
  viewer: Viewer = "student",
  homeworkOverrides: Record<string, unknown> = {},
  reviewLockOnFirstUpload = false,
  backgroundMediaReadDelayMs = 0,
  positionRaceUploadAttempts: readonly number[] = [],
) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "과제 다건 업로드 route-mock 검증은 로컬 dev 서버 전용",
  );
  const token = fakeJwt();
  const files: Media[] = [{
    id: "801",
    legacy: true,
    client_file_id: null,
    upload_batch_id: null,
    position: 0,
    original_filename: "기존 제출.jpg",
    media_kind: "image",
    mime_type: "image/jpeg",
    file_size: 1400,
    status: "uploaded",
    error_message: "",
    upload_started_at: "2026-08-23T00:00:00Z",
    uploaded_at: "2026-08-23T00:00:01Z",
    failed_at: null,
    removed_at: null,
    created_at: "2026-08-23T00:00:00Z",
  }];
  const concurrentStudentUpload: Media = {
    ...files[0],
    id: "902",
    original_filename: "학생-POST직전-제출.png",
  };
  const failedClientIds = new Set<string>();
  const uploadClientIds: string[] = [];
  const studentScopedHeaders: Array<string | undefined> = [];
  let uploadAttempts = 0;
  let mediaReadCount = 0;
  let currentHomeworkOverrides = homeworkOverrides;

  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith("/token/refresh/")) return json({ access: token, refresh: `${token}-refresh` });
    if (path.endsWith("/core/program/")) {
      return json({ tenantCode: "hakwonplus", display_name: "학원플러스", is_active: true, feature_flags: {}, ui_config: {} });
    }
    if (path.endsWith("/core/me/")) {
      return json(viewer === "parent"
        ? {
            id: 920,
            username: "parent-920",
            name: "김보호",
            is_staff: false,
            is_superuser: false,
            tenantRole: "parent",
            linkedStudents: [{ id: 72, name: "김하늘" }],
            linkedStudentName: "김하늘",
          }
        : { id: 72, username: "student-72", name: "김하늘", is_staff: false, is_superuser: false, tenantRole: "student", linkedStudents: [] });
    }
    if (path.endsWith("/student/me/")) {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      return json({
        id: 72,
        name: "김하늘",
        displayName: viewer === "parent" ? "김하늘 학생 학부모님" : "김하늘",
        is_student: true,
        isParentReadOnly: viewer === "parent",
      });
    }
    if (path.endsWith("/student/grades/")) {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      return json({
        exams: [],
        homeworks: [{
          homework_id: HOMEWORK_ID,
          enrollment_id: ENROLLMENT_ID,
          session_id: 8701,
          title: "도형 풀이 인증",
          score: null,
          max_score: 100,
          passed: false,
          achievement: "NOT_SUBMITTED",
          lecture_title: "고1 수학",
          ...currentHomeworkOverrides,
        }],
        exam_trend: [],
        exam_summary: {},
        lecture_options: [],
      });
    }
    if (path.endsWith(`/submissions/submissions/homework/${HOMEWORK_ID}/media/`) && request.method() === "GET") {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      mediaReadCount += 1;
      if (mediaReadCount === 2 && backgroundMediaReadDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, backgroundMediaReadDelayMs));
      }
      return json({
        files,
        limits: {
          max_files: 20,
          max_file_size_bytes: 100 * 1024 * 1024,
          max_total_size_bytes: 500 * 1024 * 1024,
        },
      });
    }
    if (path.endsWith(`/submissions/submissions/homework/${HOMEWORK_ID}/media/`) && request.method() === "POST") {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      uploadAttempts += 1;
      if (reviewLockOnFirstUpload && uploadAttempts === 1) {
        currentHomeworkOverrides = {
          ...currentHomeworkOverrides,
          submission_media_locked: true,
        };
        return json({
          code: "HOMEWORK_MEDIA_REVIEWED",
          detail: "완료 또는 통과한 과제 파일은 변경할 수 없습니다.",
        }, 409);
      }
      const body = request.postData() ?? "";
      const clientId = multipartValue(body, "client_file_id");
      const batchId = multipartValue(body, "upload_batch_id");
      const position = Number(multipartValue(body, "position"));
      const filename = multipartFilename(body);
      const isVideo = /\.mp4$/i.test(filename);
      uploadClientIds.push(clientId);
      if (positionRaceUploadAttempts.includes(uploadAttempts)) {
        files.push({
          ...concurrentStudentUpload,
          id: String(901 + uploadAttempts),
          position: uploadAttempts - 1,
          original_filename: uploadAttempts === 1
            ? "학생-POST직전-제출.png"
            : `학생-재시도직전-${uploadAttempts}.png`,
        });
      }
      const positionOccupied = files.some((file) => (
        Number(file.position) === position
        && file.client_file_id !== clientId
        && file.status !== "removed"
      ));
      if (positionOccupied) {
        return json({
          code: "HOMEWORK_MEDIA_POSITION_CONFLICT",
          detail: "다른 제출 파일과 순서가 겹칩니다. 목록을 새로 확인한 뒤 다시 시도해 주세요.",
        }, 409);
      }
      await new Promise((resolve) => setTimeout(resolve, uploadAttempts === 1 ? firstUploadDelayMs : 450));
      const payload: Media = {
        id: String(801 + files.length),
        legacy: false,
        client_file_id: clientId,
        upload_batch_id: batchId,
        position,
        original_filename: filename,
        media_kind: isVideo ? "video" : "image",
        mime_type: isVideo ? "video/mp4" : "image/png",
        file_size: isVideo ? 2500 : 1800,
        status: "uploaded",
        error_message: "",
        upload_started_at: "2026-08-23T00:00:00Z",
        uploaded_at: "2026-08-23T00:00:01Z",
        failed_at: null,
        removed_at: null,
        created_at: "2026-08-23T00:00:00Z",
      };
      if (isVideo && !failedClientIds.has(clientId)) {
        failedClientIds.add(clientId);
        files.push({ ...payload, status: "failed", error_message: "파일 저장 실패", uploaded_at: null });
        return json({ code: "HOMEWORK_MEDIA_UPLOAD_FAILED", detail: "성공한 파일은 유지되며 이 파일만 다시 시도할 수 있습니다." }, 503);
      }
      const existingIndex = files.findIndex((file) => file.client_file_id === clientId);
      if (existingIndex >= 0) files[existingIndex] = payload;
      else files.push(payload);
      return json(payload, 201);
    }
    if (path.endsWith("/student/me/activity/homework-open/")) {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      return json({ ok: true });
    }
    return json({ count: 0, results: [] });
  });

  return {
    files,
    getUploadAttempts: () => uploadAttempts,
    getUploadClientIds: () => [...uploadClientIds],
    getStudentScopedHeaders: () => [...studentScopedHeaders],
  };
}

test("학부모가 선택 자녀의 과제를 제출하고 새로고침 뒤에도 같은 파일을 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page, 0, "parent");
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });

  await expect(page.getByText("학부모 계정은 직접 제출할 수 없습니다.")).toHaveCount(0);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "학부모-대리제출.png",
    mimeType: "image/png",
    buffer: Buffer.from("parent-proxy-proof"),
  });
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("region", { name: "이미 제출한 파일" })
    .getByText("학부모-대리제출.png", { exact: true })).toBeVisible();
  expect(state.getStudentScopedHeaders().length).toBeGreaterThan(0);
  expect(state.getStudentScopedHeaders().every((value) => value === "72")).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("parent_selected_student_id_hakwonplus"))).toBe("72");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("학생이 먼저 올린 직후 학부모는 백그라운드 재조회가 끝난 최신 순서로 제출한다", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page, 0, "parent", {}, false, 1_500);
  const studentUpload = {
    ...state.files[0],
    id: "901",
    original_filename: "학생-먼저-제출.png",
  };
  state.files.splice(0);

  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByText("0/20", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "홈", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  state.files.push(studentUpload);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/student\/submit\/assignment$/);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "사진·동영상 여러 개 선택", exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "학부모-이어서-제출.png",
    mimeType: "image/png",
    buffer: Buffer.from("parent-after-student-proof"),
  });
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();

  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(state.files.map((file) => file.position)).toEqual([0, 1]);
  expect(state.getStudentScopedHeaders().length).toBeGreaterThan(0);
  expect(state.getStudentScopedHeaders().every((value) => value === "72")).toBe(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  const restored = page.getByRole("region", { name: "이미 제출한 파일" });
  await expect(restored.getByText("학생-먼저-제출.png", { exact: true })).toBeVisible();
  await expect(restored.getByText("학부모-이어서-제출.png", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("parent_selected_student_id_hakwonplus"))).toBe("72");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("목록 조회 직후 학생이 순서를 선점해도 학부모 파일은 한 번 재배정해 제출한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page, 0, "parent", {}, false, 0, [1]);
  state.files.splice(0);

  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "학부모-POST직전-제출.png",
    mimeType: "image/png",
    buffer: Buffer.from("parent-post-race-proof"),
  });
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();

  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(state.getUploadAttempts()).toBe(2);
  expect(state.files.map((file) => file.position)).toEqual([0, 1]);
  expect(state.getStudentScopedHeaders().length).toBeGreaterThan(0);
  expect(state.getStudentScopedHeaders().every((value) => value === "72")).toBe(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  const restored = page.getByRole("region", { name: "이미 제출한 파일" });
  await expect(restored.getByText("학생-POST직전-제출.png", { exact: true })).toBeVisible();
  await expect(restored.getByText("학부모-POST직전-제출.png", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("재배정 직전에도 순서가 선점되면 자동 재시도는 한 번에서 멈춘다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page, 0, "parent", {}, false, 0, [1, 2]);
  state.files.splice(0);

  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "학부모-유한재시도.png",
    mimeType: "image/png",
    buffer: Buffer.from("bounded-position-retry"),
  });
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();

  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("1개 파일을 올리지 못했습니다.");
  await expect(page.getByRole("button", { name: "실패한 파일 1개 다시 제출", exact: true })).toBeEnabled();
  expect(state.getUploadAttempts()).toBe(2);
  expect(state.files.map((file) => file.position)).toEqual([0, 1]);
});

test("재응시 통과로 제출 파일이 잠긴 과제는 1차 실패 성적이어도 제출 대상에서 제외한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page, 450, "student", {
    passed: false,
    achievement: "FAIL",
    retake_count: 2,
    submission_media_locked: true,
  });

  const gradesResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith("/student/grades/"),
    { timeout: 45_000 },
  );
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await gradesResponse;

  await expect(page.getByRole("button", { name: /도형 풀이 인증/ })).toHaveCount(0);
  await expect(page.getByText("제출할 미완료 과제·시험이 없습니다.", { exact: true })).toBeVisible();
  expect(state.getUploadAttempts()).toBe(0);
});

test("1차 통과 뒤 최신 재응시가 불합격이면 현재 잠금 값에 따라 보완 제출을 허용한다", async ({ page }) => {
  const state = await installApi(page, 450, "student", {
    passed: true,
    achievement: "PASS",
    retake_count: 2,
    submission_media_locked: false,
  });

  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });

  await expect(page.getByRole("button", { name: /도형 풀이 인증/ })).toBeVisible();
  expect(state.getUploadAttempts()).toBe(0);
});

test("선택 뒤 교사 확인이 끝난 409는 재시도 파일로 남기지 않고 제출 대상을 갱신한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page, 450, "student", {}, true);
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "확인-직전-사진.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("mobile-photo"),
  });

  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("선생님 확인이 완료되어 제출 목록을 갱신했습니다.");
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /다시 제출/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /도형 풀이 인증/ })).toHaveCount(0);
  expect(state.getUploadAttempts()).toBe(1);
});

test("390px에서 사진·동영상을 다건 선택하고 부분 실패만 재시도한 뒤 새로고침해도 유지한다", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page);
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();

  await expect(page.getByText("기존 제출.jpg", { exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles([
    { name: "풀이-1.png", mimeType: "image/png", buffer: Buffer.from("image-one") },
    { name: "설명-2.mp4", mimeType: "video/mp4", buffer: Buffer.from("video-two") },
  ]);
  await expect(page.getByText("풀이-1.png", { exact: true })).toBeVisible();
  await expect(page.getByText("설명-2.mp4", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" }).locator("article")).toHaveCount(2);
  await expect(page.getByText("3/20", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "파일 2개 제출하기" }).click();
  await expect(page.getByRole("button", { name: "파일별로 제출 중…" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("1개는 제출됐고 1개는 실패했습니다.");
  await expect(page.getByText("풀이-1.png", { exact: true })).toBeVisible();
  await expect(page.getByText("설명-2.mp4", { exact: true })).toBeVisible();
  await expect(page.getByText(/성공한 파일은 유지되며 이 파일만 다시 시도/)).toBeVisible();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "실패한 파일 1개 다시 제출" })).toBeEnabled();
  expect(state.getUploadAttempts()).toBe(2);
  const [imageClientId, videoClientId] = state.getUploadClientIds();
  expect(imageClientId).toBeTruthy();
  expect(videoClientId).toBeTruthy();
  expect(imageClientId).not.toBe(videoClientId);

  await page.getByRole("button", { name: "실패한 파일 1개 다시 제출" }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  expect(state.getUploadAttempts()).toBe(3);
  expect(state.getUploadClientIds()).toEqual([imageClientId, videoClientId, videoClientId]);
  expect(state.files).toHaveLength(3);
  expect(new Set(state.files.filter((file) => !file.legacy).map((file) => file.client_file_id))).toHaveProperty("size", 2);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByText("기존 제출.jpg", { exact: true })).toBeVisible();
  await expect(page.getByText("풀이-1.png", { exact: true })).toBeVisible();
  const restoredVideo = page.getByText("설명-2.mp4", { exact: true });
  await expect(restoredVideo).toBeVisible();
  await restoredVideo.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const mobileScreenshot = testInfo.outputPath("student-homework-media-390.png");
  await page.screenshot({ path: mobileScreenshot, fullPage: true });
  await testInfo.attach("student-homework-media-390", { path: mobileScreenshot, contentType: "image/png" });
});

test("desktop에서 정상 파일은 유지하고 빈 파일·비지원 형식은 이유를 명시한다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const state = await installApi(page);
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.locator('input[type="file"]').setInputFiles([
    { name: "정상-풀이.png", mimeType: "image/png", buffer: Buffer.from("valid-photo") },
    { name: "빈-사진.png", mimeType: "image/png", buffer: Buffer.alloc(0) },
    { name: "메모.txt", mimeType: "text/plain", buffer: Buffer.from("not-media") },
  ]);

  const pending = page.getByRole("region", { name: "이번에 제출할 파일" });
  await expect(pending.getByText("정상-풀이.png", { exact: true })).toBeVisible();
  await expect(pending.getByText("빈-사진.png", { exact: true })).toHaveCount(0);
  await expect(pending.getByText("메모.txt", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("빈-사진.png: 빈 파일");
  await expect(page.getByRole("alert")).toContainText("메모.txt: 지원하지 않는 형식");
  await expect(page.getByRole("button", { name: "파일 1개 제출하기", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  expect(state.getUploadAttempts()).toBe(1);
  expect(state.files).toHaveLength(2);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  const restored = page.getByRole("region", { name: "이미 제출한 파일" });
  await expect(restored.getByText("정상-풀이.png", { exact: true })).toBeVisible();
  await expect(restored.locator('[data-status="uploaded"]')).toHaveCount(2);
});

test("390px에서 20초 넘는 사진 업로드도 다건 제출과 새로고침까지 완료한다", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page, 22_000);
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.locator('input[type="file"]').setInputFiles([
    { name: "느린-사진.png", mimeType: "image/png", buffer: Buffer.from("slow-photo") },
    { name: "다음-사진.png", mimeType: "image/png", buffer: Buffer.from("next-photo") },
  ]);
  const pending = page.getByRole("region", { name: "이번에 제출할 파일" });
  await expect(pending.getByText("느린-사진.png", { exact: true })).toBeVisible();
  await expect(pending.getByText("다음-사진.png", { exact: true })).toBeVisible();
  await expect(pending.locator("article")).toHaveCount(2);

  await page.getByRole("button", { name: "파일 2개 제출하기", exact: true }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible({ timeout: 45_000 });
  expect(state.getUploadAttempts()).toBe(2);
  expect(state.files).toHaveLength(3);
  expect(new Set(state.getUploadClientIds())).toHaveProperty("size", 2);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  const restored = page.getByRole("region", { name: "이미 제출한 파일" });
  await expect(restored.locator('[data-status="uploaded"]')).toHaveCount(3);
  await expect(restored.getByText("느린-사진.png", { exact: true })).toBeVisible();
  await expect(restored.getByText("다음-사진.png", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
