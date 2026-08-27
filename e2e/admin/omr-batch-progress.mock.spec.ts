import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const BATCH_ID = "12345678-1234-4234-8234-123456789abc";
const LECTURE_ID = 501;
const SESSION_ID = 701;
const EXAM_ID = 801;

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function safeJson(route: Route, body: unknown, status = 200): Promise<void> {
  try {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  } catch {
    // Navigation can abort an obsolete mocked request.
  }
}

function batchSummary(options: {
  terminal?: boolean;
  claimed?: boolean;
  admissionFailure?: boolean;
} = {}) {
  const terminal = options.terminal ?? false;
  const admissionFailure = terminal && (options.admissionFailure ?? false);
  return {
    id: BATCH_ID,
    exam_id: EXAM_ID,
    session_id: SESSION_ID,
    lecture_id: LECTURE_ID,
    total_count: 22,
    counts: terminal
      ? {
          pending_admission: 0,
          received: 0,
          processing: 0,
          completed: admissionFailure ? 19 : 20,
          needs_identification: 1,
          failed: admissionFailure ? 2 : 1,
          superseded: 0,
        }
      : {
          pending_admission: 1,
          received: 1,
          processing: 20,
          completed: 0,
          needs_identification: 0,
          failed: 0,
          superseded: 0,
        },
    pending_admission_ordinals: terminal ? [] : [1],
    failed_ordinals: terminal ? [22] : [],
    admission_failed_ordinals: admissionFailure ? [21] : [],
    terminal,
    overall_status: terminal ? "failed" : "receiving",
    completion_notice_claimed: options.claimed ?? false,
    created_at: "2026-08-27T01:00:00Z",
    updated_at: "2026-08-27T01:00:00Z",
  };
}

function admissionSummary(state: "pending" | "received") {
  const pending = state === "pending";
  return {
    ...batchSummary(),
    counts: {
      pending_admission: pending ? 22 : 0,
      received: pending ? 0 : 22,
      processing: 0,
      completed: 0,
      needs_identification: 0,
      failed: 0,
      superseded: 0,
    },
    pending_admission_ordinals: pending ? Array.from({ length: 22 }, (_, index) => index + 1) : [],
  };
}

function partialAdmissionSummary() {
  return {
    ...admissionSummary("received"),
    counts: {
      pending_admission: 1,
      received: 21,
      processing: 0,
      completed: 0,
      needs_identification: 0,
      failed: 0,
      superseded: 0,
    },
    pending_admission_ordinals: [22],
  };
}

async function installDashboardApi(
  page: Page,
  options: {
    empty?: boolean;
    failListCalls?: number;
    holdListFailure?: boolean;
    listDelayMs?: number;
    uploadFlow?: boolean;
    failFirstUploadAfterPartialAdmission?: boolean;
    admissionFailure?: boolean;
  } = {},
) {
  let terminal = false;
  let claimed = false;
  let listGets = 0;
  let detailGets = 0;
  let completionClaims = 0;
  let listFailureReleased = false;
  let initializedUploads = false;
  let uploadPosts = 0;
  const uploadBodies: string[] = [];
  let partialUpload = false;
  const retryBodies: number[][] = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (
      options.uploadFlow
      && path === `/submissions/submissions/exams/${EXAM_ID}/omr/batches/`
      && request.method() === "POST"
    ) {
      initializedUploads = true;
      await safeJson(route, admissionSummary("pending"), 201);
      return;
    }
    if (
      options.uploadFlow
      && path === `/submissions/submissions/exams/${EXAM_ID}/omr/batch/`
      && request.method() === "POST"
    ) {
      uploadPosts += 1;
      uploadBodies.push(request.postDataBuffer()?.toString("latin1") ?? "");
      if (options.failFirstUploadAfterPartialAdmission && uploadPosts === 1) {
        partialUpload = true;
        await safeJson(route, { detail: "synthetic admission response timeout" }, 504);
        return;
      }
      partialUpload = false;
      await safeJson(route, {
        ...admissionSummary("received"),
        created_count: uploadPosts === 1 ? 22 : 1,
        submission_ids: uploadPosts === 1
          ? Array.from({ length: 22 }, (_, index) => 2001 + index)
          : [2022],
      }, 201);
      return;
    }
    if (path === "/submissions/submissions/omr/batches/" && request.method() === "GET") {
      listGets += 1;
      if (
        listGets <= (options.failListCalls ?? 0)
        || (options.holdListFailure && !listFailureReleased)
      ) {
        if (options.listDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.listDelayMs));
        }
        await safeJson(route, { detail: "synthetic list failure" }, 503);
        return;
      }
      const batch = options.uploadFlow && initializedUploads
        ? admissionSummary(uploadPosts > 0 ? "received" : "pending")
        : batchSummary({ terminal, claimed, admissionFailure: options.admissionFailure });
      await safeJson(route, options.empty ? [] : [batch]);
      return;
    }
    if (
      path === `/submissions/submissions/omr/batches/${BATCH_ID}/`
      && request.method() === "GET"
    ) {
      detailGets += 1;
      const batch = options.uploadFlow
        ? partialUpload
          ? partialAdmissionSummary()
          : admissionSummary(uploadPosts > 0 ? "received" : "pending")
        : batchSummary({ terminal, claimed, admissionFailure: options.admissionFailure });
      await safeJson(route, batch);
      return;
    }
    if (
      path === `/submissions/submissions/omr/batches/${BATCH_ID}/retry/`
      && request.method() === "POST"
    ) {
      const payload = request.postDataJSON() as { item_ordinals?: number[] };
      retryBodies.push(payload.item_ordinals ?? []);
      await safeJson(route, {
        ...batchSummary({ terminal: true, claimed, admissionFailure: true }),
        retried_ordinals: [22],
        requires_file_ordinals: [21],
        skipped_ordinals: [],
      });
      return;
    }
    if (
      path === `/submissions/submissions/omr/batches/${BATCH_ID}/claim-completion/`
      && request.method() === "POST"
    ) {
      completionClaims += 1;
      const notify = !claimed;
      claimed = true;
      await safeJson(route, {
        notify,
        batch: batchSummary({
          terminal: true,
          claimed: true,
          admissionFailure: options.admissionFailure,
        }),
      });
      return;
    }
    if (path === "/media/videos/" && request.method() === "GET") {
      await safeJson(route, { count: 0, results: [] });
      return;
    }
    if ((options.uploadFlow || options.admissionFailure) && path === `/lectures/lectures/${LECTURE_ID}/`) {
      await safeJson(route, {
        id: LECTURE_ID,
        title: "공통수학2 정규반",
        name: "공통수학2 정규반",
        subject: "MATH",
        color: "#2563eb",
        chip_label: "수2",
        is_active: true,
      });
      return;
    }
    if ((options.uploadFlow || options.admissionFailure) && path === `/lectures/sessions/${SESSION_ID}/`) {
      await safeJson(route, {
        id: SESSION_ID,
        lecture: LECTURE_ID,
        order: 1,
        regular_order: 1,
        title: "1차시",
        display_label: "1차시",
        date: "2026-08-27",
        lecture_title: "공통수학2 정규반",
        lecture_color: "#2563eb",
        lecture_chip_label: "수2",
      });
      return;
    }
    if ((options.uploadFlow || options.admissionFailure) && path === `/results/admin/sessions/${SESSION_ID}/scores/`) {
      await safeJson(route, {
        meta: {
          session_title: "1차시",
          lecture_title: "공통수학2 정규반",
          lecture_id: LECTURE_ID,
          exams: [{
            exam_id: EXAM_ID,
            title: "7월 진단평가",
            pass_score: 60,
            max_score: 100,
            grading_mode: "choice",
            manual_grading_method: "correctness",
            choice_count: 22,
            essay_count: 0,
            display_order: 0,
          }],
          homeworks: [],
        },
        rows: [],
      });
      return;
    }
    await safeJson(route, { count: 0, results: [] });
  });
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("workspace:preferFull:hakwonplus", "1");
  }, localJwt());

  return {
    counts: () => ({ listGets, detailGets, completionClaims }),
    finish: () => { terminal = true; },
    releaseListFailure: () => { listFailureReleased = true; },
    uploadState: () => ({ uploadPosts, uploadBodies: [...uploadBodies] }),
    retryBodies: () => [...retryBodies],
  };
}

async function openWorkboxPanel(page: Page) {
  const statusBar = page.locator(".async-status-bar");
  await expect(statusBar).toHaveCount(1, { timeout: 30_000 });
  const localPanel = statusBar.locator(".async-status-bar__panel");
  const localTrigger = statusBar.locator(".async-status-bar__trigger");
  if (await localPanel.count()) {
    if (!(await localPanel.isVisible())) {
      await localTrigger.click().catch(() => undefined);
    }
    await expect(localPanel).toBeVisible();
    return localPanel;
  }

  const headerTrigger = page.getByRole("button", { name: /^작업박스/ });
  await expect(headerTrigger).toBeVisible();
  await headerTrigger.click();
  const headerPanel = page.locator(".alarm-panel--workbox-style");
  await expect(headerPanel).toBeVisible();
  return headerPanel;
}

async function openWorkbox(page: Page) {
  const panel = await openWorkboxPanel(page);
  const task = panel.locator(".async-status-bar__item").filter({ hasText: "OMR 22장" });
  await expect(task).toBeVisible();
  return task;
}

async function openOmrUpload(page: Page) {
  const trigger = page.getByRole("button", { name: "OMR 스캔 등록" });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();
}

test.describe("OMR durable batch progress", () => {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "OMR durable progress route-mock is local-only",
  );

  test.use({
    viewport: { width: 1366, height: 900 },
    serviceWorkers: "block",
  });

  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(30_000);
  });

  test("GET 복구는 읽기 전용이고 terminal 최초 관찰만 1회 claim한다", async ({ page }) => {
    const api = await installDashboardApi(page);
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });

    let task = await openWorkbox(page);
    await expect(task).toContainText("접수 대기 1");
    await expect(task).toContainText("접수 완료 1");
    await expect(task).toContainText("처리 중 20");
    expect(api.counts().listGets).toBeGreaterThanOrEqual(1);
    expect(api.counts().detailGets).toBeGreaterThanOrEqual(1);
    expect(api.counts().completionClaims).toBe(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    task = await openWorkbox(page);
    await expect(task).toContainText("처리 중 20");
    expect(api.counts().completionClaims).toBe(0);

    api.finish();
    await page.reload({ waitUntil: "domcontentloaded" });
    task = await openWorkbox(page);
    await expect(task).toContainText("완료 20");
    await expect(task).toContainText("식별 필요 1");
    await expect(task).toContainText("실패 1");
    await expect.poll(() => api.counts().completionClaims).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    task = await openWorkbox(page);
    await expect(task).toContainText("완료 20");
    expect(api.counts().completionClaims).toBe(1);

    await task.getByRole("button", { name: "OMR 검토" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/workspace/mobile/exams/${EXAM_ID}/omr`),
    );
  });

  test("작업 상태 목록의 loading/error/empty를 구분하고 수동 복구한다", async ({ page }) => {
    const api = await installDashboardApi(page, {
      empty: true,
      holdListFailure: true,
      listDelayMs: 1500,
    });
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });

    const panel = await openWorkboxPanel(page);
    await expect(panel.getByRole("status")).toContainText("불러오는 중");
    await expect(panel.getByRole("alert")).toContainText("불러오지 못했습니다");

    api.releaseListFailure();
    await panel.getByRole("button", { name: "새로고침" }).click();
    await expect(panel.getByText("작업박스가 비어 있습니다")).toBeVisible();
    await expect(panel.getByRole("alert")).toHaveCount(0);
  });

  test("처리 실패와 접수 실패 ordinal만 재시도 계약으로 전달한다", async ({ page }) => {
    const api = await installDashboardApi(page, { admissionFailure: true });
    api.finish();
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });

    const task = await openWorkbox(page);
    await expect(task).toContainText("실패 2");
    await task.getByRole("button", { name: "재처리 요청" }).click();

    await expect.poll(() => api.retryBodies()).toEqual([[22, 21]]);
    await expect(page).toHaveURL(
      new RegExp(`/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores\\?omrRetryBatchId=${BATCH_ID}&omrRetryExamId=${EXAM_ID}`),
    );
  });

  test("22개 파일을 한 multipart로 접수하고 업로드를 AI 완료로 표시하지 않는다", async ({ page }) => {
    const api = await installDashboardApi(page, { uploadFlow: true });
    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );

    await openOmrUpload(page);
    const dialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles(
      Array.from({ length: 22 }, (_, index) => ({
        name: `scan-${index + 1}.jpg`,
        mimeType: "image/jpeg",
        buffer: Buffer.from(`scan-${index + 1}`),
      })),
    );
    await dialog.getByRole("button", { name: "등록 시작" }).click();
    await expect(dialog.getByText("22건을 접수했습니다", { exact: false })).toBeVisible();

    const { uploadPosts, uploadBodies } = api.uploadState();
    expect(uploadPosts).toBe(1);
    expect(uploadBodies[0].match(/name="files"/g)).toHaveLength(22);
    expect(uploadBodies[0].match(/name="item_ordinals"/g)).toHaveLength(22);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("scan-1.jpg");

    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    const task = await openWorkbox(page);
    await expect(task.getByText("접수 완료 22", { exact: true })).toBeVisible();
    await expect(task.getByText("완료 22", { exact: true })).toHaveCount(0);
  });

  test("중단된 접수 응답은 서버 ordinal을 복구해 22번만 명시 재선택한다", async ({ page }) => {
    const api = await installDashboardApi(page, {
      uploadFlow: true,
      failFirstUploadAfterPartialAdmission: true,
    });
    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );

    await openOmrUpload(page);
    const dialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
    const input = dialog.locator('input[type="file"]');
    await input.setInputFiles(
      Array.from({ length: 22 }, (_, index) => ({
        name: `partial-${index + 1}.jpg`,
        mimeType: "image/jpeg",
        buffer: Buffer.from(`partial-${index + 1}`),
      })),
    );
    await dialog.getByRole("button", { name: "등록 시작" }).click();
    await expect(dialog.getByText("서버의 접수 결과를 복구했습니다", { exact: false })).toBeVisible();
    await expect(dialog.locator(".admin-omr-upload__file")).toHaveCount(0);

    await input.setInputFiles({
      name: "partial-22-retry.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("partial-22-retry"),
    });
    await dialog.getByRole("button", { name: "미접수 파일 다시 접수" }).click();
    await expect(dialog.getByText("1건을 접수했습니다", { exact: false })).toBeVisible();

    const { uploadPosts, uploadBodies } = api.uploadState();
    expect(uploadPosts).toBe(2);
    expect(uploadBodies[1].match(/name="files"/g)).toHaveLength(1);
    expect(uploadBodies[1].match(/name="item_ordinals"/g)).toHaveLength(1);
    expect(uploadBodies[1]).toContain("22");
    expect(uploadBodies[1]).not.toContain("partial-1.jpg");
  });

  test("390px 작업박스에서 상태와 CTA가 가로로 잘리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installDashboardApi(page);
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });
    const task = await openWorkbox(page);

    await expect(task.getByRole("button", { name: "OMR 검토" })).toBeVisible();
    expect(await task.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(1);
  });
});
