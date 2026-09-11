import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "../../../e2e/fixtures/strictTest";
import { installReleaseRequestGuard } from "../../../e2e/helpers/releaseApiBoundary";

test("unrecovered route transport remains a visible fixture failure", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent("<!doctype html><title>release transport fixture</title>");
  await page.evaluate(async () => {
    const headers = {
      "X-Tenant-Code": "qa-ymath-realuse-fixture-transport",
      "X-Fixture-Secret": "fixture-secret-header",
    };
    await fetch("https://api.hakwonplus.com/api/v1/student/video/sessions/987654321/videos/?fixture-secret-query", { headers })
      .catch(() => undefined);
    await fetch("https://api.hakwonplus.com/api/v1/private/secret-student-name-839201/", { headers })
      .catch(() => undefined);
  });
  await context.close();
});

const directRequestTest = test.extend<{
  directRequest: { request: APIRequestContext; networkCalls: { count: number }; violations: { count: number } };
}>({
  directRequest: async ({ browserName }, provide) => {
    void browserName;
    const networkCalls = { count: 0 };
    const violations = { count: 0 };
    const network = async () => {
      networkCalls.count += 1;
      throw new Error("fixture network must not be called");
    };
    const request = Object.fromEntries(
      ["fetch", "get", "head", "post", "put", "patch", "delete"].map((method) => [method, network]),
    ) as unknown as APIRequestContext;
    installReleaseRequestGuard(request, {
      mode: "readonly",
      apiOrigin: "https://api.hakwonplus.com",
      webOrigin: "https://hakwonplus.com",
      tenantCode: "hakwonplus",
    }, undefined, undefined, () => { violations.count += 1; });
    await provide({ request, networkCalls, violations });
  },
});

directRequestTest("direct APIRequestContext mutations fail without publishing request paths", async ({ directRequest }) => {
  const headers = { "X-Tenant-Code": "hakwonplus", "X-Fixture-Secret": "fixture-direct-secret-header" };
  const failures: string[] = [];
  for (const attempt of [
    () => directRequest.request.post(
      "https://api.hakwonplus.com/api/v1/student/video/videos/987654321/progress/?fixture-direct-secret-query",
      { headers, data: { fixture: "must-not-send" } },
    ),
    () => directRequest.request.put(
      "https://api.hakwonplus.com/api/v1/private/secret-student-name-839201/?fixture-direct-secret-query",
      { headers, data: { fixture: "must-not-send" } },
    ),
  ]) {
    try { await attempt(); }
    catch (error) { failures.push(error instanceof Error ? error.message : "unknown refusal"); }
  }
  console.log(JSON.stringify({ networkCalls: directRequest.networkCalls.count, violations: directRequest.violations.count }));
  expect(directRequest.networkCalls.count).toBe(0);
  expect(directRequest.violations.count).toBe(2);
  throw new Error(`Direct APIRequestContext fail-closed: ${failures.join("; ")}`);
});
