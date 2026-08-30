import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const SESSION_ID = 7711;

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "학생 제출 route-mock 검증은 로컬 dev 서버 전용",
  );
  const token = fakeJwt();
  let submissionCount = 0;
  const mediaFiles: Array<Record<string, unknown>> = [];

  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const fulfill = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith("/token/refresh/")) return fulfill({ access: token, refresh: `${token}-refresh` });
    if (path.endsWith("/core/program/")) {
      return fulfill({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        is_active: true,
        feature_flags: {},
        ui_config: {},
      });
    }
    if (path.endsWith("/core/me/")) {
      return fulfill({
        id: 12,
        username: "student-12",
        name: "김하늘",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        linkedStudents: [],
      });
    }
    if (path.endsWith("/student/me/")) {
      return fulfill({ id: 12, name: "김하늘", displayName: "김하늘", is_student: true });
    }
    if (path.endsWith("/student/grades/")) {
      return fulfill({
        exams: [
          {
            exam_id: 301,
            enrollment_id: 401,
            session_id: SESSION_ID,
            title: "현재 차시 단원평가",
            total_score: null,
            max_score: 100,
            is_pass: false,
            achievement: "NOT_SUBMITTED",
            meta_status: "NOT_SUBMITTED",
            session_title: "3차시",
            lecture_title: "고1 수학",
            submitted_at: null,
          },
          {
            exam_id: 302,
            enrollment_id: 401,
            session_id: 8811,
            title: "다른 차시 단원평가",
            total_score: null,
            max_score: 100,
            is_pass: false,
            achievement: "NOT_SUBMITTED",
            meta_status: "NOT_SUBMITTED",
            session_title: "4차시",
            lecture_title: "고1 수학",
            submitted_at: null,
          },
        ],
        homeworks: [
          {
            homework_id: 501,
            enrollment_id: 401,
            session_id: SESSION_ID,
            title: "현재 차시 필수 과제",
            score: null,
            max_score: 100,
            passed: false,
            achievement: "NOT_SUBMITTED",
            session_title: "3차시",
            lecture_title: "고1 수학",
          },
          {
            homework_id: 502,
            enrollment_id: 401,
            session_id: SESSION_ID,
            title: "현재 차시 추가 과제",
            score: null,
            max_score: 100,
            passed: false,
            achievement: "NOT_SUBMITTED",
            session_title: "3차시",
            lecture_title: "고1 수학",
          },
          {
            homework_id: 503,
            enrollment_id: 401,
            session_id: 8811,
            title: "다른 차시 과제",
            score: null,
            max_score: 100,
            passed: false,
            achievement: "NOT_SUBMITTED",
            session_title: "4차시",
            lecture_title: "고1 수학",
          },
          {
            homework_id: 504,
            enrollment_id: 401,
            session_id: SESSION_ID,
            title: "수업 중 교사 확인 과제",
            score: null,
            max_score: 100,
            passed: false,
            achievement: "REMEDIATED",
            teacher_resolved: true,
            grading_mode: "SCORE",
            session_title: "3차시",
            lecture_title: "고1 수학",
          },
        ],
        exam_trend: [],
        exam_summary: {
          scored_count: 0,
          average_score_pct: null,
          latest_score_pct: null,
          change_pct_points: null,
          best_score_pct: null,
        },
        lecture_options: [],
      });
    }
    if (/\/submissions\/submissions\/homework\/\d+\/media\/$/.test(path) && request.method() === "GET") {
      return fulfill({
        files: mediaFiles,
        limits: {
          max_files: 20,
          max_file_size_bytes: 100 * 1024 * 1024,
          max_total_size_bytes: 500 * 1024 * 1024,
        },
      });
    }
    if (path.endsWith("/submissions/submissions/homework/501/media/") && request.method() === "POST") {
      submissionCount += 1;
      const body = request.postData() ?? "";
      expect(body).toContain("401");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const uploaded = {
        id: String(900 + submissionCount),
        legacy: false,
        client_file_id: `client-${submissionCount}`,
        upload_batch_id: "batch-1",
        position: submissionCount - 1,
        original_filename: "최종풀이.png",
        media_kind: "image",
        mime_type: "image/png",
        file_size: 11,
        status: "uploaded",
        error_message: "",
        upload_started_at: "2026-08-23T00:00:00Z",
        uploaded_at: "2026-08-23T00:00:01Z",
        failed_at: null,
        removed_at: null,
        created_at: "2026-08-23T00:00:00Z",
      };
      mediaFiles.push(uploaded);
      return fulfill(uploaded, 201);
    }
    return fulfill({ count: 0, results: [] });
  });

  return { getSubmissionCount: () => submissionCount };
}

test("차시 제출 링크는 다른 차시를 숨기고 대상 전환·성공 시 파일을 초기화한다", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installApi(page);
  await page.goto(`${BASE}/student/submit/assignment?sessionId=${SESSION_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await expect(page.getByText("현재 차시의 제출 항목만 표시합니다")).toBeVisible();
  await expect(page.getByText("현재 차시 필수 과제", { exact: true })).toBeVisible();
  await expect(page.getByText("현재 차시 추가 과제", { exact: true })).toBeVisible();
  await expect(page.getByText("현재 차시 단원평가", { exact: true })).toBeVisible();
  await expect(page.getByText("다른 차시 과제", { exact: true })).toHaveCount(0);
  await expect(page.getByText("다른 차시 단원평가", { exact: true })).toHaveCount(0);
  await expect(page.getByText("수업 중 교사 확인 과제", { exact: true })).toHaveCount(0);

  await page.getByText("현재 차시 필수 과제", { exact: true }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "풀이.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("safe-image"),
  });
  await expect(page.getByText(/풀이\.jpg/)).toBeVisible();

  await page.getByText("현재 차시 추가 과제", { exact: true }).click();
  await expect(page.getByText(/풀이\.jpg/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "새 파일을 선택해 주세요" })).toBeDisabled();

  await fileInput.setInputFiles({
    name: "메모.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not allowed"),
  });
  await expect(page.getByRole("alert")).toContainText("지원하지 않는 형식");

  await page.getByText("현재 차시 필수 과제", { exact: true }).click();
  await fileInput.setInputFiles({
    name: "최종풀이.png",
    mimeType: "image/png",
    buffer: Buffer.from("final-image"),
  });
  await page.getByRole("button", { name: "파일 1개 제출하기" }).click();
  await expect(page.getByRole("button", { name: /현재 차시 추가 과제/ })).toBeDisabled();
  await expect(page.getByText("선택한 파일을 모두 제출했습니다. 선생님 확인을 기다려 주세요.", { exact: true })).toBeVisible();
  await expect(page.getByText(/최종풀이\.png/)).toHaveCount(0);
  await expect(page.getByText("제출 대상", { exact: true })).toHaveCount(0);
  expect(api.getSubmissionCount()).toBe(1);
  await page.getByText("현재 차시 추가 과제", { exact: true }).click();
  await expect(page.locator('[class*="successMessage"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("클리닉 링크는 해당 차시의 정확한 과제를 바로 선택한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto(
    `${BASE}/student/submit/assignment?sessionId=${SESSION_ID}&homeworkId=502`,
    { waitUntil: "domcontentloaded", timeout: 45_000 },
  );

  await expect(page.getByText("제출 대상", { exact: true })).toBeVisible();
  await expect(page.locator('[class*="submitSummary"]')).toContainText("현재 차시 추가 과제");
  await expect(page.getByRole("button", { name: /현재 차시 추가 과제/ }))
    .toHaveAttribute("data-selected", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
});

for (const device of [
  { name: "iPhone", viewport: { width: 390, height: 844 }, filename: "아이폰풀이.heic", mimeType: "image/heic" },
  { name: "Galaxy", viewport: { width: 360, height: 800 }, filename: "갤럭시풀이.jpg", mimeType: "image/jpeg" },
] as const) {
  test(`${device.name} 클리닉 과제 링크에서 사진 제출 파일을 선택할 수 있다`, async ({ page }) => {
    await page.setViewportSize(device.viewport);
    await installApi(page);
    await page.goto(
      `${BASE}/student/submit/assignment?sessionId=${SESSION_ID}&homeworkId=502`,
      { waitUntil: "domcontentloaded", timeout: 45_000 },
    );

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("accept", /\.heic/);
    await expect(fileInput).toHaveAttribute("accept", /\.mov/);
    await fileInput.setInputFiles({
      name: device.filename,
      mimeType: device.mimeType,
      buffer: Buffer.from("mobile-homework-photo"),
    });
    await expect(page.getByText(device.filename, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1);
  });
}

test("교사 완료 과제는 원점수 없이도 완료로 표시되고 재제출 대상에서 제외된다", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto(`${BASE}/student/grades`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await page.getByRole("button", { name: /과제 현황/ }).click();
  const card = page.locator('[class*="homeworkCard"]').filter({
    hasText: "수업 중 교사 확인 과제",
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText("–/100");
  await expect(card).toContainText("교사 확인 완료");
  await expect(page.getByRole("button", { name: /완료/ })).toContainText("1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
