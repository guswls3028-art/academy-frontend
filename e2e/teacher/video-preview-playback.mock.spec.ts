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
    if (path === "/media/videos/448/stats/" || path === "/media/videos/449/stats/") {
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
