import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 8801;
const SESSION_ID = 8802;
const HOMEWORK_ID = 8803;

test.use({ serviceWorkers: "block" });

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type ReviewMockOptions = {
  reviewImagesOnly?: boolean;
  reviewPdf?: boolean;
  scoreLocked?: boolean;
  failFirstReview?: boolean;
};

async function installApi(page: Page, submissionStatus = "submitted", newAssistant = false, options: ReviewMockOptions = {}) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "과제 파일 검수 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installTenantOneInitScript(page);
  const token = fakeJwt();
  let firstLoginGuideRequired = newAssistant;
  let reviewed = false;
  let reviewUpdatedAt: string | null = null;
  let scoreLocked = options.scoreLocked ?? false;
  let reviewPosts = 0;
  let lastReviewPayload: Record<string, unknown> | null = null;
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
      return json({ id: 12, username: "teacher", name: "김선생", is_staff: true, is_superuser: false, tenantRole: newAssistant ? "staff" : "teacher", must_change_password: false, first_login_guide_required: firstLoginGuideRequired });
    }
    if (path === "/core/me/first-login-guide/complete/" && request.method() === "POST") {
      firstLoginGuideRequired = false;
      return json({ ok: true });
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
    if (path === `/results/admin/sessions/${SESSION_ID}/scores/`) {
      return json({
        meta: { exams: [], homeworks: [] },
        rows: [{ enrollment_id: 9902, student_name: "김하늘", exams: [], homeworks: scoreLocked ? [{ homework_id: HOMEWORK_ID, attempt_count: 1, block: { score: 0 } }] : [], updated_at: "2026-08-23T03:20:00Z" }],
      });
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/score-correction/` && request.method() === "PATCH") {
      reviewPosts += 1;
      lastReviewPayload = request.postDataJSON() as Record<string, unknown>;
      if (options.failFirstReview && reviewPosts === 1) {
        reviewUpdatedAt = "2026-08-23T03:25:00Z";
        return json({ detail: "다른 화면에서 판정이 변경되었습니다. 새로고침 후 다시 확인해 주세요.", code: "ASSESSMENT_CORRECTION_CONFLICT" }, 409);
      }
      if (lastReviewPayload.expected_updated_at !== reviewUpdatedAt) {
        return json({ detail: "판정 시각이 맞지 않습니다." }, 409);
      }
      reviewed = lastReviewPayload.completed === true;
      reviewUpdatedAt = reviewPosts === 1 ? "2026-08-23T03:30:00Z" : "2026-08-23T03:35:00Z";
      return json({ correction_status: reviewed ? "completed" : "pending", correction_updated_at: reviewUpdatedAt });
    }
    if (path === `/submissions/submissions/homework/${HOMEWORK_ID}/`) {
      return json([{
        id: 9901,
        enrollment_id: 9902,
        student_id: 9903,
        student_name: "김하늘",
        profile_photo_url: null,
        status: submissionStatus,
        source: "homework_media",
        file_type: "image/jpeg",
        file_size: 1800,
        lecture_title: "고1 수학",
        lecture_color: "#2563eb",
        lecture_chip_label: "수",
        name_highlight_clinic_target: false,
        teacher_reviewed: reviewed,
        teacher_review_source: reviewed ? "manual" : null,
        teacher_review_note: reviewed ? "제출 파일 직접 확인" : "",
        teacher_reviewed_at: reviewed ? "2026-08-23T03:30:00Z" : null,
        teacher_review_updated_at: reviewUpdatedAt,
        media_set_fingerprint: "fixture-media-v1",
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
            legacy: options.reviewPdf ?? false,
            position: 1,
            original_filename: options.reviewPdf ? "풀이 자료.pdf" : options.reviewImagesOnly ? "풀이 뒷면.jpg" : "풀이 설명.mp4",
            media_kind: options.reviewImagesOnly || options.reviewPdf ? "image" : "video",
            mime_type: options.reviewPdf ? "application/pdf" : options.reviewImagesOnly ? "image/jpeg" : "video/mp4",
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
    if (path === `/submissions/submissions/homework/${HOMEWORK_ID}/media/9912/preview/` && options.reviewImagesOnly) {
      const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dcfce7"/></svg>');
      return json({ url: `data:image/svg+xml,${svg}`, media_kind: "image", mime_type: "image/jpeg", original_filename: "풀이 뒷면.jpg", expires_in: 600 });
    }
    if (path === `/submissions/submissions/homework/${HOMEWORK_ID}/media/9912/preview/` && options.reviewPdf) {
      return json({ url: `${BASE}/__homework_pdf_fixture.pdf`, media_kind: "image", mime_type: "application/pdf", original_filename: "풀이 자료.pdf", expires_in: 600 });
    }
    if (path === "/enrollments/" || path === "/enrollments/session-enrollments/") return json([]);
    if (path === "/staffs/currently-working/") return json([]);
    return json({ count: 0, results: [] });
  });
  return {
    reviewPosts: () => reviewPosts,
    lastReviewPayload: () => lastReviewPayload,
    setScoreLocked: (value: boolean) => { scoreLocked = value; },
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
  await installApi(page);
  await openSubmissionReview(page);

  await expect(page.getByText("제출 학생").locator("..")).toContainText("1");
  await expect(page.getByText("전체 파일").locator("..")).toContainText("3");
  await expect(page.getByText("검수 가능").first().locator("..")).toContainText("2");
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

test("관리자 PC에서 모든 제출 파일 확인 후 저장·새로고침·취소하고 0점 기록 시 잠근다", async ({ page }) => {
  const api = await installApi(page, "submitted", false, { reviewImagesOnly: true });
  await openSubmissionReview(page);

  const complete = page.getByRole("button", { name: "직접 확인 완료" });
  await expect(page.locator('[aria-label="제출 요약"] > div').filter({ hasText: "확인 대기" })).toContainText("1");
  await expect(complete).toBeDisabled();
  for (const filename of ["풀이 앞면.jpg", "풀이 뒷면.jpg"]) {
    await page.locator('[class*="fileRow"]').filter({ hasText: filename }).getByRole("button", { name: "미리보기" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: filename });
    await expect(dialog.getByRole("img", { name: /과제 제출 미리보기/ })).toBeVisible();
    await dialog.getByRole("button", { name: "닫기" }).click();
  }
  await expect(page.getByText("제출 파일 2/2개를 열었습니다.")).toBeVisible();
  await expect(complete).toBeEnabled();
  await complete.click();
  await page.getByRole("button", { name: "확인 완료", exact: true }).click();
  await expect(page.locator('[aria-label="제출 요약"] > div').filter({ hasText: "확인 완료" })).toContainText("1");
  expect(api.reviewPosts()).toBe(1);
  expect(api.lastReviewPayload()).toMatchObject({
    enrollment_id: 9902, source_type: "homework", source_id: HOMEWORK_ID,
    completed: true, expected_updated_at: null,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "제출관리", exact: true }).click();
  const cancel = page.getByRole("button", { name: "확인 완료 취소" });
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await page.getByRole("button", { name: "확인 취소", exact: true }).click();
  await expect(page.locator('[aria-label="제출 요약"] > div').filter({ hasText: "확인 대기" })).toContainText("1");
  expect(api.reviewPosts()).toBe(2);
  expect(api.lastReviewPayload()).toMatchObject({ completed: false, expected_updated_at: "2026-08-23T03:30:00Z" });

  api.setScoreLocked(true);
  await page.getByRole("button", { name: "새로고침" }).click();
  await expect(page.getByText("점수가 입력되어 성적 화면에서 결과를 관리합니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "직접 확인 완료" })).toHaveCount(0);
  expect(api.reviewPosts()).toBe(2);
});

test("관리자 PC 검수의 동시 수정 충돌을 표시하고 최신 상태로 재시도한다", async ({ page }) => {
  const api = await installApi(page, "submitted", false, { reviewImagesOnly: true, failFirstReview: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await openSubmissionReview(page);

  for (const filename of ["풀이 앞면.jpg", "풀이 뒷면.jpg"]) {
    await page.locator('[class*="fileRow"]').filter({ hasText: filename }).getByRole("button", { name: "미리보기" }).click();
    await expect(page.getByRole("dialog").filter({ hasText: filename }).getByRole("img", { name: /과제 제출 미리보기/ })).toBeVisible();
    await page.getByRole("button", { name: "닫기" }).click();
  }
  await page.getByRole("button", { name: "직접 확인 완료" }).click();
  await page.getByRole("button", { name: "확인 완료", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("다른 화면에서 판정이 변경되었습니다.");
  expect(api.reviewPosts()).toBe(1);
  await page.getByRole("button", { name: "최신 상태 확인" }).click();
  await page.getByRole("button", { name: "직접 확인 완료" }).click();
  await page.getByRole("button", { name: "확인 완료", exact: true }).click();
  await expect(page.locator('[aria-label="제출 요약"] > div').filter({ hasText: "확인 완료" })).toContainText("1");
  expect(api.reviewPosts()).toBe(2);
  expect(api.lastReviewPayload()).toMatchObject({ completed: true, expected_updated_at: "2026-08-23T03:25:00Z" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("기존 PDF 제출 파일은 새 창 원본 열기와 명시 열람 확인을 제공한다", async ({ page }) => {
  await installApi(page, "submitted", false, { reviewPdf: true });
  await openSubmissionReview(page);
  const pdfRow = page.locator('[class*="fileRow"]').filter({ hasText: "풀이 자료.pdf" });
  await expect(pdfRow).toContainText("PDF");
  await pdfRow.getByRole("button", { name: "미리보기" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "풀이 자료.pdf" });
  const pdfLink = dialog.getByRole("link", { name: "PDF 원본 열기" });
  await expect(pdfLink).toBeVisible();
  await expect(dialog.getByRole("button", { name: "열람 확인" })).toBeDisabled();
  const [popup] = await Promise.all([page.waitForEvent("popup"), pdfLink.click()]);
  await expect(popup).toHaveURL(/__homework_pdf_fixture\.pdf$/);
  await popup.close();
  await dialog.getByRole("button", { name: "열람 확인" }).click();
  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByText("제출 파일 1/2개를 열었습니다.")).toBeVisible();
});

test("신규 조교가 계정 안내 확인 후 모바일 과제 파일을 열고 새로고침해도 확인한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page, "done", true);
  await page.goto(`${BASE}/workspace/mobile/homeworks/${HOMEWORK_ID}`);
  await expect(page.getByRole("heading", { name: "제출 확인 (1)" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "계정 안내" })).toBeVisible();
  const guideCompleted = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === "/api/v1/core/me/first-login-guide/complete/",
  );
  await acknowledgeInitialAccountPromptsIfVisible(page);
  expect((await guideCompleted).status()).toBe(200);
  const reviewButton = page.getByRole("button", { name: "제출물 확인" });
  await reviewButton.click();
  const dialog = page.getByRole("dialog", { name: "김하늘 제출 확인" });
  const preview = dialog.getByRole("img", { name: "풀이 앞면.jpg 과제 제출 미리보기" });
  await expect(preview).toBeVisible();
  await expect(dialog.getByRole("button", { name: /흐린 사진\.png/ })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "직접 확인 완료" })).toBeDisabled();
  await dialog.getByRole("button", { name: "닫기" }).click();
  await page.reload();
  await expect(page.getByText("풀이 설명.mp4", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "계정 안내" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("mobile-homework-files-390.png"), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await reviewButton.click();
  await expect(preview).toBeVisible();
  await expect(dialog).not.toHaveClass(/ant-zoom/);
  await expect(dialog).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("mobile-homework-preview-1366.png"), fullPage: true, animations: "disabled" });
});
