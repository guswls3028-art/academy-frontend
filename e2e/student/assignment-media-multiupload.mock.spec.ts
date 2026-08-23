import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const HOMEWORK_ID = 8501;
const ENROLLMENT_ID = 8601;

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

async function installApi(page: Page) {
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
  const failedClientIds = new Set<string>();
  let uploadAttempts = 0;

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
      return json({ id: 72, username: "student-72", name: "김하늘", is_staff: false, is_superuser: false, tenantRole: "student", linkedStudents: [] });
    }
    if (path.endsWith("/student/me/")) return json({ id: 72, name: "김하늘", is_student: true });
    if (path.endsWith("/student/grades/")) {
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
        }],
        exam_trend: [],
        exam_summary: {},
        lecture_options: [],
      });
    }
    if (path.endsWith(`/submissions/submissions/homework/${HOMEWORK_ID}/media/`) && request.method() === "GET") {
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
      uploadAttempts += 1;
      const body = request.postData() ?? "";
      const clientId = multipartValue(body, "client_file_id");
      const batchId = multipartValue(body, "upload_batch_id");
      const position = Number(multipartValue(body, "position"));
      const filename = multipartFilename(body);
      const isVideo = /\.mp4$/i.test(filename);
      await new Promise((resolve) => setTimeout(resolve, 450));
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
    if (path.endsWith("/student/me/activity/homework-open/")) return json({ ok: true });
    return json({ count: 0, results: [] });
  });

  return { files, getUploadAttempts: () => uploadAttempts };
}

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
  await expect(page.getByText("3/20", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "파일 2개 제출하기" }).click();
  await expect(page.getByRole("button", { name: "파일별로 제출 중…" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("1개는 제출됐고 1개는 실패했습니다.");
  await expect(page.getByText("풀이-1.png", { exact: true })).toBeVisible();
  await expect(page.getByText(/성공한 파일은 유지되며 이 파일만 다시 시도/)).toBeVisible();
  await expect(page.getByRole("button", { name: "실패한 파일 1개 다시 제출" })).toBeEnabled();

  await page.getByRole("button", { name: "실패한 파일 1개 다시 제출" }).click();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다.", { exact: true })).toBeVisible();
  expect(state.getUploadAttempts()).toBe(3);
  expect(state.files).toHaveLength(3);

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
