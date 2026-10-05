import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

// Execute the actual API module with in-memory transport/auth boundaries, without dependencies.
const source = stripTypeScriptTypes(readFileSync(new URL(
  "../../src/app_student/domains/clinic/api/clinicBooking.api.ts", import.meta.url,
), "utf8"));
const origin = "https://api.clinic.test";
const dates = { date_from: "2026-10-04", date_to: "2026-12-04" };

class CanceledError extends Error {
  code = "ERR_CANCELED";
}

async function harness(respond, initialScope = {}) {
  const scope = { studentId: 41, tenant: "clinic-test", generation: "login-a", access: "fixture-access", ...initialScope };
  const requests = [];
  const client = {
    defaults: { baseURL: `${origin}/api/v1` },
    async get(path, config) {
      const request = { path, ...config, params: { ...config.params }, headers: { ...config.headers } };
      // The production student wrapper reads the selected child on every dispatch.
      if (scope.studentId !== null) request.headers["X-Student-Id"] = String(scope.studentId);
      requests.push(request);
      const data = typeof respond === "function"
        ? await respond(request, scope, requests.length)
        : respond[requests.length - 1];
      if (data instanceof Error) throw data;
      return { data };
    },
  };
  const imports = {
    "axios": { CanceledError },
    "@student/shared/api/student.api": { default: client },
    "@/shared/api/axios": {
      default: client,
      createAuthSessionBoundConfig: (generation, signal, tenant) => ({
        signal, _authGeneration: generation, _expectedTenant: tenant,
      }),
      getAccessToken: () => scope.access,
    },
    "@/shared/api/parentStudentSelection": { getParentStudentId: () => scope.studentId },
    "@/shared/auth/tokenSession": {
      readAuthTokenEnvelopeSafely: () => scope.generation === null ? null : { generation: scope.generation },
    },
    "@/shared/tenant": { getTenantCodeForApiRequest: () => scope.tenant },
    "@/shared/utils/richHtml": { richHtmlToPlainText: (value) => value },
  };
  const context = createContext({ URL, window: { location: { origin: "https://student.clinic.test" } } });
  const module = new SourceTextModule(source, { context });
  await module.link((specifier) => {
    const values = imports[specifier];
    assert.ok(values, `Unexpected unmocked dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return { api: module.namespace, requests, scope };
}

function session(id, overrides = {}) {
  return {
    id, date: "2026-11-30", start_time: "15:00:00", location: "보강실",
    participant_count: 0, booked_count: 0, ...overrides,
  };
}

function participant(id, overrides = {}) {
  return {
    id, session: 1, session_date: "2026-10-06", session_start_time: "15:00:00",
    session_location: "보강실", status: "pending", created_at: "2026-01-01T00:00:00Z", ...overrides,
  };
}

const endpoints = [
  { name: "sessions", path: "/clinic/sessions/", row: session,
    invoke: (h, signal) => h.api.fetchAvailableClinicSessions({ ...dates, signal }) },
  { name: "participants", path: "/clinic/participants/", row: participant,
    invoke: (h, signal) => h.api.fetchMyClinicBookingRequests({ signal }) },
];

for (const endpoint of endpoints) {
  const { name, path, row, invoke } = endpoint;
  const page = (results, next = null, count) => ({ results, next, ...(count === undefined ? {} : { count }) });

  test(`${name}: retrieves 401 rows, including the nearest session or oldest active booking`, async () => {
    const rows = Array.from({ length: 401 }, (_, i) => row(i + 1, name === "participants"
      ? { status: i < 400 ? "attended" : "approved" }
      : { date: i < 400 ? "2026-11-30" : "2026-10-05" }));
    const h = await harness((request) => {
      const number = request.params.page;
      return page(rows.slice((number - 1) * 200, number * 200), number < 3 ? `?page=${number + 1}` : null, 401);
    });
    const result = await invoke(h);
    assert.equal(result.length, name === "participants" ? 1 : 401);
    assert.equal(result.at(-1).id, 401);
    assert.equal(name === "participants" ? result[0].status : result.at(-1).date,
      name === "participants" ? "booked" : "2026-10-05");
    assert.deepEqual(h.requests.map((request) => request.params.page), [1, 2, 3]);
    for (const request of h.requests) {
      assert.equal(request.path, path);
      assert.equal(request.params.page_size, 200);
      assert.equal(request.headers["X-Student-Id"], "41");
      assert.equal(request._authGeneration, "login-a");
      assert.equal(request._expectedTenant, "clinic-test");
      if (name === "sessions") {
        assert.equal(request.params.date_from, dates.date_from);
        assert.equal(request.params.date_to, dates.date_to);
      }
    }
  });

  for (const format of ["array", "counted", "paginated"]) {
    test(`${name}: preserves complete legacy ${format} responses and empty lists`, async () => {
      for (const rows of [[], [row(1)]]) {
        const data = format === "array" ? rows
          : format === "counted" ? { count: rows.length, results: rows }
            : page(rows, null, rows.length);
        const h = await harness([data]);
        assert.deepEqual(Array.from(await invoke(h), (item) => item.id), rows.map((item) => item.id));
        assert.equal(h.requests.length, 1);
      }
    });
  }

  test(`${name}: propagates a later HTTP failure instead of publishing the first page`, async () => {
    const error = new Error("page two failed");
    const h = await harness([page([row(1)], "?page=2", 2), error]);
    await assert.rejects(invoke(h), (caught) => caught === error);
    assert.equal(h.requests.length, 2);
  });

  const invalidPages = [
    null, {}, { results: null }, { results: [] },
    page([null]), page([{ id: "1" }]), page([row(1), row(1)]),
    page([row(1)], null, 2), page([row(1)], null, -1), page([row(1)], null, 1.5),
    { results: [row(1)], count: 2 }, page([row(1)], false), page([row(1)], ""),
    page([], "?page=2"), page([row(1)], "?page=2", 1),
  ];
  for (const [index, data] of invalidPages.entries()) {
    test(`${name}: rejects malformed or incomplete page ${index + 1}`, async () => {
      const h = await harness([data]);
      await assert.rejects(invoke(h));
      assert.equal(h.requests.length, 1);
    });
  }

  for (const next of [
    "https://elsewhere.test/api/v1/clinic/sessions/?page=2",
    "//elsewhere.test/api/v1/clinic/participants/?page=2",
    `${origin}/api/v1/other${path}?page=2`,
    `https://user:password@api.clinic.test/api/v1${path}?page=2`,
    "?page=2#fragment", "?page=1", "?page=3", "?page=2&page=2", "?page=02", "?page=2.0", "?page=last",
    "?page_size=200", "?page=2&page_size=100", "?page=2&student_id=99", "?page=2&date_from=1999-01-01",
    "javascript:alert(1)", "http://[",
  ]) {
    test(`${name}: rejects unsafe or nonsequential next ${next}`, async () => {
      const h = await harness([page([row(1)], next)]);
      await assert.rejects(invoke(h));
      assert.equal(h.requests.length, 1);
    });
  }

  for (const next of ["?page=2", `/api/v1${path}?page=2`, `${origin}/api/v1${path}?page=2&page_size=200`]) {
    test(`${name}: accepts same-endpoint next ${next} while keeping the original request path`, async () => {
      const h = await harness([page([row(1)], next, 2), page([row(2)], null, 2)]);
      assert.equal((await invoke(h)).length, 2);
      assert.deepEqual(h.requests.map((request) => request.path), [path, path]);
    });
  }

  for (const second of [
    page([row(2)], "?page=2"), page([row(1)]), page([row(2)], null, 3),
    page([], null), [row(2)], { results: [row(2)] },
  ]) {
    test(`${name}: rejects cyclic, duplicated, malformed or incomplete later pages ${JSON.stringify(second)}`, async () => {
      const h = await harness([page([row(1)], "?page=2", 2), second]);
      await assert.rejects(invoke(h));
      assert.equal(h.requests.length, 2);
    });
  }

  for (const field of ["studentId", "tenant", "generation"]) {
    for (const boundary of [1, 2]) {
      test(`${name}: discards all rows when ${field} changes during page ${boundary}`, async () => {
        const h = await harness((_request, scope, number) => {
          if (number === boundary) scope[field] = field === "studentId" ? 42 : "changed";
          return page([row(number)], number === 1 ? "?page=2" : null, 2);
        });
        await assert.rejects(invoke(h), { code: "ERR_CANCELED" });
        assert.equal(h.requests.length, boundary);
        assert.ok(h.requests.every((request) => request.headers["X-Student-Id"] === "41"));
      });
    }
  }

  test(`${name}: rejects a child switch while the first request is suspended`, async () => {
    let release;
    const h = await harness(() => new Promise((resolve) => { release = resolve; }));
    const pending = invoke(h);
    h.scope.studentId = 42;
    release(page([row(1)], "?page=2", 2));
    await assert.rejects(pending, { code: "ERR_CANCELED" });
    assert.equal(h.requests.length, 1);
  });

  test(`${name}: normal token refresh keeps the auth generation and student scope`, async () => {
    const h = await harness((_request, scope, number) => {
      scope.access = `refreshed-fixture-${number}`;
      return page([row(number)], number === 1 ? "?page=2" : null, 2);
    });
    assert.equal((await invoke(h)).length, 2);
    assert.ok(h.requests.every((request) => request._authGeneration === "login-a"));
  });

  test(`${name}: detects access-token replacement when no normal auth envelope is present`, async () => {
    const h = await harness((_request, scope) => {
      scope.access = "other-fixture-access";
      return page([row(1)]);
    }, { generation: null });
    await assert.rejects(invoke(h), { code: "ERR_CANCELED" });
  });

  for (const boundary of [0, 1, 2]) {
    test(`${name}: honors cancellation before dispatch or while awaiting page ${boundary}`, async () => {
      const controller = new AbortController();
      if (boundary === 0) controller.abort();
      const h = await harness((request, _scope, number) => {
        assert.equal(request.signal, controller.signal);
        if (boundary === number) controller.abort();
        return page([row(number)], number === 1 ? "?page=2" : null, 2);
      });
      await assert.rejects(invoke(h, controller.signal), { code: "ERR_CANCELED" });
      assert.equal(h.requests.length, boundary);
    });
  }

  test(`${name}: a safety bound rejects a runaway list instead of truncating it`, async () => {
    const h = await harness((request) => page([row(request.params.page)], `?page=${request.params.page + 1}`));
    await assert.rejects(invoke(h));
    assert.equal(h.requests.length, 500);
  });
}
