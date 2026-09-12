import { expect, test } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { guardUnmockedYouTubeRequests, installYouTubeSdkFixture } from "../helpers/youtubeSdkFixture";
import {
  assertYoutubeReadyPlayPause, installStudentYoutubeScenario, openStudentYoutubeScenario,
  YOUTUBE_QA_TITLE,
} from "../helpers/studentYoutubeScenario";
import { waitForCondition } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function isLocalBase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: "limglish",
    user_id: 1772,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

async function cycleDocumentVisibility(page: Page): Promise<void> {
  await page.evaluate(() => {
    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, "visibilityState");
    const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
    const setVisibility = (visibilityState: "hidden" | "visible") => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibilityState,
      });
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => visibilityState === "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    };

    try {
      setVisibility("hidden");
      setVisibility("visible");
    } finally {
      if (originalVisibilityState) {
        Object.defineProperty(document, "visibilityState", originalVisibilityState);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
      if (originalHidden) {
        Object.defineProperty(document, "hidden", originalHidden);
      } else {
        Reflect.deleteProperty(document, "hidden");
      }
    }
  });
}

test.describe("student video CDN service errors", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });

  test("새 배포를 감지해도 재생 화면과 재생 위치를 자동으로 갱신하지 않는다", async ({ page }) => {
    let mainFrameNavigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) mainFrameNavigations += 1;
    });
    await page.route("**/version.json?*", async (route) => {
      await route.fulfill({
        json: { version: "new-release-detected-by-continuity-test" },
      });
    });

    const unexpectedYouTubeRequests = await guardUnmockedYouTubeRequests(page);
    const youtube = await installYouTubeSdkFixture(page);
    await installStudentYoutubeScenario(page);
    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 90_000 },
    );
    await expect(page.getByRole("heading", { name: YOUTUBE_QA_TITLE })).toBeVisible({
      timeout: 60_000,
    });
    const openedUrl = page.url();
    const openedNavigationCount = mainFrameNavigations;

    await expect(page.getByText("재생 화면을 준비하고 있어요…")).toHaveCount(0, {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "재생", exact: true }).click();
    await expect.poll(async () => (await youtube.snapshot()).players[0]?.state).toBe(1);
    const beforeUpdate = await youtube.snapshot();

    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });

    await expect(page.getByRole("status")).toContainText("새 버전이 준비됐어요", {
      timeout: 8_000,
    });
    await expect(page.getByRole("button", { name: "지금 새로고침" })).toBeVisible();
    await expect.poll(async () => (
      (await youtube.snapshot()).players[0]?.current ?? 0
    )).toBeGreaterThan(beforeUpdate.players[0].current + 0.5);
    const afterUpdate = await youtube.snapshot();

    expect(page.url()).toBe(openedUrl);
    expect(mainFrameNavigations).toBe(openedNavigationCount);
    expect(afterUpdate.players).toHaveLength(1);
    expect(afterUpdate.players[0]).toMatchObject({ destroyed: false, state: 1 });
    expect(afterUpdate.players[0].current).toBeGreaterThan(beforeUpdate.players[0].current);
    expect(unexpectedYouTubeRequests).toEqual([]);
    expect(await page.evaluate(() => ({
      body: document.body.scrollWidth <= document.body.clientWidth,
      document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }))).toEqual({ body: true, document: true });
  });

  test("CDN 403을 학생 인터넷 문제로 안내하지 않고 새 재생 URL을 요청한다", async ({ page }) => {
    const video = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "여름특강 영작 2차시 - 인칭대명사와 부정문&의문문",
      status: "READY",
      source_type: "s3",
      duration: 1465,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
    };
    let playbackRequests = 0;

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
      localStorage.setItem("video_pos_562", JSON.stringify({ pos: 999, ts: Date.now() }));
      localStorage.setItem("student-current-video:enrollment:1304:limglish:user:9999", "777");
    }, { token: fakeJwt() });

    await page.route("https://cdn.hakwonplus.com/e2e/**", async (route) => {
      await route.fulfill({
        status: 403,
        headers: { "access-control-allow-origin": "*" },
        contentType: "text/plain",
        body: "invalid signature",
      });
    });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown) => route.fulfill({ json: body });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          expect(route.request().method()).toBe("GET");
          return json({
            ok: true,
            access_mode: "FREE_REVIEW",
            monitoring_enabled: false,
            policy_version: 1,
          });
        }
        expect(route.request().method()).toBe("POST");
        playbackRequests += 1;
        return json({
          video,
          play_url: "https://cdn.hakwonplus.com/e2e/master.m3u8?exp=1&sig=invalid&kid=v1&uid=1772",
          policy_version: 1,
          policy: {
            access_mode: "FREE_REVIEW",
            monitoring_enabled: false,
            allow_seek: true,
            playback_rate: { max: 1, ui_control: true },
          },
        });
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [video] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );

    await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible();
    await expect(page.getByText("영상 서비스에서 재생 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeVisible();
    await expect(page.getByText(/인터넷.*확인|새로고침/)).toHaveCount(0);

    const storageState = await page.evaluate(() => ({
      current: localStorage.getItem("student-current-video:enrollment:1304:limglish:user:1772"),
      legacyPosition: localStorage.getItem("video_pos_562"),
      otherUser: localStorage.getItem("student-current-video:enrollment:1304:limglish:user:9999"),
    }));
    expect(storageState.current).toBe("562");
    expect(JSON.parse(storageState.legacyPosition || "null")?.pos).toBe(999);
    expect(storageState.otherUser).toBe("777");

    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect.poll(() => playbackRequests).toBeGreaterThanOrEqual(2);
  });

  test("열린 무료복습 영상도 강의 종료 access check 403에서 즉시 닫는다", async ({ page }) => {
    let accessChecks = 0;
    let denyAccess = false;

    const clockStart = new Date("2026-08-27T00:00:00.000Z");
    await page.clock.install({ time: clockStart });
    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
      class StableYoutubePlayer {
        destroy() {}
      }
      Object.defineProperty(window, "YT", {
        configurable: true,
        value: { Player: StableYoutubePlayer },
      });
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          accessChecks += 1;
          if (!denyAccess) {
            return json({
              ok: true,
              access_mode: "FREE_REVIEW",
              monitoring_enabled: false,
              policy_version: 1,
            });
          }
          return json({ detail: "종료된 강의의 영상은 시청할 수 없습니다." }, 403);
        }
        return json({
          video: {
            id: 562,
            session_id: 394,
            enrollment_id: 1304,
            title: "종료 전 열어 둔 무료복습 영상",
            status: "READY",
            source_type: "youtube",
            youtube_video_id: "VnqgmOJaMGc",
            duration: 600,
            progress: 30,
            completed: false,
            last_position: 180,
            allow_skip: true,
            max_speed: 1,
            show_watermark: false,
            access_mode: "FREE_REVIEW",
          },
          play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
          playback_token: "signed-current-access-token",
          playback_session_id: null,
          playback_expires_at: Math.floor(Date.now() / 1000) + 600,
          policy_version: 1,
          policy: {
            access_mode: "FREE_REVIEW",
            monitoring_enabled: false,
            allow_seek: true,
            playback_rate: { max: 1, ui_control: true },
            source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
          },
        });
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    const initialAccessCheck = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 200;
    }, { timeout: 30_000 });
    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded" },
    );

    const initialAccessResponse = await initialAccessCheck;
    await initialAccessResponse.finished();
    await expect(page.getByRole("heading", { name: "종료 전 열어 둔 무료복습 영상" })).toBeVisible();
    await expect.poll(() => accessChecks).toBe(1);
    const activeVisibilityCheck = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 200;
    }, { timeout: 30_000 });
    await cycleDocumentVisibility(page);
    const activeVisibilityResponse = await activeVisibilityCheck;
    await activeVisibilityResponse.finished();
    await expect.poll(() => accessChecks).toBe(2);
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 10)));
    const pauseTime = await page.evaluate(() => Date.now() + 1_000);
    await page.clock.pauseAt(pauseTime);

    const intervalDenialCheck = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 403;
    }, { timeout: 30_000 });
    denyAccess = true;
    await page.clock.runFor(30_000);
    const intervalDenialResponse = await intervalDenialCheck;
    await intervalDenialResponse.finished();
    await page.clock.runFor(1);
    await expect.poll(() => accessChecks).toBe(3);
    await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible();
    await expect(page.getByText("종료된 강의의 영상은 시청할 수 없습니다.")).toBeVisible();
    await expect(page.getByText("종료 전 열어 둔 무료복습 영상")).toHaveCount(0);

    const deniedAccessChecks = accessChecks;
    await page.clock.runFor(60_000);
    await cycleDocumentVisibility(page);
    await page.clock.runFor(1_000);
    expect(accessChecks).toBe(deniedAccessChecks);

    await page.evaluate(() => {
      window.history.pushState({}, "", "/student");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });
    await page.clock.runFor(60_000);
    await cycleDocumentVisibility(page);
    await page.clock.runFor(1_000);
    expect(accessChecks).toBe(deniedAccessChecks);
  });

  test("열린 무료복습이 수업 모드로 바뀌면 즉시 닫고 monitored bootstrap을 다시 받는다", async ({ page }) => {
    let playbackRequests = 0;
    let releasePolicyDrift!: () => void;
    let releaseProctoredBootstrap!: () => void;
    const policyDriftGate = new Promise<void>((resolve) => {
      releasePolicyDrift = resolve;
    });
    const proctoredBootstrapGate = new Promise<void>((resolve) => {
      releaseProctoredBootstrap = resolve;
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          await policyDriftGate;
          return json({
            ok: true,
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            policy_version: 2,
          });
        }

        playbackRequests += 1;
        const proctored = playbackRequests > 1;
        if (proctored) await proctoredBootstrapGate;
        return json({
          video: {
            id: 562,
            session_id: 394,
            enrollment_id: 1304,
            title: "정책 전환 재생 영상",
            status: "READY",
            source_type: "youtube",
            youtube_video_id: "VnqgmOJaMGc",
            duration: 600,
            progress: 30,
            completed: false,
            last_position: 180,
            allow_skip: true,
            max_speed: 1,
            show_watermark: true,
            access_mode: proctored ? "PROCTORED_CLASS" : "FREE_REVIEW",
          },
          play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
          playback_token: proctored ? "proctored-token" : "free-review-token",
          playback_session_id: proctored ? "proctored-session" : null,
          playback_expires_at: Math.floor(Date.now() / 1000) + 600,
          policy_version: proctored ? 2 : 1,
          policy: {
            access_mode: proctored ? "PROCTORED_CLASS" : "FREE_REVIEW",
            monitoring_enabled: proctored,
            allow_seek: true,
            playback_rate: { max: 1, ui_control: true },
            watermark: { enabled: true, mode: "overlay", fields: ["user_id"] },
            source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
          },
        });
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );

    await expect(page.getByRole("heading", { name: "정책 전환 재생 영상" })).toBeVisible({
      timeout: 30_000,
    });
    releasePolicyDrift();

    await expect.poll(() => playbackRequests, { timeout: 30_000 }).toBe(2);
    await expect(page.getByText("정책 전환 재생 영상")).toHaveCount(0);

    releaseProctoredBootstrap();

    await expect(page.getByRole("heading", { name: "정책 전환 재생 영상" })).toBeVisible();
    await expect(page.getByText("온라인 수업 대체")).toHaveCount(1);
    expect(playbackRequests).toBe(2);
  });
});

test.describe("student video playback grant renewal continuity", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });

  test("short-lived playback token renewal keeps the active HLS player mounted", async ({ page }) => {
    let playbackRequests = 0;
    let rejectBootstrap = false;
    let fixedExpiryScenario = false;
    let fixedExpirySeconds = 0;
    let fixedExpiryRenewals = 0;
    let expiredRecoveryScenario = false;
    let expiredRecoveryBootstraps = 0;
    let renewalRequests = 0;
    const endedTokens: string[] = [];
    const refreshedTokens: string[] = [];
    let releaseRenewal!: () => void;
    let releaseSegment!: () => void;
    const renewalGate = new Promise<void>((resolve) => {
      releaseRenewal = resolve;
    });
    const segmentGate = new Promise<void>((resolve) => {
      releaseSegment = resolve;
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "godmin");
      sessionStorage.setItem("tenantCode", "godmin");
    }, { token: fakeJwt() });

    await page.route("https://cdn.hakwonplus.com/e2e/grant-renewal/**", async (route) => {
      if (new URL(route.request().url()).pathname.endsWith("/segment.ts")) {
        await segmentGate;
        await route.fulfill({ status: 200, contentType: "video/mp2t", body: "" });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*" },
        contentType: "application/vnd.apple.mpegurl",
        body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:10,\nsegment.ts\n#EXT-X-ENDLIST\n",
      });
    });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "godmin",
          display_name: "과학 학원",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (
        path === "/student/video/videos/671/playback/"
        || path === "/student/video/videos/672/playback/"
        || path === "/student/video/videos/673/playback/"
      ) {
        if (url.searchParams.get("access_check") === "1") {
          return json({
            ok: true,
            access_mode: fixedExpiryScenario ? "FREE_REVIEW" : "PROCTORED_CLASS",
            monitoring_enabled: !fixedExpiryScenario,
            policy_version: 1,
          });
        }

        playbackRequests += 1;
        if (rejectBootstrap) {
          await json({ detail: "temporary_unavailable" }, 503);
          return;
        }
        const now = Math.floor(Date.now() / 1000);
        if (expiredRecoveryScenario) {
          expiredRecoveryBootstraps += 1;
          const recovered = expiredRecoveryBootstraps > 1;
          const recoveryExpiry = recovered ? now + 600 : now + 181;
          return json({
            video: {
              id: 673,
              session_id: 584,
              enrollment_id: 1304,
              title: "복귀 시 권한을 복구하는 긴 영상",
              status: "READY",
              source_type: "s3",
              duration: 8516,
              progress: 10,
              completed: false,
              last_position: 321,
              allow_skip: true,
              max_speed: 2,
              show_watermark: true,
              access_mode: "PROCTORED_CLASS",
            },
            play_url: `https://cdn.hakwonplus.com/e2e/grant-renewal/master.m3u8?exp=${recoveryExpiry}&sig=${recovered ? "recovered" : "expired"}`,
            playback_token: recovered ? "recovered-playback-token" : "expired-playback-token",
            playback_session_id: recovered ? "recovered-monitored-session" : "inactive-monitored-session",
            playback_expires_at: recoveryExpiry,
            policy_version: 1,
            policy: {
              access_mode: "PROCTORED_CLASS",
              monitoring_enabled: true,
              allow_seek: true,
              playback_rate: { max: 2, ui_control: true },
              watermark: { enabled: true, mode: "overlay", fields: ["user_id"] },
              source: { type: "hls", provider: "uploaded", youtube_video_id: "" },
            },
          });
        }
        if (fixedExpiryScenario) {
          fixedExpirySeconds = now + 3;
          return json({
            video: {
              id: 672,
              session_id: 584,
              enrollment_id: 1304,
              title: "중3 구름과 강수 긴 영상",
              status: "READY",
              source_type: "s3",
              duration: 8516,
              progress: 10,
              completed: false,
              last_position: 321,
              allow_skip: true,
              max_speed: 2,
              show_watermark: false,
              access_mode: "FREE_REVIEW",
            },
            play_url: `https://cdn.hakwonplus.com/e2e/grant-renewal/master.m3u8?exp=${fixedExpirySeconds}&sig=fixed`,
            playback_token: "fixed-expiry-token",
            playback_session_id: null,
            playback_expires_at: fixedExpirySeconds,
            policy_version: 1,
            policy: {
              access_mode: "FREE_REVIEW",
              monitoring_enabled: false,
              allow_seek: true,
              playback_rate: { max: 2, ui_control: true },
              watermark: { enabled: false, mode: "overlay", fields: [] },
              source: { type: "hls", provider: "uploaded", youtube_video_id: "" },
            },
          });
        }
        return json({
          video: {
            id: 671,
            session_id: 584,
            enrollment_id: 1304,
            title: "중3 구름과 강수 긴 영상",
            status: "READY",
            source_type: "s3",
            duration: 8516,
            progress: 10,
            completed: false,
            last_position: 321,
            allow_skip: true,
            max_speed: 2,
            show_watermark: true,
            access_mode: "PROCTORED_CLASS",
          },
          play_url: `https://cdn.hakwonplus.com/e2e/grant-renewal/master.m3u8?exp=${now + 9_116}&sig=initial`,
          playback_token: "initial-playback-token",
          playback_session_id: "monitored-session",
          playback_expires_at: now + 181,
          policy_version: 1,
          policy: {
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            allow_seek: true,
            playback_rate: { max: 2, ui_control: true },
            watermark: { enabled: true, mode: "overlay", fields: ["user_id"] },
            source: { type: "hls", provider: "uploaded", youtube_video_id: "" },
          },
        });
      }
      if (path === "/student/video/sessions/584/videos/") {
        return json({ items: [] });
      }
      if (
        path === "/student/video/videos/671/comments/"
        || path === "/student/video/videos/672/comments/"
        || path === "/student/video/videos/673/comments/"
      ) {
        return json({ count: 0, results: [] });
      }
      if (path === "/media/playback/end/") {
        const body = route.request().postDataJSON() as { token?: string };
        if (body.token) endedTokens.push(body.token);
        return json({ ok: true });
      }
      if (path === "/media/playback/renew/") {
        const body = route.request().postDataJSON() as { token?: string };
        if (body.token === "expired-playback-token") {
          return json({ detail: "playback_session_inactive" }, 409);
        }
        if (body.token === "fixed-expiry-token") {
          fixedExpiryRenewals += 1;
          return json({
            ok: true,
            playback_token: "equivalent-fixed-expiry-token",
            playback_session_id: null,
            playback_expires_at: fixedExpirySeconds,
            access_mode: "FREE_REVIEW",
            monitoring_enabled: false,
            policy_version: 1,
            play_url: `https://cdn.hakwonplus.com/e2e/grant-renewal/master.m3u8?exp=${fixedExpirySeconds}&sig=equivalent`,
          });
        }
        if (body.token === "initial-playback-token") {
          renewalRequests += 1;
          if (renewalRequests === 1) {
            return json({ detail: "temporary_unavailable" }, 503);
          }
          await renewalGate;
          const now = Math.floor(Date.now() / 1000);
          return json({
            ok: true,
            playback_token: "renewed-playback-token",
            playback_session_id: "monitored-session",
            playback_expires_at: now + 600,
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            policy_version: 1,
          });
        }
        return json({ ok: true });
      }
      if (path === "/media/playback/refresh/") {
        const body = route.request().postDataJSON() as { token?: string };
        if (body.token) refreshedTokens.push(body.token);
        return json({ ok: true });
      }
      if (path === "/media/playback/events/" || path === "/media/playback/heartbeat/") {
        return json({ ok: true });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=671&enrollment=1304&session=584`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByRole("heading", { name: "중3 구름과 강수 긴 영상" })).toBeVisible();
    const originalVideo = await page.locator("video").elementHandle();
    expect(originalVideo).not.toBeNull();
    await originalVideo!.evaluate((element) => {
      element.dataset.playbackContinuity = "active";
    });
    const endedBeforeRenewal = [...endedTokens];

    await expect.poll(() => renewalRequests, { timeout: 10_000 }).toBe(2);
    expect(playbackRequests).toBe(1);
    await expect(page.getByRole("heading", { name: "중3 구름과 강수 긴 영상" })).toBeVisible();
    expect(await originalVideo!.evaluate((element) => element.isConnected)).toBe(true);
    expect(endedTokens).toEqual(endedBeforeRenewal);

    releaseRenewal();
    await expect.poll(async () => page.locator('video[data-playback-continuity="active"]').count()).toBe(1);
    expect(await originalVideo!.evaluate((element) => element.isConnected)).toBe(true);
    expect(endedTokens).toEqual(endedBeforeRenewal);
    expect(playbackRequests).toBe(1);

    await page.context().setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await page.context().setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    expect(playbackRequests).toBe(1);
    expect(await originalVideo!.evaluate((element) => element.isConnected)).toBe(true);

    await cycleDocumentVisibility(page);
    await expect.poll(() => refreshedTokens).toContain("renewed-playback-token");

    await page.getByRole("link", { name: "학생 대시보드로 이동" }).click();
    await expect(page).toHaveURL(/\/student\/dashboard$/);
    await expect(page.locator(".vpp-root")).toHaveCount(0);
    const staleGrantGcEndsAt = Date.now() + 100;
    await waitForCondition(
      async () => Date.now() >= staleGrantGcEndsAt,
      { timeoutMs: 1_000, intervalMs: 25, description: "playback grant cache disposal" },
    );
    rejectBootstrap = true;
    await page.goBack();
    await expect.poll(() => playbackRequests).toBe(2);
    await expect(page.locator("video")).toHaveCount(0);
    const retryObservationEndsAt = Date.now() + 1_500;
    await waitForCondition(
      async () => Date.now() >= retryObservationEndsAt && playbackRequests === 2,
      {
        timeoutMs: 3_000,
        intervalMs: 100,
        description: "lost playback response does not retry or render the ended cached grant",
      },
    );

    await page.getByRole("link", { name: "학생 대시보드로 이동" }).click();
    await expect(page).toHaveURL(/\/student\/dashboard$/);
    await expect(page.locator(".vpp-root")).toHaveCount(0);
    const failedGrantGcEndsAt = Date.now() + 100;
    await waitForCondition(
      async () => Date.now() >= failedGrantGcEndsAt,
      { timeoutMs: 1_000, intervalMs: 25, description: "failed playback cache disposal" },
    );
    rejectBootstrap = false;
    fixedExpiryScenario = true;
    await page.goto(
      `${BASE}/student/video/play?video=672&enrollment=1304&session=584`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.locator("video")).toHaveCount(1);
    await expect.poll(() => fixedExpiryRenewals, { timeout: 5_000 }).toBe(1);
    await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible({ timeout: 5_000 });
    expect(fixedExpiryRenewals).toBe(1);

    fixedExpiryScenario = false;
    expiredRecoveryScenario = true;
    await page.goto(
      `${BASE}/student/video/play?video=673&enrollment=1304&session=584`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByRole("heading", { name: "복귀 시 권한을 복구하는 긴 영상" })).toBeVisible();
    const recoveryVideo = await page.locator("video").elementHandle();
    expect(recoveryVideo).not.toBeNull();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => expiredRecoveryBootstraps, { timeout: 5_000 }).toBe(2);
    await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toHaveCount(0);
    expect(await recoveryVideo!.evaluate((element) => element.isConnected)).toBe(true);
    releaseSegment();
  });

  test("short signed URL rotation preserves native HLS playback state", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30_000 });

    const result = await page.evaluate(async () => {
      const { StudentHlsController } = await import(
        "/src/app_student/domains/video/playback/player/headless/StudentHlsController.ts"
      );
      document.body.replaceChildren();
      const video = document.createElement("video");
      document.body.appendChild(video);

      let currentTime = 0;
      let paused = true;
      Object.defineProperty(video, "currentTime", {
        configurable: true,
        get: () => currentTime,
        set: (value: number) => { currentTime = Number(value); },
      });
      Object.defineProperty(video, "duration", {
        configurable: true,
        get: () => 1_200,
      });
      Object.defineProperty(video, "paused", {
        configurable: true,
        get: () => paused,
      });
      video.canPlayType = () => "probably";
      video.play = async () => {
        paused = false;
        video.dispatchEvent(new Event("play"));
      };
      video.pause = () => {
        paused = true;
        video.dispatchEvent(new Event("pause"));
      };
      video.load = () => {
        window.setTimeout(() => video.dispatchEvent(new Event("loadedmetadata")), 0);
      };

      const controller = new StudentHlsController({
        videoId: 671,
        playUrl: "https://cdn.hakwonplus.com/e2e/short/master.m3u8?sig=initial",
        policy: {
          access_mode: "FREE_REVIEW",
          monitoring_enabled: false,
          allow_seek: true,
          playback_rate: { max: 2, ui_control: true },
        },
        token: "student-placeholder",
        enrollmentId: null,
        initialPosition: 0,
      });
      await controller.attach(video);
      currentTime = 321.25;
      video.playbackRate = 1.5;
      video.volume = 0.4;
      video.muted = true;
      await video.play();
      const originalNode = video;

      controller.setSource(
        "https://cdn.hakwonplus.com/e2e/short/master.m3u8?sig=renewed",
      );
      await new Promise((resolve) => window.setTimeout(resolve, 50));

      const state = {
        sameNode: originalNode === video && video.isConnected,
        currentTime: video.currentTime,
        paused: video.paused,
        rate: video.playbackRate,
        volume: video.volume,
        muted: video.muted,
        src: video.src,
      };
      controller.dispose();
      return state;
    });

    expect(result.sameNode).toBe(true);
    expect(Math.abs(result.currentTime - 321.25)).toBeLessThanOrEqual(0.5);
    expect(result.paused).toBe(false);
    expect(result.rate).toBe(1.5);
    expect(result.volume).toBeCloseTo(0.4, 2);
    expect(result.muted).toBe(true);
    expect(result.src).toContain("sig=renewed");
  });
});

test.describe("student video access races on desktop", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

  test.use({
    viewport: { width: 1366, height: 768 },
    serviceWorkers: "block",
  });

  test("지연된 A 정책 응답은 B의 403 종료 상태를 해제하지 않는다", async ({ page }) => {
    let aPlaybackRequests = 0;
    let aRefetchRequests = 0;
    let aRefetchResponses = 0;
    let bPlaybackRequests = 0;
    let bAccessChecks = 0;
    let aPolicyDriftReleased = false;
    let releaseADrift!: () => void;
    let releaseARefetch!: () => void;
    const aDriftGate = new Promise<void>((resolve) => {
      releaseADrift = resolve;
    });
    const aRefetchGate = new Promise<void>((resolve) => {
      releaseARefetch = resolve;
    });
    const videoA = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "지연 응답 영상 A",
      status: "READY",
      source_type: "youtube",
      youtube_video_id: "VnqgmOJaMGc",
      duration: 600,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: true,
      access_mode: "FREE_REVIEW",
    };
    const videoB = {
      ...videoA,
      id: 563,
      title: "권한 종료 영상 B",
    };
    const playback = (
      video: typeof videoA,
      mode: "FREE_REVIEW" | "PROCTORED_CLASS",
      policyVersion: number,
    ) => ({
      video: { ...video, access_mode: mode },
      play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
      playback_token: `${video.id}-${mode}-token`,
      playback_session_id: mode === "PROCTORED_CLASS" ? `${video.id}-session` : null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 600,
      policy_version: policyVersion,
      policy: {
        access_mode: mode,
        monitoring_enabled: mode === "PROCTORED_CLASS",
        allow_seek: true,
        playback_rate: { max: 1, ui_control: true },
        source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
      },
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          await aDriftGate;
          return json({
            ok: true,
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            policy_version: 2,
          });
        }
        aPlaybackRequests += 1;
        if (aPolicyDriftReleased) {
          aRefetchRequests += 1;
          await aRefetchGate;
          aRefetchResponses += 1;
          return json(playback(videoA, "PROCTORED_CLASS", 2));
        }
        return json(playback(videoA, "FREE_REVIEW", 1));
      }
      if (path === "/student/video/videos/563/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          bAccessChecks += 1;
          return json({ detail: "B 강의가 종료되어 시청할 수 없습니다." }, 403);
        }
        bPlaybackRequests += 1;
        return json(playback(videoB, "FREE_REVIEW", 1));
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [videoA, videoB] });
      }
      if (/\/student\/video\/videos\/\d+\/comments\/$/.test(path)) {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByRole("heading", { name: "지연 응답 영상 A" })).toBeVisible();
    expect(aPlaybackRequests).toBeGreaterThanOrEqual(1);

    aPolicyDriftReleased = true;
    releaseADrift();
    await expect.poll(() => aRefetchRequests, { timeout: 30_000 }).toBe(1);
    await page.evaluate(() => {
      window.history.pushState({}, "", "/student/video/play?video=563&enrollment=1304&session=394");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });

    await expect(page.getByRole("heading", { name: "재생을 시작할 수 없어요" })).toBeVisible();
    await expect(page.getByText("B 강의가 종료되어 시청할 수 없습니다.")).toBeVisible();
    await expect(page.getByText("권한 종료 영상 B")).toHaveCount(0);
    const deniedRequestCounts = { bPlaybackRequests, bAccessChecks };

    releaseARefetch();
    await expect.poll(() => aRefetchResponses).toBe(1);
    await cycleDocumentVisibility(page);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("B 강의가 종료되어 시청할 수 없습니다.")).toBeVisible();
    await expect(page.getByText("권한 종료 영상 B")).toHaveCount(0);
    expect({ bPlaybackRequests, bAccessChecks }).toEqual(deniedRequestCounts);
  });

  test("지연된 A 수동 재시도 성공은 B CDN 403 종료 상태를 해제하지 않는다", async ({ page }) => {
    let aPlaybackRequests = 0;
    let aAccessChecks = 0;
    let bPlaybackRequests = 0;
    let bAccessChecks = 0;
    let bCdnRequests = 0;
    let releaseARetry!: () => void;
    const aRetryGate = new Promise<void>((resolve) => {
      releaseARetry = resolve;
    });
    const videoA = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "수동 재시도 영상 A",
      status: "READY",
      source_type: "youtube",
      youtube_video_id: "VnqgmOJaMGc",
      duration: 600,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
    };
    const videoB = {
      ...videoA,
      id: 563,
      title: "수동 재시도 중 권한 종료 영상 B",
      source_type: "s3",
      youtube_video_id: "",
    };
    const playback = (video: typeof videoA | typeof videoB) => ({
      video,
      play_url: video.id === videoB.id
        ? "https://cdn.hakwonplus.com/e2e/manual-retry-b/master.m3u8?sig=expired"
        : "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
      playback_token: `${video.id}-free-review-token`,
      playback_session_id: null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 600,
      policy_version: 1,
      policy: {
        access_mode: "FREE_REVIEW",
        monitoring_enabled: false,
        allow_seek: true,
        playback_rate: { max: 1, ui_control: true },
        source: video.id === videoB.id
          ? { type: "hls", provider: "uploaded", youtube_video_id: "" }
          : { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
      },
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
    }, { token: fakeJwt() });

    await page.route("https://cdn.hakwonplus.com/e2e/manual-retry-b/**", async (route) => {
      bCdnRequests += 1;
      await route.fulfill({
        status: 403,
        headers: { "access-control-allow-origin": "*" },
        contentType: "text/plain",
        body: "expired playback authorization",
      });
    });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          aAccessChecks += 1;
          if (aAccessChecks === 1) {
            return json({ detail: "A 재생 권한을 다시 확인해 주세요." }, 403);
          }
          await aRetryGate;
          return json({
            ok: true,
            access_mode: "FREE_REVIEW",
            monitoring_enabled: false,
            policy_version: 1,
          });
        }
        aPlaybackRequests += 1;
        if (aPlaybackRequests > 1) await aRetryGate;
        return json(playback(videoA));
      }
      if (path === "/student/video/videos/563/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          bAccessChecks += 1;
          return json({
            ok: true,
            access_mode: "FREE_REVIEW",
            monitoring_enabled: false,
            policy_version: 1,
          });
        }
        bPlaybackRequests += 1;
        return json(playback(videoB));
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [videoA, videoB] });
      }
      if (/\/student\/video\/videos\/\d+\/comments\/$/.test(path)) {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByText("A 재생 권한을 다시 확인해 주세요.")).toBeVisible();

    const aPlaybackRetryResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") !== "1"
        && response.status() === 200;
    });
    const aAccessRetryResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 200;
    });
    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect.poll(() => ({ aPlaybackRequests, aAccessChecks })).toEqual({
      aPlaybackRequests: 2,
      aAccessChecks: 2,
    });

    await page.evaluate(() => {
      window.history.pushState({}, "", "/student/video/play?video=563&enrollment=1304&session=394");
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });
    await expect(page.getByText("영상 서비스에서 재생 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeVisible();
    await expect(page.getByText("수동 재시도 중 권한 종료 영상 B")).toHaveCount(0);
    await expect.poll(() => bCdnRequests).toBe(1);
    const deniedRequestCounts = { bPlaybackRequests, bAccessChecks, bCdnRequests };

    releaseARetry();
    await Promise.all([aPlaybackRetryResponse, aAccessRetryResponse]);
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 500)));

    await expect(page.getByText("영상 서비스에서 재생 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeVisible();
    await expect(page.getByText("수동 재시도 중 권한 종료 영상 B")).toHaveCount(0);
    expect({ bPlaybackRequests, bAccessChecks, bCdnRequests }).toEqual(deniedRequestCounts);
  });

  test("같은 영상 재시도의 교차 정책 응답은 오래된 CDN을 열지 않는다", async ({ page }) => {
    const unexpectedYouTubeRequests = await guardUnmockedYouTubeRequests(page);
    const youtube = await installYouTubeSdkFixture(page);
    let playbackRequests = 0;
    let accessChecks = 0;
    let staleCdnRequests = 0;
    let releaseStalePlayback!: () => void;
    let releaseProctoredAccess!: () => void;
    let releaseCurrentPlayback!: () => void;
    const stalePlaybackGate = new Promise<void>((resolve) => {
      releaseStalePlayback = resolve;
    });
    const proctoredAccessGate = new Promise<void>((resolve) => {
      releaseProctoredAccess = resolve;
    });
    const currentPlaybackGate = new Promise<void>((resolve) => {
      releaseCurrentPlayback = resolve;
    });
    const video = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "교차 정책 재시도 영상",
      status: "READY",
      source_type: "youtube",
      youtube_video_id: "VnqgmOJaMGc",
      duration: 600,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
    };
    const initialPlayback = {
      video,
      play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
      playback_token: "initial-free-v1-token",
      playback_session_id: null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 600,
      policy_version: 1,
      policy: {
        access_mode: "FREE_REVIEW",
        monitoring_enabled: false,
        allow_seek: true,
        playback_rate: { max: 1, ui_control: true },
        source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
      },
    };
    const stalePlayback = {
      ...initialPlayback,
      video: {
        ...video,
        source_type: "s3",
        youtube_video_id: "",
      },
      play_url: "https://cdn.hakwonplus.com/e2e/crossed-policy-stale/master.m3u8?sig=stale",
      playback_token: "stale-free-v1-token",
      policy: {
        ...initialPlayback.policy,
        source: { type: "hls", provider: "uploaded", youtube_video_id: "" },
      },
    };
    const currentPlayback = {
      ...initialPlayback,
      playback_token: "current-proctored-v2-token",
      playback_session_id: "current-proctored-session-v2",
      policy_version: 2,
      policy: {
        ...initialPlayback.policy,
        access_mode: "PROCTORED_CLASS",
        monitoring_enabled: true,
      },
    };

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
    }, { token: fakeJwt() });

    await page.route("https://cdn.hakwonplus.com/e2e/crossed-policy-stale/**", async (route) => {
      staleCdnRequests += 1;
      await route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*" },
        contentType: "application/vnd.apple.mpegurl",
        body: "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n",
      });
    });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          accessChecks += 1;
          if (accessChecks === 1) {
            return json({ detail: "재생 권한을 다시 확인해 주세요." }, 403);
          }
          await proctoredAccessGate;
          return json({
            ok: true,
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            policy_version: 2,
          });
        }
        playbackRequests += 1;
        if (playbackRequests === 1) return json(initialPlayback);
        if (playbackRequests === 2) {
          await stalePlaybackGate;
          return json(stalePlayback);
        }
        await currentPlaybackGate;
        return json(currentPlayback);
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [video] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByText("재생 권한을 다시 확인해 주세요.")).toBeVisible();

    const stalePlaybackResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") !== "1"
        && response.status() === 200;
    });
    const proctoredAccessResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 200;
    });
    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect.poll(() => ({ playbackRequests, accessChecks })).toEqual({
      playbackRequests: 2,
      accessChecks: 2,
    });

    releaseStalePlayback();
    await stalePlaybackResponse;
    await expect(page.getByText("재생 권한을 다시 확인해 주세요.")).toBeVisible();
    expect(staleCdnRequests).toBe(0);

    releaseProctoredAccess();
    await proctoredAccessResponse;
    await expect.poll(() => playbackRequests).toBe(3);
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 500)));
    expect(staleCdnRequests).toBe(0);
    await expect(page.getByText("교차 정책 재시도 영상")).toHaveCount(0);

    const currentPlaybackResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") !== "1"
        && response.status() === 200;
    });
    releaseCurrentPlayback();
    await currentPlaybackResponse;
    await expect(page.getByRole("heading", { name: "교차 정책 재시도 영상" })).toBeVisible();
    expect(staleCdnRequests).toBe(0);
    await expect.poll(async () => (await youtube.snapshot()).players.filter((player) => player.ready && !player.destroyed).length).toBe(1);
    await expect(page.getByText("재생 화면을 준비하고 있어요…")).toHaveCount(0);
    expect(unexpectedYouTubeRequests, "Route-mock playback must not depend on the live YouTube SDK").toEqual([]);
  });

  test("재시도 playback v2가 access v2보다 먼저 와도 한 번에 복구한다", async ({ page }) => {
    const unexpectedYouTubeRequests = await guardUnmockedYouTubeRequests(page);
    const youtube = await installYouTubeSdkFixture(page);
    let playbackRequests = 0;
    let accessChecks = 0;
    let expiredCdnRequests = 0;
    let resolveInitialAccess!: () => void;
    let releaseCurrentAccess!: () => void;
    const initialAccessReady = new Promise<void>((resolve) => {
      resolveInitialAccess = resolve;
    });
    const currentAccessGate = new Promise<void>((resolve) => {
      releaseCurrentAccess = resolve;
    });
    const initialVideo = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "재시도 정책 전환 영상",
      status: "READY",
      source_type: "s3",
      youtube_video_id: "",
      duration: 600,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
    };
    const currentVideo = {
      ...initialVideo,
      source_type: "youtube",
      youtube_video_id: "VnqgmOJaMGc",
      access_mode: "PROCTORED_CLASS",
    };
    const initialPlayback = {
      video: initialVideo,
      play_url: "https://cdn.hakwonplus.com/e2e/retry-inverse/expired/master.m3u8?sig=expired",
      playback_token: "initial-free-v1-token",
      playback_session_id: null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 600,
      policy_version: 1,
      policy: {
        access_mode: "FREE_REVIEW",
        monitoring_enabled: false,
        allow_seek: true,
        playback_rate: { max: 1, ui_control: true },
        source: { type: "hls", provider: "uploaded", youtube_video_id: "" },
      },
    };
    const currentPlayback = {
      video: currentVideo,
      play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
      playback_token: "current-proctored-v2-token",
      playback_session_id: "current-proctored-session-v2",
      playback_expires_at: Math.floor(Date.now() / 1000) + 600,
      policy_version: 2,
      policy: {
        access_mode: "PROCTORED_CLASS",
        monitoring_enabled: true,
        allow_seek: true,
        playback_rate: { max: 1, ui_control: true },
        source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
      },
    };

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
    }, { token: fakeJwt() });

    await page.route("https://cdn.hakwonplus.com/e2e/retry-inverse/expired/**", async (route) => {
      await initialAccessReady;
      expiredCdnRequests += 1;
      await route.fulfill({
        status: 403,
        headers: { "access-control-allow-origin": "*" },
        contentType: "text/plain",
        body: "expired playback authorization",
      });
    });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          accessChecks += 1;
          if (accessChecks === 1) {
            resolveInitialAccess();
            return json({
              ok: true,
              access_mode: "FREE_REVIEW",
              monitoring_enabled: false,
              policy_version: 1,
            });
          }
          await currentAccessGate;
          return json({
            ok: true,
            access_mode: "PROCTORED_CLASS",
            monitoring_enabled: true,
            policy_version: 2,
          });
        }
        playbackRequests += 1;
        return json(playbackRequests === 1 ? initialPlayback : currentPlayback);
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [initialVideo] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByText("영상 서비스에서 재생 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeVisible();
    await expect.poll(() => ({ playbackRequests, accessChecks, expiredCdnRequests })).toEqual({
      playbackRequests: 1,
      accessChecks: 1,
      expiredCdnRequests: 1,
    });

    const currentPlaybackResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") !== "1"
        && response.status() === 200;
    });
    const currentAccessResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 200;
    });
    await page.getByRole("button", { name: "다시 시도" }).click();
    await currentPlaybackResponse;
    await expect.poll(() => ({ playbackRequests, accessChecks })).toEqual({
      playbackRequests: 2,
      accessChecks: 2,
    });
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 500)));
    expect(playbackRequests).toBe(2);
    expect(expiredCdnRequests).toBe(1);
    await expect(page.getByText("재시도 정책 전환 영상")).toHaveCount(0);

    releaseCurrentAccess();
    await currentAccessResponse;
    await expect(page.getByRole("heading", { name: "재시도 정책 전환 영상" })).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 500)));
    expect({ playbackRequests, accessChecks, expiredCdnRequests }).toEqual({
      playbackRequests: 2,
      accessChecks: 2,
      expiredCdnRequests: 1,
    });
    expect(unexpectedYouTubeRequests, "Route-mock playback must not depend on the live YouTube SDK").toEqual([]);
    await expect.poll(async () => (await youtube.snapshot()).players.filter((player) => player.ready && !player.destroyed).length).toBe(1);
    await expect(page.getByText("재생 화면을 준비하고 있어요…")).toHaveCount(0);
  });

  test("YouTube SDK fixture는 비동기 ready·재생·일시정지와 오류 후 재시도를 전달한다", async ({ page }) => {
    const unexpectedYouTubeRequests = await guardUnmockedYouTubeRequests(page);
    const youtube = await installYouTubeSdkFixture(page);
    const requests = await installStudentYoutubeScenario(page);
    await openStudentYoutubeScenario(page, BASE);
    await assertYoutubeReadyPlayPause(page);
    const first = await youtube.snapshot();
    expect(first.sdkReady).toBe(1);
    expect(first.players).toHaveLength(1);
    expect(first.players[0].calls).toEqual(expect.arrayContaining(["onReady", "playVideo", "pauseVideo"]));

    await youtube.emitError(150);
    await expect(page.getByText("YouTube에서 이 영상의 퍼가기를 허용하지 않았습니다.", { exact: true })).toBeVisible();
    await expect.poll(async () => (await youtube.snapshot()).players[0].destroyed).toBe(true);
    const beforeRetry = requests.filter(({ path }) => path.endsWith("/562/playback/")).length;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect.poll(async () => (await youtube.snapshot()).players.filter((player) => player.ready && !player.destroyed).length).toBe(1);
    await assertYoutubeReadyPlayPause(page);
    const retried = await youtube.snapshot();
    expect(retried.sdkReady).toBe(1);
    expect(retried.players).toHaveLength(2);
    expect(retried.players[0].calls).toContain("onError:150");
    expect(retried.players[1].calls).toEqual(expect.arrayContaining(["onReady", "playVideo", "pauseVideo"]));
    expect(requests.filter(({ path }) => path.endsWith("/562/playback/")).length).toBeGreaterThan(beforeRetry);
    expect(unexpectedYouTubeRequests).toEqual([]);
  });

  test("같은 영상 정책 재부트스트랩 성공은 후속 403을 되돌리지 않는다", async ({ page }) => {
    let playbackRequests = 0;
    let accessChecks = 0;
    let releasePolicyDrift!: () => void;
    let releaseHeldBootstrap!: () => void;
    const policyDriftGate = new Promise<void>((resolve) => {
      releasePolicyDrift = resolve;
    });
    const heldBootstrapGate = new Promise<void>((resolve) => {
      releaseHeldBootstrap = resolve;
    });
    const video = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "후속 권한 종료 정책 전환 영상",
      status: "READY",
      source_type: "youtube",
      youtube_video_id: "VnqgmOJaMGc",
      duration: 600,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
    };
    const playback = (proctored: boolean) => ({
      video: {
        ...video,
        access_mode: proctored ? "PROCTORED_CLASS" : "FREE_REVIEW",
      },
      play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
      playback_token: proctored ? "held-proctored-v2-token" : "initial-free-v1-token",
      playback_session_id: proctored ? "held-proctored-session-v2" : null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 600,
      policy_version: proctored ? 2 : 1,
      policy: {
        access_mode: proctored ? "PROCTORED_CLASS" : "FREE_REVIEW",
        monitoring_enabled: proctored,
        allow_seek: true,
        playback_rate: { max: 1, ui_control: true },
        source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
      },
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
      class StableYoutubePlayer {
        destroy() {}
      }
      Object.defineProperty(window, "YT", {
        configurable: true,
        value: { Player: StableYoutubePlayer },
      });
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          accessChecks += 1;
          if (accessChecks === 1) {
            await policyDriftGate;
            return json({
              ok: true,
              access_mode: "PROCTORED_CLASS",
              monitoring_enabled: true,
              policy_version: 2,
            });
          }
          return json({ detail: "강의가 종료되어 시청할 수 없습니다." }, 403);
        }
        playbackRequests += 1;
        const proctored = playbackRequests > 1;
        if (proctored) await heldBootstrapGate;
        return json(playback(proctored));
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [video] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByRole("heading", { name: "후속 권한 종료 정책 전환 영상" })).toBeVisible();

    releasePolicyDrift();
    await expect.poll(() => ({ playbackRequests, accessChecks })).toEqual({
      playbackRequests: 2,
      accessChecks: 1,
    });

    const denialResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 403;
    });
    await cycleDocumentVisibility(page);
    await denialResponse;
    await expect(page.getByText("강의가 종료되어 시청할 수 없습니다.")).toBeVisible();
    const deniedCounts = { playbackRequests, accessChecks };

    const heldBootstrapResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") !== "1"
        && response.status() === 200;
    });
    releaseHeldBootstrap();
    await heldBootstrapResponse;
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 500)));

    await expect(page.getByText("강의가 종료되어 시청할 수 없습니다.")).toBeVisible();
    await expect(page.getByText("후속 권한 종료 정책 전환 영상")).toHaveCount(0);
    expect({ playbackRequests, accessChecks }).toEqual(deniedCounts);
  });

  test("같은 영상 paired 수동 재시도 성공은 후속 403을 되돌리지 않는다", async ({ page }) => {
    let playbackRequests = 0;
    let accessChecks = 0;
    let releaseHeldPlayback!: () => void;
    const heldPlaybackGate = new Promise<void>((resolve) => {
      releaseHeldPlayback = resolve;
    });
    const video = {
      id: 562,
      session_id: 394,
      enrollment_id: 1304,
      title: "후속 권한 종료 수동 재시도 영상",
      status: "READY",
      source_type: "youtube",
      youtube_video_id: "VnqgmOJaMGc",
      duration: 600,
      progress: 0,
      completed: false,
      last_position: 0,
      allow_skip: true,
      max_speed: 1,
      show_watermark: false,
      access_mode: "FREE_REVIEW",
    };
    const validPlayback = {
      video,
      play_url: "https://www.youtube-nocookie.com/embed/VnqgmOJaMGc",
      playback_token: "held-free-v1-token",
      playback_session_id: null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 600,
      policy_version: 1,
      policy: {
        access_mode: "FREE_REVIEW",
        monitoring_enabled: false,
        allow_seek: true,
        playback_rate: { max: 1, ui_control: true },
        source: { type: "youtube", provider: "youtube", youtube_video_id: "VnqgmOJaMGc" },
      },
    };

    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", token);
      localStorage.setItem("tenant_code", "limglish");
      sessionStorage.setItem("tenantCode", "limglish");
      class StableYoutubePlayer {
        destroy() {}
      }
      Object.defineProperty(window, "YT", {
        configurable: true,
        value: { Player: StableYoutubePlayer },
      });
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });

      if (path === "/core/program/") {
        return json({
          tenantCode: "limglish",
          display_name: "임근혁 영어",
          ui_config: {},
          feature_flags: {},
          is_active: true,
        });
      }
      if (path === "/core/me/") {
        return json({
          id: 1772,
          username: "student",
          name: "학생",
          is_staff: false,
          is_superuser: false,
          tenantRole: "student",
          must_change_password: false,
        });
      }
      if (path === "/student/video/videos/562/playback/") {
        if (url.searchParams.get("access_check") === "1") {
          accessChecks += 1;
          if (accessChecks <= 2) {
            return json({
              ok: true,
              access_mode: "FREE_REVIEW",
              monitoring_enabled: false,
              policy_version: 1,
            });
          }
          return json({ detail: "수강 권한이 종료되어 시청할 수 없습니다." }, 403);
        }
        playbackRequests += 1;
        if (playbackRequests === 1) {
          return json({
            video: { title: "초기 재생 정보 오류" },
            play_url: "",
            policy_version: 1,
            policy: {
              access_mode: "FREE_REVIEW",
              monitoring_enabled: false,
            },
          });
        }
        await heldPlaybackGate;
        return json(validPlayback);
      }
      if (path === "/student/video/sessions/394/videos/") {
        return json({ items: [video] });
      }
      if (path === "/student/video/videos/562/comments/") {
        return json({ count: 0, results: [] });
      }
      return json({});
    });

    await page.goto(
      `${BASE}/student/video/play?video=562&enrollment=1304&session=394`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await expect(page.getByText("재생 정보 형식이 올바르지 않습니다.")).toBeVisible();
    await expect.poll(() => ({ playbackRequests, accessChecks })).toEqual({
      playbackRequests: 1,
      accessChecks: 1,
    });

    const pairedAccessResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 200;
    });
    await page.getByRole("button", { name: "다시 시도" }).click();
    await pairedAccessResponse;
    await expect.poll(() => ({ playbackRequests, accessChecks })).toEqual({
      playbackRequests: 2,
      accessChecks: 2,
    });

    const denialResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") === "1"
        && response.status() === 403;
    });
    await cycleDocumentVisibility(page);
    await denialResponse;
    await expect(page.getByText("수강 권한이 종료되어 시청할 수 없습니다.")).toBeVisible();
    const deniedCounts = { playbackRequests, accessChecks };

    const heldPlaybackResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/student/video/videos/562/playback/")
        && url.searchParams.get("access_check") !== "1"
        && response.status() === 200;
    });
    releaseHeldPlayback();
    await heldPlaybackResponse;
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 500)));

    await expect(page.getByText("수강 권한이 종료되어 시청할 수 없습니다.")).toBeVisible();
    await expect(page.getByText("후속 권한 종료 수동 재시도 영상")).toHaveCount(0);
    expect({ playbackRequests, accessChecks }).toEqual(deniedCounts);
  });
});
