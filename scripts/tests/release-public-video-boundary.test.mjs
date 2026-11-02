import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { assertPublicVideoAvailability, observeReleaseTestResult } from "../run-development-release-canary.mjs";
const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const policy = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source
  + "\nexport { registerPublicVideoSources, publicVideoRequestKind };\n")).toString("base64"));
const { registerPublicVideoSources: register, publicVideoRequestKind: kind, installReleaseContextGuard } = policy;
const boundary = { mode: "development", apiOrigin: "http://127.0.0.1:18000", webOrigin: "http://localhost:4173", tenantCode: "qa-ymath-realuse-video" };
const id = "xgjL2HyrdFM";
const video = { youtube_video_id: id, canonical_url: `https://www.youtube.com/watch?v=${id}`, thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
const embed = `https://www.youtube.com/embed/${id}?autoplay=0&playsinline=1&origin=${encodeURIComponent(boundary.webOrigin)}`;
const ids = new Set([id]);

const botPlayback = { paused: true, ended: false, readyState: 0, networkState: 3, width: 0, height: 0,
  currentTime: 0, initialTime: 0, duration: null, mediaError: null, adShowing: false, adInterrupting: false,
  playerState: -1, identityMatches: true, errorVisible: true, errorClass: "bot-check" };
const pausedPlayback = { ...botPlayback, readyState: 4, networkState: 1, width: 1280, height: 720,
  currentTime: 3, duration: 716, playerState: 2, errorVisible: false, errorClass: "none" };

function observePublicEvidence(outputs) {
  return observeReleaseTestResult(JSON.stringify({ stats: { expected: 0, unexpected: 1, skipped: 0, flaky: 0 },
    suites: [{ specs: [{ file: "public-video-realuse.spec.ts", tests: [{ status: "unexpected", results: [{
      status: "failed", workerIndex: 0, stdout: outputs.map(value => ({ text: JSON.stringify(value) })),
    }] }] }] }] }));
}

test("confirmed provider bot availability stays distinct from genuine play-pause evidence", () => {
  const output = [];
  policy.emitPublicVideoAvailability(1366, "bot-confirmation", botPlayback, value => output.push(value));
  policy.emitPublicVideoAvailability(390, "played-paused", pausedPlayback, value => output.push(value));
  const observation = observePublicEvidence(output);
  assertPublicVideoAvailability(observation);
  assert.deepEqual(observation.publicVideoAvailability.map(value => value.outcome), ["bot-confirmation", "played-paused"]);
  assert.equal(observation.stats.unexpected, 1, "provider evidence never rewrites an application's failing result");
  assert.throws(() => policy.emitPublicVideoAvailability(1366, "played-paused", botPlayback));
  assert.throws(() => policy.emitPublicVideoAvailability(1366, "bot-confirmation", pausedPlayback));
});

test("bot classification cannot absorb identity, media, unknown errors or malformed evidence", () => {
  assert.equal(policy.isPublicVideoBotConfirmation(botPlayback), true);
  const patches = [{ identityMatches: false }, { identityMatches: null }, { errorVisible: false },
    { errorClass: "unavailable" }, { errorClass: "embedding-disabled" }, { errorClass: "other" },
    { mediaError: 2 }, { adShowing: true }, { adInterrupting: true }, { playerState: 1 },
    { paused: false }, { ended: true }, { readyState: 4 }, { currentTime: 2 }, { initialTime: null },
    { secret: "private-token" }, { networkState: 4 }];
  for (const patch of patches) {
    const playback = { ...botPlayback, ...patch };
    assert.equal(policy.isPublicVideoBotConfirmation(playback), false);
    assert.throws(() => policy.emitPublicVideoAvailability(1366, "bot-confirmation", playback));
    const observation = observePublicEvidence([{ publicVideoAvailability: {
      schema: "public-video-availability/v1", viewport: 1366, outcome: "bot-confirmation", playback,
    } }]);
    assert.equal(observation.rejectedPublicVideoAvailabilityCount, 1);
    assert.deepEqual(observation.publicVideoAvailability, []);
    assert.doesNotMatch(JSON.stringify(observation), /private-token/);
  }
});

test("provider evidence requires both viewports, exact source and unique closed outcomes", () => {
  const output = [];
  for (const viewport of [1366, 390]) policy.emitPublicVideoAvailability(viewport, "bot-confirmation", botPlayback, value => output.push(value));
  assertPublicVideoAvailability(observePublicEvidence(output));
  for (const values of [[], output.slice(0, 1), [output[0], output[0]], [...output, output[0]]]) {
    assert.throws(() => assertPublicVideoAvailability(observePublicEvidence(values)));
  }
  for (const patch of [{ schema: "unknown" }, { viewport: 500 }, { outcome: "passed" }, { url: "https://private.invalid" }]) {
    const value = { ...output[0].publicVideoAvailability, ...patch };
    const observation = observePublicEvidence([{ publicVideoAvailability: value }, output[1]]);
    assert.throws(() => assertPublicVideoAvailability(observation));
  }
  const foreign = JSON.stringify({ suites: [{ specs: [{ file: "omr-review-realuse.spec.ts", tests: [{ results: [{ stdout: output.map(value => ({ text: JSON.stringify(value) })) }] }] }] }] });
  assert.equal(observeReleaseTestResult(foreign).rejectedPublicVideoAvailabilityCount, 2);
  assert.throws(() => assertPublicVideoAvailability(observeReleaseTestResult(foreign)));
});

test("bounded provider observations keep every external state separate from application success", async () => {
  const spec = stripTypeScriptTypes(readFileSync(new URL("../../e2e/admin/public-video-realuse.spec.ts", import.meta.url), "utf8"))
    .replace(/^import[\s\S]*?;\r?\n/gm, "");
  for (const mode of ["normal", "lazy-media", "bot-before", "bot-after", "buffering", "unavailable", "media-error", "ad",
    "missing-media", "ready-timeout", "pause-timeout", "control-timeout", "unknown-identity", "wrong-identity", "transport", "context-closed", "click-transport", "evaluate-timeout", "media-replaced"]) {
    let state = ["bot-before", "unavailable", "media-error", "ad", "wrong-identity"].includes(mode) ? "blocked" : "ready";
    let now = 0;
    const calls = [], stages = [], snapshots = [];
    const failure = new Error(mode === "context-closed" ? "Target page, context or browser has been closed" : "controlled transport failure");
    if (mode === "evaluate-timeout") failure.name = "TimeoutError";
    let sampleCount = 0;
    const playback = () => state === "blocked" ? { ...botPlayback,
      ...(mode === "unavailable" ? { errorClass: "unavailable" } : {}),
      ...(mode === "media-error" ? { errorClass: "none", errorVisible: false, mediaError: 2 } : {}),
      ...(mode === "ad" ? { errorClass: "none", errorVisible: false, adShowing: true } : {}),
      ...(mode === "wrong-identity" ? { identityMatches: false } : {}) }
      : state === "paused" ? pausedPlayback
        : state === "playing" ? { ...pausedPlayback, paused: false, playerState: 1, identityMatches: mode === "unknown-identity" ? null : true }
          : { ...botPlayback, playerState: mode === "buffering" ? 3 : -1, errorVisible: false, errorClass: "none" };
    const media = { first() { return this; }, evaluateAll: async (_fn, args) => {
      sampleCount++;
      if (["transport", "context-closed", "evaluate-timeout"].includes(mode)) throw failure;
      if (mode === "missing-media" || (mode === "lazy-media" && !calls.includes("play")) || (mode === "media-replaced" && calls.includes("play"))) return undefined;
      const snapshot = { ...playback(), initialTime: args.initialTime };
      return { snapshot, playing: state === "playing", paused: snapshot.paused };
    } };
    const button = kind => ({ filter() { return this; }, first() { return this; },
      isVisible: async () => mode !== "ready-timeout" && !(mode === "pause-timeout" && kind === "pause"),
      click: async ({ timeout }) => {
        calls.push(kind);
        if (mode === "click-transport") throw failure;
        if (mode === "media-replaced") now = 59_999;
        if (mode === "control-timeout") { now += timeout; const error = new Error("bounded provider action timeout"); error.name = "TimeoutError"; throw error; }
        state = kind === "play" ? mode === "bot-after" ? "blocked" : ["buffering", "missing-media"].includes(mode) ? "ready" : "playing" : "paused";
      } });
    const frame = { getByRole: (_role, options) => button(options.name.test("Play") ? "play" : "pause"),
      locator: selector => selector.includes("video.html5") ? media : { hover: async () => {} } };
    const visitor = { frameLocator: () => frame, waitForTimeout: async delay => { now += delay; } };
    const scope = { test: { setTimeout() {}, use() {}, describe() {} }, Error, Date: { now: () => now },
      isPublicVideoBotConfirmation: policy.isPublicVideoBotConfirmation, isPublicVideoPlayedPaused: policy.isPublicVideoPlayedPaused };
    runInNewContext(spec + "\nglobalThis.observe = observePublicVideoPlayback;", scope);
    const run = () => scope.observe(visitor, id, stage => stages.push(stage), value => snapshots.push(value));
    if (["wrong-identity", "transport", "context-closed", "click-transport", "evaluate-timeout"].includes(mode)) {
      await assert.rejects(run(), mode === "wrong-identity" ? /identity mismatch/ : error => error === failure);
      continue;
    }
    const result = await run();
    assert.ok(now <= 60_000);
    const positive = ["normal", "lazy-media"].includes(mode);
    assert.equal(result.outcome, positive ? "played-paused" : mode.startsWith("bot-") ? "bot-confirmation" : "not-demonstrated", mode);
    if (positive) assert.deepEqual(calls, ["play", "pause"]);
    if (mode === "buffering") { assert.equal(result.phase, "play"); assert.equal(result.reason, "observation-timeout"); assert.equal(result.playback.playerState, 3); }
    if (mode === "missing-media") assert.equal(result.playback, null);
    if (mode === "media-replaced") { assert.equal(now, 60_000); assert.equal(sampleCount, 2); assert.equal(result.playback, null); }
    if (mode === "control-timeout") { assert.equal(result.phase, "play"); assert.equal(result.reason, "control-timeout"); }
    if (mode === "pause-timeout") assert.equal(result.phase, "pause");
    const output = [];
    for (const viewport of [1366, 390]) {
      if (result.outcome === "not-demonstrated") policy.emitPublicVideoNotDemonstrated(viewport, result.phase, result.reason, result.playback, value => output.push(value));
      else policy.emitPublicVideoAvailability(viewport, result.outcome, result.playback, value => output.push(value));
    }
    const evidence = observePublicEvidence(output);
    assertPublicVideoAvailability(evidence);
    assert.equal(evidence.stats.unexpected, 1, "provider observations never rewrite a failing application result");
  }
});

test("not-demonstrated rejects identity mismatches, invalid phase/reason, extra data and invented playback success", () => {
  for (const playback of [null, { ...botPlayback, identityMatches: null }, { ...botPlayback, playerState: 3, errorVisible: false, errorClass: "none" }]) {
    const output = [];
    policy.emitPublicVideoNotDemonstrated(1366, "play", "observation-timeout", playback, value => output.push(value));
    policy.emitPublicVideoNotDemonstrated(390, "ready", "provider-state", playback, value => output.push(value));
    assertPublicVideoAvailability(observePublicEvidence(output));
    for (const patch of [{ phase: "app-save" }, { reason: "private-secret" }, { playback: { ...botPlayback, identityMatches: false } },
      { playback: undefined }, { playback: { ...botPlayback, secret: "private-secret" } }, { outcome: "played-paused" }]) {
      const observation = observePublicEvidence([{ publicVideoAvailability: { ...output[0].publicVideoAvailability, ...patch } }, output[1]]);
      assert.throws(() => assertPublicVideoAvailability(observation));
      assert.doesNotMatch(JSON.stringify(observation), /private-secret/);
    }
  }
  assert.throws(() => policy.emitPublicVideoNotDemonstrated(1366, "play", "observation-timeout", { ...botPlayback, identityMatches: false }));
  assert.throws(() => policy.emitPublicVideoNotDemonstrated(1366, "app-save", "provider-state", null));
});

test("actual application continuation stays outside provider observation and preserves its failure", async () => {
  const spec = stripTypeScriptTypes(readFileSync(new URL("../../e2e/admin/public-video-realuse.spec.ts", import.meta.url), "utf8"));
  const start = spec.indexOf("        activeVisitor = visitor;");
  const end = spec.indexOf("        playbackObservation = undefined;", start);
  assert.ok(start > 0 && end > start);
  for (const mode of ["overflow", "replaced", "removed", "hidden", "changed-src"]) {
    const applicationError = new Error("application overflow failure");
    const output = [];
    const iframe = {};
    const expected = value => ({
      toBe: other => assert.equal(value, other),
      toHaveCount: async count => assert.equal(mode === "removed" ? 0 : 1, count),
      toBeVisible: async () => assert.notEqual(mode, "hidden"),
      toHaveAttribute: async (key, src) => { assert.equal(key, "src"); assert.equal(mode === "changed-src" ? "different" : embed, src); },
    });
    const run = runInNewContext(`(async () => { let activeVisitor, journeyStage, playbackObservation; ${spec.slice(start, end)} })`, {
      visitor: { locator: () => iframe }, row: { youtube_video_id: id }, width: 390, expect: expected,
      originalEmbed: { evaluate: async () => mode !== "replaced", dispose: async () => {} }, embedUrl: new URL(embed),
      observePublicVideoPlayback: async () => ({ outcome: "not-demonstrated", phase: "play", reason: "observation-timeout", playback: null }),
      emitPublicVideoNotDemonstrated: (...args) => policy.emitPublicVideoNotDemonstrated(...args, value => output.push(value)),
      assertNoHorizontalOverflow: async () => { throw applicationError; },
    });
    await assert.rejects(run(), mode === "overflow" ? error => error === applicationError : undefined);
    assert.equal(output.length, mode === "overflow" ? 1 : 0, "invalid application iframe must fail before emitting provider availability");
  }
});

test("only API-shaped sources with fixed canonical and thumbnail addresses are registered", () => {
  const known = new Set(); register({ results: [video] }, known); assert.deepEqual([...known], [id]);
  for (const malformed of [{ ...video, youtube_video_id: "../secret" }, { ...video, canonical_url: "https://foreign.invalid" }, { ...video, thumbnail_url: "https://foreign.invalid" }]) {
    const rejected = new Set(); register(malformed, rejected); assert.equal(rejected.size, 0);
  }
});

test("only registered thumbnail GET and exact non-autoplay embed documents enter the provider boundary", () => {
  assert.equal(kind(boundary, video.thumbnail_url, "GET", "image", ids, false), "thumbnail");
  assert.equal(kind(boundary, embed, "GET", "document", ids, false), "embed");
  for (const url of [embed.replace("autoplay=0", "autoplay=1"), embed + "&autoplay=0", embed.replace(id, "YYTULV4h4Io"), embed.replace("localhost", "foreign.invalid"), embed.replace("https://", "https://user:secret@"), embed + "#x"]) {
    assert.equal(kind(boundary, url, "GET", "document", ids, false), null);
  }
  assert.equal(kind(boundary, video.thumbnail_url, "POST", "image", ids, false), null);
  assert.equal(kind(boundary, video.thumbnail_url, "GET", "fetch", ids, false), null);
  assert.equal(kind(boundary, embed, "GET", "document", new Set(), false), null);
  assert.equal(kind({ ...boundary, mode: "readonly" }, embed, "GET", "document", ids, true), null);
});

test("provider requests require an admitted player frame and never allow platform APIs, spoofed hosts or destructive verbs", () => {
  const telemetry = "https://www.youtube.com/youtubei/v1/log_event";
  assert.equal(kind(boundary, telemetry, "POST", "fetch", ids, true), "player");
  assert.equal(kind(boundary, telemetry, "POST", "fetch", ids, false), null);
  for (const url of ["https://api.hakwonplus.com/api/v1/core/me/", "http://127.0.0.1:18000/api/v1/core/me/", "https://www.youtube.com.foreign.invalid/embed/x", "https://www.youtube.com:8443/player", "https://foreign.invalid/upload"]) {
    assert.equal(kind(boundary, url, "POST", "fetch", ids, true), null);
  }
  for (const method of ["PUT", "PATCH", "DELETE"]) assert.equal(kind(boundary, telemetry, method, "fetch", ids, true), null);
});

async function setup(options = {}) {
  let handler;
  const fetches = [];
  const initializers = [];
  const context = { request: { fetch: async () => assert.fail("No direct external API transport") }, exposeBinding: async () => {}, addInitScript: async (fn, arg) => { initializers.push({ fn, arg }); }, on() {}, route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, boundary);
  if (options.register !== false) {
    const headers = { origin: boundary.webOrigin, "x-tenant-code": boundary.tenantCode };
    await handler({ request: () => ({ url: () => `${boundary.apiOrigin}/api/v1/landing-public/videos/resolve/`, method: () => "POST", resourceType: () => "fetch", allHeaders: async () => headers, headerValue: async (name) => headers[name] ?? null, postDataJSON: () => ({}), postDataBuffer: () => null }),
      abort: async () => assert.fail("Valid QA API source was rejected"), continue: async () => assert.fail("API must use verified transport"),
      fetch: async () => ({ status: () => options.status ?? 200, headers: () => ({ "content-type": "application/json", "access-control-allow-origin": boundary.webOrigin, "access-control-allow-credentials": "true" }), json: async () => video }), fulfill: async () => {} });
  }
  async function request(url, { method = "GET", type = "image", frame, headers = {}, status = 200, sequence, headersError, fetchError, fulfillError, onFetch } = {}) {
    let relayed = 0, aborted = 0;
    let providerResponse; let index = 0;
    await handler({ request: () => ({ url: () => url, method: () => method, resourceType: () => type, frame: () => frame, allHeaders: async () => { if (headersError) throw headersError; return headers; }, headerValue: async (name) => headers[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null }),
      continue: async () => assert.fail("Native continuation can escape via redirects"), abort: async () => { aborted++; },
      fetch: async (settings) => {
        assert.equal(settings.maxRedirects, 0); assert.ok(settings.timeout > 0 && settings.timeout <= 30_000);
        fetches.push(settings.url ?? url);
        onFetch?.(settings);
        if (fetchError) throw fetchError;
        const item = sequence?.[Math.min(index++, sequence.length - 1)] ?? { status };
        if (item.error) throw item.error;
        providerResponse = { status: () => item.status, headers: () => item.location ? { location: item.location } : {} };
        return providerResponse;
      },
      fulfill: async (value) => { assert.deepEqual(Object.keys(value), ["response"]); assert.equal(value.response, providerResponse); if (fulfillError) throw fulfillError; relayed++; } });
    return { relayed, aborted };
  }
  return { guard, request, initializers, fetches };
}

test("public embed identity observes intercepted headers before an unchanged HTTP 200 relay", async () => {
  for (const [referer, present, matches] of [
    [undefined, false, false], ["", false, false], ["  ", false, false],
    [`${boundary.webOrigin}/private-path?token=identity-secret`, true, true],
    ["https://foreign.invalid/identity-secret", true, false], ["identity-secret", true, false],
    ["http://identity-secret@localhost:4173/", true, false],
    ["https://localhost:4173/", true, false], ["http://localhost:4174/", true, false],
  ]) {
    const fixture = await setup();
    const frame = { url: () => embed, parentFrame: () => ({ url: () => boundary.webOrigin, parentFrame: () => null }) };
    const expected = { refererPresent: present, refererMatchesEmbeddingOrigin: matches, originParamMatches: true };
    assert.deepEqual(await fixture.request(embed, { type: "document", frame,
      headers: { ...(referer === undefined ? {} : { referer }), "x-private": "identity-secret" },
      onFetch(settings) {
        assert.deepEqual(settings, { maxRedirects: 0, timeout: 30_000 });
        assert.deepEqual(fixture.guard.observation.snapshot().events[0].publicEmbedRequestIdentity, expected);
      },
    }), { relayed: 1, aborted: 0 });
    fixture.guard.assertClean();
    const snapshot = fixture.guard.observation.snapshot();
    assert.equal(snapshot.events.length, 1);
    const event = snapshot.events[0];
    assert.equal(event.phase, "public-embed-request-identity"); assert.equal(event.stage, "initial");
    assert.equal(event.requestOrdinal, 2);
    assert.deepEqual(event.publicEmbedRequestIdentity, expected);
    assert.equal(fixture.fetches.length, 1);
    assert.equal(fixture.guard.transport.readFetchRetries, 0); assert.equal(fixture.guard.transport.mutationReplays, 0);
    const observed = observePublicEvidence([{ releaseContextObservation: snapshot }]);
    assert.equal(observed.rejectedContextObservationCount, 0);
    assert.deepEqual(observed.contextObservations[0].events, snapshot.events);
    assert.doesNotMatch(JSON.stringify(observed), /identity-secret|private-path|foreign\.invalid|localhost|youtube\.com/);
  }
});

test("public embed identity caps only observations, preserving later relay and repeated snapshots", async () => {
  const fixture = await setup();
  const frame = { url: () => embed, parentFrame: () => ({ url: () => boundary.webOrigin, parentFrame: () => null }) };
  const snapshots = [];
  for (let index = 0; index < 4; index++) {
    assert.deepEqual(await fixture.request(embed, { type: "document", frame }), { relayed: 1, aborted: 0 });
    snapshots.push({ releaseContextObservation: fixture.guard.observation.snapshot() });
  }
  fixture.guard.observation.record({ phase: "context-close", stage: "terminal" });
  snapshots.push({ releaseContextObservation: fixture.guard.observation.snapshot() });
  fixture.guard.assertClean(); assert.equal(fixture.fetches.length, 4);
  const observed = observePublicEvidence(snapshots);
  assert.equal(observed.rejectedContextObservationCount, 0); assert.equal(observed.contextObservations.length, 1);
  const events = observed.contextObservations[0].events;
  assert.deepEqual(events.filter(event => event.publicEmbedRequestIdentity).map(event => event.requestOrdinal), [2, 3]);
  assert.equal(events.at(-1).phase, "context-close");
});

test("public embed identity excludes non-admitted requests and unreadable headers", async () => {
  const frame = { url: () => embed, parentFrame: () => ({ url: () => boundary.webOrigin, parentFrame: () => null }) };
  for (const [setupOptions, options, url] of [
    [{ register: false }, {}, embed], [{}, { headers: { authorization: "identity-secret" } }, embed],
    [{}, { headers: { "x-tenant-code": "identity-secret" } }, embed],
    [{}, { headers: { "x-csrftoken": "identity-secret" } }, embed],
    [{}, { frame: undefined }, embed],
    [{}, { frame: { url: () => embed, parentFrame: () => ({ url: () => "https://foreign.invalid", parentFrame: () => null }) } }, embed],
    [{}, {}, embed.replace(encodeURIComponent(boundary.webOrigin), encodeURIComponent("https://foreign.invalid"))],
    [{}, { headersError: new Error("identity-secret") }, embed],
  ]) {
    const fixture = await setup(setupOptions);
    assert.deepEqual(await fixture.request(url, { type: "document", frame, ...options }), { relayed: 0, aborted: 1 });
    assert.throws(() => fixture.guard.assertClean()); assert.equal(fixture.fetches.length, 0);
    assert.equal(fixture.guard.observation.snapshot().events.some(event => event.publicEmbedRequestIdentity), false);
  }
  const thumbnail = await setup(); await thumbnail.request(video.thumbnail_url);
  assert.equal(thumbnail.guard.observation.snapshot().events.length, 0);
});

test("public embed identity survives actual HTTP errors and fetch or fulfill failures without changing rejection", async () => {
  for (const operation of ["response", "fetch", "fulfill"]) {
    const fixture = await setup();
    const frame = { url: () => embed, parentFrame: () => ({ url: () => boundary.webOrigin, parentFrame: () => null }) };
    const error = new Error("identity-secret");
    assert.deepEqual(await fixture.request(embed, { type: "document", frame, status: 403,
      ...(operation === "fetch" ? { fetchError: error } : operation === "fulfill" ? { fulfillError: error } : {}),
    }), operation === "response" ? { relayed: 1, aborted: 0 } : { relayed: 0, aborted: 1 });
    if (operation === "response") fixture.guard.assertClean(); else assert.throws(() => fixture.guard.assertClean());
    const snapshot = fixture.guard.observation.snapshot();
    assert.equal(snapshot.events.filter(event => event.publicEmbedRequestIdentity).length, 1);
    assert.ok(snapshot.events.some(event => event.publicProvider?.operation === (operation === "response" ? "fetch" : operation)));
    assert.equal(fixture.fetches.length, 1);
    const observed = observePublicEvidence([{ releaseContextObservation: snapshot }]);
    assert.equal(observed.rejectedContextObservationCount, 0);
    assert.deepEqual(observed.contextObservations[0].events, snapshot.events);
    assert.doesNotMatch(JSON.stringify(observed), /identity-secret/);
  }
});

test("real provider responses are relayed without mocked bytes; credentials and unregistered resources are rejected", async () => {
  const allowed = await setup(); assert.deepEqual(await allowed.request(video.thumbnail_url), { relayed: 1, aborted: 0 }); allowed.guard.assertClean();
  for (const options of [{ register: false }, { status: 503 }, { headers: { authorization: "Bearer fixture" } }, { headers: { "x-tenant-code": boundary.tenantCode } }]) {
    const denied = await setup(options); assert.deepEqual(await denied.request(video.thumbnail_url, options), { relayed: 0, aborted: 1 }); assert.throws(() => denied.guard.assertClean());
  }
});

test("thumbnail redirects are refused before any response or subsequent target is delivered", async () => {
  for (const status of [301, 302, 307, 308]) {
    const denied = await setup(); assert.deepEqual(await denied.request(video.thumbnail_url, { status }), { relayed: 0, aborted: 1 });
    assert.throws(() => denied.guard.assertClean(), /public-video-redirect/);
  }
});

async function playerSetup() {
  const allowed = await setup();
  const parent = { url: () => boundary.webOrigin, parentFrame: () => null };
  const frame = { url: () => embed, parentFrame: () => parent };
  await allowed.request(embed, { type: "document", frame });
  allowed.fetches.length = 0;
  return { ...allowed, frame };
}

test("admitted native player follows a bounded same-origin same-path GET query redirect with real responses", async () => {
  const allowed = await playerSetup();
  const resource = "https://googleads.g.doubleclick.net/pagead/id";
  assert.deepEqual(await allowed.request(resource, { frame: allowed.frame,
    sequence: [{ status: 302, location: "?fixture=1" }, { status: 200 }] }), { relayed: 1, aborted: 0 });
  assert.deepEqual(allowed.fetches, [resource, resource + "?fixture=1"]);
  allowed.guard.assertClean();
});

test("player redirect cannot escape its origin/path, replay a POST, carry URL credentials or loop", async () => {
  const resource = "https://googleads.g.doubleclick.net/pagead/id";
  for (const location of ["https://foreign.invalid/upload", "https://www.youtube.com/pagead/id", "/other", "http://googleads.g.doubleclick.net/pagead/id", "https://secret@googleads.g.doubleclick.net/pagead/id", resource + "#fragment", "https://googleads.g.doubleclick.net:8443/pagead/id"]) {
    const denied = await playerSetup();
    assert.deepEqual(await denied.request(resource, { frame: denied.frame, sequence: [{ status: 302, location }] }), { relayed: 0, aborted: 1 });
    assert.deepEqual(denied.fetches, [resource]); assert.throws(() => denied.guard.assertClean(), /public-video-redirect/);
  }
  const post = await playerSetup();
  assert.deepEqual(await post.request(resource, { frame: post.frame, method: "POST", sequence: [{ status: 307, location: "?fixture=1" }] }), { relayed: 0, aborted: 1 });
  assert.deepEqual(post.fetches, [resource]);
  const loop = await playerSetup();
  assert.deepEqual(await loop.request(resource, { frame: loop.frame, sequence: [{ status: 302, location: "?fixture=1" }] }), { relayed: 0, aborted: 1 });
  assert.equal(loop.fetches.length, 4); assert.throws(() => loop.guard.assertClean(), /public-video-redirect/);
});

test("frame trust is scoped to the actual admitted iframe and ends when it navigates away", async () => {
  const parent = { url: () => `${boundary.webOrigin}/landing/videos/video`, parentFrame: () => null };
  let current = "about:blank";
  const frame = { url: () => current, parentFrame: () => parent };
  const allowed = await setup();
  assert.deepEqual(await allowed.request(embed, { type: "document", frame }), { relayed: 1, aborted: 0 });
  current = embed;
  assert.deepEqual(await allowed.request("https://www.youtube.com/youtubei/v1/log_event", { method: "POST", type: "fetch", frame }), { relayed: 1, aborted: 0 });
  allowed.guard.assertClean();
  current = `${boundary.webOrigin}/landing`;
  assert.deepEqual(await allowed.request("https://www.youtube.com/youtubei/v1/log_event", { method: "POST", type: "fetch", frame }), { relayed: 0, aborted: 1 });
  assert.throws(() => allowed.guard.assertClean());
});

test("native player telemetry cannot carry application credentials, redirect or contact production APIs", async () => {
  const { initializers } = await setup();
  const init = initializers[0];
  for (const scenario of [
    { allowed: true, url: "https://www.youtube.com/youtubei/v1/log_event" },
    { url: "https://api.hakwonplus.com/api/v1/token/" },
    { url: "https://www.youtube.com/youtubei/v1/log_event", headers: { authorization: "Bearer fixture" } },
    { url: "https://www.youtube.com/youtubei/v1/log_event", headers: { "x-tenant-code": boundary.tenantCode } },
    { url: "https://www.youtube.com/youtubei/v1/log_event", page: boundary.webOrigin + "/landing" },
    { url: "https://www.youtube.com/youtubei/v1/log_event", topLevel: true },
    { url: "https://www.youtube.com/youtubei/v1/like/like" },
    { url: "https://foreign.invalid/log_event" },
  ]) {
    const sent = [], rejected = [];
    const window = { Request, fetch: async (...args) => { sent.push(args); return new Response("ok"); }, parent: {}, __academyReleaseKeepaliveViolation: async (code) => rejected.push(code) };
    if (scenario.topLevel) window.parent = window;
    runInNewContext(`(${init.fn.toString()})(boundary)`, { window, boundary: init.arg, URL, location: new URL(scenario.page ?? embed), sessionStorage: { getItem: () => null, setItem() {} }, console: { warn() {} } });
    const pending = window.fetch(scenario.url, { method: "POST", body: "{}", keepalive: true, headers: scenario.headers });
    if (scenario.allowed) {
      await pending; assert.equal(sent.length, 1); assert.equal(sent[0][1].redirect, "error"); assert.deepEqual(rejected, []);
    } else {
      await assert.rejects(pending, /keepalive request refused/); assert.equal(sent.length, 0); assert.equal(rejected.length, 1);
    }
  }
});

test("unclassified external POST records only closed origin causes and remains denied", async () => {
  const fixture = await setup();
  const parent = { url: () => boundary.webOrigin, parentFrame: () => null };
  const frame = { url: () => embed, parentFrame: () => parent, isDetached: () => false };
  assert.deepEqual(await fixture.request("https://www.youtube.com/youtubei/v1/log_event?secret=private-token", {
    method: "POST", type: "fetch", frame,
  }), { relayed: 0, aborted: 1 });
  assert.throws(() => fixture.guard.assertClean(), /origin/);
  const event = fixture.guard.observation.snapshot().events.find(event => event.externalOrigin);
  assert.equal(event.phase, "route-handler");
  assert.deepEqual(event.externalOrigin, { providerClass: "youtube.com", resourceType: "fetch",
    frameExists: true, frameAdmitted: false, frameExactEmbed: true, trustedAncestor: false,
    frameDetached: false, protocol: "https", hasPort: false, hasHash: false, hasCredentials: false });
  assert.doesNotMatch(JSON.stringify(event), /private-token|log_event|secret|www\.youtube/);
  assert.equal(fixture.fetches.length, 0, "diagnostic cannot admit an unregistered frame");
});

test("unknown provider without a frame stays denied without exposing its host", async () => {
  const fixture = await setup();
  assert.deepEqual(await fixture.request("https://private-origin.example/collect?token=private-token", {
    method: "POST", type: "fetch",
  }), { relayed: 0, aborted: 1 });
  assert.throws(() => fixture.guard.assertClean(), /origin/);
  const event = fixture.guard.observation.snapshot().events.find(event => event.externalOrigin);
  assert.deepEqual(event.externalOrigin, { providerClass: "other", resourceType: "fetch",
    frameExists: false, frameAdmitted: false, frameExactEmbed: false, trustedAncestor: false,
    frameDetached: null, protocol: "https", hasPort: false, hasHash: false, hasCredentials: false });
  assert.doesNotMatch(JSON.stringify(event), /private-origin|private-token|collect|token/);
  assert.equal(fixture.fetches.length, 0);
});

test("actual admitted-provider guard distinguishes headers, fetch and fulfill failures without leaking or retrying", async () => {
  for (const resourceKind of ["thumbnail", "embed", "player"]) {
    for (const operation of ["headers", "fetch", "fulfill"]) {
      const fixture = resourceKind === "player" ? await playerSetup() : await setup();
      const parent = { url: () => boundary.webOrigin, parentFrame: () => null };
      const frame = fixture.frame ?? { url: () => embed, parentFrame: () => parent };
      const url = resourceKind === "thumbnail" ? video.thumbnail_url : resourceKind === "embed" ? embed
        : "https://www.youtube.com/youtubei/v1/log_event?token=provider-secret";
      const error = new Error(`route.${operation}: provider-secret https://private.invalid/?token=body-secret Authorization: header-secret`);
      const status = resourceKind === "thumbnail" ? 503 : 200;
      assert.deepEqual(await fixture.request(url, {
        frame, type: resourceKind === "embed" ? "document" : resourceKind === "player" ? "fetch" : "image",
        method: resourceKind === "player" ? "POST" : "GET", status,
        headers: { "x-fixture-sensitive": "header-secret" },
        ...({ headers: { headersError: error }, fetch: { fetchError: error }, fulfill: { fulfillError: error } }[operation]),
      }), { relayed: 0, aborted: 1 });
      assert.throws(() => fixture.guard.assertClean());
      const snapshot = fixture.guard.observation.snapshot();
      const events = snapshot.events.filter(event => event.publicProvider && event.phase === "route-handler");
      assert.equal(events.length, 1);
      assert.equal(events[0].phase, "route-handler");
      assert.equal(events[0].stage, "terminal");
      assert.equal(events[0].nativeKind, "other");
      assert.deepEqual(events[0].publicProvider, {
        providerClass: resourceKind === "thumbnail" ? "ytimg.com" : "youtube.com",
        resourceKind, operation, httpStatus: operation === "fulfill" ? status : null,
      });
      assert.doesNotMatch(JSON.stringify(snapshot), /provider-secret|body-secret|header-secret|private\.invalid|Authorization|youtubei/);
      const observed = observePublicEvidence([{ releaseContextObservation: snapshot }]);
      assert.equal(observed.rejectedContextObservationCount, 0);
      assert.deepEqual(observed.contextObservations[0].events, snapshot.events);
      assert.equal(fixture.fetches.length, operation === "headers" ? 0 : 1);
      assert.equal(fixture.guard.transport.readFetchRetries, 0);
      assert.equal(fixture.guard.transport.mutationReplays, 0);
    }
  }
});

test("provider redirect rejection and failure on an admitted hop retain only the operation's actual status", async () => {
  for (const status of [302, 304]) {
    const fixture = await setup();
    assert.deepEqual(await fixture.request(video.thumbnail_url, {
      sequence: [{ status, location: "https://private.invalid/?token=redirect-secret" }],
    }), { relayed: 0, aborted: 1 });
    assert.throws(() => fixture.guard.assertClean(), /public-video-redirect/);
    const snapshot = fixture.guard.observation.snapshot();
    assert.deepEqual(snapshot.events.find(event => event.publicProvider).publicProvider, {
      providerClass: "ytimg.com", resourceKind: "thumbnail", operation: "redirect", httpStatus: status,
    });
    assert.equal(fixture.fetches.length, 1);
    assert.doesNotMatch(JSON.stringify(snapshot), /redirect-secret|private\.invalid/);
  }
  const fixture = await playerSetup();
  await fixture.request("https://googleads.g.doubleclick.net/pagead/id", { frame: fixture.frame,
    sequence: [{ status: 302, location: "?token=redirect-secret" }, { error: new Error("fetch-secret") }] });
  assert.throws(() => fixture.guard.assertClean());
  const snapshot = fixture.guard.observation.snapshot();
  assert.deepEqual(snapshot.events.find(event => event.publicProvider).publicProvider, {
    providerClass: "doubleclick.net", resourceKind: "player", operation: "fetch", httpStatus: null,
  });
  assert.equal(fixture.fetches.length, 2, "only the already-admitted redirect hop is fetched; no retry");
  assert.equal(fixture.guard.transport.readFetchRetries, 0);
  assert.equal(fixture.guard.transport.mutationReplays, 0);
  assert.doesNotMatch(JSON.stringify(snapshot), /redirect-secret|fetch-secret|pagead/);
});

test("actual public-video spec records its primary stage before strict close and preserves both failure paths", async () => {
  const spec = stripTypeScriptTypes(readFileSync(new URL("../../e2e/admin/public-video-realuse.spec.ts", import.meta.url), "utf8"))
    .replace(/^import[\s\S]*?;\r?\n/gm, "");
  for (const closeFails of [false, true]) {
    let callback;
    const order = [], markers = [];
    const primary = new Error("locator.goto: Timeout private-primary https://private.invalid/?token=secret");
    const cleanup = new Error("Release API boundary failed: private-cleanup");
    const testDouble = (_name, body) => { callback = body; };
    Object.assign(testDouble, { setTimeout() {}, use() {}, skip() {}, describe: (_name, body) => body() });
    testDouble.describe.configure = () => {};
    const guard = { beginClose: async () => { order.push("begin-close"); }, assertClean: () => { order.push("guard-check"); } };
    const strict = { assertZeroDefects: () => { order.push("strict-check"); } };
    const context = { addInitScript: async () => {}, newPage: async () => ({ on() {}, goto: async () => { throw primary; } }),
      close: async () => { order.push("close"); if (closeFails) throw cleanup; } };
    runInNewContext(spec, {
      test: testDouble, expect: { soft: (check) => ({ not: { toThrow: () => check() } }) },
      assertQaStudentParentRuntime() {}, releaseBoundaryFromEnv: () => boundary, installReleaseRequestGuard() {},
      installReleaseContextGuard: async () => guard, attachStrictBrowserGuards: () => strict,
      emitReleaseTestFailure: (error, phase, _emit, stage) => policy.emitReleaseTestFailure(error, phase, value => {
        order.push("primary-marker"); markers.push(value);
      }, stage),
      STUDENT_PARENT_REALUSE_ENABLED: true, QA_BASE: boundary.webOrigin, QA_TENANT: boundary.tenantCode,
      process: { env: {} }, URL,
    });
    await assert.rejects(callback({ browser: { newContext: async () => context }, request: {} }, {}),
      error => error === (closeFails ? cleanup : primary));
    assert.deepEqual(markers, [{ releaseTestFailure: { schema: "release-test-failure/v1", phase: "public-video-primary",
      kind: "locator-timeout", journeyStage: "publisher-login", expectedStatus: null, receivedStatus: null } }]);
    assert.deepEqual(order, ["primary-marker", "begin-close", "close", ...(closeFails ? [] : ["guard-check", "strict-check"])]);
    assert.doesNotMatch(JSON.stringify(markers), /private|secret|Timeout|goto/);
    const observed = observePublicEvidence(markers);
    assert.equal(observed.rejectedFailureObservationCount, 0);
    assert.equal(observed.testFailureObservations.length, 1);
    assert.equal(observed.testFailureObservations[0].journeyStage, "publisher-login");
  }
});

test("provider header overflow remains terminal with closed official diagnostics and no retry", async () => {
  const fixture = await setup();
  assert.deepEqual(await fixture.request(video.thumbnail_url, {
    fetchError: new Error("route.fetch: Parse Error: Header overflow\nCall log:\nhttps://private.invalid/?token=private-secret"),
  }), { relayed: 0, aborted: 1 });
  assert.throws(() => fixture.guard.assertClean());
  const observed = observePublicEvidence([{ releaseContextObservation: fixture.guard.observation.snapshot() }]);
  assert.equal(observed.rejectedContextObservationCount, 0);
  assert.equal(observed.contextObservations[0].events.find(event => event.publicProvider).nativeKind, "http-header-overflow");
  assert.doesNotMatch(JSON.stringify(observed), /private-secret|private\.invalid|Call log/);
  assert.equal(fixture.fetches.length, 1);
  assert.equal(fixture.guard.transport.readFetchRetries, 0);
  assert.equal(fixture.guard.transport.mutationReplays, 0);
});

test("admitted provider HTTP errors are observed but still fulfilled once without retry or rejection", async () => {
  for (const status of [400, 403, 429, 500, 599]) {
    const fixture = await playerSetup();
    assert.deepEqual(await fixture.request("https://rr1.googlevideo.com/videoplayback?sig=private-secret", {
      frame: fixture.frame, type: "media", status,
    }), { relayed: 1, aborted: 0 });
    fixture.guard.assertClean();
    assert.equal(fixture.fetches.length, 1);
    assert.equal(fixture.guard.transport.readFetchRetries, 0);
    assert.equal(fixture.guard.transport.mutationReplays, 0);
    const snapshotEvents = fixture.guard.observation.snapshot().events;
    assert.equal(snapshotEvents.filter(event => event.publicEmbedRequestIdentity).length, 1);
    const events = snapshotEvents.filter(event => event.publicProvider);
    assert.equal(events.length, 1);
    const { fetchDurationMs, ...provider } = events[0].publicProvider;
    assert.deepEqual(provider, { providerClass: "googlevideo.com", resourceKind: "player", operation: "fetch", httpStatus: status });
    assert.ok(Number.isSafeInteger(fetchDurationMs) && fetchDurationMs >= 0 && fetchDurationMs <= 30000);
    assert.equal(events[0].phase, "route-fetch");
    assert.equal(events[0].stage, "terminal");
    assert.equal(Object.hasOwn(events[0], "nativeCode"), false);
    const observed = observePublicEvidence([{ releaseContextObservation: fixture.guard.observation.snapshot() }]);
    assert.equal(observed.rejectedContextObservationCount, 0);
    assert.equal(observed.contextObservations[0].events.find(event => event.publicProvider).publicProvider.httpStatus, status);
    assert.doesNotMatch(JSON.stringify(observed), /private-secret|videoplayback|rr1\./);
  }
  for (const status of [200, 206]) {
    const fixture = await playerSetup();
    assert.deepEqual(await fixture.request("https://rr1.googlevideo.com/videoplayback", { frame: fixture.frame, type: "media", status }),
      { relayed: 1, aborted: 0 });
    fixture.guard.assertClean();
    const events = fixture.guard.observation.snapshot().events;
    assert.equal(events.length, 1);
    assert.equal(events[0].phase, "public-embed-request-identity");
  }
});

test("actual public-video sampler preserves failed playback predicates and emits only closed state", () => {
  const source = stripTypeScriptTypes(readFileSync(new URL("../../e2e/admin/public-video-realuse.spec.ts", import.meta.url), "utf8"))
    .replace(/^import[\s\S]*?;\r?\n/gm, "");
  const scope = { test: { setTimeout() {}, use() {}, describe() {} },
    getComputedStyle: node => ({ visibility: "visible", display: "block", opacity: "1", contentVisibility: "visible", ...node.style }) };
  runInNewContext(source + "\nglobalThis.readPlayback = readPublicVideoPlayback;", scope);
  const sample = (overrides = {}, flags = [], playerOverrides = {}, initialTime = 0) => {
    const player = { classList: { contains: name => flags.includes(name) }, getPlayerState: () => 1,
      getVideoData: () => ({ video_id: "private-video-id" }), querySelector: () => null, ...playerOverrides };
    const video = { paused: false, ended: false, readyState: 4, networkState: 1, videoWidth: 1280, videoHeight: 720,
      currentTime: 28.157, duration: 716, error: null, closest: () => player, ...overrides };
    return scope.readPlayback([video], { initialTime, expectedId: "private-video-id" });
  };
  assert.equal(scope.readPlayback([], { initialTime: 0, expectedId: "private-video-id" }), undefined);
  for (const video_id of [undefined, "", "   ", null]) {
    assert.equal(sample({}, [], { getVideoData: () => ({ video_id }) }).snapshot.identityMatches, null);
  }
  assert.equal(sample({}, [], { getVideoData: () => ({ video_id: "other-video" }) }).snapshot.identityMatches, false);
  const cases = [
    [sample(), true, false], [sample({ paused: true }), false, true],
    [sample({ readyState: 1, networkState: 2, currentTime: 0 }), false, false],
    [sample({}, ["ad-showing"]), false, false], [sample({}, ["ad-interrupting"]), false, false],
    [sample({ currentTime: 0.2 }, [], {}, 20), false, false], [sample({ ended: true }), false, false],
  ];
  for (const [result, playing, paused] of cases) {
    assert.equal(result.playing, playing); assert.equal(result.paused, paused);
    const output = [];
    policy.emitReleaseTestFailure(new Error("private-secret assertion"), "public-video-primary", value => output.push(value),
      paused ? "player-paused" : "player-playing", result.snapshot);
    const observed = observePublicEvidence(output);
    assert.equal(observed.rejectedFailureObservationCount, 0);
    assert.deepEqual(observed.testFailureObservations[0].playback, { ...result.snapshot });
    assert.doesNotMatch(JSON.stringify(observed), /private-video-id|private-secret/);
  }
  for (const paused of [false, true]) {
    for (const getter of ["getPlayerState", "getVideoData", "querySelector"]) {
      const error = new Error("private-secret");
      assert.throws(() => sample({ paused }, [], { [getter]: () => { throw error; } }), value => value === error,
        "evaluation failures must escape the external availability observer");
    }
  }
  for (const [text, errorClass] of [["Sign in to confirm you're not a bot", "bot-check"],
    ["Sign in to confirm you’re not a botThis helps protect our communitySign inLearn more", "bot-check"],
    [" Sign  in to confirm you're not a bot\nThis helps protect our community.\nSign in\nLearn more ", "bot-check"],
    ["Confirm you are not a bot private-secret", "other"], ["로봇 동영상을 사용할 수 없습니다", "unavailable"],
    ["Sign in to confirm you're not a bot Unavailable", "unavailable"],
    ["Unavailable private-secret", "unavailable"], ["Embedding disabled private-secret", "embedding-disabled"], ["private-secret", "other"]]) {
    const result = sample({}, [], { querySelector: () => ({ getBoundingClientRect: () => ({ width: 10, height: 10 }), textContent: text }) });
    assert.equal(result.snapshot.errorVisible, true); assert.equal(result.snapshot.errorClass, errorClass);
    assert.doesNotMatch(JSON.stringify(result.snapshot), /private-secret|private-video-id/);
  }
  const hiddenPrompt = sample({}, [], { querySelector: () => ({ getBoundingClientRect: () => ({ width: 0, height: 0 }),
    textContent: "Sign in to confirm you're not a bot" }) });
  assert.equal(hiddenPrompt.snapshot.errorVisible, false);
  assert.equal(hiddenPrompt.snapshot.errorClass, "none");
  for (const hiddenStyle of [{ opacity: "0" }, { opacity: "0.0" }, { visibility: "hidden" },
    { visibility: "collapse" }, { display: "none" }, { contentVisibility: "hidden" }]) {
    for (const inherited of [false, true]) {
      const errorNode = { getBoundingClientRect: () => ({ width: 200, height: 100 }),
        textContent: "Sign in to confirm you're not a bot", style: inherited ? {} : hiddenStyle,
        parentElement: inherited ? { style: hiddenStyle, parentElement: null } : null };
      const result = sample({ paused: true, readyState: 0, currentTime: 0, videoWidth: 0, videoHeight: 0 }, [],
        { getPlayerState: () => -1, querySelector: () => errorNode });
      assert.equal(result.snapshot.errorVisible, false);
      assert.equal(result.snapshot.errorClass, "none");
      assert.equal(policy.isPublicVideoBotConfirmation(result.snapshot), false,
        "hidden retained bot text must not exempt a failed player");
    }
  }
});
