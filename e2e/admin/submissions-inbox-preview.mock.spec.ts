import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
test.use({ serviceWorkers: "block" });

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installSubmissionApi(page: Page, options: {
  breakImageOnReopen?: boolean;
  brokenImage?: boolean;
  externalFile?: "pdf" | "unsupported";
  recovery?: boolean;
  failAssignmentOnce?: boolean;
  projectionPending?: boolean;
} = {}) {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, localJwt());

  const assignmentBodies: Array<Record<string, unknown>> = [];
  let imageCalls = 0;
  let presignCalls = 0;
  let assigned = false;
  let answer = "빛";
  let reviewed = false;
  let reviewReads = 0;

  const fileKey = options.externalFile === "pdf"
    ? "tenants/11/submissions/501/answer-sheet.pdf"
    : options.externalFile === "unsupported"
      ? "tenants/11/submissions/501/answer-sheet.hwp"
      : "tenants/11/submissions/501/answer-sheet.png";
  const fileUrl = `${BASE}/api/v1/mock-files/${fileKey.split("/").pop()}`;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === "/mock-files/answer-sheet.png" && request.method() === "GET") {
      imageCalls += 1;
      if (options.brokenImage || (options.breakImageOnReopen && imageCalls >= 2)) {
        await route.fulfill({
          status: 404,
          contentType: "text/plain",
          headers: { "cache-control": "no-store" },
          body: "missing",
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        headers: { "cache-control": "no-store" },
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2fKAAAAAASUVORK5CYII=",
          "base64",
        ),
      });
      return;
    }
    if (path === "/mock-files/answer-sheet.hwp" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "mock hwp source" });
      return;
    }
    if (path === "/mock-files/answer-sheet.pdf" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<p>mock pdf source</p>" });
      return;
    }
    if (path === "/submissions/submissions/pending/" && request.method() === "GET") {
      await json(route, [
        {
          id: 501,
          enrollment_id: assigned ? 901 : 0,
          student_name: assigned ? "김학생" : "",
          target_type: "exam",
          target_id: 77,
          target_title: "중2 과학 진단평가",
          lecture_id: 31,
          lecture_title: "중2 과학 정규반",
          session_id: 44,
          target_resolved: true,
          target_resolved_reason: null,
          source: "scan",
          status: reviewed ? "done" : assigned ? "answers_ready" : "needs_identification",
          has_file: true,
          file_name: fileKey.split("/").pop(),
          file_type: options.externalFile === "pdf"
            ? "application/pdf"
            : options.externalFile === "unsupported"
              ? "application/x-hwp"
              : "image/png",
          file_size: 2 * 1024 * 1024,
          created_at: "2026-08-23T08:30:00+09:00",
        },
      ]);
      return;
    }
    if (path === "/submissions/submissions/501/preview/" && request.method() === "GET") {
      presignCalls += 1;
      await json(route, { url: `${fileUrl}?review=${presignCalls}` });
      return;
    }
    if (path === "/submissions/submissions/exams/77/candidates/" && request.method() === "GET") {
      await json(route, [
        {
          enrollment_id: 901,
          student_name: "김학생",
          student_phone_last4: "1234",
          parent_phone_last4: "5678",
          lecture_title: "중2 과학 정규반",
          already_matched: false,
        },
      ]);
      return;
    }
    if (path === "/submissions/submissions/501/manual-edit/" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      assignmentBodies.push(body);
      if (options.failAssignmentOnce && assignmentBodies.length === 1) return json(route, { detail: "학생 지정에 실패했습니다. 다시 시도해 주세요." }, 400);
      if (options.recovery) {
        assigned = true;
        const answers = body.answers as Array<{ answer: string }>;
        if (answers.length) {
          answer = answers[0].answer;
          reviewed = true;
        }
        return json(route, {
          submission_id: 501, enrollment_id: 901,
          status: reviewed ? "done" : "answers_ready",
          graded: reviewed || options.projectionPending === true,
          projection_ready: reviewed ? true : options.projectionPending ? false : undefined,
        });
      }
      await json(route, { submission_id: 501, status: "grading" });
      return;
    }
    if (options.recovery && path === "/submissions/submissions/exams/77/" && request.method() === "GET") {
      const row = { id: 501, enrollment_id: assigned ? 901 : 0, student_name: "김학생", status: reviewed ? "done" : "answers_ready", source: "omr_scan", score: reviewed ? 100 : null, created_at: "2026-08-23T08:30:00+09:00", file_key: fileKey, has_file: true, manual_review_required: !reviewed, manual_review_reasons: reviewed ? [] : ["ambiguous_answer"], identifier_status: "matched" };
      return json(route, new URL(request.url()).searchParams.has("review_issues") ? { items: [row], total: 1, next_cursor: null } : [row]);
    }
    if (options.recovery && path === "/submissions/submissions/501/manual-edit/" && request.method() === "GET") {
      reviewReads += 1;
      return json(route, { submission_id: 501, submission_status: reviewed ? "done" : "answers_ready", enrollment_id: 901, target_type: "exam", target_id: 77, identifier: { enrollment_id: 901 }, scan_image_url: fileUrl, answers: [{ question_id: 1001, question_no: 1, answer, omr: null }], meta: { manual_review: { required: !reviewed, reasons: reviewed ? [] : ["ambiguous_answer"] }, identifier_status: "matched" }, duplicate_siblings: [] });
    }
    const shellReads: Record<string, unknown> = {
      "/core/og-meta/": {},
      "/clinic/participants/": [],
      "/community/admin/reports/pending-count/": { count: 0 },
      "/community/notifications/unread-count/": { count: 0 },
      "/core/landing/admin/consult/": { items: [], summary: { total: 0, unread: 0 } },
      "/lectures/attendance/arrival-overview/": { students: [], sessions: [], summary: {} },
      "/results/admin/teacher-dashboard-counts/": { video_failed: 0, qna_pending: 0, counsel_pending: 0, submission_pending: 1 },
      "/staffs/currently-working/": [],
      "/staffs/me/": { id: 12, is_working: false, work_types: [] },
      "/students/registration_requests/": { count: 0, results: [] },
    };
    if (request.method() === "GET" && Object.hasOwn(shellReads, path)) return json(route, shellReads[path]);
    if (["/core/program/", "/core/me/", "/token/refresh/", "/results/admin/clinic-targets/"].includes(path)) {
      return route.fallback(); // Explicit local authentication stubs installed above.
    }
    throw new Error(`Unexpected local submission fixture request: ${request.method()} ${path}`);
  });

  return {
    assignmentBodies,
    get reviewed() { return reviewed; },
    get reviewReads() { return reviewReads; },
    get imageCalls() {
      return imageCalls;
    },
    get presignCalls() {
      return presignCalls;
    },
  };
}

for (const width of [1366, 390]) {
  test(`@assignment-recovery ${width}px 학생 지정 뒤 미완료 채점을 직접 복구하고 새로고침한다`, async ({ page }) => {
    const calls = await installSubmissionApi(page, { recovery: true });
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });
    await page.getByTestId("submission-preview-501").click();
    await page.getByRole("button", { name: "확인하고 학생 지정" }).click();
    await page.getByRole("dialog", { name: "학생 선택" }).getByText("김학생", { exact: true }).click();
    await expect(page.getByTestId("submission-identification-result")).toContainText("채점 전 확인이 필요합니다");
    expect(calls.assignmentBodies[0].answers).toEqual([]);
    await page.reload();
    await expect(page.getByTestId("submission-inbox-501")).toContainText("김학생");
    await page.getByTestId("submission-review-501").click();
    const review = page.getByRole("dialog", { name: "OMR 검토", exact: true });
    await expect(review).toBeVisible();
    await expect.poll(() => calls.reviewReads).toBeGreaterThan(0);
    if (width === 390) await review.getByRole("tab", { name: "확인", exact: true }).click();
    await review.getByPlaceholder("답안 입력").fill("굴절");
    await review.getByRole("button", { name: "저장 + 재채점", exact: true }).click();
    await expect.poll(() => calls.reviewed).toBe(true);
    await review.getByRole("button", { name: "닫기", exact: true }).click();
    await page.goto(`${BASE}/workspace/results/submissions?filter=done`);
    await expect(page.getByTestId("submission-inbox-501")).toContainText("완료");
    expect(calls.assignmentBodies.at(-1)?.answers).toEqual([{ exam_question_id: 1001, answer: "굴절" }]);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("@assignment-recovery 배정 실패 후 같은 학생으로 재시도하고 성적 반영 대기를 구분한다", async ({ page }) => {
  const calls = await installSubmissionApi(page, { recovery: true, failAssignmentOnce: true, projectionPending: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });
  await page.getByTestId("submission-preview-501").click();
  await page.getByRole("button", { name: "확인하고 학생 지정" }).click();
  const picker = page.getByRole("dialog", { name: "학생 선택" });
  await picker.getByText("김학생", { exact: true }).click();
  await expect(page.getByText("학생 지정에 실패했습니다. 다시 시도해 주세요.", { exact: true })).toBeVisible();
  await expect(picker).toBeVisible();
  await expect(page.getByTestId("submission-identification-result")).toHaveCount(0);
  await picker.getByText("김학생", { exact: true }).click();
  await expect(page.getByTestId("submission-identification-result")).toContainText("아직 성적 반영이 끝나지 않았습니다");
  expect(calls.assignmentBodies).toHaveLength(2);
  expect(calls.assignmentBodies[0]).toEqual(calls.assignmentBodies[1]);
});

test("제출 파일을 확인한 뒤에만 학생을 지정한다", async ({ page }) => {
  const calls = await installSubmissionApi(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });

  const fileMeta = page.getByTestId("submission-file-meta-501");
  await expect(fileMeta).toContainText("answer-sheet.png");
  await expect(fileMeta).toContainText("PNG · 2.0 MB");
  await expect(page.getByRole("button", { name: "학생 지정", exact: true })).toHaveCount(0);

  const previewButton = page.getByTestId("submission-preview-501");
  await previewButton.click();
  const previewDialog = page.getByRole("dialog", { name: "제출물 확인" });
  await expect(previewDialog).toBeVisible();
  const previewImage = previewDialog.getByAltText("answer-sheet.png 제출물");
  await expect(previewImage).toBeVisible();
  await expect(previewImage).toHaveJSProperty("naturalWidth", 1);
  await expect(previewDialog.getByText("중2 과학 진단평가", { exact: true })).toBeVisible();
  await expect(previewDialog.getByRole("button", { name: "확인하고 학생 지정" })).toBeEnabled();
  expect(calls.presignCalls).toBe(1);
  expect(calls.imageCalls).toBe(1);

  await previewDialog.getByRole("button", { name: "닫기" }).click();
  await expect(previewDialog).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(previewButton).toBeVisible();
  await previewButton.click();
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.getByAltText("answer-sheet.png 제출물")).toHaveJSProperty("complete", true);
  await expect(previewDialog.getByRole("button", { name: "확인하고 학생 지정" })).toBeEnabled();
  const previewBounds = await previewDialog.getByTestId("submission-preview-content").boundingBox();
  expect(previewBounds).not.toBeNull();
  expect(previewBounds!.x).toBeGreaterThanOrEqual(0);
  expect(previewBounds!.x + previewBounds!.width).toBeLessThanOrEqual(390);

  await previewDialog.getByRole("button", { name: "확인하고 학생 지정" }).click();
  const picker = page.getByRole("dialog", { name: "학생 선택" });
  await expect(picker).toBeVisible();
  await picker.getByText("김학생", { exact: true }).click();

  await expect.poll(() => calls.assignmentBodies.length).toBe(1);
  expect(calls.assignmentBodies[0]).toEqual({
    identifier: { enrollment_id: 901 },
    answers: [],
    note: "inbox_quick_identify",
  });
});

test("깨진 제출 이미지는 학생 지정을 끝까지 잠근다", async ({ page }) => {
  const calls = await installSubmissionApi(page, { brokenImage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });

  await page.getByTestId("submission-preview-501").click();
  const previewDialog = page.getByRole("dialog", { name: "제출물 확인" });
  const identifyButton = previewDialog.getByRole("button", { name: "확인하고 학생 지정" });
  await expect(previewDialog.getByRole("alert")).toContainText("제출 이미지를 열 수 없습니다.");
  await expect(identifyButton).toBeDisabled();

  await identifyButton.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole("dialog", { name: "학생 선택" })).toHaveCount(0);
  expect(calls.assignmentBodies).toHaveLength(0);

  await previewDialog.getByRole("button", { name: "이미지 다시 시도" }).click();
  await expect.poll(() => calls.presignCalls).toBe(2);
  await expect(previewDialog.getByRole("alert")).toContainText("학생 지정이 잠겼습니다.");
  await expect(identifyButton).toBeDisabled();
  expect(calls.assignmentBodies).toHaveLength(0);
});

test("같은 제출을 다시 열어도 이전 이미지 확인 상태를 재사용하지 않는다", async ({ page }) => {
  const calls = await installSubmissionApi(page, { breakImageOnReopen: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });

  await page.getByTestId("submission-preview-501").click();
  const previewDialog = page.getByRole("dialog", { name: "제출물 확인" });
  const identifyButton = previewDialog.getByRole("button", { name: "확인하고 학생 지정" });
  await expect(identifyButton).toBeEnabled();
  await previewDialog.getByRole("button", { name: "닫기" }).click();

  await page.getByTestId("submission-preview-501").click();
  await expect(previewDialog.getByRole("alert")).toContainText("제출 이미지를 열 수 없습니다.");
  await expect(identifyButton).toBeDisabled();
  await identifyButton.evaluate((button: HTMLButtonElement) => button.click());
  expect(calls.presignCalls).toBe(2);
  expect(calls.imageCalls).toBe(2);
  expect(calls.assignmentBodies).toHaveLength(0);
});

for (const externalFile of ["pdf", "unsupported"] as const) {
  test(`${externalFile === "pdf" ? "PDF" : "화면 미지원"} 파일은 원본을 열고 명시 확인하기 전까지 지정을 잠근다`, async ({ page }) => {
    const calls = await installSubmissionApi(page, { externalFile });
    await page.setViewportSize({ width: 1440, height: 960 });
    await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });

    await page.getByTestId("submission-preview-501").click();
    const previewDialog = page.getByRole("dialog", { name: "제출물 확인" });
    const identifyButton = previewDialog.getByRole("button", { name: "확인하고 학생 지정" });
    const confirmation = previewDialog.getByRole("checkbox");
    await expect(identifyButton).toBeDisabled();
    await expect(confirmation).toBeDisabled();

    const popupPromise = page.waitForEvent("popup");
    await previewDialog.getByRole("link", { name: "새 창에서 원본 열기" }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await popup.close();

    await expect(confirmation).toBeEnabled();
    await confirmation.check();
    await expect(identifyButton).toBeEnabled();

    await previewDialog.getByRole("button", { name: "닫기" }).click();
    await page.getByTestId("submission-preview-501").click();
    await expect(confirmation).toBeDisabled();
    await expect(identifyButton).toBeDisabled();

    const reopenPopupPromise = page.waitForEvent("popup");
    await previewDialog.getByRole("link", { name: "새 창에서 원본 열기" }).click();
    const reopenPopup = await reopenPopupPromise;
    await reopenPopup.waitForLoadState("domcontentloaded");
    await reopenPopup.close();
    await confirmation.check();
    await expect(identifyButton).toBeEnabled();
    await identifyButton.click();
    await expect(page.getByRole("dialog", { name: "학생 선택" })).toBeVisible();
    expect(calls.assignmentBodies).toHaveLength(0);
  });
}
