import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5179";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

for (const width of [390, 1366]) {
  for (const scenario of ["complete", "http", "duplicate", "truncated", "count-change"]) {
    test(`강의 수강생 전체 조회와 중간 오류 복구 ${width}px ${scenario}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installTenantOneInitScript(page);
      const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
      await page.addInitScript((token) => {
        localStorage.setItem("access", token);
        localStorage.setItem("refresh", `${token}-refresh`);
      }, `e30.${payload}.signature`);
      let failing = scenario !== "complete";
      const rows = Array.from({ length: 501 }, (_, index) => ({
        id: index + 1, lecture: 71, status: "ACTIVE",
        student: { id: index + 101, name: `수강 검증 ${String(index + 1).padStart(3, "0")}`, grade: null,
          ...(index === 500 ? { phone: "01000000501", parent_phone: "01000000502" } : {}) },
      }));
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api\/v1/, "");
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
        if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
        if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "등록 담당자", username: "roster-owner", is_staff: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false } });
        if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
        if (path === "/lectures/lectures/71/") return route.fulfill({ json: { id: 71, title: "수강 명단 검증", name: "수강 명단 검증", is_active: true } });
        if (path === "/enrollments/") {
          expect(url.searchParams.get("lecture")).toBe("71");
          const pageNumber = Number(url.searchParams.get("page") || 1);
          const size = Math.min(500, Number(url.searchParams.get("page_size") || 20));
          if (failing && scenario === "http" && pageNumber === 2) return route.fulfill({ status: 400, json: { detail: "QA second page failed" } });
          const items = failing && scenario === "duplicate" && pageNumber === 2
            ? [rows[0]] : rows.slice((pageNumber - 1) * size, pageNumber * size);
          const count = failing && scenario === "count-change" && pageNumber === 2 ? 502 : rows.length;
          const next = failing && scenario === "truncated" ? null : pageNumber * size < rows.length ? `?page=${pageNumber + 1}` : null;
          return route.fulfill({ json: { count, next, results: items } });
        }
        return route.fulfill({ json: { count: 0, next: null, results: [] } });
      });
      await gotoAndSettle(page, `${BASE}/workspace/mobile/classes/71`);
      await page.getByRole("button", { name: /^수강생 \(/ }).click();
      if (failing) {
        await expect(page.getByText("수강생을 불러오지 못했습니다", { exact: true })).toBeVisible();
        await expect(page.getByText("수강 검증 001", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "수강생 등록", exact: true })).toBeDisabled();
        failing = false;
        await page.getByRole("button", { name: "다시 시도", exact: true }).click();
      }
      await expect(page.getByRole("button", { name: "수강생 (501)", exact: true })).toBeVisible();
      await expect(page.getByText("수강 검증 501", { exact: true })).toBeVisible();
      await expect(page.getByText("학 010-0000-0501", { exact: true })).toBeVisible();
      await expect(page.getByText("부 010-0000-0502", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "수강생 등록", exact: true })).toBeEnabled();
      await page.getByText("수강 검증 501", { exact: true }).scrollIntoViewIfNeeded();
      await waitForRenderSettled(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: test.info().outputPath(`lecture-roster-${width}.png`), fullPage: false, animations: "disabled" });
      await page.reload();
      await page.getByRole("button", { name: "수강생 (501)", exact: true }).click();
      await expect(page.getByText("수강 검증 501", { exact: true })).toBeVisible();
    });
  }
}
