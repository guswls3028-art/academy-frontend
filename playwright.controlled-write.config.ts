import { defineConfig } from "@playwright/test";

import { controlledWriteSpecs } from "./e2e/suites.mjs";
import baseConfig from "./playwright.config";

const matchSpec = (spec: string): string => `**/${spec.replace(/^e2e\//, "")}`;

export default defineConfig({
  ...baseConfig,
  retries: 0,
  testMatch: controlledWriteSpecs.map(matchSpec),
});
