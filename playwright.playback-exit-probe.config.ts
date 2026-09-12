import { defineConfig } from "@playwright/test";

if (process.env.E2E_PLAYBACK_EXIT_PROBE !== "1") throw new Error("Explicit short playback probe opt-in required");
if (!process.env.E2E_PLAYBACK_EXIT_OUTPUT_DIR) throw new Error("Owned disposable output directory required");

export default defineConfig({
  testDir: "./e2e/student",
  testMatch: "video-playback-renewal.realuse.spec.ts",
  grep: /short playback exit probe preserves both session generations$/,
  outputDir: process.env.E2E_PLAYBACK_EXIT_OUTPUT_DIR,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 8 * 60_000,
  expect: { timeout: 15_000 },
  reporter: "json",
  use: { browserName: "chromium", headless: true, serviceWorkers: "block", screenshot: "off", trace: "off", video: "off",
    actionTimeout: 10_000, navigationTimeout: 45_000 },
});
