import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowRoot = path.join(root, ".github", "workflows");
const failures = [];

for (const entry of fs.readdirSync(workflowRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
  const source = fs.readFileSync(path.join(workflowRoot, entry.name), "utf8");
  for (const match of source.matchAll(/uses:\s+([^\s#]+)/g)) {
    const action = match[1];
    if (!action.startsWith("./") && !/@[0-9a-f]{40}$/.test(action)) {
      failures.push(`${entry.name}: action is not commit-pinned: ${action}`);
    }
  }
}

const quality = fs.readFileSync(
  path.join(workflowRoot, "quality-gate.yml"),
  "utf8",
).replaceAll("\r\n", "\n");
const e2e = fs
  .readFileSync(path.join(workflowRoot, "e2e.yml"), "utf8")
  .replaceAll("\r\n", "\n");
for (const forbidden of [
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_EMAIL",
  "X-Auth-Key",
  "X-Auth-Email",
]) {
  if (quality.includes(forbidden)) {
    failures.push(`quality-gate.yml: forbidden global Cloudflare credential marker ${forbidden}`);
  }
}
for (const required of [
  "environment: preview",
  "environment: production",
  "environment: production-rollback",
  "CLOUDFLARE_PREVIEW_API_TOKEN",
  "CLOUDFLARE_PRODUCTION_API_TOKEN",
  "CLOUDFLARE_INFRA_API_TOKEN",
  "permissions:\n  contents: read",
]) {
  if (!quality.includes(required)) {
    failures.push(`quality-gate.yml: missing deployment governance marker ${required}`);
  }
}
for (const required of [
  "E2E_ALLOW_PRODUCTION_WRITES=0",
  'E2E_ALLOW_PRODUCTION_WRITES: "1"',
  "controlled_write_canaries",
]) {
  if (!e2e.includes(required)) {
    failures.push(`e2e.yml: missing write-boundary marker ${required}`);
  }
}
if (!fs.existsSync(path.join(root, ".github", "dependabot.yml"))) {
  failures.push("frontend Dependabot configuration is missing");
}

if (failures.length > 0) {
  console.error(
    "Deployment governance guard failed:\n" +
      failures.map((failure) => `- ${failure}`).join("\n"),
  );
  process.exit(1);
}
console.log("Deployment governance guard PASS");
