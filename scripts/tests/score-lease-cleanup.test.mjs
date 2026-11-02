import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const source = stripTypeScriptTypes(readFileSync(new URL("../../e2e/helpers/scoreLeaseCleanup.ts", import.meta.url), "utf8"));
const { developmentUpstream } = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(
  readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8"),
)).toString("base64"));
const token = (id, suffix = "signature") => `e30.${Buffer.from(JSON.stringify({ user_id: id })).toString("base64url")}.${suffix}`;
const actorAccess = token(12);
const api = "http://127.0.0.1:18000";
const web = "http://127.0.0.1:4173";
const tenant = "qa-score-cleanup-contract";

async function fixture(options = {}) {
  const calls = [];
  const listeners = new Map();
  const context = {
    request: {},
    on: (name, callback) => listeners.set(name, callback),
    off: (name) => listeners.delete(name),
    close: async () => {
      calls.push({ action: "close" });
      if (options.closeFailure) throw new Error("close failed");
    },
  };
  const request = {
    post: async (url, config) => {
      calls.push({ action: "release", url, config });
      if (options.transportFailure) throw new Error("transport failed");
      return { status: () => options.status ?? 204, dispose: async () => { calls.push({ action: "dispose" }); } };
    },
  };
  const guard = {
    beginClose: async () => { calls.push({ action: "drain" }); if (options.drainFailure) throw new Error("drain failed"); },
    assertClean: () => { if (options.guardFailure) throw new Error("boundary failed"); },
  };
  const realm = createContext({ Buffer, URL, process: { env: {} }, Error, AggregateError });
  const definitions = {
    "./qaStudentParentScenario": { assertQaStudentParentRuntime() {}, QA_API: api, QA_BASE: web, QA_TENANT: tenant },
    "./releaseApiBoundary": {
      releaseBoundaryFromEnv: () => ({ mode: options.mode ?? "development", apiOrigin: api, webOrigin: web, tenantCode: tenant }),
      developmentUpstream,
      installReleaseRequestGuard() {},
      installReleaseContextGuard: async () => guard,
    },
  };
  const module = new SourceTextModule(source, { context: realm });
  await module.link((name) => {
    const exports = definitions[name];
    assert.ok(exports, `Unexpected dependency ${name}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context: realm });
  });
  await module.evaluate();
  const observe = (changes = {}) => {
    const headers = { authorization: `Bearer ${token(12, "refreshed")}`, "x-tenant-code": tenant, "x-score-editor-client": "owned-client", ...changes.headers };
    const url = `${changes.origin ?? web}/api/v1/results/admin/sessions/${changes.session ?? 73}/score-draft/`;
    listeners.get("request")?.({ url: () => url, method: () => changes.method ?? "PUT", headers: () => headers,
      allHeaders: async () => { await changes.beforeHeaders?.(); return headers; } });
  };
  const run = (work = async () => { observe(); }, afterClose) => module.namespace.withOwnedScoreLeaseCleanup(context, request,
    { sessionId: 73, actorAccess }, work, afterClose);
  return { calls, observe, run, listeners };
}

test("owned leases drain and close before release with the same actor; refreshed tokens and duplicate requests are safe", async () => {
  const f = await fixture();
  await f.run(async () => { f.observe(); f.observe(); }, async () => { f.calls.push({ action: "after-close" }); });
  assert.deepEqual(f.calls.map(({ action }) => action), ["drain", "close", "release", "dispose", "after-close"]);
  const release = f.calls.find(({ action }) => action === "release");
  assert.equal(release.url, `${api}/api/v1/results/admin/sessions/73/score-draft/commit/`);
  assert.equal(release.config.headers.Authorization, `Bearer ${actorAccess}`);
  assert.equal(release.config.headers["X-Tenant-Code"], tenant);
  assert.equal(release.config.headers["X-Score-Editor-Client"], "owned-client");
  assert.equal(JSON.stringify(release.config.data), '{"release_lease":true}');
  assert.equal(f.listeners.size, 0);
});

test("the production-shaped bundle URL is observed through the real development mapper and released only to the isolated API", async () => {
  const f = await fixture();
  await f.run(async () => f.observe({ origin: "https://api.hakwonplus.com" }));
  const releases = f.calls.filter(({ action }) => action === "release");
  assert.equal(releases.length, 1);
  assert.equal(releases[0].url, `${api}/api/v1/results/admin/sessions/73/score-draft/commit/`);
  assert.equal(releases[0].config.headers.Authorization, `Bearer ${actorAccess}`);
});

for (const [name, change] of [
  ["different actor", { headers: { authorization: `Bearer ${token(13)}` } }],
  ["different session", { session: 74 }],
  ["different tenant", { headers: { "x-tenant-code": "qa-other" } }],
  ["different origin", { origin: "https://unowned.invalid" }],
  ["lookalike API origin", { origin: "https://api.hakwonplus.com.unowned.invalid" }],
]) {
  test(`never releases a lease observed for a ${name}`, async () => {
    const f = await fixture();
    await assert.rejects(f.run(async () => f.observe(change)), /scope-mismatch/);
    assert.equal(f.calls.filter(({ action }) => action === "release").length, 0);
  });
}

for (const status of [200, 403, 409, 500]) {
  test(`release status ${status} remains a failure`, async () => {
    const f = await fixture({ status });
    await assert.rejects(f.run(), new RegExp(`status=${status}`));
  });
}

test("already absent owned lease is accepted; an unused editor sends no cleanup mutation", async () => {
  const absent = await fixture({ status: 404 });
  await absent.run();
  const unused = await fixture();
  await unused.run(async () => {});
  assert.deepEqual(unused.calls.map(({ action }) => action), ["drain", "close"]);
});

test("workflow and release failures are both retained", async () => {
  const f = await fixture({ status: 403 });
  const original = new Error("original workflow failure");
  await assert.rejects(f.run(async () => { f.observe(); throw original; }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors[0], original);
    assert.match(error.errors[1].message, /status=403/);
    return true;
  });
});

test("pending header observations finish before context close and lease release", async () => {
  const f = await fixture();
  let finishHeaders;
  const headersReady = new Promise((resolve) => { finishHeaders = resolve; });
  const running = f.run(async () => { f.observe({ beforeHeaders: () => headersReady }); });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.calls.map(({ action }) => action), ["drain"]);
  finishHeaders();
  await running;
  assert.deepEqual(f.calls.map(({ action }) => action), ["drain", "close", "release", "dispose"]);
});

test("missing client fails writes but a read without a lease sends no release", async () => {
  const write = await fixture();
  await assert.rejects(write.run(async () => write.observe({ headers: { "x-score-editor-client": undefined } })), /missing-client/);
  assert.equal(write.calls.filter(({ action }) => action === "release").length, 0);
  const read = await fixture();
  await read.run(async () => read.observe({ method: "GET", headers: { "x-score-editor-client": undefined } }));
  assert.equal(read.calls.filter(({ action }) => action === "release").length, 0);
});

test("unreadable headers fail safely without unhandled rejection or release", async () => {
  const f = await fixture();
  await assert.rejects(f.run(async () => f.observe({ beforeHeaders: async () => { throw new Error("synthetic header failure"); } })), /headers-failed/);
  assert.equal(f.calls.filter(({ action }) => action === "release").length, 0);
});

for (const failure of ["drainFailure", "closeFailure"]) {
  test(`does not race UI writers when ${failure} prevents closure`, async () => {
    const f = await fixture({ [failure]: true });
    await assert.rejects(f.run(), /score-lease-context-/);
    assert.equal(f.calls.filter(({ action }) => action === "release").length, 0);
  });
}

test("production mode is rejected before executing work or release", async () => {
  const f = await fixture({ mode: "readonly" });
  let ran = false;
  await assert.rejects(f.run(async () => { ran = true; }), /invalid-owned-scope/);
  assert.equal(ran, false);
  assert.equal(f.calls.filter(({ action }) => action === "release").length, 0);
});
