import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";
import {
  productionReadOnlySpecs,
  routeMockSpecs,
} from "./e2e/suites.mjs";

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
  // Leave one CI core for Vite and the runner; four browser workers caused
  // cross-file action starvation and hid it behind retries.
  workers: process.env.CI ? 3 : 2,
  retries: 0,
  projects: [
    ...readOnlyProjects,
    {
      name: "pr-route-mocks",
      testMatch: routeMockSpecs.map(matchSpec),
      dependencies: [`pr-readonly-${productionReadOnlySpecs.length}`],
      use: {
        ...chromium,
        serviceWorkers: "block",
        // Keep first-failure diagnostics without encoding discarded videos
        // or taking a second automatic screenshot after every successful test.
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
        video: "off",
      },
    },
    {
      name: "pr-homework-webkit",
      testMatch: [
        matchSpec("e2e/student/assignment-media-multiupload.mock.spec.ts"),
        matchSpec("e2e/teacher/homework-manual-review.mock.spec.ts"),
        matchSpec("e2e/admin/homework-media-review.mock.spec.ts"),
      ],
      grep: /HEIC/,
      dependencies: [],
      use: { ...webkit, serviceWorkers: "block" },
    },
    {
      name: "pr-modal-webkit",
      testMatch: [
        matchSpec("e2e/clinic/clinic-booking-modes-visual.mock.spec.ts"),
        matchSpec("e2e/admin/lecture-create-responsive.mock.spec.ts"),
        matchSpec("e2e/student/clinic-booking-ux.mock.spec.ts"),
        matchSpec("e2e/student/community-draft-autosave.mock.spec.ts"),
        matchSpec("e2e/teacher/lecture-navigation-recovery.mock.spec.ts"),
        matchSpec("e2e/teacher/attendance-save-undo.mock.spec.ts"),
        matchSpec("e2e/teacher/alimtalk-compose-preview.mock.spec.ts"),
        matchSpec("e2e/teacher/student-create-readback.mock.spec.ts"),
      ],
      grep: /@dialog-journey/,
      dependencies: [],
      use: { ...webkit, serviceWorkers: "block" },
    },
    {
      name: "pr-iphone-webkit",
      testMatch: [
        matchSpec("e2e/godmin-resources.mock.spec.ts"),
        matchSpec("e2e/godmin-videos.mock.spec.ts"),
        matchSpec("e2e/student/video-watch-journey.mock.spec.ts"),
        matchSpec("e2e/auth/iphone-safari-login.mock.spec.ts"),
        matchSpec("e2e/auth/safari-browser-support.mock.spec.ts"),
        matchSpec("e2e/shared/api-document-exit.mock.spec.ts"),
        matchSpec("e2e/admin/community-workspace-polish.mock.spec.ts"),
        matchSpec("e2e/admin/lecture-student-picker.mock.spec.ts"),
      ],
      dependencies: [],
      use: { ...webkit, serviceWorkers: "block" },
    },
  ],
});
