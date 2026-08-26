import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const VIDEO_ID = 7412;
const POLL_INTERVAL_MS = 5_000;

type DetailStatus = "READY" | "FAILED" | "PROCESSING" | "ERROR";
type ProgressStatus = "UNKNOWN" | "PROCESSING" | "ERROR";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(new Date("2026-12-31T00:00:00Z").getTime() / 1000),
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

function videoDetail(status: Exclude<DetailStatus, "ERROR">) {
  return {
    id: VIDEO_ID,
    session_id: 31,
    title: "Redis 복구 검증 영상",
    source_type: "file",
    file_key: "tenant-1/video.mp4",
    duration: status === "READY" ? 120 : null,
    order: 1,
    status,
    error_reason: status === "FAILED" ? "인코딩 원본 손상" : null,
    allow_skip: false,
    max_speed: 1,
    show_watermark: false,
    hls_path: status === "READY" ? "tenant-1/master.m3u8" : null,
    created_at: "2026-08-22T00:00:00Z",
    updated_at: "2026-08-22T00:00:00Z",
  };
}

async function safeJson(route: Route, body: unknown, status = 200): Promise<void> {
  try {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  } catch {
    // AbortController로 폐기된 오래된 요청은 응답을 기다리던 route도 닫힌다.
  }
}

async function openWorkbox(
  page: Page,
  options: {
    detailStatus?: DetailStatus;
    progressStatus?: ProgressStatus;
    heldDetailRequests?: number[];
    heldProgressRequests?: number[];
  } = {},
) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "영상 진행률 복구 route-mock 검증은 로컬 서버 전용",
  );

  let progressStatus: ProgressStatus = options.progressStatus ?? "UNKNOWN";
  let detailStatus: DetailStatus = options.detailStatus ?? "PROCESSING";
  let progressRequests = 0;
  let detailRequests = 0;
  let detailRequestedBeforeThreshold = false;
  const heldProgressRequests = new Set(options.heldProgressRequests ?? []);
  const heldDetailRequests = new Set(options.heldDetailRequests ?? []);
  const progressReleases = new Map<number, () => void>();
  const detailReleases = new Map<number, () => void>();

  await page.clock.install({ time: new Date("2026-08-22T12:00:00Z") });
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === "/media/videos/" && request.method() === "GET") {
      const status = url.searchParams.get("status");
      await safeJson(route, {
        count: status === "PROCESSING" ? 1 : 0,
        results: status === "PROCESSING" ? [videoDetail("PROCESSING")] : [],
      });
      return;
    }
    if (path === `/media/videos/${VIDEO_ID}/progress/`) {
      progressRequests += 1;
      const requestNumber = progressRequests;
      const responseStatus = progressStatus;
      if (heldProgressRequests.has(requestNumber)) {
        await new Promise<void>((resolve) => progressReleases.set(requestNumber, resolve));
      }
      if (responseStatus === "ERROR") {
        await safeJson(route, { detail: "progress cache unavailable" }, 503);
      } else if (responseStatus === "PROCESSING") {
        await safeJson(route, {
          id: VIDEO_ID,
          status: "PROCESSING",
          encoding_progress: 41,
        });
      } else {
        await safeJson(route, { id: VIDEO_ID, state: "UNKNOWN", status: "UNKNOWN" });
      }
      return;
    }
    if (path === `/media/videos/${VIDEO_ID}/` && request.method() === "GET") {
      detailRequests += 1;
      const requestNumber = detailRequests;
      const responseStatus = detailStatus;
      if (progressRequests < 3) detailRequestedBeforeThreshold = true;
      if (heldDetailRequests.has(requestNumber)) {
        await new Promise<void>((resolve) => detailReleases.set(requestNumber, resolve));
      }
      if (responseStatus === "ERROR") {
        await safeJson(route, { detail: "video detail unavailable" }, 503);
      } else {
        await safeJson(route, videoDetail(responseStatus));
      }
      return;
    }
    if (path === `/media/videos/${VIDEO_ID}/` && request.method() === "DELETE") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === "/staffs/me/") {
      await safeJson(route, { id: 12, is_payroll_manager: true });
      return;
    }
    if (path === "/staffs/currently-working/") {
      await safeJson(route, []);
      return;
    }
    if (path === "/lectures/attendance/arrival-overview/") {
      await safeJson(route, {
        today: "2026-08-22",
        range_end: "2026-08-28",
        range_days: 7,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
        items: [],
      });
      return;
    }
    if (path.includes("pending-count") || path.includes("unread-count")) {
      await safeJson(route, { count: 0 });
      return;
    }
    await safeJson(route, { count: 0, results: [] });
  });

  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());

  await page.goto(`${BASE}/workspace/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.getByRole("button", { name: /^작업박스/ }).click();
  const task = page.locator(".async-status-bar__item").filter({
    hasText: "Redis 복구 검증 영상",
  });
  await expect(task).toBeVisible();
  await expect.poll(() => progressRequests).toBeGreaterThanOrEqual(1);

  return {
    advance: (milliseconds: number) => page.clock.runFor(milliseconds),
    counts: () => ({ progressRequests, detailRequests, detailRequestedBeforeThreshold }),
    releaseDetail: (requestNumber: number) => {
      const release = detailReleases.get(requestNumber);
      expect(release, `detail request ${requestNumber} must be waiting`).toBeDefined();
      detailReleases.delete(requestNumber);
      release?.();
    },
    releaseProgress: (requestNumber: number) => {
      const release = progressReleases.get(requestNumber);
      expect(release, `progress request ${requestNumber} must be waiting`).toBeDefined();
      progressReleases.delete(requestNumber);
      release?.();
    },
    setDetailStatus: (status: DetailStatus) => { detailStatus = status; },
    setProgressStatus: (status: ProgressStatus) => { progressStatus = status; },
    task,
  };
}

async function reachDetailFallback(
  recovery: Awaited<ReturnType<typeof openWorkbox>>,
): Promise<void> {
  await recovery.advance(POLL_INTERVAL_MS * 2);
  await expect.poll(() => recovery.counts().detailRequests).toBe(1);
  expect(recovery.counts().progressRequests).toBeGreaterThanOrEqual(3);
  expect(recovery.counts().detailRequestedBeforeThreshold).toBe(false);
}

test("Redis UNKNOWN 반복 뒤 DB READY를 조회해 작업을 완료한다", async ({ page }) => {
  const recovery = await openWorkbox(page, { detailStatus: "READY" });

  await reachDetailFallback(recovery);
  await expect(recovery.task).toContainText("완료");
  expect(recovery.counts().detailRequests).toBe(1);
});

test("progress 네트워크 오류 반복 뒤 DB FAILED와 실패 사유를 복구한다", async ({ page }) => {
  const recovery = await openWorkbox(page, {
    detailStatus: "FAILED",
    progressStatus: "ERROR",
  });

  await reachDetailFallback(recovery);
  await expect(recovery.task).toContainText("실패");
  await expect(recovery.task).toContainText("인코딩 원본 손상");
});

test("지연된 상세 조회는 UNKNOWN이 반복돼도 하나만 실행한다", async ({ page }) => {
  const recovery = await openWorkbox(page, {
    detailStatus: "PROCESSING",
    heldDetailRequests: [1],
  });

  await reachDetailFallback(recovery);
  await recovery.advance(POLL_INTERVAL_MS * 5);
  expect(recovery.counts().detailRequests).toBe(1);

  recovery.releaseDetail(1);
  await expect(recovery.task).toContainText("영상 상세 상태를 확인했습니다. 인코딩 처리 중입니다.");
  await expect(recovery.task).toContainText("대기 중");
});

test("비종결 상세 조회는 30초 cooldown 뒤에만 다시 실행한다", async ({ page }) => {
  const recovery = await openWorkbox(page, { detailStatus: "PROCESSING" });

  await reachDetailFallback(recovery);
  await expect(recovery.task).toContainText("영상 상세 상태를 확인했습니다. 인코딩 처리 중입니다.");
  await recovery.advance(25_000);
  expect(recovery.counts().detailRequests).toBe(1);

  await recovery.advance(5_000);
  await expect.poll(() => recovery.counts().detailRequests).toBe(2);
});

test("Redis 정상화 뒤 늦은 상세 실패는 복구 안내를 되살리지 않는다", async ({ page }) => {
  const recovery = await openWorkbox(page, {
    detailStatus: "ERROR",
    heldDetailRequests: [1],
  });

  await reachDetailFallback(recovery);
  recovery.setProgressStatus("PROCESSING");
  await recovery.advance(POLL_INTERVAL_MS);
  await expect(recovery.task).toContainText("진행 중");
  await expect(recovery.task).not.toContainText("다시 확인");

  recovery.releaseDetail(1);
  await recovery.advance(0);
  await expect(recovery.task).toContainText("진행 중");
  await expect(recovery.task).not.toContainText("다시 확인");
  await expect(recovery.task).not.toContainText("연결이 복구되면");
  await expect(recovery.task).not.toContainText("실패");
});

test("작업 삭제 뒤 늦은 상세 응답은 task를 다시 만들지 않는다", async ({ page }) => {
  const recovery = await openWorkbox(page, {
    detailStatus: "FAILED",
    heldDetailRequests: [1],
  });

  await reachDetailFallback(recovery);
  await recovery.task.getByRole("button", { name: "삭제" }).click();
  await recovery.task.getByRole("button", { name: "삭제", exact: true }).last().click();
  await expect(recovery.task).toHaveCount(0);

  recovery.releaseDetail(1);
  await recovery.advance(POLL_INTERVAL_MS * 2);
  await expect(recovery.task).toHaveCount(0);
});

test("layout unmount/remount 뒤 이전 progress와 detail 응답을 모두 무시한다", async ({ page }) => {
  const recovery = await openWorkbox(page, {
    detailStatus: "ERROR",
    heldDetailRequests: [1],
    heldProgressRequests: [4],
  });

  await reachDetailFallback(recovery);
  await recovery.advance(POLL_INTERVAL_MS);
  await expect.poll(() => recovery.counts().progressRequests).toBe(4);

  recovery.setProgressStatus("PROCESSING");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /^작업박스/ })).toBeVisible();
  await expect.poll(() => recovery.counts().progressRequests).toBeGreaterThanOrEqual(5);
  if (!await recovery.task.isVisible()) {
    await page.getByRole("button", { name: /^작업박스/ }).click();
  }
  await expect(recovery.task).toContainText("진행 중");
  expect(await page.evaluate(() => ({
    body: document.body.scrollWidth <= document.body.clientWidth,
    document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  }))).toEqual({ body: true, document: true });

  recovery.releaseProgress(4);
  recovery.releaseDetail(1);
  await recovery.advance(POLL_INTERVAL_MS);
  await expect(recovery.task).toContainText("진행 중");
  await expect(recovery.task).not.toContainText("다시 확인");
  await expect(recovery.task).not.toContainText("연결이 복구되면");
  await expect(recovery.task).not.toContainText("실패");
});
