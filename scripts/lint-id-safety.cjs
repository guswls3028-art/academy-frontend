/**
 * ID Domain Safety Lint Script (Frontend)
 * ========================================
 * Detects patterns that can cause ID domain confusion in TypeScript/React code.
 *
 * Checks:
 * 1. UNTYPED_ID_ARRAY: `selectedIds: number[]` or `selected: number[]` where
 *    the variable could hold different entity IDs without type distinction.
 *
 * 2. GENERIC_IDS_RETURN: `{ ids: number[] }` return types from modal/selector
 *    components — the caller cannot distinguish which entity domain the IDs
 *    belong to.
 *
 * 3. UNQUALIFIED_ID_CALLBACK: `(id) =>` or `(id: number) =>` in map/forEach
 *    callbacks without a clear entity prefix (e.g., studentId, examId).
 *
 * Usage:
 *     node scripts/lint-id-safety.cjs
 *
 * Exit code: always 0 (warnings only — many existing patterns exist)
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SRC_DIR = path.resolve(__dirname, "..", "src");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "__pycache__",
  ".git",
]);

const EXTENSIONS = new Set([".ts", ".tsx"]);

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

// 1. UNTYPED_ID_ARRAY: selectedIds: number[], selected: number[], ids: number[]
const RE_UNTYPED_ID_ARRAY =
  /\b(selectedIds|selected|ids|checkedIds|selectedItems)\s*:\s*number\[\]/g;

// 2. GENERIC_IDS_RETURN: { ids: number[] } in type/interface definitions
const RE_GENERIC_IDS_RETURN =
  /\{\s*ids\s*:\s*number\[\]\s*\}/g;

// 3. UNQUALIFIED_ID_CALLBACK: (id) => or (id: number) => in map/forEach/filter
const RE_UNQUALIFIED_ID_CALLBACK =
  /\.(map|forEach|filter|find|some|every|flatMap)\(\s*\(\s*id\s*(?::\s*number)?\s*\)\s*=>/g;

// Also catch standalone arrow functions with bare `id` param in assignment context
const RE_UNQUALIFIED_ID_ASSIGN =
  /(?:const|let|var)\s+\w+\s*=\s*\(\s*id\s*(?::\s*number)?\s*\)\s*=>/g;

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectFiles(dir) {
  const results = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkFile(filepath) {
  let content;
  try {
    content = fs.readFileSync(filepath, "utf-8");
  } catch {
    return [];
  }

  const lines = content.split("\n");
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineno = i + 1;

    // Reset regex lastIndex for global patterns
    RE_UNTYPED_ID_ARRAY.lastIndex = 0;
    RE_GENERIC_IDS_RETURN.lastIndex = 0;
    RE_UNQUALIFIED_ID_CALLBACK.lastIndex = 0;
    RE_UNQUALIFIED_ID_ASSIGN.lastIndex = 0;

    // Check 1: UNTYPED_ID_ARRAY
    let match;
    while ((match = RE_UNTYPED_ID_ARRAY.exec(line)) !== null) {
      findings.push({
        file: filepath,
        line: lineno,
        pattern: "UNTYPED_ID_ARRAY",
        description: `'${match[1]}: number[]' — consider using branded type or entity-prefixed name (e.g., studentIds, examIds)`,
      });
    }

    // Check 2: GENERIC_IDS_RETURN
    while ((match = RE_GENERIC_IDS_RETURN.exec(line)) !== null) {
      findings.push({
        file: filepath,
        line: lineno,
        pattern: "GENERIC_IDS_RETURN",
        description: `'{ ids: number[] }' — ambiguous ID domain; use entity-prefixed name (e.g., { studentIds: number[] })`,
      });
    }

    // Check 3: UNQUALIFIED_ID_CALLBACK
    while ((match = RE_UNQUALIFIED_ID_CALLBACK.exec(line)) !== null) {
      findings.push({
        file: filepath,
        line: lineno,
        pattern: "UNQUALIFIED_ID_CALLBACK",
        description: `.${match[1]}((id) => ...) — bare 'id' param; use entity-prefixed name (e.g., studentId, examId)`,
      });
    }

    while ((match = RE_UNQUALIFIED_ID_ASSIGN.exec(line)) !== null) {
      findings.push({
        file: filepath,
        line: lineno,
        pattern: "UNQUALIFIED_ID_CALLBACK",
        description: `(id) => ... assignment — bare 'id' param; use entity-prefixed name`,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const files = collectFiles(SRC_DIR).sort();
  let totalWarnings = 0;

  const patternCounts = {
    UNTYPED_ID_ARRAY: 0,
    GENERIC_IDS_RETURN: 0,
    UNQUALIFIED_ID_CALLBACK: 0,
  };

  for (const filepath of files) {
    const findings = checkFile(filepath);
    for (const f of findings) {
      totalWarnings++;
      patternCounts[f.pattern] = (patternCounts[f.pattern] || 0) + 1;
      console.log(
        `${f.file}:${f.line}: WARNING: ${f.pattern}: ${f.description}`
      );
    }
  }

  if (totalWarnings === 0) {
    console.log("OK: No ID domain confusion patterns found.");
  } else {
    console.log();
    console.log(`Summary: ${totalWarnings} warning(s)`);
    for (const [pattern, count] of Object.entries(patternCounts)) {
      if (count > 0) {
        console.log(`  ${pattern}: ${count}`);
      }
    }
    console.log();
    console.log(
      "NOTE: These are warnings only. Fix by using entity-prefixed names"
    );
    console.log(
      "      (e.g., studentIds instead of ids, enrollmentId instead of id)."
    );
  }

  // Always exit 0 — warnings only for frontend
  return 0;
}

process.exit(main());
