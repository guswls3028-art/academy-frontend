import { expect, test, type Page } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5183";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

async function installApi(page: Page, kind: "exam" | "homework", scenario: string) {
  await installTenantOneInitScript(page);
  const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, `e30.${payload}.signature`);
  const label = kind === "exam" ? "시험" : "과제";
  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: 1000 - index, title: `${label} 검증 ${String(index + 1).padStart(3, "0")}`,
    exam_type: "regular", homework_type: "regular", max_score: 100,
    created_at: "2026-10-01T09:00:00+09:00", session_id: null, session_ids: [],
  }));
  const state = { failing: scenario !== "complete", pages: [] as number[], resultRequests: [] as string[] };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
    if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "평가 담당자", username: "assessment-owner", is_staff: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false } });
    if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
    if (path === "/lectures/lectures/") return route.fulfill({ json: [{ id: 71, title: "검증 강의", is_active: true }] });
    if (path === (kind === "exam" ? "/exams/" : "/homeworks/")) {
      expect(url.searchParams.get("ordering")).toBe("-created_at,-id");
      if (url.searchParams.has("lecture_id")) expect(url.searchParams.get("lecture_id")).toBe("71");
      else expect(url.searchParams.get(`${kind === "exam" ? "exam" : "homework"}_type`)).toBe("regular");
      const pageNumber = Number(url.searchParams.get("page") || 1);
      state.pages.push(pageNumber);
      const size = Math.min(500, Number(url.searchParams.get("page_size") || 20));
      if (state.failing && scenario === "http" && pageNumber === 2) return route.fulfill({ status: 400, json: { detail: "QA second page failure" } });
      const items = state.failing && scenario === "duplicate" && pageNumber === 2 ? [rows[0]] : rows.slice((pageNumber - 1) * size, pageNumber * size);
      const next = state.failing && scenario === "truncated" ? null : pageNumber * size < rows.length ? `?page=${pageNumber + 1}` : null;
      return route.fulfill({ json: { count: rows.length, next, results: items } });
    }
    if (path === (kind === "exam" ? "/exams/500/" : "/homeworks/500/")) return route.fulfill({ json: rows[500] });
    if (path === "/results/admin/exams/500/results/") {
      state.resultRequests.push(path);
      return route.fulfill({ json: [{ enrollment_id: 301, student_id: 101, student_name: "결과 검증 학생", total_score: 89, final_score: 89, exam_score: 89, max_score: 100, exam_max_score: 100, passed: true }] });
    }
    return route.fulfill({ json: [] });
  });
  return state;
}

for (const width of [390, 1366]) {
  for (const kind of ["exam", "homework"] as const) {
    for (const scenario of ["complete", "http", "duplicate", "truncated"]) {
      test(`평가 전체 목록 ${width}px ${kind} ${scenario}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const state = await installApi(page, kind, scenario);
        const label = kind === "exam" ? "시험" : "과제";
        await gotoAndSettle(page, `${BASE}/workspace/mobile/exams`);
        if (kind === "homework") await page.getByRole("tab", { name: "과제", exact: true }).click();
        if (state.failing) {
          await expect(page.getByText(`${label} 목록을 불러오지 못했습니다`, { exact: true })).toBeVisible();
          await expect(page.getByText(`${label} 검증 001`, { exact: true })).toHaveCount(0);
          state.failing = false;
          await page.getByRole("button", { name: "다시 시도", exact: true }).click();
        }
        await expect(page.getByText(`${label} 검증 501`, { exact: true })).toBeVisible();
        expect(state.pages).toContain(2);
        await page.getByText(`${label} 검증 501`, { exact: true }).scrollIntoViewIfNeeded();
        await waitForRenderSettled(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({ path: test.info().outputPath(`assessment-${kind}-${width}.png`), animations: "disabled" });
        await page.getByRole("button", { name: new RegExp(`${label} 검증 501`) }).click();
        await expect(page.getByRole("heading", { name: `${label} 검증 501`, exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByRole("heading", { name: `${label} 검증 501`, exact: true })).toBeVisible();
      });
    }
  }
  test(`성적 선택의 501번째 시험 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installApi(page, "exam", "complete");
    await gotoAndSettle(page, `${BASE}/workspace/mobile/results`);
    await page.getByRole("button", { name: "첫 강의 선택", exact: true }).click();
    await page.getByRole("button", { name: "시험 검증 501", exact: true }).click();
    await expect(page.getByText("결과 검증 학생", { exact: true })).toBeVisible();
    expect(state.resultRequests).toEqual(["/results/admin/exams/500/results/"]);
    expect(state.pages).toContain(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
