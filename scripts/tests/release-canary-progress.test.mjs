import assert from "node:assert/strict";
import test from "node:test";
import Reporter from "../release-canary-progress-reporter.mjs";

test("timeout progress retains only safe case identity, status and bounded duration", () => {
  const reporter = new Reporter();
  const snapshots = [];
  reporter.persist = () => snapshots.push(JSON.stringify({ active: reporter.active, completed: reporter.completed }));
  const item = { title: "SECRET_TITLE", location: { file: "/private/omr-review-realuse.spec.ts", line: 1420 } };
  reporter.onBegin();
  reporter.onTestBegin(item);
  assert.deepEqual(JSON.parse(snapshots.at(-1)).active, { file: "omr-review-realuse.spec.ts", line: 1420 });
  reporter.onTestEnd(item, { status: "timedOut", duration: 600000, error: "SECRET_ERROR", stdout: "SECRET_TOKEN" });
  assert.deepEqual(reporter.completed, [{ file: "omr-review-realuse.spec.ts", line: 1420, status: "timedOut", durationMs: 600000 }]);
  assert.doesNotMatch(snapshots.join(""), /SECRET|private/);
  reporter.onTestBegin({ location: { file: "private-user-file.ts", line: 1 } });
  assert.equal(reporter.active, null);
  reporter.onTestEnd(item, { status: "passed", duration: Infinity });
  reporter.onTestEnd(item, { status: "passed", duration: Number.MAX_SAFE_INTEGER });
  reporter.onTestEnd(item, { status: "SECRET", duration: 1 });
  assert.equal(reporter.completed.length, 1);
});
