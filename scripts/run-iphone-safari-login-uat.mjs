import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REQUIRED_ENV = [
  "E2E_BASE_URL",
  "E2E_API_URL",
  "E2E_LOGIN_UAT_MANIFEST",
  "E2E_LOGIN_UAT_FRONTEND_SHA",
  "E2E_LOGIN_UAT_BACKEND_ROOT",
  "YMATH_REALUSE_SCENARIO_PASSWORD",
];

function fail(message) {
  throw new Error(message);
}

function readManifest(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return parsed.login_manifest ?? parsed;
}

function assertLoopback(value, label) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
    fail(`${label} must be loopback HTTP.`);
  }
}

function assertExactCheckout(expectedSha) {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (actual !== expectedSha) fail("Frontend checkout does not match E2E_LOGIN_UAT_FRONTEND_SHA.");
  const dirty = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { encoding: "utf8" },
  ).trim();
  if (dirty) fail("Frontend checkout must be clean for persistent-development UAT.");
}

function secretAppearsInTree(root, secret) {
  if (!fs.existsSync(root)) return false;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (fs.readFileSync(fullPath).includes(Buffer.from(secret))) return true;
    }
  }
  return false;
}

const manifestEnv = String(process.env.E2E_LOGIN_UAT_MANIFEST || "").trim();
const backendRootEnv = String(process.env.E2E_LOGIN_UAT_BACKEND_ROOT || "").trim();
let tenantCode = null;
let cleanupScript = null;
if (manifestEnv && fs.existsSync(path.resolve(manifestEnv))) {
  try {
    const candidate = String(readManifest(path.resolve(manifestEnv)).tenant_code || "").trim();
    if (/^qa-ymath-realuse-[a-z0-9-]+$/.test(candidate)) tenantCode = candidate;
  } catch {
    // The validated execution block below reports malformed manifests.
  }
}
if (backendRootEnv) {
  const candidate = path.join(
    path.resolve(backendRootEnv),
    "scripts",
    "v1",
    "destroy-ymath-login-uat-development.ps1",
  );
  if (fs.existsSync(candidate)) cleanupScript = candidate;
}

let outputDir = null;
const secret = String(process.env.YMATH_REALUSE_SCENARIO_PASSWORD || "");
let testExit = 1;
let leaked = false;
let cleanupVerified = false;
let primaryError = null;
let cleanupError = null;

try {
  const missing = REQUIRED_ENV.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length) fail(`Missing required iPhone login UAT environment: ${missing.join(", ")}`);
  if (process.env.E2E_ALLOW_PRODUCTION_WRITES !== "0") {
    fail("E2E_ALLOW_PRODUCTION_WRITES must be exactly 0.");
  }
  assertLoopback(process.env.E2E_BASE_URL, "E2E_BASE_URL");
  assertLoopback(process.env.E2E_API_URL, "E2E_API_URL");
  if (process.env.E2E_BASE_URL.replace(/\/+$/, "") !== "http://127.0.0.1:5174") {
    fail("E2E_BASE_URL must be the runner-owned http://127.0.0.1:5174 origin.");
  }

  const manifest = readManifest(path.resolve(manifestEnv));
  tenantCode = String(manifest.tenant_code || "").trim();
  if (!/^qa-ymath-realuse-[a-z0-9-]+$/.test(tenantCode)) {
    fail("Manifest tenant must use an exact qa-ymath-realuse-* code.");
  }
  if (!cleanupScript) fail("Dedicated persistent-development cleanup script was not found.");
  assertExactCheckout(process.env.E2E_LOGIN_UAT_FRONTEND_SHA.trim());

  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "academy-iphone-login-uat-"));
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "--config=playwright.iphone-login-uat.config.ts",
      "--project=chromium",
      "--project=webkit",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        VITE_DEV_PROXY_TARGET: process.env.E2E_API_URL.replace(/\/+$/, ""),
        E2E_LOGIN_UAT_OUTPUT_DIR: outputDir,
      },
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const combined = `${result.stdout || ""}${result.stderr || ""}`;
  leaked = combined.includes(secret) || secretAppearsInTree(outputDir, secret);
  process.stdout.write(combined.split(secret).join("[REDACTED]"));
  testExit = result.status ?? 1;
} catch (error) {
  primaryError = error;
} finally {
  try {
    if (tenantCode && cleanupScript) {
      const cleanupOutput = execFileSync(
        "pwsh",
        ["-NoProfile", "-File", cleanupScript, "-TenantCode", tenantCode],
        { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      );
      const lines = cleanupOutput.trim().split(/\r?\n/).reverse();
      const payload = JSON.parse(lines.find((line) => line.trim().startsWith("{")) || "{}");
      cleanupVerified = [
        "YMATH_REALUSE_SCENARIO_DESTROYED",
        "YMATH_REALUSE_SCENARIO_ABSENT",
      ].includes(payload.status)
        && payload.tenant_code === tenantCode
        && payload.remaining?.tenants === 0
        && payload.remaining?.users === 0;
      process.stdout.write(cleanupOutput);
    }
  } catch (error) {
    cleanupError = error;
  } finally {
    if (outputDir) fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

if (leaked) fail("UAT output contained the ephemeral login secret.");
if (tenantCode && !cleanupVerified) {
  if (cleanupError) throw cleanupError;
  fail("UAT cleanup did not prove remaining tenants/users = 0.");
}
if (primaryError) throw primaryError;
if (testExit !== 0) process.exit(testExit);
