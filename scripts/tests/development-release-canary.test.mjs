import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import http from "node:http";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { assertReleaseSummary, assertCleanup, assertManifest, assertActiveInstance, assertReadOnlyAssessmentSource } from "../run-development-release-canary.mjs";
import * as runner from "../run-development-release-canary.mjs";

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
  assert.match(source, /OwnershipCapability: \[capability\]/);
  assert.match(source, /writeEvidence\(false, \["development attempt unfinished; cleanup not proven"\]\)/);
  assert.match(source, /process\.on\("SIGTERM", interrupt\)/);
});

test("a timed-out owned process is killed and reaped even if SIGTERM is ignored", { timeout: 10_000 }, async () => {
  assert.equal(typeof runner.ownedProcess, "function");
  const child = runner.ownedProcess(process.execPath, ["-e",
    'process.on("SIGTERM", () => {}); process.stdout.write("ready"); setInterval(() => {}, 10);'], {}, 1_000, 100);
  try {
    const result = await child.done;
    assert.equal(result.code, -1);
    assert.match(result.stdout, /ready/);
    assert.throws(() => process.kill(child.child.pid, 0));
  } finally { child.stop(); }
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
  return { errors: [], stats: { expected: 10, skipped: 0, unexpected: 0, flaky: 0 }, suites: [
    ...Object.entries({ "notice-roundtrip.spec.ts": 3, "qna-roundtrip.spec.ts": 4, "clinic-roundtrip.spec.ts": 3 }).map(([file, count]) => ({
      file, specs: Array.from({ length: count }, () => ({ file, tests: [{ expectedStatus: "passed", status: "expected", results: [{ status: "passed" }] }] })),
    })),
  ] };
}

test("all ten real-use cases are mandatory; missing, skip, failure, retry and global errors fail closed", () => {
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

test("cleanup requires the exact owned tenant and numeric zero tenant/user residue", () => {
  const tenant = "qa-ymath-realuse-fe-123-1-abcdef123456";
  const valid = { tenant_code: tenant, status: "YMATH_REALUSE_SCENARIO_DESTROYED", remaining: { tenants: 0, users: 0 } };
  assert.doesNotThrow(() => assertCleanup(valid, tenant));
  for (const invalid of [{ ...valid, tenant_code: `${tenant}-foreign` }, { ...valid, remaining: { tenants: 0, users: 1 } },
    { ...valid, remaining: { tenants: "0", users: 0 } }, { ...valid, status: "YMATH_REALUSE_SCENARIO_READY" }]) {
    assert.throws(() => assertCleanup(invalid, tenant));
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

test("development config discovers ten enabled cases without executing any API test", () => {
  const cwd = new URL("../../", import.meta.url);
  const output = execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test",
    "--config=playwright.development-release.config.ts", "--list"], {
    cwd, encoding: "utf8", env: { ...process.env,
      E2E_API_URL: "http://127.0.0.1:18000", E2E_BASE_URL: "http://localhost:4173",
      E2E_TENANT_CODE: "qa-ymath-realuse-fe-123-1-abcdef123456",
      E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0", E2E_STRICT: "strict" },
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
  assert.equal(discovered, 10);
  // Playwright's --list reporter counts all unexecuted cases as skipped. These
  // are discovery-only, never accepted by assertReleaseSummary as real-use proof.
  assert.equal(report.stats.expected, 0);
  assert.throws(() => assertReleaseSummary(report));
});

const policySource = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const policyModule = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(policySource)).toString("base64")}`);
const { assertReleaseRequestSafe, releaseBoundaryFromEnv, installReleaseRequestGuard, installReleaseContextGuard } = policyModule;
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

test("missing/unsafe release configuration fails before creating a scenario", () => {
  for (const overrides of [{}, { E2E_ALLOW_PRODUCTION_WRITES: "1" }, { E2E_API_URL: "https://api.hakwonplus.com" }]) {
    assert.throws(() => releaseBoundaryFromEnv({ E2E_RELEASE_API_MODE: "development", ...overrides }));
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
