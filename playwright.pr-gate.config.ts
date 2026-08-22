import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";
import {
  productionReadOnlySpecs,
  routeMockSpecs,
} from "./scripts/e2e-gate-specs.mjs";

const chromium = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
};

const webkit = {
  ...devices["Desktop Safari"],
  viewport: { width: 390, height: 844 },
};

function matchSpec(spec: string): string {
  return `**/${spec.replace(/^e2e\//, "")}`;
}

const readOnlyProjects = productionReadOnlySpecs.map((spec, index) => {
  const name = `pr-readonly-${index + 1}`;
  return {
    name,
    testMatch: [matchSpec(spec)],
    dependencies: index === 0 ? [] : [`pr-readonly-${index}`],
    use: chromium,
  };
});

export default defineConfig({
  ...baseConfig,
  // Production-backed login/health specs form the dependency chain above.
  // The PR workflow runs route mocks in a separate closed-proxy job.
  workers: process.env.CI ? 4 : 2,
  projects: [
    ...readOnlyProjects,
    {
      name: "pr-route-mocks",
      testMatch: routeMockSpecs.map(matchSpec),
      dependencies: [`pr-readonly-${productionReadOnlySpecs.length}`],
      use: chromium,
    },
    {
      name: "pr-iphone-webkit",
      testMatch: [matchSpec("e2e/auth/iphone-safari-login.mock.spec.ts")],
      dependencies: [],
      use: webkit,
    },
  ],
});
