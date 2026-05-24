#!/usr/bin/env node
/**
 * Lazy route import verifier.
 * Router files often use dynamic import() so missing files can hide until route entry.
 * This shared verifier resolves local aliases and fails fast before build/E2E.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcRoot = path.join(root, "src");
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

const ALIASES = [
  ["@admin/", path.join(srcRoot, "app_admin") + path.sep],
  ["@student/", path.join(srcRoot, "app_student") + path.sep],
  ["@teacher/", path.join(srcRoot, "app_teacher") + path.sep],
  ["@dev/", path.join(srcRoot, "app_dev") + path.sep],
  ["@promo/", path.join(srcRoot, "app_promo") + path.sep],
  ["@/", srcRoot + path.sep],
];

function toRelative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function resolveSpecifier(specifier, fromFile) {
  let base = null;
  for (const [prefix, target] of ALIASES) {
    if (specifier.startsWith(prefix)) {
      base = path.join(target, specifier.slice(prefix.length));
      break;
    }
  }

  if (!base && specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  }
  if (!base) return null;

  const candidates = [];
  if (path.extname(base)) {
    candidates.push(base);
  } else {
    for (const ext of EXTENSIONS) candidates.push(`${base}${ext}`);
    for (const ext of EXTENSIONS) candidates.push(path.join(base, `index${ext}`));
  }
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? candidates[0] ?? base;
}

export function verifyLazyRouteImports({ label, routerFile }) {
  if (!fs.existsSync(routerFile)) {
    console.error(`[FAIL] ${label} router not found: ${toRelative(routerFile)}`);
    process.exit(1);
  }

  const routerText = fs.readFileSync(routerFile, "utf8");
  const lazyImports = [...routerText.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)]
    .map((match) => match[1])
    .filter((specifier) => resolveSpecifier(specifier, routerFile) !== null);

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
    console.error(`\n${failed} ${label} route(s) missing. Pipeline check failed.`);
    process.exit(1);
  }

  console.log(`\nAll ${lazyImports.length} ${label} route files present.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const [label, routerPath] = process.argv.slice(2);
  if (!label || !routerPath) {
    console.error("Usage: node scripts/verify-lazy-route-imports.mjs <label> <router-file>");
    process.exit(1);
  }
  verifyLazyRouteImports({
    label,
    routerFile: path.resolve(root, routerPath),
  });
}
