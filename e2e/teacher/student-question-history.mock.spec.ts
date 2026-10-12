import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5179";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

for (const { width, scenario } of [
  { width: 390, scenario: "complete" }, { width: 1366, scenario: "complete" },
  ...["initial-error", "next-error", "malformed", "empty"].map((scenario) => ({ width: 390, scenario })),
]) {
  test(`학생 질문 이력의 작성자 범위·추가 조회·복구 ${width}px ${scenario}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", `${token}-refresh`);
    }, `e30.${payload}.signature`);
    const ownPosts = Array.from({ length: scenario === "empty" ? 0 : 51 }, (_, index) => ({
      id: index + 1, title: index === 50 ? "본인 오래된 상담" : `본인 질문 ${String(index + 1).padStart(2, "0")}`,
      created_by: 71, post_type: index === 50 ? "counsel" : "qna", replies_count: 1, created_at: "2026-10-01T10:00:00Z",
    }));
    const otherPost = { id: 999, title: "다른 학생 질문", created_by: 72, post_type: "qna", replies_count: 0 };
    let failing = !["complete", "empty"].includes(scenario);
    const historyRequests: Array<{ author: string | null; page: number }> = [];
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "학생 담당자", username: "student-owner", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (/^\/students\/(71|72)\/$/.test(path)) return route.fulfill({ json: { id: Number(path.split("/")[2]), name: path.includes("71") ? "검증 학생" : "다른 학생", ps_number: "qa-student", is_active: true, enrollments: [], tags: [] } });
      if (path.endsWith("/grades/")) return route.fulfill({ json: { exams: [], homeworks: [], exam_trend: [], exam_summary: { average_score_pct: null, total: 0 } } });
      if (path === "/community/posts/") {
        const author = url.searchParams.get("author_student");
        const pageNumber = Number(url.searchParams.get("page") || 1);
        historyRequests.push({ author, page: pageNumber });
        if (failing && ((scenario === "initial-error" && pageNumber === 1) || (scenario === "next-error" && pageNumber === 2))) {
          return route.fulfill({ status: 503, json: { detail: "질문 이력 조회를 잠시 사용할 수 없습니다." } });
        }
        if (failing && scenario === "malformed" && pageNumber === 2) return route.fulfill({ json: { count: 51, results: null, next: null } });
        // Backend only accepts author_student; created_by is an ignored query parameter.
        const visible = author === "71" ? ownPosts : author === "72" ? [otherPost] : [otherPost, ...ownPosts];
        const size = Number(url.searchParams.get("page_size") || 50);
        return route.fulfill({ json: { count: visible.length, next: pageNumber * size < visible.length ? `?page=${pageNumber + 1}` : null, results: visible.slice((pageNumber - 1) * size, pageNumber * size) } });
      }
      return route.fulfill({ json: { count: 0, next: null, results: [] } });
    });

    await gotoAndSettle(page, `${BASE}/workspace/mobile/students/71`);
    await page.getByRole("button", { name: "질문", exact: true }).click();
    if (scenario === "initial-error") {
      await expect(page.getByText("질문 이력을 불러오지 못했습니다", { exact: true })).toBeVisible();
      await expect(page.getByText("질문 이력 없음", { exact: true })).toHaveCount(0);
      failing = false;
      await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    }
    if (scenario === "empty") {
      await expect(page.getByText("질문 이력 없음", { exact: true })).toBeVisible();
      await expect(page.getByText("다른 학생 질문", { exact: true })).toHaveCount(0);
      expect(historyRequests).toEqual([{ author: "71", page: 1 }]);
      return;
    }
    await expect(page.getByText("본인 질문 01", { exact: true })).toBeVisible();
    await expect(page.getByText("다른 학생 질문", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "이력 더 보기", exact: true }).click();
    if (scenario === "next-error" || scenario === "malformed") {
      await expect(page.getByText("질문 이력을 불러오지 못했습니다", { exact: true })).toBeVisible();
      await expect(page.getByText("본인 질문 01", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "다시 시도", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath(`history-error-${scenario}.png`), animations: "disabled" });
      failing = false;
      await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    }
    const older = page.getByText("본인 오래된 상담", { exact: true });
    await expect(older).toBeVisible();
    await expect(page.getByRole("button", { name: "이력 더 보기", exact: true })).toHaveCount(0);
    expect(historyRequests.every((entry) => entry.author === "71")).toBe(true);
    expect(historyRequests.some((entry) => entry.page === 2)).toBe(true);
    await older.scrollIntoViewIfNeeded();
    await waitForRenderSettled(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`history-complete-${width}.png`), animations: "disabled" });
    await page.reload();
    await page.getByRole("button", { name: "질문", exact: true }).click();
    await expect(page.getByText("본인 질문 01", { exact: true })).toBeVisible();
    await expect(page.getByText("다른 학생 질문", { exact: true })).toHaveCount(0);
    await gotoAndSettle(page, `${BASE}/workspace/mobile/students/72`);
    await page.getByRole("button", { name: "질문", exact: true }).click();
    await expect(page.getByText("다른 학생 질문", { exact: true })).toBeVisible();
    await expect(page.getByText("본인 질문 01", { exact: true })).toHaveCount(0);
  });
}
