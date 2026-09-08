import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type Response,
} from "../fixtures/strictTest";
import { dismissDevelopmentFirstLoginGuide, getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { installSyntheticVideoPosterBridge } from "../helpers/syntheticVideoPosterBridge";
import { classifyVideoPlaybackResponse } from "../helpers/videoPlaybackResponseKind";

const MINIMUM_PLAYBACK_SECONDS = 690;
const MINIMUM_RENEW_SECONDS = 390;
const MAXIMUM_RENEW_SECONDS = 500;
const SYNTHETIC_ASSET_PREFIX = "/__qa__/video-long/";

type LongVideoCheckpointStage =
  | "context-created" | "routes-installed" | "authenticated" | "navigated"
  | "bootstrap-observed" | "access-observed" | "playlist-observed" | "video-mounted"
  | "poster-loaded" | "metadata-ready" | "marker-set" | "playback-state-checked"
  | "play-control-visible" | "play-clicked" | "playback-running" | "playback-started" | "position-530"
  | "renewal-observed" | "renewal-advanced" | "playback-690" | "progress-observed"
  | "reload-bootstrap" | "reload-playlist" | "reload-metadata" | "reload-progress" | "completed";

function emitLongVideoCheckpoint(
  viewport: "desktop" | "mobile",
  stage: LongVideoCheckpointStage,
): void {
  console.log(JSON.stringify({ longVideoCheckpoint: {
    schema: "student-video-renewal-checkpoint/v1", viewport, stage,
  } }));
}

type PlaybackPayload = {
  playback_token?: unknown;
  playback_session_id?: unknown;
  playback_expires_at?: unknown;
  play_url?: unknown;
  hls_url?: unknown;
  video?: { id?: unknown; session_id?: unknown; last_position?: unknown; thumbnail_url?: unknown };
};

type SessionVideoListPayload = {
  items?: Array<{
    id?: unknown;
    session_id?: unknown;
    thumbnail_url?: unknown;
  }>;
};

type AccessCheckPayload = {
  ok?: unknown;
  access_mode?: unknown;
  monitoring_enabled?: unknown;
  policy_version?: unknown;
};

type StudentObservation = {
  viewport: "desktop" | "mobile";
  bootstraps: Array<PlaybackPayload & { observedAt: number }>;
  renewals: Array<PlaybackPayload & { observedAt: number }>;
  progressPositions: number[];
  endBeforeRenewCount: number;
  consoleErrorCount: number;
  pageErrorCount: number;
  requestErrorCount: number;
  horizontalOverflowCount: number;
  masterLoads: number;
  mediaLoads: number;
  posterLoads: number;
  startedAt: number;
  playbackSeconds: number;
  wallSeconds: number;
  bootstrapCountBeforeRenewal: number;
  initialMasterLoads: number;
  initialMediaLoads: number;
  renewalAdvanceSeconds: number;
  sourceReloadCount: number;
  sameDom: boolean;
  sameSession: boolean;
  tokenRotated: boolean;
  progressPersisted: boolean;
  reloadDriftSeconds: number;
  responseChain: Promise<void>;
  responseFailure: Promise<unknown>;
  responseError: unknown | null;
  resolveResponseFailure: (error: unknown) => void;
  allowedMasterUrls: Set<string>;
  allowedPosterUrls: Set<string>;
  sessionPosterCaptureCount: number;
  accessCheckCount: number;
  playbackApiOrigin: string | null;
  signedOrigins: Set<string>;
};

type LongVideoFailureContext = {
  viewport: "desktop" | "mobile";
  videoMounted: boolean;
  currentTime: number | null;
  duration: number | null;
  wallSeconds: number;
  paused: boolean | null;
  ended: boolean | null;
  readyState: number | null;
  networkState: number | null;
  bootstrapCount: number;
  renewCount: number;
  progressCount: number;
  latestProgress: number | null;
  accessCheckCount: number;
  masterLoads: number;
  mediaLoads: number;
  consoleErrorCount: number;
  pageErrorCount: number;
  requestErrorCount: number;
};

function requiredEnv(name: string, pattern?: RegExp): string {
  const value = process.env[name]?.trim() || "";
  expect(value, `${name} is required`).not.toBe("");
  if (pattern) expect(value, `${name} has an invalid shape`).toMatch(pattern);
  return value;
}

function isSessionVideoList(pathname: string): boolean {
  return /^\/api\/v1\/student\/video\/sessions\/[1-9][0-9]*\/videos\/$/.test(pathname);
}

function sessionIdFromVideoList(pathname: string): number {
  const match = pathname.match(/^\/api\/v1\/student\/video\/sessions\/([1-9][0-9]*)\/videos\/$/);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

function assertPlaybackIdentity(payload: PlaybackPayload): asserts payload is PlaybackPayload & {
  playback_token: string;
  playback_session_id: string;
  playback_expires_at: number;
} {
  expect(payload.playback_token).toEqual(expect.any(String));
  expect(String(payload.playback_token)).not.toBe("");
  expect(payload.playback_session_id).toEqual(expect.any(String));
  expect(String(payload.playback_session_id)).not.toBe("");
  expect(payload.playback_expires_at).toEqual(expect.any(Number));
  expect(Number(payload.playback_expires_at)).toBeGreaterThan(Math.floor(Date.now() / 1000));
}

function assertBootstrapPayload(payload: PlaybackPayload): asserts payload is PlaybackPayload & {
  playback_token: string;
  playback_session_id: string;
  playback_expires_at: number;
  play_url: string;
} {
  assertPlaybackIdentity(payload);
  expect(payload.play_url).toEqual(expect.any(String));
}

function assertRenewalPayload(payload: PlaybackPayload): asserts payload is PlaybackPayload & {
  playback_token: string;
  playback_session_id: string;
  playback_expires_at: number;
  play_url?: null;
} {
  assertPlaybackIdentity(payload);
  expect(payload.play_url == null).toBe(true);
}

function assertSignedMasterUrl(rawUrl: string, hlsPath: string): URL {
  const url = new URL(rawUrl);
  expect(url.protocol).toBe("https:");
  expect(url.username).toBe("");
  expect(url.password).toBe("");
  expect(url.hash).toBe("");
  expect(url.pathname).toBe(`/${hlsPath}`);
  expect([...url.searchParams.keys()].sort()).toEqual(["exp", "kid", "sig", "uid"]);
  expect(url.searchParams.get("kid")).toMatch(/^[A-Za-z0-9._-]{1,32}$/);
  expect(url.searchParams.get("sig")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(url.searchParams.get("uid")).toMatch(/^[1-9][0-9]*$/);
  const expiresAt = Number(url.searchParams.get("exp"));
  const ttl = expiresAt - Math.floor(Date.now() / 1000);
  expect(Number.isInteger(expiresAt)).toBe(true);
  expect(ttl).toBeGreaterThan(MINIMUM_PLAYBACK_SECONDS);
  expect(ttl).toBeLessThanOrEqual(1_800);
  return url;
}

async function captureResponse(
  response: Response,
  state: StudentObservation,
  videoId: number,
): Promise<void> {
  const url = new URL(response.url());
  if (response.status() >= 400) state.requestErrorCount += 1;
  if (response.status() < 200 || response.status() >= 300) return;
  if (response.request().method() === "OPTIONS") return;
  const playbackResponseKind = classifyVideoPlaybackResponse(
    response.url(), response.request().method(), videoId,
  );
  if (playbackResponseKind === "invalid") {
    throw new Error("Unexpected playback endpoint response method or query");
  }
  if (playbackResponseKind === "bootstrap") {
    const payload = await response.json() as PlaybackPayload;
    assertBootstrapPayload(payload);
    expect(payload.video?.id).toBe(videoId);
    const bootstrapSessionId = payload.video?.session_id;
    expect(typeof bootstrapSessionId === "number"
      && Number.isSafeInteger(bootstrapSessionId) && bootstrapSessionId > 0).toBe(true);
    if (state.playbackApiOrigin === null) state.playbackApiOrigin = url.origin;
    expect(url.origin).toBe(state.playbackApiOrigin);
    state.bootstraps.push({ ...payload, observedAt: Date.now() });
    state.allowedMasterUrls.add(payload.play_url);
    const posterUrl = payload.video?.thumbnail_url;
    expect(typeof posterUrl === "string" && posterUrl.length > 0, "bootstrap must return its signed poster URL").toBe(true);
    state.allowedPosterUrls.add(String(posterUrl));
    return;
  }
  if (playbackResponseKind === "access") {
    expect(state.playbackApiOrigin).not.toBeNull();
    expect(url.origin).toBe(state.playbackApiOrigin);
    const payload = await response.json() as AccessCheckPayload;
    expect(payload.ok).toBe(true);
    expect(["FREE_REVIEW", "PROCTORED_CLASS"]).toContain(payload.access_mode);
    expect(typeof payload.monitoring_enabled).toBe("boolean");
    expect(Number.isSafeInteger(payload.policy_version) && Number(payload.policy_version) > 0).toBe(true);
    state.accessCheckCount += 1;
    return;
  }
  if (isSessionVideoList(url.pathname)) {
    expect(state.playbackApiOrigin).not.toBeNull();
    expect(url.origin).toBe(state.playbackApiOrigin);
    expect(response.request().method()).toBe("GET");
    const sessionId = sessionIdFromVideoList(url.pathname);
    const bootstrap = state.bootstraps[0];
    assertBootstrapPayload(bootstrap);
    expect(bootstrap.video?.session_id).toBe(sessionId);
    const payload = await response.json() as SessionVideoListPayload;
    expect(Array.isArray(payload.items)).toBe(true);
    const matchingItems = payload.items!.filter((item) =>
      item.id === videoId && item.session_id === sessionId);
    expect(matchingItems).toHaveLength(1);
    const posterUrl = matchingItems[0].thumbnail_url;
    expect(typeof posterUrl === "string" && posterUrl.length > 0,
      "session video list must return the current video's signed poster URL").toBe(true);
    state.allowedPosterUrls.add(String(posterUrl));
    state.sessionPosterCaptureCount += 1;
    return;
  }
  if (url.pathname === "/api/v1/media/playback/renew/") {
    const payload = await response.json() as PlaybackPayload;
    assertRenewalPayload(payload);
    state.renewals.push({ ...payload, observedAt: Date.now() });
    return;
  }
  if (url.pathname === `/api/v1/student/video/videos/${videoId}/progress/`) {
    const data = response.request().postDataJSON() as { last_position?: unknown } | null;
    const lastPosition = Number(data?.last_position);
    if (Number.isFinite(lastPosition) && lastPosition >= 0) state.progressPositions.push(lastPosition);
  }
}

async function waitForExactMaster(state: StudentObservation, rawUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await state.responseChain;
    if (state.allowedMasterUrls.has(rawUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Synthetic HLS master was not returned by the exact playback API response");
}

async function installSyntheticHlsBridge(
  context: BrowserContext,
  state: StudentObservation,
  hlsPath: string,
  webOrigin: string,
): Promise<void> {
  const directory = `/${hlsPath.slice(0, hlsPath.lastIndexOf("/") + 1)}`;
  await context.route(`**/${hlsPath.split("/").slice(0, -1).join("/")}/**`, async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    expect(request.method()).toBe("GET");
    let asset: "master.m3u8" | "init.mp4" | "media.m4s";
    if (target.pathname === `/${hlsPath}`) {
      await waitForExactMaster(state, request.url());
      const signed = assertSignedMasterUrl(request.url(), hlsPath);
      state.signedOrigins.add(signed.origin);
      state.masterLoads += 1;
      asset = "master.m3u8";
    } else {
      expect(state.masterLoads).toBeGreaterThan(0);
      expect(state.signedOrigins.has(target.origin)).toBe(true);
      expect(target.search === "" || [...state.allowedMasterUrls].some((url) => new URL(url).search === target.search)).toBe(true);
      expect(target.pathname.startsWith(directory)).toBe(true);
      const filename = target.pathname.slice(directory.length);
      expect(["init.mp4", "media.m4s"]).toContain(filename);
      asset = filename as "init.mp4" | "media.m4s";
      state.mediaLoads += 1;
    }
    const fixture = await route.fetch({
      url: `${webOrigin}${SYNTHETIC_ASSET_PREFIX}${asset}`,
      headers: {},
      maxRedirects: 0,
    });
    expect(fixture.status()).toBe(200);
    await route.fulfill({ response: fixture });
  });
}

async function seedStudentSession(
  context: BrowserContext,
  page: Page,
  tenantCode: string,
  username: string,
  password: string,
): Promise<void> {
  const response = await context.request.post(`${getApiBaseUrl()}/api/v1/token/`, {
    headers: { "content-type": "application/json", "x-tenant-code": tenantCode },
    data: { username, password, tenant_code: tenantCode },
  });
  expect(response.status()).toBe(200);
  const tokens = await response.json() as { access?: unknown; refresh?: unknown };
  expect(tokens.access).toEqual(expect.any(String));
  expect(tokens.refresh).toEqual(expect.any(String));
  await page.addInitScript(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { access: String(tokens.access), refresh: String(tokens.refresh), code: tenantCode });
}

function newObservation(viewport: "desktop" | "mobile"): StudentObservation {
  let resolveResponseFailure: (error: unknown) => void = () => undefined;
  const responseFailure = new Promise<unknown>((resolve) => { resolveResponseFailure = resolve; });
  return {
    viewport,
    bootstraps: [],
    renewals: [],
    progressPositions: [],
    endBeforeRenewCount: 0,
    consoleErrorCount: 0,
    pageErrorCount: 0,
    requestErrorCount: 0,
    horizontalOverflowCount: 0,
    masterLoads: 0,
    mediaLoads: 0,
    posterLoads: 0,
    startedAt: 0,
    playbackSeconds: 0,
    wallSeconds: 0,
    bootstrapCountBeforeRenewal: 0,
    initialMasterLoads: 0,
    initialMediaLoads: 0,
    renewalAdvanceSeconds: 0,
    sourceReloadCount: 0,
    sameDom: false,
    sameSession: false,
    tokenRotated: false,
    progressPersisted: false,
    reloadDriftSeconds: Number.POSITIVE_INFINITY,
    responseChain: Promise.resolve(),
    responseFailure,
    responseError: null,
    resolveResponseFailure,
    allowedMasterUrls: new Set(),
    allowedPosterUrls: new Set(),
    sessionPosterCaptureCount: 0,
    accessCheckCount: 0,
    playbackApiOrigin: null,
    signedOrigins: new Set(),
  };
}

async function captureFailureContext(
  page: Page,
  state: StudentObservation,
): Promise<LongVideoFailureContext> {
  let videoMounted = false;
  let media: Pick<LongVideoFailureContext,
    "currentTime" | "duration" | "paused" | "ended" | "readyState" | "networkState"> = {
      currentTime: null,
      duration: null,
      paused: null,
      ended: null,
      readyState: null,
      networkState: null,
    };
  try {
    const video = page.locator("video.svpVideo");
    videoMounted = await video.count() === 1;
    if (videoMounted) {
      media = await video.evaluate((element) => {
        const current = element as HTMLVideoElement;
        const integerOrNull = (value: number) => Number.isFinite(value) ? Math.floor(value) : null;
        return {
          currentTime: integerOrNull(current.currentTime),
          duration: integerOrNull(current.duration),
          paused: current.paused,
          ended: current.ended,
          readyState: current.readyState,
          networkState: current.networkState,
        };
      });
    }
  } catch {
    videoMounted = false;
  }
  return {
    viewport: state.viewport,
    videoMounted,
    ...media,
    wallSeconds: state.startedAt > 0 ? Math.max(0, Math.floor((Date.now() - state.startedAt) / 1_000)) : 0,
    bootstrapCount: state.bootstraps.length,
    renewCount: state.renewals.length,
    progressCount: state.progressPositions.length,
    latestProgress: state.progressPositions.length > 0 ? Math.floor(state.progressPositions.at(-1)!) : null,
    accessCheckCount: state.accessCheckCount,
    masterLoads: state.masterLoads,
    mediaLoads: state.mediaLoads,
    consoleErrorCount: state.consoleErrorCount,
    pageErrorCount: state.pageErrorCount,
    requestErrorCount: state.requestErrorCount,
  };
}

async function prepareStudent(
  browser: Browser,
  viewport: { width: number; height: number },
  viewportName: "desktop" | "mobile",
  username: string,
  password: string,
  tenantCode: string,
  tenantId: number,
  videoId: number,
  hlsPath: string,
  baseUrl: string,
): Promise<{ context: BrowserContext; page: Page; state: StudentObservation }> {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  const page = await context.newPage();
  const state = newObservation(viewportName);
  emitLongVideoCheckpoint(viewportName, "context-created");
  page.on("console", (message) => { if (message.type() === "error") state.consoleErrorCount += 1; });
  page.on("pageerror", () => { state.pageErrorCount += 1; });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const expectedPoster = `/tenants/${tenantId}/video/hls/${videoId}/thumbnail.jpg`;
    if (url.pathname.startsWith("/api/")
      || url.pathname.startsWith(`/${hlsPath.split("/").slice(0, -1).join("/")}/`)
      || url.pathname === expectedPoster) {
      state.requestErrorCount += 1;
    }
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/media/playback/end/" && state.renewals.length === 0) {
      state.endBeforeRenewCount += 1;
    }
  });
  page.on("response", (response) => {
    state.responseChain = state.responseChain
      .then(() => captureResponse(response, state, videoId))
      .catch((error) => {
        state.responseError ??= error;
        state.resolveResponseFailure(error);
      });
  });
  await installSyntheticHlsBridge(context, state, hlsPath, baseUrl);
  await installSyntheticVideoPosterBridge(context, state, tenantId, videoId);
  emitLongVideoCheckpoint(viewportName, "routes-installed");
  await seedStudentSession(context, page, tenantCode, username, password);
  emitLongVideoCheckpoint(viewportName, "authenticated");
  await page.goto(`${baseUrl}/student/video/play?video=${videoId}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await dismissDevelopmentFirstLoginGuide(page, tenantCode);
  emitLongVideoCheckpoint(viewportName, "navigated");
  await expect.poll(() => state.bootstraps.length).toBe(1);
  emitLongVideoCheckpoint(viewportName, "bootstrap-observed");
  await expect.poll(() => state.accessCheckCount).toBeGreaterThanOrEqual(1);
  emitLongVideoCheckpoint(viewportName, "access-observed");
  await expect.poll(() => state.sessionPosterCaptureCount).toBeGreaterThanOrEqual(1);
  emitLongVideoCheckpoint(viewportName, "playlist-observed");
  const video = page.locator("video.svpVideo");
  await expect(video).toHaveCount(1);
  emitLongVideoCheckpoint(viewportName, "video-mounted");
  await expect.poll(() => state.posterLoads).toBeGreaterThanOrEqual(1);
  emitLongVideoCheckpoint(viewportName, "poster-loaded");
  await expect.poll(() => video.evaluate((element) => Number((element as HTMLVideoElement).duration))).toBe(900);
  emitLongVideoCheckpoint(viewportName, "metadata-ready");
  const marker = `${viewportName}-${Date.now()}`;
  await video.evaluate((element, value) => { element.setAttribute("data-e2e-node", value); }, marker);
  emitLongVideoCheckpoint(viewportName, "marker-set");
  const pausedBeforeStart = await video.evaluate((element) => (element as HTMLVideoElement).paused);
  emitLongVideoCheckpoint(viewportName, "playback-state-checked");
  if (pausedBeforeStart) {
    const playControl = page.locator("button.svpBigPlay");
    await expect(playControl).toBeVisible();
    emitLongVideoCheckpoint(viewportName, "play-control-visible");
    await playControl.click();
    emitLongVideoCheckpoint(viewportName, "play-clicked");
  }
  await expect.poll(() => video.evaluate((element) => !(element as HTMLVideoElement).paused)).toBe(true);
  emitLongVideoCheckpoint(viewportName, "playback-running");
  await video.evaluate((element) => {
    const media = element as HTMLVideoElement;
    media.volume = 0.37;
    media.muted = true;
  });
  state.startedAt = Date.now();
  emitLongVideoCheckpoint(viewportName, "playback-started");
  return { context, page, state };
}

async function finishStudent(
  page: Page,
  state: StudentObservation,
  videoId: number,
  hlsPath: string,
): Promise<void> {
  const initial = state.bootstraps[0];
  assertBootstrapPayload(initial);
  const video = page.locator("video.svpVideo");
  await expect.poll(
    () => video.evaluate((element) => (element as HTMLVideoElement).currentTime),
    { timeout: 9 * 60_000, intervals: [1_000] },
  ).toBeGreaterThanOrEqual(530);
  emitLongVideoCheckpoint(state.viewport, "position-530");
  const beforeRenewal = await video.evaluate((element) => {
    const media = element as HTMLVideoElement;
    return {
      marker: element.getAttribute("data-e2e-node"), currentTime: media.currentTime,
      paused: media.paused, rate: media.playbackRate, volume: media.volume, muted: media.muted,
    };
  });
  state.initialMasterLoads = state.masterLoads;
  state.initialMediaLoads = state.mediaLoads;
  expect(state.initialMasterLoads).toBeGreaterThan(0);
  expect(state.initialMediaLoads).toBeGreaterThanOrEqual(2);
  await expect.poll(() => state.renewals.length, { timeout: 10 * 60_000 }).toBe(1);
  emitLongVideoCheckpoint(state.viewport, "renewal-observed");
  const renewed = state.renewals[0];
  assertRenewalPayload(renewed);
  const renewSeconds = (renewed.observedAt - initial.observedAt) / 1_000;
  expect(renewSeconds).toBeGreaterThanOrEqual(MINIMUM_RENEW_SECONDS);
  expect(renewSeconds).toBeLessThanOrEqual(MAXIMUM_RENEW_SECONDS);
  state.bootstrapCountBeforeRenewal = state.bootstraps.length;
  expect(state.bootstraps).toHaveLength(1);
  expect(state.endBeforeRenewCount).toBe(0);

  const renewedAtPosition = await video.evaluate((element) => (element as HTMLVideoElement).currentTime);
  await expect.poll(
    () => video.evaluate((element) => (element as HTMLVideoElement).currentTime),
    { timeout: 15_000, intervals: [500] },
  ).toBeGreaterThanOrEqual(renewedAtPosition + 5);

  const afterRenewal = await video.evaluate((element) => {
    const media = element as HTMLVideoElement;
    return {
      marker: element.getAttribute("data-e2e-node"), currentTime: media.currentTime,
      paused: media.paused, rate: media.playbackRate, volume: media.volume, muted: media.muted,
    };
  });
  state.sameDom = Boolean(beforeRenewal.marker) && afterRenewal.marker === beforeRenewal.marker;
  state.sameSession = initial.playback_session_id === renewed.playback_session_id;
  state.tokenRotated = initial.playback_token !== renewed.playback_token;
  state.renewalAdvanceSeconds = Math.floor(afterRenewal.currentTime - renewedAtPosition);
  state.sourceReloadCount = (state.masterLoads - state.initialMasterLoads) + (state.mediaLoads - state.initialMediaLoads);
  expect(state.sameDom).toBe(true);
  expect(state.sameSession).toBe(true);
  expect(state.tokenRotated).toBe(true);
  expect(afterRenewal.currentTime).toBeGreaterThanOrEqual(beforeRenewal.currentTime + 5);
  expect(state.renewalAdvanceSeconds).toBeGreaterThanOrEqual(5);
  expect(state.masterLoads).toBe(state.initialMasterLoads);
  expect(state.mediaLoads).toBe(state.initialMediaLoads);
  expect(state.sourceReloadCount).toBe(0);
  expect(afterRenewal.paused).toBe(false);
  expect(afterRenewal.rate).toBe(1);
  expect(afterRenewal.volume).toBeCloseTo(0.37, 2);
  expect(afterRenewal.muted).toBe(true);
  emitLongVideoCheckpoint(state.viewport, "renewal-advanced");

  const playbackProof = expect.poll(async () => {
    const current = await video.evaluate((element) => (element as HTMLVideoElement).currentTime);
    const wall = (Date.now() - state.startedAt) / 1_000;
    return Math.min(current, wall);
  }, { timeout: 14 * 60_000, intervals: [1_000] }).toBeGreaterThanOrEqual(MINIMUM_PLAYBACK_SECONDS);
  await Promise.race([playbackProof, state.responseFailure.then((error) => { throw error; })]);
  emitLongVideoCheckpoint(state.viewport, "playback-690");

  await expect.poll(async () => {
    const current = await video.evaluate((element) => (element as HTMLVideoElement).currentTime);
    return state.progressPositions.some((position) => position >= current - 2);
  }, { timeout: 35_000, intervals: [500] }).toBe(true);
  emitLongVideoCheckpoint(state.viewport, "progress-observed");
  await video.evaluate((element) => (element as HTMLVideoElement).pause());
  const persistedPosition = state.progressPositions.at(-1)!;
  state.playbackSeconds = Math.floor(await video.evaluate((element) => (element as HTMLVideoElement).currentTime));
  state.wallSeconds = Math.floor((Date.now() - state.startedAt) / 1_000);

  const bootstrapsBeforeReload = state.bootstraps.length;
  const sessionPosterCapturesBeforeReload = state.sessionPosterCaptureCount;
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect.poll(() => state.bootstraps.length).toBe(bootstrapsBeforeReload + 1);
  emitLongVideoCheckpoint(state.viewport, "reload-bootstrap");
  await expect.poll(() => state.sessionPosterCaptureCount).toBeGreaterThan(sessionPosterCapturesBeforeReload);
  emitLongVideoCheckpoint(state.viewport, "reload-playlist");
  const reloadedBootstrap = state.bootstraps.at(-1)!;
  const apiPosition = Number(reloadedBootstrap.video?.last_position);
  expect(Number.isFinite(apiPosition)).toBe(true);
  expect(Math.abs(apiPosition - persistedPosition)).toBeLessThanOrEqual(2);
  const reloadedVideo = page.locator("video.svpVideo");
  await expect(reloadedVideo).toHaveCount(1);
  await expect.poll(() => reloadedVideo.evaluate((element) => Number((element as HTMLVideoElement).duration))).toBe(900);
  emitLongVideoCheckpoint(state.viewport, "reload-metadata");
  await expect.poll(
    () => reloadedVideo.evaluate((element) => (element as HTMLVideoElement).currentTime),
  ).toBeGreaterThanOrEqual(persistedPosition - 2);
  const resumedPosition = await reloadedVideo.evaluate((element) => (element as HTMLVideoElement).currentTime);
  state.reloadDriftSeconds = Math.round(Math.abs(resumedPosition - persistedPosition));
  state.progressPersisted = state.reloadDriftSeconds <= 2;
  expect(state.progressPersisted).toBe(true);
  emitLongVideoCheckpoint(state.viewport, "reload-progress");

  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  state.horizontalOverflowCount += overflow > 1 ? 1 : 0;
  expect(overflow).toBeLessThanOrEqual(1);
  expect(state.consoleErrorCount).toBe(0);
  expect(state.pageErrorCount).toBe(0);
  expect(state.requestErrorCount).toBe(0);

  const endCount = await page.locator('a[href="/student/video"]').count();
  expect(endCount).toBeGreaterThan(0);
  const endResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/media/playback/end/" && response.status() < 300,
  { timeout: 10_000 });
  await page.locator('a[href="/student/video"]').first().evaluate((element) => (element as HTMLElement).click());
  await endResponse;
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await state.responseChain;
  if (state.responseError) throw state.responseError;
  expect(state.bootstraps).toHaveLength(2);
  expect(state.renewals).toHaveLength(1);
  expect(state.allowedMasterUrls.size).toBe(2);
  expect([...state.allowedMasterUrls].every((url) => new URL(url).pathname === `/${hlsPath}`)).toBe(true);
  expect(state.allowedPosterUrls.size).toBeGreaterThanOrEqual(1);
  emitLongVideoCheckpoint(state.viewport, "completed");
}

test("two students play through renewal and persist progress without interruption", async ({ browser }) => {
  test.setTimeout(17 * 60_000);
  const tenantCode = requiredEnv("E2E_TENANT_CODE", /^qa-ymath-realuse-[a-z0-9-]+$/);
  const student1 = requiredEnv("E2E_STUDENT_USER", /^ymath-qa-student-01$/);
  const student2 = requiredEnv("E2E_STUDENT2_USER", /^ymath-qa-student-02$/);
  const password1 = requiredEnv("E2E_STUDENT_PASS");
  const password2 = requiredEnv("E2E_STUDENT2_PASS");
  const tenantId = Number(requiredEnv("E2E_LONG_VIDEO_TENANT_ID", /^[1-9][0-9]*$/));
  const videoId = Number(requiredEnv("E2E_LONG_VIDEO_ID", /^[1-9][0-9]*$/));
  const hlsPath = requiredEnv("E2E_LONG_VIDEO_HLS_PATH", /^qa-fixtures\/video-long\/master\.m3u8$/);
  const baseUrl = getBaseUrl();
  expect(baseUrl).toBe("http://localhost:4173");

  const runs = await Promise.all([
    prepareStudent(browser, { width: 1366, height: 768 }, "desktop", student1, password1,
      tenantCode, tenantId, videoId, hlsPath, baseUrl),
    prepareStudent(browser, { width: 390, height: 844 }, "mobile", student2, password2,
      tenantCode, tenantId, videoId, hlsPath, baseUrl),
  ]);
  try {
    await Promise.all(runs.map(({ page, state }) => finishStudent(page, state, videoId, hlsPath)));
  } catch (error) {
    console.log(JSON.stringify({ longVideoFailure: {
      schema: "student-video-renewal-failure/v1",
      contexts: await Promise.all(runs.map(({ page, state }) => captureFailureContext(page, state))),
    } }));
    throw error;
  } finally {
    await Promise.all(runs.map(({ context }) => context.close()));
  }

  const states = runs.map(({ state }) => state);
  console.log(JSON.stringify({ longVideoRealUse: {
    schema: "student-video-renewal/v1",
    contexts: states.length,
    desktop: states.filter((state) => state.viewport === "desktop").length,
    mobile: states.filter((state) => state.viewport === "mobile").length,
    minimumPlaybackSeconds: Math.min(...states.map((state) => state.playbackSeconds)),
    minimumWallSeconds: Math.min(...states.map((state) => state.wallSeconds)),
    bootstrapCount: states.reduce((total, state) => total + state.bootstrapCountBeforeRenewal, 0),
    renewCount: states.reduce((total, state) => total + state.renewals.length, 0),
    endBeforeRenewCount: states.reduce((total, state) => total + state.endBeforeRenewCount, 0),
    initialMasterLoadCount: states.reduce((total, state) => total + state.initialMasterLoads, 0),
    initialMediaLoadCount: states.reduce((total, state) => total + state.initialMediaLoads, 0),
    posterLoadCount: states.reduce((total, state) => total + state.posterLoads, 0),
    minimumRenewalAdvanceSeconds: Math.min(...states.map((state) => state.renewalAdvanceSeconds)),
    sourceReloadCount: states.reduce((total, state) => total + state.sourceReloadCount, 0),
    sameDomCount: states.filter((state) => state.sameDom).length,
    sameSessionCount: states.filter((state) => state.sameSession).length,
    tokenRotationCount: states.filter((state) => state.tokenRotated).length,
    progressPersistedCount: states.filter((state) => state.progressPersisted).length,
    maxReloadDriftSeconds: Math.max(...states.map((state) => state.reloadDriftSeconds)),
    consoleErrorCount: states.reduce((total, state) => total + state.consoleErrorCount, 0),
    pageErrorCount: states.reduce((total, state) => total + state.pageErrorCount, 0),
    requestErrorCount: states.reduce((total, state) => total + state.requestErrorCount, 0),
    horizontalOverflowCount: states.reduce((total, state) => total + state.horizontalOverflowCount, 0),
  } }));
});
