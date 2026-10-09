import type { Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174";

for (const width of [1366, 390]) {
  for (const [role, superuser] of [["teacher", true], ["teacher", false], ["owner", false], ["admin", false], ["staff", true]] as const) {
    test(`${width}px ${role} global-superuser=${superuser}: reports and review use tenant role`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const token = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 41 })).toString("base64url")}.sig`;
      await page.addInitScript(({ access }) => {
        localStorage.setItem("access", access);
        localStorage.setItem("refresh", `${access}-refresh`);
        localStorage.setItem("tenant_code", "hakwonplus");
        sessionStorage.setItem("tenantCode", "hakwonplus");
      }, { access: token });
      const admin = role === "owner" || role === "admin";
      const mineReads: boolean[] = [];
      const report = {
        id: 101, document_id: 301, document_title: "권한 검증 시험지", document_category: "과학",
        author_id: 41, author_name: "QA 강사", title: "내 분석 보고서", status: "draft",
        exam_count: 0, curated_count: 0, curated_progress: 0, hit_count: 0, hit_rate: 0,
        has_share_token: false, created_at: "2026-10-09T00:00:00Z", updated_at: "2026-10-09T00:00:00Z",
      };
      const handleApi = async (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api\/v1/, "");
        const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", json: value });
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
        if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "검증 학원", ui_config: {}, feature_flags: {}, is_active: true });
        if (path === "/core/me/") return json({ id: 41, username: "qa-role", name: "QA 강사", is_staff: true, is_superuser: superuser, tenantRole: role, must_change_password: false, first_login_guide_required: false });
        if (path === "/staffs/me/") return json({ is_authenticated: true, is_staff: true, is_superuser: superuser, is_owner: admin, staff_id: 41, assigned_work_types: [] });
        if (path === "/storage/inventory/") return json({ folders: [], files: [{ id: "401", name: "qa.pdf", displayName: "직원 공용 자료", sizeBytes: 100, contentType: "application/pdf", createdAt: report.created_at }] });
        if (path === "/matchup/hit-reports/") {
          const mine = url.searchParams.get("mine") === "1";
          mineReads.push(mine);
          const reports = admin && !mine ? [report, { ...report, id: 102, author_id: 42, title: "다른 강사 보고서" }] : [report];
          return json({ reports, summary: { total: reports.length, submitted: 0, drafts: reports.length, total_exam: 0, total_hit: 0, avg_hit_rate: 0 } });
        }
        if (path === "/matchup/documents/") return json([{ id: 301, title: "권한 검증 시험지", category: "과학", status: "done", problem_count: 0, r2_key: "qa/exam.pdf", original_name: "exam.pdf", meta: { source_type: "exam" }, created_at: report.created_at, updated_at: report.updated_at }]);
        if (path === "/matchup/problems/" || path === "/matchup/categories/" || path === "/results/admin/clinic-targets/") return json([]);
        if (path === "/matchup/documents/301/hit-report-draft/") return json({ report: null, entries: [] });
        if (path === "/matchup/hit-reports/board-preview/") return json({ reports: [], total_published: 0 });
        if (path === "/matchup/proposals/") {
          expect(admin).toBe(true);
          return json({ proposals: [], total: 0, limit: 50, offset: 0 });
        }
        return json({ count: 0, results: [] });
      };
      await page.route("**/api/v1/**", handleApi);
      if (role === "staff") {
        for (const path of ["", "/matchup", "/hit-reports", "/proposals"]) {
          await page.goto(`${BASE}/workspace/storage${path}`);
          await expect(page).toHaveURL(/\/workspace\/storage\/files$/);
          await expect(page.getByText("직원 공용 자료", { exact: true }).first()).toBeVisible();
          await expect(page.getByRole("tab", { name: "분리 검수", exact: true })).toHaveCount(0);
          await expect(page.getByRole("tab", { name: "적중 보고서", exact: true })).toHaveCount(0);
        }
        await page.reload();
        await expect(page.getByText("직원 공용 자료", { exact: true }).first()).toBeVisible();
        return;
      }
      await page.goto(`${BASE}/workspace/storage/hit-reports`);
      await expect(page.getByTestId("hit-report-card")).toHaveCount(admin ? 2 : 1);
      await expect(page.getByRole("tab", { name: "분리 검수", exact: true })).toHaveCount(admin ? 1 : 0);
      const allTab = page.getByRole("button", { name: "전체 (학원장 inbox)", exact: true });
      await expect(allTab).toHaveCount(admin ? 1 : 0);
      if (admin) {
        await page.getByRole("button", { name: "내 보고서", exact: true }).click();
        await expect(page.getByTestId("hit-report-card")).toHaveCount(1);
        await allTab.click();
        await expect(page.getByTestId("hit-report-card")).toHaveCount(2);
      }
      await page.reload();
      await expect(page.getByTestId("hit-report-card")).toHaveCount(admin ? 2 : 1);
      if (!admin) expect(mineReads.every(Boolean)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.goto(`${BASE}/workspace/storage/matchup?docId=301`);
      await expect(page.getByText("권한 검증 시험지", { exact: true }).first()).toBeVisible();
      const review = page.getByTestId("matchup-proposal-review-open-btn");
      if (admin) {
        await expect(review).toBeVisible();
        await review.click();
        await expect(page.getByTestId("matchup-proposal-review-panel")).toBeVisible();
        await expect(page.getByTestId("matchup-proposal-review-empty")).toBeVisible();
        await page.getByTestId("matchup-proposal-review-close").click();
        await expect(page.getByTestId("matchup-proposal-review-panel")).not.toBeVisible();
      } else {
        await expect(review).toHaveCount(0);
        await expect(page.getByText("내 적중 보고서 모음", { exact: true })).toBeVisible();
        await page.goto(`${BASE}/workspace/storage/proposals`);
        await expect(page).toHaveURL((url) => url.pathname === "/workspace/storage/matchup");
        await expect(page.getByText("내 적중 보고서 모음", { exact: true })).toBeVisible();
      }
      await page.screenshot({ path: test.info().outputPath(`matchup-${role}-${superuser}-${width}.png`), fullPage: true });
    });
  }
}
