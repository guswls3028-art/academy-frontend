import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pullRequestGateAllowlist = new Set([
  "e2e/shared/e2e-safety-policy.spec.ts",
  "e2e/admin/01-login-dashboard.spec.ts",
  "e2e/student/01-login-dashboard.spec.ts",
  "e2e/smoke/smoke.spec.ts",
  "e2e/auth/account-recovery-modal.spec.ts",
  "e2e/auth/first-login-guide.mock.spec.ts",
  "e2e/admin/arrival-operations.mock.spec.ts",
  "e2e/admin/lecture-session-scopes.mock.spec.ts",
  "e2e/admin/manual-exam-grading.mock.spec.ts",
  "e2e/admin/session-attendance-bulk-safety.mock.spec.ts",
  "e2e/admin/score-entry-autosave.spec.ts",
  "e2e/admin/staff-operations-contract.mock.spec.ts",
  "e2e/admin/student-custom-columns.mock.spec.ts",
  "e2e/admin/student-detail-entrypoints.mock.spec.ts",
  "e2e/admin/wrong-note-generation-contract.mock.spec.ts",
  "e2e/shared/product-analytics-contract.mock.spec.ts",
  "e2e/student/video-cdn-service-error.mock.spec.ts",
  "e2e/teacher/comms-reply-mobile.mock.spec.ts",
  "e2e/teacher/video-thumbnail-render.mock.spec.ts",
]);
const requirements = new Map([
  ["e2e/stability/controlled-real-alimtalk-send.spec.ts", "realMessagingSkipReason"],
  ["e2e/admin/12-clinic-trigger-real.spec.ts", "productionTriggerMutationSkipReason"],
  ["e2e/admin/dnb-lecture-crud.spec.ts", "nonPrimaryTenantWriteSkipReason"],
  ["e2e/admin/dnb-lectures-sessions.spec.ts", "nonPrimaryTenantWriteSkipReason"],
  ["e2e/admin/dnb-student-app.spec.ts", "nonPrimaryTenantWriteSkipReason"],
  ["e2e/flows/real-scenario.spec.ts", "productionUnisolatedScenarioSkipReason"],
  ["e2e/flows/password-reset-roundtrip.spec.ts", "productionMultiNoticeFlowSkipReason"],
  ["e2e/flows/notice-roundtrip.spec.ts", "productionWriteOptInSkipReason"],
  ["e2e/flows/qna-roundtrip.spec.ts", "productionWriteOptInSkipReason"],
  ["e2e/flows/clinic-roundtrip.spec.ts", "productionWriteOptInSkipReason"],
  ["e2e/admin/session-assessment-realuse.spec.ts", "productionWriteOptInSkipReason"],
]);

const failures = [];
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const gateSpecs = String(packageJson.scripts?.["test:e2e:gate"] ?? "")
  .match(/e2e\/[^\s]+\.spec\.ts/g) ?? [];
if (gateSpecs.length === 0) {
  failures.push("package.json: test:e2e:gate must name its reviewed PR specs explicitly");
}
for (const spec of gateSpecs) {
  if (!pullRequestGateAllowlist.has(spec)) {
    failures.push(`${spec}: production-backed PR gate allows only reviewed login, read-only, or mock specs`);
  }
}
for (const required of pullRequestGateAllowlist) {
  if (!gateSpecs.includes(required)) {
    failures.push(`package.json: test:e2e:gate is missing reviewed safe spec ${required}`);
  }
}
const forbiddenCredentialHashes = new Set([
  // Former production E2E credential. Keep only the irreversible digest here.
  "45f607ae5d71d23397806a772cc3f7002b1ca91d049db22166fcd5ea540c8543",
]);
for (const [relativePath, marker] of requirements) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: required safety-governed spec is missing`);
    continue;
  }
  const source = fs.readFileSync(absolutePath, "utf8");
  if (!source.includes(marker)) {
    failures.push(`${relativePath}: missing ${marker} production safety boundary`);
  }
}

const e2eRoot = path.join(root, "e2e");
const activeSpecs = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ["_archive", "_local"].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolutePath);
    else if (entry.name.endsWith(".spec.ts")) activeSpecs.push(absolutePath);
  }
}
collect(e2eRoot);

const credentialCandidates = [];
function collectCredentialCandidates(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectCredentialCandidates(absolutePath);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) credentialCandidates.push(absolutePath);
  }
}
collectCredentialCandidates(e2eRoot);
collectCredentialCandidates(path.join(root, "scripts"));

for (const absolutePath of credentialCandidates) {
  const source = fs.readFileSync(absolutePath, "utf8");
  const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");
  for (const token of source.match(/[A-Za-z0-9]{10,}/g) ?? []) {
    const digest = createHash("sha256").update(token).digest("hex");
    if (forbiddenCredentialHashes.has(digest)) {
      failures.push(`${relativePath}: embedded production credential is forbidden; use E2E_* env`);
    }
  }
}

for (const absolutePath of activeSpecs) {
  const source = fs.readFileSync(absolutePath, "utf8");
  const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");
  const clicksFinalSend = /name:\s*["']발송하기["'][\s\S]{0,240}?\.click\s*\(/.test(source);
  if (clicksFinalSend && !source.includes("realMessagingSkipReason")) {
    failures.push(`${relativePath}: final real-send click lacks realMessagingSkipReason`);
  }

  const namesNonPrimaryTenant = /(?:CODE|DNB_CODE)\s*=\s*["'](?:dnb|tchul|sswe|limglish|ymath)["']/.test(source);
  const writesThroughRequest = /request\.(?:post|put|patch|delete)\s*\(/.test(source);
  if (
    namesNonPrimaryTenant &&
    writesThroughRequest &&
    !source.includes("nonPrimaryTenantWriteSkipReason")
  ) {
    failures.push(`${relativePath}: non-primary tenant write lacks a production block`);
  }
}

if (failures.length > 0) {
  console.error("E2E safety guard failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`E2E safety guard PASS (${activeSpecs.length} active specs scanned)`);
