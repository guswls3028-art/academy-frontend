import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/_local",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    // Vite dev server 첫 빌드에 시간이 걸리므로 넉넉히
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
