import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, ".env.e2e") });

export default defineConfig({
  testDir: "./e2e/_local",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
    screenshot: "on",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    launchOptions: {
      args: ["--disable-web-security", "--allow-insecure-localhost", "--no-sandbox"],
    },
  },
  projects: [
    {
      name: "chromium-local",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
});
