import type { Page } from "@playwright/test";
import { getBaseUrl } from "./auth";

const readFixtures: Record<string, unknown> = {
  "/api/v1/staffs/me/": { is_authenticated: true, is_staff: true, is_superuser: true, is_payroll_manager: false },
  "/api/v1/staffs/currently-working/": [],
  "/api/v1/clinic/participants/": { count: 0, next: null, previous: null, results: [] },
  "/api/v1/community/admin/posts/": { count: 0, next: null, previous: null, results: [] },
  "/api/v1/students/registration_requests/": { count: 0, next: null, previous: null, results: [] },
  "/api/v1/submissions/submissions/pending/": [],
  "/api/v1/submissions/submissions/omr/batches/": [],
  "/api/v1/media/videos/": { count: 0, next: null, previous: null, results: [] },
  "/api/v1/core/landing/admin/consult/": { summary: { unread: 0 } },
  "/api/v1/results/admin/teacher-dashboard-counts/": { video_failed: 0, qna_pending: 0, counsel_pending: 0, submission_pending: 0 },
  "/api/v1/community/admin/reports/pending-count/": { count: 0 },
  "/api/v1/community/notifications/unread-count/": { count: 0 },
  "/api/v1/lectures/attendance/arrival-overview/": {
    generated_at: "2026-10-03T00:00:00Z", today: "2026-10-03", tomorrow: "2026-10-04",
    range_end: "2026-10-10", range_days: 7, soon_window_minutes: 60,
    summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 }, items: [],
  },
};

/** Explicit shell/job-tray reads for local dev and compiled-artifact tests. */
export async function installWorkspaceReadApiStubs(page: Page) {
  const origin = new URL(getBaseUrl("admin"));
  if (origin.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(origin.hostname)) {
    throw new Error("Workspace read fixtures require a local browser origin");
  }
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "GET" && Object.hasOwn(readFixtures, pathname)) {
      await route.fulfill({ json: readFixtures[pathname] });
      return;
    }
    await route.fallback();
  });
}
