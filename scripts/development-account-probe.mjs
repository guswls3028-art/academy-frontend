import assert from "node:assert/strict";
import crypto from "node:crypto";
const WEB_ORIGIN = "http://localhost:4173";
const PROBE_FAILURE_CODES = new Set([
  "credential-unrecoverable", "credential-hash-mismatch", "random-format-invalid", "own-phone-mismatch",
  "auth-redirect-refused", "auth-status", "auth-response-size", "auth-response-shape", "auth-request-failed",
  "auth-token-invalid", "auth-role-mismatch", "auth-student-mismatch", "auth-parent-mismatch",
  "runtime-scope-invalid", "owner-mismatch", "fixture-scope-invalid", "fixture-role-invalid",
  "snapshot-already-exists", "parent-hash-changed", "business-state-changed", "target-invalid", "arguments-invalid", "probe-failed",
]);
class AccountProbeFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function accountProbeResult(result, scope, input) {
  // Only fixed codes cross into evidence; never retain stdout, stderr, credentials or assertion values.
  if (typeof result.stdout !== "string" || result.stdout.length > 65_536) throw new AccountProbeFailure("probe-output-invalid");
  const lines = result.stdout.split(/\r?\n/).filter((line) => line.startsWith("{"));
  if (lines.length !== 1) throw new AccountProbeFailure("probe-proof-missing");
  let payload;
  try { payload = JSON.parse(lines[0]); }
  catch { throw new AccountProbeFailure("probe-output-invalid"); }
  if (result.code !== 0 || payload?.status === "DEVELOPMENT_QA_FAILED") {
    const code = payload?.status === "DEVELOPMENT_QA_FAILED" && payload?.failure_stage === "account_probe"
      && PROBE_FAILURE_CODES.has(payload?.account_probe_failure) ? payload.account_probe_failure : "probe-process-failed";
    throw new AccountProbeFailure(code);
  }
  try { return assertAccountProbeProof(payload, scope, input); }
  catch { throw new AccountProbeFailure("probe-proof-invalid"); }
}

export function accountProbeParameters(common, tenantId, input) {
  assert.ok(Number.isSafeInteger(tenantId) && tenantId > 0);
  assert.ok(input && typeof input === "object" && !Array.isArray(input));
  assert.equal(Object.keys(input).sort().join(","), "kind,mode,studentId");
  assert.ok(Number.isSafeInteger(input.studentId) && input.studentId > 0);
  assert.ok(["verify", "snapshot", "compare"].includes(input.mode));
  assert.ok(["fixed", "phone_last4", "random"].includes(input.kind));
  return { ...common, Action: ["AccountProbe"], TenantId: [String(tenantId)],
    AccountStudentId: [String(input.studentId)], AccountProbeMode: [input.mode], AccountProbeKind: [input.kind] };
}

export function assertAccountProbeProof(proof, scope, input) {
  const keys = ["schema", "scope_sha256", "mode", "kind", "credentials_valid", "token_me_valid", "role_count",
    "random_format_valid", "parent_hash_preserved", "business_mutations", "auth_observation_writes_allowed", "snapshot_count"];
  assert.ok(proof && typeof proof === "object" && !Array.isArray(proof));
  assert.equal(Object.keys(proof).sort().join(","), [...keys].sort().join(","));
  assert.equal(proof.schema, "account-registration-development/v1");
  assert.match(scope, /^[a-f0-9]{64}$/);
  assert.equal(proof.scope_sha256, scope);
  assert.equal(proof.mode, input.mode); assert.equal(proof.kind, input.kind);
  assert.equal(proof.credentials_valid, true); assert.equal(proof.token_me_valid, true);
  assert.equal(proof.role_count, 2); assert.equal(proof.business_mutations, 0);
  assert.equal(proof.auth_observation_writes_allowed, true);
  assert.equal(proof.random_format_valid, input.kind === "random" && input.mode === "verify");
  assert.equal(proof.parent_hash_preserved, input.mode === "compare" ? true : null);
  assert.equal(proof.snapshot_count, input.mode === "snapshot" ? 1 : 0);
  return Object.fromEntries(keys.map((key) => [key, proof[key]]));
}

export function createAccountProbeHandler(boundary) {
  let active = false;
  return async (request, response) => {
    let acquired = false;
    try {
      assert.equal(request.url, "/__qa__/account-registration");
      assert.equal(request.method, "POST");
      assert.equal(request.headers.host, "localhost:4173");
      assert.equal(request.headers["content-type"], "application/json");
      assert.equal(request.headers.origin ?? WEB_ORIGIN, WEB_ORIGIN);
      const supplied = Buffer.from(request.headers.authorization ?? "");
      const expected = Buffer.from(`Bearer ${boundary.capability}`);
      assert.equal(supplied.length, expected.length);
      assert.ok(crypto.timingSafeEqual(supplied, expected));
      assert.equal(active, false, "Account probe must be sequential");
      active = true;
      acquired = true;
      let size = 0;
      const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        assert.ok(size <= 256, "Account probe input too large");
        chunks.push(chunk);
      }
      const input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
      accountProbeParameters({}, boundary.tenantId, input);
      const proof = assertAccountProbeProof(await boundary.execute(input), boundary.scope, input);
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify(proof));
    } catch (error) {
      boundary.onFailure(error instanceof AccountProbeFailure ? error.code : "account-probe-failed");
      response.writeHead(502, { "content-type": "application/json", "cache-control": "no-store" });
      response.end('{"error":"ACCOUNT_PROBE_FAILED"}');
    } finally { if (acquired) active = false; }
  };
}
