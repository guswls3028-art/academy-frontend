import assert from "node:assert/strict";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import test from "node:test";
import { assertDiagnosticInvocation, diagnosticHtml, prepareDiagnosticSources, prepareNativeDiagnosticSource,
  isApplicationApiRequest, finishDiagnosticContext, finishDiagnosticResources, runBoundedOperation, assertContextCleanup,
  nativeDiagnosticBridge, closedNativeEvidence,
  DIAGNOSTIC_LABEL, WEB_ORIGIN } from "../public-video-provider-diagnostic.mjs";

const sha = "a".repeat(40);
const env = { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "guswls3028-art/academy-frontend",
  GITHUB_EVENT_NAME: "pull_request", PROVIDER_DIAGNOSTIC_SOURCE_SHA: sha };
const event = { action: "labeled", label: { name: DIAGNOSTIC_LABEL },
  pull_request: { head: { sha, repo: { full_name: env.GITHUB_REPOSITORY } } } };

function contextWithClose(operation = async () => {}) {
  const context = new EventEmitter();
  let closed = false;
  context.close = async () => { await operation(); closed = true; context.emit("close"); };
  context.browser = () => ({ contexts: () => closed ? [] : [context] });
  return context;
}

test("provider contact requires exact owned source and explicit diagnostic event", () => {
  assert.doesNotThrow(() => assertDiagnosticInvocation(env, event, sha));
  assert.doesNotThrow(() => assertDiagnosticInvocation({ ...env, GITHUB_EVENT_NAME: "workflow_dispatch" }, {}, sha));
  for (const override of [{ GITHUB_ACTIONS: "false" }, { GITHUB_REPOSITORY: "foreign/repo" },
    { GITHUB_EVENT_NAME: "push" }, { PROVIDER_DIAGNOSTIC_SOURCE_SHA: "b".repeat(40) }]) {
    assert.throws(() => assertDiagnosticInvocation({ ...env, ...override }, event, sha));
  }
  for (const value of [{ ...event, action: "synchronize" }, { ...event, label: { name: "unrelated" } },
    { ...event, pull_request: { head: { sha, repo: { full_name: "foreign/repo" } } } }]) {
    assert.throws(() => assertDiagnosticInvocation(env, value, sha));
  }
});

test("diagnostic uses the existing fixed iframe identity and permissions", () => {
  const html = diagnosticHtml();
  const component = fs.readFileSync(new URL("../../src/landing/components/VideoPlayer.tsx", import.meta.url), "utf8");
  const allow = /allow="([^"]+)"/.exec(component)[1];
  assert.ok(html.includes(`allow="${allow}"`));
  assert.ok(html.includes('referrerpolicy="strict-origin-when-cross-origin"'));
  const embed = new URL(/src="([^"]+)"/.exec(html)[1]);
  assert.equal(embed.origin, "https://www.youtube.com");
  assert.equal(embed.pathname, "/embed/xgjL2HyrdFM");
  assert.deepEqual(Object.fromEntries(embed.searchParams), { autoplay: "0", playsinline: "1", origin: WEB_ORIGIN });
});

test("diagnostic fixture changes do not modify checked-out release guard or playback predicate", () => {
  const boundary = fs.readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
  const spec = fs.readFileSync(new URL("../../e2e/admin/public-video-realuse.spec.ts", import.meta.url), "utf8");
  const prepared = prepareDiagnosticSources(boundary, spec);
  const native = prepareNativeDiagnosticSource(prepared.source);
  assert.ok(boundary.includes("const publicVideoIds = new Set<string>();"));
  for (const text of ["const headers = await request.allHeaders();", "headers.authorization || headers[\"x-tenant-code\"]",
    "installNativeKeepaliveGuard(context, boundary", "async beginClose()", "publicVideoFrames.has(frame)"]) {
    assert.ok(native.includes(text), text);
  }
  assert.ok(native.includes("nativeDiagnosticController.assertReady();"));
  assert.ok(prepared.playbackSource.includes("video.currentTime > initialTime + 1"));
  assert.ok(prepared.playbackSource.includes('!moviePlayer.classList.contains("ad-showing")'));
  assert.throws(() => prepareDiagnosticSources(boundary.replace("const publicVideoIds =", "const changedIds ="), spec));
  assert.throws(() => prepareNativeDiagnosticSource(prepared.source.replace("// Relay actual provider responses", "// Changed provider responses")));
});

test("diagnostic workflow cannot grant production, cloud or credential access", () => {
  const workflow = fs.readFileSync(new URL("../../.github/workflows/public-video-provider-diagnostic.yml", import.meta.url), "utf8");
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /secrets\.|id-token:|environment:|deploy\.ps1|run-development-release-canary/);
  assert.match(workflow, /types: \[labeled\]/);
  assert.match(workflow, /head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
});

test("application API counters distinguish the provider's own anonymous playback telemetry", () => {
  assert.equal(isApplicationApiRequest("https://www.youtube.com/api/stats/playback"), false);
  assert.equal(isApplicationApiRequest("https://www.youtube.com/youtubei/v1/player"), false);
  assert.equal(isApplicationApiRequest("http://127.0.0.1:18000/healthz"), true);
  assert.equal(isApplicationApiRequest("http://localhost:4173/api/v1/core/me/"), true);
  assert.equal(isApplicationApiRequest("https://api.hakwonplus.com/api/v1/core/me/"), true);
});

test("late context-close violations fail both boundary and native controller evidence", async () => {
  let violation = false;
  const result = { mode: "native", contextClosed: false };
  const guard = { beginClose: async () => {}, assertClean: () => assert.equal(violation, false) };
  const controller = { ...guard, close: async () => {} };
  await finishDiagnosticContext({ guard, controller, result, context: contextWithClose(async () => { violation = true; }) });
  assert.equal(result.contextClosed, true);
  assert.equal(result.boundaryPassed, false);
  assert.equal(result.controllerPassed, false);
});

test("a controller close failure still closes the browser and cannot become clean later", async () => {
  let contextCloses = 0;
  const result = { mode: "native", contextClosed: false };
  const guard = { beginClose: async () => {}, assertClean: () => {} };
  const controller = { ...guard, close: async () => { throw new Error("controller-close"); } };
  await finishDiagnosticContext({ guard, controller, result, context: contextWithClose(async () => { contextCloses++; }) });
  assert.equal(contextCloses, 1);
  assert.equal(result.contextClosed, true);
  assert.equal(result.boundaryPassed, true);
  assert.equal(result.controllerPassed, false);
});

test("drain failures stay failed after successful close and final cleanliness checks", async () => {
  const result = { mode: "relay", contextClosed: false };
  const guard = { beginClose: async () => { throw new Error("drain"); }, assertClean: () => {} };
  await finishDiagnosticContext({ guard, result, context: contextWithClose() });
  assert.equal(result.contextClosed, true);
  assert.equal(result.boundaryPassed, false);
  assert.equal(result.controllerPassed, true);
});

test("clean teardown completes before the diagnostic records success", async () => {
  const order = [];
  const result = { mode: "native", contextClosed: false };
  const guard = { beginClose: async () => order.push("guard-drain"), assertClean: () => order.push("guard-check") };
  const controller = { beginClose: async () => order.push("native-drain"), close: async () => order.push("native-close"),
    assertClean: () => order.push("native-check") };
  await finishDiagnosticContext({ guard, controller, result, context: contextWithClose(async () => order.push("context-close")) });
  assert.deepEqual(order, ["guard-drain", "native-drain", "native-close", "context-close", "guard-check", "native-check"]);
  assert.equal(result.contextClosed, true);
  assert.equal(result.boundaryPassed, true);
  assert.equal(result.controllerPassed, true);
  assert.equal(result.cleanupPassed, true);
});

test("stalled guard and controller drains cannot prevent independent closes", async () => {
  const calls = [];
  const result = { mode: "native", contextClosed: false };
  const guard = { beginClose: () => new Promise(() => {}), assertClean: () => {} };
  const controller = { ...guard, close: async () => { calls.push("native"); } };
  const context = contextWithClose(async () => { calls.push("context"); });
  await finishDiagnosticContext({ guard, controller, context, result, timeoutMs: 20 });
  assert.deepEqual(calls, ["native", "context"]);
  assert.equal(result.contextClosed, true);
  assert.equal(result.cleanupPassed, false);
  assert.equal(result.cleanup.guardDrain, "timeout");
  assert.equal(result.cleanup.nativeDrain, "timeout");
  guard.beginClose = async () => {};
  controller.beginClose = async () => {};
  await finishDiagnosticContext({ guard, controller, context, result, timeoutMs: 20 });
  assert.equal(result.cleanupPassed, false);
  assert.equal(result.cleanup.guardDrain, "timeout");
});

test("a stalled native close still attempts and confirms the browser context close", async () => {
  const result = { mode: "native", contextClosed: false };
  const guard = { beginClose: async () => {}, assertClean: () => {} };
  const controller = { ...guard, close: () => new Promise(() => {}) };
  await finishDiagnosticContext({ guard, controller, context: contextWithClose(), result, timeoutMs: 20 });
  assert.equal(result.contextClosed, true);
  assert.equal(result.controllerPassed, false);
  assert.equal(result.cleanup.nativeClose, "timeout");
});

test("rejected, stalled and unconfirmed context closes remain unsuccessful", async () => {
  for (const fault of ["reject", "stall", "unconfirmed"]) {
    const result = { mode: "relay", contextClosed: false };
    const guard = { beginClose: async () => {}, assertClean: () => {} };
    const context = contextWithClose();
    context.close = fault === "reject" ? async () => { throw new Error("injected"); }
      : fault === "stall" ? () => new Promise(() => {}) : async () => {};
    await finishDiagnosticContext({ guard, context, result, timeoutMs: 20 });
    assert.equal(result.contextClosed, false, fault);
    assert.equal(result.cleanupPassed, false, fault);
  }
});

test("outer browser close rejection or stall cannot skip server cleanup", async () => {
  for (const fault of ["reject", "stall"]) {
    const calls = [];
    const browser = { isConnected: () => true, close: fault === "reject"
      ? async () => { throw new Error("injected"); } : () => new Promise(() => {}) };
    const server = { listening: true, close: callback => { calls.push("server"); server.listening = false; callback(); },
      closeAllConnections: () => calls.push("connections") };
    const result = await finishDiagnosticResources({ browser, server, timeoutMs: 20 });
    assert.deepEqual(calls, ["server", "connections"]);
    assert.equal(result.serverClosed, true);
    assert.equal(result.browserClosed, false);
    assert.equal(result.passed, false);
  }
});

test("a stalled server close cannot skip browser cleanup or claim success", async () => {
  let connected = true;
  const browser = { isConnected: () => connected, close: async () => { connected = false; } };
  const server = { listening: true, close: () => {}, closeAllConnections: () => {} };
  const result = await finishDiagnosticResources({ browser, server, timeoutMs: 20 });
  assert.equal(result.browserClosed, true);
  assert.equal(result.serverClose, "timeout");
  assert.equal(result.serverClosed, false);
  assert.equal(result.passed, false);
});

test("a stalled installation reaches cleanup even when the deadline close rejects or stalls", async () => {
  for (const fault of ["reject", "stall"]) {
    let closeCalls = 0;
    const result = { mode: "relay", contextClosed: false };
    const context = contextWithClose();
    context.close = () => { closeCalls++; return fault === "reject"
      ? Promise.reject(new Error("injected")) : new Promise(() => {}); };
    await assert.rejects(runBoundedOperation(() => new Promise(() => {}), result, () => context.close(),
      { timeoutMs: 20, cleanupMs: 20 }), /diagnostic-operation-deadline/);
    await finishDiagnosticContext({ context, result, timeoutMs: 20 });
    assert.equal(closeCalls, 2);
    assert.equal(result.deadlineExceeded, true);
    assert.equal(result.deadlineClose, fault === "reject" ? "failed" : "timeout");
    assert.throws(() => assertContextCleanup(result));
  }
});

test("late setup settlement cannot start provider activity after the operation deadline", async () => {
  let releaseSetup, contacted = false;
  const setup = new Promise(resolve => { releaseSetup = resolve; });
  const result = {};
  const context = contextWithClose();
  await assert.rejects(runBoundedOperation(async assertActive => {
    await setup;
    assertActive();
    contacted = true;
  }, result, () => context.close(), { timeoutMs: 20, cleanupMs: 20 }), /diagnostic-operation-deadline/);
  releaseSetup();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(contacted, false);
  assert.equal(result.deadlineClose, "ok");
});

test("native continuation requires an explicitly open, clean controller", () => {
  const state = { closed: false, closing: false };
  const bridge = nativeDiagnosticBridge({ assertClean: () => {}, snapshot: () => state });
  assert.doesNotThrow(() => bridge.assertReady());
  state.closing = true;
  assert.throws(() => bridge.assertReady());
  state.closing = false; state.closed = true;
  assert.throws(() => bridge.assertReady());
  delete state.closed;
  assert.throws(() => bridge.assertReady());
});

test("native evidence rejects pending work or unsafe diagnostic fields", () => {
  const state = { closed: true, closing: true, activeRequests: 0, activeHandlers: 0, pendingResponseHeaders: 0, pendingCommands: 0,
    intentionalClosingAborts: 0, failures: [], responseCounts: { "embed:200": 1, "player:200": 3 } };
  const controller = { snapshot: () => state };
  assert.equal(closedNativeEvidence(controller).closed, true);
  state.pendingCommands = 1;
  assert.throws(() => closedNativeEvidence(controller));
  state.pendingCommands = 0; state.pendingResponseHeaders = 1;
  assert.throws(() => closedNativeEvidence(controller));
  state.pendingResponseHeaders = 0; state.failures = ["private https://secret.invalid"];
  assert.throws(() => closedNativeEvidence(controller));
  state.failures = []; state.responseCounts = { "raw-secret": 1 };
  assert.throws(() => closedNativeEvidence(controller));
});
