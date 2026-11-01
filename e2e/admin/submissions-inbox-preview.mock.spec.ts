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
  targetOutsideRecent?: boolean;
  failReview?: boolean;
  wrongReviewExam?: boolean;
  assignmentConflict?: "matching" | "mismatch";
  missingConfiguration?: "answer_key" | "sheet" | "grading_configuration";
  configurationConflict?: boolean;
  recoveryExamId?: number;
  unresolvedTarget?: boolean;
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
  let assigned = options.targetOutsideRecent ?? false;
  let answer = "빛";
  let reviewed = options.targetOutsideRecent ?? false;
  let reviewReads = 0;
  let failReview = options.failReview ?? false;
  let missingConfiguration = options.missingConfiguration;
  const detailRequests: string[] = [];

  const fileKey = options.externalFile === "pdf"
    ? "tenants/11/submissions/501/answer-sheet.pdf"
    : options.externalFile === "unsupported"
      ? "tenants/11/submissions/501/answer-sheet.hwp"
      : "tenants/11/submissions/501/answer-sheet.png";
  const fileUrl = `${BASE}/api/v1/mock-files/${fileKey.split("/").pop()}`;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (/\/submissions\/submissions\/\d+\/manual-edit\/$/.test(path)) detailRequests.push(`${request.method()} ${path}`);
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
          target_resolved: !options.unresolvedTarget,
          target_resolved_reason: null,
          source: "scan",
          status: reviewed ? "done" : assigned ? "answers_ready" : "needs_identification",
          omr_readiness: missingConfiguration ? { can_grade: false, missing: [missingConfiguration] } : null,
          recovery: missingConfiguration ? { action: "configure_exam", exam_id: options.recoveryExamId ?? 77 } : null,
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
      if (options.configurationConflict) return json(route, {
        code: "OMR_GRADING_CONFIGURATION_CONFLICT", detail: "기존 답안과 성적은 변경되지 않았습니다.",
        recovery: { action: "configure_exam", exam_id: options.recoveryExamId ?? 77 },
      }, 409);
      if (missingConfiguration) {
        assigned = true;
        return json(route, {
          submission_id: 501, enrollment_id: 901, status: "answers_ready", graded: false,
          code: "OMR_GRADING_CONFIGURATION_REQUIRED",
          readiness: { can_grade: false, missing: [missingConfiguration] },
          recovery: { action: "configure_exam", exam_id: options.recoveryExamId ?? 77 },
        });
      }
      if (options.assignmentConflict) return json(route, {
        code: "OMR_ATTEMPT_CONFLICT", detail: "기존 성적과 충돌합니다.",
        recovery: { action: "review_existing_result", exam_id: options.assignmentConflict === "matching" ? 77 : 78, enrollment_id: 901 },
      }, 409);
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
      if (options.targetOutsideRecent) {
        const otherRows = [502, 503].map(id => ({ ...row, id, enrollment_id: id + 500, student_name: "다른 학생", status: "answers_ready", manual_review_required: true }));
        const url = new URL(request.url());
        const items = url.searchParams.has("focus_id") ? [] : otherRows;
        return json(route, url.searchParams.has("review_issues") ? { items, total: items.length, next_cursor: null } : otherRows);
      }
      return json(route, new URL(request.url()).searchParams.has("review_issues") ? { items: [row], total: 1, next_cursor: null } : [row]);
    }
    if (options.recovery && path === "/submissions/submissions/501/manual-edit/" && request.method() === "GET") {
      reviewReads += 1;
      if (failReview) return json(route, { detail: "답안 상세 조회 실패" }, 503);
      return json(route, { submission_id: 501, submission_status: reviewed ? "done" : "answers_ready", enrollment_id: 901, target_type: "exam", target_id: options.wrongReviewExam ? 78 : 77, identifier: { enrollment_id: 901 }, scan_image_url: fileUrl, answers: [{ question_id: 1001, question_no: 1, answer, omr: null }], meta: { manual_review: { required: !reviewed, reasons: reviewed ? [] : ["ambiguous_answer"] }, identifier_status: "matched" }, duplicate_siblings: [] });
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
    detailRequests,
    allowReviewRead: () => { failReview = false; },
    configurationResolved: () => { missingConfiguration = undefined; },
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
  test(`@assignment-recovery ${width}px 최신 목록 밖 완료 답안도 다른 학생으로 바뀌지 않는다`, async ({ page }) => {
    const calls = await installSubmissionApi(page, { recovery: true, targetOutsideRecent: true });
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/results/submissions?filter=done`, { timeout: 60_000 });
    await page.getByTestId("submission-review-501").click();
    const review = page.getByRole("dialog", { name: "OMR 검토", exact: true });
    if (width === 390) await review.getByRole("tab", { name: "확인", exact: true }).click();
    await expect(review.getByPlaceholder("답안 입력")).toHaveValue("빛");
    await review.getByPlaceholder("답안 입력").fill("굴절");
    await page.clock.install();
    await review.getByRole("button", { name: "저장 + 재채점", exact: true }).click();
    await expect.poll(() => calls.assignmentBodies.length).toBe(1);
    await expect(review.getByRole("button", { name: "변경 사항 없음", exact: true })).toBeDisabled();
    await page.clock.runFor(350);
    await expect(review.getByPlaceholder("답안 입력")).toHaveValue("굴절");
    expect(calls.detailRequests.every(request => request.endsWith("/501/manual-edit/"))).toBe(true);
    expect(calls.assignmentBodies[0].answers).toEqual([{ exam_question_id: 1001, answer: "굴절" }]);
  });
}

test("@assignment-recovery 정확한 답안 상세 실패는 다른 학생을 열지 않고 재시도로 복구한다", async ({ page }) => {
  const calls = await installSubmissionApi(page, { recovery: true, targetOutsideRecent: true, failReview: true });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions?filter=done`, { timeout: 60_000 });
  await page.getByTestId("submission-review-501").click();
  const review = page.getByRole("dialog", { name: "OMR 검토", exact: true });
  await expect(review.getByText("답안 상세를 불러오지 못했습니다.")).toBeVisible();
  expect(calls.assignmentBodies).toEqual([]);
  expect(calls.detailRequests.every(request => request.endsWith("/501/manual-edit/"))).toBe(true);
  calls.allowReviewRead();
  await review.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(review.getByPlaceholder("답안 입력")).toHaveValue("빛");
  expect(calls.detailRequests.every(request => request.endsWith("/501/manual-edit/"))).toBe(true);
});

test("@assignment-recovery 다른 시험의 상세 응답은 편집하거나 저장하지 않는다", async ({ page }) => {
  const calls = await installSubmissionApi(page, { recovery: true, targetOutsideRecent: true, wrongReviewExam: true });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions?filter=done`, { timeout: 60_000 });
  await page.getByTestId("submission-review-501").click();
  const review = page.getByRole("dialog", { name: "OMR 검토", exact: true });
  await expect(review.getByText("답안 상세를 불러오지 못했습니다.")).toBeVisible();
  await expect(review.getByPlaceholder("답안 입력")).toHaveCount(0);
  expect(calls.assignmentBodies).toEqual([]);
  expect(calls.detailRequests.every(request => request.endsWith("/501/manual-edit/"))).toBe(true);
});

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

for (const assignmentConflict of ["matching", "mismatch"] as const) {
  test(`@assignment-recovery 정책 충돌 ${assignmentConflict} 대상의 성적 검토만 연결한다`, async ({ page }) => {
    const calls = await installSubmissionApi(page, { assignmentConflict });
    await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });
    await page.getByTestId("submission-preview-501").click();
    await page.getByRole("button", { name: "확인하고 학생 지정" }).click();
    await page.getByRole("dialog", { name: "학생 선택" }).getByText("김학생", { exact: true }).click();
    await expect.poll(() => calls.assignmentBodies.length).toBe(1);
    const recoveryLink = page.getByRole("link", { name: "기존 성적 확인·정정", exact: true });
    if (assignmentConflict === "matching") {
      await expect(recoveryLink).toHaveAttribute("href", "/workspace/lectures/31/sessions/44/exams?exam_id=77&examTab=results&enrollmentId=901");
      await expect(page.getByTestId("submission-identification-result")).toContainText("배정하지 않았습니다");
    } else {
      await expect(page.getByText("기존 성적과 충돌합니다.", { exact: true })).toBeVisible();
      await expect(recoveryLink).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "학생 선택" })).toBeVisible();
    }
    expect(calls.assignmentBodies[0].answers).toEqual([]);
  });
}

for (const missingConfiguration of ["answer_key", "sheet", "grading_configuration"] as const) {
test(`@assignment-recovery ${missingConfiguration} 설정 대기는 reload 후에도 같은 시험에서 복구한다`, async ({ page }) => {
  const calls = await installSubmissionApi(page, { missingConfiguration });
  await page.setViewportSize({ width: missingConfiguration === "sheet" ? 1366 : 390, height: 900 });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });
  await page.getByTestId("submission-preview-501").click();
  await page.getByRole("button", { name: "확인하고 학생 지정" }).click();
  await page.getByRole("dialog", { name: "학생 선택" }).getByText("김학생", { exact: true }).click();
  const notice = page.getByTestId("submission-identification-result");
  await expect(notice).toContainText("학생 지정은 저장됐습니다");
  await expect(notice).toContainText("문항·정답 설정을 확인해야 하므로 채점이 대기 중");
  await expect(notice.getByRole("link", { name: "문항·정답 설정" })).toHaveAttribute("href", "/workspace/lectures/31/sessions/44/exams?exam_id=77&examTab=setup");
  expect(calls.assignmentBodies[0].answers).toEqual([]);
  await page.reload();
  const row = page.getByTestId("submission-inbox-501");
  await expect(row).toContainText("김학생");
  await expect(row.getByTestId("submission-readiness-501")).toContainText("문항·정답 설정을 확인해야 하므로 채점이 대기 중");
  await expect(row.getByTestId("submission-setup-501")).toHaveAttribute("href", "/workspace/lectures/31/sessions/44/exams?exam_id=77&examTab=setup");
  await expect(row.getByRole("button", { name: "결과 보기" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(calls.assignmentBodies).toHaveLength(1);
  // Fresh server readiness removes the warning; no locally persisted stale notice.
  calls.configurationResolved();
  await page.reload();
  await expect(row.getByTestId("submission-readiness-501")).toHaveCount(0);
  await expect(row.getByTestId("submission-setup-501")).toHaveCount(0);
  await expect(row.getByRole("button", { name: "결과 보기" })).toBeVisible();
  expect(calls.assignmentBodies).toHaveLength(1);
});
}

for (const recoveryContext of ["foreign", "unresolved"] as const) {
  test(`@assignment-recovery ${recoveryContext} 시험 설정 복구 링크를 만들지 않는다`, async ({ page }) => {
    const calls = await installSubmissionApi(page, {
      missingConfiguration: "answer_key", recoveryExamId: recoveryContext === "foreign" ? 78 : 77,
      unresolvedTarget: recoveryContext === "unresolved",
    });
    await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });
    await expect(page.getByTestId("submission-inbox-501")).toBeVisible();
    await expect(page.getByRole("link", { name: "문항·정답 설정" })).toHaveCount(0);
    expect(calls.assignmentBodies).toHaveLength(0);
  });
}

for (const matching of [true, false]) {
  test(`@assignment-recovery 기존 성적 설정 충돌은 변경을 저장하지 않고 일치=${matching} 시험만 연결한다`, async ({ page }) => {
    const calls = await installSubmissionApi(page, { configurationConflict: true, recoveryExamId: matching ? 77 : 78 });
    await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });
    await page.getByTestId("submission-preview-501").click();
    await page.getByRole("button", { name: "확인하고 학생 지정" }).click();
    await page.getByRole("dialog", { name: "학생 선택" }).getByText("김학생", { exact: true }).click();
    await expect.poll(() => calls.assignmentBodies.length).toBe(1);
    if (matching) {
      const notice = page.getByTestId("submission-identification-result");
      await expect(notice).toContainText("이번 변경은 저장되지 않았으며 기존 답안과 성적은 유지됩니다");
      await expect(notice.getByRole("link", { name: "문항·정답 설정" })).toHaveAttribute("href", "/workspace/lectures/31/sessions/44/exams?exam_id=77&examTab=setup");
      await page.reload();
      await expect(page.getByTestId("submission-inbox-501")).toContainText("미식별 학생");
    } else {
      await expect(page.getByRole("dialog", { name: "학생 선택" })).toBeVisible();
      await expect(page.getByRole("link", { name: "문항·정답 설정" })).toHaveCount(0);
    }
    expect(calls.assignmentBodies).toHaveLength(1);
    expect(calls.assignmentBodies[0].answers).toEqual([]);
  });
}

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
