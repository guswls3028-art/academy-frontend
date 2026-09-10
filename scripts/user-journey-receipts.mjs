import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REPOSITORY = "guswls3028-art/academy-frontend";
export const MACHINE_KIND = "academy.user-journey-machine-result";
export const RECEIPT_KIND = "academy.user-journey-receipt";
export const PRODUCER = "academy-user-journey-receipt/v1";

const VIEWPORT_WIDTHS = new Map([["desktop-1366", 1366], ["mobile-390", 390]]);
const CLEANUP_KEYS = new Set(["tenants", "users", "rows", "queue_items", "objects", "preview_tokens", "provider_requests"]);
const WORKER_KEYS = new Set(["messaging", "ai", "tools", "video"]);
const TOP_LEVEL_KEYS = new Set([
  "schema_version", "kind", "producer", "journey_id", "repository", "head_sha", "contract_sha256",
  "ci", "artifacts", "environment", "actor", "actions", "persistence", "reload", "projections",
  "viewports", "test_provenance", "notification_intent", "provider_dispatch", "cleanup", "generated_at", "expires_at",
]);
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const HASH = /^[0-9a-f]{64}$/;
const PLACEHOLDER = /(?:^|[-_])(todo|tbd|n\/?a|skip(?:ped)?|guard|blocked)(?:$|[-_])/i;

export class ReceiptError extends Error {}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashBytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashFile(file) {
  return hashBytes(fs.readFileSync(file));
}

export function journeyContractSha256(journey) {
  return hashBytes(canonical(journey));
}

function sameKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReceiptError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonical(actual) !== canonical(wanted)) throw new ReceiptError(`${label} must contain exactly: ${wanted.join(", ")}`);
  return value;
}

function relativeFile(root, relative, label) {
  if (typeof relative !== "string" || !relative || relative.trim() !== relative || relative.includes("\\")) {
    throw new ReceiptError(`${label} must be a normalized repository-relative path`);
  }
  const candidate = path.resolve(root, relative);
  const relation = path.relative(root, candidate);
  if (relation.startsWith("..") || path.isAbsolute(relation)) throw new ReceiptError(`${label} escapes the repository: ${relative}`);
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) throw new ReceiptError(`${label} does not exist: ${relative}`);
  return candidate;
}

function parseTime(value, label) {
  if (typeof value !== "string" || !value.endsWith("Z")) throw new ReceiptError(`${label} must be an ISO-8601 UTC timestamp`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new ReceiptError(`${label} must be an ISO-8601 UTC timestamp`);
  return parsed;
}

function validateCi(ci, expected) {
  sameKeys(ci, new Set(["provider", "event_name", "run_id", "run_attempt", "workflow_ref"]), "ci identity");
  if (ci.provider !== "github_actions") throw new ReceiptError("receipt provider must be github_actions");
  if (!["pull_request", "push", "workflow_dispatch"].includes(ci.event_name)) throw new ReceiptError("receipt event_name is unsupported");
  for (const key of ["event_name", "run_id", "run_attempt", "workflow_ref"]) {
    if (String(ci[key]) !== String(expected[key] ?? "")) throw new ReceiptError(`receipt ci ${key} does not match the current machine run`);
  }
  if (!/\.github\/workflows\/(quality-gate|user-journey-receipt)\.yml@/.test(String(ci.workflow_ref))) {
    throw new ReceiptError("receipt workflow_ref must identify a trusted journey workflow");
  }
}

function validateArtifacts(artifacts, expectedHead) {
  sameKeys(artifacts, new Set(["backend", "frontend", "workers"]), "artifact identities");
  const backend = sameKeys(artifacts.backend, new Set(["repository_sha", "api_digest"]), "backend artifact");
  const frontend = sameKeys(artifacts.frontend, new Set(["repository_sha", "bundle_sha256"]), "frontend artifact");
  if (frontend.repository_sha !== expectedHead) throw new ReceiptError("receipt frontend artifact does not match the exact repository head");
  if (!SHA.test(String(backend.repository_sha))) throw new ReceiptError("backend repository SHA is invalid");
  if (!DIGEST.test(String(backend.api_digest))) throw new ReceiptError("backend API digest is invalid");
  if (!HASH.test(String(frontend.bundle_sha256))) throw new ReceiptError("frontend bundle hash is invalid");
  sameKeys(artifacts.workers, WORKER_KEYS, "worker identities");
  for (const [name, worker] of Object.entries(artifacts.workers)) {
    sameKeys(worker, new Set(["repository_sha", "digest"]), `${name} worker artifact`);
    if (worker.repository_sha !== backend.repository_sha) throw new ReceiptError(`${name} worker is cross-SHA`);
    if (!DIGEST.test(String(worker.digest))) throw new ReceiptError(`${name} worker digest is invalid`);
  }
}

function collectPlaywrightTests(suite, sourcePath, matching, all) {
  for (const spec of suite.specs ?? []) {
    const file = String(spec.file ?? "").replaceAll("\\", "/");
    const tests = spec.tests ?? [];
    all.push(...tests);
    if (file === sourcePath || file.endsWith(`/${sourcePath}`)) matching.push(...tests);
  }
  for (const child of suite.suites ?? []) collectPlaywrightTests(child, sourcePath, matching, all);
}

function validatePlaywright(reportPath, sourcePath) {
  let report;
  try { report = JSON.parse(fs.readFileSync(reportPath, "utf8")); }
  catch { throw new ReceiptError(`Playwright report is not valid JSON: ${reportPath}`); }
  if (Array.isArray(report.errors) && report.errors.length) throw new ReceiptError(`Playwright report has global errors: ${reportPath}`);
  const matching = [];
  const all = [];
  for (const suite of report.suites ?? []) collectPlaywrightTests(suite, sourcePath, matching, all);
  if (!matching.length) throw new ReceiptError(`Playwright report does not identify registered source ${sourcePath}`);
  for (const test of all) {
    const results = test.results ?? [];
    if (test.expectedStatus !== "passed" || test.status !== "expected" || results.length !== 1 || results[0].status !== "passed" || (results[0].retry ?? 0) !== 0) {
      throw new ReceiptError(`Playwright report must contain only passed, non-skipped, non-flaky tests: ${reportPath}`);
    }
  }
}

function validateResultFiles(payload, journey, root, issuing) {
  const known = new Set(journey.executable_evidence.map((item) => `${item.path}\0${item.runner}`));
  if (!Array.isArray(payload.test_provenance)) throw new ReceiptError("test_provenance must be a list");
  const actual = new Set(payload.test_provenance.map((item) => `${item?.source_path}\0${item?.runner}`));
  if (actual.size !== payload.test_provenance.length || canonical([...actual].sort()) !== canonical([...known].sort())) {
    throw new ReceiptError("test provenance must cover every registered evidence source and runner exactly once");
  }
  for (const item of payload.test_provenance) {
    sameKeys(item, new Set(["source_path", "runner", "report_path", "report_sha256", "result"]), "test provenance entry");
    if (item.result !== "passed") throw new ReceiptError("test provenance cannot use skipped, flaky, denied-only, or failed results");
    const reportPath = relativeFile(root, item.report_path, "test result report");
    validatePlaywright(reportPath, item.source_path);
    const actualHash = hashFile(reportPath);
    if (issuing) item.report_sha256 = actualHash;
    else if (item.report_sha256 !== actualHash) throw new ReceiptError(`test result report hash mismatch: ${item.report_path}`);
  }

  if (!Array.isArray(payload.viewports) || payload.viewports.length !== VIEWPORT_WIDTHS.size) {
    throw new ReceiptError("desktop-1366 and mobile-390 viewport evidence are both required");
  }
  const byId = new Map(payload.viewports.map((item) => [item?.id, item]));
  if (byId.size !== payload.viewports.length || canonical([...byId.keys()].sort()) !== canonical([...journey.required_viewports].sort())) {
    throw new ReceiptError("viewport evidence must cover each registered viewport exactly once");
  }
  if (new Set(payload.viewports.map((item) => item?.artifact_path)).size !== payload.viewports.length) {
    throw new ReceiptError("viewport artifacts must be distinct");
  }
  for (const [id, width] of VIEWPORT_WIDTHS) {
    const item = sameKeys(byId.get(id), new Set(["id", "width", "browser", "artifact_path", "artifact_sha256", "result"]), `${id} evidence`);
    if (item.width !== width || item.browser !== "chromium" || item.result !== "passed") throw new ReceiptError(`${id} evidence identity/result is invalid`);
    const artifact = relativeFile(root, item.artifact_path, `${id} artifact`);
    const actualHash = hashFile(artifact);
    if (issuing) item.artifact_sha256 = actualHash;
    else if (item.artifact_sha256 !== actualHash) throw new ReceiptError(`${id} artifact hash mismatch`);
  }
}

function validateActions(payload, journey) {
  const required = journey.receipt_policy.required_cases;
  const key = (item) => `${item?.case_id}\0${item?.kind}\0${item?.actor}\0${item?.outcome_code}`;
  if (!Array.isArray(payload.actions)) throw new ReceiptError("actions must be a list");
  const actual = new Set(payload.actions.map(key));
  const expected = new Set(required.map(key));
  if (actual.size !== payload.actions.length || canonical([...actual].sort()) !== canonical([...expected].sort())) {
    throw new ReceiptError("receipt actions do not exactly cover the registered valid and invalid cases");
  }
  for (const action of payload.actions) {
    sameKeys(action, new Set(["case_id", "kind", "actor", "outcome_code", "mutation_delta", "provider_attempt_delta", "correlation_sha256", "result"]), "action");
    if (action.result !== "passed" || !HASH.test(String(action.correlation_sha256))) throw new ReceiptError("action result or correlation hash is invalid");
    if (!Number.isInteger(action.mutation_delta) || !Number.isInteger(action.provider_attempt_delta)) throw new ReceiptError("action deltas must be integers");
    if (action.kind === "valid" && action.mutation_delta < 1) throw new ReceiptError("positive action must prove a product mutation");
    if (action.kind === "invalid" && action.mutation_delta !== 0) throw new ReceiptError("invalid action must prove zero adjacent mutation");
    if (action.provider_attempt_delta !== 0) throw new ReceiptError("synthetic action must prove zero provider attempts");
  }
}

function validateOutcomes(payload, journey) {
  const persistence = sameKeys(payload.persistence, new Set(["assertion_id", "write_count", "outcome_sha256", "result"]), "persistence assertion");
  const reload = sameKeys(payload.reload, new Set(["assertion_id", "fresh_auth_session", "outcome_sha256", "result"]), "reload assertion");
  if (persistence.assertion_id !== "persisted-outcome" || !Number.isInteger(persistence.write_count) || persistence.write_count < 1 || persistence.result !== "passed" || !HASH.test(String(persistence.outcome_sha256))) {
    throw new ReceiptError("positive persisted outcome is invalid");
  }
  if (reload.assertion_id !== "fresh-session-reload" || reload.fresh_auth_session !== true || reload.result !== "passed" || reload.outcome_sha256 !== persistence.outcome_sha256) {
    throw new ReceiptError("reload must prove the identical persisted outcome in a fresh auth session");
  }
  const key = (item) => `${item?.projection_id}\0${item?.audience}`;
  if (!Array.isArray(payload.projections)) throw new ReceiptError("projections must be a list");
  const actual = new Set(payload.projections.map(key));
  const expected = new Set(journey.receipt_policy.required_projections.map(key));
  if (actual.size !== payload.projections.length || canonical([...actual].sort()) !== canonical([...expected].sort())) {
    throw new ReceiptError("downstream projections do not cover the registered audiences exactly");
  }
  for (const projection of payload.projections) {
    sameKeys(projection, new Set(["projection_id", "audience", "outcome_sha256", "result"]), "projection");
    if (projection.result !== "passed" || !HASH.test(String(projection.outcome_sha256))) throw new ReceiptError("downstream projection result is invalid");
  }
}

function validateProviderAndCleanup(payload, journey, generated, now) {
  const intent = sameKeys(payload.notification_intent, new Set(["selected_recipient_count", "persisted_request_count", "unselected_request_count", "result"]), "notification intent");
  const intentCounts = [intent.selected_recipient_count, intent.persisted_request_count, intent.unselected_request_count];
  const mode = journey.receipt_policy.notification_mode;
  const validIntent = {
    explicit_recipients: intentCounts[0] >= 1 && intentCounts[1] === intentCounts[0] && intentCounts[2] === 0,
    no_notification: intentCounts.every((value) => value === 0),
    separate_optional: intentCounts[0] >= 0 && intentCounts[1] === intentCounts[0] && intentCounts[2] === 0,
  }[mode];
  if (!intentCounts.every(Number.isInteger) || !validIntent || intent.result !== "passed") {
    throw new ReceiptError("notification intent must prove only the explicitly selected recipients");
  }
  const provider = sameKeys(payload.provider_dispatch, new Set([
    "policy", "mode_readback", "alimtalk_attempt_count", "sms_attempt_count", "lms_attempt_count",
    "provider_message_id_count", "network_dispatch_count", "result",
  ]), "provider dispatch readback");
  const providerCounts = [provider.alimtalk_attempt_count, provider.sms_attempt_count, provider.lms_attempt_count, provider.provider_message_id_count, provider.network_dispatch_count];
  if (provider.policy !== "disabled_in_synthetic_qa" || provider.mode_readback !== "disabled" || provider.result !== "passed" || !providerCounts.every((value) => Number.isInteger(value) && value === 0)) {
    throw new ReceiptError("provider dispatch must be disabled with exact zero attempts, IDs, and network sends");
  }
  const cleanup = sameKeys(payload.cleanup, new Set(["completed_at", "residue", "result"]), "cleanup");
  sameKeys(cleanup.residue, CLEANUP_KEYS, "cleanup residue");
  const completed = parseTime(cleanup.completed_at, "cleanup.completed_at");
  if (cleanup.result !== "passed" || completed < generated || completed > new Date(now.getTime() + 5 * 60_000) || !Object.values(cleanup.residue).every((value) => Number.isInteger(value) && value === 0)) {
    throw new ReceiptError("cleanup residue must be numeric zero after all assertions");
  }
}

function validatePayload(payload, registry, root, expectedHead, ciContext, now, issuing) {
  const expectedKeys = issuing ? TOP_LEVEL_KEYS : new Set([...TOP_LEVEL_KEYS, "receipt_sha256"]);
  sameKeys(payload, expectedKeys, "journey receipt");
  const expectedKind = issuing ? MACHINE_KIND : RECEIPT_KIND;
  if (payload.schema_version !== 1 || payload.kind !== expectedKind || payload.producer !== PRODUCER) throw new ReceiptError(`receipt kind/producer must be ${expectedKind} and ${PRODUCER}`);
  if (payload.repository !== REPOSITORY || payload.head_sha !== expectedHead) throw new ReceiptError("receipt repository/head SHA does not match the exact checked out commit");
  const journey = registry.journeys.find((item) => item.id === payload.journey_id);
  if (!journey) throw new ReceiptError("receipt journey is not registered");
  if (payload.contract_sha256 !== journeyContractSha256(journey)) throw new ReceiptError("receipt registry contract hash does not match the exact journey definition");
  validateCi(payload.ci, ciContext);
  validateArtifacts(payload.artifacts, expectedHead);
  const environment = sameKeys(payload.environment, new Set(["name", "release_id", "deployment_id", "api_instance_id"]), "environment identity");
  if (environment.name !== "persistent-development" || ![environment.release_id, environment.deployment_id, environment.api_instance_id]
    .every((value) => typeof value === "string" && value.trim().length >= 8 && !PLACEHOLDER.test(value.trim()))) {
    throw new ReceiptError("receipt must identify the persistent-development release and deployment");
  }
  const actor = sameKeys(payload.actor, new Set(["role", "subject_sha256"]), "actor identity");
  if (!journey.actors.includes(actor.role) || !HASH.test(String(actor.subject_sha256))) throw new ReceiptError("actor role or PII-free subject fingerprint is invalid");
  const generated = parseTime(payload.generated_at, "generated_at");
  const expires = parseTime(payload.expires_at, "expires_at");
  if (generated > new Date(now.getTime() + 5 * 60_000) || expires <= now || expires <= generated || expires - generated > journey.receipt_policy.ttl_seconds * 1000) {
    throw new ReceiptError("receipt timestamp is future, stale, expired, or has an excessive lifetime");
  }
  validateActions(payload, journey);
  validateOutcomes(payload, journey);
  validateResultFiles(payload, journey, root, issuing);
  validateProviderAndCleanup(payload, journey, generated, now);
}

export function issueReceipt(machineResult, registry, root, expectedHead, ciContext, now) {
  const receipt = structuredClone(machineResult);
  validatePayload(receipt, registry, root, expectedHead, ciContext, now, true);
  receipt.kind = RECEIPT_KIND;
  receipt.receipt_sha256 = hashBytes(canonical(receipt));
  return receipt;
}

export function validateReceipt(receipt, registry, root, expectedHead, ciContext, now) {
  validatePayload(receipt, registry, root, expectedHead, ciContext, now, false);
  const unsigned = structuredClone(receipt);
  delete unsigned.receipt_sha256;
  if (!HASH.test(String(receipt.receipt_sha256)) || receipt.receipt_sha256 !== hashBytes(canonical(unsigned))) throw new ReceiptError("receipt_sha256 does not match the canonical receipt");
  return receipt.journey_id;
}

export function currentCiContext(env = process.env) {
  if (env.GITHUB_ACTIONS !== "true") throw new ReceiptError("journey receipts can only be issued or verified in official GitHub Actions");
  return { event_name: env.GITHUB_EVENT_NAME ?? "", run_id: env.GITHUB_RUN_ID ?? "", run_attempt: env.GITHUB_RUN_ATTEMPT ?? "", workflow_ref: env.GITHUB_WORKFLOW_REF ?? "" };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main() {
  const action = process.argv[2];
  assert.ok(["issue", "verify"].includes(action), "action must be issue or verify");
  const root = path.resolve(argument("--root") ?? path.dirname(fileURLToPath(import.meta.url)), argument("--root") ? "." : "..");
  const registryPath = argument("--registry") ?? "scripts/user-journey-registry.json";
  const registry = JSON.parse(fs.readFileSync(path.join(root, registryPath), "utf8"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const context = currentCiContext();
  const now = new Date();
  if (action === "issue") {
    const sourcePath = argument("--machine-result");
    const outputPath = argument("--output");
    if (!sourcePath || !outputPath) throw new ReceiptError("issue requires --machine-result and --output");
    const source = JSON.parse(fs.readFileSync(relativeFile(root, sourcePath, "machine result"), "utf8"));
    const receipt = issueReceipt(source, registry, root, head, context, now);
    const output = path.resolve(root, outputPath);
    const relation = path.relative(root, output);
    if (relation.startsWith("..") || path.isAbsolute(relation)) throw new ReceiptError("output path escapes the repository");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(`USER_JOURNEY_RECEIPT_ISSUED journey=${receipt.journey_id} path=${outputPath}`);
  } else {
    const receiptPath = argument("--receipt");
    if (!receiptPath) throw new ReceiptError("verify requires --receipt");
    const receipt = JSON.parse(fs.readFileSync(relativeFile(root, receiptPath, "receipt"), "utf8"));
    console.log(`USER_JOURNEY_RECEIPT_PASS journey=${validateReceipt(receipt, registry, root, head, context, now)}`);
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`USER_JOURNEY_RECEIPT_FAIL ${error.message}`); process.exitCode = 1; }
}
