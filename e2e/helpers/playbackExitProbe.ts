import { expect, type BrowserContext, type Page, type Request, type Response } from "../fixtures/strictTest";
import { createSerialProofGate } from "./serialProofGate";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Prepared = {
  context: BrowserContext;
  page: Page;
  state: {
    bootstraps: Array<{ playback_token?: unknown; playback_session_id?: unknown }>;
    renewals: Array<{ playback_token?: unknown; playback_session_id?: unknown }>;
    responseChain: Promise<void>;
    responseError: unknown | null;
    requestErrorCount: number;
  };
};
type Prepare = (
  viewport: { width: number; height: number }, viewportName: "desktop" | "mobile",
  username: string, password: string, tenantCode: string, tenantId: number,
  videoId: number, hlsPath: string, baseUrl: string,
) => Promise<Prepared>;

const END_PATH = "/api/v1/media/playback/end/";
const EVENTS_PATH = "/api/v1/media/playback/events/";
const PROBE_SCHEMA = "student-playback-exit-probe/v1";
const CHECKPOINT_SCHEMA = "student-playback-exit-checkpoint/v1";
const STATE_KEYS = ["active_playback_sessions", "playback_sessions", "playback_events", "violated_events", "player_errors"] as const;
type VideoState = Record<typeof STATE_KEYS[number], number>;

async function checkpoint(phase: string): Promise<VideoState> {
  const directory = path.resolve(required("E2E_PLAYBACK_EXIT_CHECKPOINT_DIR"));
  const artifactRoot = path.resolve("C:/academy/_artifacts/release-playback-exit-0913");
  expect(directory.startsWith(`${artifactRoot}${path.sep}`), "probe:owned-checkpoint-directory").toBe(true);
  await writeFile(path.join(directory, `${phase}.request.json`), JSON.stringify({ schema: CHECKPOINT_SCHEMA, phase }), { flag: "wx" });
  let observed: VideoState | null = null;
  await expect.poll(async () => {
    try {
      const response = JSON.parse(await readFile(path.join(directory, `${phase}.response.json`), "utf8")) as Record<string, unknown>;
      const state = response.syntheticVideoState as VideoState | undefined;
      const valid = Object.keys(response).sort().join(",") === "ok,phase,schema,syntheticVideoState"
        && response.schema === CHECKPOINT_SCHEMA && response.phase === phase && response.ok === true
        && state && Object.keys(state).sort().join(",") === [...STATE_KEYS].sort().join(",")
        && STATE_KEYS.every((key) => Number.isInteger(state[key]) && state[key] >= 0 && state[key] <= 1000);
      if (!valid) throw new Error("probe:checkpoint-response-invalid");
      observed = state!;
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw new Error("probe:checkpoint-response-invalid");
    }
  }, { timeout: 250_000, intervals: [500], message: "probe:fixed-inspect-checkpoint" }).toBe(true);
  return observed!;
}

function required(name: string, pattern?: RegExp): string {
  const value = process.env[name] || "";
  expect(Boolean(value) && (!pattern || pattern.test(value)), `probe-env:${name}`).toBe(true);
  return value;
}

async function revealPlaybackControls(page: Page): Promise<void> {
  const wrap = page.locator(".svpPlayerWrap");
  if ((await wrap.getAttribute("class"))?.includes("svpPlayerWrap--controlsHidden")) {
    const gesture = page.locator(".svpGestureLayer");
    const bounds = await gesture.boundingBox();
    expect(bounds !== null && bounds.width > 0 && bounds.height > 0, "probe:gesture-bounds").toBe(true);
    // A normal side-zone single tap reveals controls without the center's play/pause action.
    await gesture.click({ position: { x: bounds!.width * 0.25, y: bounds!.height * 0.5 } });
  }
  await expect(wrap).not.toHaveClass(/svpPlayerWrap--controlsHidden/);
  await expect(page.locator(".svpTopBar")).toHaveCSS("opacity", "1");
}

/** Ordinary UI actions; verify each current-session audit batch is fully stored. */
export async function exerciseFullscreenAudit(page: Page, expectedToken: unknown): Promise<void> {
  expect(typeof expectedToken === "string" && expectedToken.length > 0, "playback-audit:current-token").toBe(true);
  for (const entering of [true, false]) {
    const eventType = entering ? "FULLSCREEN_ENTER" : "FULLSCREEN_EXIT";
    await revealPlaybackControls(page);
    const responsePromise = page.waitForResponse((response) => {
      if (response.request().method() !== "POST" || new URL(response.url()).pathname !== EVENTS_PATH) return false;
      const body = response.request().postDataJSON() as { events?: Array<{ type?: unknown }> };
      return body.events?.some((event) => event.type === eventType) === true;
    });
    const [response] = await Promise.all([
      responsePromise,
      page.getByRole("button", { name: entering ? "전체화면" : "전체화면 종료", exact: true })
        .filter({ visible: true }).first().click(),
    ]);
    const body = response.request().postDataJSON() as { token?: unknown; events?: Array<{ type?: unknown }> };
    expect(body.token === expectedToken, "playback-audit:session-token-match").toBe(true);
    expect(response.status(), "playback-audit:events-status").toBe(201);
    const payload = await response.json() as { stored?: unknown };
    expect(Array.isArray(body.events) && body.events.length > 0, "playback-audit:events-shape").toBe(true);
    expect(payload.stored, "playback-audit:complete-batch-stored").toBe(body.events!.length);
    expect(body.events!.every((event) => ["FULLSCREEN_ENTER", "FULLSCREEN_EXIT", "FOCUS_LOST", "FOCUS_GAINED",
      "VISIBILITY_HIDDEN", "VISIBILITY_VISIBLE"].includes(String(event.type))), "playback-audit:nonviolating-types").toBe(true);
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(entering);
  }
}

/** IDs/tokens stay in this function's memory. Only bounded counts/booleans leave it. */
export async function runPlaybackExitProbe(prepare: Prepare): Promise<void> {
  expect(process.env.E2E_PLAYBACK_EXIT_PROBE).toBe("1");
  expect(process.env.E2E_RELEASE_API_MODE).toBe("development");
  expect(process.env.E2E_STRICT).toBe("strict");
  expect(process.env.E2E_ALLOW_PRODUCTION_WRITES).toBe("0");
  expect(process.env.E2E_ALLOW_REAL_ALIMTALK).toBe("0");
  const baseUrl = required("E2E_BASE_URL", /^http:\/\/localhost:4173$/);
  required("E2E_API_URL", /^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/);
  const tenantCode = required("E2E_TENANT_CODE", /^qa-ymath-realuse-[a-z0-9-]+$/);
  const tenantId = Number(required("E2E_LONG_VIDEO_TENANT_ID", /^[1-9][0-9]*$/));
  const videoId = Number(required("E2E_LONG_VIDEO_ID", /^[1-9][0-9]*$/));
  const hlsPath = required("E2E_LONG_VIDEO_HLS_PATH", /^qa-fixtures\/video-long\/master\.m3u8$/);
  const contexts: BrowserContext[] = [];
  const observations: Array<Record<string, unknown>> = [];
  const serial = createSerialProofGate();
  try {
    for (const viewport of ["desktop", "mobile"] as const) {
      await serial(async () => {
        const mobile = viewport === "mobile";
        const run = await prepare(mobile ? { width: 390, height: 844 } : { width: 1366, height: 768 },
          viewport, required(mobile ? "E2E_STUDENT2_USER" : "E2E_STUDENT_USER", mobile ? /^ymath-qa-student-02$/ : /^ymath-qa-student-01$/),
          required(mobile ? "E2E_STUDENT2_PASS" : "E2E_STUDENT_PASS"), tenantCode, tenantId, videoId, hlsPath, baseUrl);
        contexts.push(run.context);
        const { page, state } = run;
        const endTokens: string[] = [];
        const attemptedEndTokens: string[] = [];
        const acceptedEndTokens: string[] = [];
        let eventStoredCount = 0;
        let fullscreenEnterStoredCount = 0;
        let fullscreenExitStoredCount = 0;
        let unexpectedEventTypeCount = 0;
        let initialInspect: VideoState | null = null;
        let reloadInspect: VideoState | null = null;
        let navigationInspect: VideoState | null = null;
        const generationFor = (token: string) => {
          const identity = [...state.bootstraps, ...state.renewals].find((item) => item.playback_token === token)?.playback_session_id;
          return identity ? state.bootstraps.findIndex((item) => item.playback_session_id === identity) + 1 : 0;
        };
        let responseError: unknown = null;
        const responseGate = createSerialProofGate();
        const pending: Promise<void>[] = [];
        const observeRequest = (request: Request) => {
          if (request.method() !== "POST" || new URL(request.url()).pathname !== END_PATH) return;
          const body = request.postDataJSON() as { token?: unknown };
          attemptedEndTokens.push(typeof body.token === "string" ? body.token : "");
        };
        const observe = (response: Response) => {
          const request = response.request();
          const path = new URL(response.url()).pathname;
          if (request.method() !== "POST" || ![END_PATH, EVENTS_PATH].includes(path)) return;
          const proof = responseGate(async () => {
            const body = request.postDataJSON() as { token?: unknown; events?: Array<{ type?: unknown }> };
            expect(typeof body.token === "string", "probe:token-shape").toBe(true);
            if (path === END_PATH) {
              endTokens.push(String(body.token));
              expect(response.status(), "probe:end-status").toBe(200);
              const payload = await response.json() as { ok?: unknown };
              expect(payload.ok, "probe:end-ok").toBe(true);
              acceptedEndTokens.push(String(body.token));
            } else {
              expect(response.status(), "probe:events-status").toBe(201);
              const payload = await response.json() as { stored?: unknown };
              expect(Array.isArray(body.events), "probe:events-shape").toBe(true);
              expect(payload.stored, "probe:events-stored").toBe(body.events!.length);
              eventStoredCount += Number(payload.stored);
              for (const event of body.events!) {
                if (event.type === "FULLSCREEN_ENTER") fullscreenEnterStoredCount++;
                else if (event.type === "FULLSCREEN_EXIT") fullscreenExitStoredCount++;
                else if (!["FOCUS_LOST", "FOCUS_GAINED", "VISIBILITY_HIDDEN", "VISIBILITY_VISIBLE"].includes(String(event.type))) unexpectedEventTypeCount++;
              }
            }
          });
          pending.push(proof);
          void proof.catch((error) => { responseError ??= error; });
        };
        page.on("response", observe);
        page.on("request", observeRequest);
        let stage = "initial-playback";
        const snapshot = () => ({
          viewport, stage, bootstrapCount: state.bootstraps.length,
          distinctSessionCount: new Set(state.bootstraps.map((item) => item.playback_session_id)).size,
          firstEndRequestCount: attemptedEndTokens.filter((token) => generationFor(token) === 1).length,
          firstEndResponseCount: endTokens.filter((token) => generationFor(token) === 1).length,
          firstEndAcceptedCount: acceptedEndTokens.filter((token) => generationFor(token) === 1).length,
          reloadedEndRequestCount: attemptedEndTokens.filter((token) => generationFor(token) === 2).length,
          reloadedEndResponseCount: endTokens.filter((token) => generationFor(token) === 2).length,
          reloadedEndAcceptedCount: acceptedEndTokens.filter((token) => generationFor(token) === 2).length,
          unknownEndTokenCount: attemptedEndTokens.filter((token) => generationFor(token) === 0).length,
          eventStoredCount, fullscreenEnterStoredCount, fullscreenExitStoredCount,
          unexpectedEventTypeCount, requestErrorCount: state.requestErrorCount,
          initialActiveCount: initialInspect?.active_playback_sessions ?? null,
          reloadActiveCount: reloadInspect?.active_playback_sessions ?? null,
          navigationActiveCount: navigationInspect?.active_playback_sessions ?? null,
          navigationSessionCount: navigationInspect?.playback_sessions ?? null,
          navigationEventCount: navigationInspect?.playback_events ?? null,
          navigationViolationCount: navigationInspect?.violated_events ?? null,
          navigationPlayerErrorCount: navigationInspect?.player_errors ?? null,
        });
        try {
          const video = page.locator("video.svpVideo");
          await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(3);
          initialInspect = await checkpoint(`${viewport}-initial-play`);
          await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 });
          await expect.poll(() => state.bootstraps.length).toBe(2);
          await state.responseChain;
          if (state.responseError) throw state.responseError;
          expect(state.bootstraps[0].playback_session_id !== state.bootstraps[1].playback_session_id, "probe:new-generation").toBe(true);
          await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).duration)).toBe(900);
          if (await video.evaluate((element) => (element as HTMLVideoElement).paused)) {
            await page.locator("button.svpBigPlay").click();
          }
          const position = await video.evaluate((element) => (element as HTMLVideoElement).currentTime);
          await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(position + 3);
          stage = "reload-playing";
          console.log(JSON.stringify({ playbackExitProbe: { schema: PROBE_SCHEMA, contexts: [snapshot()] } }));
          reloadInspect = await checkpoint(`${viewport}-reload-play`);

          // Actual visible controls, not dispatchEvent/requestFullscreen()/direct event POST.
          await exerciseFullscreenAudit(page, state.bootstraps.at(-1)?.playback_token);
          await expect.poll(() => fullscreenEnterStoredCount).toBeGreaterThanOrEqual(1);
          await expect.poll(() => fullscreenExitStoredCount).toBeGreaterThanOrEqual(1);
          stage = "fullscreen-stored";
          const endResponse = page.waitForResponse((response) => response.request().method() === "POST"
            && new URL(response.url()).pathname === END_PATH
            && generationFor(String((response.request().postDataJSON() as { token?: unknown }).token)) === 2,
          { timeout: 45_000 });
          await page.locator('a[href="/student/video"]').filter({ visible: true }).first().click();
          await endResponse;
          await expect(page).toHaveURL(`${baseUrl}/student/video`);
          await expect.poll(() => acceptedEndTokens.filter((token) => generationFor(token) === 2).length).toBe(1);
          await state.responseChain;
          await Promise.allSettled(pending);
          if (state.responseError) throw state.responseError;
          if (responseError) throw responseError;
          expect(unexpectedEventTypeCount, "probe:nonviolating-event-types").toBe(0);
          expect(state.requestErrorCount, "probe:request-errors").toBe(0);
          stage = "ordinary-navigation-ended";
          navigationInspect = await checkpoint(`${viewport}-navigation`);
        } finally {
          await Promise.allSettled(pending);
          page.off("response", observe);
          page.off("request", observeRequest);
          observations.push(snapshot());
          console.log(JSON.stringify({ playbackExitProbe: { schema: PROBE_SCHEMA, contexts: [snapshot()] } }));
        }
      });
    }
    // Do not stop after the first RED: retain both viewports' positive event/end evidence.
    expect(observations).toHaveLength(2);
    // The old page can lose its response event even when keepalive reaches the server.
    // Only exact server state decides successful closure; response counts are diagnostics.
    expect(observations.every((item) => item.navigationViolationCount === 0 && item.navigationPlayerErrorCount === 0),
      "probe:server-nonviolating-events").toBe(true);
    expect(observations[0].navigationEventCount, "probe:desktop-events-stored").toBeGreaterThanOrEqual(2);
    expect(observations[1].navigationEventCount, "probe:both-context-events-stored").toBeGreaterThanOrEqual(4);
    expect(observations.every((item) => item.initialActiveCount === 1 && item.reloadActiveCount === 1
      && item.navigationActiveCount === 0), "probe:server-sessions-must-close").toBe(true);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close())).then((outcomes) => {
      const failed = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
      if (failed) throw failed.reason;
    });
  }
}
