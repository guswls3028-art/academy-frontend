import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGION = "ap-northeast-2";
const ACCOUNT = "809466760795";
const QA_DOCUMENT = "academy-frontend-development-qa";
const PORT_DOCUMENT = "academy-frontend-development-api-port";
const PASSWORD_PARAMETER = "/academy/api/development/ymath-realuse-password";
const WEB_ORIGIN = "http://localhost:4173";
const API_ORIGIN = "http://127.0.0.1:18000";
const FLOW_COUNTS = { "notice-roundtrip.spec.ts": 3, "qna-roundtrip.spec.ts": 4, "clinic-roundtrip.spec.ts": 3 };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonical = (value) => JSON.stringify(value, function (_key, item) {
  return item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item;
});
const FIXED_ACTIONS = new Set(["Inspect", "Setup", "Cleanup"]);
const FIXED_STATUSES = new Set([
  "DEVELOPMENT_QA_FAILED",
  "DEVELOPMENT_QA_IDENTITY_PASS",
  "YMATH_REALUSE_SCENARIO_READY",
  "YMATH_REALUSE_SCENARIO_DESTROYED",
  "YMATH_REALUSE_SCENARIO_ABSENT",
]);
const FIXED_ERROR_TYPES = new Set([
  "AssertionError", "BotoCoreError", "ClientError", "CommandError", "ConnectionError", "DatabaseError",
  "IntegrityError", "KeyError", "OperationalError", "PermissionError", "RuntimeError", "TimeoutError",
  "TypeError", "ValueError",
]);
const PREFLIGHT_STAGES = ["process", "bundle", "governance", "iam", "document", "host", "ssm"];
const PREFLIGHT_CHECKS = PREFLIGHT_STAGES.slice(1);

function initialPreflightEvidence(frontendSha) {
  return {
    frontendSha: /^[a-f0-9]{40}$/.test(frontendSha || "") ? frontendSha : null,
    backendGovernanceSha: null, backendReleaseId: null, apiDigest: null, instanceId: null,
    tenantCode: null, artifactSha256: null, cases: null, documentSha256: {}, cleanup: null,
    operationObservation: null, inspectObservation: null,
    preflightStage: "process",
    preflightChecks: Object.fromEntries(PREFLIGHT_CHECKS.map((name) => [name, false])),
    terminalOutcome: "preflight_running", passed: false,
    failures: ["development preflight unfinished; cleanup not proven"],
  };
}

export async function runPreflightStages(stages, persist, frontendSha) {
  const evidence = initialPreflightEvidence(frontendSha);
  persist(evidence);
  try {
    assert.deepEqual(stages.map(([name]) => name), PREFLIGHT_STAGES, "Unexpected development preflight stages");
    for (const [name, check] of stages) {
      evidence.preflightStage = name;
      persist(evidence);
      await check();
      if (Object.hasOwn(evidence.preflightChecks, name)) evidence.preflightChecks[name] = true;
      persist(evidence);
    }
    evidence.preflightStage = "complete";
    evidence.terminalOutcome = "qa_running";
    persist(evidence);
    return evidence;
  } catch (error) {
    evidence.terminalOutcome = "preflight_failed";
    persist(evidence);
    throw error;
  }
}

export function observeFixedOperationResult(action, result) {
  const stdout = typeof result?.stdout === "string" ? result.stdout : "";
  const jsonLines = stdout.split(/\r?\n/).filter((line) => line.trim().startsWith("{"));
  let payload = null;
  let parseError = null;
  if (jsonLines.length === 1) {
    try { payload = JSON.parse(jsonLines[0]); }
    catch (error) { parseError = error; }
  }
  const errorType = typeof payload?.error_type === "string" && payload.error_type.length > 0
    ? (FIXED_ERROR_TYPES.has(payload.error_type) ? payload.error_type : "OtherError") : null;
  return {
    observation: {
      action: FIXED_ACTIONS.has(action) ? action : null,
      exitCode: Number.isInteger(result?.code) && result.code >= -1 && result.code <= 255 ? result.code : null,
      jsonLineCount: jsonLines.length,
      sessionIdObserved: /Starting session with SessionId:\s*[A-Za-z0-9_.:-]+/.test(stdout),
      payloadStatus: FIXED_STATUSES.has(payload?.status) ? payload.status : null,
      errorType,
    },
    payload,
    parseError,
  };
}

export function inspectMatchObservation(payload, manifest) {
  return {
    statusMatches: payload?.status === "DEVELOPMENT_QA_IDENTITY_PASS",
    remainingZero: canonical(payload?.remaining) === canonical({ tenants: 0, users: 0 }),
    releaseMatches: payload?.release_id === manifest?.releaseImageTag,
    digestMatches: payload?.digest === manifest?.images?.["academy-api"]?.digest,
  };
}

export function assertReadOnlyAssessmentSource(source) {
  assert.ok(source.includes('from "../fixtures/strictTest"'), "Assessment must use the release-aware strict fixture");
  assert.ok(!/productionWriteOptInSkipReason|test\.skip|request\.(?:post|put|patch|delete)|["'](?:POST|PUT|PATCH|DELETE)["']/.test(source),
    "Reviewed assessment cannot add business writes or skip its required read-only assertions");
}

export function assertReleaseSummary(report, expected = FLOW_COUNTS) {
  const counts = {};
  const visit = (suite) => {
    for (const spec of suite.specs || []) {
      const file = path.basename(String(spec.file || suite.file || ""));
      assert.ok(Object.hasOwn(expected, file), "Unexpected release spec");
      assert.equal(spec.tests?.length, 1, "Exactly one project is required");
      for (const test of spec.tests) {
        assert.equal(test.expectedStatus, "passed", "Skipped/expected-failure case cannot satisfy release");
        assert.equal(test.status, "expected", "Unexpected/flaky release case");
        assert.equal(test.results?.length, 1, "Retries cannot satisfy release");
        assert.equal(test.results[0].status, "passed", "Non-passed release case");
        counts[file] = (counts[file] || 0) + 1;
      }
    }
    for (const child of suite.suites || []) visit(child);
  };
  visit(report);
  assert.deepEqual(counts, expected, "Missing or duplicate release cases");
  assert.equal(report.errors?.length, 0, "Release runner errors");
  assert.equal(report.stats?.skipped, 0, "Release skips are forbidden");
  assert.equal(report.stats?.unexpected, 0);
  assert.equal(report.stats?.flaky, 0);
  assert.equal(report.stats?.expected, Object.values(expected).reduce((a, b) => a + b, 0));
  return counts;
}

export function assertCleanup(payload, tenantCode) {
  assert.equal(payload.tenant_code, tenantCode, "Wrong cleanup tenant");
  assert.ok(["YMATH_REALUSE_SCENARIO_DESTROYED", "YMATH_REALUSE_SCENARIO_ABSENT"].includes(payload.status));
  assert.deepEqual(payload.remaining, { tenants: 0, users: 0 }, "Cleanup residue must be numeric zero");
}

export function assertManifest(manifest) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.complete, true);
  assert.equal(manifest.status, "successful");
  assert.match(manifest.gitSha, /^[a-f0-9]{40}$/);
  assert.match(manifest.releaseImageTag, new RegExp(`^sha-${manifest.gitSha}-run-[0-9]+-[0-9]+$`));
  assert.match(manifest.images?.["academy-api"]?.digest, /^sha256:[a-f0-9]{64}$/);
}

export function assertActiveInstance(instances, manifest) {
  assertManifest(manifest);
  assert.equal(instances.length, 1, "Exactly one active development instance is required");
  const instance = instances[0];
  const tags = Object.fromEntries((instance.Tags || []).map(({ Key, Value }) => [Key, Value]));
  for (const [key, value] of Object.entries({ Name: "academy-v1-api-development", ManagedBy: "academy-api-development",
    Environment: "development", Lifecycle: "active", ReleaseId: manifest.releaseImageTag, VerifiedReleaseId: manifest.releaseImageTag })) {
    assert.equal(tags[key], value, `Wrong development ${key}`);
  }
  assert.equal(instance.State?.Name, "running");
  assert.equal(instance.IamInstanceProfile?.Arn, `arn:aws:iam::${ACCOUNT}:instance-profile/academy-api-development`);
  assert.match(instance.InstanceId, /^i-[a-f0-9]+$/);
  return instance;
}

function aws(args) {
  try {
    return JSON.parse(execFileSync("aws", [...args, "--region", REGION, "--output", "json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
      timeout: 20_000, killSignal: "SIGKILL",
    }));
  } catch { throw new Error(`AWS operation failed: ${args[0]} ${args[1]}`); }
}

async function publicJson(url) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, "Public governance metadata unavailable");
  return response.json();
}

export function artifactFingerprint(directory) {
  const entries = [];
  const visit = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      assert.ok(!entry.isSymbolicLink(), "Artifact cannot contain symbolic links");
      if (entry.isDirectory()) visit(file);
      else entries.push([path.relative(directory, file).replaceAll("\\", "/"), sha(fs.readFileSync(file))]);
    }
  };
  visit(directory);
  assert.ok(entries.length > 1, "Deploy artifact is empty");
  return sha(canonical(entries.sort(([a], [b]) => a.localeCompare(b))));
}

function serveArtifact(directory) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webp": "image/webp" };
  const server = http.createServer((request, response) => {
    try {
      assert.ok(["GET", "HEAD"].includes(request.method));
      const route = decodeURIComponent(new URL(request.url, WEB_ORIGIN).pathname);
      let file = path.resolve(directory, `.${route}`);
      assert.ok(file.startsWith(`${directory}${path.sep}`) || file === directory);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        assert.ok(!path.extname(route), "Missing artifact asset");
        file = path.join(directory, "index.html");
      }
      response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      response.end(request.method === "HEAD" ? undefined : fs.readFileSync(file));
    } catch { response.writeHead(404); response.end(); }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(4173, "127.0.0.1", () => resolve(server));
  });
}

export function createRunOwnership(env) {
  assert.match(env.GITHUB_RUN_ID || "", /^[0-9]+$/);
  assert.match(env.GITHUB_RUN_ATTEMPT || "", /^[0-9]+$/);
  const tenant = `qa-ymath-realuse-fe-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-${crypto.randomBytes(6).toString("hex")}`;
  assert.ok(tenant.length <= 50, "QA tenant exceeds the database code boundary");
  return { tenant, capability: crypto.randomBytes(32).toString("hex") };
}

export function ownedProcess(command, args, options = {}, timeout = 240_000, killGrace = 5_000) {
  const child = spawn(command, args, { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32", windowsHide: true, ...options });
  let escalation;
  let closed = false;
  const kill = (signal) => {
    if (closed || !child.pid) return;
    try {
      if (process.platform === "win32") child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch { /* already exited */ }
  };
  const stop = () => {
    // An exited group leader can leave a descendant holding the output pipes.
    // Wait for close, not exitCode, before considering the whole process reaped.
    if (closed || !child.pid) return;
    kill("SIGTERM");
    escalation ??= setTimeout(() => kill("SIGKILL"), killGrace);
  };
  let stdout = "";
  let failed = false;
  child.stdout.on("data", (data) => { stdout += data; if (stdout.length > 16 * 1024 * 1024) { failed = true; stop(); } });
  // Raw stderr may contain request payloads or credentials. Never relay it.
  child.stderr.resume();
  const timer = setTimeout(() => { failed = true; stop(); }, timeout);
  const done = new Promise((resolve) => {
    child.once("error", () => { closed = true; failed = true; clearTimeout(timer); clearTimeout(escalation); resolve({ code: -1, stdout }); });
    child.once("close", (code) => { closed = true; clearTimeout(timer); clearTimeout(escalation); resolve({ code: failed ? -1 : code, stdout }); });
  });
  return { child, done, stop, output: () => stdout };
}

async function assertFreePort(port) {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () => reject(new Error("Required loopback port is already owned")));
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
}

async function waitPort(port, interrupted) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    assert.equal(interrupted(), false, "Development run interrupted");
    const open = await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
    });
    if (open) return;
    await delay(1_000);
  }
  throw new Error("Owned development tunnel did not become ready");
}

export async function run() {
  const evidencePath = path.join(ROOT, "test-results/development-release.json");
  const persistEvidence = (evidence) => {
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  };
  let identity;
  let bundle;
  let fingerprint;
  let revision;
  let raw;
  let manifest;
  let expectedDocuments;
  let instance;
  let instanceId;
  let tenant;
  let capability;
  const evidence = await runPreflightStages([
    ["process", () => {
      assert.equal(process.env.GITHUB_ACTIONS, "true", "Official CI only; no implicit local synthetic run");
      assert.equal(process.env.GITHUB_EVENT_NAME, "push");
      assert.equal(process.env.GITHUB_REF, "refs/heads/main");
      assert.match(process.env.GITHUB_SHA || "", /^[a-f0-9]{40}$/);
      identity = aws(["sts", "get-caller-identity"]);
      assert.equal(identity.Account, ACCOUNT);
      assert.match(identity.Arn, /:assumed-role\/academy-frontend-development-qa\/academy-fe-qa-[0-9-]+$/);
      ({ tenant, capability } = createRunOwnership(process.env));
      assert.ok(identity.Arn.endsWith(`/academy-fe-qa-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`));
    }],
    ["bundle", () => {
      bundle = path.join(ROOT, ".deploy-bundle");
      fingerprint = artifactFingerprint(bundle);
      assert.equal(JSON.parse(fs.readFileSync(path.join(bundle, "dist/version.json"), "utf8")).version, process.env.GITHUB_SHA);
    }],
    ["governance", async () => {
      const backend = "https://api.github.com/repos/guswls3028-art/academy-backend/commits/main";
      revision = (await publicJson(backend)).sha;
      assert.match(revision, /^[a-f0-9]{40}$/);
      raw = `https://raw.githubusercontent.com/guswls3028-art/academy-backend/${revision}/`;
      manifest = await publicJson(`${raw}docs/reports/release-manifest.latest.json`);
      assertManifest(manifest);
    }],
    ["iam", async () => {
      const expectedBoundary = await publicJson(`${raw}scripts/v1/templates/iam/policy_api_development_parameter_boundary.json`);
      const expanded = JSON.parse(JSON.stringify(expectedBoundary).replaceAll("__REGION__", REGION).replaceAll("__ACCOUNT_ID__", ACCOUNT));
      const hostRole = "academy-api-development-role";
      assert.deepEqual(aws(["iam", "list-role-policies", "--role-name", hostRole]).PolicyNames, ["academy-api-development-runtime"]);
      const attachments = aws(["iam", "list-attached-role-policies", "--role-name", hostRole]).AttachedPolicies;
      assert.deepEqual(attachments.map((item) => item.PolicyArn), ["arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"]);
      const hostPolicy = aws(["iam", "get-role-policy", "--role-name", hostRole, "--policy-name", "academy-api-development-runtime"]).PolicyDocument;
      for (const statement of expanded.Statement) assert.equal(canonical(hostPolicy.Statement.find((item) => item.Sid === statement.Sid)), canonical(statement), "Development parameter deny is not applied");
    }],
    ["document", async () => {
      const documents = [[QA_DOCUMENT, "frontend_development_qa.json"], [PORT_DOCUMENT, "frontend_development_api_port.json"]];
      expectedDocuments = new Map();
      for (const [name, file] of documents) {
        const expected = await publicJson(`${raw}scripts/v1/templates/ssm/${file}`);
        const actual = aws(["ssm", "get-document", "--name", name, "--document-format", "JSON"]);
        assert.equal(actual.DocumentType, "Session");
        assert.equal(actual.Status, "Active");
        assert.equal(canonical(JSON.parse(actual.Content)), canonical(expected), "Fixed SSM document content drift");
        expectedDocuments.set(name, canonical(expected));
      }
    }],
    ["host", () => {
      const discovered = aws(["ec2", "describe-instances", "--filters", "Name=tag:Name,Values=academy-v1-api-development", "Name=tag:Lifecycle,Values=active", "Name=instance-state-name,Values=running"]);
      instance = assertActiveInstance(discovered.Reservations.flatMap((item) => item.Instances), manifest);
      instanceId = instance.InstanceId;
      assert.equal(aws(["ec2", "describe-instance-attribute", "--instance-id", instanceId, "--attribute", "disableApiTermination"]).DisableApiTermination.Value, true);
      const groups = aws(["ec2", "describe-security-groups", "--group-ids", ...instance.SecurityGroups.map((item) => item.GroupId)]).SecurityGroups;
      assert.ok(groups.length > 0 && groups.every((group) => group.IpPermissions.length === 0), "Development ingress must be zero");
    }],
    ["ssm", () => {
      const online = aws(["ssm", "describe-instance-information", "--filters", `Key=InstanceIds,Values=${instanceId}`]).InstanceInformationList;
      assert.equal(online.length, 1);
      assert.equal(online[0].PingStatus, "Online");
    }],
  ], persistEvidence, process.env.GITHUB_SHA);
  const common = { TenantCode: [tenant], OwnershipCapability: [capability],
    ReleaseId: [manifest.releaseImageTag], ApiDigest: [manifest.images["academy-api"].digest] };
  const sessions = new Set();
  const processes = [];
  let operationObservation = null;
  let inspectObservation = null;
  let primaryFailed = false;
  function session(name, parameters = {}) {
    const current = aws(["ssm", "get-document", "--name", name, "--document-format", "JSON"]);
    assert.equal(canonical(JSON.parse(current.Content)), expectedDocuments.get(name), "Fixed document changed before operation");
    const process = ownedProcess("aws", ["ssm", "start-session", "--region", REGION, "--target", instanceId,
      "--document-name", name, "--parameters", JSON.stringify(parameters)], {}, name === PORT_DOCUMENT ? 25 * 60_000 : 240_000);
    processes.push(process);
    return process;
  }
  function remember(process) {
    const match = process.output().match(/Starting session with SessionId:\s*([A-Za-z0-9_.:-]+)/);
    assert.ok(match, "Owned session ID is missing");
    assert.ok(match[1].startsWith("academy-fe-qa-"), "Unexpected session ownership");
    sessions.add(match[1]);
  }
  async function operation(action) {
    const process = session(QA_DOCUMENT, { ...common, Action: [action] });
    const result = await process.done;
    const observed = observeFixedOperationResult(action, result);
    if (action !== "Cleanup" || !primaryFailed) operationObservation = observed.observation;
    remember(process);
    if (action !== "Cleanup") assert.equal(interrupted, false, "Development run interrupted");
    assert.equal(result.code, 0, `Fixed development ${action} command failed`);
    assert.equal(observed.observation.jsonLineCount, 1, "Missing/ambiguous fixed operation readback");
    if (observed.parseError) throw observed.parseError;
    const payload = observed.payload;
    assert.ok(payload, "Missing fixed operation payload");
    assert.notEqual(payload.status, "DEVELOPMENT_QA_FAILED", `Development ${action} boundary failed`);
    assert.equal(payload.tenant_code, tenant);
    return payload;
  }
  let server;
  let setupAttempted = false;
  let cleanup;
  let counts;
  let tests;
  let interrupted = false;
  let finalizing = false;
  const failures = [];
  const interrupt = () => {
    interrupted = true;
    if (!finalizing) {
      tests?.stop();
      for (const process of processes) process.stop();
    }
  };
  const writeEvidence = (passed, errors = failures, terminalOutcome = "qa_running") => {
    Object.assign(evidence, { frontendSha: process.env.GITHUB_SHA, backendGovernanceSha: revision,
      backendReleaseId: manifest.releaseImageTag, apiDigest: manifest.images["academy-api"].digest,
      instanceId, tenantCode: tenant, artifactSha256: fingerprint, cases: counts || null,
      documentSha256: Object.fromEntries([...expectedDocuments].map(([name, content]) => [name, sha(content)])),
      cleanup: cleanup ? { tenantCode: tenant, remaining: cleanup.remaining } : null,
      operationObservation, inspectObservation,
      terminalOutcome, passed, failures: errors });
    persistEvidence(evidence);
    return evidence;
  };
  // A killed/lost runner cannot turn an unfinished attempt into cleanup success.
  writeEvidence(false, ["development attempt unfinished; cleanup not proven"]);
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    await assertFreePort(18000);
    await assertFreePort(4173);
    const inspected = await operation("Inspect");
    inspectObservation = inspectMatchObservation(inspected, manifest);
    assert.equal(inspected.status, "DEVELOPMENT_QA_IDENTITY_PASS");
    assert.deepEqual(inspected.remaining, { tenants: 0, users: 0 }, "Never reuse an existing QA tenant");
    assert.equal(inspected.release_id, manifest.releaseImageTag);
    assert.equal(inspected.digest, manifest.images["academy-api"].digest);
    setupAttempted = true;
    assert.equal((await operation("Setup")).status, "YMATH_REALUSE_SCENARIO_READY");
    const tunnel = session(PORT_DOCUMENT);
    await waitPort(18000, () => interrupted);
    remember(tunnel);
    server = await serveArtifact(path.join(bundle, "dist"));
    const secret = aws(["ssm", "get-parameter", "--name", PASSWORD_PARAMETER, "--with-decryption"]);
    assert.equal(secret.Parameter.Name, PASSWORD_PARAMETER);
    assert.ok(secret.Parameter.Value);
    assert.equal(interrupted, false, "Development run interrupted");
    tests = ownedProcess(process.execPath, [path.join(ROOT, "node_modules/@playwright/test/cli.js"), "test", "--config=playwright.development-release.config.ts"], {
      env: { ...process.env, E2E_BASE_URL: WEB_ORIGIN, E2E_API_URL: API_ORIGIN, API_BASE_URL: API_ORIGIN,
        E2E_RELEASE_API_MODE: "development", E2E_ALLOW_PRODUCTION_WRITES: "0", E2E_STRICT: "strict",
        E2E_TENANT_CODE: tenant, E2E_ADMIN_USER: "ymath-qa-teacher", E2E_STUDENT_USER: "ymath-qa-student-01",
        E2E_ADMIN_PASS: secret.Parameter.Value, E2E_STUDENT_PASS: secret.Parameter.Value },
    }, 20 * 60_000);
    const result = await tests.done;
    assert.equal(result.code, 0, "Required development real-use failed (raw credential-bearing report is not published)");
    counts = assertReleaseSummary(JSON.parse(result.stdout));
  } catch { primaryFailed = true; failures.push("development identity/setup/real-use failed"); }
  finally {
    finalizing = true;
    // No test process may still mutate the scenario while Cleanup is running.
    if (tests) { tests.stop(); await tests.done; }
    if (interrupted) failures.push("development run interrupted; promotion forbidden");
    if (setupAttempted) {
      try { cleanup = await operation("Cleanup"); assertCleanup(cleanup, tenant); }
      catch { failures.push("development cleanup failed or zero residue not proven"); }
    }
    for (const process of processes) {
      try { remember(process); } catch { failures.push("session ownership readback failed"); }
      process.stop();
      await process.done;
    }
    for (const sessionId of sessions) {
      try {
        const filters = ["--filters", `key=SessionId,value=${sessionId}`];
        if (aws(["ssm", "describe-sessions", "--state", "Active", ...filters]).Sessions.length) {
          assert.equal(aws(["ssm", "terminate-session", "--session-id", sessionId]).SessionId, sessionId);
        }
        let terminated = false;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const active = aws(["ssm", "describe-sessions", "--state", "Active", ...filters]).Sessions;
          const history = aws(["ssm", "describe-sessions", "--state", "History", ...filters]).Sessions;
          if (active.length === 0 && history.length === 1 && history[0].Status === "Terminated") { terminated = true; break; }
          await delay(1_000);
        }
        assert.equal(terminated, true, "Owned session termination readback missing");
      } catch { failures.push("owned SSM session cleanup not proven"); }
    }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    try { if (artifactFingerprint(bundle) !== fingerprint) failures.push("deployment artifact changed during QA"); }
    catch { failures.push("deployment artifact final readback failed"); }
    if (interrupted && !failures.some((failure) => failure.includes("interrupted"))) failures.push("development run interrupted; promotion forbidden");
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    const passed = failures.length === 0 && Boolean(counts) && Boolean(cleanup);
    const resultEvidence = writeEvidence(passed, failures, passed ? "passed" : "qa_failed");
    assert.equal(resultEvidence.passed, true, "Development release gate failed; see PII-free evidence");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(() => { console.error("Development release gate failed closed; no production promotion authorized."); process.exitCode = 1; });
}
