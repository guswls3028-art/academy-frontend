import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DIAGNOSTIC_LABEL = "public-video-provider-diagnostic";
export const WEB_ORIGIN = "http://localhost:4173";
export const CONTEXT_BUDGET_MS = 30_000;
export const CLEANUP_STEP_MS = 5_000;
const VIDEO_ID = "xgjL2HyrdFM";
const OUTPUT = path.join(ROOT, "test-results/public-video-provider-diagnostic");
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

export function assertDiagnosticInvocation(env, event, sourceSha) {
  assert.equal(env.GITHUB_ACTIONS, "true", "Hosted diagnostic invocation required");
  assert.equal(env.GITHUB_REPOSITORY, "guswls3028-art/academy-frontend");
  assert.match(sourceSha, /^[0-9a-f]{40}$/);
  assert.equal(env.PROVIDER_DIAGNOSTIC_SOURCE_SHA, sourceSha);
  assert.ok(env.GITHUB_EVENT_NAME === "workflow_dispatch"
    || (env.GITHUB_EVENT_NAME === "pull_request" && event.action === "labeled"
      && event.label?.name === DIAGNOSTIC_LABEL
      && event.pull_request?.head?.repo?.full_name === env.GITHUB_REPOSITORY
      && event.pull_request?.head?.sha === sourceSha));
}

export function diagnosticHtml() {
  const params = new URLSearchParams({ autoplay: "0", playsinline: "1", origin: WEB_ORIGIN });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Public provider diagnostic</title></head>
<body><iframe title="Public provider diagnostic" width="782" height="440"
src="https://www.youtube.com/embed/${VIDEO_ID}?${params}"
allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure https://www.youtube.com"
allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
}

export function prepareDiagnosticSources(boundarySource, specSource) {
  const registration = "const publicVideoIds = new Set<string>();";
  assert.equal(boundarySource.split(registration).length, 2, "Diagnostic fixture registration drift");
  const source = boundarySource.replace(registration,
    `const publicVideoIds = new Set<string>([${JSON.stringify(VIDEO_ID)}]);`);
  const begin = specSource.indexOf("function readPublicVideoPlayback(");
  const end = specSource.indexOf("test.setTimeout(", begin);
  assert.ok(begin >= 0 && end > begin, "Release playback predicate missing");
  assert.equal(specSource.split("function readPublicVideoPlayback(").length, 2);
  const playbackSource = stripTypeScriptTypes(specSource.slice(begin, end));
  return { source, playbackSource };
}

export function prepareNativeDiagnosticSource(source) {
  const startMarker = "          // Relay actual provider responses and validate any permitted read hop.";
  const endMarker = "          await route.fulfill({ response });";
  assert.equal(source.split(startMarker).length, 2, "Native diagnostic relay start drift");
  const start = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && endIndex > start, "Native diagnostic relay end drift");
  const end = endIndex + endMarker.length;
  // Only this in-memory diagnostic module changes transport. Production source,
  // credentials, source/frame admission, native keepalive and close remain intact.
  return source.slice(0, start) + `          nativeDiagnosticController.assertReady();
          await route.continue();
          const response = await request.response();
          if (!response) throw new Error("native-diagnostic-response");
          if (publicVideoKind === "embed" && playerFrame && response.status() === 200) publicVideoFrames.add(playerFrame);
` + source.slice(end) + `
let nativeDiagnosticController;
export function setNativeDiagnosticController(controller) { nativeDiagnosticController = controller; }
`;
}

export async function loadPolicy(source) {
  return import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source
    + "\nexport { publicVideoRequestKind, PUBLIC_VIDEO_PROVIDERS };\n")).toString("base64"));
}

export function nativeDiagnosticBridge(controller) {
  return { assertReady() {
    controller.assertClean();
    const state = controller.snapshot();
    assert.equal(state.closed, false);
    assert.equal(state.closing, false);
  } };
}

export function closedNativeEvidence(controller) {
  const state = controller.snapshot();
  assert.equal(state.closed, true);
  assert.equal(state.activeRequests, 0);
  assert.equal(state.activeHandlers, 0);
  assert.equal(state.pendingResponseHeaders, 0);
  assert.equal(state.pendingCommands, 0);
  assert.ok(Number.isSafeInteger(state.intentionalClosingAborts) && state.intentionalClosingAborts >= 0 && state.intentionalClosingAborts <= 10000);
  assert.ok(Array.isArray(state.failures) && state.failures.every(code => typeof code === "string" && /^[a-z-]{1,40}$/.test(code)));
  assert.ok(Object.entries(state.responseCounts).every(([key, count]) => /^(embed|thumbnail|player):[1-5][0-9]{2}$/.test(key)
    && Number.isSafeInteger(count) && count >= 0 && count <= 10000));
  return { failures: state.failures, closed: true, activeRequests: 0, activeHandlers: 0, pendingResponseHeaders: 0, pendingCommands: 0,
    intentionalClosingAborts: state.intentionalClosingAborts, responseCounts: state.responseCounts };
}

export function isApplicationApiRequest(rawUrl) {
  const url = new URL(rawUrl);
  return url.origin === "http://127.0.0.1:18000" || url.pathname.startsWith("/api/v1/");
}

export async function boundedCleanup(operation, timeoutMs = CLEANUP_STEP_MS) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation).then(() => "ok", () => "failed"),
      new Promise(resolve => { timer = setTimeout(() => resolve("timeout"), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function runBoundedOperation(operation, result, closeOnDeadline,
  { timeoutMs = CONTEXT_BUDGET_MS, cleanupMs = CLEANUP_STEP_MS } = {}) {
  let timer, deadlineClose;
  let expired = false;
  const assertActive = () => assert.equal(expired, false, "diagnostic-operation-deadline");
  try {
    await Promise.race([
      Promise.resolve().then(() => operation(assertActive)),
      new Promise((_, reject) => { timer = setTimeout(() => {
        expired = true;
        result.deadlineExceeded = true;
        deadlineClose = boundedCleanup(closeOnDeadline, cleanupMs);
        reject(new Error("diagnostic-operation-deadline"));
      }, timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
    if (deadlineClose) result.deadlineClose = await deadlineClose;
  }
}

export function assertContextCleanup(result) {
  assert.equal(result.contextClosed, true, "diagnostic-context-not-closed");
  assert.equal(result.cleanupPassed, true, "diagnostic-context-cleanup-failed");
}

export async function finishDiagnosticContext({ guard, controller, context, result, timeoutMs = CLEANUP_STEP_MS }) {
  let boundaryPassed = !!guard;
  let controllerPassed = result.mode === "relay" || !!controller;
  const onClosed = () => { result.contextClosed = true; };
  context.once("close", onClosed);
  const [guardDrain, nativeDrain] = await Promise.all([
    guard ? boundedCleanup(() => guard.beginClose(), timeoutMs) : "missing",
    controller ? boundedCleanup(() => controller.beginClose(), timeoutMs) : result.mode === "relay" ? "not-required" : "missing",
  ]);
  // Each close is attempted even when either drain stalls or rejects.
  const [nativeClose, contextClose] = await Promise.all([
    controller ? boundedCleanup(() => controller.close(), timeoutMs) : result.mode === "relay" ? "not-required" : "missing",
    boundedCleanup(() => context.close(), timeoutMs),
  ]);
  context.off("close", onClosed);
  // A resolved fake/failed close without an actual close event is not proof.
  if (!result.contextClosed) {
    try { result.contextClosed = context.browser()?.contexts().includes(context) === false; }
    catch { result.contextClosed = false; }
  }
  boundaryPassed &&= guardDrain === "ok";
  controllerPassed &&= [nativeDrain, nativeClose].every(value => value === "ok" || value === "not-required");
  // Teardown can reveal late violations. Judge only after both closes completed.
  try { guard?.assertClean(); } catch { boundaryPassed = false; }
  try { controller?.assertClean(); } catch { controllerPassed = false; }
  result.boundaryPassed = result.cleanup && result.boundaryPassed === false ? false : boundaryPassed;
  result.controllerPassed = result.cleanup && result.controllerPassed === false ? false : controllerPassed;
  const cleanup = { guardDrain, nativeDrain, nativeClose, contextClose };
  // Preserve failures if cleanup is attempted again by a surrounding finally.
  const passed = Object.values(cleanup).every(value => value === "ok" || value === "not-required") && result.contextClosed;
  result.cleanupPassed = result.cleanupPassed === false ? false : passed;
  if (!result.cleanup) result.cleanup = cleanup;
  else for (const [name, value] of Object.entries(cleanup)) {
    if (result.cleanup[name] === "ok" || result.cleanup[name] === "not-required") result.cleanup[name] = value;
  }
}

export async function finishDiagnosticResources({ browser, server, timeoutMs = CLEANUP_STEP_MS }) {
  const [browserClose, serverClose] = await Promise.all([
    browser ? boundedCleanup(() => browser.close(), timeoutMs) : "not-required",
    boundedCleanup(() => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    }), timeoutMs),
  ]);
  const browserClosed = !browser || !browser.isConnected();
  const serverClosed = serverClose === "ok" && !server.listening;
  return { browserClose, serverClose, browserClosed, serverClosed,
    passed: (browserClose === "ok" || browserClose === "not-required") && browserClosed && serverClosed };
}

async function runDiagnostic() {
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  assertDiagnosticInvocation(process.env, event, sourceSha);
  // Both transports must be available before contacting any external provider.
  const { installNativeResponseGuard } = await import("./public-video-native-diagnostic.mjs");
  const { chromium, expect } = await import("@playwright/test");
  const boundarySource = fs.readFileSync(path.join(ROOT, "e2e/helpers/releaseApiBoundary.ts"), "utf8");
  const specSource = fs.readFileSync(path.join(ROOT, "e2e/admin/public-video-realuse.spec.ts"), "utf8");
  const { source, playbackSource } = prepareDiagnosticSources(boundarySource, specSource);
  const sample = Function(playbackSource + "\nreturn readPublicVideoPlayback;")();
  const nativeSource = prepareNativeDiagnosticSource(source);
  const policies = { relay: await loadPolicy(source), native: await loadPolicy(nativeSource) };
  const report = { schema: "public-video-provider-diagnostic/v1", sourceSha,
    runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
    runnerOs: process.env.RUNNER_OS, runnerImage: process.env.ImageOS, runnerImageVersion: process.env.ImageVersion,
    diagnosticOnly: true, promotable: false, qaSourceAdmissionTested: false,
    fixtureRegistration: "fixed-existing-public-video", providerIdentityOverrides: false,
    authenticatedAccounts: false, sharedQaAccess: false, productionAccess: false,
    contextBudgetMs: CONTEXT_BUDGET_MS, cleanupStepBudgetMs: CLEANUP_STEP_MS,
    guardSha256: sha256(boundarySource), playbackSha256: sha256(playbackSource),
    nativeDiagnosticSha256: sha256(nativeSource), outcomes: [], cleanupPassed: false, passed: false };
  fs.mkdirSync(OUTPUT, { recursive: true });
  const save = () => fs.writeFileSync(path.join(OUTPUT, "diagnostic.json"), JSON.stringify(report, null, 2) + "\n");
  save();
  const server = http.createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/" || request.headers.host !== "localhost:4173") {
      response.writeHead(404); response.end(); return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(diagnosticHtml());
  });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(4173, "127.0.0.1", resolve); });
    browser = await chromium.launch({ headless: true });
    report.browserVersion = browser.version();
    const boundary = { mode: "development", webOrigin: WEB_ORIGIN,
      apiOrigin: "http://127.0.0.1:18000", tenantCode: "qa-public-provider-diagnostic" };
    for (const mode of ["relay", "native"]) {
      const result = { mode, stage: "setup", playing: false, pausedAfterPlay: false,
        deadlineExceeded: false, boundaryPassed: false, controllerPassed: mode === "relay",
        contextClosed: false, apiRequests: 0, playback: null, passed: false };
      report.outcomes.push(result); save();
      let context, guard, controller;
      try {
        await runBoundedOperation(async assertActive => {
        context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1366, height: 900 } });
        context.once("close", () => { result.contextClosed = true; });
        assertActive();
        assert.equal((await context.cookies()).length, 0);
        context.on("request", request => {
          if (isApplicationApiRequest(request.url())) result.apiRequests++;
        });
        const policy = policies[mode];
        guard = await policy.installReleaseContextGuard(context, boundary);
        assertActive();
        const page = await context.newPage();
        assertActive();
        page.setDefaultTimeout(8_000);
        if (mode === "native") {
          controller = await installNativeResponseGuard(context, page, { webOrigin: WEB_ORIGIN,
            fixedEmbedUrl: `https://www.youtube.com/embed/${VIDEO_ID}?${new URLSearchParams({ autoplay: "0", playsinline: "1", origin: WEB_ORIGIN })}`,
            classify: (url, method, type, trusted) => policy.publicVideoRequestKind(boundary, url, method, type, new Set([VIDEO_ID]), trusted),
            admissionGuardInstalled: true, deadlineMs: CONTEXT_BUDGET_MS,
            responseUrlPatterns: policy.PUBLIC_VIDEO_PROVIDERS.flatMap(host => [`https://${host}/*`, `https://*.${host}/*`]) });
          const bridge = nativeDiagnosticBridge(controller);
          bridge.assertReady();
          policy.setNativeDiagnosticController(bridge);
        }
        assertActive();
        result.stage = "player-ready";
        await page.goto(WEB_ORIGIN, { waitUntil: "domcontentloaded", timeout: 30_000 });
        const player = page.frameLocator("iframe");
        const play = player.getByRole("button", { name: /^(?:Play(?: video)?|동영상 재생|재생)(?: \(k\))?$/i }).filter({ visible: true }).first();
        await expect(play).toBeVisible({ timeout: 30_000 });
        await expect(player.locator(".ytp-error")).toBeHidden();
        assertActive();
        result.stage = "player-playing";
        await play.click();
        const media = player.locator("#movie_player video.html5-main-video").first();
        const initialTime = await media.evaluate(node => node.currentTime);
        const read = () => media.evaluate(sample, { initialTime, expectedId: VIDEO_ID });
        await expect.poll(async () => { const value = await read(); result.playback = value.snapshot; return value.playing; }, { timeout: 30_000 }).toBe(true);
        assert.equal(result.playback?.identityMatches, true);
        assertActive();
        result.playing = true;
        result.stage = "player-paused";
        await player.locator("#movie_player").hover();
        assertActive();
        await player.getByRole("button", { name: /^(?:Pause|일시중지|일시 중지)(?: ?\(k\))?$/i }).filter({ visible: true }).first().click();
        await expect.poll(async () => { const value = await read(); result.playback = value.snapshot; return value.paused; }, { timeout: 10_000 }).toBe(true);
        await expect(player.locator(".ytp-error")).toBeHidden();
        assertActive();
        result.pausedAfterPlay = true;
        }, result, () => context?.close());
      } catch { /* Preserve stage and closed playback data; never emit raw provider messages/headers. */ }
      finally {
        if (context) await finishDiagnosticContext({ guard, controller, context, result });
        if (controller) {
          try { result.controller = closedNativeEvidence(controller); }
          catch { result.controllerPassed = false; }
        }
        result.passed = result.playing && result.pausedAfterPlay && result.boundaryPassed
          && result.controllerPassed && result.cleanupPassed && !result.deadlineExceeded && result.apiRequests === 0;
        save();
        console.log(JSON.stringify({ mode, passed: result.passed, stage: result.stage, errorClass: result.playback?.errorClass ?? null }));
      }
      // A failed or unconfirmed cleanup stops the comparison before another context.
      assertContextCleanup(result);
    }
  } finally {
    try {
      report.resourceCleanup = await finishDiagnosticResources({ browser, server });
      report.cleanupPassed = report.resourceCleanup.passed && report.outcomes.length === 2
        && report.outcomes.every(item => item.contextClosed && item.cleanupPassed);
    } finally {
      report.passed = report.cleanupPassed && report.outcomes.every(item => item.passed);
      save();
    }
  }
  process.exitCode = report.passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runDiagnostic().catch(() => { console.error("Public provider diagnostic failed; see closed diagnostic evidence."); process.exitCode = 1; });
}
