import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const HOMEWORK_ID = 8803;
const SESSION_ID = 8802;

test.use({ serviceWorkers: "block" });

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page, options: { reviewed?: boolean; scoreReviewed?: boolean; score?: number; previewFailures?: number } = {}) {
  let reviewed = options.reviewed ?? options.scoreReviewed ?? false;
  let reviewUpdatedAt: string | null = reviewed && !options.scoreReviewed ? "2026-08-23T03:30:00Z" : null;
  let correctionPayload: Record<string, unknown> | null = null;
  let previewFailures = options.previewFailures ?? 0;
  let saveFailures = 0;

  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
  }, fakeJwt());

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "학원플러스", is_active: true, feature_flags: {}, ui_config: {} });
    if (path === "/core/me/") return json({ id: 12, username: "teacher", name: "김선생", is_staff: true, tenantRole: "teacher", linkedStudents: [] });
    if (path === `/results/admin/sessions/${SESSION_ID}/scores/`) {
      const score = options.scoreReviewed ? 100 : options.score ?? null;
      return json({ meta: { homeworks: [] }, rows: [{
        enrollment_id: 9902,
        homeworks: [{ homework_id: HOMEWORK_ID, attempt_count: score == null ? 0 : 1, block: { score, passed: score === 100 } }],
      }] });
    }
    if (path === `/homeworks/${HOMEWORK_ID}/`) {
      return json({
        id: HOMEWORK_ID,
        title: "도형 풀이 인증",
        session: SESSION_ID,
        session_id: SESSION_ID,
        session_title: "3차시",
        max_score: 100,
        meta: {},
      });
    }
    if (path === `/submissions/submissions/homework/${HOMEWORK_ID}/`) {
      return json([{
        id: 9901,
        enrollment_id: 9902,
        student_id: 9903,
        student_name: "김하늘",
        status: "submitted",
        created_at: "2026-08-23T03:20:00Z",
        files: [{
          id: "9911",
          position: 0,
          original_filename: "풀이 앞면.jpg",
          media_kind: "image",
          file_size: 1800,
          status: "uploaded",
          error_message: "",
          removed_at: null,
        }],
        teacher_reviewed: reviewed,
        teacher_review_source: options.scoreReviewed ? "score" : reviewed ? "manual" : null,
        teacher_review_note: reviewed ? "제출 파일 직접 확인" : "",
        teacher_reviewed_at: reviewed ? "2026-08-23T03:30:00Z" : null,
        teacher_review_updated_at: reviewUpdatedAt,
      }]);
    }
    if (path === `/submissions/submissions/homework/${HOMEWORK_ID}/media/9911/preview/`) {
      if (previewFailures > 0) {
        previewFailures -= 1;
        return json({ detail: "미리보기 실패" }, 503);
      }
      const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eef2ff"/><text x="400" y="300" text-anchor="middle" font-size="38">homework preview</text></svg>');
      return json({ url: `data:image/svg+xml,${svg}`, media_kind: "image", mime_type: "image/jpeg", original_filename: "풀이 앞면.jpg", expires_in: 600 });
    }
    if (path === `/results/admin/sessions/${SESSION_ID}/score-correction/` && request.method() === "PATCH") {
      correctionPayload = request.postDataJSON() as Record<string, unknown>;
      if (saveFailures > 0) {
        saveFailures -= 1;
        return json({ detail: "저장 실패" }, 503);
      }
      reviewed = correctionPayload.completed === true;
      reviewUpdatedAt = reviewed ? "2026-08-23T03:31:00Z" : "2026-08-23T03:32:00Z";
      return json({ correction_status: reviewed ? "COMPLETED" : "PENDING", correction_completed_at: reviewed ? reviewUpdatedAt : null, correction_note: String(correctionPayload.note ?? ""), correction_updated_at: reviewUpdatedAt, teacher_resolved: reviewed });
    }
    return json({ count: 0, next: null, previous: null, results: [] });
  });

  return {
    correctionPayload: () => correctionPayload,
    failNextSave: () => { saveFailures = 1; },
    allowPreview: () => { previewFailures = 0; },
  };
}

test("선생님이 모바일 과제 상세에서 제출 파일을 보고 직접 확인 완료한다", async ({ page }, testInfo) => {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 검증 전용");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installApi(page);

  await page.goto(`${BASE}/workspace/mobile/homeworks/${HOMEWORK_ID}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "도형 풀이 인증" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("선생님 확인", { exact: true }).locator("..")).toContainText("0 / 1");
  await expect(page.getByText("확인 대기", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "제출물 확인" }).click({ timeout: 20_000 });
  const reviewSheet = page.getByRole("dialog").filter({ hasText: "김하늘 제출 확인" });
  await expect(reviewSheet.getByRole("img", { name: /과제 제출 미리보기/ })).toBeVisible();
  await expect(reviewSheet.getByRole("button", { name: "직접 확인 완료" })).toBeInViewport();
  const reviewScreenshot = testInfo.outputPath("teacher-homework-review-sheet-390.png");
  await page.screenshot({ path: reviewScreenshot });
  await testInfo.attach("teacher-homework-review-sheet-390", { path: reviewScreenshot, contentType: "image/png" });
  await reviewSheet.getByRole("button", { name: "직접 확인 완료" }).click();

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
  await expect(page.getByText("확인 완료", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("확인 완료", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "제출물 확인" }).click();
  await reviewSheet.getByRole("button", { name: "확인 완료 취소" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "확인 취소" }).click();
  await expect.poll(api.correctionPayload).toMatchObject({ completed: false, expected_updated_at: "2026-08-23T03:31:00Z" });
  await expect(page.getByText("확인 대기", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("확인 대기", { exact: true })).toBeVisible();
  const screenshot = testInfo.outputPath("teacher-homework-manual-review-390.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach("teacher-homework-manual-review-390", { path: screenshot, contentType: "image/png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("button", { name: "제출물 확인" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const desktopScreenshot = testInfo.outputPath("teacher-homework-manual-review-desktop.png");
  await page.screenshot({ path: desktopScreenshot, fullPage: true });
  await testInfo.attach("teacher-homework-manual-review-desktop", { path: desktopScreenshot, contentType: "image/png" });
});

test("미리보기와 저장 실패는 완료를 막고 재시도할 수 있다", async ({ page }) => {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 검증 전용");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await installApi(page, { previewFailures: 20 });
  await page.goto(`${BASE}/workspace/mobile/homeworks/${HOMEWORK_ID}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "도형 풀이 인증" })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "제출물 확인" }).click({ timeout: 20_000 });
  const reviewSheet = page.getByRole("dialog").filter({ hasText: "김하늘 제출 확인" });
  await expect(reviewSheet.getByRole("button", { name: "직접 확인 완료" })).toBeDisabled();
  await expect(reviewSheet.getByRole("button", { name: /파일을 불러오지 못했습니다.*다시 시도/ })).toBeVisible({ timeout: 20_000 });
  api.allowPreview();
  await reviewSheet.getByRole("button", { name: /파일을 불러오지 못했습니다.*다시 시도/ }).click();
  await expect(reviewSheet.getByRole("img", { name: /과제 제출 미리보기/ })).toBeVisible();
  await expect(reviewSheet.getByRole("button", { name: "직접 확인 완료" })).toBeEnabled();

  api.failNextSave();
  await reviewSheet.getByRole("button", { name: "직접 확인 완료" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "확인 완료", exact: true }).click();
  await expect(page.getByText("저장 실패", { exact: true })).toBeVisible();
  await expect(reviewSheet.getByRole("button", { name: "직접 확인 완료" })).toBeEnabled();
  await reviewSheet.getByRole("button", { name: "직접 확인 완료" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "확인 완료", exact: true }).click();
  await expect.poll(api.correctionPayload).toMatchObject({ completed: true });
  await expect(page.getByText("확인 완료", { exact: true })).toBeVisible();
});

test("점수로 확인된 과제는 직접 확인을 취소할 수 없다", async ({ page }) => {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 검증 전용");
  await installApi(page, { scoreReviewed: true });
  await page.goto(`${BASE}/workspace/mobile/homeworks/${HOMEWORK_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("점수 입력 완료", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "제출물 확인" }).click();
  const reviewSheet = page.getByRole("dialog").filter({ hasText: "김하늘 제출 확인" });
  await expect(reviewSheet.getByText("점수가 입력되어 성적 화면에서 결과를 관리합니다.")).toBeVisible();
  await expect(reviewSheet.getByRole("button", { name: "확인 완료 취소" })).toHaveCount(0);
});

test("불합격 점수가 있어도 직접 확인 완료로 덮어쓰지 않는다", async ({ page }) => {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 검증 전용");
  const api = await installApi(page, { score: 40 });
  await page.goto(`${BASE}/workspace/mobile/homeworks/${HOMEWORK_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("점수 결과 확인", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "제출물 확인" }).click();
  const reviewSheet = page.getByRole("dialog").filter({ hasText: "김하늘 제출 확인" });
  await expect(reviewSheet.getByText("점수가 입력되어 성적 화면에서 결과를 관리합니다.")).toBeVisible();
  await expect(reviewSheet.getByRole("button", { name: "직접 확인 완료" })).toHaveCount(0);
  expect(api.correctionPayload()).toBeNull();
});
