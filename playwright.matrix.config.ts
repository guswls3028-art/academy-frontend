import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
