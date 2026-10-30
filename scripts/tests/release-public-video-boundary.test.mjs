import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { observeReleaseTestResult } from "../run-development-release-canary.mjs";
const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const policy = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source
  + "\nexport { registerPublicVideoSources, publicVideoRequestKind };\n")).toString("base64"));
const { registerPublicVideoSources: register, publicVideoRequestKind: kind, installReleaseContextGuard } = policy;
const boundary = { mode: "development", apiOrigin: "http://127.0.0.1:18000", webOrigin: "http://localhost:4173", tenantCode: "qa-ymath-realuse-video" };
const id = "xgjL2HyrdFM";
const video = { youtube_video_id: id, canonical_url: `https://www.youtube.com/watch?v=${id}`, thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
const embed = `https://www.youtube.com/embed/${id}?autoplay=0&playsinline=1&origin=${encodeURIComponent(boundary.webOrigin)}`;
const ids = new Set([id]);

function observePublicEvidence(outputs) {
  return observeReleaseTestResult(JSON.stringify({ stats: { expected: 0, unexpected: 1, skipped: 0, flaky: 0 },
    suites: [{ specs: [{ file: "public-video-realuse.spec.ts", tests: [{ status: "unexpected", results: [{
      status: "failed", workerIndex: 0, stdout: outputs.map(value => ({ text: JSON.stringify(value) })),
    }] }] }] }] }));
}

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
  async function request(url, { method = "GET", type = "image", frame, headers = {}, status = 200, sequence, headersError, fetchError, fulfillError } = {}) {
    let relayed = 0, aborted = 0;
    let providerResponse; let index = 0;
    await handler({ request: () => ({ url: () => url, method: () => method, resourceType: () => type, frame: () => frame, allHeaders: async () => { if (headersError) throw headersError; return headers; }, headerValue: async (name) => headers[name] ?? null, postDataJSON: () => null, postDataBuffer: () => null }),
      continue: async () => assert.fail("Native continuation can escape via redirects"), abort: async () => { aborted++; },
      fetch: async (settings) => {
        assert.equal(settings.maxRedirects, 0); assert.ok(settings.timeout > 0 && settings.timeout <= 30_000);
        fetches.push(settings.url ?? url);
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
      const events = snapshot.events.filter(event => event.publicProvider);
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
