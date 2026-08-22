import { defineConfig, devices } from "@playwright/test";

const BASE = String(process.env.E2E_BASE_URL || "").replace(/\/+$/, "");
const API = String(process.env.E2E_API_URL || "").replace(/\/+$/, "");
const PROXY = String(process.env.VITE_DEV_PROXY_TARGET || "").replace(/\/+$/, "");
const OUTPUT_DIR = String(process.env.E2E_LOGIN_UAT_OUTPUT_DIR || "").trim();

function loopbackOnly(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}

if (!loopbackOnly(BASE) || !loopbackOnly(API)) {
  throw new Error("iPhone login UAT requires explicit loopback frontend and API URLs.");
}
if (BASE !== "http://127.0.0.1:5174") {
  throw new Error("iPhone login UAT owns the exact http://127.0.0.1:5174 frontend origin.");
}
if (PROXY !== API) {
  throw new Error("VITE_DEV_PROXY_TARGET must exactly match E2E_API_URL.");
}
if (process.env.E2E_ALLOW_PRODUCTION_WRITES !== "0") {
  throw new Error("iPhone login UAT requires E2E_ALLOW_PRODUCTION_WRITES=0.");
}
if (!OUTPUT_DIR) {
  throw new Error("E2E_LOGIN_UAT_OUTPUT_DIR is required.");
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth/iphone-safari-login.persistent-development.spec.ts",
  timeout: 900_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: OUTPUT_DIR,
  use: {
    baseURL: BASE,
    headless: true,
    serviceWorkers: "block",
    screenshot: "off",
    trace: "off",
    video: "off",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 5174 --strictPort",
    url: BASE,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 } },
    },
  ],
});
