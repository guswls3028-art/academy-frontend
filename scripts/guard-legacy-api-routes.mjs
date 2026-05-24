import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "src", "e2e"], {
  encoding: "utf8",
});

const sourceFiles = tracked
  .split("\0")
  .filter(Boolean)
  .filter((file) => /\.(tsx?|jsx?)$/.test(file))
  .filter((file) => !file.startsWith("e2e/reports/"))
  .filter((file) => existsSync(file));

const rules = [
  {
    id: "students-students",
    pattern: /\/api\/v1\/students\/students\/|\/students\/students\//,
    message: "Use /api/v1/students/ through the canonical student API client.",
  },
  {
    id: "lectures-enrollments",
    pattern: /\/api\/v1\/lectures\/enrollments\/|\/lectures\/enrollments\//,
    message: "Use /api/v1/enrollments/ through the canonical enrollment API client.",
  },
  {
    id: "direct-enrollment-create",
    pattern: /\.(?:post)\s*\(\s*["'`][^"'`]*\/(?:api\/v1\/)?enrollments\/["'`]/,
    message: "Enrollment creation must use /enrollments/bulk_create/ or the canonical enrollment API client.",
  },
];

const violations = [];

for (const file of sourceFiles) {
  const body = readFileSync(file, "utf8");
  for (const rule of rules) {
    const match = body.match(rule.pattern);
    if (!match) continue;

    const index = match.index ?? 0;
    const line = body.slice(0, index).split(/\r?\n/).length;
    violations.push({ file, line, rule });
  }
}

if (violations.length > 0) {
  console.error("Legacy API route guard failed:");
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} [${violation.rule.id}] ${violation.rule.message}`
    );
  }
  process.exit(1);
}

console.log(`Legacy API route guard passed (${sourceFiles.length} tracked source/e2e files scanned).`);
