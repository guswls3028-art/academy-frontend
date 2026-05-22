import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const E2E = path.join(ROOT, 'e2e');
const APP_ALIASES = ['@admin/', '@student/', '@teacher/', '@dev/', '@promo/'];
const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const LARGE_FILE_LINES = 1000;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'test-results',
  'playwright-report',
  '.auth',
  '_artifacts',
  '_local',
  '_audit',
  'reports',
  'screenshots',
]);

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, predicate));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function importSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?[^'"]+?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      specs.push({ spec: match[1], index: match.index ?? 0 });
    }
  }
  return specs;
}

const findings = [];
const srcFiles = walk(SRC, (file) => TEXT_EXTS.has(path.extname(file)));
const allSrcTextFiles = walk(SRC, (file) => ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'].includes(path.extname(file)));

for (const file of srcFiles) {
  const text = read(file);
  const relative = rel(file);
  const specs = importSpecifiers(text);

  for (const { spec, index } of specs) {
    const line = lineNumber(text, index);
    const inShared = relative.startsWith('src/shared/');
    const inTeacher = relative.startsWith('src/app_teacher/');
    const inStudent = relative.startsWith('src/app_student/');
    const inApp = relative.startsWith('src/app_');

    if (inShared && APP_ALIASES.some((alias) => spec.startsWith(alias))) {
      findings.push({ kind: 'shared_imports_app', path: relative, line, detail: spec });
    }
    if ((inTeacher || inStudent) && spec.startsWith('@admin/')) {
      findings.push({ kind: 'role_app_imports_admin', path: relative, line, detail: spec });
    }
    if (inApp) {
      const currentApp = relative.split('/')[1];
      for (const alias of APP_ALIASES) {
        const target = `app_${alias.slice(1, -1)}`;
        if (spec.startsWith(alias) && target !== currentApp) {
          findings.push({ kind: 'cross_app_import', path: relative, line, detail: spec });
        }
      }
    }
  }
}

for (const file of walk(E2E, (file) => TEXT_EXTS.has(path.extname(file)))) {
  const text = read(file);
  for (const match of text.matchAll(/page\.waitForTimeout\s*\(/g)) {
    findings.push({ kind: 'e2e_wait_for_timeout', path: rel(file), line: lineNumber(text, match.index ?? 0), detail: 'page.waitForTimeout' });
  }
}

for (const file of allSrcTextFiles) {
  const lines = read(file).split(/\r?\n/).length;
  if (lines >= LARGE_FILE_LINES) {
    findings.push({ kind: 'large_frontend_file', path: rel(file), line: lines, detail: `${lines} lines` });
  }
}

const summary = {};
for (const finding of findings) {
  summary[finding.kind] = (summary[finding.kind] ?? 0) + 1;
}

const payload = {
  frontend: ROOT,
  files_scanned: {
    src_import_files: srcFiles.length,
    src_text_files: allSrcTextFiles.length,
  },
  summary: Object.fromEntries(Object.entries(summary).sort(([a], [b]) => a.localeCompare(b))),
  findings,
};

const asJson = process.argv.includes('--json');
const strict = process.argv.includes('--strict');

if (asJson) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log('Refactor boundary snapshot');
  console.log(`frontend: ${ROOT}`);
  console.log(`src_import_files: ${srcFiles.length}`);
  console.log(`src_text_files: ${allSrcTextFiles.length}`);
  console.log('summary:');
  for (const [kind, count] of Object.entries(payload.summary)) {
    console.log(`  ${kind}: ${count}`);
  }
  if (findings.length) {
    console.log('sample findings:');
    for (const finding of findings.slice(0, 30)) {
      console.log(`  ${finding.kind} ${finding.path}:${finding.line} ${finding.detail}`);
    }
  }
}

if (strict && findings.length) {
  process.exitCode = 1;
}
