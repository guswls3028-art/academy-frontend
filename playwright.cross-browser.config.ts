import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
    },
  ],
});
