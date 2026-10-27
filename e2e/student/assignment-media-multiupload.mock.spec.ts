import type { Page, Route } from "@playwright/test";
import { createHash } from "node:crypto";

import { expect, test } from "../fixtures/strictTest";
import { guideRecording } from "../helpers/guideRecording";
import { applyHomeworkPreviewCsp, homeworkHeic, installHomeworkHeicPreview } from "../helpers/homeworkHeicFixture";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const HOMEWORK_ID = 8501;
const ENROLLMENT_ID = 8601;

if (process.env.GUIDE_MEDIA_CAPTURE === "1") {
  test.use({ viewport: { width: 390, height: 844 }, video: { mode: "on", size: { width: 390, height: 844 } } });
  test.describe("과제 제출 시연", () => {
    test("@guide-recording 학생 과제 사진 제출", async ({ page }, info) => {
      const recording = await guideRecording(page, info, { id: "student-assignment", title: "학생 과제 사진 제출", topics: ["student/submit-assignment"] });
      const state = await installApi(page);
      const paper = await page.context().newPage();
      await paper.setViewportSize({ width: 640, height: 800 });
      await paper.setContent('<html lang="ko"><body style="margin:60px;font:24px sans-serif;color:#24364b"><p>과제 제출 예시</p><h1>도형 풀이</h1><hr><p>1. 삼각형의 넓이를 구하시오.</p><svg width="400" height="240"><path d="M40 210 L340 210 L210 30 Z" fill="#eaf2ff" stroke="#2563eb" stroke-width="4"/><text x="170" y="238">밑변 10 cm</text></svg><p>넓이 = 밑변 × 높이 ÷ 2</p><p>= 10 × 8 ÷ 2 = 40 cm²</p></body></html>');
      const sample = await paper.screenshot({ type: "png" });
      await paper.close();
      await page.goto(`${BASE}/student/submit/assignment`);
      const target = page.getByRole("button", { name: /도형 풀이 인증/ });
      await recording.screen("제출할 과제 선택", "과제·시험 제목과 강의·차시를 확인하고 제출할 항목을 누릅니다.", target);
      await target.click();
      await recording.screen("기존 제출 확인", "이미 올린 파일과 추가 제출 가능 상태를 먼저 확인합니다.", page.getByText("기존 제출.jpg", { exact: true }));
      await page.locator('input[type="file"]').setInputFiles([
        { name: "도형-풀이-1.png", mimeType: "image/png", buffer: sample },
        { name: "도형-풀이-2.png", mimeType: "image/png", buffer: sample },
      ]);
      await recording.screen("파일과 미리보기 확인", "사진·동영상을 고른 뒤 파일명·미리보기·파일 수가 맞는지 확인합니다.", page.getByRole("region", { name: "이번에 제출할 파일" }));
      const submit = page.getByRole("button", { name: "파일 2개 제출하기" });
      await recording.screen("선택한 파일 제출", "파일 제출 버튼을 누르고 파일별 완료·실패 표시를 확인합니다.", submit);
      await submit.click();
      await recording.screen("제출 완료 확인", "모두 제출했다는 안내를 확인합니다. 일부만 실패하면 성공 파일을 유지하고 실패한 파일만 다시 제출합니다.", page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true }));
      expect(state.getUploadAttempts()).toBe(2);
      await page.reload();
      await target.click();
      await recording.screen("다시 열어 파일 확인", "제출한 파일이 남아 있는지 확인합니다. 파일 제출 완료와 선생님의 평가 완료는 다릅니다.", page.getByText("도형-풀이-2.png", { exact: true }));
      await recording.finish();
    });
  });
}

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
  reviewLockOnFirstUpload: boolean | number = false,
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
  const activityRequests: string[] = [];
  let uploadAttempts = 0;
  let mediaReadCount = 0;
  let homeworkActivityRequests = 0;
  let currentHomeworkOverrides = homeworkOverrides;
  let previewFailure: "api" | "media" | null = null;
  let loseNextUploadResponse = false;
  let previewUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNg+A8AAQIBAEK+vGgAAAAASUVORK5CYII=";
  const previewRequests: string[] = [];

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
    if (path.includes(`/submissions/submissions/homework/${HOMEWORK_ID}/media/`) && path.endsWith("/preview/")) {
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      previewRequests.push(path);
      if (previewFailure === "api") return json({ detail: "잠시 후 다시 시도해 주세요." }, 503);
      return json({ url: previewFailure === "media" ? "data:image/png;base64,broken"
        : previewUrl });
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
      const body = request.postData() ?? "";
      const clientId = multipartValue(body, "client_file_id");
      uploadClientIds.push(clientId);
      if (reviewLockOnFirstUpload && uploadAttempts === (typeof reviewLockOnFirstUpload === "number" ? reviewLockOnFirstUpload : 1)) {
        currentHomeworkOverrides = {
          ...currentHomeworkOverrides,
          submission_media_locked: true,
        };
        return json({
          code: "HOMEWORK_MEDIA_REVIEWED",
          detail: "완료 또는 통과한 과제 파일은 변경할 수 없습니다.",
        }, 409);
      }
      const batchId = multipartValue(body, "upload_batch_id");
      const position = Number(multipartValue(body, "position"));
      const filename = multipartFilename(body);
      const isVideo = /\.mp4$/i.test(filename);
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
      if (loseNextUploadResponse) {
        loseNextUploadResponse = false;
        return json({ detail: "저장은 끝났지만 중간 연결의 응답 제한 시간을 초과했습니다." }, 504);
      }
      return json(payload, 201);
    }
    if (path.endsWith("/students/me/activity/homework-open/")) {
      activityRequests.push(path);
      homeworkActivityRequests += 1;
      studentScopedHeaders.push(request.headers()["x-student-id"]);
      return viewer === "parent"
        ? json({ detail: "기록할 수 없는 학생 활동입니다." }, 403)
        : json({ accepted: true }, 202);
    }
    if (path.endsWith("/students/me/activity/")) {
      activityRequests.push(path);
      return viewer === "parent"
        ? json({ detail: "기록할 수 없는 학생 활동입니다." }, 403)
        : json({ accepted: true }, 202);
    }
    return json({ count: 0, results: [] });
  });

  return {
    files,
    getUploadAttempts: () => uploadAttempts,
    loseNextUploadResponse: () => { loseNextUploadResponse = true; },
    getUploadClientIds: () => [...uploadClientIds],
    getStudentScopedHeaders: () => [...studentScopedHeaders],
    getHomeworkActivityRequests: () => homeworkActivityRequests,
    getActivityRequests: () => [...activityRequests],
    reopenHomework: () => { currentHomeworkOverrides = { ...currentHomeworkOverrides, submission_media_locked: false }; },
    setPreviewFailure: (failure: "api" | "media" | null) => { previewFailure = failure; },
    setPreviewUrl: (url: string) => { previewUrl = url; },
    getPreviewRequests: () => [...previewRequests],
  };
}

test("HEIC 사진은 선택·제출·새로고침 후 열리고 실패한 미리보기도 복구한다", async ({ page }) => {
  const state = await installApi(page, 0);
  const remote = await installHomeworkHeicPreview(page);
  state.setPreviewUrl(remote.url);
  Object.assign(state.files[0], { original_filename: "camera-capture", mime_type: "image/heif" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await applyHomeworkPreviewCsp(page);
  await page.getByRole("region", { name: "이미 제출한 파일" }).getByRole("button", { name: "미리보기", exact: true }).click();
  const existing = page.getByRole("img", { name: "camera-capture 제출 파일" });
  await expect.poll(() => existing.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(640);
  await page.getByRole("button", { name: "미리보기 닫기" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "phone.heic", mimeType: "image/heic", buffer: homeworkHeic });
  const localImage = page.getByRole("img", { name: "선택한 과제 사진 미리보기" });
  await expect.poll(() => localImage.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(384);
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  expect(state.getUploadAttempts()).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await applyHomeworkPreviewCsp(page);
  const saved = page.getByRole("region", { name: "이미 제출한 파일" });
  await saved.locator('[class*="persistedFile"]').filter({ hasText: "phone.heic" }).getByRole("button", { name: "미리보기", exact: true }).click();
  const image = page.getByRole("img", { name: "phone.heic 제출 파일" });
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(640);
  await page.getByRole("button", { name: "미리보기 닫기" }).click();
  remote.setBroken(true);
  await saved.locator('[class*="persistedFile"]').filter({ hasText: "phone.heic" }).getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("제출된 파일은 유지됩니다");
  remote.setBroken(false);
  await page.getByRole("button", { name: "미리보기 다시 시도" }).click();
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(640);
  expect(state.getUploadAttempts()).toBe(1);
  expect(remote.headers.length).toBeGreaterThan(0);
  for (const headers of remote.headers) {
    expect(headers.authorization).toBeUndefined();
    expect(headers["x-tenant-code"]).toBeUndefined();
    expect(headers["x-student-id"]).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
  }
});

test("HEIC 변환을 닫으면 작업이 취소되고 다음 사진을 바로 열 수 있다", async ({ page }) => {
  const state = await installApi(page, 0);
  const remote = await installHomeworkHeicPreview(page);
  state.setPreviewUrl(remote.url);
  Object.assign(state.files[0], { original_filename: "phone.heic", mime_type: "image/heic" });
  let workerRequests = 0;
  await page.route("**/vendor-heic-csp-worker.ts?worker_file**", (route) => {
    workerRequests += 1;
    return workerRequests === 1 ? route.fulfill({ contentType: "application/javascript", body: "self.onmessage = () => {};" }) : route.continue();
  });
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await applyHomeworkPreviewCsp(page);
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect.poll(() => workerRequests).toBe(1);
  await page.getByRole("button", { name: "미리보기 닫기" }).click();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  const image = page.getByRole("img", { name: "phone.heic 제출 파일" });
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(640);
  expect(workerRequests).toBe(2);
  expect(state.getUploadAttempts()).toBe(0);
});

test("HEIC 변환 시간 초과 뒤 재시도하면 다음 작업이 정상 완료된다", async ({ page }) => {
  const state = await installApi(page, 0);
  const remote = await installHomeworkHeicPreview(page);
  state.setPreviewUrl(remote.url);
  Object.assign(state.files[0], { original_filename: "phone.heic", mime_type: "image/heic" });
  let workerRequests = 0;
  await page.route("**/vendor-heic-csp-worker.ts?worker_file**", (route) => {
    workerRequests += 1;
    return workerRequests === 1 ? route.fulfill({ contentType: "application/javascript", body: "self.onmessage = () => {};" }) : route.continue();
  });
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.clock.install();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect.poll(() => workerRequests).toBe(1);
  await page.clock.fastForward(31_000);
  await expect(page.getByRole("alert")).toContainText("제출된 파일은 유지됩니다");
  await page.getByRole("button", { name: "미리보기 다시 시도" }).click();
  await expect.poll(() => page.getByRole("img", { name: "phone.heic 제출 파일" }).evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(640);
  expect(workerRequests).toBe(2);
});

test("HEIC 임시 파일은 새로고침 후 복원되고 제출 뒤 기기 보관에서 지워진다", async ({ page }) => {
  const state = await installApi(page, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.getByRole("button", { name: "사진·동영상 여러 개 선택" }).waitFor();
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "restore.heic", mimeType: "image/heic", buffer: homeworkHeic });
  await expect(page.getByText(/이 기기에 임시 보관했습니다/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" })).toContainText("restore.heic");
  await expect.poll(() => page.getByRole("img", { name: "선택한 과제 사진 미리보기" }).evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(384);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("region", { name: "이미 제출한 파일" })).toContainText("restore.heic");
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" })).toHaveCount(0);
  expect(state.getUploadAttempts()).toBe(1);
});

test("HEIC 임시 보관은 다른 로그인에 노출되지 않고 이전 파일 조각도 정리된다", async ({ page }) => {
  await installApi(page, 0);
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "private-draft.heic", mimeType: "image/heic", buffer: homeworkHeic });
  await expect(page.getByText(/이 기기에 임시 보관했습니다/)).toBeVisible();
  await page.evaluate(() => {
    const activeKey = "academy:auth-active-generation:v1";
    const oldGeneration = localStorage.getItem(activeKey)!;
    const envelope = JSON.parse(localStorage.getItem("academy:auth-tokens:v1:" + oldGeneration)!);
    envelope.generation = "qa-new-login";
    localStorage.setItem("academy:auth-tokens:v1:qa-new-login", JSON.stringify(envelope));
    localStorage.setItem(activeKey, "qa-new-login");
    localStorage.removeItem("academy:auth-tokens:v1:" + oldGeneration);
  });
  await page.reload();
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" })).toHaveCount(0);
  expect(await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open("academy-homework-drafts-v1");
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction("chunks").objectStore("chunks").count();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => reject(request.error);
    };
  }))).toBe(0);
});

test("HEIC·영상 임시 저장의 여러 조각이 새로고침 뒤 바이트 손실 없이 복원된다", async ({ page }) => {
  await installApi(page, 0);
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  const data = Buffer.alloc(9 * 1024 * 1024 + 13, 91);
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNg+A8AAQIBAEK+vGgAAAAASUVORK5CYII=", "base64").copy(data);
  await page.locator('input[type="file"]').setInputFiles({ name: "large-original.png", mimeType: "image/png", buffer: data });
  await expect(page.getByText(/이 기기에 임시 보관했습니다/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" })).toContainText("large-original.png");
  const restored = await page.evaluate(async () => {
    const url = "/src/shared/storage/homeworkDraftStorage.ts";
    const storage = await import(/* @vite-ignore */ url);
    const generation = localStorage.getItem("academy:auth-active-generation:v1")!;
    const key = JSON.stringify([generation, "hakwonplus", 72, 8501, 8601]);
    const { files } = await storage.loadHomeworkDraft(key, generation);
    const bytes = new Uint8Array(await files[0].file.arrayBuffer());
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((value) => value.toString(16).padStart(2, "0")).join("");
    return { size: bytes.length, digest };
  });
  expect(restored).toEqual({ size: data.length, digest: createHash("sha256").update(data).digest("hex") });
});

test("HEIC 임시 저장은 다른 탭의 추가 파일을 보존하고 삭제·만료 파일은 되살리지 않는다", async ({ page, context }) => {
  await installApi(page, 0);
  await page.goto(`${BASE}/student/submit/assignment`);
  const second = await context.newPage();
  await installApi(second, 0);
  await second.goto(`${BASE}/student/submit/assignment`);
  const save = async (target: Page, ids: string[], added: string[], removed: string[] = []) => target.evaluate(async ({ ids, added, removed }) => {
    const url = "/src/shared/storage/homeworkDraftStorage.ts";
    const storage = await import(/* @vite-ignore */ url);
    const generation = localStorage.getItem("academy:auth-active-generation:v1")!;
    const key = JSON.stringify([generation, "hakwonplus", 72, 8501, 8601]);
    await storage.saveHomeworkDraft(key, generation, ids.map((id, position) => ({ clientFileId: id, uploadBatchId: "batch", position,
      file: new File([id], id + ".png", { type: "image/png" }) })), removed, () => true, added);
  }, { ids, added, removed });
  const names = () => page.evaluate(async () => {
    const url = "/src/shared/storage/homeworkDraftStorage.ts";
    const storage = await import(/* @vite-ignore */ url);
    const generation = localStorage.getItem("academy:auth-active-generation:v1")!;
    const key = JSON.stringify([generation, "hakwonplus", 72, 8501, 8601]);
    return (await storage.loadHomeworkDraft(key, generation)).files.map((file: { clientFileId: string }) => file.clientFileId).sort();
  });
  await Promise.all([save(page, ["a"], ["a"]), save(second, ["b"], ["b"])]);
  expect(await names()).toEqual(["a", "b"]);
  await save(page, ["b"], [], ["a"]);
  await save(second, ["a", "b", "c"], ["c"]);
  expect(await names()).toEqual(["b", "c"]);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("academy-homework-drafts-v1");
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("drafts", "readwrite");
      const cursor = tx.objectStore("drafts").openCursor();
      cursor.onsuccess = () => { const row = cursor.result; if (row) { row.update({ ...row.value, expires: Date.now() - 1 }); row.continue(); } };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
  }));
  await save(second, ["b", "c", "d"], ["d"]);
  expect(await names()).toEqual(["d"]);
  await second.close();
});

test("HEIC 기기 저장이 막혀도 원본 선택을 유지하고 정상 제출한다", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "indexedDB", { get: () => { throw new DOMException("Storage disabled", "SecurityError"); } }); });
  const state = await installApi(page, 0);
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "no-storage.heic", mimeType: "image/heic", buffer: homeworkHeic });
  await expect(page.getByText(/이 기기에 임시 보관하지 못했습니다/)).toBeVisible();
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" })).toContainText("no-storage.heic");
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  expect(state.getUploadAttempts()).toBe(1);
});

test("HEIC 구형 Safari의 파일 읽기·canvas 대체 경로에서도 미리보기를 연다", async ({ page }) => {
  const state = await installApi(page, 0);
  const remote = await installHomeworkHeicPreview(page);
  state.setPreviewUrl(remote.url);
  Object.assign(state.files[0], { original_filename: "legacy.heic", mime_type: "image/heic" });
  await page.route("**/vendor-heic-csp-worker.ts?worker_file**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: "self.OffscreenCanvas = undefined; self.Blob.prototype.arrayBuffer = undefined;\n" + await response.text() });
  });
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await applyHomeworkPreviewCsp(page);
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect.poll(() => page.getByRole("img", { name: "legacy.heic 제출 파일" }).evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(640);
});

test("서버 저장 뒤 응답이 끊겨도 재전송 없이 성공을 확인한다", async ({ page }) => {
  const state = await installApi(page, 0);
  state.loseNextUploadResponse();
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "response-lost.heic", mimeType: "image/heic", buffer: homeworkHeic });
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "이미 제출한 파일" })).toContainText("response-lost.heic");
  expect(state.getUploadAttempts()).toBe(1);
});

test("저장 중으로 남은 파일도 제한된 재조회 뒤 같은 식별자로 복구한다", async ({ page }) => {
  test.setTimeout(90_000);
  const state = await installApi(page, 0);
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "interrupted.mp4", mimeType: "video/mp4", buffer: Buffer.from("synthetic-video") });
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect.poll(state.getUploadAttempts).toBe(1);
  await expect(page.getByRole("alert")).toContainText("1개 파일을 올리지 못했습니다");
  const saved = state.files.find((file) => file.original_filename === "interrupted.mp4")!;
  const originalClientId = saved.client_file_id;
  saved.status = "uploading";
  saved.error_message = "";
  await page.reload();
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" })).toContainText("interrupted.mp4");
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect(page.getByText("전송 완료 · 서버에 저장 확인 중…", { exact: true })).toBeVisible();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible({ timeout: 45_000 });
  expect(state.getUploadAttempts()).toBe(2);
  expect(state.getUploadClientIds()).toEqual([originalClientId, originalClientId]);
  expect(state.files.filter((file) => file.original_filename === "interrupted.mp4")).toHaveLength(1);
  expect(state.files.find((file) => file.client_file_id === originalClientId)?.status).toBe("uploaded");
});

test("저장 확인 중 잠시 멈춘 뒤 reload하면 이미 저장된 파일은 다시 보내지 않는다", async ({ page }) => {
  const state = await installApi(page, 1800);
  await page.goto(`${BASE}/student/submit/assignment`);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("button", { name: "사진·동영상 여러 개 선택" })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles({ name: "paused.heic", mimeType: "image/heic", buffer: homeworkHeic });
  await expect(page.getByText(/이 기기에 임시 보관했습니다/)).toBeVisible();
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect.poll(state.getUploadAttempts).toBe(1);
  await page.getByRole("button", { name: "잠시 멈추기", exact: true }).click();
  await expect(page.getByRole("button", { name: "남은 파일 1개 이어서 제출" })).toBeEnabled();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toHaveCount(0);
  await expect.poll(() => state.files.filter((file) => file.original_filename === "paused.heic").length).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("region", { name: "이미 제출한 파일" })).toContainText("paused.heic");
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" })).toHaveCount(0);
  expect(state.getUploadAttempts()).toBe(1);
});

test("학부모가 선택 자녀의 과제를 제출하고 새로고침 뒤에도 같은 파일을 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page, 0, "parent");
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });

  await expect(page.getByText("학부모 계정은 직접 제출할 수 없습니다.")).toHaveCount(0);
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.waitForLoadState("networkidle");
  expect(state.getHomeworkActivityRequests()).toBe(0);
  expect(state.getActivityRequests()).toEqual([]);
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
  expect(await page.evaluate(() => localStorage.getItem("parent_selected_student_id_hakwonplus_920"))).toBe("72");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("학생 제출 후 검토 대기 중인 과제는 학부모의 파일 추가 대상으로 남는다", async ({ page }) => {
  const state = await installApi(page, 0, "parent", {
    score: null,
    passed: null,
    achievement: null,
    submission_state: "awaiting_review",
    lecture_active: true,
    submission_media_locked: false,
  });
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });

  await expect(page.getByRole("button", { name: /도형 풀이 인증/ })).toBeVisible();
  expect(state.getStudentScopedHeaders().length).toBeGreaterThan(0);
  expect(state.getStudentScopedHeaders().every((value) => value === "72")).toBe(true);
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
  expect(await page.evaluate(() => localStorage.getItem("parent_selected_student_id_hakwonplus_920"))).toBe("72");
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

for (const width of [1366, 390]) {
test(`${width}px 교사 완료 경합은 미제출 파일을 보관하고 재개 후 같은 ID로 저장한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const state = await installApi(page, 0, "student", {}, 2);
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.locator('input[type="file"]').setInputFiles([{
    name: "먼저-저장된-사진.png", mimeType: "image/png", buffer: Buffer.from("first-photo"),
  }, {
    name: "확인-직전-사진.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("mobile-photo"),
  }]);

  await page.getByRole("button", { name: "파일 2개 제출하기", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("아직 제출하지 못한 파일은 보관했습니다.");
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "이번에 제출할 파일" }).getByText("확인-직전-사진.heic")).toBeVisible();
  await expect(page.getByRole("region", { name: "이미 제출한 파일" }).getByText("먼저-저장된-사진.png")).toBeVisible();
  await expect(page.getByRole("button", { name: "선생님 확인으로 제출 잠김" })).toBeDisabled();
  await page.getByRole("button", { name: "제출 가능 상태 다시 확인" }).click();
  await expect(page.getByRole("alert")).toContainText("아직 선생님 확인 상태입니다.");
  await expect(page.getByRole("button", { name: /도형 풀이 인증/ })).toHaveCount(0);
  expect(state.getUploadAttempts()).toBe(2);
  state.reopenHomework();
  await page.getByRole("button", { name: "제출 가능 상태 다시 확인" }).click();
  await page.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  expect(state.getUploadAttempts()).toBe(3);
  expect(state.getUploadClientIds()[2]).toBe(state.getUploadClientIds()[1]);
  expect(state.files.filter((file) => file.original_filename === "먼저-저장된-사진.png")).toHaveLength(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect(page.getByRole("region", { name: "이미 제출한 파일" }).getByText("확인-직전-사진.heic")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test(`${width}px 저장된 제출 파일은 미리보기 실패 후 재시도와 reload로 확인한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const state = await installApi(page, 0, width === 390 ? "parent" : "student");
  state.setPreviewFailure(width === 390 ? "media" : "api");
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  const preview = page.getByRole("region", { name: "제출 파일 미리보기" });
  await expect(preview.getByRole("alert")).toContainText("제출된 파일은 유지됩니다.");
  expect(state.files).toHaveLength(1);
  // The shared API client bounds transient 503 retries before surfacing failure.
  const failedAttempts = state.getPreviewRequests().length;
  expect(failedAttempts).toBeGreaterThan(0);
  state.setPreviewFailure(null);
  await preview.getByRole("button", { name: "미리보기 다시 시도" }).click();
  await expect(preview.getByRole("img", { name: "기존 제출.jpg 제출 파일" })).toBeVisible();
  await expect.poll(() => preview.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await preview.getByRole("button", { name: "미리보기 닫기" }).click();
  await expect(preview).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(preview.getByRole("img", { name: "기존 제출.jpg 제출 파일" })).toBeVisible();
  expect(state.getPreviewRequests()).toHaveLength(failedAttempts + 2);
  expect(state.getPreviewRequests().every((path) => path.endsWith(`/homework/${HOMEWORK_ID}/media/801/preview/`))).toBe(true);
  if (width === 390) expect(state.getStudentScopedHeaders().every((header) => header === "72")).toBe(true);
  expect(state.getUploadAttempts()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
}

test("390px에서 사진·동영상을 다건 선택하고 부분 실패만 재시도한 뒤 새로고침해도 유지한다", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page);
  await page.goto(`${BASE}/student/submit/assignment`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: /도형 풀이 인증/ }).click();
  await expect.poll(() => state.getHomeworkActivityRequests()).toBe(1);
  await expect.poll(() => state.getActivityRequests()).toEqual([
    "/api/v1/students/me/activity/",
    "/api/v1/students/me/activity/homework-open/",
  ]);

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
