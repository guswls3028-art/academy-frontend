import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const { createReleaseContextObservation, installReleaseContextGuard, installReleaseRequestGuard, safeNativeTransportCode } =
  await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);

const boundary = {
  mode: "development", apiOrigin: "http://127.0.0.1:18486", webOrigin: "http://127.0.0.1:4286",
  tenantCode: "qa-ymath-realuse-observation-unit",
};
const response = {
  status: () => 200, ok: () => true,
  headers: () => ({ "access-control-allow-origin": boundary.webOrigin, "access-control-allow-credentials": "true" }),
};
const headers = { "x-tenant-code": boundary.tenantCode };
const failure = () => new Error("ECONNRESET sensitive-name https://private.example/123456789/?token=sensitive-query");

function captureRetryDelays(t) {
  const delays = [];
  t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    delays.push(delay);
    queueMicrotask(callback);
    return 0;
  });
  return delays;
}

async function routeHarness() {
  let handler;
  const context = { request: { fetch: async () => response }, route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, boundary);
  return {
    guard,
    async send(method, path, failures = 1, fulfillError) {
      const calls = { fetch: 0, fulfill: 0, abort: 0 };
      await handler({
        request: () => ({
          url: () => `https://api.hakwonplus.com${path}`, method: () => method, postDataJSON: () => undefined,
          headerValue: async () => boundary.tenantCode,
          allHeaders: async () => ({ origin: boundary.webOrigin, ...headers }),
        }),
        fetch: async (options) => {
          calls.fetch += 1;
          assert.equal(options.maxRedirects, 0);
          assert.equal(new URL(options.url).origin, boundary.apiOrigin);
          if (calls.fetch <= failures) throw failure();
          return response;
        },
        fulfill: async () => { calls.fulfill += 1; if (fulfillError) throw fulfillError; },
        abort: async () => { calls.abort += 1; },
        continue: async () => assert.fail("API requests cannot escape the proxy"),
      });
      return calls;
    },
  };
}

function requestHarness(failures = 1) {
  const calls = [];
  const request = { fetch: async (_url, options) => {
    calls.push(options);
    if (calls.length <= failures) throw failure();
    return response;
  } };
  const observation = createReleaseContextObservation(null);
  const diagnostics = [];
  const transport = { readFetchRetries: 0 };
  let violations = 0;
  installReleaseRequestGuard(request, boundary, undefined, undefined, () => { violations += 1; }, transport,
    (diagnostic) => observation.recordTransportDiagnostic(diagnostics, diagnostic), observation.record);
  return { request, observation, diagnostics, transport, calls, violations: () => violations };
}

function assertSafeSerialized(value) {
  assert.doesNotMatch(JSON.stringify(value), /sensitive-name|sensitive-query|123456789|private\.example|\?token|authorization|Bearer/);
}

test("snapshots have stable observation identity, increasing sequence and detached event/count data", () => {
  const observer = createReleaseContextObservation(7, () => ({ closing: false, activeRouteCount: 2 }));
  const standalone = createReleaseContextObservation(null);
  const nextContext = createReleaseContextObservation(8);
  assert.equal(Number.isSafeInteger(observer.data.observationOrdinal), true);
  assert.equal(standalone.data.observationOrdinal, observer.data.observationOrdinal + 1);
  assert.equal(nextContext.data.observationOrdinal, standalone.data.observationOrdinal + 1);
  observer.record({ phase: "route-fetch", stage: "initial", method: "GET", pathTemplate: null, nativeCode: "ECONNRESET" });
  const first = observer.snapshot();
  observer.record({ phase: "route-fetch", stage: "recovered", method: "GET", pathTemplate: null });
  const second = observer.snapshot();
  assert.equal(first.schema, "release-context-observation/v1");
  assert.equal(first.contextOrdinal, 7);
  assert.equal(first.observationOrdinal, second.observationOrdinal);
  assert.equal(first.snapshotSequence, 1);
  assert.equal(second.snapshotSequence, 2);
  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 2);
  assert.equal(first.unknownPathEventCounts["route-fetch"], 1);
  assert.equal(second.unknownPathEventCounts["route-fetch"], 2);
  assert.equal(first.events[0].activeRouteCount, 2);
  assert.equal(first.events[0].closing, false);
  assert.ok(first.events[0].elapsedMs >= 0);
  first.events[0].nativeCode = "other";
  first.unknownPathEventCounts["route-fetch"] = 99;
  assert.equal(observer.data.events[0].nativeCode, "ECONNRESET");
  assert.equal(second.events[0].nativeCode, "ECONNRESET");
  assert.equal(observer.data.unknownPathEventCounts["route-fetch"], 2);
});

test("observation and legacy diagnostic caps retain total drops and unknown path counts", () => {
  const observation = createReleaseContextObservation(null);
  const diagnostics = [];
  for (let index = 0; index < 131; index += 1) {
    observation.record({ phase: "api-request", stage: "initial", method: "GET", pathTemplate: null });
    observation.recordTransportDiagnostic(diagnostics, {
      method: "GET", pathTemplate: "/api/v1/clinic/sessions/", requestKind: "read", stage: "initial", transportCode: "transport",
    });
  }
  assert.equal(observation.data.events.length, 128);
  assert.equal(diagnostics.length, 128);
  assert.equal(observation.data.droppedEventCount, 3);
  assert.equal(observation.data.droppedRequestTransportDiagnosticCount, 3);
  assert.deepEqual(observation.data.unknownPathEventCounts, { "route-fetch": 0, "route-fulfill": 0, "api-request": 131 });
});

test("native error classification emits only the fixed allowlist", () => {
  for (const code of ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"]) {
    assert.equal(safeNativeTransportCode(Object.assign(new Error("sensitive-name"), { code })), code);
    assert.equal(safeNativeTransportCode(new Error(`transport ${code}: sensitive-name`)), code);
  }
  for (const message of ["Timeout 30000ms exceeded", "request timed out"]) {
    assert.equal(safeNativeTransportCode(new Error(message)), "timeout");
  }
  for (const message of ["route.fetch: Request context disposed.", "Target page, context or browser has been closed"]) {
    assert.equal(safeNativeTransportCode(new Error(message)), "context-disposed");
  }
  assert.equal(safeNativeTransportCode(Object.assign(new Error("sensitive-name"), { code: "sensitive-query" })), "other");
  assert.equal(safeNativeTransportCode("sensitive-name"), "other");
});

test("prefixed clinic paths and OPTIONS remain visible while query strings and IDs are removed", async (t) => {
  const delays = captureRetryDelays(t);
  for (const [path, template] of [
    ["/api/v1/clinic/sessions/", "/api/v1/clinic/sessions/"],
    ["/api/v1/clinic/participants/bulk-create/", "/api/v1/clinic/participants/bulk-create/"],
    ["/api/v1/clinic/participants/by_session/", "/api/v1/clinic/participants/by_session/"],
    ["/api/v1/clinic/participants/123456789/set_status/", "/api/v1/clinic/participants/:id/set_status/"],
    ["/api/v1/clinic/sessions/123456789/availability/", "/api/v1/clinic/sessions/:id/availability/"],
  ]) {
    const { guard, send } = await routeHarness();
    assert.deepEqual(await send("OPTIONS", `${path}?token=sensitive-query`, 1), { fetch: 2, fulfill: 1, abort: 0 });
    assert.equal(guard.transport.readFetchRetries, 1);
    assert.deepEqual(guard.requestTransportDiagnostics, [{ method: "OPTIONS", pathTemplate: template,
      requestKind: "read", stage: "initial", transportCode: "transport" }]);
    assert.deepEqual(guard.observation.data.events.map(({ stage }) => stage), ["initial", "recovered"]);
    assert.ok(guard.observation.data.events.every((event) => event.phase === "route-fetch" && event.pathTemplate === template));
    assertSafeSerialized({ events: guard.observation.data.events, diagnostics: guard.requestTransportDiagnostics });
    assert.doesNotThrow(() => guard.assertClean());
  }
  assert.deepEqual(delays, [500, 500, 500, 500, 500]);
});

test("unknown route paths keep null diagnostics and counts through terminal read failure", async (t) => {
  const delays = captureRetryDelays(t);
  const { guard, send } = await routeHarness();
  assert.deepEqual(await send("GET", "/api/v1/unknown/sensitive-name/123456789/?token=sensitive-query", 2),
    { fetch: 2, fulfill: 0, abort: 1 });
  assert.deepEqual(delays, [500]);
  assert.equal(guard.transport.readFetchRetries, 1);
  assert.deepEqual(guard.requestTransportDiagnostics, []);
  assert.deepEqual(guard.observation.data.events.map(({ stage }) => stage), ["initial", "retry", "terminal"]);
  assert.ok(guard.observation.data.events.every((event) => event.pathTemplate === null && event.nativeCode === "ECONNRESET"
    && event.activeRouteCount === 1 && event.closing === false));
  assert.equal(guard.observation.data.unknownPathEventCounts["route-fetch"], 3);
  assertSafeSerialized(guard.observation.data);
  assert.throws(() => guard.assertClean(), /Release request rejected \[fetch-transport\] GET/);
});

test("route mutations and fulfill failures remain terminal without replay", async (t) => {
  const delays = captureRetryDelays(t);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const { guard, send } = await routeHarness();
    assert.deepEqual(await send(method, "/api/v1/clinic/participants/", 1), { fetch: 1, fulfill: 0, abort: 1 });
    assert.equal(guard.transport.readFetchRetries, 0);
    assert.deepEqual(guard.observation.data.events.map(({ stage }) => stage), ["initial", "terminal"]);
    assert.throws(() => guard.assertClean(), /Release request rejected \[fetch-transport\]/);
  }
  const delivery = await routeHarness();
  assert.deepEqual(await delivery.send("GET", "/api/v1/clinic/sessions/", 0, new Error("EPIPE sensitive-name")),
    { fetch: 1, fulfill: 1, abort: 1 });
  assert.equal(delivery.guard.transport.readFetchRetries, 0);
  assert.deepEqual(delivery.guard.requestTransportDiagnostics, []);
  assert.equal(delivery.guard.observation.data.events.length, 1);
  assert.equal(delivery.guard.observation.data.events[0].phase, "route-fulfill");
  assert.equal(delivery.guard.observation.data.events[0].stage, "terminal");
  assert.equal(delivery.guard.observation.data.events[0].nativeCode, "EPIPE");
  assert.throws(() => delivery.guard.assertClean(), /Release request rejected \[fulfill-transport\]/);
  assert.deepEqual(delays, []);
});

test("APIRequestContext GET and HEAD recover with exactly one 500ms retry", async (t) => {
  const delays = captureRetryDelays(t);
  for (const method of ["GET", "HEAD"]) {
    const harness = requestHarness(1);
    assert.equal(await harness.request.fetch(`${boundary.apiOrigin}/api/v1/clinic/sessions/?token=sensitive-query`, { method, headers }), response);
    assert.equal(harness.calls.length, 2);
    assert.ok(harness.calls.every((options) => options.method === method && options.maxRedirects === 0));
    assert.equal(harness.transport.readFetchRetries, 1);
    assert.equal(harness.violations(), 0);
    assert.deepEqual(harness.observation.data.events.map(({ stage }) => stage), ["initial", "recovered"]);
    assert.ok(harness.observation.data.events.every((event) => event.phase === "api-request" && event.pathTemplate === "/api/v1/clinic/sessions/"));
    assertSafeSerialized(harness.observation.data);
  }
  assert.deepEqual(delays, [500, 500]);
});

test("APIRequestContext unknown read failures retain initial, retry and terminal evidence", async (t) => {
  const delays = captureRetryDelays(t);
  const harness = requestHarness(2);
  await assert.rejects(harness.request.get(`${boundary.apiOrigin}/api/v1/unknown/sensitive-name/?token=sensitive-query`, { headers }),
    /Release APIRequestContext transport rejected/);
  assert.equal(harness.calls.length, 2);
  assert.equal(harness.transport.readFetchRetries, 1);
  assert.equal(harness.violations(), 1);
  assert.deepEqual(harness.diagnostics, []);
  assert.deepEqual(harness.observation.data.events.map(({ stage }) => stage), ["initial", "retry", "terminal"]);
  assert.ok(harness.observation.data.events.every((event) => event.pathTemplate === null));
  assert.equal(harness.observation.data.unknownPathEventCounts["api-request"], 3);
  assertSafeSerialized(harness.observation.data);
  assert.deepEqual(delays, [500]);
});

test("APIRequestContext OPTIONS and mutations are never replayed and preserve rejection", async (t) => {
  const delays = captureRetryDelays(t);
  for (const method of ["OPTIONS", "POST", "PUT", "PATCH", "DELETE"]) {
    const harness = requestHarness(1);
    await assert.rejects(harness.request.fetch(`${boundary.apiOrigin}/api/v1/clinic/participants/123456789/set_status/?token=sensitive-query`, { method, headers }),
      /Release APIRequestContext transport rejected/);
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.transport.readFetchRetries, 0);
    assert.equal(harness.violations(), 1);
    assert.deepEqual(harness.observation.data.events.map(({ stage }) => stage), ["initial", "terminal"]);
    assert.deepEqual(harness.diagnostics, [{ method, pathTemplate: "/api/v1/clinic/participants/:id/set_status/",
      requestKind: method === "OPTIONS" ? "read" : "mutation", stage: "initial", transportCode: "transport" }]);
    assertSafeSerialized({ observation: harness.observation.data, diagnostics: harness.diagnostics });
  }
  assert.deepEqual(delays, []);
});
