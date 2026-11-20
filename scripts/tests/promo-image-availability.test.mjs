import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { observePromoImages } from "../promo-image-availability.mjs";

const promo = "https://hakwonplus.com/promo";
const admin = promo + "/admin-attendance-realuse-20260828.png";
const student = promo + "/student-operations-realuse-20260828.png";
function fixture(target = promo) {
  const page = new EventEmitter();
  const undecodable = new Set();
  page.evaluate = async (_, url) => !undecodable.has(url);
  const observation = observePromoImages(page, target);
  const issues = [];
  const request = (url, type = "image", method = "GET") => ({
    url: () => url, resourceType: () => type, method: () => method,
  });
  function fail(req, failure = "net::ERR_ABORTED") {
    const issue = { type: "requestfailed", url: req.url(), failure };
    issues.push(issue);
    observation.recordFailure(req, issue);
  }
  function receive(req, status = 200, complete = true) {
    page.emit("response", { request: () => req, status: () => status });
    if (complete) page.emit("requestfinished", req);
  }
  return { issues, request, fail, receive, undecodable, verify: () => observation.verify(target, issues) };
}

test("accepts a distinct, finished replacement for the exact canceled promo image", async () => {
  const f = fixture();
  f.fail(f.request(admin));
  f.receive(f.request(admin));
  f.receive(f.request(student));
  await f.verify();
  assert.deepEqual(f.issues, []);
});

for (const reason of ["404", "403", "unfinished", "previously finished", "same request", "other URL", "decode failure",
  "API", "document", "POST", "other error", "other page"]) {
  test("retains a failed observation for " + reason, async () => {
    const f = fixture(reason === "other page" ? promo + "/features" : promo);
    const req = f.request(admin, reason === "API" ? "fetch" : reason === "document" ? "document" : "image",
      reason === "POST" ? "POST" : "GET");
    if (reason === "previously finished") f.receive(f.request(admin));
    f.fail(req, reason === "other error" ? "net::ERR_FAILED" : "net::ERR_ABORTED");
    if (reason !== "previously finished") {
      const replacement = reason === "same request" ? req : f.request(reason === "other URL" ? admin + "?v=1" : admin);
      f.receive(replacement, ["404", "403"].includes(reason) ? Number(reason) : 200, reason !== "unfinished");
    }
    if (reason === "decode failure") f.undecodable.add(admin);
    f.receive(f.request(student));
    await f.verify();
    assert.ok(f.issues.some(issue => issue.type === "requestfailed"));
    if (["404", "403"].includes(reason)) assert.ok(f.issues.some(issue => issue.status === Number(reason)));
  });
}
