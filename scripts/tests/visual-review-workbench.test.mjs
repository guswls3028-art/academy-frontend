import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { test } from "node:test";
import { parseArgs, prepareWorkbench, selectRun, serveWorkbench, validateEvidence } from "../visual-review-workbench.mjs";

const sha = "a".repeat(40);
const tenant = "qa-ymath-realuse-fe-100-1-abcdef";
const evidence = () => ({ frontendSha: sha, passed: true, tenantCode: tenant,
  cleanup: { tenantCode: tenant, remaining: { tenants: 0, users: 0 } } });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7U8AAAAASUVORK5CYII=", "base64");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "academy-visual-review-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "evidence");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "development-release.json"), JSON.stringify(evidence()));
  fs.writeFileSync(path.join(source, "screen-390.png"), png);
  fs.writeFileSync(path.join(source, "private-report.json"), '{"password":"never-serve"}');
  return { root, source, destination: path.join(root, "review") };
}

test("automatic selection binds successful main QA to the actual live revision", () => {
  const good = { id: 100, head_sha: sha, head_branch: "main", status: "completed", conclusion: "success" };
  assert.equal(selectRun([{ ...good, id: 101, head_sha: "b".repeat(40) }, good], sha), "100");
  for (const patch of [{ conclusion: "failure" }, { status: "in_progress" }, { head_branch: "feature" }, { head_sha: "b".repeat(40) }]) {
    assert.throws(() => selectRun([{ ...good, ...patch }], sha));
  }
});

test("unfinished, non-QA, mismatched and residual evidence fails closed", () => {
  validateEvidence(evidence(), sha);
  assert.throws(() => validateEvidence(evidence(), "b".repeat(40)));
  for (const mutate of [e => { e.passed = false; }, e => { e.tenantCode = "customer"; },
    e => { e.cleanup.tenantCode = `${tenant}-other`; }, e => { e.cleanup.remaining.users = 1; },
    e => { delete e.cleanup.remaining.tenants; }, e => { e.cleanup.remaining.tokens = 1; }]) {
    const value = evidence(); mutate(value); assert.throws(() => validateEvidence(value));
  }
});

test("review contains only verified image copies and redacted identity metadata", t => {
  const f = fixture(t);
  const manifest = prepareWorkbench(f.source, f.destination, { expectedSha: sha });
  assert.equal(manifest.images.length, 1);
  assert.equal(manifest.images[0].width, 1);
  assert.equal(manifest.mode, "captured-isolated-qa");
  assert.equal(manifest.liveMatchedAt, null);
  assert.equal(fs.existsSync(path.join(f.destination, "private-report.json")), false);
  assert.equal(fs.readFileSync(path.join(f.destination, "images/0000.png")).equals(png), true);
  assert.throws(() => prepareWorkbench(f.source, f.destination));
  assert.throws(() => prepareWorkbench(f.source, path.join(f.source, "nested")));
});

test("bad images and evidence symlinks are refused before output publication", t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.source, "bad.png"), "not an image");
  assert.throws(() => prepareWorkbench(f.source, f.destination));
  assert.equal(fs.existsSync(f.destination), false);
  fs.unlinkSync(path.join(f.source, "bad.png"));
  fs.symlinkSync(path.join(f.source, "private-report.json"), path.join(f.source, "leak.json"));
  assert.throws(() => prepareWorkbench(f.source, f.destination));
});

test("loopback review serves an exact image allowlist and refuses API, writes and alternate hosts", async t => {
  const f = fixture(t);
  prepareWorkbench(f.source, f.destination);
  const server = await serveWorkbench(f.destination);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  assert.equal(server.address().address, "127.0.0.1");
  const base = `http://127.0.0.1:${port}`;
  const index = await fetch(base);
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.match(await index.text(), /캡처 검수용/);
  assert.equal((await fetch(`${base}/images/0000.png`)).status, 200);
  for (const url of ["/private-report.json", "/development-release.json", "/api/v1/students/", "/%2e%2e/private-report.json"]) {
    assert.equal((await fetch(base + url)).status, 404);
  }
  assert.equal((await fetch(base, { method: "POST" })).status, 405);
  const hostStatus = await new Promise((resolve, reject) => {
    http.get({ hostname: "127.0.0.1", port, headers: { host: "unexpected.example" } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on("error", reject);
  });
  assert.equal(hostStatus, 421);
});

test("CLI accepts known options only and never accepts a customer URL or credentials", () => {
  assert.deepEqual(parseArgs(["--run", "100", "--prepare-only"]), { port: 0, prepareOnly: true, run: "100" });
  for (const args of [["--url", "https://customer.invalid"], ["--port", "80"], ["--run", "abc"], ["--run", "100", "--evidence", "x"], ["--output"]]) {
    assert.throws(() => parseArgs(args));
  }
});

test("a modified manifest cannot publish files outside the image workbench", async t => {
  const f = fixture(t);
  const manifest = prepareWorkbench(f.source, f.destination);
  manifest.images[0].file = "../evidence/private-report.json";
  fs.writeFileSync(path.join(f.destination, "manifest.json"), JSON.stringify(manifest));
  await assert.rejects(serveWorkbench(f.destination), /Invalid review image path/);
});
