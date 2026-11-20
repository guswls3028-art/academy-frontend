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

class ReadinessFailure extends Error {
  constructor(phase, code, httpStatus) {
    super(`Backend readiness ${phase}: ${code}`);
    this.receipt = { phase, code, ...(httpStatus === undefined ? {} : { httpStatus }) };
  }
}

function checked(phase, code, runCheck) {
  try { return runCheck(); }
  catch { throw new ReadinessFailure(phase, code); }
}

function assertReleaseRunIdentity(run) {
  assert.equal(run.path, WORKFLOW);
  assert.equal(run.head_branch, "main");
  assert.equal(run.head_repository.full_name, REPOSITORY);
  assert.ok(["push", "workflow_dispatch"].includes(run.event));
  assert.match(run.head_sha, /^[a-f0-9]{40}$/);
  assert.ok(Number.isSafeInteger(run.id) && run.id > 0);
  assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0);
}

function releaseTag(run) {
  return `sha-${run.head_sha}-run-${run.id}-${run.run_attempt}`;
}

const NOOP_RUNTIME_JOBS = [
  "Assemble and scan release candidate",
  "Verify candidate on persistent isolated development runtime",
  "Verify deployment",
];

function exactNoopReceipt({ releaseRun, manifest, noopJobs, manifestRun }) {
  checked("noop_jobs", "runtime_not_skipped", () => {
    for (const name of NOOP_RUNTIME_JOBS) {
      const matching = noopJobs.filter(job => job.name === name);
      assert.equal(matching.length, 1);
      const [job] = matching;
      assert.equal(job.run_id, releaseRun.id);
      assert.equal(job.run_attempt, releaseRun.run_attempt);
      assert.equal(job.head_sha, releaseRun.head_sha);
      assert.equal(job.status, "completed");
      assert.equal(job.conclusion, "skipped");
    }
  });
  checked("manifest_origin", "lineage", () => {
    assertReleaseRunIdentity(manifestRun);
    assert.equal(manifestRun.status, "completed");
    assert.equal(manifestRun.conclusion, "success");
    assert.equal(releaseTag(manifestRun), manifest.releaseImageTag);
    assert.ok(manifestRun.id < releaseRun.id
      || (manifestRun.id === releaseRun.id && manifestRun.run_attempt < releaseRun.run_attempt));
  });
}

function verifySnapshot(snapshot) {
  const { revision, manifest, instances, releaseRun } = snapshot;
  checked("main_revision", "shape", () => assert.match(revision, /^[a-f0-9]{40}$/));
  checked("manifest", "shape", () => assertManifest(manifest));
  // A release in progress never excuses an unexpected host identity or IAM profile.
  checked("host_verification", "identity", () => {
    for (const instance of instances) assertDevelopmentInstanceIdentity(instance);
  });
  checked("release_run", "identity", () => assertReleaseRunIdentity(releaseRun));
  if (ACTIVE_STATUSES.has(releaseRun.status)) {
    checked("release_run", "status", () => assert.equal(releaseRun.conclusion, null));
    return "release_running";
  }
  checked("release_run", "status", () => assert.equal(releaseRun.status, "completed"));
  checked("release_run", "unsuccessful", () => assert.equal(releaseRun.conclusion, "success"));
  checked("host_verification", "manifest_mismatch", () => assertActiveInstance(instances, manifest));
  return "ready";
}

export function backendReadiness(snapshot) {
  if (verifySnapshot(snapshot) === "release_running") return "release_running";
  const { releaseRun, manifest } = snapshot;
  // An exact no-op can retain the last successful release. Its own latest run
  // must not have entered any runtime build, development or promotion step.
  if (releaseTag(releaseRun) !== manifest.releaseImageTag) exactNoopReceipt(snapshot);
  return "ready";
}

export async function waitForBackend({ readSnapshot, persist, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 45 * 60_000, intervalMs = 30_000 }) {
  const started = now();
  let attempts = 0;
  let listingRetries = 0;
  let previousState;
  while (true) {
    attempts++;
    let snapshot;
    try { snapshot = await readSnapshot(); }
    catch (error) {
      if (!(error instanceof ReadinessFailure) || error.receipt.phase !== "active_run_listing"
        || error.receipt.code !== "inconsistent" || listingRetries >= 2) throw error;
      const elapsedMs = now() - started;
      checked("wait_deadline", "deadline", () => assert.ok(elapsedMs < timeoutMs));
      listingRetries++;
      persist({ schemaVersion: 1, state: "checking", attempts, elapsedMs, listingRetries,
        failure: error.receipt });
      await sleep(Math.min(listingRetries * 1_000, timeoutMs - elapsedMs));
      continue;
    }
    const state = backendReadiness(snapshot);
    const elapsedMs = now() - started;
    persist({ schemaVersion: 1, state, attempts, elapsedMs, backendRevision: snapshot.revision,
      backendReleaseId: snapshot.manifest.releaseImageTag, runId: snapshot.releaseRun.id,
      runAttempt: snapshot.releaseRun.run_attempt, instanceCount: snapshot.instances.length,
      ...(listingRetries ? { listingRetries } : {}) });
    checked("wait_deadline", "deadline", () => assert.ok(elapsedMs <= timeoutMs));
    if (state === "ready") return snapshot;
    checked("wait_deadline", "deadline", () => assert.ok(elapsedMs < timeoutMs));
    if (state !== previousState) console.log("Backend release is still running; waiting before development QA.");
    previousState = state;
    await sleep(Math.min(intervalMs, timeoutMs - elapsedMs));
  }
}

async function json(url, phase) {
  const headers = { Accept: "application/vnd.github+json" };
  if (url.startsWith(`${API}/`) && process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  let response;
  try { response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(20_000) }); }
  catch (error) { throw new ReadinessFailure(phase, error?.name === "TimeoutError" ? "timeout" : "transport"); }
  if (response.status !== 200) throw new ReadinessFailure(phase, "http_status", response.status);
  try { return await response.json(); }
  catch { throw new ReadinessFailure(phase, "shape"); }
}

export async function readBackendRun(fetchJson) {
  // The newest run can be cancelled while an older run still owns the shared
  // release lock. Query active states rather than inferring idleness from it.
  const groups = await Promise.all([...ACTIVE_STATUSES].map((status) =>
    fetchJson(`${API}/actions/workflows/v1-build-and-push-latest.yml/runs?branch=main&status=${status}&per_page=100`, "active_run_listing")));
  checked("active_run_listing", "shape", () => {
    for (const group of groups) {
      assert.ok(Number.isSafeInteger(group?.total_count) && group.total_count >= 0);
      assert.ok(Array.isArray(group.workflow_runs) && group.workflow_runs.length <= 100);
    }
  });
  checked("active_run_listing", "incomplete", () => {
    for (const group of groups) assert.ok(group.total_count <= 100);
  });
  // A GitHub run can finish between the listing count and its returned rows.
  checked("active_run_listing", "inconsistent", () => {
    for (const group of groups) assert.equal(group.total_count, group.workflow_runs.length);
  });
  const active = groups.flatMap((group) => group.workflow_runs);
  if (active.length) return active.sort((a, b) => a.id - b.id)[0];
  const latest = await fetchJson(`${API}/actions/workflows/v1-build-and-push-latest.yml/runs?branch=main&per_page=1`, "latest_run");
  return checked("latest_run", "shape", () => {
    assert.equal(latest.workflow_runs.length, 1);
    return latest.workflow_runs[0];
  });
}

async function readSnapshot() {
  // Read the run first: completion observed after an older manifest read must
  // not turn ordinary promotion into an immediate mismatch failure.
  const releaseRun = await readBackendRun(json);
  const main = await json(`${API}/commits/main`, "main_revision");
  const revision = main?.sha;
  checked("main_revision", "shape", () => assert.match(revision, /^[a-f0-9]{40}$/));
  const manifest = await json(`https://raw.githubusercontent.com/${REPOSITORY}/${revision}/docs/reports/release-manifest.latest.json`, "manifest");
  checked("manifest", "shape", () => assertManifest(manifest));
  let discovered;
  try {
    discovered = execFileSync("aws", ["ec2", "describe-instances", "--filters",
      "Name=tag:Name,Values=academy-v1-api-development", "Name=tag:Lifecycle,Values=active",
      "Name=instance-state-name,Values=running", "--region", "ap-northeast-2", "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000, maxBuffer: 1024 * 1024 });
  } catch (error) { throw new ReadinessFailure("host_discovery", error?.code === "ETIMEDOUT" ? "timeout" : "command"); }
  const instances = checked("host_discovery", "shape", () => JSON.parse(discovered).Reservations.flatMap(item => item.Instances));
  const snapshot = { revision, manifest, instances, releaseRun };
  if (verifySnapshot(snapshot) === "ready" && releaseTag(releaseRun) !== manifest.releaseImageTag) {
    const jobs = await json(`${API}/actions/runs/${releaseRun.id}/attempts/${releaseRun.run_attempt}/jobs?per_page=100`, "noop_jobs");
    snapshot.noopJobs = checked("noop_jobs", "incomplete", () => {
      assert.equal(jobs.total_count, jobs.jobs.length);
      return jobs.jobs;
    });
    const [, runId, attempt] = /-run-(\d+)-(\d+)$/.exec(manifest.releaseImageTag);
    snapshot.manifestRun = await json(`${API}/actions/runs/${runId}/attempts/${attempt}`, "manifest_origin");
  }
  return snapshot;
}

export function sanitizedReadinessFailure(error) {
  return error instanceof ReadinessFailure ? error.receipt : { phase: "readiness", code: "unexpected" };
}

export async function run() {
  const evidencePath = new URL("../test-results/backend-readiness.json", import.meta.url);
  fs.mkdirSync(path.dirname(fileURLToPath(evidencePath)), { recursive: true });
  const persist = (evidence) => fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  persist({ schemaVersion: 1, state: "checking" });
  try {
    checked("runner_identity", "identity", () => {
      assert.equal(process.env.GITHUB_ACTIONS, "true");
      assert.equal(process.env.GITHUB_REPOSITORY, "guswls3028-art/academy-frontend");
      assert.equal(process.env.GITHUB_REF, "refs/heads/main");
    });
    await waitForBackend({ readSnapshot, persist });
  } catch (error) {
    // Preserve only allowlisted metadata; CLI errors can contain environment data.
    const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    persist({ ...evidence, state: "failed", failure: sanitizedReadinessFailure(error) });
    throw new Error("Backend readiness failed closed; development QA was not started");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
