import { expect, test, type Page } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5196";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

async function installScenario(page: Page) {
  await installTenantOneInitScript(page);
  const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, `e30.${payload}.signature`);
  const state = { lectureFailure: false, sessionFailure: false, listRequests: 0 };
  const lecture = { id: 71, title: "고등 수학 심화 문제풀이와 개념 복습", name: "김선생", subject: "수학", is_active: true };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
    if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "김선생", username: "qa-teacher", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
    if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
    if (path === "/lectures/lectures/") {
      state.listRequests += 1;
      return route.fulfill({ json: { count: 2, next: null, results: [lecture, { ...lecture, id: 72, title: "영어 독해", subject: "영어", name: "이선생" }] } });
    }
    if (path === "/lectures/lectures/71/") return route.fulfill(state.lectureFailure
      ? { status: 400, json: { detail: "강의 조회 실패" } } : { json: lecture });
    if (path === "/lectures/sessions/") return route.fulfill(state.sessionFailure
      ? { status: 400, json: { detail: "차시 조회 실패" } }
      : { json: { count: 1, results: [{ id: 81, lecture: 71, order: 1, regular_order: 1, title: "1차시", session_type: "REGULAR", date: "2026-10-27" }] } });
    if (path === "/enrollments/") return route.fulfill({ json: { count: 1, next: null, results: [{ id: 31, lecture: 71, status: "ACTIVE", student: { id: 41, name: "검증 학생" } }] } });
    return route.fulfill({ json: { count: 0, next: null, results: [] } });
  });
  return state;
}

for (const width of [390, 1366]) {
  test(`강의 검색과 지난 강의 선택은 상세 복귀·새로고침에도 유지된다 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installScenario(page);
    await page.goto(`${BASE}/workspace/mobile/classes`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page.getByRole("button", { name: /고등 수학/ })).toBeVisible({ timeout: 30_000 });
    const requests = state.listRequests;
    await page.getByRole("searchbox", { name: "강의 찾기" }).fill("김선생");
    await expect(page.getByText("1개 검색됨 · 전체 2개", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /영어 독해/ })).toHaveCount(0);
    expect(state.listRequests).toBe(requests);
    await page.getByRole("button", { name: "지난강의", exact: true }).click();
    await expect(page).toHaveURL(/tab=past/);
    await page.getByRole("button", { name: /고등 수학/ }).click();
    await expect(page).toHaveURL(/\/classes\/71$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "차시 (1)", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "강의 찾기" })).toHaveValue("김선생");
    await page.reload();
    await expect(page).toHaveURL(/tab=past/);
    await expect(page.getByRole("searchbox", { name: "강의 찾기" })).toHaveValue("김선생");
    await page.getByRole("searchbox", { name: "강의 찾기" }).fill("없는 강의");
    await expect(page.getByText("검색 결과가 없습니다", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "검색 지우기", exact: true }).first().click();
    await expect(page.getByRole("button", { name: /영어 독해/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`lecture-list-${width}.png`), animations: "disabled" });
  });

  test(`강의·차시 조회 실패는 빈 목록으로 표시하지 않고 복구하며 수강생 탭을 유지한다 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await installScenario(page);
    state.lectureFailure = true;
    state.sessionFailure = true;
    await page.goto(`${BASE}/workspace/mobile/classes/71`);
    await expect(page.getByText("강의를 불러오지 못했습니다", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "차시 추가", exact: true })).toHaveCount(0);
    state.lectureFailure = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByText("차시를 불러오지 못했습니다", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "차시 (확인 필요)", exact: true })).toBeVisible();
    await expect(page.getByText("차시가 없습니다", { exact: true })).toHaveCount(0);
    state.sessionFailure = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByRole("button", { name: "차시 (1)", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "차시 수정: 1차시", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "수강생 (1)", exact: true }).click();
    await expect(page.getByText("검증 학생", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "수강생 (1)", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("검증 학생", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`lecture-detail-${width}.png`), animations: "disabled" });
  });
}
