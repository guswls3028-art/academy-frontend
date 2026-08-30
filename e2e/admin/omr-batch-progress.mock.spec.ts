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

function localJwt(userId = 12, tenantCode = "hakwonplus"): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: tenantCode,
    user_id: userId,
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
          duplicate: 0,
          processing: 0,
          completed: admissionFailure ? 19 : 20,
          needs_identification: 1,
          failed: admissionFailure ? 2 : 1,
          superseded: 0,
        }
      : {
          pending_admission: 1,
          received: 1,
          duplicate: 0,
          processing: 20,
          completed: 0,
          needs_identification: 0,
          failed: 0,
          superseded: 0,
        },
    pending_admission_ordinals: terminal ? [] : [1],
    failed_ordinals: terminal ? [22] : [],
    admission_failed_ordinals: admissionFailure ? [21] : [],
    duplicate_ordinals: [],
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
      duplicate: 0,
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
      duplicate: 0,
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
    holdListResponse?: boolean;
    listDelayMs?: number;
    uploadFlow?: boolean;
    holdUploadResponse?: boolean;
    failFirstUploadAfterPartialAdmission?: boolean;
    admissionFailure?: boolean;
    resumeOrdinals?: number[];
    detailExamId?: number;
    failDetail?: boolean;
    holdRetryResponse?: boolean;
    holdCompletionClaim?: boolean;
  } = {},
) {
  const scoresFlow = options.uploadFlow
    || options.admissionFailure
    || options.resumeOrdinals !== undefined
    || options.detailExamId !== undefined
    || options.failDetail;
  let terminal = false;
  let claimed = false;
  let listGets = 0;
  let listResponses = 0;
  let detailGets = 0;
  let completionClaims = 0;
  let completionClaimResponses = 0;
  let listFailureForced = options.holdListFailure ?? false;
  let hideBatches = false;
  let initializedUploads = false;
  let initializePosts = 0;
  let uploadPosts = 0;
  let uploadResponses = 0;
  const uploadBodies: string[] = [];
  let partialUpload = false;
  const retryBodies: number[][] = [];
  let retryResponses = 0;
  let releaseRetryResponse: (() => void) | null = null;
  const retryResponseGate = new Promise<void>((resolve) => {
    releaseRetryResponse = resolve;
  });
  let releaseCompletionClaim: (() => void) | null = null;
  const completionClaimGate = new Promise<void>((resolve) => {
    releaseCompletionClaim = resolve;
  });
  let releaseListResponse: (() => void) | null = null;
  const listResponseGate = new Promise<void>((resolve) => {
    releaseListResponse = resolve;
  });
  let releaseUploadResponse: (() => void) | null = null;
  const uploadResponseGate = new Promise<void>((resolve) => {
    releaseUploadResponse = resolve;
  });

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
      initializePosts += 1;
      await safeJson(route, admissionSummary("pending"), 201);
      return;
    }
    if (
      (options.uploadFlow || options.resumeOrdinals !== undefined)
      && path === `/submissions/submissions/exams/${EXAM_ID}/omr/batch/`
      && request.method() === "POST"
    ) {
      uploadPosts += 1;
      const uploadBody = request.postDataBuffer()?.toString("latin1") ?? "";
      uploadBodies.push(uploadBody);
      if (options.failFirstUploadAfterPartialAdmission && uploadPosts === 1) {
        partialUpload = true;
        await safeJson(route, { detail: "synthetic admission response timeout" }, 504);
        return;
      }
      partialUpload = false;
      const createdCount = uploadBody.match(/name="files"/g)?.length ?? 0;
      if (options.holdUploadResponse && uploadPosts === 1) await uploadResponseGate;
      await safeJson(route, {
        ...admissionSummary("received"),
        created_count: createdCount,
        submission_ids: Array.from({ length: createdCount }, (_, index) => 2001 + index),
      }, 201);
      uploadResponses += 1;
      return;
    }
    if (path === "/submissions/submissions/omr/batches/" && request.method() === "GET") {
      listGets += 1;
      if (
        listGets <= (options.failListCalls ?? 0)
        || listFailureForced
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
      const response = options.empty || hideBatches ? [] : [batch];
      if (options.holdListResponse && listGets === 1) await listResponseGate;
      await safeJson(route, response);
      listResponses += 1;
      return;
    }
    if (
      path === `/submissions/submissions/omr/batches/${BATCH_ID}/`
      && request.method() === "GET"
    ) {
      detailGets += 1;
      if (options.failDetail) {
        await safeJson(route, { detail: "synthetic detail failure" }, 503);
        return;
      }
      const batch = options.resumeOrdinals !== undefined
        ? {
            ...batchSummary({ terminal, claimed }),
            exam_id: options.detailExamId ?? EXAM_ID,
            pending_admission_ordinals: options.resumeOrdinals,
            admission_failed_ordinals: [],
          }
        : options.uploadFlow
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
      if (options.holdRetryResponse) await retryResponseGate;
      await safeJson(route, {
        ...batchSummary({ terminal: true, claimed, admissionFailure: true }),
        retried_ordinals: [22],
        requires_file_ordinals: [21],
        skipped_ordinals: [],
      });
      retryResponses += 1;
      return;
    }
    if (
      path === `/submissions/submissions/omr/batches/${BATCH_ID}/claim-completion/`
      && request.method() === "POST"
    ) {
      completionClaims += 1;
      if (options.holdCompletionClaim) await completionClaimGate;
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
      completionClaimResponses += 1;
      return;
    }
    if (path === "/media/videos/" && request.method() === "GET") {
      await safeJson(route, { count: 0, results: [] });
      return;
    }
    if (scoresFlow && path === `/lectures/lectures/${LECTURE_ID}/`) {
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
    if (scoresFlow && path === `/lectures/sessions/${SESSION_ID}/`) {
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
    if (scoresFlow && path === `/results/admin/sessions/${SESSION_ID}/scores/`) {
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
    counts: () => ({
      listGets,
      listResponses,
      detailGets,
      completionClaims,
      completionClaimResponses,
    }),
    finish: () => { terminal = true; },
    releaseListFailure: () => { listFailureForced = false; },
    releaseListResponse: () => { releaseListResponse?.(); },
    setListFailure: (shouldFail: boolean) => { listFailureForced = shouldFail; },
    hideBatches: () => { hideBatches = true; },
    releaseCompletionClaim: () => { releaseCompletionClaim?.(); },
    releaseRetryResponse: () => { releaseRetryResponse?.(); },
    releaseUploadResponse: () => { releaseUploadResponse?.(); },
    uploadState: () => ({
      initializePosts,
      uploadPosts,
      uploadResponses,
      uploadBodies: [...uploadBodies],
    }),
    retryBodies: () => [...retryBodies],
    retryResponses: () => retryResponses,
  };
}

function multipartFieldValues(body: string, field: string): string[] {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...body.matchAll(new RegExp(`name="${escaped}"\\r\\n\\r\\n([^\\r\\n]+)`, "g"))]
    .map((match) => match[1]);
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

async function openResumeOmrUpload(page: Page) {
  await page.goto(
    `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores?omrRetryBatchId=${BATCH_ID}&omrRetryExamId=${EXAM_ID}`,
    { waitUntil: "domcontentloaded" },
  );
  const dialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return dialog;
}

async function clearAndSwitchSessionInPlace(
  page: Page,
  options: { userId: number; tenantCode: string },
) {
  await page.evaluate(async ({ jwt, tenantCode }) => {
    const storeModule = await import("/src/shared/ui/asyncStatus/asyncStatusStore.ts");
    const trackedWindow = window as typeof window & {
      __omrSessionTaskEmissions?: string[][];
    };
    trackedWindow.__omrSessionTaskEmissions = [];
    storeModule.asyncStatusStore.subscribe((tasks) => {
      trackedWindow.__omrSessionTaskEmissions?.push(tasks.map((task) => task.id));
    });
    storeModule.asyncStatusStore.clearAll();
    sessionStorage.setItem("tenantCode", tenantCode);
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, {
    jwt: localJwt(options.userId, options.tenantCode),
    tenantCode: options.tenantCode,
  });
}

async function settleBrowserFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function emittedOmrTaskAfterSessionSwitch(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const trackedWindow = window as typeof window & {
      __omrSessionTaskEmissions?: string[][];
    };
    return (trackedWindow.__omrSessionTaskEmissions ?? [])
      .some((ids) => ids.some((id) => id.startsWith("omr-batch:")));
  });
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
    await expect(panel.getByText("작업박스가 비어 있습니다")).toHaveCount(0);

    api.releaseListFailure();
    await panel.getByRole("button", { name: "새로고침" }).click();
    await expect(panel.getByText("작업박스가 비어 있습니다")).toBeVisible();
    await expect(panel.getByRole("alert")).toHaveCount(0);
  });

  test("수동 새로고침 실패를 성공으로 알리지 않고 다음 성공만 표시한다", async ({ page }) => {
    const api = await installDashboardApi(page, {
      empty: true,
      listDelayMs: 500,
    });
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });

    const panel = await openWorkboxPanel(page);
    const refresh = panel.getByRole("button", { name: "새로고침" });
    const successToast = page.getByText("작업박스를 새로고침했습니다.");
    await expect(panel.getByText("작업박스가 비어 있습니다")).toBeVisible();
    await expect(successToast).toHaveCount(0);

    api.setListFailure(true);
    await refresh.click();
    await expect(refresh).toBeDisabled();
    await expect(refresh).toBeEnabled();
    await expect(panel.getByRole("alert")).toContainText("불러오지 못했습니다");
    const successShownDuringFailure = await page.evaluate((text) => new Promise<boolean>((resolve) => {
      const hasText = () => document.body.textContent?.includes(text) ?? false;
      if (hasText()) {
        resolve(true);
        return;
      }
      const observer = new MutationObserver(() => {
        if (!hasText()) return;
        observer.disconnect();
        resolve(true);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      window.setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, 1_000);
    }), "작업박스를 새로고침했습니다.");
    expect(successShownDuringFailure).toBe(false);

    api.setListFailure(false);
    await refresh.click();
    await expect(panel.getByText("작업박스가 비어 있습니다")).toBeVisible();
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(successToast).toBeVisible();
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

  test("등록 전 파일을 이동·회전·삭제한 순서와 이미지로 접수한다", async ({ page }) => {
    const api = await installDashboardApi(page, { uploadFlow: true });
    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await openOmrUpload(page);
    const dialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await dialog.locator('input[type="file"]').setInputFiles([
      { name: "first.png", mimeType: "image/png", buffer: png },
      { name: "second.png", mimeType: "image/png", buffer: png },
      { name: "remove.png", mimeType: "image/png", buffer: png },
    ]);

    const first = dialog.locator(".admin-omr-upload__file").filter({ hasText: "first.png" });
    await first.getByRole("button", { name: "아래로 이동" }).click();
    await first.getByRole("button", { name: "오른쪽 회전" }).click();
    await expect(first.getByText("업로드 회전 90°", { exact: true })).toBeVisible();
    await dialog.locator(".admin-omr-upload__file").filter({ hasText: "remove.png" })
      .getByRole("button", { name: "삭제" }).click();
    await dialog.getByRole("button", { name: "등록 시작" }).click();

    await expect.poll(() => api.uploadState().uploadPosts).toBe(1);
    const body = api.uploadState().uploadBodies[0];
    expect(body.match(/name="files"/g)).toHaveLength(2);
    expect(body).not.toContain("remove.png");
    expect(body.indexOf("second.png")).toBeLessThan(body.indexOf("first.png"));
    expect(multipartFieldValues(body, "item_ordinals")).toEqual(["1", "2"]);
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

  test("재선택 파일을 삭제 후 추가해도 서버 ordinal 슬롯은 중복되지 않는다", async ({ page }) => {
    const api = await installDashboardApi(page, { resumeOrdinals: [21, 22] });
    const dialog = await openResumeOmrUpload(page);
    const input = dialog.locator('input[type="file"]');
    await expect(input).toBeEnabled();
    await input.setInputFiles([
      { name: "resume-21.jpg", mimeType: "image/jpeg", buffer: Buffer.from("resume-21") },
      { name: "resume-22.jpg", mimeType: "image/jpeg", buffer: Buffer.from("resume-22") },
    ]);
    await dialog.locator(".admin-omr-upload__file").filter({ hasText: "resume-21.jpg" })
      .getByRole("button", { name: "삭제" }).click();
    await input.setInputFiles({
      name: "resume-21-reselected.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("resume-21-reselected"),
    });
    await dialog.getByRole("button", { name: "미접수 파일 다시 접수" }).click();

    await expect.poll(() => api.uploadState().uploadPosts).toBe(1);
    const ordinals = multipartFieldValues(api.uploadState().uploadBodies[0], "item_ordinals");
    expect(ordinals).toEqual(["22", "21"]);
    expect(new Set(ordinals).size).toBe(ordinals.length);
    expect(ordinals.every((value) => Number.isFinite(Number(value)))).toBe(true);
  });

  test("완료한 일반 선택을 비운 뒤 새 선택은 새 batch와 유효 ordinal로 시작한다", async ({ page }) => {
    const api = await installDashboardApi(page, { uploadFlow: true });
    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await openOmrUpload(page);
    const dialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
    const input = dialog.locator('input[type="file"]');
    await input.setInputFiles({
      name: "first-batch.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("first-batch"),
    });
    await dialog.getByRole("button", { name: "등록 시작" }).click();
    await expect(dialog.getByText("1건을 접수했습니다", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "비우기" }).click();
    await input.setInputFiles({
      name: "second-batch.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("second-batch"),
    });
    await dialog.getByRole("button", { name: "등록 시작" }).click();

    await expect.poll(() => api.uploadState().uploadPosts).toBe(2);
    const uploadState = api.uploadState();
    expect(uploadState.initializePosts).toBe(2);
    expect(multipartFieldValues(uploadState.uploadBodies[1], "item_ordinals")).toEqual(["1"]);
    expect(uploadState.uploadBodies[1]).not.toContain("NaN");
  });

  for (const scenario of [
    { name: "detail GET 실패", options: { failDetail: true } },
    { name: "시험 불일치", options: { resumeOrdinals: [21], detailExamId: EXAM_ID + 1 } },
    { name: "재선택 ordinal 없음", options: { resumeOrdinals: [] } },
  ] as const) {
    test(`query batch가 ${scenario.name}이면 업로드를 fail-closed한다`, async ({ page }) => {
      await installDashboardApi(page, scenario.options);
      const dialog = await openResumeOmrUpload(page);
      await expect(dialog.locator('input[type="file"]')).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "등록 시작" })).toBeDisabled();
    });
  }

  test("지연된 목록 hydration은 logout 뒤 다른 tenant 작업을 복원하지 않는다", async ({ page }) => {
    const api = await installDashboardApi(page, { holdListResponse: true });
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });
    const panel = await openWorkboxPanel(page);
    await expect.poll(() => api.counts().listGets).toBe(1);

    await clearAndSwitchSessionInPlace(page, { userId: 98, tenantCode: "tenant-two" });
    const detailGetsBeforeRelease = api.counts().detailGets;

    api.releaseListResponse();
    await expect.poll(() => api.counts().listResponses).toBe(1);
    await settleBrowserFrames(page);
    expect(await emittedOmrTaskAfterSessionSwitch(page)).toBe(false);
    await expect(
      panel.locator(".async-status-bar__item").filter({ hasText: "OMR 22장" }),
    ).toHaveCount(0);
    expect(api.counts().detailGets).toBe(detailGetsBeforeRelease);
    await expect(page.getByText("OMR 처리가 끝났습니다.", { exact: false })).toHaveCount(0);
  });

  test("지연된 upload 응답은 logout 뒤 새 계정 작업을 복원하지 않는다", async ({ page }) => {
    const api = await installDashboardApi(page, {
      uploadFlow: true,
      holdUploadResponse: true,
    });
    await page.goto(
      `${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/scores`,
      { waitUntil: "domcontentloaded" },
    );
    await openOmrUpload(page);
    const dialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "held-upload.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("held-upload"),
    });
    await dialog.getByRole("button", { name: "등록 시작" }).click();
    await expect.poll(() => api.uploadState().uploadPosts).toBe(1);
    expect(api.uploadState().uploadResponses).toBe(0);

    await clearAndSwitchSessionInPlace(page, { userId: 97, tenantCode: "hakwonplus" });
    api.hideBatches();
    const detailGetsBeforeRelease = api.counts().detailGets;

    api.releaseUploadResponse();
    await expect.poll(() => api.uploadState().uploadResponses).toBe(1);
    await settleBrowserFrames(page);
    expect(await emittedOmrTaskAfterSessionSwitch(page)).toBe(false);
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    const panel = await openWorkboxPanel(page);
    await expect(
      panel.locator(".async-status-bar__item").filter({ hasText: "OMR 22장" }),
    ).toHaveCount(0);
    expect(api.counts().detailGets).toBe(detailGetsBeforeRelease);
    await expect(page.getByText("OMR 처리가 끝났습니다.", { exact: false })).toHaveCount(0);
  });

  test("지연된 retry 응답은 logout 뒤 새 계정 작업을 복원하지 않는다", async ({ page }) => {
    const api = await installDashboardApi(page, {
      admissionFailure: true,
      holdRetryResponse: true,
    });
    api.finish();
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });
    const task = await openWorkbox(page);
    await task.getByRole("button", { name: "재처리 요청" }).click();
    await expect.poll(() => api.retryBodies().length).toBe(1);
    expect(api.retryResponses()).toBe(0);

    await clearAndSwitchSessionInPlace(page, { userId: 96, tenantCode: "hakwonplus" });
    api.hideBatches();
    const detailGetsBeforeRelease = api.counts().detailGets;

    api.releaseRetryResponse();
    await expect.poll(() => api.retryResponses()).toBe(1);
    await settleBrowserFrames(page);
    expect(await emittedOmrTaskAfterSessionSwitch(page)).toBe(false);
    await expect(
      page.locator(".async-status-bar__item").filter({ hasText: "OMR 22장" }),
    ).toHaveCount(0);
    expect(api.counts().detailGets).toBe(detailGetsBeforeRelease);
    await expect(page.getByText("개 항목의 재처리를 시작했습니다.", { exact: false })).toHaveCount(0);
  });

  test("완료 claim 대기 중 logout clear는 이전 작업과 toast를 복원하지 않는다", async ({ page }) => {
    const api = await installDashboardApi(page, { holdCompletionClaim: true });
    api.finish();
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });
    await openWorkbox(page);
    await expect.poll(() => api.counts().completionClaims).toBe(1);
    const authGeneration = await page.evaluate(() => (
      localStorage.getItem("academy:auth-active-generation:v1")
    ));
    expect(authGeneration).toBeTruthy();

    const profileButton = page.locator(".app-header button")
      .filter({ hasText: /admin|사용자|원장|선생|관리자/i }).last();
    await profileButton.click();
    await page.getByRole("menuitem", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/\/login(?:\/hakwonplus)?/, { timeout: 15_000 });
    await page.evaluate(({ generation, jwt }) => {
      if (!generation) return;
      sessionStorage.setItem("tenantCode", "hakwonplus");
      localStorage.setItem(
        `academy:auth-tokens:v1:${generation}`,
        JSON.stringify({ access: jwt, refresh: `${jwt}-refresh`, generation }),
      );
    }, { generation: authGeneration, jwt: localJwt(99) });

    api.hideBatches();
    api.releaseCompletionClaim();
    await expect.poll(() => api.counts().completionClaimResponses).toBe(1);

    await page.route("**/api/v1/core/me/", async (route) => {
      await safeJson(route, {
        id: 99,
        username: "t1_admin99",
        name: "새 관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    });
    const meResponse = page.waitForResponse((response) => (
      new URL(response.url()).pathname.endsWith("/api/v1/core/me/")
      && response.request().method() === "GET"
    ));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await meResponse;
    await page.evaluate(() => {
      history.pushState({}, "", "/workspace/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const panel = await openWorkboxPanel(page);
    await expect(panel.locator(".async-status-bar__item").filter({ hasText: "OMR 22장" })).toHaveCount(0);
    await expect(page.getByText("OMR 처리가 끝났습니다. 실패 항목을 확인해 주세요.")).toHaveCount(0);
  });

  test("390px 작업박스에서 상태와 CTA가 가로로 잘리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installDashboardApi(page);
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });
    const task = await openWorkbox(page);

    const anchoredStatusBar = page.locator(".async-status-bar--anchor");
    await expect(
      anchoredStatusBar.locator(".async-status-bar__trigger, .async-status-bar__panel"),
    ).toHaveCount(0);
    await expect(
      page.locator(".async-status-bar__item").filter({ hasText: "OMR 22장" }),
    ).toHaveCount(1);

    await expect(task.getByRole("button", { name: "OMR 검토" })).toBeVisible();
    expect(await task.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(1);
  });
});
