import { expect, test } from "../fixtures/strictTest";
import type { APIResponse, Page } from "@playwright/test";

import { apiCall } from "./api";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const ACTIVE_GENERATION_KEY = "academy:auth-active-generation:v1";
const GENERATION_PREFIX = "academy:auth-tokens:v1:";

type RequestOptions = {
  data?: unknown;
  headers?: Record<string, string>;
  method?: string;
};

function response(status: number, body: unknown): APIResponse {
  return {
    json: async () => body,
    ok: () => status >= 200 && status < 300,
    status: () => status,
  } as APIResponse;
}

function withRequestStub(
  page: Page,
  request: {
    fetch: (url: string, options: RequestOptions) => Promise<APIResponse>;
    post: (url: string, options: RequestOptions) => Promise<APIResponse>;
  },
): Page {
  return {
    evaluate: page.evaluate.bind(page),
    request,
  } as unknown as Page;
}

async function setEnvelope(
  page: Page,
  generation: string,
  access: string,
  refresh: string,
): Promise<void> {
  await page.evaluate(({ activeKey, envelopeKey, value }) => {
    localStorage.setItem(envelopeKey, JSON.stringify(value));
    localStorage.setItem(activeKey, value.generation);
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, {
    activeKey: ACTIVE_GENERATION_KEY,
    envelopeKey: `${GENERATION_PREFIX}${generation}`,
    value: { access, refresh, generation },
  });
}

async function readAuthStorage(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(({ activeKey, prefix }) => {
    const activeGeneration = localStorage.getItem(activeKey);
    return {
      activeGeneration,
      activeEnvelope: activeGeneration
        ? localStorage.getItem(`${prefix}${activeGeneration}`)
        : null,
      generationA: localStorage.getItem(`${prefix}generation-a`),
      legacyAccess: localStorage.getItem("access"),
      legacyRefresh: localStorage.getItem("refresh"),
    };
  }, { activeKey: ACTIVE_GENERATION_KEY, prefix: GENERATION_PREFIX });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    await route.abort("blockedbyclient");
  });
  await page.route("**/__e2e-api-helper__", async (route) => {
    await route.fulfill({ body: "<!doctype html><title>api helper</title>", contentType: "text/html" });
  });
  await page.goto(`${BASE}/__e2e-api-helper__`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("QnA helper POST는 active generation envelope access를 사용한다", async ({ page }) => {
  await setEnvelope(page, "generation-a", "envelope-access", "envelope-refresh");
  const requests: RequestOptions[] = [];
  const helperPage = withRequestStub(page, {
    fetch: async (_url, options) => {
      requests.push(options);
      return response(201, { id: 101 });
    },
    post: async () => response(500, null),
  });

  const result = await apiCall(helperPage, "POST", "/community/posts/", {
    post_type: "qna",
    title: "generation envelope regression",
    content: "test harness auth contract",
  });

  expect(result.status).toBe(201);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.headers?.Authorization).toBe("Bearer envelope-access");
});

test("refresh rotation은 같은 active generation envelope의 exact pair만 갱신한다", async ({ page }) => {
  await setEnvelope(page, "generation-a", "expired-access", "refresh-a");
  const requests: RequestOptions[] = [];
  let refreshCalls = 0;
  const helperPage = withRequestStub(page, {
    fetch: async (_url, options) => {
      requests.push(options);
      return requests.length === 1
        ? response(401, { detail: "expired" })
        : response(201, { id: 102 });
    },
    post: async (_url, options) => {
      refreshCalls += 1;
      expect(options.data).toEqual({ refresh: "refresh-a" });
      return response(200, { access: "rotated-access", refresh: "rotated-refresh" });
    },
  });

  const result = await apiCall(helperPage, "POST", "/community/posts/", {
    post_type: "qna",
  });

  expect(result.status).toBe(201);
  expect(refreshCalls).toBe(1);
  expect(requests.map((request) => request.headers?.Authorization)).toEqual([
    "Bearer expired-access",
    "Bearer rotated-access",
  ]);
  expect(await readAuthStorage(page)).toMatchObject({
    activeGeneration: "generation-a",
    activeEnvelope: JSON.stringify({
      access: "rotated-access",
      refresh: "rotated-refresh",
      generation: "generation-a",
    }),
    legacyAccess: null,
    legacyRefresh: null,
  });
});

test("refresh 중 account switch가 발생하면 새 session을 덮거나 old request를 replay하지 않는다", async ({ page }) => {
  await setEnvelope(page, "generation-a", "expired-access-a", "refresh-a");
  let fetchCalls = 0;
  let refreshCalls = 0;
  const helperPage = withRequestStub(page, {
    fetch: async () => {
      fetchCalls += 1;
      return response(401, { detail: "expired" });
    },
    post: async () => {
      refreshCalls += 1;
      await setEnvelope(page, "generation-b", "access-b", "refresh-b");
      return response(200, { access: "late-access-a", refresh: "late-refresh-a" });
    },
  });

  const result = await apiCall(helperPage, "POST", "/community/posts/", {
    post_type: "qna",
  });

  expect(result.status).toBe(401);
  expect(refreshCalls).toBe(1);
  expect(fetchCalls).toBe(1);
  expect(await readAuthStorage(page)).toMatchObject({
    activeGeneration: "generation-b",
    activeEnvelope: JSON.stringify({
      access: "access-b",
      refresh: "refresh-b",
      generation: "generation-b",
    }),
    generationA: JSON.stringify({
      access: "expired-access-a",
      refresh: "refresh-a",
      generation: "generation-a",
    }),
    legacyAccess: null,
    legacyRefresh: null,
  });
});

test("pointer 없는 legacy fixture는 raw token fallback과 refresh rotation을 유지한다", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("access", "legacy-expired-access");
    localStorage.setItem("refresh", "legacy-refresh");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  });
  const requests: RequestOptions[] = [];
  const helperPage = withRequestStub(page, {
    fetch: async (_url, options) => {
      requests.push(options);
      return requests.length === 1
        ? response(401, { detail: "expired" })
        : response(200, { ok: true });
    },
    post: async () => response(200, {
      access: "legacy-rotated-access",
      refresh: "legacy-rotated-refresh",
    }),
  });

  const result = await apiCall(helperPage, "GET", "/core/me/");

  expect(result.status).toBe(200);
  expect(requests.map((request) => request.headers?.Authorization)).toEqual([
    "Bearer legacy-expired-access",
    "Bearer legacy-rotated-access",
  ]);
  expect(await readAuthStorage(page)).toMatchObject({
    activeGeneration: null,
    legacyAccess: "legacy-rotated-access",
    legacyRefresh: "legacy-rotated-refresh",
  });
});
