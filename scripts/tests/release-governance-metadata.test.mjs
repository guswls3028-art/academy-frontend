import assert from "node:assert/strict";
import test from "node:test";
import { publicJson, runPreflightStages } from "../run-development-release-canary.mjs";

const api = "https://api.github.com/repos/guswls3028-art/academy-backend/commits/main";
const token = "private-unit-token";

test("governance metadata authenticates only the exact backend GitHub API boundary", async () => {
  for (const [url, authenticated] of [
    [api, true],
    ["https://raw.githubusercontent.com/guswls3028-art/academy-backend/main/file.json", false],
    ["https://api.github.com.evil.invalid/repos/guswls3028-art/academy-backend/commits/main", false],
    ["https://api.github.com/repos/guswls3028-art/academy-backend-other/commits/main", false],
    ["http://api.github.com/repos/guswls3028-art/academy-backend/commits/main", false],
  ]) {
    const result = await publicJson(url, { token, fetchImpl: async (actual, options) => {
      assert.equal(actual, url);
      assert.equal(options.headers.Authorization, authenticated ? `Bearer ${token}` : undefined);
      assert.equal(options.redirect, "error", "authenticated requests cannot redirect a credential");
      assert.ok(options.signal instanceof AbortSignal);
      return { status: 200, json: async () => ({ sha: "a".repeat(40) }) };
    } });
    assert.deepEqual(result, { sha: "a".repeat(40) });
  }
});

test("public governance reads remain usable without a token", async () => {
  await publicJson(api, { token: "", fetchImpl: async (_url, { headers }) => {
    assert.equal(headers.Authorization, undefined);
    return { status: 200, json: async () => ({}) };
  } });
});

test("metadata failures preserve only fixed source, reason and HTTP status in preflight evidence", async () => {
  const privateText = `${token} private-student private-url private-path`;
  for (const [fetchImpl, expected] of [
    [async () => ({ status: 403, json: () => { throw new Error(privateText); } }),
      { source: "github-api", reason: "http", status: 403 }],
    [async () => ({ status: 429 }), { source: "github-api", reason: "http", status: 429 }],
    [async () => { throw new Error(privateText); }, { source: "github-api", reason: "transport", status: null }],
    [async () => ({ status: 200, json: () => { throw new Error(privateText); } }),
      { source: "github-api", reason: "json", status: 200 }],
  ]) {
    const snapshots = [];
    const stages = ["process", "bundle", "governance", "iam", "document", "host", "ssm"]
      .map((name) => [name, async () => {
        if (name === "governance") await publicJson(api, { token, fetchImpl });
        if (["iam", "document", "host", "ssm"].includes(name)) assert.fail("failed governance must stop preflight");
      }]);
    await assert.rejects(() => runPreflightStages(stages,
      (evidence) => snapshots.push(structuredClone(evidence)), "a".repeat(40)));
    const evidence = snapshots.at(-1);
    assert.deepEqual(evidence.governanceFailure, expected);
    assert.equal(evidence.terminalOutcome, "preflight_failed");
    assert.equal(evidence.preflightChecks.governance, false);
    assert.equal(evidence.passed, false);
    assert.equal(evidence.cleanup, null);
    assert.doesNotMatch(JSON.stringify(snapshots), /private-|Bearer|https:/);
  }
});

test("untrusted errors cannot inject a metadata observation into evidence", async () => {
  let last;
  const stages = ["process", "bundle", "governance", "iam", "document", "host", "ssm"]
    .map((name) => [name, async () => {
      if (name === "governance") throw Object.assign(new Error(token), { observation: { token } });
    }]);
  await assert.rejects(() => runPreflightStages(stages, (evidence) => { last = structuredClone(evidence); }, "a".repeat(40)));
  assert.equal(last.governanceFailure, undefined);
  assert.doesNotMatch(JSON.stringify(last), /private-unit-token/);
});
