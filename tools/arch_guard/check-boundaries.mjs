#!/usr/bin/env node
// arch_guard (frontend) — app/레이어 import 경계 게이트. (Refactor roadmap Phase 0-C)
//
// ARCHITECTURE.md §3.3 의 프론트 경계를 *빌드가 강제*. 의존성 0(Node 내장 only).
//
// 검사 규칙:
//   cross_app          app_<X> 의 파일이 다른 app alias(@admin/@student/@dev/@promo)를 import.
//                      (앱은 서로 격리. 공유는 @/shared 로만.)
//   shared_imports_app shared/ 의 파일이 app alias 를 import (역방향 의존 금지 — shared 는 app 비의존).
//
// baseline 방식(backend arch_guard 와 동일): 현재 위반 동결 → 신규만 차단 → 번다운 → 승격.
// baseline key = `rule|relpath|target` (line 제외, 편집에 안전).
//
// usage:
//   node tools/arch_guard/check-boundaries.mjs                  # baseline 대비 검사
//   node tools/arch_guard/check-boundaries.mjs --update-baseline
//   node tools/arch_guard/check-boundaries.mjs --json
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = join(SCRIPT_DIR, "..", "..");
const SRC_ROOT = join(FRONTEND_ROOT, "src");
const BASELINE_PATH = join(SCRIPT_DIR, "baseline.json");

// app alias → zone
const APP_ALIASES = { "@admin": "admin", "@student": "student", "@dev": "dev", "@promo": "promo" };
const APP_DIRS = { app_admin: "admin", app_student: "student", app_dev: "dev", app_promo: "promo" };

function zoneOfFile(relPath) {
  const parts = relPath.split("/");
  if (parts[0] === "shared") return "shared";
  if (APP_DIRS[parts[0]]) return APP_DIRS[parts[0]];
  return "other"; // auth/landing/core/styles 등 — Phase 0 검사 제외 zone
}

// import 경로 → app zone (app alias 일 때만), 아니면 null
function appZoneOfSpecifier(spec) {
  for (const [alias, zone] of Object.entries(APP_ALIASES)) {
    if (spec === alias || spec.startsWith(alias + "/")) return zone;
  }
  return null; // @/ , @/shared, 상대경로, 패키지 등은 검사 대상 아님
}

function isExcluded(relPath) {
  if (/(^|\/)(node_modules|dist|build|\.wrangler|coverage|e2e)\//.test(relPath)) return true;
  if (/\.(test|spec)\.[tj]sx?$/.test(relPath)) return true;
  if (/\.d\.ts$/.test(relPath)) return true;
  return false;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "build" || name === ".wrangler") continue;
      yield* walk(full);
    } else if (/\.[tj]sx?$/.test(name)) {
      yield full;
    }
  }
}

// 파일 내 import/export-from/dynamic-import 의 module specifier 추출
function extractSpecifiers(code) {
  const specs = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,            // import/export ... from '...'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('...')
    /\bimport\s+['"]([^'"]+)['"]/g,           // side-effect import '...'
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) specs.push(m[1]);
  }
  return specs;
}

function lineOf(code, spec) {
  const idx = code.indexOf(spec);
  if (idx < 0) return 1;
  return code.slice(0, idx).split("\n").length;
}

function scan() {
  const violations = [];
  if (!existsSync(SRC_ROOT)) {
    console.error(`ERROR: src 없음: ${SRC_ROOT}`);
    process.exit(2);
  }
  for (const file of walk(SRC_ROOT)) {
    const relPath = relative(SRC_ROOT, file).split(sep).join("/");
    if (isExcluded(relPath)) continue;
    const zone = zoneOfFile(relPath);
    if (zone === "other") continue;
    let code;
    try { code = readFileSync(file, "utf8"); } catch { continue; }
    for (const spec of extractSpecifiers(code)) {
      const targetApp = appZoneOfSpecifier(spec);
      if (!targetApp) continue;
      let rule = null;
      if (zone === "shared") rule = "shared_imports_app";
      else if (targetApp !== zone) rule = "cross_app";
      if (rule) {
        violations.push({ rule, relPath: "src/" + relPath, line: lineOf(code, spec), target: spec, zone });
      }
    }
  }
  return violations;
}

const keyOf = (v) => `${v.rule}|${v.relPath}|${v.target}`;

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set();
  const data = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  return new Set(data.violations || []);
}

function writeBaseline(violations) {
  const keys = [...new Set(violations.map(keyOf))].sort();
  const summary = {};
  for (const v of violations) summary[v.rule] = (summary[v.rule] || 0) + 1;
  const payload = {
    _comment: "arch_guard(frontend) 동결 baseline. 신규 위반만 CI 차단. 번다운 시 갱신.",
    version: 1, summary, count: keys.length, violations: keys,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function main() {
  const args = process.argv.slice(2);
  const violations = scan();
  const curKeys = new Set(violations.map(keyOf));

  if (args.includes("--update-baseline")) {
    writeBaseline(violations);
    const summary = {};
    for (const v of violations) summary[v.rule] = (summary[v.rule] || 0) + 1;
    console.log(`baseline 갱신: ${curKeys.size} 위반 동결 → baseline.json`);
    for (const [r, n] of Object.entries(summary)) console.log(`  ${r}: ${n}`);
    return 0;
  }

  const baseline = loadBaseline();
  const newKeys = [...curKeys].filter((k) => !baseline.has(k)).sort();
  const stale = [...baseline].filter((k) => !curKeys.has(k)).sort();

  if (args.includes("--json")) {
    console.log(JSON.stringify({ current: curKeys.size, baseline: baseline.size, new: newKeys, stale }, null, 2));
    return newKeys.length ? 1 : 0;
  }

  console.log(`arch_guard(FE): 현재 ${curKeys.size} 위반 / baseline ${baseline.size} 동결 / 신규 ${newKeys.length} / 해소 ${stale.length}`);

  if (stale.length) {
    console.log(`\n✅ baseline 에서 사라진(고쳐진) 항목 ${stale.length}개 — --update-baseline 로 갱신 권장`);
  }

  if (newKeys.length) {
    const newSet = new Set(newKeys);
    console.log(`\n❌ 신규 경계 위반 ${newKeys.length}개 — 차단. (ARCHITECTURE.md §3.3)`);
    const byRule = {};
    for (const v of violations) if (newSet.has(keyOf(v))) (byRule[v.rule] ||= []).push(v);
    for (const [rule, vs] of Object.entries(byRule)) {
      console.log(`\n  [${rule}] ${vs.length}건:`);
      for (const v of vs.sort((a, b) => a.relPath.localeCompare(b.relPath))) {
        console.log(`  ${v.relPath}:${v.line}  [${v.zone}] →  ${v.target}`);
      }
    }
    console.log("\n  해결: cross_app → 공통은 @/shared 로 / shared_imports_app → 의존 역전(app→shared 만).");
    return 1;
  }
  console.log("\n✅ 신규 위반 없음. 통과.");
  return 0;
}

process.exit(main());
