#!/usr/bin/env node
/**
 * 학생앱 라우트 검증 — StudentRouter에서 lazy/import 로드하는 모든 페이지 파일이 존재하는지 확인.
 * 사용: frontend 루트에서 node scripts/verify-student-routes.mjs
 * CI에서 빌드 후 실행해 파이프라인 정상 여부를 빠르게 점검할 수 있음.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcRoot = path.join(root, "src");
const routerFile = path.join(srcRoot, "app_student", "app", "StudentRouter.tsx");
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

function toRelative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function resolveSpecifier(specifier, fromFile) {
  let base;
  if (specifier.startsWith("@student/")) {
    base = path.join(srcRoot, "app_student", specifier.slice("@student/".length));
  } else if (specifier.startsWith("@/")) {
    base = path.join(srcRoot, specifier.slice("@/".length));
  } else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }

  const candidates = [base];
  if (!path.extname(base)) {
    for (const ext of EXTENSIONS) candidates.push(`${base}${ext}`);
    for (const ext of EXTENSIONS) candidates.push(path.join(base, `index${ext}`));
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

if (!fs.existsSync(routerFile)) {
  console.error(`[FAIL] StudentRouter not found: ${toRelative(routerFile)}`);
  process.exit(1);
}

const routerText = fs.readFileSync(routerFile, "utf8");
const lazyImports = [...routerText.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)]
  .map((match) => match[1])
  .filter((specifier) => specifier.startsWith("@student/") || specifier.startsWith("@/") || specifier.startsWith("."));

if (lazyImports.length === 0) {
  console.error(`[FAIL] no lazy imports found in ${toRelative(routerFile)}`);
  process.exit(1);
}

let failed = 0;
for (const specifier of lazyImports) {
  const full = resolveSpecifier(specifier, routerFile);
  const exists = fs.existsSync(full);
  if (!exists) {
    console.error(`[FAIL] missing: ${specifier} -> ${toRelative(full)}`);
    failed++;
  } else {
    console.log(`[OK] ${specifier} -> ${toRelative(full)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} route(s) missing. Pipeline check failed.`);
  process.exit(1);
}

console.log(`\nAll ${lazyImports.length} student app route files present.`);
