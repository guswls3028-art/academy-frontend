import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFixedQaRunner, writeQaCheckpoint } from "../development-qa-operations.mjs";

test("checkpoint replacement preserves the previous receipt when serialization fails", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "qa-checkpoint-"));
  try {
    const file = path.join(directory, "state.json");
    writeQaCheckpoint(file, { attempted: true });
    const cyclic = {}; cyclic.self = cyclic;
    assert.throws(() => writeQaCheckpoint(file, cyclic));
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { attempted: true });
    assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
    writeQaCheckpoint(file, { attempted: true, completed: true });
    assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).completed, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

const common = { TenantCode: ["qa-operation-fixture"], OwnershipCapability: ["a".repeat(64)],
  ReleaseId: ["sha-fixture-run-17-1"], ApiDigest: ["sha256:" + "b".repeat(64)], SyntheticLongVideo: ["false"] };
const payload = (status = "YMATH_REALUSE_SCENARIO_READY") => ({
  status, tenant_code: common.TenantCode[0], tenant_id: 17, token: "never-persist-this",
});
const result = (body = payload(), code = 0) => ({ code, stdout:
  "Starting session with SessionId: academy-fe-qa-owned\n" + JSON.stringify(body) + "\n" });
function harness(overrides = {}) {
  const saved = [], sent = [], observed = [];
  const runner = createFixedQaRunner({ common,
    checkpoint: (state) => { saved.push(state); },
    session: (parameters) => {
      sent.push(parameters);
      const status = { Inspect: "DEVELOPMENT_QA_IDENTITY_PASS", Setup: "YMATH_REALUSE_SCENARIO_READY",
        Cleanup: "YMATH_REALUSE_SCENARIO_DESTROYED" }[parameters.Action[0]];
      return { done: Promise.resolve(result(payload(status))) };
    },
    remember: () => {}, observe: (value) => { observed.push(value); }, ...overrides });
  return { runner, saved, sent, observed };
}

test("ordinary setup, readback and cleanup retain identity without storing credentials", async () => {
  const h = harness();
  await h.runner.run("Inspect");
  const setup = await h.runner.run("Setup");
  await h.runner.run("Inspect", setup.tenant_id);
  await h.runner.run("Cleanup", setup.tenant_id);
  assert.equal(h.runner.snapshot().tenantId, 17);
  assert.deepEqual(h.sent.map((p) => p.Action[0]), ["Inspect", "Setup", "Inspect", "Cleanup"]);
  assert.equal(h.saved[3].setupAttempted, true);
  assert.equal(h.saved[3].attempts.at(-1).phase, "attempted");
  assert.ok(h.saved.every((s) => !JSON.stringify(s).includes("never-persist-this")));
  assert.ok(h.saved.every((s) => !JSON.stringify(s).includes(common.OwnershipCapability[0])));
});

test("ambiguous setup cannot be resent after process restart; read-only recovery is allowed", async () => {
  let sends = 0;
  const h = harness({ session: () => { sends++; throw Error("transport interrupted"); } });
  await assert.rejects(h.runner.run("Setup"), /transport interrupted/);
  await assert.rejects(h.runner.run("Setup"), /already attempted/);
  const resumed = harness({ previous: h.runner.snapshot() });
  await assert.rejects(resumed.runner.run("Setup"), /already attempted/);
  await resumed.runner.run("Inspect");
  await assert.rejects(resumed.runner.run("Cleanup", 17), /captured Setup identity/);
  assert.equal(sends, 1);
});

test("Setup identity survives a failed process so exact cleanup can follow", async () => {
  let next = result(payload(), -1);
  const h = harness({ session: () => ({ done: Promise.resolve(next) }) });
  await assert.rejects(h.runner.run("Setup"), /command failed/);
  assert.equal(h.observed[0].tenantId, 17);
  assert.equal(h.saved.at(-1).tenantId, 17);
  next = result(payload("YMATH_REALUSE_SCENARIO_DESTROYED"));
  await h.runner.run("Cleanup", 17);
});

test("failed checkpoint never starts a remote operation", async () => {
  let sends = 0;
  const h = harness({ checkpoint: () => { throw Error("disk full"); }, session: () => { sends++; } });
  await assert.rejects(h.runner.run("Setup"), /disk full/);
  assert.equal(sends, 0);
  await assert.rejects(h.runner.run("Setup"), /already attempted/);
});

test("candidate, tenant and capability cannot be changed on recovery", async () => {
  const h = harness(); await h.runner.run("Setup");
  for (const key of ["TenantCode", "ReleaseId", "ApiDigest", "OwnershipCapability"]) {
    const changed = structuredClone(common);
    changed[key] = key === "TenantCode" ? ["qa-other"] : key === "OwnershipCapability" ? ["c".repeat(64)] : ["other"];
    assert.throws(() => harness({ common: changed, previous: h.runner.snapshot() }), /another QA run/);
  }
  await assert.rejects(h.runner.run("Cleanup", 18), /captured Setup identity/);
  assert.equal(h.sent.length, 1);
});

test("ambiguous or foreign payload never becomes a successful operation", async () => {
  for (const response of [result({ ...payload(), tenant_code: "qa-foreign" }),
    { code: 0, stdout: "{\"secret\":\"never-persist-this\"}\n{}\n" },
    { code: 0, stdout: "{invalid" }, result(payload("DEVELOPMENT_QA_FAILED"))]) {
    const h = harness({ session: () => ({ done: Promise.resolve(response) }) });
    await assert.rejects(h.runner.run("Setup"));
    assert.equal(h.runner.snapshot().attempts.at(-1).phase, "failed");
  }
});

test("interruption prevents new setup but permits exact cleanup and its readback", async () => {
  let interrupted = false;
  const h = harness({ interrupted: () => interrupted });
  await h.runner.run("Setup"); interrupted = true;
  await assert.rejects(harness({ interrupted: () => true }).runner.run("Setup"), /interrupted/);
  await h.runner.run("Inspect", 17);
  await h.runner.run("Cleanup", 17);
  await h.runner.run("Inspect", 17);
});

test("concurrent operations cannot race the setup journal", async () => {
  let finish;
  const h = harness({ session: () => ({ done: new Promise((resolve) => { finish = resolve; }) }) });
  const first = h.runner.run("Setup");
  await Promise.resolve();
  await assert.rejects(h.runner.run("Setup"), /sequential/);
  finish(result()); await first;
});
