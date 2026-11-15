import { verifyFullscreenControls, verifyMonitoredHlsGestures } from "../helpers/monitoredHlsGestures";
import type { VideoCommentItem } from "../../src/app_student/domains/video/api/video.api";
import type { Page } from "@playwright/test";
import { syntheticLongVideoAsset } from "../../scripts/run-development-release-canary.mjs";
import { proxyReviewMedia } from "../../functions/review-media/[[path]]";
import { expect, test } from "../fixtures/strictTest";
import { guardUnmockedYouTubeRequests, installYouTubeSdkFixture } from "../helpers/youtubeSdkFixture";
import { installStudentYoutubeScenario, YOUTUBE_QA_VIDEO_ID } from "../helpers/studentYoutubeScenario";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const FIRST_TITLE = "통합과학 1강 · 원리를 연결하는 아주 긴 제목의 복습 영상";
const SECOND_TITLE = "통합과학 2강 · 적용 문제 해설";

type NativeRecoveryFixture = {
  controller: import("../../src/app_student/domains/video/playback/player/headless/StudentHlsController").StudentHlsController;
  video: HTMLVideoElement;
  fatals: string[];
  saved: Array<{ last_position?: number }>;
};
declare global { interface Window { __nativeRecoveryFixture: NativeRecoveryFixture } }

async function openNativeRecoveryFixture(page: Page, options: { review?: boolean; unsupported?: boolean; disposeImmediately?: boolean; stall?: boolean; knownDuration?: boolean; autoplayBlocked?: boolean } = {}) {
  let segments = 0;
  await page.route("**/__qa__/native-recovery", (route) => route.fulfill({
    contentType: "text/html", body: '<!doctype html><html><body><video muted playsinline controls></video></body></html>',
  }));
  await page.route("**/__qa__/video-long/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(".m4s")) segments++;
    const asset = syntheticLongVideoAsset(path);
    return route.fulfill({ body: asset.body, contentType: asset.contentType });
  });
  await page.goto(`${BASE}/__qa__/native-recovery`);
  await page.evaluate(async ({ base, options, token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("tenant_code", "limglish");
    sessionStorage.setItem("tenantCode", "limglish");
    if (options.unsupported) {
      Object.defineProperty(window, "MediaSource", { configurable: true, value: undefined });
      Object.defineProperty(window, "ManagedMediaSource", { configurable: true, value: undefined });
    }
    const { StudentHlsController } = await import("/src/app_student/domains/video/playback/player/headless/StudentHlsController.ts");
    const video = document.querySelector("video")!;
    // Inject a native decoder failure; the replacement MSE pipeline below is real.
    const canPlayType = video.canPlayType.bind(video);
    video.canPlayType = (type) => type.includes("mpegurl") || type.includes("mpegURL") ? "probably" : canPlayType(type);
    const fatals: string[] = [];
    const saved: Array<{ last_position?: number }> = [];
    const controller = new StudentHlsController({
      videoId: 562, enrollmentId: 1304, playUrl: `${base}/__qa__/video-long/master.m3u8`,
      token: "synthetic-native-recovery", initialPosition: 42,
      reviewStream: options.review ? "synthetic-review-stream" : undefined,
      policy: { access_mode: "FREE_REVIEW", monitoring_enabled: false, allow_seek: true,
        playback_rate: { max: 2, ui_control: true } },
      onFatal: (message) => fatals.push(message), onLeaveProgress: (value) => saved.push(value),
    });
    window.__nativeRecoveryFixture = { controller, video, fatals, saved };
    await controller.attach(video);
    if (options.knownDuration) {
      Object.defineProperty(video, "duration", { configurable: true, get: () => 600 });
      video.dispatchEvent(new Event("loadedmetadata"));
      Reflect.deleteProperty(video, "duration");
    }
    video.playbackRate = 1.5;
    video.volume = 0.4;
    if (options.autoplayBlocked) {
      const ignoreNativeError = (event: Event) => event.stopImmediatePropagation();
      video.addEventListener("error", ignoreNativeError, true);
      video.play = () => Promise.reject(new DOMException("Synthetic autoplay denial", "NotAllowedError"));
      controller.play();
      await new Promise<void>((resolve, reject) => {
        const deadline = window.setTimeout(() => { clearInterval(poll); reject(new Error("Autoplay denial was not handled")); }, 5000);
        const poll = window.setInterval(() => {
          if (!controller.getState().toast?.text.includes("재생 준비가 끝났어요")) return;
          clearInterval(poll); clearTimeout(deadline); resolve();
        }, 10);
      });
      Reflect.deleteProperty(video, "play");
      video.removeEventListener("error", ignoreNativeError, true);
    }
    if (options.stall) {
      // Freeze only the failed native engine's observations; replacement media plays normally.
      Object.defineProperty(video, "error", { configurable: true, get: () => null });
      Object.defineProperty(video, "currentTime", { configurable: true, get: () => 42, set: () => {} });
      Object.defineProperty(video, "paused", { configurable: true, get: () => false });
      const sourceChanged = new MutationObserver(() => {
        if (!video.getAttribute("src")?.startsWith("blob:")) return;
        for (const key of ["error", "currentTime", "paused"]) Reflect.deleteProperty(video, key);
        sourceChanged.disconnect();
      });
      sourceChanged.observe(video, { attributes: true, attributeFilter: ["src"] });
      video.dispatchEvent(new Event("play"));
    } else {
      if (!options.review) void video.play().catch(() => {});
      Object.defineProperty(video, "error", { configurable: true, get: () => ({ code: 3, message: "Synthetic native decoder failure" }) });
      video.dispatchEvent(new Event("error"));
      delete (video as unknown as { error?: unknown }).error;
    }
    if (options.disposeImmediately) controller.dispose();
  }, { base: BASE, options, token: `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "limglish", user_id: 1772 })).toString("base64url")}.sig` });
  return { segments: () => segments };
}

test.describe("native HLS engine recovery", () => {
  test.skip(!["127.0.0.1", "localhost"].includes(new URL(BASE).hostname), "Local synthetic media only");
  test.use({ serviceWorkers: "block" });
  for (const width of [390, 1366]) {
    test(`native decode failure resumes real MSE playback at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openNativeRecoveryFixture(page);
      const video = page.locator("video");
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 20_000 }).toBeGreaterThan(43);
      const state = await page.evaluate(() => {
        const { controller, video, fatals, saved } = window.__nativeRecoveryFixture;
        const before = { src: video.src, position: video.currentTime, rate: video.playbackRate, volume: video.volume,
          muted: video.muted, connected: video.isConnected, reconnecting: controller.getState().reconnecting };
        controller.dispose();
        return { before, fatals, saved, detached: !video.getAttribute("src") };
      });
      expect(state.before.src).toMatch(/^blob:/);
      expect(state.before.rate).toBe(1.5);
      expect(state.before.volume).toBeCloseTo(0.4);
      expect(state.before.muted).toBe(true);
      expect(state.before.connected).toBe(true);
      expect(state.before.reconnecting).toBe(false);
      expect(state.fatals).toEqual([]);
      expect(state.saved.at(-1)?.last_position).toBeGreaterThanOrEqual(43);
      expect(state.detached).toBe(true);
    });
  }
  for (const allowed of [true, false]) {
    test(`native recovery preserves review preparation ${allowed ? "approval" : "denial"}`, async ({ page }) => {
      const preparations: number[] = [];
      await page.route("**/api/v1/student/video/videos/562/review-watch/", (route) => {
        const body = route.request().postDataJSON();
        if (body.prepare) preparations.push(body.position_ms);
        return route.fulfill({ status: allowed ? 200 : 403, json: allowed
          ? { stream: "synthetic-review-stream", remaining_ms: 100_000, used_ms: 0 }
          : { detail: "수강 권한이 종료되었습니다." } });
      });
      const fixture = await openNativeRecoveryFixture(page, { review: true });
      await expect.poll(() => page.locator("video").getAttribute("src")).toMatch(/^blob:/);
      expect(fixture.segments()).toBe(0);
      await page.evaluate(() => window.__nativeRecoveryFixture.controller.play());
      await expect.poll(() => preparations.length).toBe(1);
      expect(preparations[0]).toBe(42_000);
      if (allowed) {
        await expect.poll(() => page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 20_000 }).toBeGreaterThan(43);
        expect(fixture.segments()).toBeGreaterThan(0);
        expect(await page.evaluate(() => window.__nativeRecoveryFixture.fatals)).toEqual([]);
      } else {
        await expect.poll(() => page.evaluate(() => window.__nativeRecoveryFixture.fatals.length)).toBe(1);
        expect(fixture.segments()).toBe(0);
      }
      await page.evaluate(() => window.__nativeRecoveryFixture.controller.dispose());
    });
  }
  test("persistent native stall tries the alternate engine once and resumes", async ({ page }) => {
    await openNativeRecoveryFixture(page, { stall: true });
    await expect.poll(() => page.locator("video").getAttribute("src"), { timeout: 35_000 }).toMatch(/^blob:/);
    await page.evaluate(() => {
      const { video } = window.__nativeRecoveryFixture;
      for (const key of ["error", "currentTime", "paused"]) Reflect.deleteProperty(video, key);
    });
    await expect.poll(() => page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 15_000 }).toBeGreaterThan(43);
    expect(await page.evaluate(() => window.__nativeRecoveryFixture.fatals)).toEqual([]);
    await page.evaluate(() => window.__nativeRecoveryFixture.controller.dispose());
  });
  for (const allowed of [true, false]) {
    test(`grant renewal waits for pending native recovery preparation ${allowed ? "approval" : "denial"}`, async ({ page }) => {
      let preparations = 0;
      let release!: () => void;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/api/v1/student/video/videos/562/review-watch/", async (route) => {
        preparations++;
        await pending;
        await route.fulfill({ status: allowed ? 200 : 403, json: allowed
          ? { stream: "synthetic-review-stream", remaining_ms: 100_000, used_ms: 0 }
          : { detail: "수강 권한이 종료되었습니다." } });
      });
      const fixture = await openNativeRecoveryFixture(page, { review: true });
      try {
        await expect.poll(() => page.locator("video").getAttribute("src")).toMatch(/^blob:/);
        await page.evaluate(() => window.__nativeRecoveryFixture.controller.play());
        await expect.poll(() => preparations).toBe(1);
        await page.evaluate((base) => window.__nativeRecoveryFixture.controller.setSource(`${base}/__qa__/video-long/master.m3u8?grant=renewed`), BASE);
        await page.evaluate(() => new Promise((resolve) => window.setTimeout(resolve, 500)));
        expect(fixture.segments()).toBe(0);
        release();
        if (allowed) {
          await expect.poll(() => page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 20_000 }).toBeGreaterThan(43);
        } else {
          await expect.poll(() => page.evaluate(() => window.__nativeRecoveryFixture.fatals.length)).toBe(1);
          expect(fixture.segments()).toBe(0);
        }
      } finally {
        release();
        await page.evaluate(() => window.__nativeRecoveryFixture.controller.dispose());
      }
    });
  }
  for (const renew of [false, true]) {
    test(`seek during pending native recovery resumes the latest authorized position${renew ? " after renewal" : ""}`, async ({ page }) => {
      const preparations: number[] = [];
      let release!: () => void;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/api/v1/student/video/videos/562/review-watch/", async (route) => {
        preparations.push(route.request().postDataJSON().position_ms);
        await pending;
        await route.fulfill({ json: { stream: "synthetic-review-stream", remaining_ms: 100_000, used_ms: 0 } });
      });
      const fixture = await openNativeRecoveryFixture(page, { review: true, knownDuration: true });
      try {
        await expect.poll(() => page.locator("video").getAttribute("src")).toMatch(/^blob:/);
        await page.evaluate(() => window.__nativeRecoveryFixture.controller.play());
        await expect.poll(() => preparations.length).toBe(1);
        await page.evaluate(({ base, renew }) => {
          const { controller } = window.__nativeRecoveryFixture;
          controller.seek(75);
          if (renew) controller.setSource(`${base}/__qa__/video-long/master.m3u8?grant=renewed`);
        }, { base: BASE, renew });
        expect(fixture.segments()).toBe(0);
        release();
        await expect.poll(() => preparations.at(-1)).toBe(75_000);
        await expect.poll(() => page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 20_000 }).toBeGreaterThan(76);
        expect(await page.evaluate(() => window.__nativeRecoveryFixture.fatals)).toEqual([]);
      } finally {
        release();
        await page.evaluate(() => window.__nativeRecoveryFixture.controller.dispose());
      }
    });
  }
  test("a native autoplay denial cannot skip preparation for the replacement engine", async ({ page }) => {
    let preparations = 0;
    await page.route("**/api/v1/student/video/videos/562/review-watch/", route => {
      preparations++;
      return route.fulfill({ json: { stream: "synthetic-review-stream", remaining_ms: 100_000, used_ms: 0 } });
    });
    const fixture = await openNativeRecoveryFixture(page, { review: true, autoplayBlocked: true });
    await expect.poll(() => page.locator("video").getAttribute("src")).toMatch(/^blob:/);
    expect(preparations).toBe(1);
    await page.evaluate(() => window.__nativeRecoveryFixture.controller.play());
    await expect.poll(() => preparations).toBe(2);
    await expect.poll(() => page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 20_000 }).toBeGreaterThan(43);
    expect(fixture.segments()).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__nativeRecoveryFixture.fatals)).toEqual([]);
    await page.evaluate(() => window.__nativeRecoveryFixture.controller.dispose());
  });
  test("unsupported alternate engine retains visible fatal recovery", async ({ page }) => {
    await openNativeRecoveryFixture(page, { unsupported: true });
    await expect.poll(() => page.evaluate(() => window.__nativeRecoveryFixture.fatals)).toEqual(["비디오 디코딩 오류가 발생했습니다."]);
    expect(await page.locator("video").getAttribute("src")).toBeNull();
  });
  for (const width of [390, 1366]) {
    test(`paused native recovery exposes a working primary play button at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(() => {
        const canPlayType = HTMLMediaElement.prototype.canPlayType;
        HTMLMediaElement.prototype.canPlayType = function (type) {
          return type.includes("mpegurl") || type.includes("mpegURL") ? "probably" : canPlayType.call(this, type);
        };
      });
      const { state, videos } = await installWatchScenario(page);
      state.reviewRemaining = 100_000;
      videos[0].last_position = 42;
      await page.route("**/review-media/**", route => {
        const file = new URL(route.request().url()).pathname.split("/").pop();
        if (file !== "master.m3u8") expect(state.prepared).toBe(true);
        const asset = syntheticLongVideoAsset(`/__qa__/video-long/${file}`);
        return route.fulfill({ body: asset.body, contentType: asset.contentType });
      });
      await openWatch(page);
      const video = page.locator("video.svpVideo");
      await video.evaluate((element: HTMLVideoElement) => {
        Object.defineProperty(element, "error", { configurable: true, get: () => ({ code: 3, message: "Synthetic native decode failure" }) });
        element.dispatchEvent(new Event("error"));
        Reflect.deleteProperty(element, "error");
      });
      await expect.poll(() => video.getAttribute("src")).toMatch(/^blob:/);
      expect(state.prepared).toBe(false);
      await expect(page.getByText("연결을 다시 시도하고 있어요…")).toHaveCount(0);
      await page.locator("button.svpBigPlay").click();
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 20_000 }).toBeGreaterThan(43);
      await expect.poll(() => state.playingSignal).toBe(true);
      expect(state.prepared).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
  test("leaving during native recovery never attaches a late engine", async ({ page }) => {
    const fixture = await openNativeRecoveryFixture(page, { disposeImmediately: true });
    await page.evaluate(() => new Promise((resolve) => window.setTimeout(resolve, 200)));
    expect(await page.locator("video").getAttribute("src")).toBeNull();
    expect(fixture.segments()).toBe(0);
    expect(await page.evaluate(() => window.__nativeRecoveryFixture.fatals)).toEqual([]);
  });
});

async function installWatchScenario(page: Page, completed = false) {
  const vendorRequests = await guardUnmockedYouTubeRequests(page);
  const youtube = await installYouTubeSdkFixture(page);
  await installStudentYoutubeScenario(page);
  const state = { reviewRemaining: null as number | null, prepared: false, prepareRetry: false, playingSignal: false,
    commentsFail: false, playlistFail: false, likeFail: false, liked: false,
    losePlayingAck: false, lostSequence: 0, recoveredSequence: 0, includeSummary: false, supportPreview: false,
    comments: [{ id: 701, content: "수업에서 이해한 개념을 다시 확인했습니다.", author_type: "student",
      author_name: "합성 학생", author_photo_url: null, is_edited: false, is_deleted: false,
      is_mine: true, created_at: "2026-10-01T03:00:00Z", reply_count: 0, replies: [] }] as VideoCommentItem[],
    progress: [] as Array<{ videoId: number; body: Record<string, unknown> }>,
  };
  const videos = [562, 563].map((id) => ({ id, session_id: 394, enrollment_id: 1304,
    title: id === 562 ? FIRST_TITLE : SECOND_TITLE, status: "READY", source_type: "youtube",
    youtube_video_id: YOUTUBE_QA_VIDEO_ID, duration: 600, progress: completed && id === 562 ? 100 : 0,
    completed: completed && id === 562, last_position: completed && id === 562 ? 30 : 0,
    allow_skip: true, max_speed: 2, show_watermark: false, access_mode: "FREE_REVIEW",
  }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });
    const reviewSummary = state.includeSummary && state.reviewRemaining !== null ? {
      review_watch_summary: { enabled: true, applicable: true, used_ms: 14000 - state.reviewRemaining,
        limit_ms: 14000, remaining_ms: state.reviewRemaining, exhausted: state.reviewRemaining === 0, revision: "review-limit" },
    } : {};
    // The mounted student shell needs a profile id and valid empty lists to
    // finish notification loading; a generic {} schedules a retry across reload.
    if (request.method() === "GET") {
      if (path === "/student/me/") return json({ id: 1772, name: "합성 학생", profile_photo_url: null });
      if (path === "/clinic/participants/" || path === "/community/posts/") {
        return json({ count: 0, next: null, previous: null, results: [] });
      }
      if (path === "/student/grades/") {
        return json({ exams: [], session_totals: [], homeworks: [], exam_trend: [] });
      }
    }
    if (path === "/student/video/sessions/394/videos/") {
      return state.playlistFail ? json({ detail: "합성 목록 조회 실패" }, 503) : json({
        session: { id: 394, title: "개념과 적용", order: 1 }, items: videos,
      });
    }
    if (path === "/student/video/videos/562/review-watch/" && state.reviewRemaining !== null) {
      if (request.postDataJSON().prepare && state.prepareRetry) {
        state.prepareRetry = false;
        return json({ stream: "test-review", used_ms: 0, remaining_ms: state.reviewRemaining, retry_after_ms: 600 });
      }
      if (request.postDataJSON().prepare) state.prepared = true;
      if (request.postDataJSON().playing) {
        if (state.losePlayingAck) {
          state.losePlayingAck = false;
          state.lostSequence = request.postDataJSON().sequence;
          return json({ detail: "일시적인 연결 오류" }, 503);
        }
        if (!state.playingSignal) state.recoveredSequence = request.postDataJSON().sequence;
        state.playingSignal = true;
      }
      return json({ stream: "test-review", used_ms: 14000 - state.reviewRemaining, remaining_ms: state.reviewRemaining, ...reviewSummary });
    }
    const playback = path.match(/^\/student\/video\/videos\/(562|563)\/playback\/$/);
    if (playback) {
      if (url.searchParams.get("access_check") === "1") return json({
        ok: true, access_mode: "FREE_REVIEW", monitoring_enabled: false, policy_version: 1,
      });
      if (state.reviewRemaining === 0) return json({ detail: "이 영상의 복습 시청시간을 모두 사용했습니다.", ...reviewSummary }, 403);
      const video = videos.find((item) => item.id === Number(playback[1]))!;
      const hosted = state.reviewRemaining !== null;
      return json({ video: { ...video, ...(hosted ? { source_type: "s3", youtube_video_id: null } : {}), is_liked: state.liked, like_count: state.liked ? 1 : 0,
        comment_count: state.comments.length, view_count: 12 },
        ...reviewSummary,
        ...(state.supportPreview ? { support_preview: true, progress_revision: null } : {}),
        review_watch: state.reviewRemaining === null ? null : { stream: "test-review", used_ms: 0, remaining_ms: state.reviewRemaining },
        play_url: hosted ? "/api/v1/media/review-stream/11111111-1111-4111-8111-111111111111/master.m3u8?tenant=godmin" : `https://www.youtube.com/embed/${YOUTUBE_QA_VIDEO_ID}`,
        playback_token: `synthetic-watch-${video.id}`, playback_session_id: null,
        playback_expires_at: Math.floor(Date.now() / 1000) + 900, policy_version: 1,
        policy: { access_mode: "FREE_REVIEW", monitoring_enabled: false, allow_seek: true,
          playback_rate: { max: 2, ui_control: true },
          source: hosted ? { type: "s3", provider: "uploaded" } : { type: "youtube", provider: "youtube", youtube_video_id: YOUTUBE_QA_VIDEO_ID } },
      });
    }
    if (/^\/student\/video\/videos\/(562|563)\/comments\/$/.test(path)) {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        const comment = { ...state.comments[0], id: 702 + state.comments.length, content: body.content };
        state.comments.push(comment);
        return json(comment, 201);
      }
      return state.commentsFail ? json({ detail: "합성 댓글 조회 실패" }, 503)
        : json({ comments: state.comments, total: state.comments.length });
    }
    if (/^\/student\/video\/videos\/(562|563)\/like\/$/.test(path)) {
      if (state.likeFail) return json({ detail: "합성 좋아요 저장 실패" }, 503);
      state.liked = !state.liked;
      return json({ liked: state.liked, like_count: state.liked ? 1 : 0 });
    }
    const progress = path.match(/^\/student\/video\/videos\/(562|563)\/progress\/$/);
    if (progress) {
      const body = request.postDataJSON();
      state.progress.push({ videoId: Number(progress[1]), body });
      return json({ id: 1, video_id: Number(progress[1]), enrollment_id: 1304, ...body,
        progress_percent: body.progress });
    }
    return route.fallback();
  });
  return { state, youtube, vendorRequests, videos };
}

test("support preview resume positions stay separate from the student and other support sessions", async ({ page }) => {
  await installWatchScenario(page);
  await page.goto(`${BASE}/student/video/sessions/394?enrollment=1304`);
  await expect(page.getByRole("link").filter({ hasText: FIRST_TITLE })).toBeVisible();
  const positions = await page.evaluate(async () => {
    const storage = await import("/src/app_student/domains/video/utils/videoPlaybackStorage.ts");
    const student = { userId: 1772, enrollmentId: 1304 };
    const preview = { ...student, supportSessionId: "support-a" };
    const secondPreview = { ...student, supportSessionId: "support-b" };
    storage.storeVideoPosition(562, 10, student, "revision-a");
    storage.storeVideoPosition(562, 45, preview, "revision-a");
    storage.storeVideoPosition(562, 80, secondPreview, "revision-a");
    return {
      student: storage.getVideoResumePosition(562, student, 0, "revision-a", false),
      preview: storage.getVideoResumePosition(562, preview, 0, "revision-a", false),
      secondPreview: storage.getVideoResumePosition(562, secondPreview, 0, "revision-a", false),
      resetStudent: storage.getVideoResumePosition(562, student, 0, "reset-revision", false),
      currentKeys: [student, preview, secondPreview].map(scope => storage.getStudentCurrentVideoStorageKey(scope)),
    };
  });
  expect(positions).toMatchObject({ student: 10, preview: 45, secondPreview: 80, resetStudent: 0 });
  expect(new Set(positions.currentKeys).size).toBe(3);
});

test("support playback keeps preview position locally without posting student progress", async ({ page }) => {
  const { state, youtube } = await installWatchScenario(page);
  state.supportPreview = true;
  await page.addInitScript(() => {
    const access = `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "limglish", user_id: 1772 }))}.sig`;
    sessionStorage.setItem("hplus_student_support_mode", "active");
    sessionStorage.setItem("hplus_student_support_access", access);
    sessionStorage.setItem("hplus_student_support_info", JSON.stringify({ studentId: 1772, studentName: "합성 학생", sessionId: "preview-only", expiresAt: new Date(Date.now() + 900000).toISOString() }));
  });
  await openWatch(page);
  await expect(page.getByText(/학생 기록·시청시간에 반영되지 않음/)).toBeVisible();
  await expect.poll(async () => (await youtube.snapshot()).players.some(player => player.ready)).toBe(true);
  await youtube.play();
  await expect.poll(async () => (await youtube.snapshot()).players.at(-1)?.current ?? 0).toBeGreaterThan(1);
  await page.evaluate(() => {
    const previous = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    if (previous) Object.defineProperty(document, "hidden", previous);
    else Reflect.deleteProperty(document, "hidden");
  });
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.includes("student-video-position:562:support:preview-only:")))).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: FIRST_TITLE })).toBeVisible();
  expect(state.progress).toHaveLength(0);
});

for (const width of [1366, 390]) {
  test(`video allowance is visible before playback and browsing creates no grants at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { videos } = await installWatchScenario(page);
    let grants = 0;
    page.on("request", request => { if (request.method() === "POST" && /\/videos\/\d+\/playback\/$/.test(new URL(request.url()).pathname)) grants++; });
    await page.route("**/api/v1/student/video/sessions/394/videos/**", route => route.fulfill({ json: { items: videos.map(video => ({ ...video,
      review_watch_summary: { enabled: true, applicable: true, used_ms: 60000, limit_ms: 840000, remaining_ms: 780000, exhausted: false, revision: "initial" },
    })) } }));
    await page.goto(`${BASE}/student/video/sessions/394?enrollment=1304`);
    const first = page.getByRole("link").filter({ hasText: FIRST_TITLE });
    await expect(first).toBeVisible();
    await expect(first).toContainText("13분 0초 남음");
    await expect(first.getByRole("progressbar", { name: "복습 시청시간 사용량" })).toHaveAttribute("max", "840000");
    await first.hover();
    await first.focus();
    await first.dispatchEvent("touchstart");
    // Allow React/query work from the pointer handlers to settle without issuing a grant.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(grants).toBe(0);
    await page.screenshot({ path: `test-results/video-allowance-list-${width}.png`, fullPage: true });
    await first.click();
    await expect(page.locator(".svpRoot")).toBeVisible();
    expect(grants).toBe(1);
  });

  test(`exhausted review displays usage and recovers after teacher allowance at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) await page.addInitScript(() => localStorage.setItem("hakwonplus:student-theme-mode", "dark"));
    await installWatchScenario(page);
    let extended = false;
    await page.route("**/api/v1/student/video/videos/562/playback/**", route => {
      if (route.request().method() !== "POST" || extended) return route.fallback();
      return route.fulfill({ status: 403, json: { code: "review_limit_exhausted", detail: "이 영상의 복습 시청시간을 모두 사용했습니다.",
        review_watch_summary: { enabled: true, applicable: true, used_ms: 840000, limit_ms: 840000, remaining_ms: 0, exhausted: true, revision: "exhausted" },
      } });
    });
    await page.goto(`${BASE}/student/video/play?video=562&enrollment=1304&session=394`);
    await expect(page.getByRole("heading", { name: "복습 시청시간을 모두 사용했어요" })).toBeVisible();
    await expect(page.getByRole("region", { name: "복습 시청시간", exact: true })).toContainText("사용 14분 0초 / 허용 14분 0초");
    await page.screenshot({ path: `test-results/video-allowance-exhausted-${width}.png`, fullPage: true });
    extended = true;
    await page.getByRole("button", { name: "한도 변경 확인", exact: true }).click();
    await expect(page.locator(".svpRoot")).toBeVisible();
    await expect(page.getByRole("heading", { name: "복습 시청시간을 모두 사용했어요" })).toHaveCount(0);
  });
}

for (const width of [1366, 390]) {
  test(`review allowance stops playback and remains exhausted after reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 840 });
    const { state } = await installWatchScenario(page);
    state.reviewRemaining = 14000;
    state.prepareRetry = true;
    state.losePlayingAck = true;
    state.includeSummary = width === 390;
    await page.route("**/review-media/**", async route => {
      const browserUrl = new URL(route.request().url());
      const fixtureRequest = new Request(`https://godmin.kr${browserUrl.pathname}${browserUrl.search}`);
      const response = await proxyReviewMedia(fixtureRequest, async input => {
        const target = new URL(String(input));
        const file = target.pathname.split("/").pop();
        const asset = syntheticLongVideoAsset(`/__qa__/video-long/${file}`);
        if (target.hostname === "api.hakwonplus.com") {
          const mac = "a".repeat(43);
          if (file === "master.m3u8") return new Response(asset.body.toString().replace("init.mp4", `init.mp4?tenant=godmin&part=init.${mac}`).replace("media.m4s", `media.m4s?tenant=godmin&part=0-900000.${mac}`));
          expect(target.searchParams.get("part")).toBe(`${file === "init.mp4" ? "init" : "0-900000"}.${mac}`);
          expect(state.prepared).toBe(true);
          return Response.redirect(`https://${"a".repeat(32)}.r2.cloudflarestorage.com/academy-development-artifacts/tenants/1/video/hls/562/${file}?X-Amz-Signature=synthetic`, 302);
        }
        return new Response(asset.body, {headers: { "Content-Type": asset.contentType }});
      });
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    });
    await openWatch(page);
    await expect(page.getByText(state.includeSummary ? "0분 14초 남음" : "남은 복습시간 0분 14초")).toBeVisible();
    await page.locator("button.svpBigPlay").click();
    await expect.poll(() => page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0);
    expect(state.prepared).toBe(true);
    await expect.poll(() => state.playingSignal).toBe(true);
    expect(state.lostSequence).toBeGreaterThan(0);
    expect(state.recoveredSequence).toBe(state.lostSequence);
    state.reviewRemaining = 0;
    const exhausted = page.getByText("이 영상의 복습 시청시간을 모두 사용했습니다.");
    await expect(exhausted).toBeVisible();
    if (state.includeSummary) {
      const summary = page.getByRole("region", { name: "복습 시청시간", exact: true });
      await expect(summary).toContainText("사용 0분 14초 / 허용 0분 14초");
      await expect(summary).toContainText("남은 시간 없음");
      await expect(summary.getByRole("progressbar")).toHaveAttribute("value", "14000");
    }
    await page.reload();
    await expect(exhausted).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "뒤로가기" })).toBeVisible();
  });
}

test("local allowance expiry requests confirmation instead of claiming a stale balance is exhausted", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.reviewRemaining = 1000; state.includeSummary = true;
  await page.route("**/review-media/**", route => {
    const file = new URL(route.request().url()).pathname.split("/").pop();
    const asset = syntheticLongVideoAsset(`/__qa__/video-long/${file}`);
    return route.fulfill({ body: asset.body, contentType: asset.contentType });
  });
  await openWatch(page);
  await page.locator("button.svpBigPlay").click();
  await expect.poll(() => state.playingSignal).toBe(true);
  await expect(page.getByText("남은 복습시간을 다시 확인해 주세요.")).toBeVisible();
  await expect(page.getByText("복습 시청시간을 모두 사용했어요")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "복습 시청시간", exact: true })).toHaveCount(0);
  state.reviewRemaining = 14000;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText("0분 14초 남음")).toBeVisible();
  await page.locator("button.svpBigPlay").click();
  await expect.poll(() => page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0);
});

for (const exhausted of [true, false]) {
  test(`review media denial shows the confirmed ${exhausted ? "exhausted" : "recoverable"} state`, async ({ page }) => {
    const { state } = await installWatchScenario(page);
    state.reviewRemaining = 14000;
    await page.route("**/review-media/**", route => {
      if (exhausted) state.reviewRemaining = 0;
      return route.fulfill({ status: 403 });
    });
    // Some engines load the manifest on attach, while native playback can wait for a gesture.
    const denied = page.waitForResponse(response => response.url().includes("/review-media/") && response.status() === 403);
    // Native engines can reach the expected denial before the normal player title renders.
    await page.goto(`${BASE}/student/video/play?video=562&enrollment=1304&session=394`);
    await Promise.race([denied, page.locator("button.svpBigPlay").click()]);
    await denied;
    if (exhausted) {
      await expect(page.getByText("이 영상의 복습 시청시간을 모두 사용했습니다.")).toBeVisible();
      await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toBeVisible();
      await expect(page.getByText("이 영상의 복습 시청시간을 모두 사용했습니다.")).toHaveCount(0);
    }
  });
}

test("review media rejects preview hosts and tenant mismatches before admission", async () => {
  const path = "/review-media/11111111-1111-4111-8111-111111111111/master.m3u8";
  let calls = 0;
  const upstream = async () => { calls++; return new Response("#EXTM3U"); };
  for (const origin of ["https://candidate.pages.dev", "https://unregistered.invalid", "http://localhost"]) {
    expect((await proxyReviewMedia(new Request(`${origin}${path}?tenant=godmin`), upstream)).status).toBe(404);
  }
  expect((await proxyReviewMedia(new Request(`https://godmin.kr${path}?tenant=another`), upstream)).status).toBe(404);
  expect(calls).toBe(0);
  expect((await proxyReviewMedia(new Request(`https://dev.hakwonplus.com${path}?tenant=hakwonplus`), upstream)).status).toBe(200);
  expect(calls).toBe(1);
});

async function openWatch(page: Page) {
  await page.goto(`${BASE}/student/video/play?video=562&enrollment=1304&session=394`);
  await expect(page.getByRole("heading", { name: FIRST_TITLE })).toBeVisible();
  await expect(page.getByText("재생 화면을 준비하고 있어요…")).toHaveCount(0);
}

test.use({ serviceWorkers: "block" });

test("course opens sessions before details and requests offscreen details only when needed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 });
  const { videos } = await installWatchScenario(page);
  const requested = new Set<number>();
  const sessions = Array.from({ length: 24 }, (_, index) => ({
    id: 394 + index, order: index + 1, title: `합성 차시 ${index + 1}`, date: null,
  }));
  let releaseFirst = () => {};
  const firstDetail = new Promise<void>((resolve) => { releaseFirst = resolve; });
  await page.route("**/api/v1/student/video/me/", (route) => route.fulfill({ json: {
    lectures: [{ id: 7101, title: "합성 영상 강의", enrollment_id: 1304, sessions,
      video_count: 24, total_duration: 14400 }],
  } }));
  await page.route("**/api/v1/student/video/sessions/*/videos/**", async (route) => {
    const url = new URL(route.request().url());
    const id = Number(url.pathname.split("/").at(-3));
    requested.add(id);
    expect(url.searchParams.get("enrollment")).toBe("1304");
    if (id === 394) await firstDetail;
    await route.fulfill({ json: { items: [{ ...videos[0], session_id: id }] } });
  });

  try {
    await page.goto(`${BASE}/student/video/courses/7101`);
    await expect(page.getByText("준비된 영상 24개")).toBeVisible();
    const first = page.getByRole("link", { name: /합성 차시 1 차시 보기/ });
    await expect(first).toHaveAttribute("href", "/student/video/sessions/394?enrollment=1304");
    await expect.poll(() => requested.has(394)).toBe(true);
    expect(requested.size).toBeLessThan(10);
    expect(requested.has(417)).toBe(false);
    const last = page.getByRole("link", { name: /합성 차시 24/ });
    await last.scrollIntoViewIfNeeded();
    await expect.poll(() => requested.has(417)).toBe(true);
    await expect(last).toContainText("시청 가능 1/1개");
    releaseFirst();
    await last.click();
    await expect(page).toHaveURL(/\/student\/video\/sessions\/417\?enrollment=1304$/);
    await expect(page.getByText(FIRST_TITLE, { exact: true })).toBeVisible();
  } finally {
    releaseFirst();
  }
});
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Closed local route-mock only");

for (const width of [1366, 390]) {
  test(`watch actions, comments and playlist remain discoverable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { vendorRequests } = await installWatchScenario(page);
    await openWatch(page);
    await expect(page.getByRole("button", { name: "좋아요", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "댓글", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(SECOND_TITLE) })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`watch-${width}.png`), fullPage: true });
    const like = page.getByRole("button", { name: "좋아요", exact: true });
    await expect(like).toHaveCSS("min-height", "44px");
    expect(await like.evaluate((button) => getComputedStyle(button).backgroundImage)).not.toBe("none");
    const next = page.getByRole("link", { name: "다음 항목", exact: true });
    expect(await next.evaluate((link) => {
      const style = getComputedStyle(link);
      return style.color !== style.backgroundColor && style.color !== "rgb(15, 23, 42)";
    })).toBe(true);
    await page.getByRole("button", { name: "재생목록 닫기", exact: true }).click();
    await expect(page.locator("#video-playlist")).toBeHidden();
    await expect(page.getByRole("link", { name: new RegExp(SECOND_TITLE) })).toHaveCount(0);
    await page.getByRole("button", { name: "재생목록 열기", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(SECOND_TITLE) })).toBeVisible();
    await page.getByRole("button", { name: "댓글 보기", exact: true }).click();
    await expect(page.locator("#video-comments")).toBeFocused();
    await expect(page.getByRole("heading", { name: "댓글", exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`comments-${width}.png`), fullPage: true });
    expect(vendorRequests).toEqual([]);
  });

  test(`next video returns to the session list at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installWatchScenario(page);
    await openWatch(page);
    await page.getByRole("link", { name: "다음 항목", exact: true }).click();
    await expect(page.getByRole("heading", { name: SECOND_TITLE })).toBeVisible();
    await page.getByRole("button", { name: "목록으로", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/student/video/sessions/394\\?enrollment=1304$"));
    await expect(page.getByRole("link", { name: new RegExp(FIRST_TITLE) })).toBeVisible();
  });
}

test("replaying a completed lesson does not auto-advance on background progress save", async ({ page }) => {
  const { state, youtube } = await installWatchScenario(page, true);
  await openWatch(page);
  await expect.poll(async () => (await youtube.snapshot()).players.some((player) => player.ready)).toBe(true);
  await youtube.play();
  await expect.poll(async () => (await youtube.snapshot()).players.at(-1)?.current ?? 0).toBeGreaterThan(30);
  await page.evaluate(() => {
    const previous = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    if (previous) Object.defineProperty(document, "hidden", previous);
    else Reflect.deleteProperty(document, "hidden");
  });
  await expect.poll(() => state.progress.length).toBeGreaterThan(0);
  // Observe past the five-second automatic-next delay, without finishing this replay.
  // eslint-disable-next-line no-restricted-syntax -- Observe beyond the full automatic-next delay to prove no navigation.
  await page.waitForTimeout(6_000);
  expect(new URL(page.url()).searchParams.get("video")).toBe("562");
  await expect(page.getByRole("heading", { name: FIRST_TITLE })).toBeVisible();
});

test("playlist request failure is visible and retry restores next-video navigation", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.playlistFail = true;
  await openWatch(page);
  await expect(page.getByText("재생목록을 불러오지 못했습니다.", { exact: true })).toBeVisible();
  state.playlistFail = false;
  await page.getByRole("button", { name: "재생목록 다시 불러오기" }).click();
  await expect(page.getByRole("link", { name: "다음 항목", exact: true })).toBeVisible();
});

test("comment failure is not presented as zero and retry preserves the draft", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.commentsFail = true;
  await openWatch(page);
  await expect(page.getByText("댓글을 불러오지 못했습니다.", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("아직 댓글이 없습니다. 첫 댓글을 남겨보세요.")).toHaveCount(0);
  await page.getByPlaceholder("댓글을 입력하세요...").fill("새로 읽으며 작성한 댓글");
  state.commentsFail = false;
  await page.getByRole("button", { name: "댓글 다시 불러오기" }).click();
  await expect(page.getByText(state.comments[0].content, { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("댓글을 입력하세요...")).toHaveValue("새로 읽으며 작성한 댓글");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page.getByText("새로 읽으며 작성한 댓글", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("새로 읽으며 작성한 댓글", { exact: true })).toBeVisible();
});

test("like failure rolls back visibly and a retry persists through reload", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.likeFail = true;
  await openWatch(page);
  // The heading precedes the lazy comments/profile queries. Let the complete
  // page settle so WebKit does not abort their initialization during reload.
  await expect(page.getByText(state.comments[0].content, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "좋아요", exact: true }).click();
  await expect(page.getByText("좋아요를 저장하지 못했습니다. 다시 시도해 주세요.", { exact: true })).toBeVisible();
  await expect(page.locator(".vpp-like-btn")).toHaveAttribute("aria-pressed", "false");
  state.likeFail = false;
  await page.locator(".vpp-like-btn").click();
  await expect(page.locator(".vpp-like-btn")).toHaveAttribute("aria-pressed", "true");
  // aria-pressed is optimistic; persistence requires the confirmed response.
  await expect(page.locator(".vpp-like-btn")).toBeEnabled();
  await page.reload();
  await expect(page.getByText(state.comments[0].content, { exact: true })).toBeVisible();
  await expect(page.locator(".vpp-like-btn")).toHaveAttribute("aria-pressed", "true");
});


test("a new playback end saves completion immediately, supports cancel, and advances after a later end", async ({ page }) => {
  const { state, youtube } = await installWatchScenario(page);
  await openWatch(page);
  await expect.poll(async () => (await youtube.snapshot()).players.some((player) => player.ready)).toBe(true);
  await youtube.finish();
  await expect.poll(() => state.progress.some((entry) => entry.videoId === 562 && entry.body.completed === true)).toBe(true);
  await page.getByRole("button", { name: /다음 항목.*취소/ }).click();
  // eslint-disable-next-line no-restricted-syntax -- Observe beyond the full automatic-next delay to prove no navigation.
  await page.waitForTimeout(6_000);
  await expect(page.getByRole("heading", { name: FIRST_TITLE })).toBeVisible();
  await youtube.finish();
  await expect(page.getByRole("heading", { name: SECOND_TITLE })).toBeVisible({ timeout: 10_000 });
});

for (const width of [1366, 390]) {
  test(`confirmed completion refreshes previously cached statistics at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { state, youtube, vendorRequests } = await installWatchScenario(page);
    let statsFetches = 0;
    await page.route("**/api/v1/student/video/me/", (route) => route.fulfill({
      json: { public: null, lectures: [], archived_lectures: [] },
    }));
    await page.route("**/api/v1/student/video/me/stats/", (route) => {
      statsFetches++;
      const complete = state.progress.some((entry) => entry.videoId === 562 && entry.body.completed === true);
      return route.fulfill({ json: {
        total_videos: 1, completed_videos: complete ? 1 : 0, completion_rate: complete ? 100 : 0,
        total_watch_duration: complete ? 600 : 0, total_content_duration: 600, lectures: [],
      } });
    });
    await page.goto(`${BASE}/student/video`, { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "통계", exact: true }).click();
    await expect(page.locator(".video-stats-overview__title")).toHaveText("0% 완료");
    const notificationLink = page.getByRole("navigation", { name: "하단 메뉴" })
      .getByRole("link", { name: "알림", exact: true });
    // Wait for profile + notification responses, not only the independent stats query.
    await expect(notificationLink).toBeVisible();
    const before = statsFetches;
    // Retain the same query client to exercise a still-fresh cached response.
    await page.evaluate(() => {
      history.pushState({}, "", "/student/video/play?video=562&enrollment=1304&session=394");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByRole("heading", { name: FIRST_TITLE })).toBeVisible();
    await expect(page.locator("[data-youtube-sdk-fixture]")).toBeVisible();
    await expect.poll(async () => (await youtube.snapshot()).players.some((player) => player.ready)).toBe(true);
    await youtube.finish();
    await expect.poll(() => state.progress.some((entry) => entry.body.completed === true)).toBe(true);
    await page.getByRole("button", { name: /다음 항목.*취소/ }).click();
    await page.evaluate(() => {
      history.pushState({}, "", "/student/video");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.getByRole("tab", { name: "통계", exact: true }).click();
    await expect(page.locator(".video-stats-overview__title")).toHaveText("100% 완료");
    expect(statsFetches).toBeGreaterThan(before);
    await expect(notificationLink).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "통계", exact: true }).click();
    await expect(page.locator(".video-stats-overview__title")).toHaveText("100% 완료");
    await expect(notificationLink).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`confirmed-progress-stats-${width}.png`) });
    expect(vendorRequests).toEqual([]);
  });
}

test("deleting the root preserves an existing teacher reply without showing deleted content", async ({ page }) => {
  const { state } = await installWatchScenario(page);
  state.comments[0] = { ...state.comments[0], is_deleted: true, content: "숨겨야 하는 삭제 내용", reply_count: 1,
    replies: [{ ...state.comments[0], id: 702, author_type: "teacher", author_name: "합성 선생님",
      is_mine: false, content: "기존 선생님 답변은 계속 읽을 수 있습니다.", replies: [] }] };
  await openWatch(page);
  await expect(page.getByText("삭제된 댓글입니다.", { exact: true })).toBeVisible();
  await expect(page.getByText("숨겨야 하는 삭제 내용", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "답글 1개", exact: true }).click();
  await expect(page.getByText("기존 선생님 답변은 계속 읽을 수 있습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "답글", exact: true })).toHaveCount(0);
});

for (const width of [1366, 390]) {
  test(`a long playlist keeps its last video reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { videos } = await installWatchScenario(page);
    for (let index = 0; index < 16; index++) videos.push({ ...videos[1], id: 600 + index, title: `추가 강의 ${index + 1}` });
    await openWatch(page);
    const last = page.getByRole("link", { name: /추가 강의 16/ });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    const box = await last.boundingBox();
    expect(box).not.toBeNull();
    expect(await last.evaluate((link) => {
      const box = link.getBoundingClientRect();
      return link.contains(document.elementFromPoint(box.left + box.width / 2, box.bottom - 3));
    })).toBe(true);
  });
}

for (const speedLocked of [true, false]) {
  test(`monitored HLS gestures ${speedLocked ? "locked taps never attempt speed changes" : "restore only an active long press once"}`, async ({ page }, info) => {
    if (!speedLocked) info.annotations.push({ type: "coverage", description:
      "Chromium also checks active speed menus in native wrapper fullscreen at 390/1366px; iOS WebKit retains native-video coverage. Active quality selection is not verified by this fixture." });
    await verifyMonitoredHlsGestures({ page, info, speedLocked, base: BASE, installScenario: installWatchScenario, openPlayer: openWatch });
  });
}


test.describe("student fullscreen activation", () => {
  test.use({ hasTouch: true });
  for (const width of [390, 1366]) {
    test(`fullscreen controls complete trusted touch once and preserve cancel, guide and keyboard journeys at ${width}px`, async ({ page }, info) => {
      await verifyFullscreenControls({ page, info, speedLocked: true, base: BASE,
        viewport: { width, height: width === 390 ? 844 : 900 }, installScenario: installWatchScenario, openPlayer: openWatch });
    });
  }
});

async function installStalledHls(page: Page) {
  const { state, videos } = await installWatchScenario(page);
  const video = { ...videos[0], source_type: "s3", youtube_video_id: null, last_position: 42 };
  Object.assign(videos[0], video);
  let manifests = 0;
  let grants = 0;
  let releaseReload: () => void = () => {};
  const reloadAllowed = new Promise<void>((resolve) => { releaseReload = resolve; });
  await page.route("**/__qa__/video-long/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/master.m3u8") && ++manifests === 2) await reloadAllowed;
    const asset = syntheticLongVideoAsset(pathname);
    await route.fulfill({ body: asset.body, contentType: asset.contentType });
  });
  await page.route("**/api/v1/student/video/videos/562/playback/**", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: {
      ok: true, access_mode: "FREE_REVIEW", monitoring_enabled: false, policy_version: 1,
    } });
    grants++;
    return route.fulfill({ json: {
      video,
      play_url: BASE + "/__qa__/video-long/master.m3u8",
      playback_token: "synthetic-stall-token",
      playback_session_id: null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 900,
      policy_version: 1,
      policy: { access_mode: "FREE_REVIEW", monitoring_enabled: false, allow_seek: true,
        playback_rate: { max: 2, ui_control: true }, source: { type: "s3", provider: "uploaded" } },
    } });
  });
  return { state, manifests: () => manifests, grants: () => grants, releaseReload };
}

for (const width of [390, 1366]) {
  for (const source of ["HLS", "YouTube"] as const) {
    test(`idle ${source} resume leaves a newer checkpoint alone at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 840 });
      const { state, videos, youtube } = await installWatchScenario(page);
      videos[0].last_position = 42;
      if (source === "HLS") {
        videos[0].source_type = "s3";
        await page.route("**/__qa__/video-long/**", (route) => {
          const asset = syntheticLongVideoAsset(new URL(route.request().url()).pathname);
          return route.fulfill({ body: asset.body, contentType: asset.contentType });
        });
        await page.route("**/api/v1/student/video/videos/562/playback/**", (route) => {
          if (route.request().method() === "GET") return route.fallback();
          return route.fulfill({ json: {
            video: videos[0],
            play_url: BASE + "/__qa__/video-long/master.m3u8",
            playback_token: "synthetic-idle-token", playback_session_id: null,
            playback_expires_at: Math.floor(Date.now() / 1000) + 900, policy_version: 1,
            policy: { access_mode: "FREE_REVIEW", monitoring_enabled: false, allow_seek: true,
              playback_rate: { max: 2, ui_control: true }, source: { type: "s3", provider: "uploaded" } },
          } });
        });
      }
      const current = () => source === "HLS"
        ? page.locator("video.svpVideo").evaluate((el: HTMLVideoElement) => el.currentTime)
        : youtube.snapshot().then(({ players }) => players.at(-1)?.current);
      await openWatch(page);
      await expect.poll(current).toBe(42);
      videos[0].last_position = 90; // Another device saved while this player was idle.
      await page.evaluate(() => {
        const hidden = Object.getOwnPropertyDescriptor(document, "hidden");
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        if (hidden) Object.defineProperty(document, "hidden", hidden);
        else Reflect.deleteProperty(document, "hidden");
      });
      await page.getByRole("link", { name: new RegExp(SECOND_TITLE) }).click();
      await expect(page.getByRole("heading", { name: SECOND_TITLE })).toBeVisible();
      expect(state.progress).toEqual([]);
      await openWatch(page);
      await expect.poll(current).toBe(90);
      expect(state.progress).toEqual([]);
    });
  }
}

for (const width of [390, 1366]) {
  test(`resume keeps a failed rewind on the same revision and yields to a newer server checkpoint at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 840 });
    await installWatchScenario(page);
    let checkpoint = { position: 42, revision: "revision-a" };
    let failedPosition: number | undefined;
    await page.route("**/__qa__/video-long/**", async (route) => {
      const asset = syntheticLongVideoAsset(new URL(route.request().url()).pathname);
      await route.fulfill({ body: asset.body, contentType: asset.contentType });
    });
    await page.route("**/api/v1/student/video/videos/562/playback/**", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: {
        ok: true, access_mode: "FREE_REVIEW", monitoring_enabled: false, policy_version: 1,
      } });
      return route.fulfill({ json: {
        video: { id: 562, title: FIRST_TITLE, session_id: 394, enrollment_id: 1304, status: "READY",
          source_type: "s3", duration: 600, last_position: checkpoint.position, progress: 25 },
        progress_revision: checkpoint.revision,
        play_url: BASE + "/__qa__/video-long/master.m3u8",
        playback_token: "synthetic-resume-token",
        playback_session_id: null,
        playback_expires_at: Math.floor(Date.now() / 1000) + 900,
        policy_version: 1,
        policy: { access_mode: "FREE_REVIEW", monitoring_enabled: false, allow_seek: true,
          playback_rate: { max: 2, ui_control: true }, source: { type: "s3", provider: "uploaded" } },
      } });
    });
    await page.route("**/api/v1/student/video/videos/562/progress/", async (route) => {
      failedPosition = route.request().postDataJSON().last_position;
      await route.fulfill({ status: 503, json: { detail: "일시적인 연결 오류" } });
    });
    await openWatch(page);
    const video = page.locator("video.svpVideo");
    const currentTime = () => video.evaluate((el: HTMLVideoElement) => el.currentTime);
    const seekState = () => video.evaluate((el: HTMLVideoElement) => ({ position: el.currentTime, seeking: el.seeking }));
    await expect.poll(seekState).toEqual({ position: 42, seeking: false });
    await video.evaluate((el: HTMLVideoElement) => { el.currentTime = 0; });
    // A queued seeked event can belong to the initial resume on WebKit.
    await expect.poll(seekState).toEqual({ position: 0, seeking: false });
    await page.evaluate(() => {
      const hidden = Object.getOwnPropertyDescriptor(document, "hidden");
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
      if (hidden) Object.defineProperty(document, "hidden", hidden);
      else Reflect.deleteProperty(document, "hidden");
    });
    await expect.poll(() => failedPosition).toBe(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThan(0);
    await expect.poll(currentTime).toBe(0);

    checkpoint = { position: 18, revision: "revision-b" };
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(video).toBeVisible();
    await expect.poll(currentTime).toBe(18);
  });
}

// Freeze the playhead seen by the app without dispatching an error or replacing
// the media element. Reload, seek, buffering, and resumed playback use real HLS.
async function freezePlayhead(page: Page) {
  return page.locator("video.svpVideo").evaluate((el: HTMLVideoElement) => {
    const position = el.currentTime;
    const time = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime")!;
    Object.defineProperty(el, "currentTime", { configurable: true, get: () => position, set: time.set });
    return position;
  });
}

for (const width of [1366, 390]) {
  test(`silent HLS stall reconnects at the same position at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 840 });
    await page.clock.install();
    const hls = await installStalledHls(page);
    const video = page.locator("video.svpVideo");
    const reconnecting = page.getByRole("status").filter({ hasText: "연결을 다시 시도하고 있어요" });
    try {
      await openWatch(page);
      const play = page.locator("button.svpBigPlay");
      await play.press("Enter");
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(42);
      await video.evaluate((el: HTMLVideoElement) => el.pause());
      await expect(play).toBeVisible();
      await page.clock.fastForward(20_000);
      expect(hls.manifests()).toBe(1);
      await play.press("Enter");
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
      await video.evaluate((el: HTMLVideoElement) => { el.playbackRate = 1.5; el.muted = true; });
      const stalledAt = await freezePlayhead(page);
      await page.clock.fastForward(3_000);
      await expect(reconnecting).toHaveCount(0);
      await page.clock.fastForward(10_500);
      await expect(reconnecting).toBeVisible();
      await expect.poll(hls.manifests).toBe(2);
      expect(hls.grants()).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`hls-reconnecting-${width}.png`) });
      await video.evaluate((el) => { Reflect.deleteProperty(el, "currentTime"); });
      hls.releaseReload();
      await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(stalledAt + 0.2);
      await expect(reconnecting).toHaveCount(0);
      expect(await video.evaluate((el: HTMLVideoElement) => ({ rate: el.playbackRate, muted: el.muted })))
        .toEqual({ rate: 1.5, muted: true });
      expect(hls.grants()).toBe(1);
    } finally {
      hls.releaseReload();
    }
  });
}

test("silent HLS stall offers a position-preserving retry if reconnect does not advance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 });
  await page.clock.install();
  const hls = await installStalledHls(page);
  const video = page.locator("video.svpVideo");
  try {
    await openWatch(page);
    await page.locator("button.svpBigPlay").press("Enter");
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(42);
    const initiallyNative = !(await video.getAttribute("src"))?.startsWith("blob:");
    await video.evaluate((el: HTMLVideoElement) => { el.currentTime = 83; });
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(83);
    const stalledAt = await freezePlayhead(page);
    await page.clock.fastForward(2_000);
    await page.clock.fastForward(10_500);
    await expect.poll(hls.manifests).toBe(2);
    await page.clock.fastForward(10_500);
    const retry = page.getByRole("button", { name: "다시 시도", exact: true });
    if (initiallyNative) {
      // Supported native playback gets one bounded alternate-engine attempt.
      await expect.poll(async () => await retry.count() > 0 || (await video.getAttribute("src"))?.startsWith("blob:")).toBe(true);
      if (await retry.count() === 0) {
        await page.clock.fastForward(2_000);
        await page.clock.fastForward(10_500);
      }
    }
    await expect(retry).toBeVisible();
    await expect.poll(() => hls.state.progress.some(({ body }) =>
      body.last_position === Math.round(stalledAt) && body.completed === false)).toBe(true);
    expect(hls.grants()).toBe(1);
    hls.releaseReload();
    await retry.press("Enter");
    await expect.poll(hls.grants).toBe(2);
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThanOrEqual(Math.round(stalledAt));
    await page.locator("button.svpBigPlay").press("Enter");
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(stalledAt);
  } finally {
    hls.releaseReload();
  }
});
