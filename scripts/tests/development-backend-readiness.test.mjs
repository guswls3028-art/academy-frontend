import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { backendReadiness, readBackendRun, waitForBackend } from "../wait-development-backend.mjs";

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
  assert.match(qa, /needs: \[quality-check, hangul-companion-check, candidate-preview, backend-readiness\]/);
  assert.match(qa, /timeout-minutes: 60/);
  assert.match(qa, /role-duration-seconds: 3600/);
  assert.match(qa, /node scripts\/run-development-release-canary\.mjs/);
});
