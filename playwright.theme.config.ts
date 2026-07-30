import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e/visual",
  testMatch: "theme-control-states.spec.ts",
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/login/tchul",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
