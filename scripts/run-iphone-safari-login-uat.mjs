import { execFileSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ORIGIN = "http://127.0.0.1:5174";
const API_ORIGIN = "http://127.0.0.1:18000";
const REGION = "ap-northeast-2";
const EXPECTED_RUNTIME_IDENTITY = Object.freeze({
  settingsModule: "apps.api.config.settings.development",
  databaseName: "academy_api_development",
  databaseUser: "academy_api_development_app",
  r2Bucket: "academy-development-artifacts",
  apiEnvParameter: "/academy/api/development/env",
  r2CredentialParameter: "/academy/r2/development/credentials",
});
const REQUIRED_ENV = [
  "E2E_LOGIN_UAT_FRONTEND_SHA",
  "E2E_LOGIN_UAT_BACKEND_SHA",
  "E2E_LOGIN_UAT_BACKEND_ROOT",
  "E2E_LOGIN_UAT_API_DIGEST",
  "E2E_LOGIN_UAT_AWS_PROFILE",
  "E2E_LOGIN_UAT_PASSWORD_PARAMETER",
];
const VITE_INPUT_RESIDUE = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
];

function fail(message) {
  throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function lastJsonLine(output) {
  const lines = String(output || "").trim().split(/\r?\n/).reverse();
  const candidate = lines.find((line) => line.trim().startsWith("{"));
  if (!candidate) fail("Expected a final JSON payload from persistent development.");
  return JSON.parse(candidate);
}

function assertLoopback(value, expected, label) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || value !== expected) {
    fail(`${label} must be the runner-owned ${expected}.`);
  }
}

function assertExactCheckout(root, expectedSha, label) {
  const actual = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (actual !== expectedSha) fail(`${label} checkout does not match its exact expected SHA.`);
  const dirty = execFileSync(
    "git",
    ["-C", root, "status", "--porcelain=v1", "--untracked-files=all"],
    { encoding: "utf8" },
  ).trim();
  if (dirty) fail(`${label} checkout must be clean, including untracked files.`);
}

export function assertNoViteInputResidue(root) {
  const residue = VITE_INPUT_RESIDUE.filter((name) => {
    if (!fs.existsSync(path.join(root, name))) return false;
    const tracked = spawnSync(
      "git",
      ["-C", root, "ls-files", "--error-unmatch", "--", name],
      { stdio: "ignore", windowsHide: true },
    );
    return tracked.status !== 0;
  });
  if (residue.length) {
    fail(`Frontend checkout contains forbidden untracked Vite env residue: ${residue.join(", ")}`);
  }
}

function awsJson(profile, args) {
  const output = execFileSync(
    "aws",
    [...args, "--profile", profile, "--region", REGION, "--output", "json"],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  return JSON.parse(output);
}

function selectActiveDevelopmentInstance(profile, backendSha) {
  const result = awsJson(profile, [
    "ec2", "describe-instances",
    "--filters",
    "Name=tag:Name,Values=academy-v1-api-development",
    "Name=tag:ManagedBy,Values=academy-api-development",
    "Name=tag:Lifecycle,Values=active",
    "Name=instance-state-name,Values=running",
  ]);
  const instances = (result.Reservations || []).flatMap((reservation) => reservation.Instances || []);
  if (instances.length !== 1) {
    fail(`Expected exactly one active persistent-development instance; actual=${instances.length}.`);
  }
  const instance = instances[0];
  const tags = Object.fromEntries((instance.Tags || []).map((tag) => [tag.Key, tag.Value]));
  if (tags.Environment !== "development") fail("Active instance is not tagged as development.");
  if (!/^[0-9a-f]{40}$/.test(backendSha)) {
    fail("E2E_LOGIN_UAT_BACKEND_SHA must be an exact lowercase commit SHA.");
  }
  const expectedRelease = new RegExp(`^sha-${backendSha}-run-[0-9]+-[0-9]+$`);
  if (!expectedRelease.test(String(tags.VerifiedReleaseId || ""))) {
    fail("Active instance VerifiedReleaseId does not match E2E_LOGIN_UAT_BACKEND_SHA.");
  }
  return { instanceId: String(instance.InstanceId), releaseId: String(tags.VerifiedReleaseId) };
}

async function runSsmShell(profile, instanceId, command, comment) {
  const sent = awsJson(profile, [
    "ssm", "send-command",
    "--instance-ids", instanceId,
    "--document-name", "AWS-RunShellScript",
    "--parameters", JSON.stringify({ commands: [command] }),
    "--timeout-seconds", "300",
    "--comment", comment,
  ]);
  const commandId = String(sent.Command?.CommandId || "");
  if (!commandId) fail("SSM command did not return an id.");

  for (let attempt = 0; attempt < 150; attempt += 1) {
    await sleep(2_000);
    const invocation = awsJson(profile, [
      "ssm", "get-command-invocation",
      "--command-id", commandId,
      "--instance-id", instanceId,
    ]);
    if (invocation.Status === "Success") return String(invocation.StandardOutputContent || "");
    if (["Failed", "Cancelled", "TimedOut", "Cancelling"].includes(invocation.Status)) {
      fail(`SSM ${comment} failed with status ${invocation.Status}: ${invocation.StandardErrorContent || ""}`);
    }
  }
  fail(`SSM ${comment} timed out.`);
}

async function inspectRuntime(profile, instanceId, releaseId, backendSha, expectedDigest) {
  const apiEnvResult = awsJson(profile, [
    "ssm", "get-parameter",
    "--name", EXPECTED_RUNTIME_IDENTITY.apiEnvParameter,
    "--with-decryption",
  ]);
  const r2CredentialResult = awsJson(profile, [
    "ssm", "get-parameter",
    "--name", EXPECTED_RUNTIME_IDENTITY.r2CredentialParameter,
    "--with-decryption",
  ]);
  assertDevelopmentParameterIdentity(apiEnvResult, r2CredentialResult, releaseId);

  const python = buildRuntimeInspectionPython();
  const command = [
    "set -euo pipefail",
    "api_image=$(docker inspect -f '{{.Config.Image}}' academy-api)",
    `docker exec -e UAT_INSTANCE_ID=${shellQuote(instanceId)} -e UAT_API_IMAGE="$api_image" academy-api python -c ${shellQuote(python)}`,
  ].join("; ");
  const payload = lastJsonLine(await runSsmShell(
    profile,
    instanceId,
    command,
    "Inspect iPhone login UAT development identity",
  ));
  const normalizedDigest = String(expectedDigest).replace(/^sha256:/, "");
  if (!/^[0-9a-f]{64}$/.test(normalizedDigest)) fail("E2E_LOGIN_UAT_API_DIGEST must be an exact sha256 digest.");
  assertRuntimeIdentity(payload, {
    instanceId,
    releaseId,
    backendSha,
    normalizedDigest,
  });
}

export function assertDevelopmentParameterIdentity(apiEnvResult, r2CredentialResult, releaseId) {
  let apiEnv;
  let r2Credential;
  try {
    apiEnv = JSON.parse(String(apiEnvResult?.Parameter?.Value || ""));
    r2Credential = JSON.parse(String(r2CredentialResult?.Parameter?.Value || ""));
  } catch {
    fail("Persistent-development SSM identity parameters are malformed.");
  }
  const buckets = [
    apiEnv.R2_STORAGE_BUCKET,
    apiEnv.R2_ADMIN_BUCKET,
    apiEnv.R2_AI_BUCKET,
    apiEnv.R2_EXCEL_BUCKET,
    apiEnv.R2_VIDEO_BUCKET,
  ];
  if (
    apiEnvResult?.Parameter?.Name !== EXPECTED_RUNTIME_IDENTITY.apiEnvParameter
    || r2CredentialResult?.Parameter?.Name !== EXPECTED_RUNTIME_IDENTITY.r2CredentialParameter
    || apiEnv.DJANGO_SETTINGS_MODULE !== EXPECTED_RUNTIME_IDENTITY.settingsModule
    || apiEnv.ACADEMY_RUNTIME_ENV !== "development"
    || apiEnv.ACADEMY_DEVELOPMENT_RELEASE_ID !== releaseId
    || apiEnv.DB_NAME !== EXPECTED_RUNTIME_IDENTITY.databaseName
    || apiEnv.DB_USER !== EXPECTED_RUNTIME_IDENTITY.databaseUser
    || buckets.some((bucket) => bucket !== EXPECTED_RUNTIME_IDENTITY.r2Bucket)
    || r2Credential.R2_BUCKET !== EXPECTED_RUNTIME_IDENTITY.r2Bucket
    || apiEnv.R2_ENDPOINT !== r2Credential.R2_ENDPOINT
    || apiEnv.R2_REGION !== r2Credential.R2_REGION
    || apiEnv.R2_ACCESS_KEY !== r2Credential.R2_ACCESS_KEY
    || apiEnv.R2_SECRET_KEY !== r2Credential.R2_SECRET_KEY
  ) {
    fail("Persistent-development SSM parameter identity does not match the exact development boundary.");
  }
}

export function assertRuntimeIdentity(payload, {
  instanceId,
  releaseId,
  backendSha,
  normalizedDigest,
}) {
  const expectedRelease = new RegExp(`^sha-${backendSha}-run-[0-9]+-[0-9]+$`);
  const imageDigest = String(payload.api_image || "").match(/@sha256:([0-9a-f]{64})$/)?.[1];
  const buckets = [
    payload.r2_storage_bucket,
    payload.r2_admin_bucket,
    payload.r2_ai_bucket,
    payload.r2_excel_bucket,
    payload.r2_video_bucket,
  ];
  if (
    payload.instance_id !== instanceId
    || payload.settings_module !== EXPECTED_RUNTIME_IDENTITY.settingsModule
    || payload.runtime_env !== "development"
    || payload.release_id !== releaseId
    || !expectedRelease.test(String(payload.release_id || ""))
    || imageDigest !== normalizedDigest
    || payload.database_name !== EXPECTED_RUNTIME_IDENTITY.databaseName
    || payload.database_user !== EXPECTED_RUNTIME_IDENTITY.databaseUser
    || payload.current_database_name !== EXPECTED_RUNTIME_IDENTITY.databaseName
    || payload.current_database_user !== EXPECTED_RUNTIME_IDENTITY.databaseUser
    || buckets.some((bucket) => bucket !== EXPECTED_RUNTIME_IDENTITY.r2Bucket)
  ) {
    fail("Persistent-development instance identity or DB/R2/image boundary mismatch.");
  }
}

export function buildRuntimeInspectionPython() {
  return [
    "import json, os",
    "from django.conf import settings",
    "from django.db import connection",
    "connection.ensure_connection()",
    "with connection.cursor() as cursor:",
    "    cursor.execute('SELECT current_database(), current_user')",
    "    current_database_name, current_database_user = cursor.fetchone()",
    "payload = {",
    "    'instance_id': os.environ.get('UAT_INSTANCE_ID'),",
    "    'api_image': os.environ.get('UAT_API_IMAGE'),",
    "    'settings_module': os.environ.get('DJANGO_SETTINGS_MODULE'),",
    "    'runtime_env': os.environ.get('ACADEMY_RUNTIME_ENV'),",
    "    'release_id': os.environ.get('ACADEMY_DEVELOPMENT_RELEASE_ID'),",
    "    'database_name': settings.DATABASES['default']['NAME'],",
    "    'database_user': settings.DATABASES['default']['USER'],",
    "    'current_database_name': current_database_name,",
    "    'current_database_user': current_database_user,",
    "    'r2_storage_bucket': settings.R2_STORAGE_BUCKET,",
    "    'r2_admin_bucket': settings.R2_ADMIN_BUCKET,",
    "    'r2_ai_bucket': settings.R2_AI_BUCKET,",
    "    'r2_excel_bucket': settings.R2_EXCEL_BUCKET,",
    "    'r2_video_bucket': settings.R2_VIDEO_BUCKET,",
    "}",
    "print(json.dumps(payload, sort_keys=True))",
  ].join("\n");
}

export async function isLoopbackPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function assertLoopbackPortFree(port) {
  if (!await isLoopbackPortFree(port)) {
    fail(`Loopback port ${port} is already bound; refusing to attach to an unowned service.`);
  }
}

function powershellJson(script, extraEnv = {}) {
  const output = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, ...extraEnv },
    },
  ).trim();
  return output ? JSON.parse(output) : [];
}

function asNumberArray(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.map(Number).filter((entry) => Number.isInteger(entry) && entry > 0);
}

export function windowsProcessTree(rootPid) {
  if (process.platform !== "win32") fail("iPhone login UAT process ownership requires Windows.");
  const script = [
    "$rootPid = [int]$env:ACADEMY_UAT_ROOT_PID",
    "$rows = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)",
    "$ids = [System.Collections.Generic.HashSet[int]]::new()",
    "$null = $ids.Add($rootPid)",
    "do {",
    "  $before = $ids.Count",
    "  foreach ($row in $rows) {",
    "    if ($ids.Contains([int]$row.ParentProcessId)) { $null = $ids.Add([int]$row.ProcessId) }",
    "  }",
    "} while ($ids.Count -gt $before)",
    "@($ids) | Sort-Object | ConvertTo-Json -Compress",
  ].join("\n");
  return asNumberArray(powershellJson(script, { ACADEMY_UAT_ROOT_PID: String(rootPid) }));
}

function windowsLoopbackListenerOwners(port) {
  const script = [
    "$port = [int]$env:ACADEMY_UAT_PORT",
    "$owners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -eq '127.0.0.1' } | Select-Object -ExpandProperty OwningProcess -Unique)",
    "$owners | ConvertTo-Json -Compress",
  ].join("\n");
  return asNumberArray(powershellJson(script, { ACADEMY_UAT_PORT: String(port) }));
}

export function assertWindowsOwnedPort(rootPid, port) {
  const processTree = windowsProcessTree(rootPid);
  const owners = windowsLoopbackListenerOwners(port);
  if (owners.length !== 1 || !processTree.includes(owners[0])) {
    fail(`Loopback port ${port} is not owned by the runner's SSM process tree.`);
  }
  return processTree;
}

function startOwnedTunnel(profile, instanceId) {
  if (process.platform !== "win32") fail("iPhone login UAT runner currently requires Windows process ownership checks.");
  return spawn("aws", [
    "ssm", "start-session",
    "--target", instanceId,
    "--document-name", "AWS-StartPortForwardingSession",
    "--parameters", "portNumber=8000,localPortNumber=18000",
    "--profile", profile,
    "--region", REGION,
  ], { stdio: "ignore", windowsHide: true });
}

async function waitForOwnedTunnel(tunnel) {
  let exited = false;
  tunnel.once("exit", () => { exited = true; });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (exited) fail("Runner-owned SSM tunnel exited before health verification.");
    try {
      const healthz = await fetch(`${API_ORIGIN}/healthz`);
      const health = await fetch(`${API_ORIGIN}/health`);
      if (healthz.status === 200 && health.status === 200) {
        return assertWindowsOwnedPort(tunnel.pid, 18000);
      }
    } catch {
      // Tunnel startup is asynchronous.
    }
    await sleep(1_000);
  }
  fail("Runner-owned SSM tunnel did not pass /healthz and /health.");
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForChildExit(child, timeoutMs = 10_000) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(timeoutMs).then(() => fail("Runner-owned SSM parent did not exit after process-tree termination.")),
  ]);
}

async function waitForPortClosed(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await isLoopbackPortFree(port)) return;
    await sleep(100);
  }
  fail(`Loopback port ${port} remained bound after runner-owned process-tree cleanup.`);
}

export async function terminateWindowsProcessTree(child, recordedPids, port) {
  if (process.platform !== "win32") fail("iPhone login UAT process cleanup requires Windows.");
  const rootPid = Number(child.pid);
  const currentPids = rootPid > 0 ? windowsProcessTree(rootPid) : [];
  const ownedPids = [...new Set([...(recordedPids || []), ...currentPids])]
    .filter((pid) => Number.isInteger(pid) && pid > 0)
    .sort((left, right) => right - left);

  if (rootPid > 0) {
    spawnSync("taskkill.exe", ["/PID", String(rootPid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
  }
  for (const pid of ownedPids) {
    if (!isProcessAlive(pid)) continue;
    spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
  }
  await waitForChildExit(child);
  await waitForPortClosed(port);
  const survivors = ownedPids.filter(isProcessAlive);
  if (survivors.length) fail(`Runner-owned SSM process tree survived cleanup: ${survivors.join(",")}.`);
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

function runBackendCleanup(backendRoot, tenantCode, instanceId, profile) {
  const cleanupScript = path.join(
    backendRoot,
    "scripts",
    "v1",
    "destroy-ymath-login-uat-development.ps1",
  );
  if (!fs.existsSync(cleanupScript)) fail("Backend login UAT cleanup script is missing.");
  return execFileSync(
    "pwsh",
    [
      "-NoProfile",
      "-File", cleanupScript,
      "-TenantCode", tenantCode,
      "-InstanceId", instanceId,
      "-AwsProfile", profile,
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true },
  );
}

async function main() {
  const missing = REQUIRED_ENV.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length) fail(`Missing required iPhone login UAT environment: ${missing.join(", ")}`);
  if (process.env.E2E_ALLOW_PRODUCTION_WRITES !== "0") {
    fail("E2E_ALLOW_PRODUCTION_WRITES must be exactly 0.");
  }
  assertLoopback(FRONTEND_ORIGIN, FRONTEND_ORIGIN, "frontend origin");
  assertLoopback(API_ORIGIN, API_ORIGIN, "API origin");
  await assertLoopbackPortFree(18000);

  const frontendRoot = process.cwd();
  const backendRoot = path.resolve(process.env.E2E_LOGIN_UAT_BACKEND_ROOT.trim());
  const frontendSha = process.env.E2E_LOGIN_UAT_FRONTEND_SHA.trim();
  const backendSha = process.env.E2E_LOGIN_UAT_BACKEND_SHA.trim();
  const profile = process.env.E2E_LOGIN_UAT_AWS_PROFILE.trim();
  const passwordParameter = process.env.E2E_LOGIN_UAT_PASSWORD_PARAMETER.trim();
  if (!/^\/academy\/[a-z0-9/_-]*development[a-z0-9/_-]*$/i.test(passwordParameter)) {
    fail("E2E_LOGIN_UAT_PASSWORD_PARAMETER must be a development-only /academy/* parameter.");
  }
  assertExactCheckout(frontendRoot, frontendSha, "Frontend");
  assertExactCheckout(backendRoot, backendSha, "Backend");
  assertNoViteInputResidue(frontendRoot);

  const passwordResult = awsJson(profile, [
    "ssm", "get-parameter",
    "--name", passwordParameter,
    "--with-decryption",
  ]);
  const secret = String(passwordResult.Parameter?.Value || "");
  if (!secret) fail("Development login UAT password parameter is empty.");

  const tenantCode = `qa-ymath-realuse-login-uat-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  if (!/^qa-ymath-realuse-[a-z0-9-]+$/.test(tenantCode)) fail("Generated tenant code is invalid.");
  const { instanceId, releaseId } = selectActiveDevelopmentInstance(profile, backendSha);
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "academy-iphone-login-uat-"));
  const manifestPath = path.join(outputDir, "manifest.json");
  let tunnel = null;
  let tunnelPids = [];
  let testExit = 1;
  let leaked = false;
  let primaryError = null;
  let cleanupError = null;
  let cleanupVerified = false;
  let setupAttempted = false;

  try {
    await inspectRuntime(profile, instanceId, releaseId, backendSha, process.env.E2E_LOGIN_UAT_API_DIGEST.trim());
    // Recheck immediately before spawn to close the validation-to-use window.
    await assertLoopbackPortFree(18000);
    tunnel = startOwnedTunnel(profile, instanceId);
    tunnelPids = await waitForOwnedTunnel(tunnel);

    const setupCommand = [
      "set -euo pipefail",
      `password=$(aws ssm get-parameter --name ${shellQuote(passwordParameter)} --with-decryption --query Parameter.Value --output text --region ${REGION})`,
      `docker exec -e YMATH_REALUSE_SCENARIO_PASSWORD="$password" academy-api python manage.py setup_ymath_realuse_scenario --tenant-code ${shellQuote(tenantCode)} --login-uat`,
      "unset password",
    ].join("; ");
    setupAttempted = true;
    const setupOutput = await runSsmShell(profile, instanceId, setupCommand, "Create exact iPhone login UAT tenant");
    const setupPayload = lastJsonLine(setupOutput);
    const manifest = setupPayload.login_manifest;
    if (
      setupPayload.status !== "YMATH_REALUSE_SCENARIO_READY"
      || setupPayload.tenant_code !== tenantCode
      || manifest?.tenant_code !== tenantCode
      || manifest?.account_count !== 30
    ) {
      fail("Persistent-development setup manifest does not match the runner-owned tenant.");
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), { encoding: "utf8", mode: 0o600 });

    const result = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "playwright", "test", "--config=playwright.iphone-login-uat.config.ts", "--project=chromium", "--project=webkit"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          E2E_BASE_URL: FRONTEND_ORIGIN,
          E2E_API_URL: API_ORIGIN,
          E2E_LOGIN_UAT_MANIFEST: manifestPath,
          E2E_LOGIN_UAT_OUTPUT_DIR: outputDir,
          YMATH_REALUSE_SCENARIO_PASSWORD: secret,
          VITE_DEV_PROXY_TARGET: API_ORIGIN,
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
      if (setupAttempted) {
        const cleanup = lastJsonLine(runBackendCleanup(
          backendRoot,
          tenantCode,
          instanceId,
          profile,
        ));
        cleanupVerified = ["YMATH_REALUSE_SCENARIO_DESTROYED", "YMATH_REALUSE_SCENARIO_ABSENT"].includes(cleanup.status)
          && cleanup.tenant_code === tenantCode
          && cleanup.remaining?.tenants === 0
          && cleanup.remaining?.users === 0;
        process.stdout.write(`${JSON.stringify(cleanup)}\n`);
      }
    } catch (error) {
      cleanupError = error;
    } finally {
      if (tunnel) {
        try {
          await terminateWindowsProcessTree(tunnel, tunnelPids, 18000);
        } catch (error) {
          cleanupError ??= error;
        }
      }
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  }

  if (leaked) fail("UAT output contained the ephemeral login secret.");
  if (cleanupError) throw cleanupError;
  if (setupAttempted && !cleanupVerified) {
    fail("UAT cleanup did not prove remaining tenants/users = 0 on the owned instance.");
  }
  if (primaryError) throw primaryError;
  if (testExit !== 0) process.exit(testExit);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
