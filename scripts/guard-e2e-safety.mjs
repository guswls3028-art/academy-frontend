import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  controlledWriteSpecs,
  e2eGateSpecs,
  productionReadOnlySpecs,
  routeMockSpecs,
} from "../e2e/suites.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewedProductionReadOnlySpecs = [
  "e2e/shared/e2e-safety-policy.spec.ts",
  "e2e/admin/01-login-dashboard.spec.ts",
  "e2e/student/01-login-dashboard.spec.ts",
  "e2e/smoke/smoke.spec.ts",
];
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
const gateCommand = String(packageJson.scripts?.["test:e2e:gate"] ?? "");
const readOnlyGateCommand = String(packageJson.scripts?.["test:e2e:gate:readonly"] ?? "");
const mockGateCommand = String(packageJson.scripts?.["test:e2e:gate:mock"] ?? "");
const controlledWriteCommand = String(packageJson.scripts?.["test:e2e:controlled-writes"] ?? "");
if (gateCommand !== "playwright test --config=playwright.pr-gate.config.ts") {
  failures.push("package.json: test:e2e:gate must use playwright.pr-gate.config.ts");
}
if (
  readOnlyGateCommand
  !== "playwright test --config=playwright.pr-gate.config.ts --project=pr-readonly-4"
) {
  failures.push("package.json: test:e2e:gate:readonly must run the final serial dependency project");
}
if (
  mockGateCommand
  !== "playwright test --config=playwright.pr-gate.config.ts --project=pr-route-mocks --no-deps"
) {
  failures.push("package.json: test:e2e:gate:mock must run only the dependency-free route-mock project");
}
if ("test:e2e:release" in (packageJson.scripts ?? {})) {
  failures.push("package.json: mixed-environment test:e2e:release is forbidden; reuse the read-only and closed-proxy gates");
}
if (fs.existsSync(path.join(root, "playwright.release.config.ts"))) {
  failures.push("playwright.release.config.ts: mixed read-only/mock release config must remain removed");
}
if (
  controlledWriteCommand
  !== "playwright test --config=playwright.controlled-write.config.ts"
) {
  failures.push("package.json: test:e2e:controlled-writes must use the retry-free controlled-write config");
}
if (JSON.stringify(productionReadOnlySpecs) !== JSON.stringify(reviewedProductionReadOnlySpecs)) {
  failures.push("e2e/suites.mjs: production-backed PR specs must remain the reviewed serial allowlist");
}
for (const spec of routeMockSpecs) {
  const absolutePath = path.join(root, spec);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${spec}: route-mock gate spec is missing`);
    continue;
  }
  const source = fs.readFileSync(absolutePath, "utf8");
  if (!source.includes("page.route(")) {
    failures.push(`${spec}: parallel PR gate specs must install page.route mocks`);
  }
  if (!source.replaceAll("\\/", "/").includes("api/v1/")) {
    failures.push(`${spec}: parallel PR gate specs must intercept the API boundary`);
  }
}
if (new Set(e2eGateSpecs).size !== e2eGateSpecs.length) {
  failures.push("e2e/suites.mjs: PR gate specs must be unique");
}
if (new Set(controlledWriteSpecs).size !== controlledWriteSpecs.length) {
  failures.push("e2e/suites.mjs: controlled write specs must be unique");
}
for (const spec of controlledWriteSpecs) {
  if (!fs.existsSync(path.join(root, spec))) {
    failures.push(`e2e/suites.mjs: controlled write spec is missing: ${spec}`);
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
