import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import http from "node:http";
import { chromium } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertReleaseSummary, assertCleanup, assertManifest, assertActiveInstance, assertReadOnlyAssessmentSource, observeReleaseTestResult } from "../run-development-release-canary.mjs";
import * as runner from "../run-development-release-canary.mjs";

test("release-aware browser worker fixture outlives the 690-second playback proof", () => {
  const source = readFileSync(new URL("../../e2e/fixtures/strictTest.ts", import.meta.url), "utf8");
  assert.match(source, /scope:\s*["']worker["'][^}\]]*timeout:\s*20\s*\*\s*60_000/s);
});

test("release-aware browser fixture emits evidence once before close and teardown assertions", async () => {
  const source = readFileSync(new URL("../../e2e/fixtures/strictTest.ts", import.meta.url), "utf8");
  const fixtureSource = stripTypeScriptTypes(source)
    .replace(/^import .+;\r?$/gm, "")
    .replace("export const test =", "const test =")
    .replace(/^export \{ expect \};\r?$/m, "");
  const createFixture = new Function("base", "expect", "installAccountNotificationGuard", "attachStrictBrowserGuards",
    "installReleaseContextGuard", "releaseBoundaryFromEnv", `${fixtureSource}\nreturn test;`);
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
          beginClose: async () => {},
          assertClean() {
            assertions += 1;
            assert.equal(evidence.length, 1, "diagnostics must be emitted before any failing assertion");
            if (failed) throw failure;
          },
        };
        const options = createFixture({ extend: (value) => value }, assert, () => {}, () => {},
          async () => boundaryGuard, () => ({ mode: "development" }));
        const originalNewContext = async () => ({ request: {}, on() {}, close: async () => { closed += 1; } });
        const browser = { newContext: originalNewContext };
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
        assert.equal(evidence.length, 1, "explicit close followed by worker teardown must not duplicate counters");
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
  assert.match(source, /await page\.waitForLoadState\("networkidle", \{ timeout: 10_000 \}\);\s*await page\.reload/s);
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
    cleanupObservation: null,
    inspectObservation: null,
    postCleanupInspectOperationObservation: null,
    postCleanupInspectObservation: null,
    realUseObservation: null,
    realUseProcessObservation: null,
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
  assert.match(runner, /}, 30 \* 60_000\);/);
  assert.doesNotMatch(runner, /}, 20 \* 60_000\);/);
  assert.match(job("development-canary"), /timeout-minutes: 40/);
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
  return { errors: [], stats: { expected: 19, skipped: 0, unexpected: 0, flaky: 0 }, suites: [
    ...Object.entries({ "notice-roundtrip.spec.ts": 3, "qna-roundtrip.spec.ts": 4, "clinic-roundtrip.spec.ts": 3,
      "student-parent-account-realuse.spec.ts": 1, "student-parent-assessment-realuse.spec.ts": 1,
      "student-parent-clinic-realuse.spec.ts": 1, "student-parent-community-realuse.spec.ts": 1,
      "student-clinic-required-cancel-realuse.spec.ts": 1,
      "student-parent-homework-realuse.spec.ts": 1,
      "student-parent-learning-realuse.spec.ts": 1, "student-parent-storage-realuse.spec.ts": 1,
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
  report.stats.expected = 9;
  assert.deepEqual(observeReleaseTestResult(JSON.stringify(report)), {
    reportStatus: "parsed",
    stats: { expected: 9, skipped: 0, unexpected: 1, flaky: 0 },
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
    longVideo: null,
    longVideoFailure: null,
    longVideoErrorCodes: [],
    longVideoResult: null,
    longVideoCheckpoint: { desktop: null, mobile: null },
  });
  const published = JSON.stringify(observeReleaseTestResult(JSON.stringify(report)));
  assert.doesNotMatch(
    published,
    /secret-token|student-name|C:\/secret\/path|qaStudentName123|018f8e2a-7abc-7def-8123-0123456789ab|01JQ3Z7VB8J7MQ19AY7WQ4F8NN|tenantAlpha|objectHashABC123/,
  );
  assert.deepEqual(observeReleaseTestResult("not-json secret-token"), {
    reportStatus: "unparsed",
    stats: { expected: null, skipped: null, unexpected: null, flaky: null },
    failedFiles: [], failureLocations: [], boundaryCodes: [], failureDiagnostics: [], runnerErrorCount: null,
    readFetchRetries: null, suppressedAnalyticsBatches: null,
    suppressedAnalyticsEvents: null, suppressedCloudflareBeacons: null,
    requestTransportDiagnostics: [],
    longVideo: null,
    longVideoFailure: null,
    longVideoErrorCodes: [],
    longVideoResult: null,
    longVideoCheckpoint: { desktop: null, mobile: null },
  });
});

test("all nineteen real-use cases are mandatory; missing, skip, failure, retry and global errors fail closed", () => {
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

test("development config discovers nineteen enabled cases without executing any API test", () => {
  const cwd = new URL("../../", import.meta.url);
  const output = execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test",
    "--config=playwright.development-release.config.ts", "--list"], {
    cwd, encoding: "utf8", env: { ...process.env,
      E2E_API_URL: "http://127.0.0.1:18000", E2E_BASE_URL: "http://localhost:4173",
      E2E_TENANT_CODE: "qa-ymath-realuse-fe-123-1-abcdef123456",
      E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0", E2E_STRICT: "strict",
      E2E_STUDENT_PARENT_REALUSE: "1", E2E_ALLOW_REAL_ALIMTALK: "0" },
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
  assert.equal(discovered, 19);
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
    posterLoadCount: 2,
    minimumRenewalAdvanceSeconds: 5, sourceReloadCount: 0,
    sameDomCount: 2, sameSessionCount: 2, tokenRotationCount: 2,
    progressPersistedCount: 2, maxReloadDriftSeconds: 2,
    consoleErrorCount: 0, pageErrorCount: 0, requestErrorCount: 0,
    horizontalOverflowCount: 0,
  } })}\n${JSON.stringify({ longVideoCheckpoint: {
    schema: "student-video-renewal-checkpoint/v1", viewport: "desktop", stage: "playback-started",
  } })}\n${JSON.stringify({ longVideoCheckpoint: {
    schema: "student-video-renewal-checkpoint/v1", viewport: "mobile", stage: "navigated",
  } })}\n` }];
  assert.deepEqual(runner.observeReleaseTestResult(JSON.stringify(report)).longVideoCheckpoint, {
    desktop: "playback-started", mobile: "navigated",
  });
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
  assert.match(runnerSource, /SyntheticLongVideo: \["true"\]/);
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

const policySource = readFileSync(new URL("../../e2e/helpers/releaseApiBoundary.ts", import.meta.url), "utf8");
const policyModule = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(policySource)).toString("base64")}`);
const { assertReleaseRequestSafe, releaseBoundaryFromEnv, installReleaseRequestGuard, installReleaseContextGuard } = policyModule;
const posterBridgeSource = readFileSync(new URL("../../e2e/helpers/syntheticVideoPosterBridge.ts", import.meta.url), "utf8");
const { installSyntheticVideoPosterBridge } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(posterBridgeSource)).toString("base64")}`
);
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
    suppressedAnalyticsBatches: 0,
    suppressedAnalyticsEvents: 0,
    suppressedCloudflareBeacons: 0,
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
  assert.equal(mutationAttempts, 1, "mutations must never be replayed");
  assert.deepEqual(mutation.guard.requestTransportDiagnostics, [{
    method: "POST", pathTemplate: "/api/v1/students/me/activity/", requestKind: "mutation",
    stage: "initial", transportCode: "transport",
  }]);
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
