import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertDevelopmentParameterIdentity,
  assertLoopbackPortFree,
  assertNoViteInputResidue,
  assertRuntimeIdentity,
  assertWindowsOwnedPort,
  buildPnpmInvocation,
  buildRuntimeInspectionPython,
  isLoopbackPortFree,
  terminateWindowsProcessTree,
} from "../run-iphone-safari-login-uat.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function listen(port = 0) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function waitFor(check, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return check();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError ?? new Error("condition did not become true");
}

test("remote runtime inspection Python is one compilable script", () => {
  const source = buildRuntimeInspectionPython();
  assert.match(source, /payload = \{/);
  assert.match(source, /print\(json\.dumps\(payload, sort_keys=True\)\)/);
  assert.doesNotMatch(source, /;\s*'/);

  const python = process.platform === "win32" ? "python.exe" : "python3";
  const compiled = spawnSync(
    python,
    ["-c", "import sys; compile(sys.stdin.read(), '<iphone-login-uat>', 'exec')"],
    { input: source, encoding: "utf8", windowsHide: true },
  );
  assert.equal(compiled.status, 0, compiled.stderr || compiled.stdout);
});

test("runtime and SSM identities require exact development values", () => {
  const backendSha = "a".repeat(40);
  const releaseId = `sha-${backendSha}-run-123-1`;
  const digest = "b".repeat(64);
  const apiEnv = {
    DJANGO_SETTINGS_MODULE: "apps.api.config.settings.development",
    ACADEMY_RUNTIME_ENV: "development",
    ACADEMY_DEVELOPMENT_RELEASE_ID: releaseId,
    DB_NAME: "academy_api_development",
    DB_USER: "academy_api_development_app",
    R2_STORAGE_BUCKET: "academy-development-artifacts",
    R2_ADMIN_BUCKET: "academy-development-artifacts",
    R2_AI_BUCKET: "academy-development-artifacts",
    R2_EXCEL_BUCKET: "academy-development-artifacts",
    R2_VIDEO_BUCKET: "academy-development-artifacts",
    R2_ENDPOINT: "https://development.r2.example.test",
    R2_REGION: "auto",
    R2_ACCESS_KEY: "test-access",
    R2_SECRET_KEY: "test-secret",
  };
  const r2Credential = {
    R2_BUCKET: "academy-development-artifacts",
    R2_ENDPOINT: apiEnv.R2_ENDPOINT,
    R2_REGION: apiEnv.R2_REGION,
    R2_ACCESS_KEY: apiEnv.R2_ACCESS_KEY,
    R2_SECRET_KEY: apiEnv.R2_SECRET_KEY,
  };
  const apiEnvResult = {
    Parameter: { Name: "/academy/api/development/env", Value: JSON.stringify(apiEnv) },
  };
  const r2CredentialResult = {
    Parameter: {
      Name: "/academy/r2/development/credentials",
      Value: JSON.stringify(r2Credential),
    },
  };
  assert.doesNotThrow(() => {
    assertDevelopmentParameterIdentity(apiEnvResult, r2CredentialResult, releaseId);
  });

  const payload = {
    instance_id: "i-0123456789abcdef0",
    api_image: `example.test/academy-api@sha256:${digest}`,
    settings_module: apiEnv.DJANGO_SETTINGS_MODULE,
    runtime_env: apiEnv.ACADEMY_RUNTIME_ENV,
    release_id: releaseId,
    database_name: apiEnv.DB_NAME,
    database_user: apiEnv.DB_USER,
    current_database_name: apiEnv.DB_NAME,
    current_database_user: apiEnv.DB_USER,
    r2_storage_bucket: apiEnv.R2_STORAGE_BUCKET,
    r2_admin_bucket: apiEnv.R2_ADMIN_BUCKET,
    r2_ai_bucket: apiEnv.R2_AI_BUCKET,
    r2_excel_bucket: apiEnv.R2_EXCEL_BUCKET,
    r2_video_bucket: apiEnv.R2_VIDEO_BUCKET,
  };
  const expected = {
    instanceId: payload.instance_id,
    releaseId,
    backendSha,
    normalizedDigest: digest,
  };
  assert.doesNotThrow(() => assertRuntimeIdentity(payload, expected));

  for (const [field, value] of [
    ["settings_module", "apps.api.config.settings.development-extra"],
    ["database_name", "academy_api_development_shadow"],
    ["database_user", "academy_api_development_app_shadow"],
    ["current_database_user", "academy_api_development_app_shadow"],
    ["r2_storage_bucket", "academy-development-artifacts-shadow"],
  ]) {
    assert.throws(
      () => assertRuntimeIdentity({ ...payload, [field]: value }, expected),
      /identity or DB\/R2\/image boundary mismatch/,
    );
  }
  assert.throws(
    () => assertDevelopmentParameterIdentity(
      { ...apiEnvResult, Parameter: { ...apiEnvResult.Parameter, Name: "/academy/api/development/env:1" } },
      r2CredentialResult,
      releaseId,
    ),
    /exact development boundary/,
  );
});

test("pre-bound loopback port fails closed before tunnel startup", async () => {
  const server = await listen();
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  try {
    await assert.rejects(
      assertLoopbackPortFree(port),
      new RegExp(`Loopback port ${port} is already bound`),
    );
  } finally {
    await close(server);
  }
  assert.equal(await isLoopbackPortFree(port), true);
});

test("tracked Vite env inputs are allowed while local override residue fails", () => {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "academy-iphone-login-uat-env-"));
  try {
    execFileSync("git", ["init", "--quiet", checkout], { windowsHide: true });
    fs.writeFileSync(path.join(checkout, ".env.development"), "VITE_DEV_PROXY_TARGET=http://127.0.0.1:9\n");
    execFileSync("git", ["-C", checkout, "add", ".env.development"], { windowsHide: true });
    assert.doesNotThrow(() => assertNoViteInputResidue(checkout));

    fs.writeFileSync(path.join(checkout, ".env.local"), "VITE_DEV_PROXY_TARGET=http://127.0.0.1:8\n");
    assert.throws(
      () => assertNoViteInputResidue(checkout),
      /forbidden untracked Vite env residue: \.env\.local/,
    );
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true });
  }
});

test("Windows pnpm invocation uses cmd instead of spawning a cmd shim directly", () => {
  assert.deepEqual(
    buildPnpmInvocation(["--version"], "win32", "C:\\Windows\\System32\\cmd.exe"),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", "--version"],
    },
  );
  assert.deepEqual(
    buildPnpmInvocation(["--version"], "linux"),
    { command: "pnpm", args: ["--version"] },
  );
});

test("login manifest stays outside the Playwright-cleaned output directory", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts/run-iphone-safari-login-uat.mjs"),
    "utf8",
  );
  assert.match(source, /const manifestPath = path\.join\(outputDir, "manifest\.json"\)/);
  assert.match(source, /const playwrightOutputDir = path\.join\(outputDir, "playwright"\)/);
  assert.match(source, /E2E_LOGIN_UAT_OUTPUT_DIR: playwrightOutputDir/);
  assert.doesNotMatch(source, /E2E_LOGIN_UAT_OUTPUT_DIR: outputDir/);
});

test("runner contract owns port 18000 before health and awaits process-tree cleanup", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts/run-iphone-safari-login-uat.mjs"),
    "utf8",
  );
  const prebind = source.indexOf("await assertLoopbackPortFree(18000)");
  const spawnTunnel = source.indexOf("tunnel = startOwnedTunnel");
  const health = source.indexOf("await waitForOwnedTunnel(tunnel)");
  assert.ok(prebind >= 0 && prebind < spawnTunnel && spawnTunnel < health);
  assert.match(source, /assertWindowsOwnedPort\(tunnel\.pid, 18000\)/);
  assert.match(source, /await terminateWindowsProcessTree\(tunnel, tunnelPids, 18000\)/);
  assert.doesNotMatch(source, /tunnel\.kill\(/);
});

test("runner cleanup starts only after setup dispatch and uses the backend-owned destroy contract", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts/run-iphone-safari-login-uat.mjs"),
    "utf8",
  );
  const preflight = source.indexOf("await inspectRuntime(");
  const setupAttempted = source.indexOf("setupAttempted = true");
  const setupDispatch = source.indexOf("const setupOutput = await runSsmShell(");
  const cleanupGuard = source.indexOf("if (setupAttempted)");
  assert.ok(preflight >= 0 && preflight < setupAttempted && setupAttempted < setupDispatch);
  assert.ok(cleanupGuard > setupDispatch);
  assert.match(source, /destroy-ymath-login-uat-development\.ps1/);
  assert.match(source, /if \(setupAttempted && !cleanupVerified\)/);
  assert.doesNotMatch(source, /setup_ymath_realuse_scenario --tenant-code .* --destroy/);
});

test("persistent UAT logout verifies active generation envelope and landing", () => {
  const source = fs.readFileSync(
    path.join(root, "e2e/auth/iphone-safari-login.persistent-development.spec.ts"),
    "utf8",
  );
  assert.match(source, /academy:auth-active-generation:v1/);
  assert.match(source, /academy:auth-tokens:v1:\$\{pointer\}/);
  assert.match(source, /activeEnvelope:\s*null/);
  assert.match(source, /toHaveURL\(`\$\{BASE\}\/`/);
});

test("Windows cleanup terminates a child listener process and closes its port", {
  skip: process.platform !== "win32",
}, async () => {
  const reservation = await listen();
  const address = reservation.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await close(reservation);

  const listenerScript = [
    "const net = require('node:net')",
    `net.createServer().listen(${port}, '127.0.0.1')`,
    "setInterval(() => {}, 1000)",
  ].join(";");
  const parentScript = [
    "const { spawn } = require('node:child_process')",
    `spawn(process.execPath, ['-e', ${JSON.stringify(listenerScript)}], { stdio: 'ignore', windowsHide: true })`,
    "setInterval(() => {}, 1000)",
  ].join(";");
  const parent = spawn(process.execPath, ["-e", parentScript], {
    stdio: "ignore",
    windowsHide: true,
  });

  let ownedPids = [];
  try {
    ownedPids = await waitFor(() => assertWindowsOwnedPort(parent.pid, port));
    assert.ok(ownedPids.length >= 2);
    await terminateWindowsProcessTree(parent, ownedPids, port);
    assert.equal(await isLoopbackPortFree(port), true);
    for (const pid of ownedPids) {
      assert.throws(() => process.kill(pid, 0));
    }
  } finally {
    if (parent.exitCode === null) {
      spawnSync("taskkill.exe", ["/PID", String(parent.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    }
  }
});
