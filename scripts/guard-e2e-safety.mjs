import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requirements = new Map([
  ["e2e/stability/controlled-real-alimtalk-send.spec.ts", "realMessagingSkipReason"],
  ["e2e/admin/12-clinic-trigger-real.spec.ts", "productionTriggerMutationSkipReason"],
  ["e2e/admin/dnb-lecture-crud.spec.ts", "nonPrimaryTenantWriteSkipReason"],
  ["e2e/admin/dnb-lectures-sessions.spec.ts", "nonPrimaryTenantWriteSkipReason"],
  ["e2e/admin/dnb-student-app.spec.ts", "nonPrimaryTenantWriteSkipReason"],
  ["e2e/flows/real-scenario.spec.ts", "productionUnisolatedScenarioSkipReason"],
  ["e2e/flows/password-reset-roundtrip.spec.ts", "productionMultiNoticeFlowSkipReason"],
]);

const failures = [];
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
