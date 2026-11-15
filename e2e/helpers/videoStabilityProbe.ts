import { expect, type Browser, type BrowserContext, type Page } from "../fixtures/strictTest";
import { dismissDevelopmentFirstLoginGuide } from "./auth";
import { installSyntheticVideoPosterBridge } from "./syntheticVideoPosterBridge";
import { exerciseFullscreenAudit } from "./playbackExitProbe";

type Prepared = { context: BrowserContext; page: Page; apiAccessToken: string; state: { bootstraps: Array<{
  playback_token?: unknown; playback_session_id?: unknown; event_protocol_version?: unknown;
  play_url?: unknown; video?: { id?: unknown; session_id?: unknown };
}> } };
type Prepare = (viewport: { width: number; height: number }, name: "desktop" | "mobile",
  username: string, password: string, tenant: string, tenantId: number,
  videoId: number, hlsPath: string, base: string) => Promise<Prepared>;
type Summary = { revision: string; used_ms: number; limit_ms: number | null; exhausted: boolean };

function required(key: string, pattern?: RegExp): string {
  const value = process.env[key] ?? "";
  expect(Boolean(value) && (!pattern || pattern.test(value)), `video-stability-env:${key}`).toBe(true);
  return value;
}

async function reveal(page: Page) {
  const wrap = page.locator(".svpPlayerWrap");
  if ((await wrap.getAttribute("class"))?.includes("svpPlayerWrap--controlsHidden")) {
    await page.locator(".svpGestureLayer").click({ position: { x: 24, y: 24 } });
  }
}

async function play(page: Page) {
  await expect(page.locator("video.svpVideo")).toBeVisible();
  const before = await page.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => node.currentTime);
  if (await page.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => node.paused)) {
    await page.locator("button.svpBigPlay").click();
  }
  await expect.poll(() => page.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(before + 1);
}

/** Resume alone queues no v2 event; use trusted UI to prove this session is still active. */
export async function verifyClassPlaybackActivity(page: Page, token: unknown, protocol: unknown) {
  expect([1, 2]).toContain(protocol);
  if (protocol === 2) {
    await play(page);
    await exerciseFullscreenAudit(page, token, { requireActive: true, timeout: 40_000 });
    await play(page);
    return;
  }
  const heartbeat = page.waitForResponse(response => response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/v1/media/playback/heartbeat/"
    && response.request().postDataJSON().token === token, { timeout: 40_000 });
  const [response] = await Promise.all([heartbeat, play(page)]);
  expect(response.status()).toBe(200);
}

async function pause(page: Page) {
  await reveal(page);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect.poll(() => page.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
}

async function pauseAndPersist(page: Page, videoId: number) {
  await expect.poll(() => page.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(5);
  const minimum = await page.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => Math.floor(node.currentTime));
  const [response] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/v1/student/video/videos/${videoId}/progress/`
      && Number(response.request().postDataJSON().last_position) >= minimum, { timeout: 40_000 }),
    pause(page),
  ]);
  expect(response.status()).toBe(200);
  const confirmed = await response.json();
  const pausedAt = await page.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => node.currentTime);
  expect(Math.abs(confirmed.last_position - pausedAt)).toBeLessThanOrEqual(1);
  return confirmed.last_position as number;
}

export async function leaveStudentPlayer(page: Page, { videoId, enrollmentId, sessionId, token, stream }: {
  videoId: number; enrollmentId: number; sessionId: number; token: unknown; stream?: unknown;
}) {
  const position = await page.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => Math.floor(node.currentTime));
  const progress = page.waitForResponse(response => response.request().method() === "POST"
    && new URL(response.url()).pathname === `/api/v1/student/video/videos/${videoId}/progress/`
    && response.request().postDataJSON().enrollment_id === enrollmentId);
  const terminal = page.waitForResponse(response => {
    if (response.request().method() !== "POST") return false;
    const path = new URL(response.url()).pathname;
    if (stream) return path === `/api/v1/student/video/videos/${videoId}/review-watch/`
      && response.request().postDataJSON().stream === stream && response.request().postDataJSON().playing === false;
    return ["/api/v1/media/playback/end/", "/api/v1/media/playback/v2/end/"].includes(path)
      && response.request().postDataJSON().token === token;
  }, { timeout: 45_000 });
  const [response, saved] = await Promise.all([terminal, progress,
    page.getByRole("button", { name: "목록으로", exact: true }).click()]);
  expect(response.status()).toBe(200);
  expect(saved.status()).toBe(200);
  const sentPosition = saved.request().postDataJSON().last_position;
  expect(Number.isInteger(sentPosition)).toBe(true);
  expect(sentPosition).toBeGreaterThanOrEqual(position);
  const confirmed = await saved.json();
  expect(confirmed).toMatchObject({ video_id: videoId, enrollment_id: enrollmentId, last_position: sentPosition });
  await Promise.all([response.finished(), saved.finished()]);
  await expect(page).toHaveURL(url => url.pathname === `/student/video/sessions/${sessionId}`
    && url.searchParams.get("enrollment") === String(enrollmentId));
  return sentPosition as number;
}

async function seed(context: BrowserContext, page: Page, api: string, tenant: string, username: string, password: string) {
  const login = await context.request.post(`${api}/api/v1/token/`, {
    headers: { "X-Tenant-Code": tenant }, data: { username, password, tenant_code: tenant },
  });
  expect(login.status()).toBe(200);
  const tokens = await login.json();
  expect(typeof tokens.access === "string" && typeof tokens.refresh === "string").toBe(true);
  await page.addInitScript(({ access, refresh, code }) => {
    localStorage.setItem("access", access); localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code); sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: tenant });
  return { Authorization: `Bearer ${tokens.access}`, "X-Tenant-Code": tenant };
}

/** Only the exact playback API grants may select the local media fixture.
 * Auth, support, policy, progress and usage requests remain real development APIs.
 * This proves UI/API integration; it does not stand in for protected R2-origin proof.
 */
async function mediaBridge(context: BrowserContext, base: string, api: string, tenantId: number, videoId: number,
  priorClassMaster?: string) {
  const state = { responseChain: Promise.resolve(), allowedMasterUrls: new Set<string>(),
    allowedPosterUrls: new Set<string>(), supportPosterExpiries: new Map<string, number>(), posterLoads: 0 };
  const directOrigins = new Set<string>();
  const grantedMasterUrls = new Set<string>();
  const reviewRoots = new Set<string>();
  const admittedRoots = new Set<string>();
  let error: unknown;
  const assertDirectMaster = (master: URL) => {
    expect(master.protocol).toBe("https:");
    expect(master.pathname).toBe("/qa-fixtures/video-long/master.m3u8");
    expect([...master.searchParams.keys()].sort()).toEqual(["exp", "kid", "sig", "uid"]);
    expect(master.searchParams.get("sig")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Number(master.searchParams.get("exp"))).toBeGreaterThan(Math.floor(Date.now() / 1_000));
  };
  if (priorClassMaster) {
    const master = new URL(priorClassMaster);
    assertDirectMaster(master);
    // The same student's earlier exact class grant proves only the poster
    // origin. Review media must still come from the new review bootstrap.
    state.allowedMasterUrls.add(master.href);
  }
  const bootstraps: Array<{ support_preview?: boolean; playback_session_id?: unknown;
    playback_token?: unknown; review_watch?: { stream: string } | null; video: { enrollment_id: number; session_id: number } }> = [];
  context.on("response", response => {
    const url = new URL(response.url());
    // The release guard forwards the artifact's production API origin to the isolated API.
    if (![api, "https://api.hakwonplus.com"].includes(url.origin) || !response.ok() || response.request().method() === "OPTIONS") return;
    state.responseChain = state.responseChain.then(async () => {
      if (url.pathname === `/api/v1/student/video/videos/${videoId}/playback/` && response.request().method() === "POST") {
        const data = await response.json();
        expect(data.video.id).toBe(videoId);
        bootstraps.push(data);
        const master = new URL(data.play_url, api);
        grantedMasterUrls.add(master.href);
        state.allowedMasterUrls.add(master.href);
        if (master.pathname === "/qa-fixtures/video-long/master.m3u8") {
          assertDirectMaster(master);
          directOrigins.add(master.origin);
        } else {
          expect(master.pathname).toMatch(/^\/api\/v1\/media\/review-stream\/[0-9a-f-]{36}\/master\.m3u8$/);
          expect(master.origin).toBe(api);
          const browserMaster = new URL(master.pathname.replace("/api/v1/media/review-stream/", "/review-media/") + master.search, base);
          grantedMasterUrls.add(browserMaster.href);
          state.allowedMasterUrls.add(browserMaster.href);
          reviewRoots.add(new URL(".", browserMaster).href);
        }
        if (data.video.thumbnail_url) state.allowedPosterUrls.add(data.video.thumbnail_url);
        if (data.support_preview === true && data.video.thumbnail_url) {
          expect(Number.isSafeInteger(data.playback_expires_at)).toBe(true);
          expect(data.playback_expires_at).toBeGreaterThan(Math.floor(Date.now() / 1_000));
          expect(Number(new URL(data.video.thumbnail_url).searchParams.get("exp"))).toBe(data.playback_expires_at);
          state.supportPosterExpiries.set(data.video.thumbnail_url, data.playback_expires_at);
        }
      } else if (/^\/api\/v1\/student\/video\/sessions\/\d+\/videos\/$/.test(url.pathname)) {
        const data = await response.json();
        for (const item of data.items ?? []) if (item.id === videoId && item.thumbnail_url) state.allowedPosterUrls.add(item.thumbnail_url);
      }
    }).catch(caught => { error ??= caught; });
  });
  await installSyntheticVideoPosterBridge(context, state, tenantId, videoId);
  await context.route(url => url.pathname.startsWith("/qa-fixtures/video-long/") || url.pathname.startsWith("/review-media/"), async route => {
    await state.responseChain;
    if (error) throw error;
    const target = new URL(route.request().url());
    const root = new URL(".", target).href;
    const name = target.pathname.split("/").pop()!;
    expect(route.request().method()).toBe("GET");
    expect(["master.m3u8", "init.mp4", "media.m4s"]).toContain(name);
    if (name === "master.m3u8") {
      await expect.poll(async () => {
        await state.responseChain;
        if (error) throw error;
        return grantedMasterUrls.has(target.href);
      }).toBe(true);
      admittedRoots.add(root);
    } else {
      expect(admittedRoots.has(root)).toBe(true);
      expect(directOrigins.has(target.origin) || reviewRoots.has(root)).toBe(true);
    }
    const fixture = await route.fetch({ url: `${base}/__qa__/video-long/${name}`, headers: {}, maxRedirects: 0 });
    expect(fixture.status()).toBe(200);
    await route.fulfill({ response: fixture });
  });
  return { bootstraps, verify: async () => { await state.responseChain; expect(error).toBeUndefined(); } };
}

export async function runVideoStabilityProbe(browser: Browser, prepare: Prepare) {
  expect(process.env.E2E_VIDEO_STABILITY_PROBE).toBe("1");
  expect(process.env.E2E_RELEASE_API_MODE).toBe("development");
  expect(process.env.E2E_STRICT).toBe("strict");
  expect(process.env.E2E_ALLOW_PRODUCTION_WRITES).toBe("0");
  expect(process.env.E2E_ALLOW_REAL_ALIMTALK).toBe("0");
  const base = required("E2E_BASE_URL", /^http:\/\/localhost:4173$/);
  const api = required("E2E_API_URL", /^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/);
  const tenant = required("E2E_TENANT_CODE", /^qa-ymath-realuse-[a-z0-9-]+$/);
  const tenantId = Number(required("E2E_LONG_VIDEO_TENANT_ID", /^[1-9][0-9]*$/));
  const videoId = Number(required("E2E_LONG_VIDEO_ID", /^[1-9][0-9]*$/));
  const hlsPath = required("E2E_LONG_VIDEO_HLS_PATH", /^qa-fixtures\/video-long\/master\.m3u8$/);
  const contexts = new Set<BrowserContext>();
  const closeContext = async (context: BrowserContext) => {
    if (contexts.delete(context)) await context.close();
  };
  let cleanupFailure: PromiseRejectedResult | undefined;
  try {
    for (const width of [1366, 390]) {
      const checkpoint = (stage: "student-prepared" | "student-saved" | "support-open" | "support-isolated"
        | "class-heartbeat-ok" | "class-exit-saved" | "review-mode-updated" | "review-toggle-updated"
        | "review-playing" | "review-support-isolated" | "review-exhausted" | "review-recovered" | "complete") => {
        console.log(JSON.stringify({ videoStabilityCheckpoint: { width, stage } }));
      };
      const mobile = width === 390;
      const run = await prepare({ width, height: 900 }, mobile ? "mobile" : "desktop",
        required(mobile ? "E2E_STUDENT2_USER" : "E2E_STUDENT_USER", mobile ? /^ymath-qa-student-02$/ : /^ymath-qa-student-01$/),
        required(mobile ? "E2E_STUDENT2_PASS" : "E2E_STUDENT_PASS"), tenant, tenantId, videoId, hlsPath, base);
      contexts.add(run.context);
      let student = run.page;
      checkpoint("student-prepared");
      await play(student);
      const savedPosition = await pauseAndPersist(student, videoId);
      checkpoint("student-saved");
      const studentHeaders = { Authorization: `Bearer ${run.apiAccessToken}`, "X-Tenant-Code": tenant };
      const profileResponse = await run.context.request.get(`${api}/api/v1/student/me/`, { headers: studentHeaders });
      expect(profileResponse.status()).toBe(200);
      const profile = await profileResponse.json();
      const studentId = Number(profile.id);
      expect(Number.isSafeInteger(studentId) && studentId > 0).toBe(true);
      const teacherContext = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      contexts.add(teacherContext);
      const teacherMedia = await mediaBridge(teacherContext, base, api, tenantId, videoId);
      const teacher = await teacherContext.newPage();
      const headers = await seed(teacherContext, teacher, api, tenant,
        required("E2E_ADMIN_USER", /^ymath-qa-teacher$/), required("E2E_ADMIN_PASS"));
      const report = async () => {
        const response = await teacherContext.request.get(`${api}/api/v1/media/videos/${videoId}/review-watch/report/`, { headers });
        expect(response.status()).toBe(200);
        const data = await response.json();
        const studentRow = data.students.find((row: { student_id: number }) => row.student_id === studentId);
        expect(studentRow, "Report must include the enrolled student, including unused allowance").toBeDefined();
        return { ...data, student: studentRow as Summary };
      };
      const sessionId = Number(run.state.bootstraps[0].video?.session_id);
      const list = async () => {
        const response = await teacherContext.request.get(`${api}/api/v1/student/video/sessions/${sessionId}/videos/`, { headers: studentHeaders });
        expect(response.status()).toBe(200);
        return (await response.json()).items.find((row: { id: number }) => row.id === videoId);
      };
      await teacher.goto(`${base}/workspace/mobile/students/${studentId}`);
      await dismissDevelopmentFirstLoginGuide(teacher, tenant);
      const initial = await list();
      expect(initial.last_position).toBe(savedPosition);
      const initialUsage = (await report()).student.used_ms;
      const previewWithoutStudentWrites = async () => {
        const before = await list();
        const usageBefore = (await report()).student.used_ms;
        const popupPromise = teacher.waitForEvent("popup");
        await teacher.getByRole("button", { name: "학생 화면", exact: true }).click();
        const preview = await popupPromise;
        checkpoint("support-open");
        await expect(preview.getByText("교직원 대리보기", { exact: true })).toBeVisible();
        await preview.goto(`${base}/student/video/play?video=${videoId}`);
        await play(preview);
        await reveal(preview);
        const beforeSeek = await preview.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => node.currentTime);
        await preview.getByRole("button", { name: "+10초", exact: true }).click();
        await expect.poll(() => preview.locator("video.svpVideo").evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThanOrEqual(beforeSeek + 9);
        await pause(preview);
        const previewGrant = teacherMedia.bootstraps.at(-1)!;
        expect(previewGrant.support_preview).toBe(true);
        expect(previewGrant.playback_session_id).toBeNull();
        expect(previewGrant.review_watch).toBeNull();
        const close = preview.waitForEvent("close");
        const ended = preview.waitForResponse(response => response.request().method() === "POST"
          && new URL(response.url()).pathname === "/api/v1/students/me/support-session/end/");
        const [endResponse] = await Promise.all([ended,
          preview.getByRole("button", { name: "보기 종료", exact: true }).click(), close]);
        expect(endResponse.status()).toBe(200);
        const after = await list();
        for (const key of ["progress", "last_position", "completed"]) expect(after[key]).toBe(before[key]);
        expect((await report()).student.used_ms).toBe(usageBefore);
      };
      await previewWithoutStudentWrites();
      checkpoint("support-isolated");
      const classGrant = run.state.bootstraps.at(-1)!;
      const classProtocol = classGrant.event_protocol_version ?? 1;
      await verifyClassPlaybackActivity(student, classGrant.playback_token, classProtocol);
      expect(run.state.bootstraps).toHaveLength(1);
      checkpoint("class-heartbeat-ok");
      const classSavedPosition = await leaveStudentPlayer(student, {
        videoId, enrollmentId: initial.enrollment_id, sessionId, token: classGrant.playback_token,
      });
      expect((await list()).last_position).toBe(classSavedPosition);
      await closeContext(run.context);
      checkpoint("class-exit-saved");

      // The setup's exact video and enrollment are the only policy mutation targets.
      const mode = await teacherContext.request.post(`${api}/api/v1/media/video-permissions/bulk_set/`, {
        headers, data: { video_id: videoId, enrollments: [initial.enrollment_id], access_mode: "FREE_REVIEW" },
      });
      expect(mode.ok()).toBe(true);
      checkpoint("review-mode-updated");
      const beforeToggle = await report();
      const toggle = await teacherContext.request.patch(`${api}/api/v1/media/videos/${videoId}/`, {
        headers: { ...headers, "X-Expected-Updated-At": beforeToggle.updated_at }, data: { review_watch_limit_enabled: true },
      });
      expect(toggle.status()).toBe(200);
      checkpoint("review-toggle-updated");
      const reviewContext = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      contexts.add(reviewContext);
      student = await reviewContext.newPage();
      expect(classGrant.video?.id).toBe(videoId);
      expect(typeof classGrant.play_url).toBe("string");
      const reviewMedia = await mediaBridge(reviewContext, base, api, tenantId, videoId, classGrant.play_url as string);
      await seed(reviewContext, student, api, tenant,
        required(mobile ? "E2E_STUDENT2_USER" : "E2E_STUDENT_USER"), required(mobile ? "E2E_STUDENT2_PASS" : "E2E_STUDENT_PASS"));
      await student.goto(`${base}/student/video/play?video=${videoId}`);
      await play(student);
      await expect.poll(async () => (await report()).student.used_ms).toBeGreaterThan(initialUsage);
      checkpoint("review-playing");
      const pausedReview = student.waitForResponse(response => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/v1/student/video/videos/${videoId}/review-watch/`
        && response.request().postDataJSON().playing === false);
      const [reviewPause, reviewPosition] = await Promise.all([pausedReview, pauseAndPersist(student, videoId)]);
      expect(reviewPause.status()).toBe(200);
      expect((await list()).last_position).toBe(reviewPosition);
      await previewWithoutStudentWrites();
      const liveReview = student.waitForResponse(response => response.request().method() === "POST"
        && new URL(response.url()).pathname === `/api/v1/student/video/videos/${videoId}/review-watch/`
        && response.request().postDataJSON().playing === true
        && response.request().postDataJSON().stream === reviewMedia.bootstraps[0]?.review_watch?.stream);
      const [reviewHeartbeat] = await Promise.all([liveReview, play(student)]);
      expect(reviewHeartbeat.status()).toBe(200);
      expect(reviewMedia.bootstraps).toHaveLength(1);
      checkpoint("review-support-isolated");
      await teacher.goto(`${base}${mobile ? "/workspace/mobile" : "/workspace"}/videos/${videoId}/logs/${studentId}`);
      const editor = teacher.getByRole("region", { name: "학생 복습 한도 조정" });
      await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
      await editor.getByLabel("총 허용시간 (분 또는 분:초)").fill("0");
      await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
      await expect(editor.getByRole("status")).toBeVisible();
      await expect(student.getByText("복습 시청시간을 모두 사용했어요", { exact: true })).toBeVisible();
      const exhausted = (await report()).student;
      expect(exhausted.exhausted).toBe(true); expect(exhausted.used_ms).toBeGreaterThan(0);
      checkpoint("review-exhausted");
      const changes = await Promise.all([60000, 120000].map(additional => teacherContext.request.patch(
        `${api}/api/v1/media/videos/${videoId}/review-watch/students/${studentId}/allowance/`,
        { headers, data: { limit_ms: exhausted.used_ms + additional, expected_revision: exhausted.revision } },
      )));
      expect(changes.map(response => response.status()).sort()).toEqual([200, 409]);
      await student.getByRole("button", { name: "한도 변경 확인", exact: true }).click();
      await play(student);
      checkpoint("review-recovered");
      await teacher.reload();
      await editor.getByRole("button", { name: "복습 한도 조정", exact: true }).click();
      await editor.getByRole("button", { name: "기본 1.4배 적용", exact: true }).click();
      await editor.getByRole("button", { name: "한도 저장", exact: true }).click();
      await expect(editor.getByRole("status")).toBeVisible();
      await teacher.reload();
      const restored = await report();
      expect(restored.student.limit_ms).toBe(restored.threshold_ms);
      expect(restored.student.used_ms).toBeGreaterThanOrEqual(exhausted.used_ms);
      await expect.poll(() => teacher.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await expect.poll(() => student.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await teacherMedia.verify(); await reviewMedia.verify();
      const latestReview = reviewMedia.bootstraps.at(-1)!;
      const reviewSavedPosition = await leaveStudentPlayer(student, {
        videoId, enrollmentId: initial.enrollment_id, sessionId,
        token: latestReview.playback_token, stream: latestReview.review_watch?.stream,
      });
      expect((await list()).last_position).toBe(reviewSavedPosition);
      await closeContext(reviewContext); await closeContext(teacherContext);
      checkpoint("complete");
      console.log(JSON.stringify({ videoStabilityProbe: { schema: "video-stability-probe/v1", width,
        supportIsolated: true, reviewSupportIsolated: true, studentSessionPreserved: true, usagePreserved: true,
        exhaustionRecovered: true, concurrentConflict: true, defaultRestored: true } }));
    }
  } finally {
    const outcomes = await Promise.allSettled([...contexts].map(closeContext));
    cleanupFailure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  }
  if (cleanupFailure) throw cleanupFailure.reason;
}
