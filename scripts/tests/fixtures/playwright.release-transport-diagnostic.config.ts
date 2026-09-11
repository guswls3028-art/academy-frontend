import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "release-transport-diagnostic.fixture.ts",
  workers: 1,
  retries: 0,
  reporter: "line",
  use: { headless: true, serviceWorkers: "block" },
});
