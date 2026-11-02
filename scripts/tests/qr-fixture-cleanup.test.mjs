import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = name => stripTypeScriptTypes(fs.readFileSync(new URL(`../../${name}`, import.meta.url), "utf8"));
const helper = read("e2e/helpers/qrAttendanceRealuse.ts");
const parent = read("e2e/student/student-parent-clinic-realuse.spec.ts");
const helperFunction = helper.slice(helper.indexOf("export async function verifyQrAttendanceRealuse")).replace("export ", "");
const cleanupFunction = parent.slice(parent.indexOf("async function cleanup("), parent.indexOf("\ntest.describe.serial("));
const expect = value => ({
  toBe: expected => assert.equal(value, expected),
  toContain: expected => assert.ok(value.includes(expected)),
});

function model({ enrollmentDeleteFails = false, sessionDeleteFails = false, sessionReadbackPresent = false, sessionDeleteStatus = 204 } = {}) {
  const state = { targets: true, session: true, lecture: true, calls: [] };
  const api = async (_request, method, path) => {
    state.calls.push(`${method} ${path}`);
    if (path === "/enrollments/13/") {
      if (method === "DELETE" && !enrollmentDeleteFails) state.targets = false;
      return { status: method === "DELETE" ? (enrollmentDeleteFails ? 403 : 204) : state.targets ? 200 : 404 };
    }
    if (path === "/lectures/sessions/17/") {
      if (method === "DELETE" && !state.targets && !sessionDeleteFails && sessionDeleteStatus === 204) state.session = false;
      return { status: method === "DELETE" ? (state.targets || sessionDeleteFails ? 403 : sessionDeleteStatus) : state.session || sessionReadbackPresent ? 200 : 404 };
    }
    if (path === "/lectures/lectures/11/") {
      // A lecture can cascade an empty child session; it must not mask a failed child delete/readback.
      if (method === "DELETE" && !state.targets) { state.lecture = false; state.session = false; }
      return { status: method === "DELETE" ? (state.targets ? 403 : 204) : state.lecture ? 200 : 404 };
    }
    throw new Error(`Unexpected fixture operation ${method} ${path}`);
  };
  return { state, api };
}

function parentCleanup(api, qrClassSessionId = 17) {
  return new Function("api", "expect", "qrClassSessionId", `
    const adminAccess = 'closed-fixture', originalAutoApproval = undefined;
    const sessionId = undefined, participantId = undefined, lectureId = 11, enrollmentId = 13;
    const family = null, cleanupQaFamily = async () => {};
    ${cleanupFunction}; return cleanup;
  `)(api, expect, qrClassSessionId);
}

for (const stage of ["session-enrollment", "UI"]) {
test(`QR setup hands its exact class session to the parent before a ${stage} failure`, async () => {
  const { state, api } = model();
  const primary = new Error("closed QR navigation failure");
  const registered = [];
  const expectApi = async (_request, method, path) => {
    if (method === "PATCH" && path === "/lectures/lectures/11/") return {};
    if (method === "POST" && path === "/lectures/sessions/") return { id: 17 };
    if (method === "POST" && ["/enrollments/session-enrollments/bulk_create/", "/lectures/attendance/bulk_create/"].includes(path)) {
      assert.deepEqual(registered, [17]);
      if (stage === "session-enrollment") throw primary;
      return [];
    }
    throw new Error(`Unexpected setup operation ${method} ${path}`);
  };
  const run = new Function("assertQaStudentParentRuntime", "expectApi", "api", "expect", "gotoAndSettle", "QA_BASE",
    `${helperFunction}; return verifyQrAttendanceRealuse;`)(() => {}, expectApi, api, expect,
    async () => { assert.deepEqual(registered, [17]); throw primary; }, "http://127.0.0.1:4173");
  await assert.rejects(run({ page: {}, teacherPage: {}, request: {}, testInfo: {},
    family: { students: [{ id: 7 }] }, adminAccess: "closed-fixture", lectureId: 11, enrollmentId: 13,
    recordClassSession: id => registered.push(id),
  }), error => error instanceof AggregateError && error.errors.length === 1 && error.errors[0] === primary);
  assert.deepEqual(state.calls, [], "The child must not delete a session with live parent-owned enrollment targets");
  await parentCleanup(api, registered[0])({});
  assert.equal(state.targets || state.session || state.lecture, false);
});
}

test("parent cleanup removes enrollment targets, class session and lecture in dependency order", async () => {
  const { state, api } = model();
  await parentCleanup(api)({});
  assert.deepEqual(state.calls, [
    "DELETE /enrollments/13/", "GET /enrollments/13/", "DELETE /lectures/sessions/17/",
    "GET /lectures/sessions/17/", "DELETE /lectures/lectures/11/", "GET /lectures/lectures/11/",
  ]);
  assert.equal(state.targets || state.session || state.lecture, false);
});

test("failed enrollment cleanup preserves protected data and remains a failure", async () => {
  const { state, api } = model({ enrollmentDeleteFails: true });
  await assert.rejects(parentCleanup(api)({}), /student\/parent clinic cleanup failed/);
  assert.equal(state.targets && state.session && state.lecture, true);
  assert.deepEqual(state.calls, ["DELETE /enrollments/13/"]);
});

for (const option of ["sessionDeleteFails", "sessionReadbackPresent"]) {
  test(`${option} cannot be hidden by deleting the parent lecture`, async () => {
    const { state, api } = model({ [option]: true });
    await assert.rejects(parentCleanup(api)({}), /student\/parent clinic cleanup failed/);
    assert.equal(state.lecture, true);
    assert.ok(!state.calls.includes("DELETE /lectures/lectures/11/"));
  });
}

for (const sessionDeleteStatus of [200, 202]) {
  test(`session DELETE ${sessionDeleteStatus} is not accepted or hidden by lecture cascade`, async () => {
    const { state, api } = model({ sessionDeleteStatus });
    await assert.rejects(parentCleanup(api)({}), /student\/parent clinic cleanup failed/);
    assert.equal(state.session && state.lecture, true);
    assert.ok(!state.calls.includes("DELETE /lectures/lectures/11/"));
  });
}
