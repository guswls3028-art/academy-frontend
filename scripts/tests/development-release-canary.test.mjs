import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import http from "node:http";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertReleaseSummary, assertCleanup, assertManifest, assertActiveInstance, assertReadOnlyAssessmentSource, observeReleaseTestResult } from "../run-development-release-canary.mjs";
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
    operationObservation: null,
    inspectObservation: null,
    realUseObservation: null,
    videoRuntimeObservation: null,
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
        message: "student-name token-secret capability-secret password-secret",
      }),
      "raw-output-secret",
    ].join("\n"),
  });

  assert.deepEqual(result.observation, {
    action: "Inspect",
    exitCode: 1,
    jsonLineCount: 1,
    sessionIdObserved: true,
    payloadStatus: "DEVELOPMENT_QA_FAILED",
    errorType: "AssertionError",
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
    errorType: "OtherError",
  });
  assert.doesNotMatch(JSON.stringify(result.observation), /DeleteEverything|student-name|SecretProviderError/);
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
    payloadStatus: null, errorType: null,
  });
  assert.deepEqual(runner.observeFixedOperationResult("Inspect", openResult).observation, {
    action: "Inspect", exitCode: 0, jsonLineCount: 1, sessionIdObserved: true,
    payloadStatus: "DEVELOPMENT_QA_IDENTITY_PASS", errorType: null,
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
  return { errors: [], stats: { expected: 11, skipped: 0, unexpected: 0, flaky: 0 }, suites: [
    ...Object.entries({ "notice-roundtrip.spec.ts": 3, "qna-roundtrip.spec.ts": 4, "clinic-roundtrip.spec.ts": 3,
      "video-playback-renewal.realuse.spec.ts": 1 }).map(([file, count]) => ({
      file, specs: Array.from({ length: count }, () => ({ file, tests: [{ expectedStatus: "passed", status: "expected", results: [{ status: "passed" }] }] })),
    })),
  ] };
}

test("real-use failure observation publishes only allowlisted counts, files, and boundary codes", () => {
  const report = completeFlowReport();
  const failed = report.suites[0].specs[0].tests[0];
  failed.status = "unexpected";
  failed.results[0] = {
    status: "failed",
    errors: [{ message: "Release request rejected [tenant] secret-token student-name" }],
    stdout: [{ text: `${JSON.stringify({ releaseApiMode: "development", transport: {
      readFetchRetries: 1, suppressedAnalyticsBatches: 2,
      suppressedAnalyticsEvents: 3, suppressedCloudflareBeacons: 4,
    }, ignored: "safe" })}\n` }],
  };
  report.errors.push({ message: "Release request rejected [cors] C:/secret/path" });
  report.stats.unexpected = 1;
  report.stats.expected = 9;
  assert.deepEqual(observeReleaseTestResult(JSON.stringify(report)), {
    reportStatus: "parsed",
    stats: { expected: 9, skipped: 0, unexpected: 1, flaky: 0 },
    failedFiles: ["notice-roundtrip.spec.ts"],
    boundaryCodes: ["cors", "tenant"],
    runnerErrorCount: 1,
    readFetchRetries: 1,
    suppressedAnalyticsBatches: 2,
    suppressedAnalyticsEvents: 3,
    suppressedCloudflareBeacons: 4,
    longVideo: null,
  });
  const published = JSON.stringify(observeReleaseTestResult(JSON.stringify(report)));
  assert.doesNotMatch(published, /secret-token|student-name|C:\/secret\/path/);
  assert.deepEqual(observeReleaseTestResult("not-json secret-token"), {
    reportStatus: "unparsed",
    stats: { expected: null, skipped: null, unexpected: null, flaky: null },
    failedFiles: [], boundaryCodes: [], runnerErrorCount: null,
    readFetchRetries: null, suppressedAnalyticsBatches: null,
    suppressedAnalyticsEvents: null, suppressedCloudflareBeacons: null,
    longVideo: null,
  });
});

test("all eleven real-use cases are mandatory; missing, skip, failure, retry and global errors fail closed", () => {
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

test("development config discovers eleven enabled cases without executing any API test", () => {
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
  assert.equal(discovered, 11);
  // Playwright's --list reporter counts all unexecuted cases as skipped. These
  // are discovery-only, never accepted by assertReleaseSummary as real-use proof.
  assert.equal(report.stats.expected, 0);
  assert.throws(() => assertReleaseSummary(report));
});

test("long-video setup, runtime and PII-free browser evidence fail closed", () => {
  assert.equal(typeof runner.assertLongVideoSetup, "function");
  assert.equal(typeof runner.observeLongVideoRuntime, "function");
  assert.equal(typeof runner.syntheticLongVideoAsset, "function");

  const setup = {
    status: "YMATH_REALUSE_SCENARIO_READY",
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
    { ...setup, student_ids: [101] },
    { ...setup, session_ids: [201] },
    { ...setup, session_ids: [201, 202, 203] },
    { ...setup, session_ids: [201, 0] },
    { ...setup, synthetic_long_video: { ...setup.synthetic_long_video, duration_seconds: 899 } },
    { ...setup, synthetic_long_video: { ...setup.synthetic_long_video, hls_path: "foreign/master.m3u8" } },
    { ...setup, synthetic_long_video: { ...setup.synthetic_long_video, video_accesses: 1 } },
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
    minimumRenewalAdvanceSeconds: 5, sourceReloadCount: 0,
    sameDomCount: 2, sameSessionCount: 2, tokenRotationCount: 2,
    progressPersistedCount: 2, maxReloadDriftSeconds: 2,
    consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0,
    horizontalOverflowCount: 0,
  } })}\n` }];
  assert.deepEqual(runner.observeReleaseTestResult(JSON.stringify(report)).longVideo, {
    schemaMatches: true, contextCount: 2, desktopCount: 1, mobileCount: 1,
    minimumPlaybackSeconds: 690, minimumWallSeconds: 690,
    bootstrapCount: 2, renewCount: 2, endBeforeRenewCount: 0,
    initialMasterLoadCount: 2, initialMediaLoadCount: 4,
    minimumRenewalAdvanceSeconds: 5, sourceReloadCount: 0,
    sameDomCount: 2, sameSessionCount: 2, tokenRotationCount: 2,
    progressPersistedCount: 2, maxReloadDriftSeconds: 2,
    consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0,
    horizontalOverflowCount: 0,
  });
  for (const invalidEvidence of [
    { sourceReloadCount: 1 },
    { minimumRenewalAdvanceSeconds: 4 },
    { initialMasterLoadCount: 1 },
    { initialMediaLoadCount: 3 },
  ]) {
    const invalidReport = completeFlowReport();
    invalidReport.suites.at(-1).specs[0].tests[0].results[0].stdout = [{ text: `${JSON.stringify({ longVideoRealUse: {
      schema: "student-video-renewal/v1", contexts: 2, desktop: 1, mobile: 1,
      minimumPlaybackSeconds: 690, minimumWallSeconds: 690,
      bootstrapCount: 2, renewCount: 2, endBeforeRenewCount: 0,
      initialMasterLoadCount: 2, initialMediaLoadCount: 4,
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

test("official runner opts into two-student long-video setup without publishing credentials", () => {
  const runnerSource = readFileSync(new URL("../run-development-release-canary.mjs", import.meta.url), "utf8");
  const configSource = readFileSync(new URL("../../playwright.development-release.config.ts", import.meta.url), "utf8");
  const specSource = readFileSync(new URL("../../e2e/student/video-playback-renewal.realuse.spec.ts", import.meta.url), "utf8");
  assert.match(runnerSource, /SyntheticLongVideo: \["true"\]/);
  assert.match(runnerSource, /E2E_STUDENT2_USER: "ymath-qa-student-02"/);
  assert.match(runnerSource, /E2E_LONG_VIDEO_ID: String\(scenario\.synthetic_long_video\.video_id\)/);
  assert.match(configSource, /student\/video-playback-renewal\.realuse\.spec\.ts/);
  assert.match(configSource, /timeout: 17 \* 60_000/);
  for (const required of ["690", "540", "590", "1366", "390", "reload", "playback/end/", "media/playback/renew/"]) {
    assert.match(specSource, new RegExp(required.replace("/", "\\/")));
  }
  assert.match(specSource, /bootstrapCountBeforeRenewal/);
  assert.doesNotMatch(specSource, /bootstrapCount:\s*states\.reduce\(\(total\) => total \+ 1/);
  assert.match(specSource, /toBeGreaterThan\(MINIMUM_PLAYBACK_SECONDS\)/);
  assert.match(specSource, /sourceReloadCount/);
  assert.match(specSource, /expect\(payload\.play_url == null\)\.toBe\(true\)/);
  assert.match(specSource, /state\.allowedMasterUrls\.size\)\.toBe\(2\)/);
  assert.doesNotMatch(specSource, /state\.masterLoads\)\.toBeGreaterThanOrEqual\(2\)/);
  assert.doesNotMatch(specSource, /state\.mediaLoads\)\.toBeGreaterThanOrEqual\(4\)/);
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
      url: () => "https://api.hakwonplus.com/api/v1/core/program/",
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
    suppressedAnalyticsBatches: 0,
    suppressedAnalyticsEvents: 0,
    suppressedCloudflareBeacons: 0,
  });
  assert.doesNotThrow(() => safeRead.guard.assertClean());

  const mutation = await install();
  let mutationAttempts = 0;
  await mutation.handler(makeRoute("POST", async () => {
    mutationAttempts += 1;
    throw new Error("unit mutation fetch interruption");
  }));
  assert.equal(mutationAttempts, 1, "mutations must never be replayed");
  assert.throws(() => mutation.guard.assertClean(), /Release request rejected \[fetch-transport\]/);

  const delivery = await install();
  let deliveryFetches = 0;
  await delivery.handler(makeRoute("GET", async () => {
    deliveryFetches += 1;
    return response;
  }, async () => { throw new Error("unit browser delivery interruption"); }));
  assert.equal(deliveryFetches, 1, "browser delivery failure must not replay upstream transport");
  assert.throws(() => delivery.guard.assertClean(), /Release request rejected \[fulfill-transport\]/);
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
    suppressedAnalyticsBatches: 1,
    suppressedAnalyticsEvents: 1,
    suppressedCloudflareBeacons: 0,
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
    suppressedAnalyticsBatches: 0,
    suppressedAnalyticsEvents: 0,
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
