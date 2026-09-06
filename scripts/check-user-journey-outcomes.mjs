import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { controlledWriteSpecs, routeMockSpecs } from "../e2e/suites.mjs";
import { ReceiptError, currentCiContext, validateReceipt } from "./user-journey-receipts.mjs";

export const MARKER = "<!-- academy-user-journey-evidence-v1 -->";
const CORE_JOURNEY_IDS = new Set([
  "score-result-messaging",
  "omr-manual-descriptive",
  "clinic-state",
  "messaging-template-recipient-log",
]);
const CANONICAL_ROLES = new Set(["owner", "admin", "teacher", "staff", "student", "parent"]);
const PROTECTED_RECEIPT_PATHS = new Set([
  ".github/workflows/quality-gate.yml",
  "scripts/check-user-journey-outcomes.mjs",
  "scripts/user-journey-receipts.mjs",
  "scripts/user-journey-registry.json",
]);
const REQUIRED_FIELDS = [
  "start_state",
  "valid_action",
  "invalid_case",
  "persisted_outcome",
  "reload_assertion",
  "notification_intent",
  "cleanup_assertion",
];
const POSITIVE_FIELDS = ["valid_action", "persisted_outcome", "reload_assertion"];
const PR_FIELDS = new Map([
  ["Positive action", "positive_action"],
  ["Persisted outcome", "persisted_outcome"],
  ["Reload persistence", "reload_persistence"],
  ["Downstream projection", "downstream_projection"],
  ["Actors", "actors"],
  ["Projection audiences", "projection_audiences"],
  ["Role outcomes", "role_outcomes"],
  ["Viewports", "viewports"],
  ["Executable evidence", "executable_evidence"],
  ["Invalid case", "invalid_case"],
  ["Notification intent", "notification_intent"],
  ["Provider sends", "provider_sends"],
  ["Cleanup", "cleanup"],
]);

export class RegistryError extends Error {}

function isPositive(value) {
  if (typeof value !== "string" || value.trim().length < 8) return false;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (new Set([
    "n/a",
    "none",
    "guard",
    "guard only",
    "denied only",
    "blocked only",
    "not applicable",
    "skip",
    "skipped",
  ]).has(normalized)) return false;
  return !/\b(todo|tbd|guard only|denied only|blocked only|not applicable|skipped?)\b/.test(normalized);
}

function requireLocalFile(root, relative, label) {
  if (typeof relative !== "string" || relative.trim() === "") {
    throw new RegistryError(`${label} must be a non-empty repository-relative path`);
  }
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(root, relative);
  const inside = path.relative(resolvedRoot, candidate);
  if (inside.startsWith("..") || path.isAbsolute(inside)) {
    throw new RegistryError(`${label} escapes the repository: ${relative}`);
  }
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) {
    throw new RegistryError(`${label} does not exist: ${relative}`);
  }
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "ignore" });
  } catch {
    return;
  }
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", relative], { cwd: root, stdio: "ignore" });
  } catch {
    throw new RegistryError(`${label} is not tracked by Git: ${relative}`);
  }
}

function validPattern(value) {
  return typeof value === "string"
    && value.length > 0
    && value === value.trim()
    && !value.includes("\\")
    && !value.startsWith("./");
}

export function validateRegistry(registry, root) {
  if (!registry || typeof registry !== "object" || registry.schema_version !== 1) {
    throw new RegistryError("registry schema_version must be 1");
  }
  if (!Array.isArray(registry.journeys) || registry.journeys.length === 0) {
    throw new RegistryError("registry journeys must be a non-empty list");
  }
  const seen = new Set();
  for (const journey of registry.journeys) {
    if (!journey || typeof journey !== "object") throw new RegistryError("each journey must be an object");
    if (typeof journey.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(journey.id)) {
      throw new RegistryError(`invalid journey id: ${String(journey.id)}`);
    }
    if (seen.has(journey.id)) throw new RegistryError(`duplicate journey id: ${journey.id}`);
    seen.add(journey.id);
    if (!["generally_available", "beta"].includes(journey.availability)) {
      throw new RegistryError(`${journey.id}: invalid availability`);
    }
    if (!["gap", "sealed"].includes(journey.seal_status)) {
      throw new RegistryError(`${journey.id}: seal_status must be gap or sealed`);
    }
    for (const field of REQUIRED_FIELDS) {
      if (typeof journey[field] !== "string" || journey[field].trim() === "") {
        throw new RegistryError(`${journey.id}: ${field} must be non-empty`);
      }
    }
    for (const field of POSITIVE_FIELDS) {
      if (!isPositive(journey[field])) {
        throw new RegistryError(`${journey.id}: positive ${field} is required; guard-only evidence cannot close it`);
      }
    }
    for (const roleField of ["actors", "projection_audiences"]) {
      const roles = journey[roleField];
      if (!Array.isArray(roles) || roles.length === 0 || new Set(roles).size !== roles.length) {
        throw new RegistryError(`${journey.id}: ${roleField} must be a unique non-empty list`);
      }
      const unsupported = roles.filter((role) => !CANONICAL_ROLES.has(role));
      if (unsupported.length) throw new RegistryError(`${journey.id}: unsupported ${roleField}: ${unsupported.join(", ")}`);
    }
    if (!journey.role_outcomes || typeof journey.role_outcomes !== "object" || Array.isArray(journey.role_outcomes)) {
      throw new RegistryError(`${journey.id}: role_outcomes must cover every canonical role`);
    }
    const outcomeRoles = new Set(Object.keys(journey.role_outcomes));
    if (outcomeRoles.size !== CANONICAL_ROLES.size || [...CANONICAL_ROLES].some((role) => !outcomeRoles.has(role))) {
      throw new RegistryError(`${journey.id}: role_outcomes must cover every canonical role`);
    }
    if (Object.values(journey.role_outcomes).some((outcome) => !isPositive(outcome))) {
      throw new RegistryError(`${journey.id}: role_outcomes must be concrete for every canonical role`);
    }
    if (!Array.isArray(journey.path_patterns) || journey.path_patterns.length === 0 || journey.path_patterns.some((item) => !validPattern(item))) {
      throw new RegistryError(`${journey.id}: path_patterns must be non-empty strings`);
    }
    for (const fixtureField of ["must_match", "must_not_match"]) {
      if (!Array.isArray(journey[fixtureField]) || journey[fixtureField].length === 0 || journey[fixtureField].some((item) => !validPattern(item))) {
        throw new RegistryError(`${journey.id}: ${fixtureField} must contain normalized repository paths`);
      }
    }
    if (!Array.isArray(journey.downstream_projections) || journey.downstream_projections.length === 0 || journey.downstream_projections.some((item) => !isPositive(item))) {
      throw new RegistryError(`${journey.id}: downstream_projections must describe positive visible outcomes`);
    }
    if (journey.availability === "generally_available") {
      const viewports = new Set(journey.required_viewports ?? []);
      if (viewports.size !== 2 || !viewports.has("desktop-1366") || !viewports.has("mobile-390")) {
        throw new RegistryError(`${journey.id}: generally available journeys require desktop-1366 and mobile-390`);
      }
    }
    if (journey.provider_dispatch_policy !== "disabled_in_synthetic_qa") {
      throw new RegistryError(`${journey.id}: synthetic QA must disable provider dispatch`);
    }
    const receiptPolicy = journey.receipt_policy;
    if (!receiptPolicy || typeof receiptPolicy !== "object" || Array.isArray(receiptPolicy)
      || new Set(Object.keys(receiptPolicy)).size !== 4
      || !Object.hasOwn(receiptPolicy, "ttl_seconds")
      || !Object.hasOwn(receiptPolicy, "notification_mode")
      || !Object.hasOwn(receiptPolicy, "required_cases")
      || !Object.hasOwn(receiptPolicy, "required_projections")) {
      throw new RegistryError(`${journey.id}: receipt_policy is incomplete`);
    }
    if (receiptPolicy.ttl_seconds !== 21600) throw new RegistryError(`${journey.id}: receipt TTL must be exactly 21600 seconds`);
    if (!["explicit_recipients", "no_notification", "separate_optional"].includes(receiptPolicy.notification_mode)) {
      throw new RegistryError(`${journey.id}: receipt notification mode is invalid`);
    }
    if (!Array.isArray(receiptPolicy.required_cases) || receiptPolicy.required_cases.length === 0) {
      throw new RegistryError(`${journey.id}: receipt_policy requires valid and invalid cases`);
    }
    const caseKeys = new Set();
    const caseKinds = new Set();
    for (const item of receiptPolicy.required_cases) {
      if (!item || typeof item !== "object" || Array.isArray(item)
        || Object.keys(item).sort().join(",") !== "actor,case_id,kind,outcome_code"
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(item.case_id))
        || !["valid", "invalid"].includes(item.kind)
        || !CANONICAL_ROLES.has(item.actor)
        || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(String(item.outcome_code))
        || new Set(["todo", "tbd", "n_a", "skip", "skipped", "guard_only", "blocked_only"]).has(item.outcome_code)) {
        throw new RegistryError(`${journey.id}: receipt case identity is invalid`);
      }
      caseKeys.add(`${item.case_id}\0${item.kind}\0${item.actor}\0${item.outcome_code}`);
      caseKinds.add(item.kind);
    }
    if (caseKeys.size !== receiptPolicy.required_cases.length || caseKinds.size !== 2) {
      throw new RegistryError(`${journey.id}: receipt cases must be unique and include valid and invalid`);
    }
    if (!Array.isArray(receiptPolicy.required_projections)) throw new RegistryError(`${journey.id}: receipt projections must be a list`);
    const projectionKeys = new Set();
    const projectionAudiences = new Set();
    for (const item of receiptPolicy.required_projections) {
      if (!item || typeof item !== "object" || Array.isArray(item)
        || Object.keys(item).sort().join(",") !== "audience,projection_id"
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(item.projection_id))) {
        throw new RegistryError(`${journey.id}: receipt projection identity is invalid`);
      }
      projectionKeys.add(`${item.projection_id}\0${item.audience}`);
      projectionAudiences.add(item.audience);
    }
    if (projectionKeys.size !== receiptPolicy.required_projections.length
      || projectionAudiences.size !== journey.projection_audiences.length
      || journey.projection_audiences.some((role) => !projectionAudiences.has(role))) {
      throw new RegistryError(`${journey.id}: receipt projections must cover every projection audience exactly`);
    }
    if (!Array.isArray(journey.executable_evidence) || journey.executable_evidence.length === 0) {
      throw new RegistryError(`${journey.id}: executable_evidence must be non-empty`);
    }
    for (const evidence of journey.executable_evidence) {
      if (!evidence || typeof evidence !== "object") throw new RegistryError(`${journey.id}: executable evidence entries must be objects`);
      requireLocalFile(root, evidence.path, `${journey.id} evidence`);
      if (!Array.isArray(evidence.proves) || evidence.proves.length === 0 || evidence.proves.some((item) => typeof item !== "string" || !item)) {
        throw new RegistryError(`${journey.id}: evidence proves must be non-empty strings`);
      }
      const suite = evidence.runner === "pr_route_mock" ? routeMockSpecs : controlledWriteSpecs;
      if (!["pr_route_mock", "controlled_write"].includes(evidence.runner) || !suite.includes(evidence.path)) {
        throw new RegistryError(`${journey.id}: evidence runner must match the registered E2E suite for ${evidence.path}`);
      }
    }
    if (!Array.isArray(journey.known_gaps) || journey.known_gaps.some((gap) => !isPositive(gap))) {
      throw new RegistryError(`${journey.id}: known_gaps must be a list of concrete gaps`);
    }
    if (journey.seal_status === "gap" && journey.known_gaps.length === 0) {
      throw new RegistryError(`${journey.id}: gap journeys must name at least one known gap`);
    }
    if (journey.seal_status === "sealed" && journey.known_gaps.length) {
      throw new RegistryError(`${journey.id}: sealed journeys cannot retain known gaps`);
    }
    if (!Array.isArray(journey.docs) || journey.docs.length === 0) throw new RegistryError(`${journey.id}: docs must be non-empty`);
    for (const doc of journey.docs) requireLocalFile(root, doc, `${journey.id} doc`);
  }
  for (const journey of registry.journeys) {
    for (const fixture of journey.must_match) {
      if (!impactedJourneyIds(registry, [fixture]).has(journey.id)) {
        throw new RegistryError(`${journey.id}: must_match is not covered by path_patterns: ${fixture}`);
      }
    }
    for (const fixture of journey.must_not_match) {
      if (impactedJourneyIds(registry, [fixture]).has(journey.id)) {
        throw new RegistryError(`${journey.id}: must_not_match is covered by path_patterns: ${fixture}`);
      }
    }
  }
}

export function validateCoreJourneys(registry) {
  const current = new Set(registry.journeys.map((journey) => journey.id));
  const missing = [...CORE_JOURNEY_IDS].filter((id) => !current.has(id)).sort();
  if (missing.length) throw new RegistryError(`core journey entries cannot be removed: ${missing.join(", ")}`);
}

export function validateRegistryTransition(previous, current, validReceipts = new Set()) {
  if (!previous) return;
  const currentById = new Map(current.journeys.map((journey) => [journey.id, journey]));
  for (const old of previous.journeys) {
    const next = currentById.get(old.id);
    if (!next) throw new RegistryError(`existing journey cannot be removed: ${old.id}`);
    if (old.availability === "generally_available" && next.availability !== "generally_available") {
      throw new RegistryError(`${old.id}: generally available journey cannot be relabeled beta`);
    }
    if (old.seal_status === "sealed" && next.seal_status !== "sealed") {
      throw new RegistryError(`${old.id}: sealed journey cannot regress to gap`);
    }
    if (old.seal_status === "gap" && next.seal_status === "sealed" && !validReceipts.has(old.id)) {
      throw new RegistryError(`${old.id}: gap cannot be promoted without a valid exact-SHA same-artifact receipt`);
    }
    if (JSON.stringify(old.receipt_policy) !== JSON.stringify(next.receipt_policy)) {
      throw new RegistryError(`${old.id}: receipt policy cannot change in a journey product PR`);
    }
    for (const roleField of ["actors", "projection_audiences"]) {
      const nextRoles = new Set(next[roleField]);
      const removedRoles = old[roleField].filter((role) => !nextRoles.has(role)).sort();
      if (removedRoles.length) throw new RegistryError(`${old.id}: existing ${roleField} cannot be removed: ${removedRoles.join(", ")}`);
    }
    for (const fixtureField of ["must_match", "must_not_match"]) {
      const nextFixtures = new Set(next[fixtureField]);
      const removed = old[fixtureField].filter((fixture) => !nextFixtures.has(fixture)).sort();
      if (removed.length) throw new RegistryError(`${old.id}: existing ${fixtureField} fixtures cannot be removed: ${removed.join(", ")}`);
    }
    const nextEvidence = new Map(next.executable_evidence.map((item) => [item.path, new Set(item.proves)]));
    for (const evidence of old.executable_evidence) {
      if (!nextEvidence.has(evidence.path)) throw new RegistryError(`${old.id}: existing evidence path cannot be removed: ${evidence.path}`);
      const removedProofs = evidence.proves.filter((proof) => !nextEvidence.get(evidence.path).has(proof)).sort();
      if (removedProofs.length) throw new RegistryError(`${old.id}: existing evidence claims cannot be removed: ${removedProofs.join(", ")}`);
    }
  }
}

function globRegex(pattern) {
  const placeholder = "\u0000";
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("**", placeholder).replaceAll("*", "[^/]*").replaceAll(placeholder, ".*")}$`);
}

export function impactedJourneyIds(registry, changedPaths) {
  const normalized = changedPaths
    .map((item) => item.replaceAll("\\", "/").replace(/^\.\//, ""))
    .filter(isRuntimePath);
  return new Set(
    registry.journeys
      .filter((journey) => journey.path_patterns.some((pattern) => normalized.some((item) => globRegex(pattern).test(item))))
      .map((journey) => journey.id),
  );
}

export function validateReceiptBootstrapBoundary(impacted, changedPaths, ...registries) {
  if (!impacted.size) return;
  const protectedPaths = new Set(PROTECTED_RECEIPT_PATHS);
  for (const registry of registries) {
    for (const journey of registry?.journeys ?? []) {
      for (const evidence of journey.executable_evidence) protectedPaths.add(evidence.path);
    }
  }
  const overlap = changedPaths.filter((item) => protectedPaths.has(item)).sort();
  if (overlap.length) throw new RegistryError(`receipt infrastructure/evidence must land before an affected product PR: ${overlap.join(", ")}`);
}

function isRuntimePath(item) {
  const parts = item.split("/");
  return !(
    item.startsWith("docs/")
    || item.startsWith("e2e/")
    || item.startsWith("scripts/tests/")
    || parts.includes("tests")
    || parts.includes("migrations")
    || item.endsWith(".md")
  );
}

export function parsePrEvidence(body) {
  if (!body.includes(MARKER)) return new Map();
  const sanitized = body.replace(/```[\s\S]*?```/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const headingPattern = /^### Journey: ([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/gm;
  const headings = [...sanitized.matchAll(headingPattern)];
  const parsed = new Map();
  headings.forEach((heading, index) => {
    const journeyId = heading[1];
    if (parsed.has(journeyId)) throw new RegistryError(`duplicate PR evidence block: ${journeyId}`);
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : sanitized.length;
    const block = sanitized.slice(start, end);
    const fields = {};
    for (const match of block.matchAll(/^- ([^:\n]+):\s*(.+?)\s*$/gm)) {
      const key = PR_FIELDS.get(match[1]);
      if (!key) continue;
      if (fields[key]) throw new RegistryError(`${journeyId}: duplicate PR field ${match[1]}`);
      fields[key] = match[2].trim();
    }
    parsed.set(journeyId, fields);
  });
  return parsed;
}

function splitValues(value) {
  return new Set(value.split(/[,;]/).map((item) => item.trim()).filter(Boolean));
}

function roleOutcomes(value) {
  return new Map(
    value.split(";")
      .filter((item) => item.includes("="))
      .map((item) => {
        const [role, ...outcome] = item.split("=");
        return [role.trim(), outcome.join("=").trim()];
      }),
  );
}

export function validatePrEvidence(registry, impacted, parsed, validReceipts = new Set()) {
  const byId = new Map(registry.journeys.map((journey) => [journey.id, journey]));
  const missing = [...impacted].filter((id) => !parsed.has(id)).sort();
  if (missing.length) throw new RegistryError(`missing PR journey evidence blocks: ${missing.join(", ")}`);
  for (const journeyId of [...impacted].sort()) {
    const journey = byId.get(journeyId);
    if (journey.availability === "generally_available" && !validReceipts.has(journeyId)) {
      const detail = journey.seal_status === "gap"
        ? `close registered gaps before product change: ${journey.known_gaps.join("; ")}`
        : "a sealed journey still requires a fresh receipt for each affected product head";
      throw new RegistryError(`${journeyId}: no valid exact-SHA receipt; ${detail}`);
    }
    const fields = parsed.get(journeyId);
    for (const [label, key] of PR_FIELDS) {
      if (!fields[key]) throw new RegistryError(`${journeyId}: missing PR field ${label}`);
    }
    for (const [key, label] of [
      ["positive_action", "positive action"],
      ["persisted_outcome", "positive persisted outcome"],
      ["reload_persistence", "positive reload persistence"],
      ["downstream_projection", "positive downstream projection"],
      ["invalid_case", "concrete invalid case"],
      ["notification_intent", "concrete notification intent"],
      ["cleanup", "concrete cleanup readback"],
    ]) {
      if (!isPositive(fields[key])) throw new RegistryError(`${journeyId}: ${label} is required; denial or guard-only evidence is insufficient`);
    }
    const actors = splitValues(fields.actors);
    if (journey.actors.some((role) => !actors.has(role))) throw new RegistryError(`${journeyId}: PR Actors must cover ${journey.actors.join(", ")}`);
    const audiences = splitValues(fields.projection_audiences);
    if (journey.projection_audiences.some((role) => !audiences.has(role))) {
      throw new RegistryError(`${journeyId}: PR Projection audiences must cover ${journey.projection_audiences.join(", ")}`);
    }
    const outcomes = roleOutcomes(fields.role_outcomes);
    if (outcomes.size !== CANONICAL_ROLES.size || [...CANONICAL_ROLES].some((role) => !isPositive(outcomes.get(role)))) {
      throw new RegistryError(`${journeyId}: PR Role outcomes must give a concrete result for every canonical role`);
    }
    const viewports = splitValues(fields.viewports);
    if (journey.required_viewports.some((viewport) => !viewports.has(viewport))) {
      throw new RegistryError(`${journeyId}: PR Viewports must cover desktop-1366 and mobile-390`);
    }
    const citedEvidence = splitValues(fields.executable_evidence);
    const missingEvidence = journey.executable_evidence.map((item) => item.path).filter((item) => !citedEvidence.has(item)).sort();
    if (missingEvidence.length) throw new RegistryError(`${journeyId}: PR Executable evidence is missing registered paths: ${missingEvidence.join(", ")}`);
    if (fields.provider_sends !== journey.provider_dispatch_policy) {
      throw new RegistryError(`${journeyId}: PR Provider sends must be disabled_in_synthetic_qa`);
    }
  }
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function argumentsFor(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

export function changedPaths(root, baseRef) {
  if (!baseRef) return [];
  return execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRTD", `${baseRef}...HEAD`], {
    cwd: root,
    encoding: "utf8",
  }).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function registryAtRef(root, baseRef, relativePath) {
  if (!baseRef) return undefined;
  try {
    return JSON.parse(execFileSync("git", ["show", `${baseRef}:${relativePath}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch (error) {
    if (error instanceof SyntaxError) throw new RegistryError(`base registry is invalid JSON at ${baseRef}:${relativePath}`);
    return undefined;
  }
}

export function validateInvocation(impacted, eventPath, registryOnly) {
  if (impacted.size && !eventPath && !registryOnly) {
    throw new RegistryError("impacted journeys require a pull-request event; use --registry-only only for non-PR schema checks");
  }
}

export function validateReceipts(receiptPaths, registry, root, expectedHead, now = new Date()) {
  if (!receiptPaths.length) return new Set();
  try {
    const context = currentCiContext();
    const valid = new Set(receiptPaths.map((relative) => {
      const candidate = path.resolve(root, relative);
      const relation = path.relative(root, candidate);
      if (relation.startsWith("..") || path.isAbsolute(relation)) throw new ReceiptError(`receipt path escapes the repository: ${relative}`);
      return validateReceipt(JSON.parse(fs.readFileSync(candidate, "utf8")), registry, root, expectedHead, context, now);
    }));
    if (valid.size !== receiptPaths.length) throw new RegistryError("duplicate journey receipts are not allowed");
    return valid;
  } catch (error) {
    if (error instanceof RegistryError) throw error;
    throw new RegistryError(error.message);
  }
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const registryPath = argument("--registry") ?? "scripts/user-journey-registry.json";
  const registry = JSON.parse(fs.readFileSync(path.join(root, registryPath), "utf8"));
  validateRegistry(registry, root);
  validateCoreJourneys(registry);
  const baseRef = argument("--base-ref");
  const changed = changedPaths(root, baseRef);
  const previousRegistry = registryAtRef(root, baseRef, registryPath);
  const impacted = impactedJourneyIds(registry, changed);
  if (previousRegistry) {
    for (const id of impactedJourneyIds(previousRegistry, changed)) impacted.add(id);
  }
  validateReceiptBootstrapBoundary(impacted, changed, registry, previousRegistry);
  const eventPath = argument("--event-path");
  const registryOnly = process.argv.includes("--registry-only");
  validateInvocation(impacted, eventPath, registryOnly);
  let validReceipts = new Set();
  if (eventPath) {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    const expectedHead = event.pull_request?.head?.sha;
    if (typeof expectedHead !== "string" || !/^[0-9a-f]{40}$/.test(expectedHead)) throw new RegistryError("pull-request head SHA is missing");
    validReceipts = validateReceipts(argumentsFor("--receipt"), registry, root, expectedHead);
    if (impacted.size) validatePrEvidence(registry, impacted, parsePrEvidence(event.pull_request?.body ?? ""), validReceipts);
  }
  if (!registryOnly) validateRegistryTransition(previousRegistry, registry, validReceipts);
  console.log(`USER_JOURNEY_OUTCOME_GATE_PASS impacted=${[...impacted].sort().join(",") || "none"}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`USER_JOURNEY_OUTCOME_GATE_FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
