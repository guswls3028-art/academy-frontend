import { defineConfig, devices } from "@playwright/test";
import { developmentRealUseCases } from "./e2e/suites.mjs";
import { readDiagnosticFullSuiteMode } from "./scripts/run-development-release-canary.mjs";

const diagnosticOnly = readDiagnosticFullSuiteMode();

export default defineConfig({
  testDir: "./e2e",
  testMatch: Object.keys(developmentRealUseCases),
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: diagnosticOnly ? 0 : 1,
  timeout: 17 * 60_000,
  expect: { timeout: 10_000 },
  reporter: [["json"], ["./scripts/release-canary-progress-reporter.mjs"]],
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
