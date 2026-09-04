import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["flows/notice-roundtrip.spec.ts", "flows/qna-roundtrip.spec.ts", "flows/clinic-roundtrip.spec.ts"],
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [["json"]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1920, height: 1080 },
    headless: true,
    serviceWorkers: "block",
    screenshot: "off",
    trace: "off",
    video: "off",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },
  projects: [{ name: "chromium" }],
});
