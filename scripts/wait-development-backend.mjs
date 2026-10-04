import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertActiveInstance, assertDevelopmentInstanceIdentity, assertManifest } from "./run-development-release-canary.mjs";

const REPOSITORY = "guswls3028-art/academy-backend";
const WORKFLOW = ".github/workflows/v1-build-and-push-latest.yml";
const API = `https://api.github.com/repos/${REPOSITORY}`;
const ACTIVE_STATUSES = new Set(["queued", "in_progress", "waiting", "pending", "requested"]);

export function backendReadiness(snapshot) {
  const { revision, manifest, instances, releaseRun } = snapshot;
  assert.match(revision, /^[a-f0-9]{40}$/);
  assertManifest(manifest);
  // A release in progress never excuses an unexpected host identity or IAM profile.
  for (const instance of instances) assertDevelopmentInstanceIdentity(instance);
  assert.equal(releaseRun.path, WORKFLOW);
  assert.equal(releaseRun.head_branch, "main");
  assert.equal(releaseRun.head_repository.full_name, REPOSITORY);
  assert.ok(["push", "workflow_dispatch"].includes(releaseRun.event));
  assert.match(releaseRun.head_sha, /^[a-f0-9]{40}$/);
  assert.ok(Number.isSafeInteger(releaseRun.id) && releaseRun.id > 0);
  assert.ok(Number.isSafeInteger(releaseRun.run_attempt) && releaseRun.run_attempt > 0);
  if (ACTIVE_STATUSES.has(releaseRun.status)) {
    assert.equal(releaseRun.conclusion, null);
    return "release_running";
  }
  assert.equal(releaseRun.status, "completed");
  // No blind retry of a failed rollout, host drift, or a missing verified tag.
  assertActiveInstance(instances, manifest);
  return "ready";
}

export async function waitForBackend({ readSnapshot, persist, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 45 * 60_000, intervalMs = 30_000 }) {
  const started = now();
  let attempts = 0;
  let previousState;
  while (true) {
    attempts++;
    const snapshot = await readSnapshot();
    const state = backendReadiness(snapshot);
    const elapsedMs = now() - started;
    persist({ schemaVersion: 1, state, attempts, elapsedMs, backendRevision: snapshot.revision,
      backendReleaseId: snapshot.manifest.releaseImageTag, runId: snapshot.releaseRun.id,
      runAttempt: snapshot.releaseRun.run_attempt, instanceCount: snapshot.instances.length });
    assert.ok(elapsedMs <= timeoutMs, "Backend release readiness deadline exceeded");
    if (state === "ready") return snapshot;
    assert.ok(elapsedMs < timeoutMs, "Backend release readiness deadline exceeded");
    if (state !== previousState) console.log("Backend release is still running; waiting before development QA.");
    previousState = state;
    await sleep(Math.min(intervalMs, timeoutMs - elapsedMs));
  }
}

async function json(url) {
  const headers = { Accept: "application/vnd.github+json" };
  if (url.startsWith(`${API}/`) && process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, 200, "Backend readiness metadata unavailable");
  return response.json();
}

export async function readBackendRun(fetchJson) {
  // The newest run can be cancelled while an older run still owns the shared
  // release lock. Query active states rather than inferring idleness from it.
  const groups = await Promise.all([...ACTIVE_STATUSES].map((status) =>
    fetchJson(`${API}/actions/workflows/v1-build-and-push-latest.yml/runs?branch=main&status=${status}&per_page=100`)));
  for (const group of groups) assert.equal(group.total_count, group.workflow_runs.length, "Active release listing is incomplete");
  const active = groups.flatMap((group) => group.workflow_runs);
  if (active.length) return active.sort((a, b) => a.id - b.id)[0];
  const latest = await fetchJson(`${API}/actions/workflows/v1-build-and-push-latest.yml/runs?branch=main&per_page=1`);
  assert.equal(latest.workflow_runs.length, 1);
  return latest.workflow_runs[0];
}

async function readSnapshot() {
  // Read the run first: completion observed after an older manifest read must
  // not turn ordinary promotion into an immediate mismatch failure.
  const releaseRun = await readBackendRun(json);
  const revision = (await json(`${API}/commits/main`)).sha;
  assert.match(revision, /^[a-f0-9]{40}$/);
  const manifest = await json(`https://raw.githubusercontent.com/${REPOSITORY}/${revision}/docs/reports/release-manifest.latest.json`);
  let discovered;
  try {
    discovered = JSON.parse(execFileSync("aws", ["ec2", "describe-instances", "--filters",
      "Name=tag:Name,Values=academy-v1-api-development", "Name=tag:Lifecycle,Values=active",
      "Name=instance-state-name,Values=running", "--region", "ap-northeast-2", "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000, maxBuffer: 1024 * 1024 }));
  } catch { throw new Error("Development host discovery failed"); }
  return { revision, manifest, instances: discovered.Reservations.flatMap((item) => item.Instances),
    releaseRun };
}

export async function run() {
  const evidencePath = new URL("../test-results/backend-readiness.json", import.meta.url);
  fs.mkdirSync(path.dirname(fileURLToPath(evidencePath)), { recursive: true });
  const persist = (evidence) => fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  persist({ schemaVersion: 1, state: "checking" });
  try {
    assert.equal(process.env.GITHUB_ACTIONS, "true");
    assert.equal(process.env.GITHUB_REPOSITORY, "guswls3028-art/academy-frontend");
    assert.equal(process.env.GITHUB_REF, "refs/heads/main");
    await waitForBackend({ readSnapshot, persist });
  } catch {
    // Preserve only allowlisted metadata; CLI errors can contain environment data.
    const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    persist({ ...evidence, state: "failed" });
    throw new Error("Backend readiness failed closed; development QA was not started");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
