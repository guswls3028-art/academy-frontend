import { expect, test, type Page } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5186";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

async function installApi(page: Page, role: "teacher" | "admin", scenario: string) {
  await page.clock.setFixedTime(new Date("2026-10-09T12:00:00+09:00"));
  await installTenantOneInitScript(page);
  const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, `e30.${payload}.signature`);
  const rows = Array.from({ length: 31 }, (_, index) => ({
    id: 1000 + index, date: scenario === "many" ? "2026-10-31" : `2026-10-${String(index + 1).padStart(2, "0")}`,
    title: `클리닉 검증 ${index + 1}`, location: `검증${index + 1}실`,
    start_time: "17:00:00", end_time: "18:00:00", duration_minutes: 60,
    participant_count: 2, booked_count: 2, max_participants: 10,
    allow_multi_slot_booking: true, booking_mode: "fixed_slot",
  }));
  const state = { failing: !["complete", "many"].includes(scenario), pages: [] as number[] };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
    if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "클리닉 담당자", username: "clinic-owner", is_staff: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false } });
    if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
    if (path === "/clinic/sessions/") {
      if (url.searchParams.get("date_from") === "2026-11-01") {
        expect(url.searchParams.get("date_to")).toBe("2026-11-30");
        return route.fulfill({ json: { count: 0, next: null, results: [] } });
      }
      expect(url.searchParams.get("date_from")).toBe("2026-10-01");
      expect(url.searchParams.get("date_to")).toBe("2026-10-31");
      const pageNumber = Number(url.searchParams.get("page") || 1);
      state.pages.push(pageNumber);
      const ordered = role === "teacher" ? [...rows].reverse() : rows;
      if (state.failing && scenario === "http" && pageNumber === 2) return route.fulfill({ status: 400, json: { detail: "QA second page failure" } });
      const items = state.failing && scenario === "duplicate" && pageNumber === 2 ? [ordered[0], ...ordered.slice(21)] : ordered.slice((pageNumber - 1) * 20, pageNumber * 20);
      const next = state.failing && scenario === "truncated" ? null : pageNumber === 1 ? "?page=2" : null;
      const count = state.failing && scenario === "count-change" && pageNumber === 2 ? 30 : 31;
      return route.fulfill({ json: { count, next, results: items } });
    }
    return route.fulfill({ json: [] });
  });
  return state;
}

for (const width of [390, 1366]) {
  test(`클리닉 하루 31건 전체 읽기와 월 이동 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installApi(page, "admin", "many");
    await gotoAndSettle(page, `${BASE}/workspace/clinic/reports`);
    const day = page.getByRole("button", { name: "2026-10-31 클리닉 31건", exact: true });
    await day.focus();
    await page.keyboard.press("Enter");
    await expect(day).toHaveAttribute("aria-pressed", "true");
    const details = page.getByRole("region", { name: "2026-10-31 클리닉", exact: true });
    await expect(details.getByText(/^클리닉 검증 \d+$/)).toHaveCount(31);
    await expect(details.getByText("검증31실", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "다음 달", exact: true }).click();
    await expect(details).toHaveCount(0);
    await expect(page.getByText("이 달에는 클리닉 일정이 없습니다.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "이전 달", exact: true }).click();
    await day.click();
    await expect(details.getByText(/^클리닉 검증 \d+$/)).toHaveCount(31);
    await page.reload();
    await day.click();
    await expect(details.getByText(/^클리닉 검증 \d+$/)).toHaveCount(31);
  });

  for (const role of ["teacher", "admin"] as const) {
    for (const scenario of ["complete", "http", "duplicate", "truncated", "count-change"]) {
      test(`클리닉 전체 일정 ${width}px ${role} ${scenario}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const state = await installApi(page, role, scenario);
        const path = role === "teacher" ? "/workspace/mobile/clinic/reports" : "/workspace/clinic/reports";
        await gotoAndSettle(page, `${BASE}${path}`);
        if (state.failing) {
          const error = role === "teacher" ? "클리닉 보고서를 불러오지 못했습니다" : "클리닉 데이터를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.";
          await expect(page.getByText(error, { exact: true })).toBeVisible();
          state.failing = false;
          await page.getByRole("button", { name: "다시 시도", exact: true }).click();
        }
        if (role === "teacher") {
          await page.getByRole("button", { name: /^1\s+1$/ }).click();
          await expect(page.getByText("클리닉 검증 1", { exact: true })).toBeVisible();
        } else {
          await page.getByRole("button", { name: "2026-10-31 클리닉 1건", exact: true }).click();
          await expect(page.getByRole("region", { name: "2026-10-31 클리닉", exact: true })).toBeInViewport();
          await expect(page.getByRole("region", { name: "2026-10-31 클리닉", exact: true }).getByText("검증31실", { exact: true })).toBeVisible();
        }
        expect(state.pages).toContain(2);
        await waitForRenderSettled(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (scenario === "complete") await page.screenshot({ path: test.info().outputPath(`clinic-${role}-${width}.png`), animations: "disabled" });
        await page.reload();
        if (role === "teacher") {
          await page.getByRole("button", { name: /^1\s+1$/ }).click();
          await expect(page.getByText("클리닉 검증 1", { exact: true })).toBeVisible();
        } else {
          await page.getByRole("button", { name: "2026-10-31 클리닉 1건", exact: true }).click();
          await expect(page.getByRole("region", { name: "2026-10-31 클리닉", exact: true }).getByText("검증31실", { exact: true })).toBeVisible();
        }
      });
    }
  }
}
