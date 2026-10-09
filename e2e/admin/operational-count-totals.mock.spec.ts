import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
test.use({ serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local route mocks only");

for (const width of [1366, 390]) {
  for (const mode of ["complete", "unavailable", "invalid"] as const) {
    test(`운영 업무 전체 건수와 재조회 ${width}px ${mode}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await installTenantOneInitScript(page);
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
      await page.addInitScript((jwt) => { localStorage.setItem("access", jwt); localStorage.setItem("refresh", `${jwt}-refresh`); }, token);
      let state: "complete" | "unavailable" | "invalid" = mode;
      let obsoleteDetailRequests = 0;
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
        const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
        if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "QA 학원", ui_config: {}, feature_flags: {}, is_active: true });
        if (path === "/core/me/") return json({ id: 12, username: "qa-owner", name: "QA 대표", tenantRole: "owner", is_staff: true, is_superuser: false, must_change_password: false });
        if (path === "/exams/") {
          const search = new URL(request.url()).searchParams;
          if (search.get("exam_type") !== "regular" || search.get("page_size") !== "1") {
            return json({ count: 305, results: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, title: "시험 양식", exam_type: "template", is_active: true })) });
          }
          return json({ count: state === "invalid" ? -1 : 205, results: [{ id: 501, title: "운영 시험", exam_type: "regular", is_active: true }] });
        }
        if (path === "/results/admin/teacher-dashboard-counts/") {
          if (state === "unavailable") return json({ detail: "Temporarily unavailable" }, 503);
          return json({ video_failed: 2, qna_pending: state === "invalid" ? -1 : 105, counsel_pending: 107, submission_pending: 205 });
        }
        if (path === "/community/admin/posts/") {
          obsoleteDetailRequests += 1;
          return json({ count: 205, results: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, replies_count: 1, post_type: "qna" })) });
        }
        if (path === "/submissions/submissions/pending/") {
          obsoleteDetailRequests += 1;
          return json(Array.from({ length: 200 }, (_, i) => ({ id: i + 1, status: "submitted" })));
        }
        if (path === "/lectures/attendance/arrival-overview/") return json({ generated_at: "2026-10-09T09:00:00+09:00", soon_window_minutes: 60, today: "2026-10-09", tomorrow: "2026-10-10", range_end: "2026-10-15", range_days: 7, summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 }, items: [] });
        if (path === "/staffs/currently-working/") return json([]);
        if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
        return json({ count: 0, results: [] });
      });
      await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });
      const questions = page.getByRole("button", { name: width < 768 ? /답변 대기 질문 .*처리하기/ : /미답변 질문/ });
      const submissions = page.getByRole("button", { name: width < 768 ? /처리 대기 제출 .*처리하기/ : /제출 채점 대기/ });
      if (mode !== "complete") {
        if (width < 768) {
          await expect(page.getByRole("button", { name: "답변 대기 확인 필요", exact: true })).toBeVisible();
          await expect(page.getByText("일부 업무를 불러오지 못했습니다", { exact: true })).toBeVisible();
          await expect(questions).toHaveCount(0);
          if (mode === "unavailable") await expect(submissions).toHaveCount(0);
          else await expect(submissions).toContainText("205건");
        } else {
          await expect(questions).toContainText("확인 필요");
          if (mode === "invalid") await expect(page.getByRole("button", { name: /운영 중 시험/ })).toContainText("확인 필요");
          if (mode === "unavailable") await expect(submissions).toContainText("확인 필요");
          else await expect(submissions).toContainText("205건");
        }
        state = "complete";
        if (width < 768) await page.getByRole("button", { name: "다시 시도", exact: true }).click();
        else await page.reload({ waitUntil: "domcontentloaded" });
      }
      await expect(questions).toContainText("105건");
      await expect(submissions).toContainText("205건");
      if (width >= 768) await expect(page.getByRole("button", { name: /운영 중 시험/ })).toContainText("205건");
      await page.screenshot({ path: testInfo.outputPath(`dashboard-counts-${width}.png`), fullPage: true });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(questions).toContainText("105건");
      await expect(submissions).toContainText("205건");
      expect(obsoleteDetailRequests).toBe(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
  }
}
