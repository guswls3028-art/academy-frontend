import { defineConfig } from "@playwright/test";

if (process.env.GUIDE_MEDIA_CAPTURE !== "1") throw new Error("Guide recording is an explicit authoring task.");

export default defineConfig({
  testDir: "./e2e", grep: /@guide-recording/,
  testMatch: ["admin/lecture-session-scopes.mock.spec.ts", "teacher/student-create-readback.mock.spec.ts",
    "admin/session-attendance-bulk-safety.mock.spec.ts", "student/assignment-media-multiupload.mock.spec.ts",
    "teacher/attendance-roster-pages.mock.spec.ts", "admin/manual-exam-grading.mock.spec.ts",
    "admin/messaging-direct-alimtalk.mock.spec.ts", "clinic/clinic-booking-modes-visual.mock.spec.ts",
    "admin/video-batch-upload-queue.mock.spec.ts"],
  timeout: 120_000, expect: { timeout: 20_000 },
  workers: 1, retries: 0, reporter: [["list"], ["json", { outputFile: "guide-media-output/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5197", browserName: "chromium", locale: "ko-KR",
    viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1,
    colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block",
    launchOptions: { slowMo: 120 }, video: { mode: "on", size: { width: 1366, height: 900 } },
    trace: "off", screenshot: "off",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 5197 --strictPort", url: "http://127.0.0.1:5197",
    reuseExistingServer: false, timeout: 120_000,
    env: { VITE_DEV_PROXY_TARGET: "http://127.0.0.1:9", VITE_DEV_TENANT_ID: "1" },
  },
});
