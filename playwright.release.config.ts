import { defineConfig } from "@playwright/test";

import { maintainedReleaseSpecs } from "./e2e/suites.mjs";
import baseConfig from "./playwright.config";

const matchSpec = (spec: string): string => `**/${spec.replace(/^e2e\//, "")}`;

export default defineConfig({
  ...baseConfig,
  testMatch: maintainedReleaseSpecs.map(matchSpec),
});
