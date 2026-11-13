import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
  ).toString("base64url");
  return `e30.${payload}.sig`;
}

async function installTeacherVideoMocks(page: Page) {
  const apiRequests: Array<{ method: string; path: string }> = [];
  const videoRequests: Array<{ method: string; path: string }> = [];
  let hlsManifestRequestCount = 0;

  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    localStorage.setItem("teacher:preferAdmin", "0");
  }, { access: fakeJwt(), refresh: fakeJwt() });

  await page.route("**/e2e/teacher-preview/master.m3u8**", async (route) => {
    hlsManifestRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.apple.mpegurl",
      body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nsegment.ts\n#EXT-X-ENDLIST\n",
    });
  });
  await page.route("**/e2e/teacher-preview/segment.ts", async (route) => {
    await route.fulfill({ status: 200, contentType: "video/mp2t", body: "" });
  });
  await page.route("https://www.youtube.com/embed/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>mock youtube player</title>",
    });
  });

  const json = (route: Route, body: unknown) => route.fulfill({ json: body });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    apiRequests.push({ method: request.method(), path });
    if (path.startsWith("/media/videos/")) {
      videoRequests.push({ method: request.method(), path });
    }

    if (path === "/core/program/") {
      return json(route, {
        tenantCode: "hakwonplus",
        display_name: "박철 과학",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json(route, {
        id: 2,
        username: "teacher",
        name: "박철",
        is_staff: true,
        is_superuser: false,
        tenantRole: "teacher",
        must_change_password: false,
      });
    }
    if (path === "/media/videos/448/") {
      return json(route, {
        id: 448,
        title: "서명 HLS 선생님 미리보기",
        status: "READY",
        source_type: "s3",
        hls_url: `${BASE}/e2e/teacher-preview/master.m3u8?signature=teacher-only`,
        thumbnail_url: null,
        duration_display: "12:34",
        created_at: "2026-08-25T01:00:00Z",
      });
    }
    if (path === "/media/videos/449/") {
      return json(route, {
        id: 449,
        title: "YouTube 선생님 미리보기",
        status: "READY",
        source_type: "youtube",
        youtube_video_id: "VnqgmOJaMGc",
        hls_url: null,
        thumbnail_url: null,
        duration_display: "08:02",
        created_at: "2026-08-25T02:00:00Z",
      });
    }
    const failedVideo = { id: 450, title: "처리 실패한 업로드 영상", status: "FAILED", source_type: "s3" };
    if (path === "/media/videos/") return json(route, { count: 1, results: [failedVideo] });
    if (path === "/media/videos/450/") return json(route, failedVideo);
    if (/^\/media\/videos\/(448|449|450)\/stats\/$/.test(path)) {
      return json(route, { students: [] });
    }

    return json(route, { count: 0, results: [] });
  });

  return {
    apiRequests,
    videoRequests,
    hlsManifestRequestCount: () => hlsManifestRequestCount,
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= window.innerWidth,
    root: document.documentElement.scrollWidth <= window.innerWidth,
  }))).toEqual({ body: true, root: true });
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test("선생님 영상 상세는 390px과 PC에서 HLS와 YouTube를 재생하되 학생 진도를 변경하지 않는다", async ({ page }, testInfo) => {
  const mocks = await installTeacherVideoMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, `${BASE}/workspace/mobile/videos/448`, { timeout: 20_000 });

  const hlsPreview = page.getByLabel("선생님 영상 미리보기");
  await expect(hlsPreview).toBeVisible();
  await expect(hlsPreview).toHaveAttribute("controls", "");
  await expect(hlsPreview).toHaveAttribute("playsinline", "");
  await expect(page.getByRole("button", { name: "원본 다운로드", exact: true })).toBeVisible();
  await expect.poll(mocks.hlsManifestRequestCount).toBeGreaterThan(0);
  await expectNoHorizontalOverflow(page);
  const hlsMobileScreenshot = testInfo.outputPath("teacher-video-hls-390.png");
  await page.screenshot({ path: hlsMobileScreenshot, fullPage: true });
  await testInfo.attach("teacher-video-hls-390", {
    path: hlsMobileScreenshot,
    contentType: "image/png",
  });

  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(hlsPreview).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const hlsDesktopScreenshot = testInfo.outputPath("teacher-video-hls-1366.png");
  await page.screenshot({ path: hlsDesktopScreenshot, fullPage: true });
  await testInfo.attach("teacher-video-hls-1366", {
    path: hlsDesktopScreenshot,
    contentType: "image/png",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/videos/449`, { timeout: 20_000 });
  const youtubePreview = page.getByTitle("YouTube 선생님 영상 미리보기");
  await expect(youtubePreview).toBeVisible();
  await expect(youtubePreview).toHaveAttribute("src", /youtube\.com\/embed\/VnqgmOJaMGc/);
  await expect(page.getByRole("button", { name: "원본 다운로드", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  const youtubeMobileScreenshot = testInfo.outputPath("teacher-video-youtube-390.png");
  await page.screenshot({ path: youtubeMobileScreenshot, fullPage: true });
  await testInfo.attach("teacher-video-youtube-390", {
    path: youtubeMobileScreenshot,
    contentType: "image/png",
  });

  expect(mocks.videoRequests).toEqual(expect.arrayContaining([
    { method: "GET", path: "/media/videos/448/" },
    { method: "GET", path: "/media/videos/448/stats/" },
    { method: "GET", path: "/media/videos/449/" },
    { method: "GET", path: "/media/videos/449/stats/" },
  ]));
  expect(mocks.videoRequests.filter(({ method, path }) =>
    method !== "GET" || /(?:progress|playback|student)/i.test(path),
  )).toEqual([]);
  expect(mocks.apiRequests.filter(({ method, path }) =>
    method !== "GET" && /(?:video|progress|playback)/i.test(path),
  )).toEqual([]);
  expect(mocks.apiRequests.filter(({ path }) => path.startsWith("/student/video"))).toEqual([]);
});

test("선생님은 영상 목록에서 처리 실패한 영상의 원본을 저장할 수 있다", async ({ page }, testInfo) => {
  const mocks = await installTeacherVideoMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  let requests = 0;
  await page.route("**/media/videos/450/source-download/", (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    if (++requests === 1) {
      return route.fulfill({ status: 503, json: { detail: "원본을 확인하지 못했습니다." } });
    }
    return route.fulfill({
      json: { download_url: "https://video-download.test/lesson.mov", filename: "lesson.mov", expires_in: 300 },
    });
  });
  await page.route("https://video-download.test/lesson.mov", (route) => route.fulfill({
    headers: { "content-disposition": 'attachment; filename="lesson.mov"' },
    contentType: "video/quicktime",
    body: "synthetic original",
  }));

  await gotoAndSettle(page, `${BASE}/workspace/mobile/videos`);
  await page.getByRole("button", { name: "처리 실패한 업로드 영상", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/mobile\/videos\/450$/);
  const original = page.getByRole("button", { name: "원본 다운로드", exact: true });
  await expect(original).toBeVisible();
  expect(requests).toBe(0);
  expect((await original.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("teacher-video-original-390.png"), fullPage: true });
  await original.click();
  await expect(page.getByText("원본을 확인하지 못했습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "재생본 MP4 준비" })).toHaveCount(0);
  await original.click();
  const save = page.getByRole("link", { name: "파일 저장", exact: true });
  await expect(save).toBeFocused();
  const [download] = await Promise.all([page.waitForEvent("download"), save.click()]);
  expect(download.suggestedFilename()).toBe("lesson.mov");
  expect(await download.failure()).toBeNull();
  expect(requests).toBe(2);
  expect(mocks.apiRequests.filter(({ path }) => /\/student\/video|\/playback\//.test(path))).toEqual([]);
});

test("선생님은 새로고침 뒤 MP4 준비 상태를 다시 확인하고 저장할 수 있다", async ({ page }, testInfo) => {
  await installTeacherVideoMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  let prepareRequests = 0;
  let statusRequests = 0;
  await page.route("**/media/videos/448/source-download/", (route) => route.fulfill({
    status: 404, json: { code: "video_source_missing", detail: "보관된 원본 파일을 찾을 수 없습니다." },
  }));
  await page.route("**/media/videos/448/playback-export/", (route) => {
    if (route.request().method() === "GET") {
      statusRequests += 1;
      if (prepareRequests && statusRequests === 2) return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: { state: prepareRequests ? "ready" : "not_requested" } });
    }
    if (++prepareRequests === 1) return route.fulfill({ status: 202, json: { state: "preparing" } });
    return route.fulfill({
      json: {
        state: "ready", download_url: "https://video-download.test/playback.mp4",
        filename: "playback.mp4", expires_in: 300,
      },
    });
  });
  await page.route("https://video-download.test/playback.mp4", (route) => route.fulfill({
    headers: { "content-disposition": 'attachment; filename="playback.mp4"' },
    contentType: "video/mp4",
    body: "synthetic playback export",
  }));

  await gotoAndSettle(page, `${BASE}/workspace/mobile/videos/448`);
  const original = page.getByRole("button", { name: "원본 다운로드", exact: true });
  await original.click();
  await expect(page.getByText("보관된 원본 파일을 찾을 수 없습니다.")).toBeVisible();
  await expect.poll(() => statusRequests).toBe(1);
  await page.getByRole("button", { name: "재생본 MP4 준비" }).click();
  await expect(page.getByText("재생본을 준비하고 있습니다.", { exact: false })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await original.click();
  const statusRetry = page.getByRole("button", { name: "준비 상태 다시 확인" });
  await expect(statusRetry).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("teacher-video-status-retry-390.png"), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(statusRetry).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await statusRetry.click();
  const ready = page.getByRole("button", { name: "재생본 받기" });
  await expect(ready).toBeVisible();
  expect(prepareRequests).toBe(1);
  await ready.click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "파일 저장", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("playback.mp4");
  expect(await download.failure()).toBeNull();
  expect(prepareRequests).toBe(2);
});
