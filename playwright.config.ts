import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, ".env.e2e") });

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["_local/**", "**/_archive/**"],
  // E2E_STRICT=report 모드에서 spec 별 console.error/pageerror annotation 을
  // test-results/strict-defects.json 으로 합산 — 운영자 점검용.
  globalTeardown: "./e2e/globalTeardown.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    headless: true,
    screenshot: "on",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
