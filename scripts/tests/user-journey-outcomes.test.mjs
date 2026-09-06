import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  RegistryError,
  changedPaths,
  impactedJourneyIds,
  parsePrEvidence,
  validatePrEvidence,
  validateRegistry,
  validateReceiptBootstrapBoundary,
  validateRegistryTransition,
  validateInvocation,
} from "../check-user-journey-outcomes.mjs";

export function journey() {
  return {
    id: "score-result-messaging",
    availability: "beta",
    seal_status: "gap",
    known_gaps: ["Same-artifact replay receipt is not implemented."],
    actors: ["owner", "admin", "teacher"],
    projection_audiences: ["owner", "admin", "teacher", "staff", "student", "parent"],
    role_outcomes: {
      owner: "Owner can request and inspect the delivery.",
      admin: "Admin can request and inspect the delivery.",
      teacher: "Teacher can request and inspect the delivery.",
      staff: "Staff direct send is denied before dispatch.",
      student: "Student sees the published result projection.",
      parent: "Parent sees the selected student result projection.",
    },
    path_patterns: ["src/app_admin/domains/results/**", "src/shared/messaging/**"],
    must_match: ["src/app_admin/domains/results/ScorePage.tsx"],
    must_not_match: ["docs/STUDENT-GRADE-REPORT.md"],
    start_state: "A published result and explicit recipient choices exist.",
    valid_action: "An authorized staff member sends the result letter.",
    invalid_case: "A missing approved provider identity blocks before dispatch.",
    persisted_outcome: "One immutable request and recipient-specific logs persist.",
    reload_assertion: "Reload shows the same recipient and delivery state.",
    downstream_projections: ["student result", "guardian result", "delivery log"],
    notification_intent: "Only explicitly selected recipients are requested.",
    provider_dispatch_policy: "disabled_in_synthetic_qa",
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
    required_viewports: ["desktop-1366", "mobile-390"],
    cleanup_assertion: "Synthetic tenant, users, rows, queue items, and objects are zero.",
    executable_evidence: [
      {
        path: "e2e/admin/score-alimtalk-personalization.mock.spec.ts",
        proves: [
          "valid_action",
          "invalid_case",
          "persisted_outcome",
          "reload_assertion",
          "downstream_projections",
          "notification_intent",
          "required_viewports",
          "cleanup_assertion",
          "provider_dispatch_policy",
        ],
        runner: "pr_route_mock",
      },
    ],
    docs: ["docs/USER-JOURNEY-OUTCOME-GATE.md"],
  };
}

function body(outcome = "The selected recipients have one persisted request.") {
  return `<!-- academy-user-journey-evidence-v1 -->
### Journey: score-result-messaging
- Positive action: Teacher sends one explicit result letter.
- Persisted outcome: ${outcome}
- Reload persistence: Reload shows the same recipient and state.
- Downstream projection: Student, guardian, and delivery-log views agree.
- Actors: owner, admin, teacher
- Projection audiences: owner, admin, teacher, staff, student, parent
- Role outcomes: owner=request succeeds; admin=request succeeds; teacher=request succeeds; staff=direct send is denied before dispatch; student=published result is visible; parent=selected student result is visible
- Viewports: desktop-1366, mobile-390
- Executable evidence: e2e/admin/score-alimtalk-personalization.mock.spec.ts
- Invalid case: Missing provider identity is rejected before dispatch.
- Notification intent: Only selected recipients are requested.
- Provider sends: disabled_in_synthetic_qa
- Cleanup: Synthetic tenant, users, rows, queues, and objects are zero.
`;
}

test("registry is strict and references executable evidence", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "journey-gate-"));
  fs.mkdirSync(path.join(root, "e2e/admin"), { recursive: true });
  fs.writeFileSync(path.join(root, "e2e/admin/score-alimtalk-personalization.mock.spec.ts"), "// evidence\n");
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/USER-JOURNEY-OUTCOME-GATE.md"), "# owner\n");

  validateRegistry({ schema_version: 1, journeys: [journey()] }, root);
  const invalid = journey();
  invalid.persisted_outcome = "guard only";
  assert.throws(
    () => validateRegistry({ schema_version: 1, journeys: [invalid] }, root),
    /positive persisted_outcome/,
  );
  const selfCertified = journey();
  selfCertified.seal_status = "sealed";
  selfCertified.known_gaps = [];
  validateRegistry({ schema_version: 1, journeys: [selfCertified] }, root);
  assert.throws(
    () => validateRegistryTransition(
      { schema_version: 1, journeys: [journey()] },
      { schema_version: 1, journeys: [selfCertified] },
    ),
    /valid exact-SHA same-artifact receipt/,
  );
  validateRegistryTransition(
    { schema_version: 1, journeys: [journey()] },
    { schema_version: 1, journeys: [selfCertified] },
    new Set(["score-result-messaging"]),
  );
});

test("changed product path selects the registered journey", () => {
  const registry = { schema_version: 1, journeys: [journey()] };
  assert.deepEqual(
    impactedJourneyIds(registry, ["src/app_admin/domains/results/ScorePage.tsx"]),
    new Set(["score-result-messaging"]),
  );
  assert.deepEqual(impactedJourneyIds(registry, ["docs/README.md"]), new Set());
});

test("real runtime owners map to all applicable journeys", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const registry = JSON.parse(fs.readFileSync(path.join(root, "scripts/user-journey-registry.json"), "utf8"));
  const cases = new Map([
    ["src/app_admin/domains/messages/components/SendMessageModal.tsx", new Set(["score-result-messaging", "messaging-template-recipient-log"])],
    ["src/app_admin/domains/results/components/omr-review/OmrReviewWorkspace.tsx", new Set(["omr-manual-descriptive"])],
    ["src/app_student/domains/exams/pages/ExamResultPage.tsx", new Set(["score-result-messaging", "omr-manual-descriptive"])],
    ["src/app_student/domains/grades/components/LectureExamGroup.tsx", new Set(["score-result-messaging", "omr-manual-descriptive"])],
    ["src/app_teacher/domains/results/pages/ResultsPage.tsx", new Set(["score-result-messaging", "omr-manual-descriptive"])],
    ["src/app_admin/domains/clinic/api/clinicParticipants.api.ts", new Set(["clinic-state"])],
  ]);
  for (const [runtimePath, expected] of cases) {
    assert.deepEqual(impactedJourneyIds(registry, [runtimePath]), expected, runtimePath);
  }
  assert.deepEqual(impactedJourneyIds(registry, ["src/app_admin/domains/messages/tests/example.ts"]), new Set());
});

test("changed path collection includes deleted runtime files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "journey-git-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["config", "user.email", "journey@example.test"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Journey Gate"], { cwd: root });
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src/runtime.ts"), "export {};\n");
  execFileSync("git", ["add", "src/runtime.ts"], { cwd: root });
  execFileSync("git", ["commit", "--quiet", "-m", "base"], { cwd: root });
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  fs.rmSync(path.join(root, "src/runtime.ts"));
  execFileSync("git", ["add", "-u"], { cwd: root });
  execFileSync("git", ["commit", "--quiet", "-m", "delete"], { cwd: root });
  assert.deepEqual(changedPaths(root, base), ["src/runtime.ts"]);
});

test("PR evidence requires positive and invalid outcomes", () => {
  const registry = { schema_version: 1, journeys: [journey()] };
  validatePrEvidence(registry, new Set(["score-result-messaging"]), parsePrEvidence(body()));
  assert.throws(
    () => validatePrEvidence(registry, new Set(["score-result-messaging"]), parsePrEvidence(body("guard only"))),
    /positive persisted outcome/,
  );
  assert.throws(
    () => validatePrEvidence(registry, new Set(["score-result-messaging"]), parsePrEvidence(body().replace("- Reload persistence:", "- Guard result:"))),
    /Reload persistence/,
  );
  assert.throws(
    () => validatePrEvidence(registry, new Set(["score-result-messaging"]), parsePrEvidence(body().replace("- Cleanup: Synthetic", "- Cleanup: N/A\n- Ignored: Synthetic"))),
    /concrete cleanup readback/,
  );
  const fenced = `${body().split("\n")[0]}\n\`\`\`markdown\n${body().split("\n").slice(1).join("\n")}\n\`\`\``;
  assert.throws(
    () => validatePrEvidence(registry, new Set(["score-result-messaging"]), parsePrEvidence(fenced)),
    /missing PR journey evidence/,
  );
});

test("unsealed GA journey blocks an affected product change", () => {
  const unsealed = journey();
  unsealed.availability = "generally_available";
  unsealed.seal_status = "gap";
  unsealed.known_gaps = ["Same-artifact reload and cleanup evidence is missing."];
  const registry = { schema_version: 1, journeys: [unsealed] };
  assert.throws(
    () => validatePrEvidence(registry, new Set(["score-result-messaging"]), parsePrEvidence(body())),
    /no valid exact-SHA receipt/,
  );
  validatePrEvidence(
    registry,
    new Set(["score-result-messaging"]),
    parsePrEvidence(body()),
    new Set(["score-result-messaging"]),
  );
});

test("impacted invocation requires PR event or explicit registry-only mode", () => {
  assert.throws(
    () => validateInvocation(new Set(["score-result-messaging"]), undefined, false),
    /require a pull-request event/,
  );
  validateInvocation(new Set(["score-result-messaging"]), undefined, true);
});

test("receipt runner and evidence must land before a product change", () => {
  const registry = { schema_version: 1, journeys: [journey()] };
  assert.throws(
    () => validateReceiptBootstrapBoundary(
      new Set(["score-result-messaging"]),
      ["src/app_admin/domains/results/ScorePage.tsx", "e2e/admin/score-alimtalk-personalization.mock.spec.ts"],
      registry,
    ),
    /must land before/,
  );
  validateReceiptBootstrapBoundary(new Set(), ["scripts/user-journey-receipts.mjs"], registry);
});

test("registry transition cannot hide existing GA coverage", () => {
  const old = journey();
  old.availability = "generally_available";
  const previous = { schema_version: 1, journeys: [old] };
  const relabeled = journey();
  relabeled.availability = "beta";
  assert.throws(
    () => validateRegistryTransition(previous, { schema_version: 1, journeys: [relabeled] }),
    /cannot be relabeled beta/,
  );

  const narrowed = journey();
  narrowed.availability = "generally_available";
  narrowed.must_match = [];
  assert.throws(
    () => validateRegistryTransition(previous, { schema_version: 1, journeys: [narrowed] }),
    /must_match fixtures cannot be removed/,
  );

  const policyChanged = journey();
  policyChanged.availability = "generally_available";
  policyChanged.receipt_policy.ttl_seconds = 1;
  assert.throws(
    () => validateRegistryTransition(previous, { schema_version: 1, journeys: [policyChanged] }),
    /receipt policy cannot change/,
  );
});

test("quality workflow reruns when PR evidence is edited", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/quality-gate.yml"), "utf8");
  assert.match(workflow, /types: \[opened, synchronize, reopened, edited, ready_for_review\]/);
  assert.match(workflow, /check-user-journey-outcomes\.mjs/);
  assert.match(workflow, /user-journey-receipts\.mjs verify/);
  assert.match(workflow, /user-journey-receipts\.mjs issue/);
  assert.match(workflow, /user-journey-receipts\.test\.mjs/);
  assert.match(workflow, /test-results\/user-journey-machine-results\/\*\.json/);
  assert.match(workflow, /test-results\/user-journey-receipts\/\*\.json/);
  assert.match(workflow, /Upload PII-free journey receipts/);
  assert.match(workflow, /if-no-files-found: ignore/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /--event-path "\$GITHUB_EVENT_PATH"/);
  assert.match(workflow, /--base-ref "\$\{\{ github\.event\.before \}\}" --registry-only/);
});
