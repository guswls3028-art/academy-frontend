import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough } from "node:stream";
import * as runner from "../development-account-probe.mjs";

test("a probe owns the sequential slot while its request body is still arriving", async () => {
  let calls = 0;
  const handler = runner.createAccountProbeHandler({ capability: "c".repeat(64), tenantId: 71,
    scope: "a".repeat(64), execute: async () => { calls += 1; return accountProof(proofInput); }, onFailure: () => {} });
  const request = new PassThrough();
  Object.assign(request, { url: "/__qa__/account-registration", method: "POST",
    headers: { host: "localhost:4173", "content-type": "application/json", authorization: `Bearer ${"c".repeat(64)}` } });
  const response = { status: null, writeHead(status) { this.status = status; }, end() {} };
  const pending = handler(request, response);
  try {
    assert.equal((await accountProbeCall(handler)).status, 502);
    assert.equal(calls, 0);
  } finally {
    request.end(JSON.stringify({ studentId: 23, ...proofInput }));
    await pending;
  }
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal((await accountProbeCall(handler)).status, 200);
});

const accountProof = (input, scope = "a".repeat(64)) => ({
  schema: "account-registration-development/v1", scope_sha256: scope, ...input,
  credentials_valid: true, token_me_valid: true, role_count: 2,
  random_format_valid: input.kind === "random" && input.mode === "verify",
  parent_hash_preserved: input.mode === "compare" ? true : null,
  business_mutations: 0, auth_observation_writes_allowed: true,
  snapshot_count: input.mode === "snapshot" ? 1 : 0,
});
const proofInput = { mode: "verify", kind: "random" };

test("account probe parameters preserve owner and accept only bounded target and closed modes", () => {
  const common = { TenantCode: ["qa-ymath-realuse-fe-123-1-abcdef123456"], OwnershipCapability: ["b".repeat(64)] };
  const input = { studentId: 23, ...proofInput };
  assert.deepEqual(runner.accountProbeParameters(common, 71, input), {
    ...common, Action: ["AccountProbe"], TenantId: ["71"], AccountStudentId: ["23"],
    AccountProbeMode: ["verify"], AccountProbeKind: ["random"],
  });
  for (const changed of [{ studentId: 0 }, { studentId: "23" }, { studentId: 2 ** 53 },
    { mode: "Cleanup" }, { kind: "unknown" }, { password: "private-value" }]) {
    assert.throws(() => runner.accountProbeParameters(common, 71, { ...input, ...changed }));
  }
  assert.throws(() => runner.accountProbeParameters(common, 0, input));
});

test("account probe proof requires actual credential authentication, exact scope and no extra fields", () => {
  const valid = accountProof(proofInput);
  assert.deepEqual(runner.assertAccountProbeProof(valid, "a".repeat(64), proofInput), valid);
  for (const changed of [{ scope_sha256: "b".repeat(64) }, { credentials_valid: false },
    { token_me_valid: false }, { role_count: 1 }, { random_format_valid: false },
    { business_mutations: 1 }, { auth_observation_writes_allowed: false },
    { password: "private-value" }, { token: "private-token" }, { snapshot_count: 1 }]) {
    assert.throws(() => runner.assertAccountProbeProof({ ...valid, ...changed }, "a".repeat(64), proofInput));
  }
  const compare = { mode: "compare", kind: "fixed" };
  const preserved = accountProof(compare);
  assert.deepEqual(runner.assertAccountProbeProof(preserved, "a".repeat(64), compare), preserved);
  assert.throws(() => runner.assertAccountProbeProof({ ...preserved, parent_hash_preserved: false }, "a".repeat(64), compare));
});

async function accountProbeCall(handler, overrides = {}, body = JSON.stringify({ studentId: 23, ...proofInput })) {
  const { Readable } = await import("node:stream");
  const request = Readable.from([Buffer.from(body)]);
  Object.assign(request, { url: "/__qa__/account-registration", method: "POST",
    headers: { host: "localhost:4173", "content-type": "application/json", authorization: `Bearer ${"c".repeat(64)}` }, ...overrides });
  const response = { status: null, body: "", writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
  await handler(request, response);
  return response;
}

test("account probe local handler rejects hostile requests before candidate dispatch", async () => {
  let calls = 0;
  const handler = runner.createAccountProbeHandler({ capability: "c".repeat(64), tenantId: 71, scope: "a".repeat(64),
    execute: async () => { calls += 1; return accountProof(proofInput); }, onFailure: () => {} });
  for (const overrides of [{ method: "GET" }, { url: "/__qa__/account-registration?tenant=production" },
    { headers: { host: "production.invalid", "content-type": "application/json" } },
    { headers: { host: "localhost:4173", "content-type": "application/json", authorization: "private-value" } }]) {
    const response = await accountProbeCall(handler, overrides);
    assert.equal(response.status, 502); assert.equal(calls, 0);
  }
  for (const body of ["not JSON", "x".repeat(257), '{"studentId":0,"mode":"verify","kind":"random"}']) {
    assert.equal((await accountProbeCall(handler, {}, body)).status, 502); assert.equal(calls, 0);
  }
  assert.equal((await accountProbeCall(handler)).status, 200); assert.equal(calls, 1);
});

test("account probe unavailable, malformed or credential-bearing result cannot silently pass or leak", async () => {
  for (const execute of [async () => { throw new Error("private-token private-password"); },
    async () => ({ ...accountProof(proofInput), token: "private-token" }), async () => null]) {
    const handler = runner.createAccountProbeHandler({ capability: "c".repeat(64), tenantId: 71,
      scope: "a".repeat(64), execute, onFailure: () => {} });
    const response = await accountProbeCall(handler);
    assert.equal(response.status, 502);
    assert.equal(response.body, '{"error":"ACCOUNT_PROBE_FAILED"}');
  }
});

test("account probe concurrent rejection cannot release another probe's busy state", async () => {
  let resolve;
  let calls = 0;
  const pending = new Promise((done) => { resolve = done; });
  const handler = runner.createAccountProbeHandler({ capability: "c".repeat(64), tenantId: 71, scope: "a".repeat(64),
    execute: async () => { calls += 1; await pending; return accountProof(proofInput); }, onFailure: () => {} });
  const first = accountProbeCall(handler);
  while (calls === 0) await new Promise((done) => setImmediate(done));
  assert.equal((await accountProbeCall(handler)).status, 502);
  assert.equal((await accountProbeCall(handler)).status, 502);
  assert.equal(calls, 1);
  resolve(); assert.equal((await first).status, 200);
});
