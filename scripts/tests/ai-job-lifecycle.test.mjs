import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function runtime(mocks, globals = {}) {
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const module = { exports: {} };
    modules.set(file, module.exports);
    const source = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(source, {
      module, exports: module.exports, ...globals,
      require(specifier) {
        if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
        if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}.ts`);
        if (specifier.startsWith(".")) return load(path.join(path.dirname(file), `${specifier}.ts`));
        throw new Error(`Unmocked dependency: ${specifier}`);
      },
    }, { filename: file });
    return module.exports;
  }
  return load;
}

function pptRuntime(responses) {
  let requests = 0;
  let waits = 0;
  const load = runtime({
    "@/shared/api/axios": { default: { get: async () => {
      const data = responses[requests++];
      assert.ok(data, "poller must stop at a terminal response");
      return { data };
    } } },
  }, { setTimeout(callback) { waits++; callback(); } });
  return {
    ...load("src/app_admin/domains/tools/ppt/api/ppt.api.ts"),
    counts: () => ({ requests, waits }),
  };
}

const result = { download_url: "https://fixture.invalid/ppt", filename: "lesson.pptx", slide_count: 3, size_bytes: 100 };

for (const terminal of [
  { status: "UNKNOWN" },
  { status: "DONE" },
  { status: "DONE", result: {} },
  { status: "DONE", result: { ...result, download_url: " " } },
  { status: "DONE", result: { ...result, filename: "" } },
  { status: "DONE", result, error_message: "출력 저장 실패" },
  ...["FAILED", "REJECTED_BAD_INPUT", "FALLBACK_TO_GPU", "REVIEW_REQUIRED", "CANCELLED"].map((status) => ({ status })),
]) {
  test(`PPT terminal failure stops immediately: ${JSON.stringify(terminal)}`, async () => {
    const h = pptRuntime([terminal]);
    await assert.rejects(h.pollPptJob("fixture-job"), /PPT|출력 저장 실패/);
    assert.deepEqual(h.counts(), { requests: 1, waits: 0 });
  });
}

test("PPT reports pending/running progress and returns the complete file once", async () => {
  const h = pptRuntime([
    { status: "PENDING" },
    { status: "RUNNING", progress: { percent: 60 } },
    { status: "DONE", result },
  ]);
  const statuses = [];
  const progress = [];
  assert.equal(await h.pollPptJob("fixture-job", (value) => progress.push(value.percent), (status) => statuses.push(status)), result);
  assert.deepEqual(statuses, ["PENDING", "RUNNING"]);
  assert.deepEqual(progress, [60]);
  assert.deepEqual(h.counts(), { requests: 3, waits: 2 });
});

function matchupRuntime() {
  const requests = [];
  const invalidations = [];
  const timers = new Map();
  let nextTimer = 0;
  let cleanup;
  let state = {};
  let tenant = "fixture-tenant";
  let generation = "fixture-session";
  const schedule = (callback, interval) => {
    timers.set(++nextTimer, { callback, interval });
    return nextTimer;
  };
  const load = runtime({
    react: {
      useEffect(callback) { cleanup = callback(); },
      useRef: (current) => ({ current }),
      useState: (initial) => [initial, (update) => { state = typeof update === "function" ? update(state) : update; }],
    },
    "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries: ({ queryKey }) => invalidations.push([...queryKey]) }) },
    "@/shared/tenant": { getTenantCodeForApiRequest: () => tenant },
    "@/shared/auth/tokenSession": { readAuthTokenEnvelopeSafely: () => ({ generation }) },
    "@/shared/api/axios": {
      createAuthSessionBoundConfig: (authGeneration, signal, expectedTenant) => ({ authGeneration, signal, expectedTenant }),
      default: { get: (url, config) => new Promise((resolve) => requests.push({ url, config, resolve })) },
    },
  }, {
    AbortController,
    setTimeout: (callback) => schedule(callback, false),
    clearTimeout: (id) => timers.delete(id),
    setInterval: (callback) => schedule(callback, true),
    clearInterval: (id) => timers.delete(id),
  });
  const hook = load("src/app_admin/domains/storage/hooks/useMatchupPolling.ts");
  hook.useMatchupPolling([{ id: 41, status: "processing", ai_job_id: "fixture-job", updated_at: new Date().toISOString() }]);
  return {
    requests, invalidations,
    state: () => state,
    runTimers() {
      for (const [id, timer] of [...timers]) {
        if (!timer.interval) timers.delete(id);
        timer.callback();
      }
    },
    respond(index, data) { requests[index].resolve({ data }); },
    dispose() { cleanup?.(); },
    switchTenant() { tenant = "other-tenant"; },
    switchAccount() { generation = "other-session"; },
  };
}

async function flush() {
  for (let count = 0; count < 12; count++) await Promise.resolve();
}

test("Matchup waits for a slow response before scheduling another poll and aborts on exit", async () => {
  const h = matchupRuntime();
  h.runTimers(); h.runTimers(); h.runTimers();
  assert.equal(h.requests.length, 1, "one slow job must not accumulate overlapping requests");
  h.respond(0, { status: "RUNNING", progress: { percent: 42, step_name_display: "문항 분리" } });
  await flush();
  assert.equal(h.state()[41].percent, 42);
  h.runTimers();
  assert.equal(h.requests.length, 2);
  const priorInvalidations = h.invalidations.length;
  h.dispose();
  assert.equal(h.requests[1].config.signal.aborted, true);
  h.respond(1, { status: "DONE" });
  await flush();
  h.runTimers();
  assert.equal(h.invalidations.length, priorInvalidations);
  assert.equal(h.requests.length, 2);
});

for (const change of ["switchTenant", "switchAccount"]) {
  test(`Matchup discards delayed results after ${change}`, async () => {
    const h = matchupRuntime();
    h[change]();
    h.respond(0, { status: "DONE" });
    await flush();
    h.runTimers();
    assert.deepEqual(h.invalidations, []);
    assert.equal(h.requests.length, 1);
    h.dispose();
  });
}

for (const status of ["DONE", "FAILED", "REJECTED_BAD_INPUT", "FALLBACK_TO_GPU", "REVIEW_REQUIRED", "CANCELLED"]) {
  test(`Matchup refreshes persisted document status on ${status}`, async () => {
    const h = matchupRuntime();
    h.respond(0, { status });
    await flush();
    assert.ok(h.invalidations.some((key) => key[0] === "matchup-documents"));
    h.dispose();
  });
}

function workboxRuntime(jobType) {
  const requests = [];
  const completions = [];
  const timers = new Map();
  let timerId = 0;
  let cleanup;
  let tenant = "fixture-tenant";
  let generation = "fixture-generation";
  let sessionGeneration = 1;
  let successes = 0;
  const task = { id: "fixture-job", status: "pending", tenantScope: tenant, meta: { jobId: "fixture-job", jobType } };
  const store = {
    getState: () => [task],
    getSessionGeneration: () => sessionGeneration,
    updateProgress() {}, setTaskLabel() {}, attachWorkerMeta() {},
    completeTask(id, status, error) { completions.push({ id, status, error }); task.status = status; },
  };
  const document = new EventTarget();
  document.visibilityState = "visible";
  const clearTimeout = (id) => timers.delete(id);
  const load = runtime({
    react: { useEffect(callback) { cleanup = callback(); }, useRef: (current) => ({ current }) },
    "@/shared/tenant": { getTenantCodeForApiRequest: () => tenant },
    "@/shared/auth/tokenSession": { readAuthTokenEnvelopeSafely: () => ({ generation }) },
    "./asyncStatusStore": { asyncStatusStore: store },
    "@/shared/ui/feedback/feedback": { feedback: {} },
    "@/shared/api/contracts/submissions": {},
    "@/shared/api/contracts/videos": {},
    "@/shared/api/axios": {
      createAuthSessionBoundConfig: (authGeneration, signal, expectedTenant) => ({ authGeneration, signal, expectedTenant }),
      default: { get: (url, config) => new Promise((resolve, reject) => requests.push({ url, config, resolve, reject })) },
    },
  }, {
    AbortController, document, clearTimeout,
    window: { setTimeout(callback) { timers.set(++timerId, callback); return timerId; } },
  });
  load("src/shared/ui/asyncStatus/useWorkerJobPoller.ts").useWorkerJobPoller([task], {
    onPptSuccess: () => { successes++; }, onMatchupSuccess: () => { successes++; },
  });
  return {
    requests, completions, successes: () => successes,
    runTimers() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    respond(data) { requests[0].resolve({ data: { job_id: task.id, job_type: jobType, ...data } }); },
    reject(error) { requests[0].reject(error); },
    switchTenant() { tenant = "other-tenant"; },
    switchAccount() { generation = "other-generation"; sessionGeneration++; },
    dispose() { cleanup?.(); },
  };
}

for (const jobType of ["ppt_generation", "matchup_analysis", "matchup_document_watch"]) {
  test(`Workbox ${jobType} keeps one request in flight`, async () => {
    const h = workboxRuntime(jobType);
    h.runTimers(); h.runTimers();
    assert.equal(h.requests.length, 1);
    h.dispose();
    assert.equal(h.requests[0].config.signal.aborted, true);
  });
  for (const change of ["switchTenant", "switchAccount", "dispose"]) {
    test(`Workbox ${jobType} discards delayed completion after ${change}`, async () => {
      const h = workboxRuntime(jobType);
      h[change]();
      h.respond({ status: jobType === "matchup_document_watch" ? "done" : "DONE", result });
      await flush();
      assert.deepEqual(h.completions, []);
      assert.equal(h.successes(), 0);
      h.dispose();
    });
  }
}

test("Workbox PPT rejects an empty DONE and completes a real result once", async () => {
  const invalid = workboxRuntime("ppt_generation");
  invalid.respond({ status: "DONE" });
  await flush();
  assert.equal(invalid.completions[0].status, "error");
  assert.equal(invalid.successes(), 0);
  invalid.dispose();
  const valid = workboxRuntime("ppt_generation");
  valid.respond({ status: "DONE", result });
  await flush();
  assert.equal(valid.completions[0].status, "success");
  assert.equal(valid.successes(), 1);
  valid.dispose();
});

for (const jobType of ["ppt_generation", "matchup_analysis", "matchup_public_cleanup", "matchup_document_watch"]) {
  for (const status of [403, 404]) {
    test(`Workbox ${jobType} ends an unavailable ${status} without polling or reporting success`, async () => {
      const h = workboxRuntime(jobType);
      h.reject({ response: { status, data: { detail: "untrusted server detail" } } });
      await flush();
      assert.equal(h.completions.length, 1);
      assert.equal(h.completions[0].status, "error");
      assert.match(h.completions[0].error, /작업.*권한/);
      assert.doesNotMatch(h.completions[0].error, /untrusted/);
      h.runTimers(); h.runTimers();
      assert.equal(h.requests.length, 1);
      assert.equal(h.successes(), 0);
      h.dispose();
    });
  }
  for (const change of ["switchTenant", "switchAccount", "dispose"]) {
    test(`Workbox ${jobType} ignores late access denial after ${change}`, async () => {
      const h = workboxRuntime(jobType);
      h[change]();
      h.reject({ response: { status: 404 } });
      await flush();
      assert.deepEqual(h.completions, []);
      h.dispose();
    });
  }
  test(`Workbox ${jobType} retries temporary HTTP and transport failures`, async () => {
    for (const error of [{ response: { status: 429 } }, { response: { status: 503 } }, new Error("network")]) {
      const h = workboxRuntime(jobType);
      h.reject(error);
      await flush();
      assert.deepEqual(h.completions, []);
      h.runTimers();
      assert.equal(h.requests.length, 2);
      h.dispose();
    }
  });
}

for (const jobType of ["matchup_analysis", "matchup_public_cleanup"]) {
  test(`Workbox ${jobType} stops when both durable and cache state are missing`, async () => {
    const h = workboxRuntime(jobType);
    h.respond({ status: "UNKNOWN" });
    await flush();
    assert.equal(h.completions[0]?.status, "error");
    assert.match(h.completions[0].error, /작업.*권한/);
    h.runTimers(); h.runTimers();
    assert.equal(h.requests.length, 1);
    assert.equal(h.successes(), 0);
    h.dispose();
  });
}
