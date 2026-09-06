import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MACHINE_KIND,
  PRODUCER,
  REPOSITORY,
  issueReceipt,
  journeyContractSha256,
  validateReceipt,
} from "../user-journey-receipts.mjs";

const HEAD = "a".repeat(40);
const BACKEND_HEAD = "b".repeat(40);
const HASH = "c".repeat(64);
const DIGEST = `sha256:${"d".repeat(64)}`;
const NOW = new Date("2026-09-06T08:30:00Z");
const CI = {
  event_name: "pull_request",
  run_id: "12345",
  run_attempt: "1",
  workflow_ref: "guswls3028-art/academy-frontend/.github/workflows/quality-gate.yml@refs/pull/7/merge",
};

function journey() {
  return {
    id: "score-result-messaging",
    actors: ["owner", "admin", "teacher"],
    projection_audiences: ["owner", "admin", "teacher", "staff", "student", "parent"],
    required_viewports: ["desktop-1366", "mobile-390"],
    receipt_policy: {
      ttl_seconds: 21600,
      notification_mode: "explicit_recipients",
      required_cases: [
        { case_id: "score-send-valid-teacher", kind: "valid", actor: "teacher", outcome_code: "requested" },
        { case_id: "score-send-invalid-staff", kind: "invalid", actor: "staff", outcome_code: "forbidden" },
      ],
      required_projections: ["owner", "admin", "teacher", "staff", "student", "parent"]
        .map((role) => ({ projection_id: `${role}-result`, audience: role })),
    },
    executable_evidence: [
      { path: "e2e/admin/score-alimtalk-personalization.mock.spec.ts", runner: "pr_route_mock" },
    ],
  };
}

function machineResult(root, contract) {
  const resultDir = path.join(root, "test-results");
  fs.mkdirSync(resultDir, { recursive: true });
  const source = contract.executable_evidence[0].path;
  fs.writeFileSync(path.join(resultDir, "playwright.json"), JSON.stringify({
    errors: [],
    suites: [{
      specs: [{
        file: source,
        tests: [{ expectedStatus: "passed", status: "expected", results: [{ status: "passed", retry: 0 }] }],
      }],
    }],
  }));
  fs.writeFileSync(path.join(resultDir, "desktop.png"), "desktop");
  fs.writeFileSync(path.join(resultDir, "mobile.png"), "mobile");
  const workers = Object.fromEntries(["messaging", "ai", "tools", "video"]
    .map((name) => [name, { repository_sha: BACKEND_HEAD, digest: DIGEST }]));
  return {
    schema_version: 1,
    kind: MACHINE_KIND,
    producer: PRODUCER,
    journey_id: contract.id,
    repository: REPOSITORY,
    head_sha: HEAD,
    contract_sha256: journeyContractSha256(contract),
    ci: { provider: "github_actions", ...CI },
    artifacts: {
      backend: { repository_sha: BACKEND_HEAD, api_digest: DIGEST },
      frontend: { repository_sha: HEAD, bundle_sha256: HASH },
      workers,
    },
    environment: {
      name: "persistent-development",
      release_id: "release-20260906",
      deployment_id: "deployment-12345",
      api_instance_id: "i-0123456789abcdef0",
    },
    actor: { role: "teacher", subject_sha256: HASH },
    actions: contract.receipt_policy.required_cases.map((item) => ({
      ...item,
      mutation_delta: item.kind === "valid" ? 1 : 0,
      provider_attempt_delta: 0,
      correlation_sha256: HASH,
      result: "passed",
    })),
    persistence: { assertion_id: "persisted-outcome", write_count: 1, outcome_sha256: HASH, result: "passed" },
    reload: { assertion_id: "fresh-session-reload", fresh_auth_session: true, outcome_sha256: HASH, result: "passed" },
    projections: contract.receipt_policy.required_projections.map((item) => ({ ...item, outcome_sha256: HASH, result: "passed" })),
    viewports: [
      { id: "desktop-1366", width: 1366, browser: "chromium", artifact_path: "test-results/desktop.png", artifact_sha256: "", result: "passed" },
      { id: "mobile-390", width: 390, browser: "chromium", artifact_path: "test-results/mobile.png", artifact_sha256: "", result: "passed" },
    ],
    test_provenance: [{ source_path: source, runner: "pr_route_mock", report_path: "test-results/playwright.json", report_sha256: "", result: "passed" }],
    notification_intent: { selected_recipient_count: 2, persisted_request_count: 2, unselected_request_count: 0, result: "passed" },
    provider_dispatch: {
      policy: "disabled_in_synthetic_qa",
      mode_readback: "disabled",
      alimtalk_attempt_count: 0,
      sms_attempt_count: 0,
      lms_attempt_count: 0,
      provider_message_id_count: 0,
      network_dispatch_count: 0,
      result: "passed",
    },
    cleanup: {
      completed_at: "2026-09-06T08:20:00Z",
      residue: { tenants: 0, users: 0, rows: 0, queue_items: 0, objects: 0, preview_tokens: 0, provider_requests: 0 },
      result: "passed",
    },
    generated_at: "2026-09-06T08:00:00Z",
    expires_at: "2026-09-06T12:00:00Z",
  };
}

test("exact machine result issues and verifies", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "journey-receipt-"));
  const contract = journey();
  const registry = { schema_version: 1, journeys: [contract] };
  const receipt = issueReceipt(machineResult(root, contract), registry, root, HEAD, CI, NOW);
  assert.equal(validateReceipt(receipt, registry, root, HEAD, CI, NOW), contract.id);
  assert.match(receipt.receipt_sha256, /^[0-9a-f]{64}$/);
});

test("cross-SHA, stale, provider, and cleanup drift are rejected", () => {
  const cases = [
    ["head", (item) => { item.head_sha = "e".repeat(40); }, /repository\/head SHA/],
    ["worker", (item) => { item.artifacts.workers.messaging.repository_sha = "e".repeat(40); }, /worker is cross-SHA/],
    ["stale", (item) => { item.expires_at = "2026-09-06T08:01:00Z"; }, /expired/],
    ["provider", (item) => { item.provider_dispatch.alimtalk_attempt_count = 1; }, /provider dispatch/],
    ["cleanup", (item) => { item.cleanup.residue.rows = 1; }, /cleanup residue/],
    ["placeholder", (item) => { item.environment.release_id = "todo-release"; }, /identify/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `journey-receipt-${name}-`));
    const contract = journey();
    const registry = { schema_version: 1, journeys: [contract] };
    const machine = machineResult(root, contract);
    mutate(machine);
    assert.throws(() => issueReceipt(machine, registry, root, HEAD, CI, NOW), pattern);
  }
});

test("missing projection and skipped Playwright result are rejected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "journey-receipt-negative-"));
  const contract = journey();
  const registry = { schema_version: 1, journeys: [contract] };
  const missing = machineResult(root, contract);
  missing.projections.pop();
  assert.throws(() => issueReceipt(missing, registry, root, HEAD, CI, NOW), /downstream projections/);

  const skipped = machineResult(root, contract);
  const report = JSON.parse(fs.readFileSync(path.join(root, "test-results/playwright.json"), "utf8"));
  report.suites[0].specs[0].tests[0] = { expectedStatus: "skipped", status: "skipped", results: [] };
  fs.writeFileSync(path.join(root, "test-results/playwright.json"), JSON.stringify(report));
  assert.throws(() => issueReceipt(skipped, registry, root, HEAD, CI, NOW), /non-skipped/);
});

test("receipt and viewport artifacts cannot be rewritten", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "journey-receipt-tamper-"));
  const contract = journey();
  const registry = { schema_version: 1, journeys: [contract] };
  const receipt = issueReceipt(machineResult(root, contract), registry, root, HEAD, CI, NOW);
  const tampered = structuredClone(receipt);
  tampered.actor.role = "admin";
  assert.throws(() => validateReceipt(tampered, registry, root, HEAD, CI, NOW), /receipt_sha256/);
  fs.writeFileSync(path.join(root, "test-results/desktop.png"), "rewritten");
  assert.throws(() => validateReceipt(receipt, registry, root, HEAD, CI, NOW), /artifact hash mismatch/);
});

test("a no-notification journey requires exact zero intent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "journey-receipt-no-notification-"));
  const contract = journey();
  contract.receipt_policy.notification_mode = "no_notification";
  const registry = { schema_version: 1, journeys: [contract] };
  const zero = machineResult(root, contract);
  zero.notification_intent.selected_recipient_count = 0;
  zero.notification_intent.persisted_request_count = 0;
  issueReceipt(zero, registry, root, HEAD, CI, NOW);
  assert.throws(() => issueReceipt(machineResult(root, contract), registry, root, HEAD, CI, NOW), /notification intent/);
});
