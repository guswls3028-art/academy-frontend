import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { backendReadiness, readBackendRun, sanitizedReadinessFailure, waitForBackend } from "../wait-development-backend.mjs";

function snapshot({ running = false, promoted = true } = {}) {
  const revision = "a".repeat(40);
  const release = `sha-${revision}-run-123-1`;
  return { revision,
    manifest: { schemaVersion: 1, complete: true, status: "successful", gitSha: revision,
      releaseImageTag: promoted ? release : `sha-${revision}-run-122-1`,
      images: { "academy-api": { digest: `sha256:${"b".repeat(64)}` } } },
    instances: [{ InstanceId: "i-0123456789abcdef0", State: { Name: "running" },
      IamInstanceProfile: { Arn: "arn:aws:iam::809466760795:instance-profile/academy-api-development" },
      Tags: Object.entries({ Name: "academy-v1-api-development", ManagedBy: "academy-api-development",
        Environment: "development", Lifecycle: "active", ReleaseId: release, VerifiedReleaseId: release })
        .map(([Key, Value]) => ({ Key, Value })) }],
    releaseRun: { id: 123, run_attempt: 1, head_sha: revision, head_branch: "main", event: "push",
      head_repository: { full_name: "guswls3028-art/academy-backend" },
      path: ".github/workflows/v1-build-and-push-latest.yml",
      status: running ? "in_progress" : "completed", conclusion: running ? null : "success" } };
}

test("a newer development host waits for manifest promotion and then proceeds once", async () => {
  const reads = [snapshot({ running: true, promoted: false }), snapshot()];
  const evidence = [];
  let time = 0;
  const ready = await waitForBackend({ readSnapshot: async () => reads.shift(), persist: (value) => evidence.push(value),
    now: () => time, sleep: async (ms) => { time += ms; }, intervalMs: 10, timeoutMs: 100 });
  assert.equal(ready.manifest.releaseImageTag, snapshot().manifest.releaseImageTag);
  assert.deepEqual(evidence.map((item) => item.state), ["release_running", "ready"]);
  assert.equal(evidence.at(-1).elapsedMs, 10);
  assert.equal(reads.length, 0);
});

test("matching old tags do not start QA while a new backend release is active", () => {
  assert.equal(backendReadiness(snapshot({ running: true })), "release_running");
});

test("an older active release cannot be hidden by a newer cancelled run", async () => {
  let latestRead = false;
  const active = snapshot({ running: true }).releaseRun;
  const result = await readBackendRun(async (url) => {
    const status = new URL(url).searchParams.get("status");
    if (!status) { latestRead = true; return { workflow_runs: [{ ...active, id: 124, status: "completed", conclusion: "cancelled" }] }; }
    return { total_count: status === "in_progress" ? 1 : 0, workflow_runs: status === "in_progress" ? [active] : [] };
  });
  assert.equal(result.id, active.id);
  assert.equal(latestRead, false);
  await assert.rejects(readBackendRun(async () => ({ total_count: 101, workflow_runs: [] })), /incomplete/);
});

test("inconsistent listing retries every group without hiding another active release", async () => {
  let rounds = 0;
  let hostReads = 0;
  let latestReads = 0;
  let time = 0;
  const groups = [];
  const sleeps = [];
  const evidence = [];
  const value = await waitForBackend({
    readSnapshot: async () => {
      const round = ++rounds;
      const releaseRun = await readBackendRun(async url => {
        const status = new URL(url).searchParams.get("status");
        if (!status) {
          latestReads++;
          assert.equal(round, 3);
          return { workflow_runs: [snapshot().releaseRun] };
        }
        groups.push({ round, status });
        if (round === 1 && status === "queued") return { total_count: 1, workflow_runs: [] };
        const active = round <= 2 && status === "in_progress";
        return { total_count: active ? 1 : 0,
          workflow_runs: active ? [snapshot({ running: true }).releaseRun] : [] };
      });
      hostReads++;
      return { ...snapshot(), releaseRun };
    },
    persist: value => evidence.push(value),
    now: () => time,
    sleep: async ms => { sleeps.push(ms); time += ms; },
    timeoutMs: 10_000,
    intervalMs: 10,
  });
  assert.equal(value.releaseRun.status, "completed");
  assert.equal(hostReads, 2);
  assert.equal(latestReads, 1);
  assert.deepEqual(sleeps, [1000, 10]);
  assert.equal(evidence[0].state, "checking");
  assert.equal(evidence[0].listingRetries, 1);
  assert.equal(evidence.at(-1).state, "ready");
  assert.equal(evidence.at(-1).listingRetries, 1);
  for (const round of [1, 2, 3]) {
    assert.equal(groups.filter(group => group.round === round).length, 5);
  }
});

test("persistent coherent-shaped mismatch exhausts two retries without reading latest or hosts", async () => {
  let reads = 0;
  let time = 0;
  const sleeps = [];
  const evidence = [];
  await assert.rejects(waitForBackend({
    readSnapshot: async () => {
      reads++;
      await readBackendRun(async url => {
        const status = new URL(url).searchParams.get("status");
        assert.ok(status, "partial listings cannot fall back to latest");
        return { total_count: status === "queued" ? 1 : 0, workflow_runs: [] };
      });
      assert.fail("partial listing cannot reach host discovery");
    },
    persist: value => evidence.push(value),
    now: () => time,
    sleep: async ms => { sleeps.push(ms); time += ms; },
    timeoutMs: 10_000,
  }), error => {
    assert.deepEqual(sanitizedReadinessFailure(error), { phase: "active_run_listing", code: "inconsistent" });
    return true;
  });
  assert.equal(reads, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
  assert.deepEqual(evidence.map(value => value.listingRetries), [1, 2]);
  assert(evidence.every(value => value.state === "checking"));
});

test("malformed or overflowing listings and HTTP failures never use inconsistency retries", async () => {
  for (const group of [
    null, {}, { total_count: -1, workflow_runs: [] }, { total_count: 0.5, workflow_runs: [] },
    { total_count: "0", workflow_runs: [] }, { total_count: Number.MAX_SAFE_INTEGER + 1, workflow_runs: [] },
    { total_count: 0, workflow_runs: {} }, { total_count: 101, workflow_runs: [] },
    { total_count: 101, workflow_runs: Array.from({ length: 101 }, () => ({})) },
  ]) {
    let reads = 0;
    await assert.rejects(waitForBackend({
      readSnapshot: async () => {
        reads++;
        const releaseRun = await readBackendRun(async () => group);
        return { ...snapshot(), releaseRun };
      },
      persist: () => {},
      sleep: async () => assert.fail("invalid listing must fail immediately"),
    }), error => {
      assert.notEqual(sanitizedReadinessFailure(error).code, "inconsistent");
      return true;
    });
    assert.equal(reads, 1);
  }
  const unavailable = new Error("synthetic HTTP 503");
  await assert.rejects(waitForBackend({
    readSnapshot: async () => readBackendRun(async () => { throw unavailable; }),
    persist: () => {},
    sleep: async () => assert.fail("unclassified HTTP failure must fail immediately"),
  }), error => error === unavailable);
});

test("inconsistency backoff cannot extend the original deadline", async () => {
  let time = 0;
  let reads = 0;
  const sleeps = [];
  await assert.rejects(waitForBackend({
    readSnapshot: async () => {
      reads++;
      const releaseRun = await readBackendRun(async () => ({ total_count: 1, workflow_runs: [] }));
      return { ...snapshot(), releaseRun };
    },
    persist: () => {},
    now: () => time,
    sleep: async ms => { sleeps.push(ms); time += ms; },
    timeoutMs: 1500,
  }));
  assert.ok(time <= 1500);
  assert.ok(reads <= 3);
  assert.deepEqual(sleeps, [1000, 500]);
});

test("drift and terminal failure are never retried as ordinary release progress", async () => {
  const failed = snapshot({ promoted: false });
  failed.releaseRun.conclusion = "failure";
  const wrongProfile = snapshot({ running: true });
  wrongProfile.instances[0].IamInstanceProfile.Arn = "production";
  const unverified = snapshot();
  unverified.instances[0].Tags = unverified.instances[0].Tags.filter((tag) => tag.Key !== "VerifiedReleaseId");
  const foreignRun = snapshot({ running: true });
  foreignRun.releaseRun.head_repository.full_name = "foreign/backend";
  const incomplete = snapshot({ running: true });
  incomplete.manifest.complete = false;
  for (const value of [failed, wrongProfile, unverified, foreignRun, incomplete,
    { ...snapshot(), instances: [] }, { ...snapshot(), instances: [...snapshot().instances, ...snapshot().instances] }]) {
    await assert.rejects(waitForBackend({ readSnapshot: async () => value, persist: () => {},
      sleep: async () => assert.fail("invalid baseline must fail immediately") }));
  }
});

test("matching old host and manifest do not admit a different terminal release", () => {
  for (const changes of [
    { conclusion: "failure" }, { conclusion: "cancelled" },
    { head_sha: "e".repeat(40) }, { id: 124 }, { run_attempt: 2 },
  ]) {
    const value = snapshot();
    value.releaseRun = { ...value.releaseRun, ...changes };
    assert.throws(() => backendReadiness(value),
      changes.conclusion ? /release_run: unsuccessful/ : /noop_jobs: runtime_not_skipped/);
  }
});

test("only verified skipped runtime jobs admit an existing successfully promoted release", () => {
  const value = snapshot();
  value.manifestRun = value.releaseRun;
  value.releaseRun = { ...value.releaseRun, id: 124, head_sha: "c".repeat(40) };
  value.noopJobs = [
    "Assemble and scan release candidate",
    "Verify candidate on persistent isolated development runtime",
    "Verify deployment",
  ].map(name => ({ name, run_id: 124, run_attempt: 1, head_sha: value.releaseRun.head_sha, status: "completed", conclusion: "skipped" }));
  assert.equal(backendReadiness(value), "ready");
  assert.throws(() => backendReadiness({ ...value, noopJobs: value.noopJobs.slice(1) }), /noop_jobs/);
  for (const field of [{ run_id: 123 }, { run_attempt: 2 }, { head_sha: "d".repeat(40) }, { conclusion: "success" }]) {
    const noopJobs = value.noopJobs.map((job, index) => index === 2 ? { ...job, ...field } : job);
    assert.throws(() => backendReadiness({ ...value, noopJobs }), /noop_jobs/);
  }
  for (const field of [{ id: 122 }, { run_attempt: 2 }, { head_sha: "d".repeat(40) }, { conclusion: "failure" }]) {
    assert.throws(() => backendReadiness({ ...value, manifestRun: { ...value.manifestRun, ...field } }), /manifest_origin/);
  }
});

test("failure receipt exposes typed stage and code only", () => {
  const invalid = snapshot({ promoted: false });
  assert.throws(() => backendReadiness(invalid), error => {
    assert.deepEqual(sanitizedReadinessFailure(error), { phase: "host_verification", code: "manifest_mismatch" });
    return true;
  });
  assert.deepEqual(sanitizedReadinessFailure(new Error("synthetic private detail")),
    { phase: "readiness", code: "unexpected" });
});

test("waiting is bounded and metadata read failures are not swallowed", async () => {
  let time = 0;
  let reads = 0;
  await assert.rejects(waitForBackend({ readSnapshot: async () => { reads++; return snapshot({ running: true }); },
    persist: () => {}, now: () => time, sleep: async (ms) => { time += ms; }, timeoutMs: 25, intervalMs: 10 }), /deadline/);
  assert.equal(time, 25);
  assert.equal(reads, 4);
  await assert.rejects(waitForBackend({ readSnapshot: async () => { throw new Error("metadata unavailable"); },
    persist: () => {}, sleep: async () => assert.fail("read failure must fail closed") }), /metadata unavailable/);
});

test("readiness precedes expensive QA and keeps its credentials and timeout independent", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/quality-gate.yml", import.meta.url), "utf8");
  const readiness = workflow.split("\n  backend-readiness:")[1].split("\n  development-canary:")[0];
  const qa = workflow.split("\n  development-canary:")[1].split("\n  deploy:")[0];
  assert.match(readiness, /node scripts\/wait-development-backend\.mjs/);
  assert.doesNotMatch(readiness, /pnpm install|start-session|send-command/);
  assert.match(readiness, /timeout-minutes: 50/);
  assert.match(readiness, /role-duration-seconds: 3600/);
  assert.match(qa, /needs: \[quality-check, hangul-companion-check, candidate-preview, backend-readiness\]/);
  assert.match(qa, /timeout-minutes: 100/);
  assert.match(qa, /role-duration-seconds: 6000/);
  assert.match(qa, /node scripts\/run-development-release-canary\.mjs/);
});
