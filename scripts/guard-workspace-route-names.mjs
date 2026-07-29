import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const legacyOwner = path.join(sourceRoot, "core", "router", "workspaceRoutes.ts");
const staleRouteLiteral = /(["'`])\/(?:admin|teacher)(?=\/|[?#]|["'`]|\$\{)/g;
const staleRouteRegex = /\\\/(?:admin|teacher)\\\//g;
const violations = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(target);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name) || target === legacyOwner) continue;

    const lines = fs.readFileSync(target, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      staleRouteLiteral.lastIndex = 0;
      staleRouteRegex.lastIndex = 0;
      if (staleRouteLiteral.test(line) || staleRouteRegex.test(line)) {
        violations.push(`${path.relative(root, target)}:${index + 1}`);
      }
    });
  }
}

visit(sourceRoot);

if (violations.length > 0) {
  console.error(
    "[workspace-routes] legacy /admin or /teacher browser route found outside workspaceRoutes.ts:",
  );
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("[workspace-routes] canonical route guard PASS");
