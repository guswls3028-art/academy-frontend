import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5179";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

for (const { width, scenario } of [
  { width: 390, scenario: "complete" }, { width: 1366, scenario: "complete" },
  ...["initial-error", "next-error", "incomplete", "empty"].map((scenario) => ({ width: 390, scenario })),
]) {
  test(`학생 목록 51번째 학생·선택·복구 ${width}px ${scenario}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", `${token}-refresh`);
    }, `e30.${payload}.signature`);
    const students = Array.from({ length: scenario === "empty" ? 0 : 51 }, (_, index) => ({
      id: index + 1, name: index === 50 ? "끝학생" : `검증 학생 ${String(index + 1).padStart(2, "0")}`,
      ps_number: `qa-student-${index + 1}`, is_managed: true, enrollments: [], tags: [], grade: 1,
    }));
    let failing = !["complete", "empty"].includes(scenario);
    const requests: Array<{ search: string; page: number }> = [];
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "학생 담당자", username: "student-owner", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (path === "/students/") {
        const search = url.searchParams.get("search") || "";
        const pageNumber = Number(url.searchParams.get("page") || 1);
        requests.push({ search, page: pageNumber });
        if (failing && ((scenario === "initial-error" && pageNumber === 1) || (scenario === "next-error" && pageNumber === 2))) {
          return route.fulfill({ status: 503, json: { detail: "학생 목록 조회를 잠시 사용할 수 없습니다." } });
        }
        if (failing && scenario === "incomplete" && pageNumber === 2) return route.fulfill({ json: { count: 51, results: [] } });
        const visible = students.filter((student) => student.name.includes(search));
        const size = Number(url.searchParams.get("page_size") || 50);
        return route.fulfill({ json: { count: visible.length, next: pageNumber * size < visible.length ? `?page=${pageNumber + 1}` : null, results: visible.slice((pageNumber - 1) * size, pageNumber * size) } });
      }
      if (path === "/students/51/") return route.fulfill({ json: students[50] });
      if (path.endsWith("/grades/")) return route.fulfill({ json: { exams: [], homeworks: [], exam_trend: [], exam_summary: { average_score_pct: null, total: 0 } } });
      return route.fulfill({ json: { count: 0, next: null, results: [] } });
    });

    await gotoAndSettle(page, `${BASE}/workspace/mobile/students`);
    const main = page.getByRole("main");
    if (scenario === "initial-error") {
      await expect(main.getByText("학생 목록을 불러오지 못했습니다", { exact: true })).toBeVisible();
      await expect(main.getByText("학생이 없습니다", { exact: true })).toHaveCount(0);
      failing = false;
      await main.getByRole("button", { name: "다시 시도", exact: true }).click();
    }
    if (scenario === "empty") {
      await expect(main.getByText("학생이 없습니다", { exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: "학생 더 보기", exact: true })).toHaveCount(0);
      return;
    }
    await expect(main.getByText("검증 학생 01", { exact: true })).toBeVisible();
    await expect(main.getByText("끝학생", { exact: true })).toHaveCount(0);
    if (scenario === "complete") {
      await main.getByRole("button", { name: "선택", exact: true }).click();
      await main.getByText("검증 학생 01", { exact: true }).click();
      await expect(main.getByText("1명 선택됨", { exact: true })).toBeVisible();
    }
    await main.getByRole("button", { name: "학생 더 보기", exact: true }).click();
    if (scenario === "next-error" || scenario === "incomplete") {
      await expect(main.getByText("학생 목록을 불러오지 못했습니다", { exact: true })).toBeVisible();
      await expect(main.getByText("검증 학생 01", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`student-list-error-${scenario}.png`), animations: "disabled" });
      failing = false;
      await main.getByRole("button", { name: "다시 시도", exact: true }).click();
    }
    await expect(main.getByText("끝학생", { exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "학생 더 보기", exact: true })).toHaveCount(0);
    expect(requests.some((entry) => entry.page === 2)).toBe(true);
    if (scenario === "complete") {
      await expect(main.getByText("1명 선택됨", { exact: true })).toBeVisible();
      await main.getByRole("button", { name: "선택 취소", exact: true }).click();
    }
    await main.getByText("끝학생", { exact: true }).scrollIntoViewIfNeeded();
    await waitForRenderSettled(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`student-list-${width}.png`), animations: "disabled" });
    if (scenario !== "complete") return;

    await main.getByText("끝학생", { exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/mobile\/students\/51$/);
    await expect(main.getByText("끝학생", { exact: true })).toBeVisible();
    await page.reload();
    await expect(main.getByText("끝학생", { exact: true })).toBeVisible();
    await page.goBack();
    await expect(main.getByText("학생 관리", { exact: true })).toBeVisible();
    if (await main.getByRole("button", { name: "학생 더 보기", exact: true }).count()) {
      await main.getByRole("button", { name: "학생 더 보기", exact: true }).click();
    }
    await main.getByRole("button", { name: "선택", exact: true }).click();
    await main.getByText("끝학생", { exact: true }).click();
    await expect(main.getByText("1명 선택됨", { exact: true })).toBeVisible();
    await main.getByRole("button", { name: "불러온 51명 전체 선택", exact: true }).click();
    await expect(main.getByText("51명 선택됨", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`student-selection-${width}.png`), animations: "disabled" });
    await main.getByRole("button", { name: "선택 취소", exact: true }).click();
    const searchInput = main.getByPlaceholder("이름, 아이디, 전화번호, 학교");
    const clockStart = Date.now();
    await page.clock.install({ time: clockStart });
    await page.clock.pauseAt(clockStart + 1_000);
    const requestCount = requests.length;
    await searchInput.dispatchEvent("compositionstart");
    for (const value of ["끝", "끝학", "끝학생"]) {
      await searchInput.fill(value);
      await page.clock.runFor(100);
    }
    expect(requests).toHaveLength(requestCount);
    await page.clock.runFor(300);
    await expect(main.getByText("검증 학생 01", { exact: true })).toHaveCount(0);
    await expect(main.getByText("끝학생", { exact: true })).toBeVisible();
    expect(requests.at(-1)).toEqual({ search: "끝학생", page: 1 });
    expect(requests).toHaveLength(requestCount + 1);
    await expect(searchInput).toBeFocused();
    await searchInput.dispatchEvent("compositionend");
    await main.getByRole("button", { name: "선택", exact: true }).click();
    await expect(main.getByText("0명 선택됨", { exact: true })).toBeVisible();
  });
}
