import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 8801;
const SESSION_ID = 8802;
const HOMEWORK_ID = 8803;

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
    "과제 파일 검수 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installTenantOneInitScript(page);
  const token = fakeJwt();
  let teacherReviewed = false;
  let reviewUpdatedAt: string | null = null;
  let correctionPayload: Record<string, unknown> | null = null;
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, token);

  const session = {
    id: SESSION_ID,
    lecture: LECTURE_ID,
    title: "3차시",
    display_label: "3차시",
    order: 3,
    regular_order: 3,
    session_type: "REGULAR",
    date: "2026-08-23",
    section: null,
  };
  const homework = {
    id: HOMEWORK_ID,
    session: SESSION_ID,
    session_id: SESSION_ID,
    homework_type: "regular",
    title: "도형 풀이 인증",
    grading_mode: "SCORE",
    max_score: 100,
    cutline_mode: "PERCENT",
    cutline_value: 80,
    round_unit_percent: 5,
    effective_cutline_mode: "PERCENT",
    effective_cutline_value: 80,
    effective_round_unit_percent: 5,
    uses_session_cutline_default: false,
    meta: {},
    created_at: "2026-08-23T00:00:00Z",
    updated_at: "2026-08-23T00:00:00Z",
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({ tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원플러스", feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({ id: 12, username: "teacher", name: "김선생", is_staff: true, is_superuser: false, tenantRole: "teacher", must_change_password: false });
    }
    if (path === `/lectures/lectures/${LECTURE_ID}/`) {
      return json({ id: LECTURE_ID, title: "고1 수학", name: "김선생", subject: "수학", is_active: true });
    }
    if (path === "/lectures/lectures/") return json([{ id: LECTURE_ID, title: "고1 수학", is_active: true }]);
    if (path === "/lectures/sessions/") return json([session]);
    if (path === `/lectures/sessions/${SESSION_ID}/`) return json(session);
    if (path === "/lectures/sections/") return json([]);
    if (path === "/homeworks/") return json({ count: 1, results: [homework] });
    if (path === `/homeworks/${HOMEWORK_ID}/`) return json(homework);
    if (path === "/homework/assignments/") return json({ items: [] });
    if (path === `/submissions/submissions/homework/${HOMEWORK_ID}/`) {
      return json([{
        id: 9901,
        enrollment_id: 9902,
        student_id: 9903,
        student_name: "김하늘",
        profile_photo_url: null,
        status: "submitted",
        source: "homework_media",
        file_type: "image/jpeg",
        file_size: 1800,
        lecture_title: "고1 수학",
        lecture_color: "#2563eb",
        lecture_chip_label: "수",
        name_highlight_clinic_target: false,
        teacher_reviewed: teacherReviewed,
        teacher_review_source: teacherReviewed ? "manual" : null,
        teacher_review_note: teacherReviewed ? "제출 파일 직접 확인" : "",
        teacher_reviewed_at: teacherReviewed ? "2026-08-23T03:30:00Z" : null,
        teacher_review_updated_at: reviewUpdatedAt,
        created_at: "2026-08-23T03:20:00Z",
        files: [
          {
            id: "9911",
            legacy: false,
            position: 0,
            original_filename: "풀이 앞면.jpg",
            media_kind: "image",
            mime_type: "image/jpeg",
            file_size: 1800,
            status: "uploaded",
            error_message: "",
            uploaded_at: "2026-08-23T03:20:02Z",
            failed_at: null,
            removed_at: null,
            created_at: "2026-08-23T03:20:00Z",
          },
          {
            id: "9912",
            legacy: false,
            position: 1,
            original_filename: "풀이 설명.mp4",
            media_kind: "video",
            mime_type: "video/mp4",
            file_size: 3500000,
            status: "uploaded",
            error_message: "",
            uploaded_at: "2026-08-23T03:20:10Z",
            failed_at: null,
            removed_at: null,
            created_at: "2026-08-23T03:20:03Z",
          },
          {
            id: "9913",
            legacy: false,
            position: 2,
            original_filename: "흐린 사진.png",
            media_kind: "image",
            mime_type: "image/png",
            file_size: 900,
            status: "failed",
            error_message: "파일 저장 실패",
            uploaded_at: null,
            failed_at: "2026-08-23T03:20:12Z",
            removed_at: null,
            created_at: "2026-08-23T03:20:11Z",
          },
        ],
      }]);
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/score-correction/` && request.method() === "PATCH") {
      correctionPayload = request.postDataJSON() as Record<string, unknown>;
      teacherReviewed = correctionPayload.completed === true;
      reviewUpdatedAt = "2026-08-23T03:30:00Z";
      return json({
        correction_status: teacherReviewed ? "COMPLETED" : "PENDING",
        correction_completed_at: teacherReviewed ? "2026-08-23T03:30:00Z" : null,
        correction_note: String(correctionPayload.note ?? ""),
        correction_updated_at: reviewUpdatedAt,
        teacher_resolved: teacherReviewed,
      });
    }
    if (path === `/submissions/submissions/homework/${HOMEWORK_ID}/media/9911/preview/`) {
      const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eef2ff"/><text x="400" y="300" text-anchor="middle" font-size="38">homework preview</text></svg>');
      return json({
        url: `data:image/svg+xml,${svg}`,
        media_kind: "image",
        mime_type: "image/jpeg",
        original_filename: "풀이 앞면.jpg",
        expires_in: 600,
      });
    }
    if (path === "/enrollments/" || path === "/enrollments/session-enrollments/") return json([]);
    if (path === "/staffs/currently-working/") return json([]);
    return json({ count: 0, results: [] });
  });

  return {
    correctionPayload: () => correctionPayload,
  };
}

async function openSubmissionReview(page: Page) {
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/assignments?assessment=homework%3A${HOMEWORK_ID}`,
    { waitUntil: "domcontentloaded", timeout: 90_000 },
  );
  await expect(page.getByText("도형 풀이 인증", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "제출관리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "과제 제출 검수" })).toBeVisible({ timeout: 30_000 });
}

test("선생님이 학생별 제출 묶음에서 사진·동영상·오류를 파일별로 검수하고 미리본다", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 980 });
  const api = await installApi(page);
  await openSubmissionReview(page);

  await expect(page.getByText("제출 학생").locator("..")).toContainText("1");
  await expect(page.getByText("확인 대기").first().locator("..")).toContainText("1");
  await expect(page.getByText("확인 완료").first().locator("..")).toContainText("0");
  await expect(page.getByText("업로드 오류").locator("..")).toContainText("1");
  await expect(page.getByText("풀이 앞면.jpg", { exact: true })).toBeVisible();
  await expect(page.getByText("풀이 설명.mp4", { exact: true })).toBeVisible();
  await expect(page.getByText("파일 저장 실패", { exact: true })).toBeVisible();

  const imageRow = page.locator('[class*="fileRow"]').filter({ hasText: "풀이 앞면.jpg" });
  await imageRow.getByRole("button", { name: "미리보기" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "풀이 앞면.jpg" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: /과제 제출 미리보기/ })).toBeVisible();
  await dialog.getByRole("button", { name: "닫기" }).click();

  const studentCard = page.locator('[class*="studentCard"]').filter({ hasText: "김하늘" });
  await expect(studentCard.getByText("확인 대기", { exact: true })).toBeVisible();
  await studentCard.getByRole("button", { name: "확인 완료" }).click();
  const confirmDialog = page.getByRole("alertdialog").filter({ hasText: "김하늘 제출 확인 완료" });
  await confirmDialog.getByRole("button", { name: "확인 완료", exact: true }).click();
  await expect.poll(api.correctionPayload).toMatchObject({
    enrollment_id: 9902,
    source_type: "homework",
    source_id: HOMEWORK_ID,
    completed: true,
    note: "제출 파일 직접 확인",
    expected_updated_at: null,
  });
  await expect(studentCard.getByText("확인 완료", { exact: true })).toBeVisible();

  const failedRow = page.locator('[class*="fileRow"]').filter({ hasText: "흐린 사진.png" });
  await expect(failedRow.getByRole("button", { name: "미리보기" })).toBeDisabled();
  const desktopScreenshot = testInfo.outputPath("teacher-homework-media-desktop.png");
  await page.screenshot({ path: desktopScreenshot, fullPage: true });
  await testInfo.attach("teacher-homework-media-desktop", { path: desktopScreenshot, contentType: "image/png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "제출관리", exact: true }).click();
  const mobileVideo = page.getByText("풀이 설명.mp4", { exact: true });
  await expect(mobileVideo).toBeVisible();
  await mobileVideo.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const mobileScreenshot = testInfo.outputPath("teacher-homework-media-390.png");
  await page.screenshot({ path: mobileScreenshot, fullPage: true });
  await testInfo.attach("teacher-homework-media-390", { path: mobileScreenshot, contentType: "image/png" });
});
