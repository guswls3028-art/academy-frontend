import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_BASE_URL || "https://api.hakwonplus.com";

test.describe("Post-deploy smoke tests", () => {
  test("API health check", async ({ request }) => {
    const resp = await request.get(`${API_BASE}/healthz`);
    expect(resp.status()).toBe(200);
  });
});
