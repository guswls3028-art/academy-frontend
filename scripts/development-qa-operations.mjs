import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Budget units are explicitly approved analysis dispatches, not HTTP retries
// inside a provider. Each allowed operation is consumed before its API request.
export function reserveQaDispatch(planFile, operation, binding) {
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  assert.equal(plan.schema, "development-qa-dispatch-plan/v1");
  assert.deepEqual(plan.binding, binding, "QA dispatch candidate/tenant/fixtures changed");
  assert.ok(Number.isSafeInteger(plan.limit) && plan.limit > 0);
  assert.ok(Array.isArray(plan.operations) && plan.operations.length <= plan.limit);
  assert.equal(new Set(plan.operations).size, plan.operations.length);
  assert.ok(plan.operations.every((name) => typeof name === "string" && /^[a-z0-9-]{1,64}$/.test(name)));
  assert.ok(plan.operations.includes(operation), "Dispatch is outside the approved QA plan");
  const directory = `${planFile}.attempts`;
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
  // An existing marker means uncertain or completed, never permission to retry.
  const descriptor = fs.openSync(path.join(directory, `${operation}.json`), "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify({ operation, binding, attempted: true }) + "\n");
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  return { operation, attempted: true };
}

export function writeQaCheckpoint(file, value) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + "\n");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
  }
}

// A checkpoint contains identity/attempt metadata only. Credentials, command
// parameters and the Setup payload remain in the runner's memory.
export function createFixedQaRunner({ common, session, checkpoint, remember,
  interrupted = () => false, observe = () => {}, previous = null }) {
  common = structuredClone(common);
  const tenant = common.TenantCode?.[0];
  assert.match(tenant || "", /^qa-[a-z0-9-]+$/);
  assert.match(common.OwnershipCapability?.[0] || "", /^[a-f0-9]{64}$/);
  const binding = {
    tenant, releaseId: common.ReleaseId?.[0], apiDigest: common.ApiDigest?.[0],
    capabilitySha256: crypto.createHash("sha256").update(common.OwnershipCapability[0]).digest("hex"),
  };
  assert.ok(binding.releaseId && binding.apiDigest, "Candidate identity is required");
  let state = { schema: "development-qa-operations/v1", binding, setupAttempted: false,
    tenantId: null, attempts: [] };
  if (previous) {
    assert.equal(previous.schema, state.schema);
    assert.deepEqual(previous.binding, binding, "Cannot adopt another QA run or candidate");
    assert.equal(typeof previous.setupAttempted, "boolean");
    assert.ok(previous.tenantId === null || Number.isSafeInteger(previous.tenantId) && previous.tenantId > 0);
    assert.ok(Array.isArray(previous.attempts));
    state = structuredClone(previous);
  }
  const snapshot = () => structuredClone(state);
  let busy = false;
  async function run(action, tenantId, { videoId, context } = {}) {
    assert.equal(busy, false, "QA operations must be sequential for one tenant");
    const parameters = fixedOperationParameters(common, action, tenantId, videoId);
    if (action === "Setup") assert.equal(state.setupAttempted, false, "Setup was already attempted; inspect its outcome");
    if (action === "Cleanup") assert.equal(tenantId, state.tenantId, "Cleanup requires this run's captured Setup identity");
    if (state.tenantId !== null && tenantId !== undefined) assert.equal(tenantId, state.tenantId);
    if (action === "Setup") assert.equal(interrupted(), false, "Development run interrupted");
    busy = true;
    const attempt = { action, tenantId: tenantId ?? null, phase: "attempted", observation: null };
    if (action === "Setup") state.setupAttempted = true;
    state.attempts.push(attempt);
    try {
      // Persist intent before sending. A lost reply is never permission to send
      // Setup again, including after restoring the same checkpoint.
      await checkpoint(snapshot());
      const task = session(parameters);
      const result = await task.done;
      const observed = observeFixedOperationResult(action, result);
      const captured = setupTenantIdFromOperation(action, observed, tenant);
      if (captured !== null) state.tenantId = captured;
      attempt.observation = observed.observation;
      attempt.phase = "observed";
      await checkpoint(snapshot());
      // Capture a valid Setup identity even when the process or session fails,
      // so the owning caller can inspect and clean up the exact partial result.
      await observe({ action, observed, tenantId: state.tenantId, context });
      await remember(task);
      assert.equal(result.code, 0, `Fixed development ${action} command failed`);
      assert.equal(observed.observation.jsonLineCount, 1, "Missing/ambiguous fixed operation readback");
      assert.equal(observed.parseError, null, "Invalid fixed operation JSON");
      const payload = observed.payload;
      assert.ok(payload && payload.status !== "DEVELOPMENT_QA_FAILED", `Development ${action} boundary failed`);
      assert.equal(payload.tenant_code, tenant);
      const statuses = { Inspect: ["DEVELOPMENT_QA_IDENTITY_PASS"], Setup: ["YMATH_REALUSE_SCENARIO_READY"],
        Cleanup: ["YMATH_REALUSE_SCENARIO_DESTROYED", "YMATH_REALUSE_SCENARIO_ABSENT"] };
      assert.ok(statuses[action].includes(payload.status), "Unexpected fixed operation status");
      if (tenantId !== undefined) assert.equal(payload.tenant_id, tenantId, "Fixed operation target changed");
      if (action === "Setup") assert.ok(state.tenantId !== null, "Setup identity is missing");
      if (action === "Setup") assert.equal(interrupted(), false, "Development run interrupted");
      attempt.phase = "completed";
      await checkpoint(snapshot());
      return payload;
    } catch (error) {
      attempt.phase = "failed";
      await checkpoint(snapshot());
      throw error;
    } finally { busy = false; }
  }
  return { run, snapshot };
}

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
const FIXED_FAILURE_STAGES = new Set([
  "bootstrap", "identity", "inspect_database", "inspect_residue", "setup_database", "setup_readback",
  "cleanup_identity", "cleanup_absent_readback", "cleanup_r2", "cleanup_database", "cleanup_readback", "unknown",
  "cleanup_ai", "inspect_ai",
]);
const FIXED_RESIDUE_FIELDS = [
  "activity_audits", "outstanding_tokens", "listeners", "processes", "r2_objects",
  "ai_jobs", "ai_results", "ai_redis_keys",
];

export function observeFixedOperationResult(action, result) {
  const stdout = typeof result?.stdout === "string" ? result.stdout : "";
  const jsonLines = stdout.split(/\r?\n/).filter((line) => line.trim().startsWith("{"));
  let payload = null;
  let parseError = null;
  if (jsonLines.length === 1) {
    try { payload = JSON.parse(jsonLines[0]); }
    catch (error) { parseError = error; }
  }
  const failure = (() => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || Object.keys(payload).sort().join(",") !== "error_type,failure_stage,residue,status,tenant_id"
      || payload.status !== "DEVELOPMENT_QA_FAILED"
      || typeof payload.error_type !== "string" || payload.error_type.length === 0
      || !FIXED_FAILURE_STAGES.has(payload.failure_stage)
      || !Number.isSafeInteger(payload.tenant_id) || payload.tenant_id < 0
      || !payload.residue || typeof payload.residue !== "object" || Array.isArray(payload.residue)
      || Object.keys(payload.residue).sort().join(",") !== [...FIXED_RESIDUE_FIELDS].sort().join(",")
      || FIXED_RESIDUE_FIELDS.some((key) => !Number.isSafeInteger(payload.residue[key]) || payload.residue[key] < 0)) {
      return null;
    }
    return {
      failureStage: payload.failure_stage,
      tenantId: payload.tenant_id,
      residue: Object.fromEntries(FIXED_RESIDUE_FIELDS.map((key) => [key, payload.residue[key]])),
      errorType: FIXED_ERROR_TYPES.has(payload.error_type) ? payload.error_type : "OtherError",
    };
  })();
  const payloadStatus = payload?.status === "DEVELOPMENT_QA_FAILED"
    ? (failure ? payload.status : null)
    : (FIXED_STATUSES.has(payload?.status) ? payload.status : null);
  return {
    observation: {
      action: FIXED_ACTIONS.has(action) ? action : null,
      exitCode: Number.isInteger(result?.code) && result.code >= -1 && result.code <= 255 ? result.code : null,
      jsonLineCount: jsonLines.length,
      sessionIdObserved: /Starting session with SessionId:\s*[A-Za-z0-9_.:-]+/.test(stdout),
      payloadStatus,
      errorType: failure?.errorType ?? null,
      failureStage: failure?.failureStage ?? null,
      tenantId: failure?.tenantId ?? null,
      residue: failure?.residue ?? null,
    },
    payload,
    parseError,
  };
}

export function setupTenantIdFromOperation(action, observed, tenantCode) {
  if (action !== "Setup") return null;
  const failedTenantId = observed?.observation?.tenantId;
  if (observed?.observation?.payloadStatus === "DEVELOPMENT_QA_FAILED"
    && Number.isSafeInteger(failedTenantId) && failedTenantId > 0) {
    return failedTenantId;
  }
  const successfulTenantId = observed?.payload?.tenant_id;
  return observed?.payload?.status === "YMATH_REALUSE_SCENARIO_READY"
    && observed.payload.tenant_code === tenantCode
    && Number.isSafeInteger(successfulTenantId) && successfulTenantId > 0
    ? successfulTenantId : null;
}


export function fixedOperationParameters(common, action, tenantId, videoId) {
  assert.ok(FIXED_ACTIONS.has(action), "Unsupported fixed development action");
  const hasTenantId = tenantId !== undefined;
  if (action === "Setup") assert.equal(hasTenantId, false, "Setup must not receive TenantId");
  if (action === "Cleanup") assert.equal(hasTenantId, true, "Cleanup requires the exact Setup TenantId");
  if (hasTenantId) assert.ok(Number.isSafeInteger(tenantId) && tenantId > 0, "TenantId must be a positive integer");
  const hasVideoId = videoId !== undefined;
  if (hasVideoId) {
    assert.equal(action, "Inspect", "VideoId is only permitted for post-playback Inspect");
    assert.equal(hasTenantId, true, "VideoId requires the exact Setup TenantId");
    assert.deepEqual(common.SyntheticLongVideo, ["true"], "VideoId requires the synthetic long-video fixture");
    assert.ok(Number.isSafeInteger(videoId) && videoId > 0, "VideoId must be a positive integer");
  }
  return { ...common, Action: [action], ...(hasTenantId ? { TenantId: [String(tenantId)] } : {}),
    ...(hasVideoId ? { VideoId: [String(videoId)] } : {}) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 6);
    assert.equal(process.argv[2], "--reserve");
    reserveQaDispatch(process.argv[3], process.argv[4], JSON.parse(process.argv[5]));
  } catch {
    console.error("QA dispatch refused; inspect the candidate-bound plan and existing attempt marker.");
    process.exitCode = 1;
  }
}

