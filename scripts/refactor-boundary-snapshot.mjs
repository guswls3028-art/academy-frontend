import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const E2E = path.join(ROOT, 'e2e');
const APP_ALIASES = ['@admin/', '@student/', '@teacher/', '@dev/', '@promo/'];
const APP_ALIAS_TO_DIR = {
  '@admin/': 'app_admin',
  '@student/': 'app_student',
  '@teacher/': 'app_teacher',
  '@dev/': 'app_dev',
  '@promo/': 'app_promo',
};
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

function domainFromRelPath(relative) {
  const match = relative.match(/^src\/(app_[^/]+)\/domains\/([^/]+)\//);
  if (!match) return null;
  return {
    app: match[1],
    domain: match[2],
    key: `${match[1]}/${match[2]}`,
  };
}

function domainFromSpecifier(spec, fromFile) {
  for (const [alias, app] of Object.entries(APP_ALIAS_TO_DIR)) {
    if (!spec.startsWith(alias)) continue;
    const parts = spec.slice(alias.length).split('/');
    if (parts[0] !== 'domains' || !parts[1]) return null;
    return {
      app,
      domain: parts[1],
      key: `${app}/${parts[1]}`,
    };
  }

  if (!spec.startsWith('.')) return null;
  const absolute = path.resolve(path.dirname(fromFile), spec);
  const relative = rel(absolute);
  return domainFromRelPath(relative);
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function topEntries(map, limit = 20) {
  return [...map.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

const findings = [];
const domainOutbound = new Map();
const domainPairs = new Map();
const srcFiles = walk(SRC, (file) => TEXT_EXTS.has(path.extname(file)));
const allSrcTextFiles = walk(SRC, (file) => ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'].includes(path.extname(file)));
const metrics = {
  api_generated_dir_present: fs.existsSync(path.join(SRC, 'shared', 'api', 'generated')),
  local_format_defs: 0,
  status_map_defs: 0,
  query_key_literals: 0,
  inline_style_objects: 0,
  raw_badge_classes: 0,
  api_response_type_defs: 0,
};

for (const file of srcFiles) {
  const text = read(file);
  const relative = rel(file);
  const specs = importSpecifiers(text);
  const currentDomain = domainFromRelPath(relative);

  metrics.local_format_defs += countMatches(text, /\b(?:const|function)\s+format[A-Z][A-Za-z0-9_]*/g);
  metrics.status_map_defs += countMatches(text, /\b[A-Za-z0-9_]*(?:Status|STATUS)[A-Za-z0-9_]*(?:Map|MAP|Labels|LABELS|Meta|META)\b/g);
  metrics.query_key_literals += countMatches(text, /\bqueryKey\s*:\s*\[/g);
  metrics.inline_style_objects += countMatches(text, /\bstyle\s*=\s*\{\s*\{/g);
  metrics.raw_badge_classes += countMatches(text, /\bclassName\s*=\s*["'][^"']*\bds-[^"']*badge\b[^"']*["']/g);
  metrics.api_response_type_defs += countMatches(text, /\b(?:interface|type)\s+[A-Za-z0-9_]*(?:Response|DTO|Dto)\b/g);

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

    if (currentDomain) {
      const targetDomain = domainFromSpecifier(spec, file);
      if (
        targetDomain &&
        targetDomain.app === currentDomain.app &&
        targetDomain.domain !== currentDomain.domain
      ) {
        const pair = `${currentDomain.key}->${targetDomain.key}`;
        domainOutbound.set(currentDomain.key, (domainOutbound.get(currentDomain.key) ?? 0) + 1);
        domainPairs.set(pair, (domainPairs.get(pair) ?? 0) + 1);
        findings.push({
          kind: 'same_app_domain_import',
          path: relative,
          line,
          detail: `${currentDomain.domain} -> ${targetDomain.domain}: ${spec}`,
        });
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
  metrics,
  domain_boundary: {
    same_app_imports: summary.same_app_domain_import ?? 0,
    hot_outbound_domains: topEntries(domainOutbound, 15),
    hot_pairs: topEntries(domainPairs, 15),
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
  console.log('metrics:');
  for (const [name, value] of Object.entries(metrics)) {
    console.log(`  ${name}: ${value}`);
  }
  if (payload.domain_boundary.same_app_imports) {
    console.log('domain boundary hotspots:');
    for (const entry of payload.domain_boundary.hot_outbound_domains.slice(0, 10)) {
      console.log(`  ${entry.key}: ${entry.count}`);
    }
    console.log('domain boundary hot pairs:');
    for (const entry of payload.domain_boundary.hot_pairs.slice(0, 10)) {
      console.log(`  ${entry.key}: ${entry.count}`);
    }
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
