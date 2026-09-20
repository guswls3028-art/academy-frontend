import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import http from "node:http";
import { chromium } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import { assertReleaseSummary, assertCleanup, assertManifest, assertActiveInstance, assertReadOnlyAssessmentSource, observeReleaseTestResult } from "../run-development-release-canary.mjs";
import * as runner from "../run-development-release-canary.mjs";
import "./release-video-scope.test.mjs";
import "./release-native-keepalive.test.mjs";
import "./release-omr-image-boundary.test.mjs";
import "./release-homework-image-boundary.test.mjs";

const policySource = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const policyModule = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(policySource)).toString("base64")}`);
const {
  assertReleaseRequestSafe,
  releaseBoundaryFromEnv,
  installReleaseRequestGuard,
  installReleaseContextGuard: installReleaseContextGuardUnderTest,
  probeDevelopmentCrossTenantDenial,
} = policyModule;
function installReleaseContextGuard(context, boundary) {
  // Route-only unit doubles do not execute a browser init script. Real contexts
  // retain their native methods and are covered by release-native-keepalive.
  context.exposeBinding ??= async () => {};
  context.addInitScript ??= async () => {};
  context.on ??= () => {};
  return installReleaseContextGuardUnderTest(context, boundary);
}
const production = releaseBoundaryFromEnv({
  E2E_RELEASE_API_MODE: "readonly", E2E_ALLOW_PRODUCTION_WRITES: "0",
  E2E_BASE_URL: "https://hakwonplus.com", E2E_API_URL: "https://api.hakwonplus.com",
  E2E_TENANT_CODE: "hakwonplus",
});
const development = releaseBoundaryFromEnv({
  E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0",
  E2E_BASE_URL: "http://localhost:4173", E2E_API_URL: "http://127.0.0.1:18000",
  E2E_TENANT_CODE: "qa-ymath-realuse-release-unit",
});

test("transport truth classifies serialized native messages without inventing a native code", () => {
  for (const [message, kind] of [["route.fetch: socket hang up", "socket-hang-up"],
    ["route.fetch: aborted", "response-aborted"], ["route.fetch: failed to decompress 'gzip' encoding: invalid data", "decompression"]]) {
    const error = new Error(`${message}\nCall log:\nhttps://private.invalid/?token=secret-token`);
    assert.equal(policyModule.safeNativeTransportKind(error), kind);
    assert.equal(policyModule.safeNativeTransportCode(error), "other", "message signatures must not fabricate ECONNRESET");
  }
  assert.equal(policyModule.safeNativeTransportKind(new Error("private-user socket hang up private-token")), "other");
  assert.equal(policyModule.safeNativeTransportKind({ message: "socket hang up", code: "private-token" }), "other");
});

test("transport truth keeps request timing and document counters through the official sanitizer", async () => {
  let handler;
  const page = {};
  const context = { request: { fetch: async () => {} }, route: async (_pattern, callback) => { handler = callback; } };
  const guard = await installReleaseContextGuard(context, development);
  guard.observation.setPageState(page, { pageOrdinal: 1, documentLoadOrdinal: 1, navigationOrdinal: 1 });
  let attempts = 0;
  const request = {
    url: () => "https://api.hakwonplus.com/api/v1/media/playback/events/?token=secret-token", method: () => "POST",
    frame: () => ({ page: () => page }), postDataJSON: () => ({ token: "secret-token" }),
    headerValue: async () => development.tenantCode,
    allHeaders: async () => ({ origin: development.webOrigin, authorization: "Bearer secret-token" }),
  };
  await handler({ request: () => request, fetch: async () => {
    attempts++;
    guard.observation.setPageState(page, { pageOrdinal: 1, documentLoadOrdinal: 2, navigationOrdinal: 2 });
    throw new Error("route.fetch: socket hang up\nCall log: Bearer secret-token");
  }, abort: async () => {}, fulfill: async () => assert.fail("no synthetic success"), continue: async () => assert.fail("no escape") });
  // /api/v1/media/playback/events/ is a replay-safe mutation template (append-only,
  // canary asserts a lower bound only) — a persistent socket-hang-up still replays
  // once before failing terminally, same as a safe read.
  assert.equal(attempts, 2);
  assert.throws(() => guard.assertClean(), /fetch-transport/);
  const report = contextReport([{ releaseContextObservation: guard.observation.snapshot() }]);
  const observed = observeReleaseTestResult(JSON.stringify(report));
  const events = observed.contextObservations[0].events;
  assert.deepEqual(events.map((event) => event.stage), ["initial", "retry", "terminal"]);
  for (const event of events) {
    assert.equal(event.pathTemplate, "/api/v1/media/playback/events/");
    assert.equal(event.nativeKind, "socket-hang-up");
    assert.equal(event.nativeCode, "other");
    assert.equal(event.requestOrdinal, 1);
    assert.equal(event.pageOrdinal, 1);
    assert.equal(event.startDocumentLoadOrdinal, 1);
    assert.equal(event.endDocumentLoadOrdinal, 2);
    assert.equal(event.startNavigationOrdinal, 1);
    assert.equal(event.endNavigationOrdinal, 2);
    assert.ok(Number.isSafeInteger(event.requestStartedElapsedMs));
    assert.ok(Number.isSafeInteger(event.attemptDurationMs));
  }
  assert.doesNotMatch(JSON.stringify(observed), /secret-token|Bearer/);
  assert.throws(() => assertReleaseSummary(report), /./, "diagnostics cannot turn a failed report into PASS");
});

test("transport truth records the original video failure before an unchanged close failure replaces it", async () => {
  const source = readFileSync(new URL("../../e2e/student/video-playback-renewal.realuse.spec.ts", import.meta.url), "utf8");
  const normalized = source.replaceAll("\r\n", "\n");
  const start = normalized.indexOf("  try {\n    const outcomes = await Promise.allSettled");
  assert.ok(start > 0);
  const body = stripTypeScriptTypes(normalized.slice(start, normalized.indexOf("\n  const states =", start)));
  const primary = new Error("expect(received).toBe(expected)\nExpected: 403\nReceived: 401\nprivate-user secret-token");
  const teardown = new Error("Release API boundary failed: retained defect");
  const logs = [];
  const run = new Function("runs", "finishStudent", "captureFailureContext", "emitReleaseTestFailure", "console",
    `return async () => { const videoId = 1, hlsPath = '', runReloadProof = null; ${body} };`)(
    [{ page: {}, state: {}, context: { close: async () => { throw teardown; } } }],
    async () => { throw primary; }, async () => ({}),
    (error, phase) => policyModule.emitReleaseTestFailure(error, phase, (value) => logs.push(value)),
    { log: () => {} });
  await assert.rejects(run(), (error) => error === teardown, "existing throw/close ordering is unchanged");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].releaseTestFailure.phase, "video-primary");
  assert.equal(logs[0].releaseTestFailure.kind, "assertion");
  assert.equal(logs[0].releaseTestFailure.expectedStatus, null, "arbitrary matcher numbers are not HTTP status");
  assert.equal(logs[0].releaseTestFailure.receivedStatus, null);
  assert.doesNotMatch(JSON.stringify(logs), /private-user|secret-token|403|401/);
  const observed = observeReleaseTestResult(JSON.stringify(contextReport(logs, "video-playback-renewal.realuse.spec.ts")));
  assert.equal(observed.testFailureObservations[0].phase, "video-primary");
});

test("transport truth captures exact cross-tenant status without reading the response body", async () => {
  const keys = { E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0",
    E2E_BASE_URL: development.webOrigin, E2E_API_URL: development.apiOrigin, E2E_TENANT_CODE: development.tenantCode };
  const previous = Object.fromEntries(Object.keys(keys).map((key) => [key, process.env[key]]));
  const fetch = globalThis.fetch;
  const log = console.log;
  const logs = [];
  let cancelled = 0;
  Object.assign(process.env, keys);
  console.log = (line) => logs.push(JSON.parse(line));
  globalThis.fetch = async () => ({ status: 401, body: { cancel: async () => { cancelled++; } },
    json: async () => assert.fail("response body is not collected") });
  try {
    assert.equal(await probeDevelopmentCrossTenantDenial({ accessToken: "secret-token", participantId: 987654,
      targetTenantCode: "qa-ymath-realuse-foreign-unit" }), 401, "403 assertion is not broadened or normalized");
  } finally {
    globalThis.fetch = fetch; console.log = log;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  assert.equal(cancelled, 1);
  assert.deepEqual(logs, [{ crossTenantDenialProbe: { schema: "release-cross-tenant-denial/v1", status: 401, errorCode: null } }]);
  const observed = observeReleaseTestResult(JSON.stringify(contextReport(logs, "clinic-roundtrip.spec.ts")));
  assert.equal(observed.crossTenantDenialProbes[0].status, 401);
  assert.doesNotMatch(JSON.stringify(observed), /secret-token|987654|foreign-unit/);
});

test("transport truth keeps OMR cleanup status at the actual failure without changing cleanup", async () => {
  const source = readFileSync(new URL("../../e2e/admin/omr-review-realuse.spec.ts", import.meta.url), "utf8");
  const body = stripTypeScriptTypes(source.slice(source.indexOf("async function cleanup("), source.indexOf("test.describe.serial(")));
  const logs = [];
  const calls = [];
  const created = { adminAccess: "secret-token", submissionIds: [987654], sessionEnrollmentIds: [] };
  const cleanup = new Function("created", "apiFetch", "console", "emitOmrCleanupStatus", "safeLectureSessionDeleteBlocker",
    `${body}; return cleanup;`)(created,
    async (_request, method) => { calls.push(method); return { status: method === "DELETE" ? 502 : 404, body: { detail: "private-user secret-token" } }; },
    { log: () => {} }, (...args) => policyModule.emitOmrCleanupStatus(...args, (value) => logs.push(value)),
    policyModule.safeLectureSessionDeleteBlocker);
  await assert.rejects(cleanup({}), /OMR production fixture cleanup failed/);
  assert.deepEqual(calls, ["DELETE", "GET"], "original removal and readback remain mandatory");
  assert.equal(logs[0].omrCleanupStatus.stage, "remove");
  assert.equal(logs[0].omrCleanupStatus.receivedStatus, 502);
  assert.deepEqual(logs[0].omrCleanupStatus.expectedStatuses, [200, 202, 204, 404]);
  assert.equal(logs[0].omrCleanupStatus.blocker, null, "an unrecognized detail message is not published");
  const observed = observeReleaseTestResult(JSON.stringify(contextReport(logs, "omr-review-realuse.spec.ts")));
  assert.equal(observed.omrCleanupStatuses[0].receivedStatus, 502);
  assert.equal(observed.rejectedFailureObservationCount, 0);
  assert.doesNotMatch(JSON.stringify(observed), /private-user|secret-token|987654/);
});

test("transport truth publishes only the closed lecture/session delete blocker vocabulary", async () => {
  const source = readFileSync(new URL("../../e2e/admin/omr-review-realuse.spec.ts", import.meta.url), "utf8");
  const body = stripTypeScriptTypes(source.slice(source.indexOf("async function cleanup("), source.indexOf("test.describe.serial(")));
  const logs = [];
  const calls = [];
  const created = { adminAccess: "secret-token", submissionIds: [987654], sessionEnrollmentIds: [] };
  const cleanup = new Function("created", "apiFetch", "console", "emitOmrCleanupStatus", "safeLectureSessionDeleteBlocker",
    `${body}; return cleanup;`)(created,
    async (_request, method) => {
      calls.push(method);
      if (method === "DELETE" && calls.filter((call) => call === "DELETE").length === 1) {
        return { status: 403, body: { detail: "This session has exams and cannot be deleted." } };
      }
      return { status: 404, body: null };
    },
    { log: () => {} }, (...args) => policyModule.emitOmrCleanupStatus(...args, (value) => logs.push(value)),
    policyModule.safeLectureSessionDeleteBlocker);
  await assert.rejects(cleanup({}), /OMR production fixture cleanup failed/);
  assert.equal(logs[0].omrCleanupStatus.receivedStatus, 403);
  assert.equal(logs[0].omrCleanupStatus.blocker, "exams");
  const observed = observeReleaseTestResult(JSON.stringify(contextReport(logs, "omr-review-realuse.spec.ts")));
  assert.equal(observed.omrCleanupStatuses[0].blocker, "exams");
  assert.equal(observed.rejectedFailureObservationCount, 0);
});

test("transport truth OMR verification transport keeps the stage and the identical thrown error", async () => {
  const source = readFileSync(new URL("../../e2e/admin/omr-review-realuse.spec.ts", import.meta.url), "utf8");
  const body = stripTypeScriptTypes(source.slice(source.indexOf("async function cleanup("), source.indexOf("test.describe.serial(")));
  const logs = [];
  const failure = new Error("unit verification transport private-token");
  const created = { adminAccess: "secret-token", submissionIds: [987654], sessionEnrollmentIds: [] };
  const cleanup = new Function("created", "apiFetch", "console", "emitOmrCleanupStatus", "safeLectureSessionDeleteBlocker",
    `${body}; return cleanup;`)(created,
    async (_request, method) => { if (method === "GET") throw failure; return { status: 204, body: null }; },
    { log: () => {} }, (...args) => policyModule.emitOmrCleanupStatus(...args, (value) => logs.push(value)),
    policyModule.safeLectureSessionDeleteBlocker);
  await assert.rejects(cleanup({}), (error) => error === failure);
  assert.deepEqual(logs, [{ omrCleanupStatus: { schema: "release-omr-cleanup-status/v1", stage: "verify-absent",
    expectedStatuses: [404], receivedStatus: null, blocker: null } }]);
});

function loadAttachStrictBrowserGuards() {
  const source = readFileSync(new URL("../../e2e/helpers/strictBrowser.ts", import.meta.url), "utf8");
  const stripped = stripTypeScriptTypes(source);
  const body = stripped.slice(stripped.indexOf("const DEFAULT_IGNORE"))
    .replace("export function attachStrictBrowserGuards", "function attachStrictBrowserGuards");
  const stubExpect = (actual, message) => ({
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message || "expect failed");
    },
  });
  const stubBaseTest = { info: () => ({ annotations: { push: () => {} } }) };
  return new Function("expect", "baseTest", `${body}\nreturn attachStrictBrowserGuards;`)(stubExpect, stubBaseTest);
}

function fakePage(url) {
  const handlers = {};
  return {
    on(event, handler) { (handlers[event] ??= []).push(handler); },
    url() { return url; },
    __emit(event, ...args) { for (const handler of handlers[event] || []) handler(...args); },
  };
}

test("strict browser guard classifies a recovered-transport console error as net-err/api, never the raw message", () => {
  const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
  const logs = [];
  const page = fakePage("http://localhost:4173/workspace/clinic/operations");
  const guard = attachStrictBrowserGuards(page, {
    apiOrigin: "http://127.0.0.1:18000",
    emit: (value) => logs.push(value),
  });
  page.__emit("console", {
    type: () => "error",
    text: () => "Failed to load resource: net::ERR_FAILED",
    location: () => ({ url: "http://127.0.0.1:18000/api/v1/clinic/participants/?tenant=secret-token&student=private-user" }),
  });
  assert.throws(() => guard.assertZeroDefects(), /브라우저 결함/);
  assert.deepEqual(logs, [{ releaseStrictBrowserDefect: {
    schema: "strict-browser-defect/v1", category: "net-err", source: "api", count: 1,
  } }]);
  assert.doesNotMatch(JSON.stringify(logs), /secret-token|private-user|participants/);
});

test("strict browser guard classifies a same-origin runtime pageerror as runtime/local and counts duplicates once", () => {
  const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
  const logs = [];
  const page = fakePage("http://localhost:4173/workspace/clinic/operations");
  const guard = attachStrictBrowserGuards(page, {
    apiOrigin: "http://127.0.0.1:18000",
    emit: (value) => logs.push(value),
  });
  page.__emit("pageerror", { message: "TypeError: Cannot read properties of undefined (reading 'secret-token')" });
  page.__emit("pageerror", { message: "TypeError: another undefined access private-user" });
  assert.throws(() => guard.assertZeroDefects());
  assert.deepEqual(logs, [{ releaseStrictBrowserDefect: {
    schema: "strict-browser-defect/v1", category: "runtime", source: "unknown", count: 2,
  } }]);
});

test("strict browser guard report mode still emits classification without failing the test", () => {
  const previous = process.env.E2E_STRICT;
  process.env.E2E_STRICT = "report";
  try {
    const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
    const logs = [];
    const page = fakePage("http://localhost:4173/");
    const guard = attachStrictBrowserGuards(page, { emit: (value) => logs.push(value) });
    page.__emit("console", { type: () => "error", text: () => "net::ERR_CONNECTION_RESET", location: () => null });
    assert.doesNotThrow(() => guard.assertZeroDefects());
    assert.deepEqual(logs, [{ releaseStrictBrowserDefect: {
      schema: "strict-browser-defect/v1", category: "net-err", source: "unknown", count: 1,
    } }]);
  } finally {
    if (previous === undefined) delete process.env.E2E_STRICT; else process.env.E2E_STRICT = previous;
  }
});

function emitNetErrApiConsoleErrors(page, count) {
  for (let index = 0; index < count; index++) {
    page.__emit("console", {
      type: () => "error", text: () => "Failed to load resource: net::ERR_FAILED",
      location: () => ({ url: "http://127.0.0.1:18000/api/v1/clinic/participants/" }),
    });
  }
}

test("strict browser guard suppresses net-err/api defects up to the harness's own recovered-transport count", () => {
  const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
  const logs = [];
  const page = fakePage("http://localhost:4173/");
  const guard = attachStrictBrowserGuards(page, {
    apiOrigin: "http://127.0.0.1:18000", emit: (value) => logs.push(value),
    recoveredTransportCount: () => 4,
  });
  emitNetErrApiConsoleErrors(page, 4);
  assert.doesNotThrow(() => guard.assertZeroDefects());
  assert.deepEqual(logs, [
    { releaseStrictBrowserDefect: { schema: "strict-browser-defect/v1", category: "net-err", source: "api", count: 4 } },
    { releaseStrictBrowserSuppression: { schema: "strict-browser-suppression/v1", suppressedNetErrDefects: 4, recoveredTransportCount: 4, closingAbortCount: 0 } },
  ]);
});

test("strict browser guard still fails on net-err/api defects beyond the recovered-transport cap", () => {
  const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
  const logs = [];
  const page = fakePage("http://localhost:4173/");
  const guard = attachStrictBrowserGuards(page, {
    apiOrigin: "http://127.0.0.1:18000", emit: (value) => logs.push(value),
    recoveredTransportCount: () => 2,
  });
  emitNetErrApiConsoleErrors(page, 5);
  assert.throws(() => guard.assertZeroDefects(), /브라우저 결함/);
  const suppression = logs.find((entry) => entry.releaseStrictBrowserSuppression);
  assert.deepEqual(suppression, { releaseStrictBrowserSuppression: {
    schema: "strict-browser-suppression/v1", suppressedNetErrDefects: 2, recoveredTransportCount: 2, closingAbortCount: 0 } });
});

test("strict browser guard extends the cap by closing-teardown aborts, on top of recovered transport", () => {
  const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
  const logs = [];
  const page = fakePage("http://localhost:4173/");
  const guard = attachStrictBrowserGuards(page, {
    apiOrigin: "http://127.0.0.1:18000", emit: (value) => logs.push(value),
    recoveredTransportCount: () => 3, closingAbortCount: () => 1,
  });
  emitNetErrApiConsoleErrors(page, 4);
  assert.doesNotThrow(() => guard.assertZeroDefects(),
    "3 recovered + 1 closing-teardown abort covers all 4 observed net-err/api defects");
  assert.deepEqual(logs, [
    { releaseStrictBrowserDefect: { schema: "strict-browser-defect/v1", category: "net-err", source: "api", count: 4 } },
    { releaseStrictBrowserSuppression: { schema: "strict-browser-suppression/v1", suppressedNetErrDefects: 4, recoveredTransportCount: 3, closingAbortCount: 1 } },
  ]);
});

test("strict browser guard never suppresses a net-err defect from a non-api source", () => {
  const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
  const logs = [];
  const page = fakePage("http://localhost:4173/");
  const guard = attachStrictBrowserGuards(page, {
    apiOrigin: "http://127.0.0.1:18000", emit: (value) => logs.push(value),
    recoveredTransportCount: () => 10,
  });
  page.__emit("console", { type: () => "error", text: () => "Failed to load resource: net::ERR_FAILED",
    location: () => ({ url: "https://static.cloudflareinsights.com/beacon.min.js" }) });
  assert.throws(() => guard.assertZeroDefects());
  assert.deepEqual(logs, [
    { releaseStrictBrowserDefect: { schema: "strict-browser-defect/v1", category: "net-err", source: "vendor", count: 1 } },
    { releaseStrictBrowserSuppression: { schema: "strict-browser-suppression/v1", suppressedNetErrDefects: 0, recoveredTransportCount: 10, closingAbortCount: 0 } },
  ]);
});

test("strict browser guard never suppresses a non-net-err defect even with a positive recovered-transport count", () => {
  const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
  const logs = [];
  const page = fakePage("http://localhost:4173/");
  const guard = attachStrictBrowserGuards(page, {
    apiOrigin: "http://127.0.0.1:18000", emit: (value) => logs.push(value),
    recoveredTransportCount: () => 10,
  });
  page.__emit("console", { type: () => "error", text: () => "TypeError: something undefined",
    location: () => ({ url: "http://127.0.0.1:18000/api/v1/clinic/participants/" }) });
  assert.throws(() => guard.assertZeroDefects());
  assert.deepEqual(logs, [
    { releaseStrictBrowserDefect: { schema: "strict-browser-defect/v1", category: "runtime", source: "api", count: 1 } },
    { releaseStrictBrowserSuppression: { schema: "strict-browser-suppression/v1", suppressedNetErrDefects: 0, recoveredTransportCount: 10, closingAbortCount: 0 } },
  ]);
});

test("strict browser guard suppresses nothing when the recovered-transport count is zero", () => {
  const attachStrictBrowserGuards = loadAttachStrictBrowserGuards();
  const logs = [];
  const page = fakePage("http://localhost:4173/");
  const guard = attachStrictBrowserGuards(page, {
    apiOrigin: "http://127.0.0.1:18000", emit: (value) => logs.push(value),
    recoveredTransportCount: () => 0,
  });
  emitNetErrApiConsoleErrors(page, 1);
  assert.throws(() => guard.assertZeroDefects());
  assert.equal(logs.some((entry) => entry.releaseStrictBrowserSuppression), false,
    "a zero cap publishes no suppression record -- nothing was absorbed");
});

test("canary collector accepts a strict-browser defect only from a recognized release flow, in its closed vocabulary", () => {
  const valid = contextReport([{ releaseApiMode: "development",
    releaseStrictBrowserDefect: { schema: "strict-browser-defect/v1", category: "net-err", source: "api", count: 2 } }]);
  const observedValid = observeReleaseTestResult(JSON.stringify(valid));
  assert.deepEqual(observedValid.strictBrowserDefects, [{
    specFile: "notice-roundtrip.spec.ts", resultOrdinal: 1,
    schema: "strict-browser-defect/v1", category: "net-err", source: "api", count: 2,
  }]);
  assert.equal(observedValid.rejectedFailureObservationCount, 0);

  const unrecognizedSpec = contextReport([{ releaseApiMode: "development",
    releaseStrictBrowserDefect: { schema: "strict-browser-defect/v1", category: "net-err", source: "api", count: 1 } }],
    "not-a-release-flow.spec.ts");
  const observedUnrecognized = observeReleaseTestResult(JSON.stringify(unrecognizedSpec));
  assert.deepEqual(observedUnrecognized.strictBrowserDefects, []);
  assert.equal(observedUnrecognized.rejectedFailureObservationCount, 1);

  const badCategory = contextReport([{ releaseApiMode: "development",
    releaseStrictBrowserDefect: { schema: "strict-browser-defect/v1", category: "network", source: "api", count: 1 } }]);
  const observedBadCategory = observeReleaseTestResult(JSON.stringify(badCategory));
  assert.deepEqual(observedBadCategory.strictBrowserDefects, []);
  assert.equal(observedBadCategory.rejectedFailureObservationCount, 1);
});

test("canary collector accepts a strict-browser suppression only when the audit invariant (suppressed <= recovered + closing-abort cap) holds", () => {
  const valid = contextReport([{ releaseApiMode: "development",
    releaseStrictBrowserSuppression: { schema: "strict-browser-suppression/v1",
      suppressedNetErrDefects: 4, recoveredTransportCount: 3, closingAbortCount: 1 } }]);
  const observedValid = observeReleaseTestResult(JSON.stringify(valid));
  assert.deepEqual(observedValid.strictBrowserSuppressions, [{
    specFile: "notice-roundtrip.spec.ts", resultOrdinal: 1,
    schema: "strict-browser-suppression/v1", suppressedNetErrDefects: 4, recoveredTransportCount: 3, closingAbortCount: 1,
  }]);
  assert.equal(observedValid.rejectedFailureObservationCount, 0);

  const impossible = contextReport([{ releaseApiMode: "development",
    releaseStrictBrowserSuppression: { schema: "strict-browser-suppression/v1",
      suppressedNetErrDefects: 5, recoveredTransportCount: 3, closingAbortCount: 1 } }]);
  const observedImpossible = observeReleaseTestResult(JSON.stringify(impossible));
  assert.deepEqual(observedImpossible.strictBrowserSuppressions, [],
    "suppressed count can never exceed the harness's own recovered-transport + closing-abort cap");
  assert.equal(observedImpossible.rejectedFailureObservationCount, 1);
});

test("clinic timings preserve both owning flows and require one observation per action", () => {
  const collect = (action, file) => observeReleaseTestResult(JSON.stringify(contextReport([
    { clinicInteractionTiming: { schema: "release-clinic-interaction/v1", action, viewport: 390, responseMs: 410, listVisibleMs: 560 } },
  ], file))).clinicInteractionTimings;
  const add = collect("manual-add", "clinic-roundtrip.spec.ts");
  const pass = collect("manual-pass", "student-clinic-required-cancel-realuse.spec.ts");
  assert.equal(add.length, 1);
  assert.equal(pass.length, 1);
  assert.equal(add[0].responseMs, 410);
  assert.equal(pass[0].listVisibleMs, 560);
  assert.doesNotThrow(() => runner.assertClinicInteractionTimings({ clinicInteractionTimings: [...add, ...pass] }));
  for (const incomplete of [[], add, pass, [...add, ...add, ...pass]]) {
    assert.throws(() => runner.assertClinicInteractionTimings({ clinicInteractionTimings: incomplete }), /missing or duplicated/);
  }
});

test("clinic timings reject private fields, wrong owners and invalid elapsed measurements", () => {
  const marker = { schema: "release-clinic-interaction/v1", action: "manual-add", viewport: 390, responseMs: 400, listVisibleMs: 500 };
  const invalid = [
    { ...marker, student: "private-user" }, { ...marker, action: "secret-token" },
    { ...marker, schema: "private-user" }, { ...marker, viewport: 999 },
    { ...marker, responseMs: -1 }, { ...marker, responseMs: 0.5 },
    { ...marker, responseMs: "secret-token" }, { ...marker, responseMs: Infinity },
    { ...marker, listVisibleMs: 399 }, { ...marker, listVisibleMs: 7_200_001 },
    { ...marker, listVisibleMs: null },
  ];
  for (const [file, values] of [["clinic-roundtrip.spec.ts", invalid],
    ["student-clinic-required-cancel-realuse.spec.ts", [marker]], ["notice-roundtrip.spec.ts", [marker]]]) {
    const observed = observeReleaseTestResult(JSON.stringify(contextReport(values.map((value) => ({ clinicInteractionTiming: value })), file)));
    assert.deepEqual(observed.clinicInteractionTimings, []);
    assert.equal(observed.rejectedFailureObservationCount, values.length);
    assert.doesNotMatch(JSON.stringify(observed), /private-user|secret-token/);
  }
  const bounded = observeReleaseTestResult(JSON.stringify(contextReport(
    Array.from({ length: 129 }, () => ({ clinicInteractionTiming: marker })), "clinic-roundtrip.spec.ts")));
  assert.equal(bounded.clinicInteractionTimings.length, 128);
  assert.equal(bounded.droppedFailureObservationCount, 1);
  assert.throws(() => runner.assertClinicInteractionTimings(bounded), /missing or duplicated/);
});

test("transport truth preserves ordered reported errors but never interprets arbitrary scores as status", () => {
  const report = contextReport([]);
  report.suites[0].specs[0].tests[0].results[0].errors = [
    { message: "expect(received).toBe(expected)\nExpected: 403\nReceived: 401\nsecret-token", location: { file: "C:/private/video-playback-renewal.realuse.spec.ts", line: 750, column: 5 } },
    { message: "Release API boundary failed: secret-token", location: { file: "C:/private/releaseApiBoundary.ts", line: 647, column: 33 } },
    { message: "GET /api/v1/clinic/sessions/ returned 502: private-user", location: { file: "C:/private/strictTest.ts", line: 1, column: 1 } },
  ];
  const observed = observeReleaseTestResult(JSON.stringify(report));
  assert.deepEqual(observed.reportedTestErrors.map((item) => [item.errorOrdinal, item.kind, item.expectedStatus, item.receivedStatus]),
    [[1, "assertion", null, null], [2, "boundary", null, null], [3, "http-status", null, 502]]);
  assert.doesNotMatch(JSON.stringify(observed), /secret-token|private-user|C:\/private|403|401/);
  assert.throws(() => assertReleaseSummary(report), /./);
});

test("transport truth rejects unsafe markers and accepts old snapshots without guessing missing counters", () => {
  const marker = { schema: "release-test-failure/v1", phase: "video-primary", kind: "assertion", expectedStatus: null, receivedStatus: null };
  const invalid = [
    { releaseTestFailure: { ...marker, rawError: "secret-token" } },
    { releaseTestFailure: { ...marker, phase: "private-user" } },
    { releaseTestFailure: { ...marker, kind: "secret-token" } },
    { releaseTestFailure: { ...marker, receivedStatus: 401 } },
    { omrCleanupStatus: { schema: "release-omr-cleanup-status/v1", stage: "remove", expectedStatuses: [200], receivedStatus: "secret-token" } },
    { crossTenantDenialProbe: { schema: "release-cross-tenant-denial/v1", status: 401, errorCode: "private-user" } },
  ];
  const report = contextReport(invalid, "video-playback-renewal.realuse.spec.ts");
  const observed = observeReleaseTestResult(JSON.stringify(report));
  assert.equal(observed.rejectedFailureObservationCount, invalid.length);
  assert.deepEqual(observed.testFailureObservations, []);
  assert.deepEqual(observed.omrCleanupStatuses, []);
  assert.deepEqual(observed.crossTenantDenialProbes, []);
  assert.throws(() => assertReleaseSummary(report), /./);
  assert.doesNotMatch(JSON.stringify(observed), /secret-token|private-user/);
  for (const payload of invalid) {
    const file = Object.hasOwn(payload, "omrCleanupStatus") ? "omr-review-realuse.spec.ts"
      : Object.hasOwn(payload, "crossTenantDenialProbe") ? "clinic-roundtrip.spec.ts" : "video-playback-renewal.realuse.spec.ts";
    const rejected = observeReleaseTestResult(JSON.stringify(contextReport([payload], file)));
    assert.equal(rejected.rejectedFailureObservationCount, 1, "the payload itself must be rejected even under its owning spec");
    assert.doesNotMatch(JSON.stringify(rejected), /secret-token|private-user/);
  }
  const bounded = observeReleaseTestResult(JSON.stringify(contextReport(Array.from({ length: 129 }, () => (
    { releaseTestFailure: { ...marker, phase: "context-check" } }
  )))));
  assert.equal(bounded.testFailureObservations.length, 128);
  assert.equal(bounded.droppedFailureObservationCount, 1);
  const old = policyModule.createReleaseContextObservation(null);
  old.record({ phase: "route-fetch", stage: "terminal", method: "POST", pathTemplate: null, nativeCode: "other" });
  const legacy = observeReleaseTestResult(JSON.stringify(contextReport([{ releaseContextObservation: old.snapshot() }])));
  assert.equal(Object.hasOwn(legacy.contextObservations[0].events[0], "pageOrdinal"), false);
  for (const field of ["nativeKind", "attemptDurationMs", "startDocumentLoadOrdinal"]) {
    const unsafe = old.snapshot();
    unsafe.events[0][field] = "secret-token";
    const rejected = observeReleaseTestResult(JSON.stringify(contextReport([{ releaseContextObservation: unsafe }])));
    assert.equal(rejected.rejectedContextObservationCount, 1);
    assert.deepEqual(rejected.contextObservations, []);
    assert.doesNotMatch(JSON.stringify(rejected), /secret-token/);
  }
});

test("transport truth page counters observe only main navigation and loaded documents and release listeners", async () => {
  const previousStrict = process.env.E2E_STRICT;
  const previousLog = console.log;
  process.env.E2E_STRICT = "strict";
  console.log = () => {};
  const page = new EventEmitter();
  const frame = { page: () => page };
  page.mainFrame = () => frame;
  const request = { frame: () => frame, isNavigationRequest: () => true };
  const observation = policyModule.createReleaseContextObservation(1);
  const guard = { observation, authentication: {}, observations: {}, transport: {}, requestTransportDiagnostics: [],
    beginClose: async () => {}, assertClean: () => {} };
  const context = Object.assign(new EventEmitter(), { request: {}, close: async () => context.emit("close") });
  const browser = Object.assign(new EventEmitter(), { newContext: async () => context });
  try {
    await releaseFixtureOptions(guard).browser[0]({ browser }, async () => {
      await browser.newContext(); context.emit("page", page);
      assert.deepEqual(observation.requestPageState(request), { pageOrdinal: 1, documentLoadOrdinal: 0, navigationOrdinal: 0 });
      page.emit("request", request); page.emit("domcontentloaded");
      page.emit("request", { ...request, isNavigationRequest: () => false });
      page.emit("request", { ...request, frame: () => ({}) });
      assert.deepEqual(observation.requestPageState(request), { pageOrdinal: 1, documentLoadOrdinal: 1, navigationOrdinal: 1 });
      page.emit("request", request);
      assert.equal(observation.requestPageState(request).documentLoadOrdinal, 1, "pending reload is not falsely counted as a loaded document");
      page.emit("domcontentloaded");
      assert.deepEqual(observation.requestPageState(request), { pageOrdinal: 1, documentLoadOrdinal: 2, navigationOrdinal: 2 });
      await context.close();
    });
  } finally {
    console.log = previousLog;
    if (previousStrict === undefined) delete process.env.E2E_STRICT; else process.env.E2E_STRICT = previousStrict;
  }
  assert.equal(page.listenerCount("request"), 0);
  assert.equal(page.listenerCount("domcontentloaded"), 0);
  assert.equal(browser.listenerCount("disconnected"), 0);
  assert.equal(observation.requestPageState({ frame: () => { throw new Error("closed"); } }), null);
});

test("transport truth exact playback endpoint templates survive without granting a request", async () => {
  for (const endpoint of ["events", "heartbeat", "refresh", "start", "renew", "end"]) {
    let handler;
    const context = { request: { fetch: async () => {} }, route: async (_pattern, callback) => { handler = callback; } };
    const guard = await installReleaseContextGuard(context, development);
    let attempts = 0;
    const url = `https://api.hakwonplus.com/api/v1/media/playback/${endpoint}/?token=secret-token`;
    await handler({ request: () => ({ url: () => url, method: () => "POST", postDataJSON: () => undefined,
      headerValue: async () => development.tenantCode, allHeaders: async () => ({ origin: development.webOrigin }) }),
    fetch: async () => { attempts++; throw new Error("route.fetch: aborted"); }, abort: async () => {},
    fulfill: async () => assert.fail("no synthetic success"), continue: async () => assert.fail("no escape") });
    assert.equal(attempts, 1); assert.throws(() => guard.assertClean(), /fetch-transport/);
    assert.throws(() => assertReleaseRequestSafe(production, url, "POST", production.tenantCode), /mutation refused/);
    const observed = observeReleaseTestResult(JSON.stringify(contextReport([{ releaseContextObservation: guard.observation.snapshot() }])));
    assert.equal(observed.contextObservations[0].events[0].pathTemplate, `/api/v1/media/playback/${endpoint}/`);
    assert.equal(observed.contextObservations[0].events[0].pageOrdinal, null);
    assert.equal(observed.contextObservations[0].events[0].nativeKind, "response-aborted");
    assert.doesNotMatch(JSON.stringify(observed), /secret-token/);
  }
});

test("release-aware browser worker fixture outlives the 690-second playback proof", () => {
  const source = readFileSync(new URL("../../e2e/fixtures/strictTest.ts", import.meta.url), "utf8");
  assert.match(source, /scope:\s*["']worker["'][^}\]]*timeout:\s*20\s*\*\s*60_000/s);
});

function releaseFixtureOptions(guard) {
  const source = readFileSync(new URL("../../e2e/fixtures/strictTest.ts", import.meta.url), "utf8");
  const fixtureSource = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?;\r?$/gm, "")
    .replace("export const test =", "const test =")
    .replace(/^export \{ expect \};\r?$/m, "");
  const dependencies = { ...policyModule, base: { extend: (value) => value }, expect: assert,
    installAccountNotificationGuard: () => {}, attachStrictBrowserGuards: () => ({ assertZeroDefects() {} }),
    installReleaseContextGuard: typeof guard === "function" ? guard : async () => guard, releaseBoundaryFromEnv: () => development };
  return new Function(...Object.keys(dependencies), `${fixtureSource}\nreturn test;`)(...Object.values(dependencies));
}

test("release-aware browser fixture emits evidence once before close and teardown assertions", async () => {
  const previousStrict = process.env.E2E_STRICT;
  process.env.E2E_STRICT = "strict";
  try {
    for (const explicitClose of [false, true]) {
      for (const failed of [false, true]) {
        const evidence = [];
        let closed = 0;
        let assertions = 0;
        const failure = new Error("Release API boundary failed: retained transport defect");
        const boundaryGuard = {
          authentication: { attempted: 0, accepted: 0 }, observations: { attempted: 0, accepted: 0 },
          transport: { readFetchRetries: 0 },
          requestTransportDiagnostics: [{ method: "POST", pathTemplate: "/api/v1/students/me/activity/",
            requestKind: "mutation", stage: "initial", transportCode: "transport" }],
          observation: policyModule.createReleaseContextObservation(1),
          beginClose: async () => {},
          assertClean() {
            assertions += 1;
            assert.equal(evidence.filter((line) => line.releaseApiMode).length, 1, "diagnostics must be emitted before any failing assertion");
            if (failed) throw failure;
          },
        };
        const options = releaseFixtureOptions(boundaryGuard);
        const originalNewContext = async () => {
          const context = new EventEmitter();
          context.request = {};
          context.close = async () => { closed += 1; context.emit("close"); };
          return context;
        };
        const browser = Object.assign(new EventEmitter(), { newContext: originalNewContext });
        const previousLog = console.log;
        console.log = (line) => evidence.push(JSON.parse(line));
        try {
          const running = options.browser[0]({ browser }, async (provided) => {
            const context = await provided.newContext();
            if (explicitClose) await context.close();
          });
          if (failed) await assert.rejects(running, (error) => error === failure);
          else await running;
        } finally { console.log = previousLog; }
        assert.equal(evidence.filter((line) => line.releaseApiMode).length, 1, "explicit close followed by worker teardown must not duplicate counters");
        const snapshots = evidence.filter((line) => line.releaseContextObservation).map((line) => line.releaseContextObservation);
        assert.equal(evidence.filter((line) => line.releaseTestFailure?.phase === "context-check").length, failed ? 1 : 0);
        assert.deepEqual(snapshots.map((item) => item.snapshotSequence), explicitClose ? [1, 2, 3] : [1]);
        assert.equal(browser.listenerCount("disconnected"), 0, "fixture releases its observation listeners even without explicit close");
        assert.deepEqual(evidence[0].requestTransportDiagnostics, boundaryGuard.requestTransportDiagnostics);
        assert.equal(evidence[0].releaseApiMode, "development");
        assert.equal(closed, explicitClose ? 1 : 0);
        assert.equal(assertions, explicitClose && !failed ? 2 : 1);
      }
    }
  } finally {
    if (previousStrict === undefined) delete process.env.E2E_STRICT;
    else process.env.E2E_STRICT = previousStrict;
  }
});

test("worker teardown emits every context before the first failing assertion", async () => {
  const previousStrict = process.env.E2E_STRICT;
  const previousLog = console.log;
  process.env.E2E_STRICT = "strict";
  const evidence = [];
  const assertionCounts = [0, 0];
  const failure = new Error("first context retained failure");
  const guards = [0, 1].map((index) => ({
    observation: policyModule.createReleaseContextObservation(index + 1),
    authentication: {}, observations: {}, transport: { readFetchRetries: index }, requestTransportDiagnostics: [],
    beginClose: async () => {},
    assertClean() { assertionCounts[index]++; if (index === 0) throw failure; },
  }));
  guards[1].observation.record({ phase: "route-fetch", stage: "terminal", method: "POST", pathTemplate: null, nativeCode: "EPIPE" });
  const browser = Object.assign(new EventEmitter(), {
    newContext: async () => Object.assign(new EventEmitter(), { request: {}, close: async () => {} }),
  });
  let index = 0;
  console.log = (line) => evidence.push(JSON.parse(line));
  try {
    await assert.rejects(releaseFixtureOptions(async () => guards[index++]).browser[0]({ browser }, async () => {
      await browser.newContext(); await browser.newContext();
    }), (error) => error === failure);
  } finally {
    console.log = previousLog;
    if (previousStrict === undefined) delete process.env.E2E_STRICT;
    else process.env.E2E_STRICT = previousStrict;
  }
  assert.equal(evidence.length, 3, "both context snapshots and the first check failure are retained");
  assert.deepEqual(evidence.filter((line) => line.releaseContextObservation).map((line) => line.releaseContextObservation.contextOrdinal), [1, 2]);
  assert.equal(evidence[2].releaseTestFailure.phase, "context-check");
  assert.equal(evidence[1].releaseContextObservation.events[0].nativeCode, "EPIPE");
  assert.deepEqual(assertionCounts, [1, 0], "existing fail-fast assertion ordering is unchanged");
  assert.equal(browser.listenerCount("disconnected"), 0);
});

test("late route rejection after close and disconnect is retained in the final snapshot", async () => {
  const previousStrict = process.env.E2E_STRICT;
  const previousLog = console.log;
  process.env.E2E_STRICT = "strict";
  const evidence = [];
  let handleRoute;
  let boundaryGuard;
  let rejectFetch;
  let fetchStarted;
  const started = new Promise((resolve) => { fetchStarted = resolve; });
  const context = Object.assign(new EventEmitter(), {
    request: { fetch: async () => assert.fail("no direct request is expected") },
    route: async (_pattern, handler) => { handleRoute = handler; }, close: async () => {},
  });
  const browser = Object.assign(new EventEmitter(), { newContext: async () => context });
  const options = releaseFixtureOptions(async () => {
    boundaryGuard = await installReleaseContextGuard(context, development);
    return boundaryGuard;
  });
  console.log = (line) => evidence.push(JSON.parse(line));
  try {
    await assert.rejects(options.browser[0]({ browser }, async () => {
      await browser.newContext();
      const handling = handleRoute({
        request: () => ({
          url: () => "https://api.hakwonplus.com/api/v1/clinic/participants/", method: () => "POST",
          postDataJSON: () => undefined, headerValue: async () => development.tenantCode,
          allHeaders: async () => ({ origin: development.webOrigin, "x-tenant-code": development.tenantCode }),
        }),
        fetch: () => { fetchStarted(); return new Promise((_resolve, reject) => { rejectFetch = reject; }); },
        abort: async () => {}, fulfill: async () => assert.fail("failed transport cannot fulfill"),
        continue: async () => assert.fail("API requests cannot escape the proxy"),
      });
      await started;
      context.emit("close"); browser.emit("disconnected");
      rejectFetch(new Error("route.fetch: Request context disposed."));
      await handling;
    }), /Release request rejected \[context-disposed\]/);
  } finally {
    console.log = previousLog;
    if (previousStrict === undefined) delete process.env.E2E_STRICT;
    else process.env.E2E_STRICT = previousStrict;
  }
  assert.equal(boundaryGuard.transport.readFetchRetries, 0);
  assert.equal(boundaryGuard.observation.data.events.at(-1).stage, "terminal");
  assert.equal(evidence.filter((line) => line.releaseApiMode).length, 1);
  const snapshots = evidence.filter((line) => line.releaseContextObservation).map((line) => line.releaseContextObservation);
  assert.deepEqual(snapshots.map((item) => item.snapshotSequence), [1, 2, 3]);
  assert.equal(snapshots.at(-1).events.at(-1).phase, "route-fetch");
  assert.equal(snapshots.at(-1).events.at(-1).stage, "terminal");
  assert.equal(evidence.at(-1).releaseTestFailure.phase, "context-check");
  assert.equal(browser.listenerCount("disconnected"), 0);
});

test("release lifecycle snapshots retain disconnect after context close and detach their listeners", async () => {
  const previousStrict = process.env.E2E_STRICT;
  process.env.E2E_STRICT = "strict";
  try {
    for (const order of ["disconnect-first", "context-first"]) {
      const observation = policyModule.createReleaseContextObservation(1);
      const guard = { observation, authentication: {}, observations: {}, transport: { readFetchRetries: 1 },
        requestTransportDiagnostics: [], beginClose: async () => {}, assertClean() {} };
      const context = Object.assign(new EventEmitter(), { request: {}, close: async () => {} });
      const page = new EventEmitter();
      const browser = Object.assign(new EventEmitter(), { newContext: async () => context });
      const evidence = [];
      const previousLog = console.log;
      console.log = (line) => evidence.push(JSON.parse(line));
      try {
        await releaseFixtureOptions(guard).browser[0]({ browser }, async () => {
          await browser.newContext(); context.emit("page", page);
          page.emit("console", { type: () => "error", text: () => "net::ERR_FAILED secret-token",
            location: () => ({ url: "https://api.hakwonplus.com/api/v1/parents/secret?token=hidden" }) });
          page.emit("pageerror", new TypeError("secret-name private-url"));
          page.emit("crash"); page.emit("close");
          if (order === "context-first") context.emit("close");
          browser.emit("disconnected");
          if (order === "disconnect-first") context.emit("close");
          context.emit("close"); browser.emit("disconnected");
        });
      } finally { console.log = previousLog; }
      const snapshots = evidence.map((line) => line.releaseContextObservation);
      const final = snapshots.at(-1);
      for (const phase of ["browser-console", "browser-pageerror", "page-crash", "page-close", "context-close", "browser-disconnected"]) {
        assert.equal(final.events.filter((event) => event.phase === phase).length, 1, `${order}: ${phase} recorded once`);
      }
      assert.deepEqual(final.events.slice(0, 2).map(({ category, sourceKind }) => ({ category, sourceKind })),
        [{ category: "network", sourceKind: "api" }, { category: "runtime", sourceKind: "unknown" }]);
      assert.equal(evidence.filter((line) => line.releaseApiMode).length, 1);
      assert.equal(browser.listenerCount("disconnected"), 0);
      assert.equal(context.listenerCount("page"), 0);
      for (const event of ["console", "pageerror", "crash", "close"]) assert.equal(page.listenerCount(event), 0);
      assert.doesNotMatch(JSON.stringify(evidence), /secret-token|secret-name|private-url|parents\/secret|hidden/);
    }
  } finally {
    if (previousStrict === undefined) delete process.env.E2E_STRICT;
    else process.env.E2E_STRICT = previousStrict;
  }
});

test("student-parent real-use creation follows mandatory account notice policy", () => {
  const source = readFileSync(new URL("../../e2e/helpers/qaStudentParentScenario.ts", import.meta.url), "utf8");
  assert.match(source, /initial_password:\s*QA_STUDENT_PASSWORD/);
  assert.doesNotMatch(source, /send_welcome_message:\s*false/);
  assert.doesNotMatch(source, /core\/change-password/);
  assert.match(source, /await loginApi\(request, student\.ps_number, student\.password\)/);
  assert.match(source, /await loginApi\(request, parentPhone, QA_STUDENT_PASSWORD\)/);
});

test("student-parent real-use selects the intended child and uses supported clinic cleanup", () => {
  const scenarioSource = readFileSync(new URL("../../e2e/helpers/qaStudentParentScenario.ts", import.meta.url), "utf8");
  const clinicSource = readFileSync(new URL("../../e2e/student/student-parent-clinic-realuse.spec.ts", import.meta.url), "utf8");
  const childScopedSpecs = ["assessment", "community", "learning", "storage"].map((name) => (
    readFileSync(new URL(`../../e2e/student/student-parent-${name}-realuse.spec.ts`, import.meta.url), "utf8")
  ));

  assert.match(scenarioSource, /export async function selectParentStudentThroughUi/);
  assert.match(scenarioSource, /withStudentPhones\?: boolean/);
  for (const source of childScopedSpecs) {
    assert.match(source, /selectParentStudentThroughUi\(page,/);
  }
  assert.match(clinicSource, /createQaFamily\([^;]+\{ withStudentPhones: true \}\)/s);
  assert.match(clinicSource, /remove\("DELETE", `\/clinic\/sessions\/\$\{sessionId\}\/`\)/);
  assert.doesNotMatch(clinicSource, /remove\("DELETE", `\/clinic\/participants\//);
  assert.match(clinicSource, /verify clinic participant \$\{participantId\} absent/);
});

test("student-parent cleanup seals hard-delete storage cleanup before reporting success", () => {
  const source = readFileSync(new URL("../../e2e/helpers/qaStudentParentScenario.ts", import.meta.url), "utf8");

  assert.match(source, /export type QaFamilyCleanupResult/);
  assert.match(source, /expect\(deletion\.deleted\)\.toBe\(ids\.length\)/);
  assert.match(source, /expect\(deletion\.storage_cleanup\)\.toEqual\(\{ pending: 0, failed: 0 \}\)/);
  assert.match(source, /return deletion;/);
});

test("development canary seals required-student two-slot self-cancellation and mock delivery", () => {
  const specName = "student-clinic-required-cancel-realuse.spec.ts";
  const spec = readFileSync(new URL(`../../e2e/student/${specName}`, import.meta.url), "utf8");
  const config = readFileSync(new URL("../../playwright.development-release.config.ts", import.meta.url), "utf8");
  const runnerSource = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");

  assert.match(config, new RegExp(specName.replaceAll(".", "\\.")));
  assert.match(runnerSource, new RegExp(`"${specName}": 1`));
  for (const required of [
    "/student/exams/${created.examId}/submit/",
    "/results/admin/clinic-targets/",
    "/clinic/participants/bulk-create/",
    "/set_status/",
    "/messaging/log/?scope=clinic&status=success&origin_id_prefix=",
    "provider_message_id",
    "mock-",
  ]) {
    assert.ok(spec.includes(required), `missing required clinic cancellation evidence: ${required}`);
  }
  assert.match(spec, /requested:\s*2/);
  assert.match(spec, /failed:\s*0/);
  assert.match(spec, /send_to:\s*"both"/);
  assert.doesNotMatch(spec, /\/messaging\/scheduled\//);
  assert.match(spec, /expect\(deliveryRows\)\.toHaveLength\(2\)/);
  assert.match(spec, /target_type\)\.sort\(\)\)\.toEqual\(\["parent", "student"\]\)/);
  assert.doesNotMatch(spec, /recipient_summary\)\)\.size\)\.toBe\(2\)/);
  assert.match(spec, /recipient_summary\.length > 0/);
  assert.match(spec, /template_summary\)\)\.size\)\.toBe\(1\)/);
  assert.match(spec, /template_summary\.length > 0/);
  const cleanupSource = spec.slice(
    spec.indexOf("async function cleanup("),
    spec.indexOf("test.describe.serial("),
  );
  const familyCleanupIndex = cleanupSource.indexOf("cleanupQaFamily(");
  const sessionCleanupIndex = cleanupSource.indexOf("created.clinicSessionIds");
  assert.ok(familyCleanupIndex >= 0 && sessionCleanupIndex > familyCleanupIndex,
    "family cleanup must remove participants before clinic session deletion");
  const chipLabel = spec.match(/chip_label:\s*"([^"]+)"/)?.[1] ?? "";
  assert.ok(chipLabel.length > 0 && [...chipLabel].length <= 2, "clinic chip_label must satisfy backend max_length=2");
  for (const createPath of [
    "/lectures/lectures/",
    "/lectures/sessions/",
    "/enrollments/session-enrollments/bulk_create/",
    "/clinic/sessions/",
  ]) {
    const escapedPath = createPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(spec, new RegExp(`${escapedPath}.*?\\}, \\[201\\]\\);`, "s"));
  }
});

test("student-parent real-use awaits and dismisses the actual initial-account prompts", () => {
  const promptSource = readFileSync(new URL("../../e2e/helpers/firstLoginGuide.ts", import.meta.url), "utf8");
  const scenarioSource = readFileSync(new URL("../../e2e/helpers/qaStudentParentScenario.ts", import.meta.url), "utf8");
  const accountSource = readFileSync(new URL("../../e2e/student/student-parent-account-realuse.spec.ts", import.meta.url), "utf8");
  const learningSource = readFileSync(new URL("../../e2e/student/student-parent-learning-realuse.spec.ts", import.meta.url), "utf8");
  const runnerSource = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");

  assert.match(promptSource, /getByRole\("dialog", \{ name: "비밀번호 변경 권장" \}\)/);
  assert.match(promptSource, /waitFor\(\{ state: "visible", timeout: 5_000 \}\)/);
  assert.match(promptSource, /getByRole\("button", \{ name: "위험을 이해했고 나중에", exact: true \}\)/);
  assert.doesNotMatch(promptSource, /isVisible\(\{ timeout:/);
  assert.match(scenarioSource, /await acknowledgeInitialAccountPromptsIfVisible\(page\);/);
  assert.match(scenarioSource, /export async function reloadStudentApp/);
  assert.match(accountSource, /gotoAndSettle\(page, `\$\{QA_BASE\}\/student\/profile`/);
  assert.doesNotMatch(accountSource, /loginThroughUi\(page, student\.ps_number, student\.password\);\s*await expect\(page\.locator\("\.stu-topbar__name"\)\)/s);
  assert.match(learningSource, /if \(!created\.videoId && created\.sessionId\)/);
  assert.match(learningSource, /if \(!created\.videoId && created\.lectureId\)/);
  assert.match(runnerSource, /"firstLoginGuide\.ts"/);
});

test("parent reset receipt uses the phone-free target and always restores the QA password", () => {
  const source = readFileSync(new URL("../../e2e/student/student-parent-account-realuse.spec.ts", import.meta.url), "utf8");

  assert.match(source, /target_id: `parent:\$\{student\.id\}`/);
  assert.doesNotMatch(source, /target_id: `parent:\$\{student\.id\}:\$\{family\.parentPhone\}`/);
  assert.match(source, /try \{[\s\S]*temp_password: staffParentPassword[\s\S]*\} finally \{[\s\S]*temp_password: family\.parentPassword/);
});

test("long-video proof propagates strict context teardown failures", () => {
  const source = readFileSync(new URL("../../e2e/student/video-playback-renewal.realuse.spec.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Promise\.allSettled\(runs\.map\(\(\{ context \}\) => context\.close\(\)\)\)/);
  assert.match(source, /await Promise\.all\(runs\.map\(\(\{ context \}\) => context\.close\(\)\)\)/);
  assert.match(source, /const bootstrap = state\.bootstraps\.at\(-1\);/);
  assert.doesNotMatch(source, /const bootstrap = state\.bootstraps\[0\];/);
});

test("long-video proof serializes the reload and exit burst after concurrent playback", async () => {
  const source = readFileSync(new URL("../../e2e/student/video-playback-renewal.realuse.spec.ts", import.meta.url), "utf8");
  const gateSource = readFileSync(new URL("../../e2e/helpers/serialProofGate.ts", import.meta.url), "utf8");
  const gateModule = await import(
    `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(gateSource)).toString("base64")}`
  );
  assert.match(source, /import \{ createSerialProofGate \} from "\.\.\/helpers\/serialProofGate"/);
  assert.doesNotMatch(source, /function createSerialProofGate/);
  assert.match(source, /const runReloadProof = createSerialProofGate\(\);/);
  assert.match(source, /await runReloadProof\(async \(\) => \{/);
  assert.match(source, /await page\.waitForLoadState\("networkidle", \{ timeout: 10_000 \}\);\s*await emitPagehideListenerSnapshot\(page, state\.viewport, "before-reload"\);\s*await page\.reload/s);
  assert.match(source, /finishStudent\(page, state, videoId, hlsPath, runReloadProof\)/);

  const events = [];
  const gate = gateModule.createSerialProofGate();
  const first = gate(async () => {
    events.push("first-start");
    throw new Error("first-failure");
  });
  const second = gate(async () => {
    events.push("second-start");
  });
  const outcomes = await Promise.allSettled([first, second]);
  assert.deepEqual(events, ["first-start"]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status), ["rejected", "rejected"]);
});

test("pagehide diagnostic init script counts only pagehide add/remove calls and always delegates", () => {
  const source = readFileSync(new URL("../../e2e/student/video-playback-renewal.realuse.spec.ts", import.meta.url), "utf8");
  const marker = "await page.addInitScript(() => {";
  const start = source.indexOf(marker) + marker.length;
  const end = source.indexOf('\n  });\n  page.on("console"', start);
  assert.ok(start > marker.length - 1 && end > start, "pagehide diagnostic init script markers not found");
  const body = stripTypeScriptTypes(source.slice(start, end));

  const calls = [];
  const fakeWindow = {
    addEventListener(type) { calls.push(["add", type]); },
    removeEventListener(type) { calls.push(["remove", type]); },
  };
  new Function("window", body)(fakeWindow);

  fakeWindow.addEventListener("pagehide", () => {});
  fakeWindow.addEventListener("visibilitychange", () => {});
  fakeWindow.removeEventListener("pagehide", () => {});
  fakeWindow.removeEventListener("click", () => {});
  fakeWindow.addEventListener("pagehide", () => {});

  assert.deepEqual(fakeWindow.__pagehideDiag, { added: 2, removed: 1 },
    "only pagehide add/remove calls are counted, every other event type is ignored");
  assert.deepEqual(calls, [
    ["add", "pagehide"], ["add", "visibilitychange"], ["remove", "pagehide"], ["remove", "click"], ["add", "pagehide"],
  ], "the wrapper must always delegate to the real implementation, for every event type, unchanged");
});

test("each run has an independent non-published ownership capability", () => {
  assert.equal(typeof runner.createRunOwnership, "function");
  const env = { GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" };
  const first = runner.createRunOwnership(env);
  const second = runner.createRunOwnership(env);
  assert.match(first.capability, /^[a-f0-9]{64}$/);
  assert.notEqual(first.capability, second.capability);
  assert.notEqual(first.tenant, second.tenant);
  assert.throws(() => runner.createRunOwnership({ ...env, GITHUB_RUN_ID: "123-other" }));
  const source = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  assert.match(source, /OwnershipCapability: \[ownerCapability\]/);
  assert.match(source, /\{ tenant: crossTenant, capability: crossCapability \} = createRunOwnership/);
  assert.match(source, /writeEvidence\(false, \["development attempt unfinished; cleanup not proven"\]\)/);
  assert.match(source, /process\.on\("SIGTERM", interrupt\)/);
});

test("every pre-Inspect failure persists an allowlisted PII-free preflight bucket", async () => {
  assert.equal(typeof runner.runPreflightStages, "function");
  const names = ["process", "bundle", "governance", "iam", "document", "host", "ssm"];
  for (const failedStage of names) {
    const snapshots = [];
    const stages = names.map((name) => [name, async () => {
      if (name === failedStage) {
        throw new Error("C:/secret/path arn:secret principal-secret session-secret capability-secret password-secret student-name");
      }
    }]);
    await assert.rejects(() => runner.runPreflightStages(stages,
      (evidence) => snapshots.push(structuredClone(evidence)), "a".repeat(40)));
    const evidence = snapshots.at(-1);
    assert.equal(evidence.preflightStage, failedStage);
    assert.equal(evidence.terminalOutcome, "preflight_failed");
    assert.equal(evidence.passed, false);
    assert.deepEqual(evidence.failures, ["development preflight unfinished; cleanup not proven"]);
    assert.deepEqual(Object.keys(evidence.preflightChecks), names.slice(1));
    for (const [name, passed] of Object.entries(evidence.preflightChecks)) {
      assert.equal(passed, names.indexOf(name) < names.indexOf(failedStage));
    }
    const published = JSON.stringify(evidence);
    for (const forbidden of ["C:/secret/path", "arn:secret", "principal-secret", "session-secret",
      "capability-secret", "password-secret", "student-name"]) {
      assert.doesNotMatch(published, new RegExp(forbidden));
    }
  }
});

test("preflight writes an inert envelope before checks and marks only reviewed prerequisites", async () => {
  const snapshots = [];
  const names = ["process", "bundle", "governance", "iam", "document", "host", "ssm"];
  const evidence = await runner.runPreflightStages(names.map((name) => [name, async () => {}]),
    (current) => snapshots.push(structuredClone(current)), "not-a-reviewed-sha secret-path");
  assert.deepEqual(snapshots[0], {
    frontendSha: null,
    backendGovernanceSha: null,
    backendReleaseId: null,
    apiDigest: null,
    instanceId: null,
    tenantCode: null,
    artifactSha256: null,
    cases: null,
    documentSha256: {},
    cleanup: null,
    crossTenantCleanup: null,
    crossPostCleanupInspectObservation: null,
    operationObservation: null,
    cleanupObservation: null,
    inspectObservation: null,
    postCleanupInspectOperationObservation: null,
    postCleanupInspectObservation: null,
    realUseObservation: null,
    realUseProcessObservation: null,
    videoRuntimeObservation: null,
    postPlaybackInspectObservation: null,
    preflightStage: "process",
    preflightChecks: { bundle: false, governance: false, iam: false, document: false, host: false, ssm: false },
    terminalOutcome: "preflight_running",
    passed: false,
    failures: ["development preflight unfinished; cleanup not proven"],
  });
  assert.equal(evidence.preflightStage, "complete");
  assert.deepEqual(evidence.preflightChecks,
    { bundle: true, governance: true, iam: true, document: true, host: true, ssm: true });
  assert.equal(evidence.terminalOutcome, "qa_running");
  assert.doesNotMatch(JSON.stringify(snapshots), /not-a-reviewed-sha|secret-path/);
});

function runtimeEvidenceFixture(untilInitialWriteOnly) {
  const source = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  const start = source.indexOf("  const ownerParameters =");
  const end = untilInitialWriteOnly ? source.indexOf('  process.on("SIGINT", interrupt);', start)
    : source.indexOf('\n}\n\nif (process.argv[1]', start);
  assert.ok(start > 0 && end > start, "execute the unchanged post-preflight run body");
  const snapshots = [];
  const portChecks = [];
  const signals = [];
  let externalCalls = 0;
  const forbidden = () => { externalCalls++; assert.fail("runtime evidence test attempted external work"); };
  const deps = {
    assert, evidence: { preflightStage: "complete", passed: false },
    manifest: { releaseImageTag: "unit-release", images: { "academy-api": { digest: "unit-digest" } } },
    revision: "b".repeat(40), instanceId: "unit-instance", tenant: "qa-unit-primary", crossTenant: "qa-unit-cross",
    capability: "private-primary-capability", crossCapability: "private-cross-capability",
    bundle: "unit-bundle", fingerprint: "c".repeat(64), expectedDocuments: new Map([["unit-document", "unit-content"]]),
    sha: (value) => { assert.equal(value, "unit-content"); return "d".repeat(64); },
    process: { env: { GITHUB_SHA: "a".repeat(40) }, on: (name) => signals.push(`on:${name}`), off: (name) => signals.push(`off:${name}`) },
    persistEvidence: (value) => snapshots.push(JSON.parse(JSON.stringify(value))),
    artifactFingerprint: (value) => { assert.equal(value, "unit-bundle"); return "c".repeat(64); },
    assertFreePort: async (port) => { portChecks.push(port); throw new Error("private-controlled-pre-Setup-failure"); },
    aws: forbidden, ownedProcess: forbidden, serveArtifact: forbidden,
  };
  const tail = untilInitialWriteOnly
    ? "return { writeEvidence, setCrossObservation(value) { crossPostCleanupInspectObservation = value; } };" : "";
  const execute = new Function(...Object.keys(deps), `"use strict"; return async () => {\n${source.slice(start, end)}\n${tail}\n};`)(...Object.values(deps));
  return { execute, snapshots, portChecks, signals, externalCalls: () => externalCalls };
}

test("initial runtime evidence executes with null cross cleanup and retains later observation", async () => {
  const fixture = runtimeEvidenceFixture(true);
  const state = await fixture.execute();
  assert.equal(fixture.snapshots.length, 1);
  const initial = fixture.snapshots[0];
  assert.equal(initial.crossPostCleanupInspectObservation, null);
  assert.equal(initial.crossTenantCleanup, null);
  assert.equal(initial.postCleanupInspectObservation, null);
  assert.equal(initial.cases, null);
  assert.equal(initial.passed, false);
  assert.equal(initial.terminalOutcome, "qa_running");
  assert.deepEqual(initial.failures, ["development attempt unfinished; cleanup not proven"]);
  const observed = { tenantIdMatches: true, tenantRemainingZero: true, userRemainingZero: true };
  state.setCrossObservation(observed);
  state.writeEvidence(false);
  assert.deepEqual(fixture.snapshots[1].crossPostCleanupInspectObservation, observed);
  assert.equal(fixture.snapshots[1].passed, false);
  assert.equal(fixture.externalCalls(), 0);
  assert.deepEqual(fixture.signals, []);
  assert.doesNotMatch(JSON.stringify(fixture.snapshots), /private-/);
});

test("runtime evidence survives a controlled pre-Setup failure through the actual finally body", async () => {
  const fixture = runtimeEvidenceFixture(false);
  await assert.rejects(fixture.execute(), /Development release gate failed; see PII-free evidence/);
  assert.equal(fixture.snapshots.length, 2, "initial runtime and terminal failure must both persist");
  assert.deepEqual(fixture.portChecks, [18000]);
  assert.equal(fixture.externalCalls(), 0, "no AWS, Setup, process, or server call is permitted");
  assert.deepEqual(fixture.signals, ["on:SIGINT", "on:SIGTERM", "off:SIGINT", "off:SIGTERM"]);
  const terminal = fixture.snapshots[1];
  assert.equal(terminal.terminalOutcome, "qa_failed");
  assert.equal(terminal.passed, false);
  for (const key of ["cleanup", "crossTenantCleanup", "postCleanupInspectObservation", "crossPostCleanupInspectObservation", "realUseObservation"]) {
    assert.equal(terminal[key], null, `${key} must not invent completion before Setup`);
  }
  assert.deepEqual(terminal.failures, ["development identity/setup/real-use failed"]);
  assert.doesNotMatch(JSON.stringify(fixture.snapshots), /private-/);
});

test("fixed-document operation failures expose only allowlisted PII-free observations", () => {
  assert.equal(typeof runner.observeFixedOperationResult, "function");
  const sessionId = "session-secret-123";
  const result = runner.observeFixedOperationResult("Inspect", {
    code: 1,
    stdout: [
      `Starting session with SessionId: ${sessionId}`,
      JSON.stringify({
        status: "DEVELOPMENT_QA_FAILED",
        error_type: "AssertionError",
        failure_stage: "inspect_residue",
        tenant_id: 72,
        residue: { activity_audits: 1, outstanding_tokens: 2, listeners: 3, processes: 4, r2_objects: 5 },
      }),
      "raw-output-secret student-name token-secret capability-secret password-secret",
    ].join("\n"),
  });

  assert.deepEqual(result.observation, {
    action: "Inspect",
    exitCode: 1,
    jsonLineCount: 1,
    sessionIdObserved: true,
    payloadStatus: "DEVELOPMENT_QA_FAILED",
    errorType: "AssertionError",
    failureStage: "inspect_residue",
    tenantId: 72,
    residue: { activity_audits: 1, outstanding_tokens: 2, listeners: 3, processes: 4, r2_objects: 5 },
  });
  const published = JSON.stringify(result.observation);
  for (const forbidden of [sessionId, "student-name", "token-secret", "capability-secret", "password-secret", "raw-output-secret"]) {
    assert.doesNotMatch(published, new RegExp(forbidden));
  }
});

test("fixed-document operation observation preserves malformed and multiple JSON fail-closed signals", () => {
  const malformed = runner.observeFixedOperationResult("Setup", { code: 0, stdout: "{malformed" });
  assert.deepEqual(malformed.observation, {
    action: "Setup",
    exitCode: 0,
    jsonLineCount: 1,
    sessionIdObserved: false,
    payloadStatus: null,
    errorType: null,
    failureStage: null,
    tenantId: null,
    residue: null,
  });
  assert.ok(malformed.parseError);
  assert.equal(malformed.payload, null);

  const multiple = runner.observeFixedOperationResult("Cleanup", {
    code: 0,
    stdout: '{"status":"YMATH_REALUSE_SCENARIO_DESTROYED"}\n{"status":"DEVELOPMENT_QA_FAILED"}',
  });
  assert.equal(multiple.observation.jsonLineCount, 2);
  assert.equal(multiple.payload, null);
  assert.equal(multiple.parseError, null);
});

test("fixed-document operation observation rejects unreviewed values", () => {
  const result = runner.observeFixedOperationResult("DeleteEverything", {
    code: 999,
    stdout: JSON.stringify({ status: "student-name", error_type: "SecretProviderError" }),
  });
  assert.deepEqual(result.observation, {
    action: null,
    exitCode: null,
    jsonLineCount: 1,
    sessionIdObserved: false,
    payloadStatus: null,
    errorType: null,
    failureStage: null,
    tenantId: null,
    residue: null,
  });
  assert.doesNotMatch(JSON.stringify(result.observation), /DeleteEverything|student-name|SecretProviderError/);
});

test("Cleanup and post-cleanup Inspect failures retain only exact safe stage, tenant id, and numeric residue", () => {
  const residue = { activity_audits: 0, outstanding_tokens: 1, listeners: 0, processes: 0, r2_objects: 2 };
  const payload = {
    status: "DEVELOPMENT_QA_FAILED", error_type: "AssertionError",
    failure_stage: "cleanup_r2", tenant_id: 72, residue,
  };
  for (const action of ["Cleanup", "Inspect"]) {
    const observed = runner.observeFixedOperationResult(action, { code: 1, stdout: JSON.stringify(payload) });
    assert.deepEqual(observed.observation, {
      action, exitCode: 1, jsonLineCount: 1, sessionIdObserved: false,
      payloadStatus: "DEVELOPMENT_QA_FAILED", errorType: "AssertionError",
      failureStage: "cleanup_r2", tenantId: 72, residue,
    });
    if (action === "Cleanup") assert.throws(() => assertCleanup(observed.payload, "qa-safe", 72));
    else assert.throws(() => runner.assertPostCleanupInspect(observed.payload, "qa-safe", 72, {
      releaseImageTag: "release", images: { "academy-api": { digest: "sha256:digest" } },
    }));
    assert.equal(observed.observation.failureStage, "cleanup_r2", "throwing assertion must not erase diagnostics");
  }
  const preIdentityFailure = runner.observeFixedOperationResult("Inspect", { code: 1, stdout: JSON.stringify({
    ...payload, error_type: "PrivateProviderError", failure_stage: "bootstrap", tenant_id: 0,
  }) }).observation;
  assert.equal(preIdentityFailure.tenantId, 0, "pre-identity failures preserve the exact zero tenant id");
  assert.equal(preIdentityFailure.errorType, "OtherError", "unreviewed error classes are generalized");
  assert.doesNotMatch(JSON.stringify(preIdentityFailure), /PrivateProviderError/);

  for (const invalid of [
    { ...payload, failure_stage: "private-provider-stage" },
    { ...payload, tenant_id: -1 },
    { ...payload, tenant_id: Number.MAX_SAFE_INTEGER + 1 },
    { ...payload, residue: { ...residue, r2_objects: "2" } },
    { ...payload, residue: Object.fromEntries(Object.entries(residue).filter(([key]) => key !== "r2_objects")) },
    { ...payload, residue: { ...residue, private_count: 1 } },
    { ...payload, provider_error: "student-name token-secret" },
  ]) {
    const observation = runner.observeFixedOperationResult("Cleanup", { code: 1, stdout: JSON.stringify(invalid) }).observation;
    assert.equal(observation.payloadStatus, null);
    assert.equal(observation.errorType, null);
    assert.equal(observation.failureStage, null);
    assert.equal(observation.tenantId, null);
    assert.equal(observation.residue, null);
    assert.doesNotMatch(JSON.stringify(observation), /private-provider|student-name|token-secret/);
  }

  const source = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  assert.ok(source.indexOf("cleanupObservation = observed.observation") < source.indexOf("assert.equal(result.code"));
  assert.match(source, /postCleanupInspectOperationObservation, postCleanupInspectObservation/);
});

test("failed Setup captures only an exact positive safe-schema tenant id for final cleanup", () => {
  const residue = { activity_audits: 0, outstanding_tokens: 0, listeners: 0, processes: 0, r2_objects: 0 };
  const validFailure = runner.observeFixedOperationResult("Setup", { code: 1, stdout: JSON.stringify({
    status: "DEVELOPMENT_QA_FAILED", error_type: "AssertionError",
    failure_stage: "setup_readback", tenant_id: 73, residue,
  }) });
  assert.equal(runner.setupTenantIdFromOperation("Setup", validFailure, "qa-safe"), 73);
  const validSuccess = runner.observeFixedOperationResult("Setup", { code: 0, stdout: JSON.stringify({
    status: "YMATH_REALUSE_SCENARIO_READY", tenant_code: "qa-safe", tenant_id: 74,
  }) });
  assert.equal(runner.setupTenantIdFromOperation("Setup", validSuccess, "qa-safe"), 74);

  for (const [action, payload] of [
    ["Setup", { ...validFailure.payload, tenant_id: 0 }],
    ["Setup", { ...validFailure.payload, tenant_id: -1 }],
    ["Setup", { ...validFailure.payload, tenant_code: "qa-safe" }],
    ["Cleanup", validFailure.payload],
    ["Inspect", validFailure.payload],
  ]) {
    const observed = runner.observeFixedOperationResult(action, { code: 1, stdout: JSON.stringify(payload) });
    assert.equal(runner.setupTenantIdFromOperation(action, observed, "qa-safe"), null);
  }

  const source = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  assert.ok(source.indexOf("scenarioTenantId = capturedSetupTenantId") < source.indexOf("assert.equal(result.code"));
  assert.match(source, /operation\("Cleanup",\s*scenarioTenantId\)/);
  assert.match(source, /operation\("Inspect",\s*scenarioTenantId,\s*"post-cleanup"\)/);
});

test("Inspect match evidence records booleans without publishing compared values", () => {
  assert.equal(typeof runner.inspectMatchObservation, "function");
  const manifest = { releaseImageTag: "release-secret", images: { "academy-api": { digest: "sha256:digest-secret" } } };
  const inspected = {
    status: "DEVELOPMENT_QA_IDENTITY_PASS",
    remaining: { tenants: 0, users: 0 },
    release_id: manifest.releaseImageTag,
    digest: manifest.images["academy-api"].digest,
  };
  assert.deepEqual(runner.inspectMatchObservation(inspected, manifest), {
    statusMatches: true,
    remainingZero: true,
    releaseMatches: true,
    digestMatches: true,
  });
  const invalid = [
    [{ ...inspected, status: "DEVELOPMENT_QA_FAILED" }, "statusMatches"],
    [{ ...inspected, remaining: { tenants: 0, users: 1 } }, "remainingZero"],
    [{ ...inspected, release_id: "other-release" }, "releaseMatches"],
    [{ ...inspected, digest: "sha256:other-digest" }, "digestMatches"],
  ];
  for (const [payload, expectedFalse] of invalid) {
    const observation = runner.inspectMatchObservation(payload, manifest);
    assert.equal(observation[expectedFalse], false);
    assert.equal(Object.values(observation).filter((value) => value === false).length, 1);
    assert.doesNotMatch(JSON.stringify(observation), /release-secret|digest-secret|other-release|other-digest/);
  }
});

test("fixed SSM sessions keep stdin open until delayed JSON readback closes the client", async () => {
  const syntheticClient = [
    'process.stdout.write("\\nStarting session with SessionId: academy-fe-qa-unit-safe\\n");',
    'process.stdin.once("end", () => process.exit(0));',
    "process.stdin.resume();",
    'setTimeout(() => { process.stdout.write(\'{"status":"DEVELOPMENT_QA_IDENTITY_PASS"}\\n\'); process.exit(0); }, 100);',
  ].join("\n");
  const closedInput = runner.ownedProcess(process.execPath, ["-e", syntheticClient]);
  const keptOpen = runner.ownedProcess(process.execPath, ["-e", syntheticClient],
    { stdio: ["pipe", "pipe", "pipe"] });
  const [closedResult, openResult] = await Promise.all([closedInput.done, keptOpen.done]);
  assert.deepEqual(runner.observeFixedOperationResult("Inspect", closedResult).observation, {
    action: "Inspect", exitCode: 0, jsonLineCount: 0, sessionIdObserved: true,
    payloadStatus: null, errorType: null, failureStage: null, tenantId: null, residue: null,
  });
  assert.deepEqual(runner.observeFixedOperationResult("Inspect", openResult).observation, {
    action: "Inspect", exitCode: 0, jsonLineCount: 1, sessionIdObserved: true,
    payloadStatus: "DEVELOPMENT_QA_IDENTITY_PASS", errorType: null,
    failureStage: null, tenantId: null, residue: null,
  });
  const source = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  assert.match(source,
    /"--parameters", JSON\.stringify\(parameters\)\],\s*\{ stdio: \["pipe", "pipe", "pipe"\] \},/);
});

test("a timed-out owned process with held-open stdin is killed and reaped", { timeout: 10_000 }, async () => {
  assert.equal(typeof runner.ownedProcess, "function");
  const child = runner.ownedProcess(process.execPath, ["-e",
    'process.on("SIGTERM", () => {}); process.stdin.resume(); process.stdout.write("ready"); setInterval(() => {}, 10);'],
  { stdio: ["pipe", "pipe", "pipe"] }, 1_000, 100);
  try {
    const result = await child.done;
    assert.equal(result.code, -1);
    assert.equal(result.stopReason, "timeout");
    assert.match(result.signal || "", /^SIG(?:TERM|KILL)$/);
    assert.ok(result.durationMs >= 1_000 && result.durationMs < 10_000);
    assert.match(result.stdout, /ready/);
    assert.throws(() => process.kill(child.child.pid, 0));
  } finally { child.stop(); }
});

test("owned process observation exposes only allowlisted termination facts", () => {
  assert.deepEqual(runner.observeOwnedProcessResult({
    code: -1,
    signal: "SIGTERM",
    stopReason: "external-signal",
    durationMs: 600_123,
    stdout: "secret-token student-name",
    pid: 12345,
  }), {
    exitCode: -1,
    signal: "SIGTERM",
    stopReason: "external-signal",
    durationMs: 600_123,
  });
  const published = JSON.stringify(runner.observeOwnedProcessResult({
    code: "secret-token",
    signal: "student-name",
    stopReason: "C:/secret/path",
    durationMs: Number.POSITIVE_INFINITY,
  }));
  assert.deepEqual(JSON.parse(published), {
    exitCode: null,
    signal: null,
    stopReason: null,
    durationMs: null,
  });
  assert.doesNotMatch(published, /secret-token|student-name|secret\/path/);
});

const workflow = readFileSync(new URL("../../.github/workflows/quality-gate.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const job = (name) => workflow.match(new RegExp(`^  ${name}:\\n[\\s\\S]*?(?=^  [a-z][a-z0-9-]*:|$(?![\\s\\S]))`, "m"))?.[0] ?? "";

test("production promotion requires the non-skipped isolated development canary", () => {
  const development = job("development-canary");
  assert.ok(development, "missing mandatory development canary");
  assert.match(development, /name: deploy-bundle/);
  assert.match(development, /node scripts\/run-development-release-canary\.mjs/);
  assert.doesNotMatch(development, /continue-on-error: true|pnpm build|pnpm dev/);
  assert.match(job("deploy"), /needs: \[quality-check, hangul-companion-check, candidate-preview, development-canary\]/);
  assert.match(job("deploy"), /needs\.development-canary\.result == 'success'/);
});

test("expanded development real-use suite keeps time to report and clean up", () => {
  const runner = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  assert.match(runner, /const REAL_USE_SUITE_TIMEOUT_MS = 30 \* 60_000;/);
  assert.doesNotMatch(runner, /REAL_USE_SUITE_TIMEOUT_MS = 20 \* 60_000/);
  assert.match(runner, /}, REAL_USE_SUITE_TIMEOUT_MS\);/);
  assert.match(job("development-canary"), /timeout-minutes: 40/);
});

test("the SSM tunnel outlives the real-use suite it serves", () => {
  // A tunnel killed while tests are still in flight surfaces as
  // unexplained transport failures indistinguishable from a stale-socket
  // drop -- this guards the relationship, not just each literal, so the
  // two can't silently drift apart again in a future edit.
  const runner = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  assert.match(runner, /const TUNNEL_TIMEOUT_MS = REAL_USE_SUITE_TIMEOUT_MS \+ 5 \* 60_000;/);
  assert.match(runner, /name === PORT_DOCUMENT \? TUNNEL_TIMEOUT_MS : 240_000/);
});

test("production canary cannot create temporary business rows", () => {
  const production = job("e2e-roundtrip");
  assert.match(production, /E2E_ALLOW_PRODUCTION_WRITES: "0"/);
  assert.match(production, /E2E_RELEASE_API_MODE: readonly/);
  assert.doesNotMatch(production, /notice-roundtrip|qna-roundtrip|clinic-roundtrip/);
  assert.match(production, /session-assessment-realuse\.spec\.ts/);
  assert.match(production, /pnpm test:e2e:canary/);
  assert.match(production, /pnpm verify:tenant-availability/);
  assert.match(production, /ENTRY_ASSETS/);
  assert.match(job("rollback-on-e2e-failure"), /needs\.e2e-roundtrip\.result == 'failure'/);
});

test("development CI never borrows the backend production role or production credentials", () => {
  const development = job("development-canary");
  assert.match(development, /id-token: write/);
  assert.match(development, /role\/academy-frontend-development-qa/);
  assert.doesNotMatch(development, /academy-gha-ecr-build|secrets\.E2E_|environment: production|AWS_ACCESS_KEY_ID/);
});

test("assessment classification fails if a business write or skip is introduced", () => {
  const source = readFileSync(new URL("../../e2e/admin/session-assessment-realuse.spec.ts", import.meta.url), "utf8");
  assert.doesNotThrow(() => assertReadOnlyAssessmentSource(source));
  for (const change of ['await request.post("/api/v1/exams/")', 'apiCall(page, "POST", "/exams/")',
    'apiCall(page, "PATCH", "/homework/1/")', 'test.skip(true)', 'productionWriteOptInSkipReason()']) {
    assert.throws(() => assertReadOnlyAssessmentSource(`${source}\n${change}`));
  }
  assert.throws(() => assertReadOnlyAssessmentSource(source.replace("../fixtures/strictTest", "@playwright/test")));
});

function completeFlowReport() {
  return { errors: [], stats: { expected: 21, skipped: 0, unexpected: 0, flaky: 0 }, suites: [
    ...Object.entries({ "notice-roundtrip.spec.ts": 3, "qna-roundtrip.spec.ts": 4, "clinic-roundtrip.spec.ts": 4,
      "student-parent-account-realuse.spec.ts": 1, "student-parent-assessment-realuse.spec.ts": 1,
      "student-parent-clinic-realuse.spec.ts": 1, "student-parent-community-realuse.spec.ts": 1,
      "student-clinic-required-cancel-realuse.spec.ts": 1,
      "student-parent-homework-realuse.spec.ts": 1,
      "student-parent-learning-realuse.spec.ts": 1, "student-parent-storage-realuse.spec.ts": 1,
      "omr-review-realuse.spec.ts": 1,
      "video-playback-renewal.realuse.spec.ts": 1 }).map(([file, count]) => ({
      file, specs: Array.from({ length: count }, () => ({ file, tests: [{ expectedStatus: "passed", status: "expected", results: [{ status: "passed" }] }] })),
    })),
  ] };
}

test("long-video result observation preserves only allowlisted execution facts", () => {
  const report = completeFlowReport();
  report.config = {
    projects: [{ timeout: 17 * 60_000 }],
    metadata: { credential: "secret-token" },
  };
  const videoTest = report.suites.at(-1).specs[0].tests[0];
  videoTest.status = "unexpected";
  videoTest.results[0] = {
    status: "interrupted",
    duration: 600_123,
    error: { message: "worker died with secret-token student-name" },
  };
  report.stats.expected = 10;
  report.stats.unexpected = 1;
  const observed = observeReleaseTestResult(JSON.stringify(report));
  assert.deepEqual(observed.longVideoResult, {
    configuredTimeoutMs: 17 * 60_000,
    expectedStatus: "passed",
    testStatus: "unexpected",
    resultCount: 1,
    resultStatus: "interrupted",
    durationMs: 600_123,
    errorCount: 1,
  });
  assert.doesNotMatch(JSON.stringify(observed), /secret-token|student-name/);
});

test("long-video response capture failures are explicitly joined instead of becoming unhandled", () => {
  const source = readFileSync(new URL("../../e2e/student/video-playback-renewal.realuse.spec.ts", import.meta.url), "utf8");
  assert.match(source, /responseFailure:\s*Promise<unknown>/);
  assert.match(source, /await Promise\.race\(\[playbackProof,\s*state\.responseFailure\.then/s);
  assert.match(
    source,
    /\.catch\(\(error\) => \{\s*state\.responseFailureKind \?\?= captureKind;\s*state\.responseFailureCode \?\?= responseFailureCode\(error\);\s*state\.responseError/s,
  );
});

test("real-use failure observation publishes only allowlisted endpoint templates, status, and boundary codes", () => {
  const report = completeFlowReport();
  const failed = report.suites[0].specs[0].tests[0];
  failed.status = "unexpected";
  failed.results[0] = {
    status: "failed",
    errors: [{
      message: "Release request rejected [tenant] GET /api/v1/student/video/sessions/123/videos/ secret-token student-name",
      location: { file: "C:/secret/qaStudentParentScenario.ts", line: 122, column: 9 },
    }, {
      message: "POST /students/bulk_permanent_delete/?ids=secret-token returned 409: student-name",
      location: { file: "C:/secret/qaStudentParentScenario.ts", line: 136, column: 5 },
    }, {
      message: "GET /api/v1/parents/by-login/qaStudentName123/ returned 404: student-name",
    }, {
      message: "GET /api/v1/files/018f8e2a-7abc-7def-8123-0123456789ab/ returned 404: uuid-v7",
    }, {
      message: "GET /api/v1/files/01JQ3Z7VB8J7MQ19AY7WQ4F8NN/ returned 404: ulid",
    }, {
      message: "GET /api/v1/r2/tenantAlpha/objectHashABC123/ returned 404: object-key",
    }],
    stdout: [{ text: `${JSON.stringify({ releaseApiMode: "development", transport: {
      readFetchRetries: 1, suppressedAnalyticsBatches: 2,
      suppressedAnalyticsEvents: 3, suppressedCloudflareBeacons: 4,
    }, requestTransportDiagnostics: [{
      method: "GET", pathTemplate: "/api/v1/core/tenant/by-host/", requestKind: "read",
      stage: "initial", transportCode: "timeout",
    }, {
      method: "GET", pathTemplate: "/api/v1/parents/by-login/secret/", requestKind: "read",
      stage: "retry", transportCode: "transport",
    }], ignored: "safe" })}\n` }],
  };
  report.errors.push({ message: "Release request rejected [cors] C:/secret/path" });
  report.stats.unexpected = 1;
  report.stats.expected = 10;
  assert.deepEqual(observeReleaseTestResult(JSON.stringify(report)), {
    reportStatus: "parsed",
    clinicInteractionTimings: [],
    stats: { expected: 10, skipped: 0, unexpected: 1, flaky: 0 },
    failedFiles: ["notice-roundtrip.spec.ts"],
    failureLocations: [{
      specFile: "notice-roundtrip.spec.ts",
      sourceFile: "qaStudentParentScenario.ts",
      line: 122,
      column: 9,
    }, {
      specFile: "notice-roundtrip.spec.ts",
      sourceFile: "qaStudentParentScenario.ts",
      line: 136,
      column: 5,
    }],
    boundaryCodes: ["cors", "tenant"],
    failureDiagnostics: [{
      code: "api-status",
      boundaryCode: null,
      method: "POST",
      pathTemplate: "/students/bulk_permanent_delete/",
      queryKeys: ["ids"],
      status: 409,
    }, {
      code: "boundary",
      boundaryCode: "tenant",
      method: "GET",
      pathTemplate: "/api/v1/student/video/sessions/:id/videos/",
      queryKeys: [],
      status: null,
    }],
    runnerErrorCount: 1,
    readFetchRetries: 1,
    mutationReplays: null,
    suppressedAnalyticsBatches: 2,
    suppressedAnalyticsEvents: 3,
    suppressedCloudflareBeacons: 4,
    requestTransportDiagnostics: [{
      method: "GET",
      pathTemplate: "/api/v1/core/tenant/by-host/",
      requestKind: "read",
      stage: "initial",
      transportCode: "timeout",
    }],
    contextObservations: [], rejectedContextObservationCount: 0, droppedContextObservationCount: 0,
    reportedTestErrors: Array.from({ length: 6 }, (_, index) => ({
      specFile: "notice-roundtrip.spec.ts", resultOrdinal: 1, errorOrdinal: index + 1,
      sourceFile: index < 2 ? "qaStudentParentScenario.ts" : null,
      kind: index === 0 ? "boundary" : index === 1 ? "http-status" : "other",
      expectedStatus: null, receivedStatus: index === 1 ? 409 : null,
    })),
    testFailureObservations: [], omrCleanupStatuses: [], crossTenantDenialProbes: [],
    strictBrowserDefects: [], strictBrowserSuppressions: [],
    rejectedFailureObservationCount: 0, droppedFailureObservationCount: 0,
    longVideo: null,
    longVideoFailure: null,
    longVideoErrorCodes: [],
    longVideoResult: null,
    longVideoCheckpoint: { desktop: null, mobile: null },
    longVideoPagehideListener: {
      desktop: { "playback-running": null, "before-reload": null },
      mobile: { "playback-running": null, "before-reload": null },
    },
  });
  const published = JSON.stringify(observeReleaseTestResult(JSON.stringify(report)));
  assert.doesNotMatch(
    published,
    /secret-token|student-name|C:\/secret\/path|qaStudentName123|018f8e2a-7abc-7def-8123-0123456789ab|01JQ3Z7VB8J7MQ19AY7WQ4F8NN|tenantAlpha|objectHashABC123/,
  );
  assert.deepEqual(observeReleaseTestResult("not-json secret-token"), {
    reportStatus: "unparsed",
    clinicInteractionTimings: [],
    stats: { expected: null, skipped: null, unexpected: null, flaky: null },
    failedFiles: [], failureLocations: [], boundaryCodes: [], failureDiagnostics: [], runnerErrorCount: null,
    readFetchRetries: null, mutationReplays: null, suppressedAnalyticsBatches: null,
    suppressedAnalyticsEvents: null, suppressedCloudflareBeacons: null,
    requestTransportDiagnostics: [],
    contextObservations: [], rejectedContextObservationCount: 0, droppedContextObservationCount: 0,
    reportedTestErrors: [], testFailureObservations: [], omrCleanupStatuses: [], crossTenantDenialProbes: [],
    strictBrowserDefects: [], strictBrowserSuppressions: [],
    rejectedFailureObservationCount: 0, droppedFailureObservationCount: 0,
    longVideo: null,
    longVideoFailure: null,
    longVideoErrorCodes: [],
    longVideoResult: null,
    longVideoCheckpoint: { desktop: null, mobile: null },
    longVideoPagehideListener: {
      desktop: { "playback-running": null, "before-reload": null },
      mobile: { "playback-running": null, "before-reload": null },
    },
  });
});

function contextReport(outputs, specFile) {
  const report = completeFlowReport();
  if (specFile) report.suites[0].specs[0].file = specFile;
  const failed = report.suites[0].specs[0].tests[0];
  failed.status = "unexpected";
  failed.results[0] = { status: "failed", workerIndex: 0,
    errors: [{ message: "Release request rejected [fetch-transport] OPTIONS /api/v1/clinic/participants/4321/set_status/?token=secret" },
      { message: "Release request rejected [fetch-transport] POST /api/v1/clinic/participants/:id/" }],
    stdout: outputs.map((value) => ({ text: `${JSON.stringify(value)}\n` })) };
  report.stats.expected -= 1; report.stats.unexpected = 1;
  return report;
}

test("official failed artifact retains only the latest bounded context snapshot and clinic OPTIONS diagnostic", () => {
  const observation = policyModule.createReleaseContextObservation(1);
  observation.record({ phase: "route-fetch", stage: "initial", method: "OPTIONS",
    pathTemplate: "/api/v1/clinic/participants/:id/set_status/", nativeCode: "ECONNRESET" });
  const initial = observation.snapshot();
  observation.record({ phase: "route-fetch", stage: "recovered", method: "OPTIONS",
    pathTemplate: "/api/v1/clinic/participants/:id/set_status/" });
  observation.record({ phase: "context-close", stage: "terminal" });
  const final = observation.snapshot();
  const report = contextReport([
    { releaseApiMode: "development", transport: { readFetchRetries: 1 }, releaseContextObservation: initial,
      requestTransportDiagnostics: [{ method: "OPTIONS", pathTemplate: "/api/v1/clinic/participants/:id/set_status/",
        requestKind: "read", stage: "initial", transportCode: "transport" }] },
    { releaseContextObservation: final }, { releaseContextObservation: initial }, { releaseContextObservation: final },
  ]);
  const realUseObservation = observeReleaseTestResult(JSON.stringify(report));
  const artifact = JSON.parse(JSON.stringify({ realUseObservation, passed: false }));
  assert.equal(artifact.passed, false);
  assert.equal(realUseObservation.readFetchRetries, 1, "snapshot replacement never re-adds inherited counters");
  assert.deepEqual(realUseObservation.contextObservations, [{ emittingSpecFile: "notice-roundtrip.spec.ts", workerIndex: 0, ...final }]);
  assert.equal(realUseObservation.rejectedContextObservationCount, 0);
  assert.equal(realUseObservation.droppedContextObservationCount, 0);
  assert.equal(realUseObservation.requestTransportDiagnostics[0].method, "OPTIONS");
  assert.equal(realUseObservation.failureDiagnostics[0].pathTemplate, "/api/v1/clinic/participants/:id/set_status/");
  assert.equal(realUseObservation.failureDiagnostics[1].pathTemplate, "/api/v1/clinic/participants/:id/", "already-redacted guard paths survive the report parser");
  assert.doesNotMatch(JSON.stringify(artifact), /4321|secret/);
});

test("cross-file snapshots identify the latest emitting file without claiming origin attribution", () => {
  const observer = policyModule.createReleaseContextObservation(1);
  const initial = observer.snapshot();
  observer.record({ phase: "context-close", stage: "terminal" });
  const final = observer.snapshot();
  const report = contextReport([{ releaseContextObservation: initial }]);
  report.suites.push({ file: "clinic-roundtrip.spec.ts", specs: [{ file: "clinic-roundtrip.spec.ts", tests: [{
    expectedStatus: "passed", status: "expected", results: [{ status: "passed", workerIndex: 0,
      stdout: [{ text: JSON.stringify({ releaseContextObservation: final }) }] }],
  }] }] });
  const observed = observeReleaseTestResult(JSON.stringify(report));
  assert.deepEqual(observed.contextObservations, [{ emittingSpecFile: "clinic-roundtrip.spec.ts", workerIndex: 0, ...final }]);
  assert.equal(Object.hasOwn(observed.contextObservations[0], "specFile"), false);
});

test("official context observation sanitizer rejects unsafe fields and bounds context count", () => {
  const observer = policyModule.createReleaseContextObservation(null);
  observer.record({ phase: "api-request", stage: "terminal", method: "POST", pathTemplate: null, nativeCode: "other" });
  const safe = observer.snapshot();
  const invalid = [
    { ...safe, rawError: "secret" },
    { ...safe, contextOrdinal: "student-name" },
    { ...safe, events: [{ ...safe.events[0], rawUrl: "https://secret.invalid" }] },
    { ...safe, events: [{ ...safe.events[0], pathTemplate: "/api/v1/clinic/participants/4321/" }] },
    { ...safe, events: [{ ...safe.events[0], pathTemplate: "/api/v1/clinic/sessions/?token=secret" }] },
    { ...safe, events: [{ ...safe.events[0], nativeCode: "raw secret" }] },
    { ...safe, events: [{ ...safe.events[0], sourceKind: "student-name" }] },
    { ...safe, events: Array(129).fill(safe.events[0]) },
    { ...safe, droppedEventCount: -1 },
    { ...safe, unknownPathEventCounts: { ...safe.unknownPathEventCounts, secret: 1 } },
  ];
  const rejected = observeReleaseTestResult(JSON.stringify(contextReport(invalid.map((releaseContextObservation) => ({ releaseContextObservation })))));
  assert.deepEqual(rejected.contextObservations, []);
  assert.equal(rejected.rejectedContextObservationCount, invalid.length);
  assert.doesNotMatch(JSON.stringify(rejected), /student-name|secret\.invalid|raw secret/);
  const outputs = Array.from({ length: 129 }, (_, index) => ({ releaseContextObservation: { ...safe, observationOrdinal: index + 1 } }));
  const bounded = observeReleaseTestResult(JSON.stringify(contextReport(outputs)));
  assert.equal(bounded.contextObservations.length, 128);
  assert.equal(bounded.droppedContextObservationCount, 1);
  assert.equal(bounded.contextObservations[0].events[0].pathTemplate, null);
  assert.equal(bounded.contextObservations[0].unknownPathEventCounts["api-request"], 1);
});

test("all twenty-one real-use cases are mandatory; missing, skip, failure, retry and global errors fail closed", () => {
  assert.doesNotThrow(() => assertReleaseSummary(completeFlowReport()));
  const corrupt = [
    (report) => report.suites.pop(),
    (report) => report.suites[0].specs.pop(),
    (report) => { report.suites[0].specs[0].tests[0].expectedStatus = "skipped"; },
    (report) => { report.suites[0].specs[0].tests[0].results[0].status = "skipped"; },
    (report) => { report.suites[0].specs[0].tests[0].results[0].status = "failed"; },
    (report) => report.suites[0].specs[0].tests[0].results.push({ status: "passed" }),
    (report) => report.errors.push({ message: "afterAll cleanup failed" }),
    (report) => { report.stats.flaky = 1; },
  ];
  for (const mutate of corrupt) { const report = completeFlowReport(); mutate(report); assert.throws(() => assertReleaseSummary(report)); }
});

test("clinic calendar student management is a mandatory real backend and cleanup-zero contract", () => {
  const source = readFileSync(new URL("../../e2e/flows/clinic-roundtrip.spec.ts", import.meta.url), "utf8");
  const runnerSource = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");

  for (const required of [
    "clinic-console__schedule-trigger",
    "날짜·수업 선택",
    "배정 학생 관리",
    "/clinic/participants/bulk-create/",
    "/set_status/",
    ".reload",
    "width: 390",
    "날짜와 클리닉 수업",
    "E2E_STUDENT2_USER",
    "probeDevelopmentCrossTenantDenial",
  ]) {
    assert.match(source, new RegExp(required.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(source, /workspace\/clinic\/operations\?[^`"']*session=/);
  assert.match(runnerSource, /E2E_CROSS_TENANT_CODE:/);
  assert.match(runnerSource, /crossTenantCleanup/);
  assert.match(runnerSource, /assertCleanup\(crossTenantCleanup, crossTenant, crossScenarioTenantId\)/);
  assert.match(runnerSource, /assertPostCleanupInspect\([\s\S]*crossTenant[\s\S]*crossScenarioTenantId/);
});

test("cleanup requires the exact owned tenant and numeric zero tenant/user residue", () => {
  const tenant = "qa-ymath-realuse-fe-123-1-abcdef123456";
  const tenantId = 91;
  const valid = { tenant_code: tenant, tenant_id: tenantId, status: "YMATH_REALUSE_SCENARIO_DESTROYED", remaining: { tenants: 0, users: 0 } };
  assert.doesNotThrow(() => assertCleanup(valid, tenant, tenantId));
  for (const invalid of [{ ...valid, tenant_code: `${tenant}-foreign` }, { ...valid, remaining: { tenants: 0, users: 1 } },
    { ...valid, tenant_id: tenantId + 1 }, { ...valid, remaining: { tenants: "0", users: 0 } },
    { ...valid, status: "YMATH_REALUSE_SCENARIO_READY" }]) {
    assert.throws(() => assertCleanup(invalid, tenant, tenantId));
  }
});

test("cleanup and post-cleanup Inspect bind the exact Setup tenant id and require full zero residue", () => {
  const tenant = "qa-ymath-realuse-fe-123-1-abcdef123456";
  const tenantId = 91;
  const common = {
    TenantCode: [tenant], OwnershipCapability: ["a".repeat(64)],
    ReleaseId: [`sha-${"b".repeat(40)}-run-123-1`], ApiDigest: [`sha256:${"c".repeat(64)}`],
    SyntheticLongVideo: ["true"],
  };
  assert.deepEqual(runner.fixedOperationParameters(common, "Inspect"), { ...common, Action: ["Inspect"] });
  assert.deepEqual(runner.fixedOperationParameters(common, "Setup"), { ...common, Action: ["Setup"] });
  assert.deepEqual(runner.fixedOperationParameters(common, "Cleanup", tenantId), {
    ...common, Action: ["Cleanup"], TenantId: ["91"],
  });
  assert.deepEqual(runner.fixedOperationParameters(common, "Inspect", tenantId), {
    ...common, Action: ["Inspect"], TenantId: ["91"],
  });
  for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "91", null]) {
    assert.throws(() => runner.fixedOperationParameters(common, "Cleanup", invalid));
  }
  assert.throws(() => runner.fixedOperationParameters(common, "Setup", tenantId));

  const manifest = {
    releaseImageTag: common.ReleaseId[0], images: { "academy-api": { digest: common.ApiDigest[0] } },
  };
  const valid = {
    status: "DEVELOPMENT_QA_IDENTITY_PASS", tenant_code: tenant, tenant_id: tenantId,
    release_id: manifest.releaseImageTag, digest: manifest.images["academy-api"].digest,
    r2_scope_proven: true,
    remaining: { tenants: 0, users: 0 },
    residue: { activity_audits: 0, outstanding_tokens: 0, r2_objects: 0, processes: 0, listeners: 0 },
  };
  assert.deepEqual(runner.assertPostCleanupInspect(valid, tenant, tenantId, manifest), {
    statusMatches: true, tenantIdMatches: true, tenantRemainingZero: true, userRemainingZero: true,
    r2ScopeProven: true, r2ObjectsZero: true, processesZero: true, listenersZero: true,
    releaseMatches: true, digestMatches: true,
  });
  for (const invalid of [
    { ...valid, tenant_id: tenantId + 1 },
    { ...valid, remaining: { ...valid.remaining, tenants: 1 } },
    { ...valid, remaining: { ...valid.remaining, users: 1 } },
    { ...valid, r2_scope_proven: false },
    Object.fromEntries(Object.entries(valid).filter(([key]) => key !== "r2_scope_proven")),
    { ...valid, residue: { ...valid.residue, r2_objects: 1 } },
    { ...valid, residue: { ...valid.residue, processes: 1 } },
    { ...valid, residue: { ...valid.residue, listeners: 1 } },
  ]) assert.throws(() => runner.assertPostCleanupInspect(invalid, tenant, tenantId, manifest));

  const runnerSource = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  assert.match(runnerSource, /postCleanupInspectObservation/);
  assert.match(runnerSource, /operation\("Cleanup",\s*scenarioTenantId\)/);
  assert.match(runnerSource, /operation\("Inspect",\s*scenarioTenantId,\s*"post-cleanup"\)/);
});

test("strict browser fixture emits safe route diagnostics before an unrecovered transport fails the test", { timeout: 30_000 }, () => {
  const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test",
    "release-transport-diagnostic.fixture.ts", "--grep=unrecovered route transport",
    "--config=scripts/tests/fixtures/playwright.release-transport-diagnostic.config.ts"], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)), encoding: "utf8", timeout: 25_000,
    env: { ...process.env,
      E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0", E2E_STRICT: "strict",
      E2E_API_URL: "http://127.0.0.1:1", E2E_BASE_URL: "http://localhost:4173",
      E2E_TENANT_CODE: "qa-ymath-realuse-fixture-transport",
    },
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  assert.notEqual(result.status, 0, "unrecovered route transport must fail closed");
  assert.match(output, /Release API boundary failed: Release request rejected \[fetch-transport\] GET \/api\/v1\/student\/video\/sessions\/:id\/videos\/; Release request rejected \[fetch-transport\] GET/);
  assert.match(output, /"requestTransportDiagnostics":\[\{"method":"GET","pathTemplate":"\/api\/v1\/student\/video\/sessions\/:id\/videos\/","requestKind":"read","stage":"initial","transportCode":"transport"\},\{"method":"GET","pathTemplate":"\/api\/v1\/student\/video\/sessions\/:id\/videos\/","requestKind":"read","stage":"retry","transportCode":"transport"\}\]/);
  assert.doesNotMatch(output, /987654321|secret-student-name-839201|fixture-secret-query|fixture-secret-header/);
});

test("direct APIRequestContext mutation refusal stays path-safe and never reaches network", { timeout: 30_000 }, () => {
  const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test",
    "release-transport-diagnostic.fixture.ts", "--grep=direct APIRequestContext mutations",
    "--config=scripts/tests/fixtures/playwright.release-transport-diagnostic.config.ts"], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)), encoding: "utf8", timeout: 25_000,
    env: { ...process.env, E2E_RELEASE_API_MODE: "", E2E_ALLOW_PRODUCTION_WRITES: "", E2E_STRICT: "" },
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  assert.notEqual(result.status, 0, "direct business mutations must fail closed");
  assert.match(output, /\{"networkCalls":0,"violations":2\}/);
  assert.match(output, /Direct APIRequestContext fail-closed: Production release business mutation refused: POST \/api\/v1\/student\/video\/videos\/:id\/progress\/; Production release business mutation refused: PUT/);
  assert.doesNotMatch(output, /987654321|secret-student-name-839201|fixture-direct-secret-query|fixture-direct-secret-header/);
});

test("owned SSM cleanup accepts only exact terminalized history with zero active sessions", () => {
  const sessionId = "academy-fe-qa-unit-safe";
  const target = "i-0123456789abcdef0";
  const terminal = (Status) => ({ SessionId: sessionId, Target: target, Status, EndDate: "2026-09-07T01:57:58+09:00" });
  for (const status of ["Terminated", "Terminating"]) {
    assert.equal(runner.isOwnedSessionTerminal([], [terminal(status)], sessionId, target), true);
  }
  const invalid = [
    [[terminal("Connected")], [terminal("Terminating")]],
    [[], []],
    [[], [terminal("Terminated"), terminal("Terminated")]],
    [[], [{ ...terminal("Terminated"), SessionId: `${sessionId}-foreign` }]],
    [[], [{ ...terminal("Terminated"), Target: "i-foreign" }]],
    [[], [{ ...terminal("Terminated"), EndDate: null }]],
    ...["Connected", "Connecting", "Disconnected", "Failed"].map((Status) => [[], [terminal(Status)]]),
  ];
  for (const [active, history] of invalid) {
    assert.equal(runner.isOwnedSessionTerminal(active, history, sessionId, target), false);
  }
});

test("manifest and instance identity must match uniquely before setup", () => {
  const revision = "a".repeat(40);
  const release = `sha-${revision}-run-123-1`;
  const manifest = { schemaVersion: 1, status: "successful", complete: true, gitSha: revision,
    releaseImageTag: release, images: { "academy-api": { digest: `sha256:${"b".repeat(64)}` } } };
  const instance = { InstanceId: "i-0123456789abcdef0", State: { Name: "running" },
    IamInstanceProfile: { Arn: "arn:aws:iam::809466760795:instance-profile/academy-api-development" },
    Tags: Object.entries({ Name: "academy-v1-api-development", ManagedBy: "academy-api-development", Environment: "development",
      Lifecycle: "active", ReleaseId: release, VerifiedReleaseId: release }).map(([Key, Value]) => ({ Key, Value })) };
  assert.doesNotThrow(() => assertActiveInstance([instance], manifest));
  for (const invalid of [[], [instance, instance], [{ ...instance, IamInstanceProfile: { Arn: "production" } }],
    [{ ...instance, Tags: instance.Tags.filter((tag) => tag.Key !== "VerifiedReleaseId") }]]) {
    assert.throws(() => assertActiveInstance(invalid, manifest));
  }
  for (const invalid of [{ ...manifest, complete: false }, { ...manifest, status: "failed" }, { ...manifest, gitSha: "main" }]) {
    assert.throws(() => assertManifest(invalid));
  }
});

test("development config discovers twenty-one enabled cases without executing any API test", () => {
  const cwd = new URL("../../", import.meta.url);
  const output = execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test",
    "--config=playwright.development-release.config.ts", "--list"], {
    cwd, encoding: "utf8", env: { ...process.env,
      E2E_API_URL: "http://127.0.0.1:18000", E2E_BASE_URL: "http://localhost:4173",
      E2E_TENANT_CODE: "qa-ymath-realuse-fe-123-1-abcdef123456",
      E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0", E2E_STRICT: "strict",
      E2E_STUDENT_PARENT_REALUSE: "1", E2E_ALLOW_REAL_ALIMTALK: "0",
      E2E_STUDENT_PASS: "development-discovery-only" },
  });
  const report = JSON.parse(output);
  let discovered = 0;
  const visit = (suite) => {
    for (const spec of suite.specs || []) for (const test of spec.tests) {
      assert.equal(test.expectedStatus, "passed");
      assert.ok(!test.annotations?.some((annotation) => annotation.type === "skip"));
      assert.deepEqual(test.results, [], "--list must not run synthetic API scenarios");
      discovered += 1;
    }
    for (const child of suite.suites || []) visit(child);
  };
  visit(report);
  assert.equal(discovered, 21);
  // Playwright's --list reporter counts all unexecuted cases as skipped. These
  // are discovery-only, never accepted by assertReleaseSummary as real-use proof.
  assert.equal(report.stats.expected, 0);
  assert.throws(() => assertReleaseSummary(report));
});

test("OMR archive cleanup verifies the retained inactive exam before fixed runner cleanup", () => {
  const source = readFileSync(new URL("../../e2e/admin/omr-review-realuse.spec.ts", import.meta.url), "utf8");
  assert.match(source, /\/exams\/\$\{created\.examId\}\/\?include_inactive=true/);
  assert.match(source, /Number\(retained\.body\?\.id\) !== created\.examId/);
  assert.match(source, /retained\.body\?\.title !== EXAM_TITLE/);
  assert.match(source, /retained\.body\?\.is_active !== false/);
  assert.match(source, /fixed SSM Cleanup for the exact Setup tenant/);
  assert.match(source, /post-cleanup Inspect zero/);
  assert.doesNotMatch(source, /cleanup_e2e_residue exact-token execution is required/);
});

test("long-video setup, runtime and PII-free browser evidence fail closed", () => {
  assert.equal(typeof runner.assertLongVideoSetup, "function");
  assert.equal(typeof runner.observeLongVideoRuntime, "function");
  assert.equal(typeof runner.syntheticLongVideoAsset, "function");

  const setup = {
    status: "YMATH_REALUSE_SCENARIO_READY",
    tenant_id: 91,
    student_ids: [101, 102],
    session_ids: [201, 202],
    synthetic_long_video: {
      access_mode: "PROCTORED_CLASS",
      duration_seconds: 900,
      hls_path: "qa-fixtures/video-long/master.m3u8",
      video_accesses: 2,
      video_id: 301,
    },
  };
  assert.doesNotThrow(() => runner.assertLongVideoSetup(setup));
  for (const invalid of [
    { ...setup, tenant_id: 0 },
    { ...setup, tenant_id: Number.MAX_SAFE_INTEGER + 1 },
    { ...setup, student_ids: [101] },
    { ...setup, session_ids: [201] },
    { ...setup, session_ids: [201, 202, 203] },
    { ...setup, session_ids: [201, 0] },
    { ...setup, synthetic_long_video: { ...setup.synthetic_long_video, duration_seconds: 899 } },
    { ...setup, synthetic_long_video: { ...setup.synthetic_long_video, hls_path: "foreign/master.m3u8" } },
    { ...setup, synthetic_long_video: { ...setup.synthetic_long_video, video_accesses: 1 } },
    { ...setup, synthetic_long_video: { ...setup.synthetic_long_video, video_id: Number.MAX_SAFE_INTEGER + 1 } },
  ]) assert.throws(() => runner.assertLongVideoSetup(invalid));

  const runtime = {
    videos: 1, video_accesses: 2, proctored_video_accesses: 2, video_progresses: 2,
    playback_sessions: 4, active_playback_sessions: 0, playback_events: 20,
    player_errors: 0, violated_events: 0,
  };
  assert.deepEqual(runner.observeLongVideoRuntime(runtime), {
    videoCount: 1, videoAccessCount: 2, progressCount: 2, playbackSessionCount: 4,
    activePlaybackSessionCount: 0, playbackEventCount: 20, playerErrorCount: 0,
    violatedEventCount: 0,
  });
  for (const invalid of [
    { ...runtime, videos: 0 }, { ...runtime, video_progresses: 1 },
    { ...runtime, active_playback_sessions: 1 }, { ...runtime, player_errors: 1 },
    { ...runtime, violated_events: 1 },
  ]) assert.throws(() => runner.observeLongVideoRuntime(invalid));
  // Exiting both players must close all four pre/post-reload sessions.
  for (const invalid of [
    { ...runtime, active_playback_sessions: 2 },
    { ...runtime, active_playback_sessions: 5 },
    { ...runtime, active_playback_sessions: -1 },
    { ...runtime, active_playback_sessions: 1.5 },
  ]) assert.throws(() => runner.observeLongVideoRuntime(invalid));

  const master = runner.syntheticLongVideoAsset("/__qa__/video-long/master.m3u8");
  assert.equal(master.contentType, "application/vnd.apple.mpegurl");
  assert.match(master.body.toString(), /#EXTINF:900\.0,/);
  assert.ok(runner.syntheticLongVideoAsset("/__qa__/video-long/init.mp4").body.length > 0);
  assert.ok(runner.syntheticLongVideoAsset("/__qa__/video-long/media.m4s").body.length > 0);
  assert.throws(() => runner.syntheticLongVideoAsset("/__qa__/video-long/foreign.m4s"));

  const report = completeFlowReport();
  const longResult = report.suites.at(-1).specs[0].tests[0].results[0];
  longResult.stdout = [{ text: `${JSON.stringify({ longVideoRealUse: {
    schema: "student-video-renewal/v1", contexts: 2, desktop: 1, mobile: 1,
    minimumPlaybackSeconds: 690, minimumWallSeconds: 690,
    bootstrapCount: 2, renewCount: 2, endBeforeRenewCount: 0,
    initialMasterLoadCount: 2, initialMediaLoadCount: 4,
    posterLoadCount: 2,
    minimumRenewalAdvanceSeconds: 5, sourceReloadCount: 0,
    sameDomCount: 2, sameSessionCount: 2, tokenRotationCount: 2,
    progressPersistedCount: 2, maxReloadDriftSeconds: 2,
    consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0,
    horizontalOverflowCount: 0,
    bootstrapPolicyObservedCount: 2, bootstrapPolicyMonitoringTrueCount: 2, bootstrapPolicyProctoredCount: 2,
  } })}\n${JSON.stringify({ longVideoCheckpoint: {
    schema: "student-video-renewal-checkpoint/v1", viewport: "desktop", stage: "playback-started",
  } })}\n${JSON.stringify({ longVideoCheckpoint: {
    schema: "student-video-renewal-checkpoint/v1", viewport: "mobile", stage: "navigated",
  } })}\n${JSON.stringify({ longVideoPagehideListener: {
    schema: "student-video-renewal-pagehide-listener/v1", viewport: "desktop", stage: "playback-running",
    added: 1, removed: 0, live: 1,
  } })}\n${JSON.stringify({ longVideoPagehideListener: {
    schema: "student-video-renewal-pagehide-listener/v1", viewport: "desktop", stage: "before-reload",
    added: 1, removed: 1, live: 0,
  } })}\n${JSON.stringify({ longVideoPagehideListener: {
    schema: "student-video-renewal-pagehide-listener/v1", viewport: "mobile", stage: "playback-running",
    added: 1, removed: 0, live: 1,
  } })}\n${JSON.stringify({ longVideoPagehideListener: {
    // Inconsistent live (should be added-removed = 1, not 0) -- must be rejected, not silently accepted.
    schema: "student-video-renewal-pagehide-listener/v1", viewport: "mobile", stage: "before-reload",
    added: 1, removed: 0, live: 0,
  } })}\n` }];
  assert.deepEqual(runner.observeReleaseTestResult(JSON.stringify(report)).longVideoCheckpoint, {
    desktop: "playback-started", mobile: "navigated",
  });
  assert.deepEqual(runner.observeReleaseTestResult(JSON.stringify(report)).longVideoPagehideListener, {
    desktop: { "playback-running": { added: 1, removed: 0, live: 1 }, "before-reload": { added: 1, removed: 1, live: 0 } },
    mobile: { "playback-running": { added: 1, removed: 0, live: 1 }, "before-reload": null },
  }, "an inconsistent live value is dropped, not silently accepted -- the rest of the valid payloads still parse");
  assert.deepEqual(runner.observeReleaseTestResult(JSON.stringify(report)).longVideo, {
    schemaMatches: true, contextCount: 2, desktopCount: 1, mobileCount: 1,
    minimumPlaybackSeconds: 690, minimumWallSeconds: 690,
    bootstrapCount: 2, renewCount: 2, endBeforeRenewCount: 0,
    initialMasterLoadCount: 2, initialMediaLoadCount: 4,
    posterLoadCount: 2,
    minimumRenewalAdvanceSeconds: 5, sourceReloadCount: 0,
    sameDomCount: 2, sameSessionCount: 2, tokenRotationCount: 2,
    progressPersistedCount: 2, maxReloadDriftSeconds: 2,
    consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0,
    horizontalOverflowCount: 0,
    bootstrapPolicyObservedCount: 2, bootstrapPolicyMonitoringTrueCount: 2, bootstrapPolicyProctoredCount: 2,
  });
  longResult.stdout[0].text += `${JSON.stringify({ longVideoFailure: {
    schema: "student-video-renewal-failure/v1",
    contexts: ["desktop", "mobile"].map((viewport) => ({
      viewport, videoMounted: true, currentTime: 675, duration: 900, wallSeconds: 690,
      paused: false, ended: false, readyState: 4, networkState: 1,
      bootstrapCount: 1, renewCount: 1, progressCount: 24, latestProgress: 674,
      accessCheckCount: 24, masterLoads: 1, mediaLoads: 2,
      consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0,
      responseFailureKind: viewport === "desktop" ? "video-home" : "access",
      responseFailureCode: "api-origin",
    })),
  } })}\n`;
  assert.deepEqual(runner.observeReleaseTestResult(JSON.stringify(report)).longVideoFailure, {
    schemaMatches: true,
    contexts: ["desktop", "mobile"].map((viewport) => ({
      accessCheckCount: 24, bootstrapCount: 1, consoleErrorCount: 0, currentTime: 675,
      duration: 900, ended: false, latestProgress: 674, masterLoads: 1, mediaLoads: 2,
      networkState: 1, pageErrorCount: 0, paused: false, progressCount: 24, readyState: 4,
      renewCount: 1, requestErrorCount: 0,
      responseFailureKind: viewport === "desktop" ? "video-home" : "access",
      responseFailureCode: "api-origin",
      videoMounted: true, viewport, wallSeconds: 690,
    })),
  });
  const unsafeFailureReport = structuredClone(report);
  const unsafeFailureResult = unsafeFailureReport.suites.at(-1).specs[0].tests[0].results[0];
  unsafeFailureResult.stdout = [{ text: JSON.stringify({ longVideoFailure: {
    schema: "student-video-renewal-failure/v1",
    contexts: [{
      viewport: "desktop", videoMounted: false, currentTime: null, duration: null, wallSeconds: 0,
      paused: null, ended: null, readyState: null, networkState: null,
      bootstrapCount: 0, renewCount: 0, progressCount: 0, latestProgress: null,
      accessCheckCount: 0, masterLoads: 0, mediaLoads: 0,
      consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0,
      responseFailureKind: null,
      responseFailureCode: null,
      studentName: "must-not-publish",
    }],
  } }) }];
  const unsafeFailureObservation = runner.observeReleaseTestResult(JSON.stringify(unsafeFailureReport));
  assert.equal(unsafeFailureObservation.longVideoFailure, null);
  assert.doesNotMatch(JSON.stringify(unsafeFailureObservation), /must-not-publish/);
  const codedFailureReport = completeFlowReport();
  const codedFailure = codedFailureReport.suites.at(-1).specs[0].tests[0];
  codedFailure.status = "unexpected";
  codedFailure.results[0] = { status: "failed", errors: [{
    message: "locator.evaluate: Target page, context or browser has been closed\n"
      + "expect(received).toBeGreaterThanOrEqual(expected)\nExpected: >= 690\nsecret-token",
  }] };
  const codedObservation = runner.observeReleaseTestResult(JSON.stringify(codedFailureReport));
  assert.deepEqual(codedObservation.longVideoErrorCodes, [
    "context-closed", "playback-below-690", "video-evaluate-failed",
  ]);
  assert.doesNotMatch(JSON.stringify(codedObservation), /secret-token/);
  const playwrightErrorShapeReport = completeFlowReport();
  const playwrightErrorShape = playwrightErrorShapeReport.suites.at(-1).specs[0].tests[0];
  playwrightErrorShape.status = "unexpected";
  playwrightErrorShape.results[0] = {
    status: "failed",
    errors: [],
    error: {
      message: "locator.evaluate: Target page, context or browser has been closed\nsecret-token",
    },
  };
  const playwrightErrorShapeObservation = runner.observeReleaseTestResult(JSON.stringify(playwrightErrorShapeReport));
  assert.deepEqual(playwrightErrorShapeObservation.longVideoErrorCodes, [
    "context-closed", "video-evaluate-failed",
  ]);
  assert.doesNotMatch(JSON.stringify(playwrightErrorShapeObservation), /secret-token/);
  for (const invalidEvidence of [
    { sourceReloadCount: 1 },
    { minimumRenewalAdvanceSeconds: 4 },
    { initialMasterLoadCount: 1 },
    { initialMediaLoadCount: 3 },
    { posterLoadCount: 1 },
  ]) {
    const invalidReport = completeFlowReport();
    invalidReport.suites.at(-1).specs[0].tests[0].results[0].stdout = [{ text: `${JSON.stringify({ longVideoRealUse: {
      schema: "student-video-renewal/v1", contexts: 2, desktop: 1, mobile: 1,
      minimumPlaybackSeconds: 690, minimumWallSeconds: 690,
      bootstrapCount: 2, renewCount: 2, endBeforeRenewCount: 0,
      initialMasterLoadCount: 2, initialMediaLoadCount: 4,
      posterLoadCount: 2,
      minimumRenewalAdvanceSeconds: 5, sourceReloadCount: 0,
      sameDomCount: 2, sameSessionCount: 2, tokenRotationCount: 2,
      progressPersistedCount: 2, maxReloadDriftSeconds: 2,
      consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0,
      horizontalOverflowCount: 0, ...invalidEvidence,
    } })}\n` }];
    assert.equal(runner.observeReleaseTestResult(JSON.stringify(invalidReport)).longVideo, null);
  }
  longResult.stdout[0].text = `${JSON.stringify({ longVideoRealUse: {
    schema: "student-video-renewal/v1", contexts: 2, studentName: "must-not-publish",
  } })}\n`;
  assert.equal(runner.observeReleaseTestResult(JSON.stringify(report)).longVideo, null);
  longResult.stdout[0].text = `${JSON.stringify({ longVideoCheckpoint: {
    schema: "student-video-renewal-checkpoint/v1", viewport: "desktop",
    stage: "playback-started", studentName: "must-not-publish",
  } })}\n`;
  assert.deepEqual(runner.observeReleaseTestResult(JSON.stringify(report)).longVideoCheckpoint, {
    desktop: null, mobile: null,
  });
});

test("long-video bootstrap policy counters reject a missing field and an impossible count, never silently clamp", () => {
  const validPayload = {
    schema: "student-video-renewal/v1", contexts: 2, desktop: 1, mobile: 1,
    minimumPlaybackSeconds: 690, minimumWallSeconds: 690,
    bootstrapCount: 2, renewCount: 2, endBeforeRenewCount: 0,
    initialMasterLoadCount: 2, initialMediaLoadCount: 4, posterLoadCount: 2,
    minimumRenewalAdvanceSeconds: 5, sourceReloadCount: 0,
    sameDomCount: 2, sameSessionCount: 2, tokenRotationCount: 2,
    progressPersistedCount: 2, maxReloadDriftSeconds: 2,
    consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0, horizontalOverflowCount: 0,
    bootstrapPolicyObservedCount: 4, bootstrapPolicyMonitoringTrueCount: 2, bootstrapPolicyProctoredCount: 2,
  };
  const report = completeFlowReport();
  const longResult = report.suites.at(-1).specs[0].tests[0].results[0];
  const withStdout = (payload) => { longResult.stdout = [{ text: `${JSON.stringify({ longVideoRealUse: payload })}\n` }]; };

  withStdout(validPayload);
  assert.ok(runner.observeReleaseTestResult(JSON.stringify(report)).longVideo);

  const { bootstrapPolicyObservedCount: _omit, ...missingField } = validPayload;
  withStdout(missingField);
  assert.equal(runner.observeReleaseTestResult(JSON.stringify(report)).longVideo, null,
    "an omitted bootstrap-policy counter is rejected, not defaulted");

  withStdout({ ...validPayload, bootstrapPolicyMonitoringTrueCount: 5 });
  assert.equal(runner.observeReleaseTestResult(JSON.stringify(report)).longVideo, null,
    "monitoring-true count cannot exceed the observed bootstrap count -- reject, never clamp");

  withStdout({ ...validPayload, bootstrapPolicyProctoredCount: 5 });
  assert.equal(runner.observeReleaseTestResult(JSON.stringify(report)).longVideo, null,
    "proctored count cannot exceed the observed bootstrap count -- reject, never clamp");
});

test("synthetic 900-second HLS fixture decodes and advances in real Chromium", { timeout: 15_000 }, async () => {
  const server = http.createServer((request, response) => {
    try {
      const pathname = new URL(request.url, "http://unit").pathname;
      if (pathname === "/") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end('<!doctype html><video muted playsinline></video>');
        return;
      }
      const asset = runner.syntheticLongVideoAsset(pathname);
      response.writeHead(200, { "content-type": asset.contentType, "cache-control": "no-store" });
      response.end(asset.body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/hls.js/dist/hls.min.js", import.meta.url)) });
    await page.evaluate(() => {
      const video = document.querySelector("video");
      const hls = new window.Hls({ lowLatencyMode: false });
      window.__unitHls = hls;
      hls.loadSource("/__qa__/video-long/master.m3u8");
      hls.attachMedia(video);
    });
    await assert.doesNotReject(async () => {
      await page.waitForFunction(() => document.querySelector("video")?.duration === 900);
      await page.evaluate(() => document.querySelector("video").play());
      await page.waitForFunction(() => document.querySelector("video")?.currentTime >= 1);
    });
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("official runner opts into two-student long-video setup without publishing credentials", async () => {
  const runnerSource = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  const configSource = readFileSync(new URL("../../playwright.development-release.config.ts", import.meta.url), "utf8");
  const specSource = readFileSync(new URL("../../e2e/student/video-playback-renewal.realuse.spec.ts", import.meta.url), "utf8");
  const posterBridgeSource = readFileSync(new URL("../../e2e/helpers/syntheticVideoPosterBridge.ts", import.meta.url), "utf8");
  const responseKindSource = readFileSync(new URL("../../e2e/helpers/videoPlaybackResponseKind.ts", import.meta.url), "utf8");
  const playerSource = readFileSync(new URL("../../src/app_student/domains/video/playback/player/StudentVideoPlayer.tsx", import.meta.url), "utf8");
  const playerCssSource = readFileSync(new URL("../../src/app_student/domains/video/playback/player/player.css", import.meta.url), "utf8");
  assert.match(runnerSource, /SyntheticLongVideo: \[syntheticLongVideo \? "true" : "false"\]/);
  assert.match(runnerSource, /scenario = await operation\("Setup"\)/);
  assert.match(runnerSource, /E2E_STUDENT2_USER: "ymath-qa-student-02"/);
  assert.match(runnerSource, /E2E_LONG_VIDEO_ID: String\(scenario\.synthetic_long_video\.video_id\)/);
  assert.match(runnerSource, /E2E_LONG_VIDEO_TENANT_ID: String\(scenario\.tenant_id\)/);
  assert.match(configSource, /student\/video-playback-renewal\.realuse\.spec\.ts/);
  assert.match(configSource, /timeout: 17 \* 60_000/);
  for (const required of ["690", "390", "500", "1366", "390", "reload", "playback/end/", "media/playback/renew/"]) {
    assert.match(specSource, new RegExp(required.replace("/", "\\/")));
  }
  assert.match(specSource, /bootstrapCountBeforeRenewal/);
  assert.doesNotMatch(specSource, /bootstrapCount:\s*states\.reduce\(\(total\) => total \+ 1/);
  assert.match(specSource, /toBeGreaterThan\(MINIMUM_PLAYBACK_SECONDS\)/);
  assert.match(specSource, /sourceReloadCount/);
  assert.match(specSource, /expect\(payload\.play_url == null\)\.toBe\(true\)/);
  assert.match(specSource, /state\.allowedMasterUrls\.size\)\.toBe\(2\)/);
  assert.match(specSource, /installSyntheticVideoPosterBridge/);
  assert.match(specSource, /classifyVideoPlaybackResponse/);
  assert.match(specSource, /if \(response\.request\(\)\.method\(\) === "OPTIONS"\) return;/);
  assert.ok(specSource.indexOf('response.request().method() === "OPTIONS"')
    < specSource.indexOf("const playbackResponseKind = classifyVideoPlaybackResponse"));
  assert.match(specSource, /state\.accessCheckCount\)\.toBeGreaterThanOrEqual\(1\)/);
  assert.match(specSource, /longVideoCheckpoint/);
  assert.match(runnerSource, /longVideoCheckpoint/);
  assert.match(specSource, /const pausedBeforeStart = await video\.evaluate/);
  assert.match(specSource, /if \(pausedBeforeStart\)/);
  assert.doesNotMatch(specSource, /await page\.locator\("button\.svpBigPlay"\)\.click\(\);/);
  assert.match(playerSource, /className="svpPlayScrim"/);
  const bigPlayRule = playerCssSource.match(/\.svpBigPlay\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body || "";
  assert.doesNotMatch(bigPlayRule, /inset:\s*0/);
  assert.match(bigPlayRule, /width:\s*88px/);
  assert.match(bigPlayRule, /height:\s*88px/);
  assert.match(bigPlayRule, /z-index:\s*21/);
  const responseKindModule = await import(
    `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(responseKindSource)).toString("base64")}`
  );
  const playbackPath = "https://api.example.test/api/v1/student/video/videos/17/playback/";
  assert.equal(responseKindModule.classifyVideoPlaybackResponse(playbackPath, "POST", 17), "bootstrap");
  assert.equal(responseKindModule.classifyVideoPlaybackResponse(`${playbackPath}?enrollment=23`, "POST", 17), "bootstrap");
  assert.equal(responseKindModule.classifyVideoPlaybackResponse(`${playbackPath}?access_check=1`, "GET", 17), "access");
  assert.equal(responseKindModule.classifyVideoPlaybackResponse(`${playbackPath}?access_check=1&enrollment=23`, "GET", 17), "access");
  for (const [url, method] of [
    [playbackPath, "GET"],
    [`${playbackPath}?access_check=1`, "POST"],
    [`${playbackPath}?enrollment=0`, "POST"],
    [`${playbackPath}?enrollment=23&enrollment=24`, "POST"],
    [`${playbackPath}?enrollment=23&extra=1`, "POST"],
    [`${playbackPath}?access_check=1&access_check=1`, "GET"],
    [`${playbackPath}?access_check=1&enrollment=0`, "GET"],
    [`${playbackPath}?access_check=1&extra=1`, "GET"],
  ]) {
    assert.equal(responseKindModule.classifyVideoPlaybackResponse(url, method, 17), "invalid");
  }
  assert.equal(responseKindModule.classifyVideoPlaybackResponse(
    "https://api.example.test/api/v1/student/video/videos/18/playback/", "POST", 17,
  ), "other");
  assert.match(specSource, /isSessionVideoList\(url\.pathname\)/);
  assert.match(specSource, /item\.id === videoId && item\.session_id === sessionId/);
  assert.match(specSource, /state\.sessionPosterCaptureCount \+= 1/);
  assert.match(specSource, /state\.sessionPosterCaptureCount\)\.toBeGreaterThan\(sessionPosterCapturesBeforeReload\)/);
  assert.match(specSource, /url\.pathname === "\/api\/v1\/student\/video\/me\/"/);
  assert.match(specSource, /lecture\.sessions\.some\(\(session\) => session\.id === sessionId\)/);
  assert.match(specSource, /state\.homePosterCaptureCount \+= 1/);
  assert.match(specSource, /state\.homePosterCaptureCount\)\.toBeGreaterThan\(homePosterCapturesBeforeExit\)/);
  assert.match(specSource, /expect\(state\.requestErrorCount\)\.toBe\(0\);\s*expect\(state\.bootstraps\)/s);
  assert.match(posterBridgeSource, /state\.allowedPosterUrls\.has\(rawUrl\)/);
  assert.match(posterBridgeSource, /for \(let attempt = 0; attempt < 60; attempt \+= 1\)/);
  assert.match(posterBridgeSource, /await route\.fallback\(\)/);
  assert.ok(posterBridgeSource.indexOf("await route.fulfill")
    < posterBridgeSource.indexOf("state.posterLoads += 1"));
  assert.doesNotMatch(specSource, /state\.masterLoads\)\.toBeGreaterThanOrEqual\(2\)/);
  assert.doesNotMatch(specSource, /state\.mediaLoads\)\.toBeGreaterThanOrEqual\(4\)/);
});

const posterBridgeSource = readFileSync(new URL("../../e2e/helpers/syntheticVideoPosterBridge.ts", import.meta.url), "utf8");
const { installSyntheticVideoPosterBridge } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(posterBridgeSource)).toString("base64")}`
);

test("real Chromium bridges only exact response-derived posters and HLS origin", { timeout: 45_000 }, async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><main>release boundary fixture</main>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const webOrigin = `http://127.0.0.1:${server.address().port}`;
  const mediaOrigin = "https://media.fixture.invalid";
  const expiresAt = Math.floor(Date.now() / 1_000) + 1_500;
  const signature = "a".repeat(43);
  const masterUrl = `${mediaOrigin}/qa-fixtures/video-long/master.m3u8?exp=${expiresAt}&kid=v1&sig=${signature}&uid=11`;
  const posterPath = "/tenants/7/video/hls/77/thumbnail.jpg";
  const version = Math.floor(Date.now() / 1_000);
  const posterQuery = `v=${version}&exp=${expiresAt}&sig=${signature}&kid=v1`;
  const posterUrl = `${mediaOrigin}${posterPath}?${posterQuery}`;
  const sessionPosterUrl = `${mediaOrigin}${posterPath}?v=${version}&exp=${expiresAt + 1}&sig=${"b".repeat(43)}&kid=v1`;
  const delayedSessionPosterUrl = `${mediaOrigin}${posterPath}?v=${version}&exp=${expiresAt + 2}&sig=${"c".repeat(43)}&kid=v1`;
  const clockSkewPosterUrl = `${mediaOrigin}${posterPath}?v=${version}&exp=${Math.floor(Date.now() / 1_000) + 21_630}&sig=${"d".repeat(43)}&kid=v1`;
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const guard = await installReleaseContextGuard(context, {
      mode: "development", webOrigin, apiOrigin: "http://127.0.0.1:1", tenantCode: "qa-ymath-realuse-unit",
    });
    await context.route("**/qa-fixtures/video-long/**", async (route) => {
      if (route.request().url() !== masterUrl) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.apple.mpegurl",
        headers: { "access-control-allow-origin": webOrigin },
        body: "#EXTM3U\n#EXT-X-ENDLIST\n",
      });
    });
    const state = {
      responseChain: Promise.resolve(),
      allowedMasterUrls: new Set([masterUrl]),
      allowedPosterUrls: new Set([posterUrl, sessionPosterUrl, clockSkewPosterUrl]),
      posterLoads: 0,
    };
    await installSyntheticVideoPosterBridge(context, state, 7, 77);
    const page = await context.newPage();
    await page.goto(webOrigin);
    assert.equal(await page.evaluate(async (url) => (await fetch(url)).status, masterUrl), 200);
    assert.equal(await page.evaluate((url) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    }), posterUrl), true);
    assert.equal(await page.evaluate((url) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    }), sessionPosterUrl), true);
    setTimeout(() => {
      state.responseChain = state.responseChain.then(async () => {
        state.allowedPosterUrls.add(delayedSessionPosterUrl);
      });
    }, 100);
    assert.equal(await page.evaluate((url) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    }), delayedSessionPosterUrl), true);
    assert.equal(await page.evaluate((url) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    }), clockSkewPosterUrl), true);
    assert.equal(state.posterLoads, 4);
    assert.doesNotThrow(() => guard.assertClean());
    await context.close();

    const rejected = [
      {
        url: `${mediaOrigin}${posterPath}?v=${version}&exp=${expiresAt + 2}&sig=${"c".repeat(43)}&kid=v1`,
        kind: "poster",
        responseDerived: false,
      },
      { url: `https://foreign.fixture.invalid${posterPath}?${posterQuery}`, kind: "poster" },
      { url: `${mediaOrigin}/tenants/8/video/hls/77/thumbnail.jpg?${posterQuery}`, kind: "poster" },
      { url: `${mediaOrigin}/tenants/7/video/hls/78/thumbnail.jpg?${posterQuery}`, kind: "poster" },
      { url: `${mediaOrigin}${posterPath}?v=${version}&exp=${expiresAt}&kid=v1`, kind: "poster" },
      { url: `${posterUrl}&uid=11`, kind: "poster" },
      { url: `${mediaOrigin}${posterPath}?v=${version}&exp=${expiresAt + 21_600}&sig=${signature}&kid=v1`, kind: "poster" },
      { url: `${mediaOrigin}${posterPath}?v=${version}&exp=${Math.floor(Date.now() / 1_000) + 21_720}&sig=${signature}&kid=v1`, kind: "poster" },
      { url: `${mediaOrigin}${posterPath}?v=1e3&exp=${expiresAt}&sig=${signature}&kid=v1`, kind: "poster" },
      { url: `${mediaOrigin}${posterPath}?v=0${version}&exp=${expiresAt}&sig=${signature}&kid=v1`, kind: "poster" },
      { url: masterUrl.replace("&uid=11", ""), kind: "hls" },
    ];
    for (const { url: candidate, kind, responseDerived = true } of rejected) {
      const rejectedContext = await browser.newContext();
      const rejectedGuard = await installReleaseContextGuard(rejectedContext, {
        mode: "development", webOrigin, apiOrigin: "http://127.0.0.1:1", tenantCode: "qa-ymath-realuse-unit",
      });
      const rejectedState = {
        responseChain: Promise.resolve(),
        allowedMasterUrls: new Set([masterUrl]),
        allowedPosterUrls: new Set(responseDerived ? [candidate] : [posterUrl]),
        posterLoads: 0,
      };
      await rejectedContext.route("**/qa-fixtures/video-long/**", async (route) => {
        if (route.request().url() === masterUrl) {
          await route.fulfill({ status: 200, contentType: "application/vnd.apple.mpegurl", body: "#EXTM3U\n" });
          return;
        }
        await route.fallback();
      });
      await installSyntheticVideoPosterBridge(rejectedContext, rejectedState, 7, 77);
      const rejectedPage = await rejectedContext.newPage();
      await rejectedPage.goto(webOrigin);
      if (kind === "hls") {
        await rejectedPage.evaluate((url) => fetch(url).then(() => undefined).catch(() => undefined), candidate);
      } else {
        await rejectedPage.evaluate((url) => new Promise((resolve) => {
          const image = new Image();
          image.onload = image.onerror = () => resolve(undefined);
          image.src = url;
        }), candidate);
      }
      assert.throws(() => rejectedGuard.assertClean(), /Release request rejected \[origin\]/);
      assert.equal(rejectedState.posterLoads, 0);
      await rejectedContext.close();
    }
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("production permits reads and exact token authentication only", () => {
  assert.doesNotThrow(() => assertReleaseRequestSafe(production, "https://api.hakwonplus.com/healthz", "GET"));
  assert.doesNotThrow(() => assertReleaseRequestSafe(production, "https://api.hakwonplus.com/api/v1/token/", "POST", production.tenantCode));
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.throws(() => assertReleaseRequestSafe(production, "https://api.hakwonplus.com/api/v1/community/posts/", method, production.tenantCode), /mutation refused/);
  }
  assert.throws(() => assertReleaseRequestSafe(production, "https://api.hakwonplus.com/api/v1/token/other/", "POST", production.tenantCode), /mutation refused/);
});

test("development requests require exact identity and cannot escape to production", () => {
  assert.doesNotThrow(() => assertReleaseRequestSafe(development, "http://127.0.0.1:18000/api/v1/community/posts/", "POST", development.tenantCode));
  for (const tenant of [undefined, "hakwonplus", `${development.tenantCode}-other`]) {
    assert.throws(() => assertReleaseRequestSafe(development, "http://127.0.0.1:18000/api/v1/community/posts/", "POST", tenant), /QA tenant/);
  }
  assert.throws(() => assertReleaseRequestSafe(development, "https://api.hakwonplus.com/api/v1/community/posts/", "GET", development.tenantCode), /escaped/);
});

test("only the exact public tenant metadata read may omit the tenant header", () => {
  assert.equal(assertReleaseRequestSafe(
    development,
    "http://127.0.0.1:18000/api/v1/core/og-meta/?hostname=localhost",
    "GET",
  ), "read");
  assert.equal(assertReleaseRequestSafe(
    production,
    "https://api.hakwonplus.com/api/v1/core/og-meta/?hostname=hakwonplus.com",
    "GET",
  ), "read");
  for (const url of [
    "http://127.0.0.1:18000/api/v1/core/og-meta/?hostname=hakwonplus.com",
    "http://127.0.0.1:18000/api/v1/core/og-meta/?hostname=localhost&extra=1",
    "http://127.0.0.1:18000/api/v1/core/og-meta/?hostname=localhost&hostname=localhost",
    "http://127.0.0.1:18000/api/v1/community/posts/",
  ]) {
    assert.throws(() => assertReleaseRequestSafe(development, url, "GET"), /QA tenant/);
  }
  assert.throws(() => assertReleaseRequestSafe(
    development,
    "http://127.0.0.1:18000/api/v1/core/og-meta/?hostname=localhost",
    "POST",
  ), /QA tenant/);
});

test("missing/unsafe release configuration fails before creating a scenario", () => {
  for (const overrides of [{}, { E2E_ALLOW_PRODUCTION_WRITES: "1" }, { E2E_API_URL: "https://api.hakwonplus.com" }]) {
    assert.throws(() => releaseBoundaryFromEnv({ E2E_RELEASE_API_MODE: "development", ...overrides }));
  }
});

test("cross-tenant denial probe reaches only an existing sibling qa tenant with a read-only loopback request", async () => {
  const names = [
    "E2E_RELEASE_API_MODE",
    "E2E_ALLOW_PRODUCTION_WRITES",
    "E2E_API_URL",
    "E2E_BASE_URL",
    "E2E_TENANT_CODE",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  const calls = [];
  Object.assign(process.env, {
    E2E_RELEASE_API_MODE: "development",
    E2E_ALLOW_PRODUCTION_WRITES: "0",
    E2E_API_URL: "http://127.0.0.1:18000",
    E2E_BASE_URL: "http://localhost:4173",
    E2E_TENANT_CODE: "qa-ymath-realuse-fe-123-1-primary000001",
  });
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return new Response(null, { status: 401 });
  };
  try {
    assert.equal(await probeDevelopmentCrossTenantDenial({
      accessToken: "unit-token",
      participantId: 71,
      targetTenantCode: "qa-ymath-realuse-fe-123-1-sibling000001",
    }), 401);
    assert.equal(String(calls[0][0]), "http://127.0.0.1:18000/api/v1/clinic/participants/71/");
    assert.equal(calls[0][1].method, "GET");
    assert.equal(calls[0][1].redirect, "manual");
    assert.equal(calls[0][1].headers["X-Tenant-Code"], "qa-ymath-realuse-fe-123-1-sibling000001");
    await assert.rejects(() => probeDevelopmentCrossTenantDenial({
      accessToken: "unit-token",
      participantId: 71,
      targetTenantCode: process.env.E2E_TENANT_CODE,
    }), /distinct disposable QA tenant/);
    await assert.rejects(() => probeDevelopmentCrossTenantDenial({
      accessToken: "unit-token",
      participantId: 0,
      targetTenantCode: "qa-ymath-realuse-fe-123-1-sibling000001",
    }), /exact participant/);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("APIRequestContext mutation methods are rejected before network and redirects are disabled", async () => {
  const calls = [];
  const request = Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async (...args) => { calls.push([verb, ...args]); return { status: () => 200, ok: () => true }; }]));
  installReleaseRequestGuard(request, production);
  const headers = { "x-tenant-code": production.tenantCode };
  assert.throws(() => request.post("https://api.hakwonplus.com/api/v1/community/posts/", { headers }), /mutation refused/);
  assert.throws(() => request.fetch("https://api.hakwonplus.com/api/v1/community/posts/1/", { method: "DELETE", headers }), /mutation refused/);
  assert.equal(calls.length, 0);
  await request.get("https://api.hakwonplus.com/healthz");
  assert.equal(calls[0][2].maxRedirects, 0);
  assert.throws(() => request.get("https://external.example/healthz", { headers: { authorization: "Bearer unit" } }), /escaped/);
});

test("APIRequestContext retries one transport rejection only for GET/HEAD and records safe diagnostics", async () => {
  const install = (failures, diagnostics, transport, onViolation = () => {}) => {
    const attempts = [];
    const request = Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async (url, options = {}) => {
      const method = verb === "fetch" ? String(options.method || "GET").toUpperCase() : verb.toUpperCase();
      attempts.push({ method, url });
      const key = `${method} ${new URL(url).pathname}`;
      if ((failures.get(key) || 0) > 0) {
        failures.set(key, failures.get(key) - 1);
        throw new Error(`socket failed for student-secret at ${url}`);
      }
      return { status: () => 200, ok: () => true };
    }]));
    installReleaseRequestGuard(request, development, undefined, undefined, onViolation, transport,
      (diagnostic) => diagnostics.push(diagnostic));
    return { request, attempts };
  };

  const diagnostics = [];
  const transport = { readFetchRetries: 0 };
  let violations = 0;
  const failures = new Map([
    ["GET /api/v1/core/tenant/by-host/", 1],
    ["HEAD /api/v1/core/tenant/by-host/", 2],
    ["POST /api/v1/token/", 1],
    ["PUT /api/v1/core/tenant/by-host/", 1],
    ["PATCH /api/v1/core/tenant/by-host/", 1],
    ["DELETE /api/v1/core/tenant/by-host/", 1],
    ["GET /api/v1/parents/by-login/student-secret/", 2],
  ]);
  const { request, attempts } = install(failures, diagnostics, transport, () => { violations += 1; });
  const headers = { "x-tenant-code": development.tenantCode };

  await request.get(`${development.apiOrigin}/api/v1/core/tenant/by-host/`, { headers });
  await assert.rejects(() => request.head(`${development.apiOrigin}/api/v1/core/tenant/by-host/`, { headers }),
    /Release APIRequestContext transport rejected/);
  await assert.rejects(() => request.post(`${development.apiOrigin}/api/v1/token/`, { headers }),
    /Release APIRequestContext transport rejected/);
  for (const method of ["put", "patch", "delete"]) {
    await assert.rejects(() => request[method](`${development.apiOrigin}/api/v1/core/tenant/by-host/`, { headers }),
      /Release APIRequestContext transport rejected/);
  }
  await assert.rejects(() => request.get(`${development.apiOrigin}/api/v1/parents/by-login/student-secret/`, { headers }),
    /Release APIRequestContext transport rejected/);

  assert.equal(attempts.filter(({ method }) => method === "GET").length, 4);
  assert.equal(attempts.filter(({ method }) => method === "HEAD").length, 2);
  assert.equal(attempts.filter(({ method }) => method === "POST").length, 1, "mutation transport is never replayed");
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    assert.equal(attempts.filter((attempt) => attempt.method === method).length, 1, `${method} transport is never replayed`);
  }
  assert.equal(transport.readFetchRetries, 3, "each GET/HEAD call gets at most one retry");
  assert.equal(violations, 6, "only unrecovered transports fail the boundary");
  assert.deepEqual(diagnostics, [
    { method: "GET", pathTemplate: "/api/v1/core/tenant/by-host/", requestKind: "read", stage: "initial", transportCode: "transport" },
    { method: "HEAD", pathTemplate: "/api/v1/core/tenant/by-host/", requestKind: "read", stage: "initial", transportCode: "transport" },
    { method: "HEAD", pathTemplate: "/api/v1/core/tenant/by-host/", requestKind: "read", stage: "retry", transportCode: "transport" },
    { method: "POST", pathTemplate: "/api/v1/token/", requestKind: "mutation", stage: "initial", transportCode: "transport" },
    { method: "PUT", pathTemplate: "/api/v1/core/tenant/by-host/", requestKind: "mutation", stage: "initial", transportCode: "transport" },
    { method: "PATCH", pathTemplate: "/api/v1/core/tenant/by-host/", requestKind: "mutation", stage: "initial", transportCode: "transport" },
    { method: "DELETE", pathTemplate: "/api/v1/core/tenant/by-host/", requestKind: "mutation", stage: "initial", transportCode: "transport" },
  ]);
  assert.doesNotMatch(JSON.stringify(diagnostics), /student-secret|parents\/by-login/);
});

test("only the reviewed dashboard observation schema is permitted", () => {
  const url = "https://api.hakwonplus.com/api/v1/students/me/activity/";
  const valid = { screen_id: "student.dashboard.home", device_class: "desktop" };
  assert.equal(assertReleaseRequestSafe(production, url, "POST", production.tenantCode, valid), "observation");
  for (const data of [undefined, {}, [], { ...valid, score: 100 }, { ...valid, screen_id: "student.video.player" }, { ...valid, device_class: "unknown" }]) {
    assert.throws(() => assertReleaseRequestSafe(production, url, "POST", production.tenantCode, data), /observation payload/);
  }
  assert.throws(() => assertReleaseRequestSafe(production, url, "PATCH", production.tenantCode, valid), /mutation refused/);
});

test("same-artifact proxy preserves the real response and never sends credentials to an external origin", async () => {
  let handler;
  const calls = [];
  const context = {
    on() {}, route: async (_pattern, callback) => { handler = callback; },
    request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
  };
  const guard = await installReleaseContextGuard(context, development);
  const upstreamResponse = { status: () => 201, headers: () => ({ "access-control-allow-origin": development.webOrigin, "access-control-allow-credentials": "true" }) };
  const route = (url, tenant = development.tenantCode, response = upstreamResponse) => ({
    request: () => ({ url: () => url, method: () => "POST", postDataJSON: () => ({ title: "unit" }),
      headerValue: async () => tenant, allHeaders: async () => ({ origin: development.webOrigin, authorization: "Bearer unit-only", "x-tenant-code": tenant, host: "api.hakwonplus.com" }) }),
    fetch: async (options) => { calls.push({ operation: "upstream", options }); return response; },
    fulfill: async (options) => { calls.push({ operation: "fulfill", options }); },
    abort: async () => { calls.push({ operation: "abort" }); },
    continue: async () => { calls.push({ operation: "continue" }); },
  });
  await handler(route("https://api.hakwonplus.com/api/v1/community/posts/"));
  assert.equal(calls[0].options.url, "http://127.0.0.1:18000/api/v1/community/posts/");
  assert.equal(calls[0].options.headers.host, undefined);
  assert.equal(calls[0].options.maxRedirects, 0);
  assert.equal(calls[1].options.response, upstreamResponse);
  guard.assertClean();
  for (const url of ["https://foreign.example/api/v1/community/posts/", "https://api.hakwonplus.com.attacker.test/api/v1/community/posts/"]) {
    const before = calls.length;
    await handler(route(url));
    assert.deepEqual(calls.slice(before), [{ operation: "abort" }]);
  }
  const before = calls.length;
  await handler(route("https://api.hakwonplus.com/api/v1/community/posts/", "foreign-tenant"));
  assert.deepEqual(calls.slice(before), [{ operation: "abort" }]);
  await handler(route("https://api.hakwonplus.com/api/v1/community/posts/", development.tenantCode, { status: () => 302 }));
  assert.equal(calls.at(-1).operation, "abort");
  for (const cors of [{}, { "access-control-allow-origin": "https://foreign.example", "access-control-allow-credentials": "true" }]) {
    const before = calls.length;
    await handler(route("https://api.hakwonplus.com/api/v1/community/posts/", development.tenantCode, { status: () => 201, headers: () => cors }));
    assert.deepEqual(calls.slice(before).map((call) => call.operation), ["upstream", "abort"]);
  }
  assert.throws(() => guard.assertClean(), /Release API boundary failed/);
});

test("same BrowserContext reuses one release guard and one diagnostic stream", async () => {
  const handlers = [];
  const context = {
    on() {},
    route: async (_pattern, callback) => { handlers.push(callback); },
    request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
  };

  const first = await installReleaseContextGuard(context, development);
  const second = await installReleaseContextGuard(context, development);

  assert.strictEqual(second, first, "fixture and scenario helper must share the same context guard");
  assert.equal(handlers.length, 1, "a BrowserContext must have exactly one release route boundary");

  let mutationAttempts = 0;
  await handlers[0]({
    request: () => ({
      url: () => "https://api.hakwonplus.com/api/v1/students/me/activity/",
      method: () => "POST",
      postDataJSON: () => ({ screen_id: "student.dashboard.home", device_class: "desktop" }),
      headerValue: async () => development.tenantCode,
      allHeaders: async () => ({ origin: development.webOrigin, "x-tenant-code": development.tenantCode }),
    }),
    fetch: async () => {
      mutationAttempts += 1;
      throw new Error("unit mutation fetch interruption");
    },
    fulfill: async () => {},
    abort: async () => {},
    continue: async () => {},
  });

  assert.equal(mutationAttempts, 1, "mutation transport is never replayed");
  assert.deepEqual(first.requestTransportDiagnostics, [{
    method: "POST", pathTemplate: "/api/v1/students/me/activity/", requestKind: "mutation",
    stage: "initial", transportCode: "transport",
  }]);
  assert.strictEqual(second.requestTransportDiagnostics, first.requestTransportDiagnostics);
  assert.throws(() => first.assertClean(), /Release request rejected \[fetch-transport\]/);
  assert.throws(() => second.assertClean(), /Release request rejected \[fetch-transport\]/);
});

test("same BrowserContext refuses a different release boundary without reinstalling", async () => {
  const handlers = [];
  const context = {
    on() {},
    route: async (_pattern, callback) => { handlers.push(callback); },
    request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
  };
  const originalBoundary = { ...development };
  const first = await installReleaseContextGuard(context, originalBoundary);
  for (const changed of [
    { mode: "readonly" },
    { apiOrigin: "http://127.0.0.1:18001" },
    { webOrigin: "http://localhost:4174" },
    { tenantCode: "qa-ymath-realuse-foreign-unit" },
  ]) {
    await assert.rejects(installReleaseContextGuard(context, { ...development, ...changed }), /Release context boundary mismatch/);
  }
  originalBoundary.tenantCode = "qa-ymath-realuse-mutated-unit";
  await assert.rejects(installReleaseContextGuard(context, originalBoundary), /Release context boundary mismatch/);
  assert.strictEqual(await installReleaseContextGuard(context, { ...development }), first);
  assert.equal(handlers.length, 1);
});

test("concurrent BrowserContext guard installation waits for one completed route registration", async () => {
  let completeRegistration;
  let registrations = 0;
  const registered = new Promise((resolve) => { completeRegistration = resolve; });
  const context = {
    on() {},
    route: async () => { registrations += 1; await registered; },
    request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
  };
  let secondReady = false;
  const first = installReleaseContextGuard(context, development);
  const second = installReleaseContextGuard(context, { ...development }).then((guard) => { secondReady = true; return guard; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(secondReady, false, "no caller may use a context before its route boundary is installed");
  await assert.rejects(installReleaseContextGuard(context, { ...development, mode: "readonly" }), /Release context boundary mismatch/);
  completeRegistration();
  assert.strictEqual(await first, await second);
  assert.equal(registrations, 1);
});

test("failed BrowserContext route installation rejects every caller without leaving a reusable guard", async () => {
  let failRegistration;
  let registrations = 0;
  const registered = new Promise((_resolve, reject) => { failRegistration = reject; });
  const context = {
    on() {},
    route: async () => { registrations += 1; await registered; },
    request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
  };
  const first = installReleaseContextGuard(context, development);
  const second = installReleaseContextGuard(context, { ...development });
  const results = Promise.allSettled([first, second]);
  const failure = new Error("unit route registration failed");
  failRegistration(failure);
  assert.deepEqual(await results, [
    { status: "rejected", reason: failure },
    { status: "rejected", reason: failure },
  ]);
  await assert.rejects(installReleaseContextGuard(context, development), (error) => error === failure);
  assert.equal(registrations, 1, "a partially wrapped failed context must be discarded instead of reinstalled");
});

test("same-artifact proxy retries only safe read fetch transport and identifies the failing stage", async () => {
  const install = async () => {
    let handler;
    const context = {
      on() {}, route: async (_pattern, callback) => { handler = callback; },
      request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
    };
    return { guard: await installReleaseContextGuard(context, development), handler };
  };
  const response = { status: () => 200, ok: () => true, headers: () => ({
    "access-control-allow-origin": development.webOrigin,
    "access-control-allow-credentials": "true",
  }) };
  const makeRoute = (method, fetch, fulfill = async () => {}) => ({
    request: () => ({
      url: () => method === "POST"
        ? "https://api.hakwonplus.com/api/v1/students/me/activity/"
        : "https://api.hakwonplus.com/api/v1/core/tenant/by-host/",
      method: () => method,
      postDataJSON: () => undefined,
      headerValue: async () => development.tenantCode,
      allHeaders: async () => ({ origin: development.webOrigin, "x-tenant-code": development.tenantCode }),
    }),
    fetch,
    fulfill,
    abort: async () => {},
    continue: async () => {},
  });

  const safeRead = await install();
  let readAttempts = 0;
  let fulfillments = 0;
  await safeRead.handler(makeRoute("GET", async () => {
    readAttempts += 1;
    if (readAttempts < 2) throw new Error("unit loopback fetch interruption");
    return response;
  }, async () => { fulfillments += 1; }));
  assert.equal(readAttempts, 2);
  assert.equal(fulfillments, 1);
  assert.deepEqual(safeRead.guard.transport, {
    readFetchRetries: 1,
    mutationReplays: 0,
    suppressedAnalyticsBatches: 0,
    suppressedAnalyticsEvents: 0,
    suppressedCloudflareBeacons: 0,
    closingAborts: 0,
  });
  assert.deepEqual(safeRead.guard.requestTransportDiagnostics, [{
    method: "GET", pathTemplate: "/api/v1/core/tenant/by-host/", requestKind: "read",
    stage: "initial", transportCode: "transport",
  }]);
  assert.doesNotThrow(() => safeRead.guard.assertClean());

  const mutation = await install();
  let mutationAttempts = 0;
  await mutation.handler(makeRoute("POST", async () => {
    mutationAttempts += 1;
    throw new Error("unit mutation fetch interruption");
  }));
  assert.equal(mutationAttempts, 1, "a non-socket-hang-up mutation failure is never replayed");
  assert.deepEqual(mutation.guard.requestTransportDiagnostics, [{
    method: "POST", pathTemplate: "/api/v1/students/me/activity/", requestKind: "mutation",
    stage: "initial", transportCode: "transport",
  }]);
  assert.throws(() => mutation.guard.assertClean(), /Release request rejected \[fetch-transport\]/);

  const makeRouteAt = (url, method, fetch) => ({
    request: () => ({
      url: () => url,
      method: () => method,
      postDataJSON: () => undefined,
      headerValue: async () => development.tenantCode,
      allHeaders: async () => ({ origin: development.webOrigin, "x-tenant-code": development.tenantCode }),
    }),
    fetch,
    fulfill: async () => {},
    abort: async () => {},
    continue: async () => {},
  });

  // A replay-safe mutation template (append-only endpoint, canary asserts a
  // lower bound only) recovers from exactly one stale-socket hang-up, same as
  // a safe read.
  const replaySafeMutation = await install();
  let replaySafeAttempts = 0;
  await replaySafeMutation.handler(makeRouteAt(
    "https://api.hakwonplus.com/api/v1/media/playback/events/", "POST", async () => {
      replaySafeAttempts += 1;
      if (replaySafeAttempts < 2) throw new Error("socket hang up");
      return response;
    }));
  assert.equal(replaySafeAttempts, 2);
  assert.equal(replaySafeMutation.guard.transport.mutationReplays, 1);
  assert.doesNotThrow(() => replaySafeMutation.guard.assertClean());

  // The same signature on a non-whitelisted mutation (creates a playback
  // session; the canary asserts an exact session count) is never replayed.
  const unsafeMutation = await install();
  let unsafeAttempts = 0;
  await unsafeMutation.handler(makeRouteAt(
    "https://api.hakwonplus.com/api/v1/student/video/videos/123/playback/", "POST", async () => {
      unsafeAttempts += 1;
      throw new Error("socket hang up");
    }));
  assert.equal(unsafeAttempts, 1, "a non-whitelisted mutation endpoint is never replayed");
  assert.equal(unsafeMutation.guard.transport.mutationReplays, 0);
  assert.throws(() => unsafeMutation.guard.assertClean(), /Release request rejected \[fetch-transport\]/);

  // A degrading tunnel still fails the gate: the replay budget is capped
  // across the whole guard session, not granted per request.
  const exhausted = await install();
  for (let i = 0; i < 3; i += 1) {
    await exhausted.handler(makeRouteAt(
      "https://api.hakwonplus.com/api/v1/media/playback/events/", "POST", async () => {
        throw new Error("socket hang up");
      }));
  }
  assert.equal(exhausted.guard.transport.mutationReplays, 3);
  let fourthAttempts = 0;
  await exhausted.handler(makeRouteAt(
    "https://api.hakwonplus.com/api/v1/media/playback/events/", "POST", async () => {
      fourthAttempts += 1;
      throw new Error("socket hang up");
    }));
  assert.equal(fourthAttempts, 1, "the fourth failure in one session exceeds the replay cap and is terminal");
  assert.equal(exhausted.guard.transport.mutationReplays, 3, "the cap is not exceeded");

  const delivery = await install();
  let deliveryFetches = 0;
  await delivery.handler(makeRoute("GET", async () => {
    deliveryFetches += 1;
    return response;
  }, async () => { throw new Error("unit browser delivery interruption"); }));
  assert.equal(deliveryFetches, 1, "browser delivery failure must not replay upstream transport");
  assert.throws(() => delivery.guard.assertClean(), /Release request rejected \[fulfill-transport\]/);
});

test("route-fetch never reuses a pooled connection, and its stale-socket retry delay stays short", async () => {
  let handler;
  const context = {
    on() {}, route: async (_pattern, callback) => { handler = callback; },
    request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
  };
  const guard = await installReleaseContextGuard(context, development);
  const response = { status: () => 200, ok: () => true, headers: () => ({
    "access-control-allow-origin": development.webOrigin,
    "access-control-allow-credentials": "true",
  }) };
  const fetchCalls = [];
  const route = {
    request: () => ({
      url: () => "https://api.hakwonplus.com/api/v1/core/tenant/by-host/",
      method: () => "GET",
      postDataJSON: () => undefined,
      headerValue: async () => development.tenantCode,
      allHeaders: async () => ({ origin: development.webOrigin, "x-tenant-code": development.tenantCode }),
    }),
    fetch: async (options) => {
      fetchCalls.push(options);
      if (fetchCalls.length < 2) throw new Error("unit loopback fetch interruption");
      return response;
    },
    fulfill: async () => {},
    abort: async () => {},
    continue: async () => {},
  };
  const startedAt = Date.now();
  await handler(route);
  const elapsedMs = Date.now() - startedAt;
  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].headers.connection, "close",
    "every attempt must refuse a pooled connection -- that reuse is the stale-socket root cause");
  assert.equal(fetchCalls[1].headers.connection, "close");
  assert.ok(elapsedMs < 300, `stale-socket retry delay must stay short (took ${elapsedMs}ms)`);
});

test("context teardown counts an aborted in-flight API request as closingAborts, never a web-origin one", async () => {
  const install = async () => {
    let handler;
    const context = {
      on() {}, route: async (_pattern, callback) => { handler = callback; },
      request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
    };
    return { guard: await installReleaseContextGuard(context, development), handler };
  };
  const makeInFlightRoute = (url) => {
    let aborted = null;
    return {
      route: {
        request: () => ({ url: () => url }),
        abort: async (reason) => { aborted = reason; },
        fetch: async () => { throw new Error("must not be called while closing"); },
        fulfill: async () => { throw new Error("must not be called while closing"); },
        continue: async () => { throw new Error("must not be called while closing"); },
      },
      wasAborted: () => aborted,
    };
  };

  const teardown = await install();
  await teardown.guard.beginClose();
  const apiRequest = makeInFlightRoute(`${development.apiOrigin}/api/v1/core/tenant/by-host/`);
  await teardown.handler(apiRequest.route);
  assert.equal(apiRequest.wasAborted(), "blockedbyclient");
  assert.equal(teardown.guard.transport.closingAborts, 1);

  const webRequest = makeInFlightRoute(`${development.webOrigin}/favicon.ico`);
  await teardown.handler(webRequest.route);
  assert.equal(webRequest.wasAborted(), "blockedbyclient", "a non-API request is still aborted on teardown");
  assert.equal(teardown.guard.transport.closingAborts, 1, "but only an API-origin abort extends the strict-browser suppression cap");
});

test("production browser guard locally neutralizes only exact non-business telemetry", async () => {
  const install = async () => {
    let handler;
    const context = {
      on() {}, route: async (_pattern, callback) => { handler = callback; },
      request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
    };
    return { guard: await installReleaseContextGuard(context, production), handler };
  };
  const analyticsPayload = {
    schema_version: 1,
    events: [{
      event_id: "11111111-1111-4111-8111-111111111111",
      event_type: "screen_view",
      occurred_at: new Date().toISOString(),
      session_id: "22222222-2222-4222-8222-222222222222",
      view_id: "33333333-3333-4333-8333-333333333333",
      feature_id: "students.directory",
      screen_id: "student.dashboard.home",
      surface: "student",
      route_template: "/student/dashboard",
      device_class: "mobile",
      client_release: "a15dd0f95192cc907e6a418d6d1a0faf652cfe99",
      catalog_version: "2026-07-29",
      synthetic: false,
    }],
  };
  const route = ({
    url = "https://api.hakwonplus.com/api/v1/core/product-analytics/events/batch/",
    method = "POST",
    tenant = production.tenantCode,
    data = analyticsPayload,
    headers = { origin: production.webOrigin, "x-tenant-code": tenant },
    bodyBytes,
  } = {}) => {
    const operations = [];
    return { operations, value: {
      request: () => ({
        url: () => url,
        method: () => method,
        postDataJSON: () => data,
        postDataBuffer: () => bodyBytes === undefined ? undefined : new Uint8Array(bodyBytes),
        headerValue: async () => tenant,
        allHeaders: async () => headers,
      }),
      fetch: async () => { operations.push("fetch"); throw new Error("must not reach network"); },
      fulfill: async (options) => { operations.push({ fulfill: options }); },
      abort: async () => { operations.push("abort"); },
      continue: async () => { operations.push("continue"); },
    } };
  };

  const analytics = await install();
  const exact = route();
  await analytics.handler(exact.value);
  assert.equal(exact.operations.length, 1);
  assert.equal(exact.operations[0].fulfill.status, 202);
  assert.deepEqual(analytics.guard.transport, {
    readFetchRetries: 0,
    mutationReplays: 0,
    suppressedAnalyticsBatches: 1,
    suppressedAnalyticsEvents: 1,
    suppressedCloudflareBeacons: 0,
    closingAborts: 0,
  });
  assert.doesNotThrow(() => analytics.guard.assertClean());

  const event = analyticsPayload.events[0];
  const schemaFailures = [
    { data: { ...analyticsPayload, extra: true } },
    { data: { ...analyticsPayload, events: [] } },
    { data: { ...analyticsPayload, events: Array.from({ length: 21 }, () => event) } },
    { data: { ...analyticsPayload, events: [{ ...event, student_name: "must-not-pass" }] } },
    { data: { ...analyticsPayload, events: [{ ...event, event_type: "unknown" }] } },
    { data: { ...analyticsPayload, events: [{ ...event, event_id: "not-a-uuid" }] } },
    { data: { ...analyticsPayload, events: [{ ...event, occurred_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }] } },
    { data: { ...analyticsPayload, events: [{ ...event, route_template: "/student/123" }] } },
    { data: { ...analyticsPayload, events: [{ ...event, event_type: "task_start" }] } },
    { bodyBytes: 64 * 1024 + 1 },
  ];
  for (const change of schemaFailures) {
    const invalid = await install();
    const unsafe = route(change);
    await invalid.handler(unsafe.value);
    assert.deepEqual(unsafe.operations, ["abort"]);
    assert.throws(() => invalid.guard.assertClean(), /Release request rejected \[observation-schema\]/);
  }
  for (const change of [
    { tenant: "foreign", headers: { origin: production.webOrigin, "x-tenant-code": "foreign" }, expected: "tenant" },
    { url: "https://api.hakwonplus.com/api/v1/core/product-analytics/events/other/", expected: "mutation" },
    { method: "PUT", expected: "mutation" },
    { headers: { origin: "https://foreign.example", "x-tenant-code": production.tenantCode }, expected: "cors" },
  ]) {
    const invalid = await install();
    const unsafe = route(change);
    await invalid.handler(unsafe.value);
    assert.deepEqual(unsafe.operations, ["abort"]);
    assert.throws(() => invalid.guard.assertClean(), new RegExp(`Release request rejected \\[${change.expected}\\]`));
  }

  const beacon = await install();
  const cloudflare = route({
    url: "https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495",
    method: "GET",
    tenant: null,
    data: null,
  });
  await beacon.handler(cloudflare.value);
  assert.equal(cloudflare.operations.length, 1);
  assert.equal(cloudflare.operations[0].fulfill.status, 200);
  assert.equal(cloudflare.operations[0].fulfill.contentType, "application/javascript; charset=utf-8");
  assert.deepEqual(beacon.guard.transport, {
    readFetchRetries: 0,
    mutationReplays: 0,
    suppressedAnalyticsBatches: 0,
    suppressedAnalyticsEvents: 0,
    closingAborts: 0,
    suppressedCloudflareBeacons: 1,
  });
  assert.doesNotThrow(() => beacon.guard.assertClean());

  for (const change of [
    { url: "https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495?extra=1" },
    { url: "https://static.cloudflareinsights.com/other.js" },
    { url: "https://static.cloudflareinsights.com/beacon.min.js/vnot-a-valid-version" },
    { method: "POST" },
  ]) {
    const rejected = await install();
    const candidate = route({
      url: "https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495",
      method: "GET",
      tenant: null,
      data: null,
      headers: { origin: production.webOrigin },
      ...change,
    });
    await rejected.handler(candidate.value);
    assert.deepEqual(candidate.operations, ["abort"]);
    assert.throws(() => rejected.guard.assertClean(), /Release request rejected \[origin\]/);
  }
  for (const headers of [{ authorization: "Bearer must-not-pass" }, { cookie: "session=must-not-pass" }]) {
    const rejected = await install();
    const candidate = route({
      url: "https://static.cloudflareinsights.com/beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495",
      method: "GET",
      tenant: null,
      data: null,
      headers,
    });
    await rejected.handler(candidate.value);
    assert.deepEqual(candidate.operations, ["abort"]);
    assert.throws(() => rejected.guard.assertClean(), /Release request rejected \[credentials\]/);
  }

  const foreign = await install();
  const other = route({ url: "https://foreign.example/script.js", method: "GET", tenant: undefined, data: undefined });
  await foreign.handler(other.value);
  assert.deepEqual(other.operations, ["abort"]);
  assert.throws(() => foreign.guard.assertClean(), /Release request rejected \[origin\]/);
});

test("intentional context close drains active requests and blocks new teardown traffic", async () => {
  const makeGuard = async (message) => {
    let handler;
    const context = {
      on() {}, route: async (_pattern, callback) => { handler = callback; },
      request: Object.fromEntries(["fetch", "get", "head", "post", "put", "patch", "delete"].map((verb) => [verb, async () => {}])),
    };
    const guard = await installReleaseContextGuard(context, development);
    const route = {
      request: () => ({
        url: () => "https://api.hakwonplus.com/api/v1/core/program/",
        method: () => "GET",
        postDataJSON: () => undefined,
        headerValue: async () => development.tenantCode,
        allHeaders: async () => ({ origin: development.webOrigin, "x-tenant-code": development.tenantCode }),
      }),
      fetch: async () => { throw new Error(message); },
      abort: async () => {},
      continue: async () => {},
    };
    return { guard, handler, route };
  };

  const beforeClose = await makeGuard("route.fetch: Request context disposed.");
  await beforeClose.handler(beforeClose.route);
  assert.throws(() => beforeClose.guard.assertClean(), /Release request rejected \[context-disposed\]/);

  let resolveFetch;
  let markFetchStarted;
  const fetchStarted = new Promise((resolve) => { markFetchStarted = resolve; });
  const active = await makeGuard("unused");
  let activeFetches = 0;
  active.route.fetch = async () => {
    activeFetches += 1;
    markFetchStarted();
    return new Promise((resolve) => { resolveFetch = resolve; });
  };
  active.route.fulfill = async () => {};
  const handling = active.handler(active.route);
  await fetchStarted;
  let drained = false;
  const draining = Promise.resolve(active.guard.beginClose()).then(() => { drained = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(drained, false, "close must wait for the already-started inspected request");
  resolveFetch({ status: () => 200, headers: () => ({
    "access-control-allow-origin": development.webOrigin,
    "access-control-allow-credentials": "true",
  }) });
  await Promise.all([handling, draining]);
  assert.doesNotThrow(() => active.guard.assertClean());

  await active.handler(active.route);
  assert.equal(activeFetches, 1, "new traffic after close begins must be aborted before transport");
  assert.doesNotThrow(() => active.guard.assertClean());

  let rejectFetch;
  let markFailureStarted;
  let activeFailureFetches = 0;
  const failureStarted = new Promise((resolve) => { markFailureStarted = resolve; });
  const activeFailure = await makeGuard("unused");
  activeFailure.route.fetch = async () => {
    activeFailureFetches += 1;
    if (activeFailureFetches > 1) throw new Error("unit transport still unavailable");
    markFailureStarted();
    return new Promise((_resolve, reject) => { rejectFetch = reject; });
  };
  const failingHandling = activeFailure.handler(activeFailure.route);
  await failureStarted;
  const failingDrain = activeFailure.guard.beginClose();
  rejectFetch(new Error("unit transport unavailable"));
  await Promise.all([failingHandling, failingDrain]);
  assert.equal(activeFailureFetches, 2);
  assert.throws(() => activeFailure.guard.assertClean(), /Release request rejected \[fetch-transport\]/);

  const realFailure = await makeGuard("unused");
  realFailure.route.fetch = async () => ({ status: () => 200, headers: () => ({}) });
  await realFailure.handler(realFailure.route);
  assert.throws(() => realFailure.guard.assertClean(), /Release request rejected \[cors\]/);
});

test("real Chromium receives the unmodified loopback HTTP response through the transport boundary", async () => {
  const observed = [];
  let webOrigin;
  const api = http.createServer((request, response) => {
    observed.push({ path: request.url, tenant: request.headers["x-tenant-code"], authorization: request.headers.authorization });
    response.writeHead(201, { "content-type": "application/json", "x-real-upstream": "loopback",
      "access-control-allow-origin": webOrigin, "access-control-allow-credentials": "true" });
    response.end(JSON.stringify({ real: true }));
  });
  const web = http.createServer((_request, response) => { response.end("<!doctype html><title>Local transport contract</title>"); });
  const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await Promise.all([listen(api), listen(web)]);
  const boundary = { ...development, apiOrigin: `http://127.0.0.1:${api.address().port}`, webOrigin: `http://localhost:${web.address().port}` };
  webOrigin = boundary.webOrigin;
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const guard = await installReleaseContextGuard(context, boundary);
    const page = await context.newPage();
    await page.goto(boundary.webOrigin);
    const responseReceived = page.waitForResponse("https://api.hakwonplus.com/api/v1/community/posts/");
    const result = await page.evaluate(async (tenant) => {
      const response = await fetch("https://api.hakwonplus.com/api/v1/community/posts/", {
        method: "POST", headers: { "x-tenant-code": tenant, authorization: "Bearer local-contract-only", "content-type": "application/json" },
        body: JSON.stringify({ title: "transport contract only" }),
      });
      return { status: response.status, header: response.headers.get("x-real-upstream"), body: await response.json() };
    }, boundary.tenantCode);
    // Browser JS keeps normal CORS header visibility; the network response is
    // byte-preserved and no Access-Control-* header is fabricated by the proxy.
    assert.deepEqual(result, { status: 201, header: null, body: { real: true } });
    assert.equal((await responseReceived).headers()["x-real-upstream"], "loopback");
    assert.equal((await responseReceived).headers()["access-control-allow-origin"], webOrigin);
    assert.deepEqual(observed, [{ path: "/api/v1/community/posts/", tenant: boundary.tenantCode, authorization: "Bearer local-contract-only" }]);
    guard.assertClean();
  } finally {
    await browser?.close();
    await Promise.all([api, web].map((server) => new Promise((resolve) => server.close(resolve))));
  }
});

test("real 307/308 authentication redirects never forward the credential body to another origin", async () => {
  let foreignRequests = 0;
  let authRequests = 0;
  const foreign = http.createServer((_request, response) => { foreignRequests += 1; response.end("unexpected"); });
  const web = http.createServer((_request, response) => response.end("<!doctype html><title>Redirect boundary</title>"));
  let foreignUrl;
  const api = http.createServer((request, response) => {
    authRequests += 1;
    response.writeHead(Number(new URL(request.url, "http://unit").searchParams.get("status")), { location: foreignUrl });
    response.end();
  });
  await Promise.all([foreign, web, api].map((server) => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))));
  foreignUrl = `http://127.0.0.1:${foreign.address().port}/received`;
  const boundary = { ...production, apiOrigin: `http://127.0.0.1:${api.address().port}`, webOrigin: `http://localhost:${web.address().port}` };
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: "block" });
    const guard = await installReleaseContextGuard(context, boundary);
    const page = await context.newPage();
    await page.goto(boundary.webOrigin);
    for (const status of [307, 308]) {
      const rejected = await page.evaluate(async ({ api, tenant, status }) => {
        try {
          await fetch(`${api}/api/v1/token/?status=${status}`, { method: "POST",
            headers: { "content-type": "application/json", "x-tenant-code": tenant },
            body: JSON.stringify({ username: "local-contract-only", password: "local-contract-only" }) });
          return false;
        } catch { return true; }
      }, { api: boundary.apiOrigin, tenant: boundary.tenantCode, status });
      assert.equal(rejected, true);
    }
    assert.equal(authRequests, 2);
    assert.equal(foreignRequests, 0);
    assert.deepEqual(guard.authentication, { attempted: 2, accepted: 0 });
    assert.throws(() => guard.assertClean(), /Release API boundary failed/);
  } finally {
    await browser?.close();
    await Promise.all([foreign, web, api].map((server) => new Promise((resolve) => server.close(resolve))));
  }
});
