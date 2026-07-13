import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const e2eRoot = path.join(root, "e2e");
const fix = process.argv.includes("--fix");
const allowedExceptions = new Set([
  "e2e/stability/all-menu-button-click-audit.spec.ts",
  "e2e/stability/final-edge-verify.spec.ts",
]);
const runtimeImport = /import\s+\{([^}]+)\}\s+from\s+["']@playwright\/test["'];?/g;

const files = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ["_archive", "_local"].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolutePath);
    else if (entry.name.endsWith(".spec.ts")) files.push(absolutePath);
  }
}
collect(e2eRoot);

const violations = [];
let changed = 0;
for (const absolutePath of files) {
  const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");
  let source = fs.readFileSync(absolutePath, "utf8");
  const isAllowedException = allowedExceptions.has(relativePath) && source.includes("E2E_STRICT_IMPORT_EXCEPTION");
  let changedThisFile = false;

  source = source.replace(runtimeImport, (full, bindings) => {
    const names = String(bindings)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const importsRuntimeTest = names.some((name) => /^(?:test|expect)(?:\s+as\s+\w+)?$/.test(name));
    if (!importsRuntimeTest || isAllowedException) return full;
    if (!fix) {
      violations.push(`${relativePath}: runtime test/expect must come from fixtures/strictTest`);
      return full;
    }

    let strictPath = path
      .relative(path.dirname(absolutePath), path.join(e2eRoot, "fixtures", "strictTest"))
      .replaceAll(path.sep, "/");
    if (!strictPath.startsWith(".")) strictPath = `./${strictPath}`;
    changedThisFile = true;
    return full.replace(/(["'])@playwright\/test\1/, `"${strictPath}"`);
  });

  if (changedThisFile) {
    fs.writeFileSync(absolutePath, source, "utf8");
    changed += 1;
  }
}

if (fix) {
  console.log(`Strict E2E import migration updated ${changed} files`);
  process.exit(0);
}

if (violations.length > 0) {
  console.error("Strict E2E import guard failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Strict E2E import guard PASS (${files.length} active specs scanned)`);
