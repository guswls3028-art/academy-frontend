import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const CLOCK_START = new Date("2026-08-29T14:00:00.000Z");

function jwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(CLOCK_START.getTime() / 1000) + 3600,
    tenant_code: "tenant-one",
    user_id: 502,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

type Evidence = {
  playbackRequests: number;
  accessChecks: number;
  requestedPaths: string[];
  mutationPaths: string[];
  activityBodies: Array<Record<string, unknown>>;
};

type PlaybackMode = "direct" | "enrolled" | "failure" | "pending";

async function installApp(
  page: Page,
  mode: PlaybackMode = "direct",
): Promise<{ evidence: Evidence; revoke: () => void }> {
  const evidence: Evidence = {
    playbackRequests: 0,
    accessChecks: 0,
    requestedPaths: [],
    mutationPaths: [],
    activityBodies: [],
  };
  let revoked = false;
  const baseEpoch = Math.floor(CLOCK_START.getTime() / 1000);
  await page.clock.install({ time: CLOCK_START });
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
    localStorage.setItem("tenant_code", "tenant-one");
    sessionStorage.setItem("tenantCode", "tenant-one");
  }, jwt());

  await page.route("https://cdn.example.test/direct/**", async (route) => {
    // Keep media loading pending so this contract exercises direct access and
    // token refresh without coupling it to a browser codec or HLS transmuxer.
    await new Promise<void>((resolveClose) => page.once("close", resolveClose));
    try {
      await route.abort();
    } catch {
      // Page teardown may already have disposed the intercepted request.
    }
  });

  const handler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    evidence.requestedPaths.push(path);
    if (!["GET", "HEAD"].includes(request.method())) evidence.mutationPaths.push(path);

    if (path === "/students/me/activity/" && request.method() === "POST") {
      evidence.activityBodies.push(request.postDataJSON());
      return json({ ok: true });
    }

    if (path === "/core/program/") {
      return json({ tenantCode: "tenant-one", display_name: "테스트 학원", feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({
        id: 502,
        username: "direct-student",
        name: "개별영상학생",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        linkedStudentId: 502,
        linkedStudentName: "개별영상학생",
        must_change_password: false,
      });
    }
    if (path === "/student/video/videos/902/playback/" && url.searchParams.get("access_check") === "1") {
      evidence.accessChecks += 1;
      if (revoked) return json({ detail: "현재 이 영상을 시청할 권한이 없습니다." }, 403);
      return json({ ok: true, access_mode: "FREE_REVIEW", monitoring_enabled: false, policy_version: 1 });
    }
    if (path === "/student/video/videos/902/playback/") {
      evidence.playbackRequests += 1;
      if (mode === "failure") return json({ detail: "현재 이 영상을 시청할 권한이 없습니다." }, 403);
      if (mode === "pending") {
        await new Promise<void>((resolveClose) => page.once("close", resolveClose));
        try {
          await route.abort();
        } catch {
          // Page teardown may already have disposed the intercepted request.
        }
        return;
      }
      if (revoked) return json({ detail: "현재 이 영상을 시청할 권한이 없습니다." }, 403);
      const expiresAt = evidence.playbackRequests === 1 ? baseEpoch + 70 : baseEpoch + 670;
      return json({
        video: {
          id: 902,
          session_id: 802,
          enrollment_id: mode === "enrolled" ? 702 : null,
          title: "개별 허용된 중간고사 해설",
          status: "READY",
          source_type: "s3",
          duration: 600,
          progress: 0,
          completed: false,
          last_position: 0,
          allow_skip: true,
          max_speed: 1,
          show_watermark: false,
          access_mode: "FREE_REVIEW",
          view_count: 0,
          like_count: 0,
          comment_count: 0,
          is_liked: false,
        },
        hls_url: "https://cdn.example.test/direct/master.m3u8",
        play_url: "https://cdn.example.test/direct/master.m3u8",
        playback_token: `direct-token-${evidence.playbackRequests}`,
        playback_session_id: null,
        playback_expires_at: expiresAt,
        policy_version: 1,
        policy: {
          access_mode: "FREE_REVIEW",
          monitoring_enabled: false,
          allow_seek: true,
          playback_rate: { max: 1, ui_control: true },
          source: { type: "s3", provider: "uploaded" },
        },
      });
    }
    if (path === "/student/video/sessions/802/videos/") {
      return json({
        items: [{
          id: 902,
          session_id: 802,
          enrollment_id: mode === "enrolled" ? 702 : null,
          title: "개별 허용된 중간고사 해설",
          status: "READY",
          source_type: "s3",
          duration: 600,
          progress: 0,
          completed: false,
          last_position: 0,
          allow_skip: true,
          max_speed: 1,
          show_watermark: false,
          access_mode: "FREE_REVIEW",
        }],
      });
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/media/videos/public-session/") return json(null);
    return json({});
  };

  await page.route("**/api/v1/**", handler);
  await page.context().route("**/api/v1/**", handler);
  return { evidence, revoke: () => { revoked = true; } };
}

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");

test("개별 영상 학생 재생은 exact-only·로컬 이어보기·짧은 갱신·무쓰기 경계를 지킨다", async ({ page }) => {
  const { evidence, revoke } = await installApp(page);
  await page.goto(`${BASE}/student/video/play?video=902&session=802`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await expect(page.getByRole("heading", { name: "개별 허용된 중간고사 해설" })).toBeVisible();
  await expect(page.getByText("개별 영상 권한 · 이 기기에서만 이어보기", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /좋아요/ })).toHaveCount(0);
  await page.clock.runFor(2_100);
  await expect(page.getByText("댓글", { exact: true })).toHaveCount(0);

  const video = page.locator("video");
  await expect(video).toHaveCount(1);
  await video.evaluate((element) => {
    Object.defineProperty(element, "currentTime", { configurable: true, get: () => 125 });
    Object.defineProperty(element, "duration", { configurable: true, get: () => 600 });
    const hidden = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    if (hidden) Object.defineProperty(document, "hidden", hidden);
    else Reflect.deleteProperty(document, "hidden");
  });
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.includes("student-video-position:902:enrollment:self"));
    if (!key) return null;
    return JSON.parse(localStorage.getItem(key) || "null")?.pos ?? null;
  })).toBe(125);

  await page.clock.runFor(26_000);
  await expect.poll(() => evidence.playbackRequests).toBeGreaterThanOrEqual(2);
  expect(evidence.requestedPaths.filter((path) => (
    path.includes("/progress")
    || path.includes("/comments")
    || path.includes("/like")
  ))).toEqual([]);
  expect(evidence.mutationPaths.filter((path) => (
    path.includes("playback")
    || path.includes("progress")
    || path.includes("comments")
    || path.includes("like")
    || path.includes("activity")
  ))).toEqual([]);

  revoke();
  await page.clock.runFor(30_000);
  await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible();
  await expect(page.getByText("현재 이 영상을 시청할 권한이 없습니다.", { exact: true })).toBeVisible();
  expect(evidence.accessChecks).toBeGreaterThanOrEqual(2);
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});

test("기존 수강 재생은 canonical bootstrap 뒤 화면 활동을 한 번만 기록한다", async ({ page }) => {
  const { evidence } = await installApp(page, "enrolled");
  await page.goto(`${BASE}/student/video/play?video=902&enrollment=702&session=802`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await expect(page.getByRole("heading", { name: "개별 허용된 중간고사 해설" })).toBeVisible();
  await expect.poll(
    () => evidence.activityBodies.filter((body) => body.screen_id === "student.video.player").length,
  ).toBe(1);
  await page.clock.runFor(5_000);
  expect(evidence.activityBodies.filter((body) => body.screen_id === "student.video.player")).toHaveLength(1);
});

test("bootstrap 실패는 학생 화면 활동을 기록하지 않는다", async ({ page }) => {
  const { evidence } = await installApp(page, "failure");
  await page.goto(`${BASE}/student/video/play?video=902&session=802`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible();
  expect(evidence.activityBodies.filter((body) => body.screen_id === "student.video.player")).toEqual([]);
});

test("bootstrap 중 화면을 떠나면 학생 화면 활동을 기록하지 않는다", async ({ page }) => {
  const { evidence } = await installApp(page, "pending");
  await page.goto(`${BASE}/student/video/play?video=902&session=802`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await expect.poll(() => evidence.playbackRequests).toBeGreaterThan(0);

  await page.evaluate(() => {
    history.pushState({}, "", "/student/dashboard");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  await page.clock.runFor(1_000);
  expect(evidence.activityBodies.filter((body) => body.screen_id === "student.video.player")).toEqual([]);
});
