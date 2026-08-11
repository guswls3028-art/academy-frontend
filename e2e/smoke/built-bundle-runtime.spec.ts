import { test, expect } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");

test("production bundle boots the public promo route without runtime defects", async ({ page }) => {
  const response = await page.goto(`${BASE}/promo`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  expect(response?.ok(), `Unexpected /promo status ${response?.status()}`).toBe(true);
  await expect(page.getByRole("heading", {
    name: "학원의 수업과 운영을 한 흐름으로 관리합니다.",
  })).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();
});
