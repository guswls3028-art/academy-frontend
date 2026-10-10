import { expect, test, type Page } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5195";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

async function setup(page: Page) {
  await installTenantOneInitScript(page);
  const jwt = `e30.${Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url")}.signature`;
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt);
  const items = Array.from({ length: 205 }, (_, index) => ({
    id: 1205 - index, name: `QA 문의 ${String(205 - index).padStart(3, "0")}`, phone: "010-0000-0000",
    interest: "QA 과학 수강 상담", message: "QA 상담 내용", source: "landing-contact",
    read_at: index < 200 ? "2026-10-01T09:00:00+09:00" : null,
    admin_memo: "원래 메모", created_at: "2026-10-01T09:00:00+09:00",
  }));
  const state = { items, failPage: 0, failPatch: false, reads: [] as string[], patches: 0 };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "QA 학원", is_active: true, feature_flags: {} });
    if (path === "/core/me/") return json({ id: 12, name: "QA 원장", username: "qa-owner", tenantRole: "owner", is_staff: true, must_change_password: false, first_login_guide_required: false });
    if (path === "/core/subscription/") return json({ plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 });
    if (path === "/results/admin/dashboard-counts/") return json({ video_failed: 0, qna_pending: 0, counsel_pending: 0, submission_pending: 0 });
    if (path === "/core/landing/admin/consult/") {
      const summary = { total: items.length, unread: items.filter((item) => !item.read_at).length };
      if (url.searchParams.get("summary_only") === "true") return json({ items: [], summary });
      state.reads.push(url.search);
      const requestedPage = Number(url.searchParams.get("page") || 1);
      if (state.failPage === requestedPage) return json({ detail: "QA 목록 조회 실패" }, 400);
      const selected = url.searchParams.get("filter") === "unread" ? items.filter((item) => !item.read_at) : items;
      const size = Number(url.searchParams.get("page_size") || 200);
      const pages = Math.max(1, Math.ceil(selected.length / size));
      const current = Math.min(requestedPage, pages);
      return json({ summary, items: selected.slice((current - 1) * size, current * size),
        pagination: { page: current, page_size: size, pages, count: selected.length, has_next: current < pages, has_previous: current > 1 } });
    }
    const detail = path.match(/^\/core\/landing\/admin\/consult\/(\d+)\/$/);
    if (detail && method === "PATCH") {
      state.patches += 1;
      if (state.failPatch) return json({ detail: "QA 저장 실패" }, 400);
      const row = items.find((item) => item.id === Number(detail[1]))!;
      const body = route.request().postDataJSON() as { mark_read?: boolean; admin_memo?: string; expected_admin_memo?: string };
      if (body.expected_admin_memo !== undefined && body.expected_admin_memo !== row.admin_memo) {
        return json({ detail: "다른 담당자가 메모를 변경했습니다.", code: "memo_conflict", admin_memo: row.admin_memo }, 409);
      }
      if (body.mark_read) row.read_at = "2026-10-09T10:00:00+09:00";
      if (body.admin_memo !== undefined) row.admin_memo = body.admin_memo;
      return json({ ok: true });
    }
    return json({ count: 0, results: [] });
  });
  return state;
}

for (const width of [390, 1366]) {
  test(`같은 상담 메모 충돌은 초안과 최신값을 보여주고 재작성한다 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await gotoAndSettle(page, `${BASE}/workspace/settings/consult?page=5`);
    const row = page.getByRole("article", { name: "상담 요청 QA 문의 001", exact: true });
    await row.getByRole("button", { name: "수정", exact: true }).click();
    await row.getByPlaceholder("처리 메모", { exact: true }).fill("내 초안");
    state.items.find((item) => item.id === 1001)!.admin_memo = "다른 담당자 연락 완료";
    await row.getByRole("button", { name: "저장", exact: true }).click();
    await expect(row.getByRole("region", { name: "다른 담당자의 최신 메모" })).toContainText("다른 담당자 연락 완료");
    await expect(row.getByPlaceholder("처리 메모", { exact: true })).toHaveValue("내 초안");
    expect(state.items.find((item) => item.id === 1001)!.admin_memo).toBe("다른 담당자 연락 완료");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`consult-conflict-${width}.png`), animations: "disabled" });
    await row.getByRole("button", { name: "최신 메모로 다시 작성", exact: true }).click();
    await expect(row.getByPlaceholder("처리 메모", { exact: true })).toHaveValue("다른 담당자 연락 완료");
    await row.getByPlaceholder("처리 메모", { exact: true }).fill("다른 담당자 연락 완료\n내 후속 일정");
    await row.getByRole("button", { name: "저장", exact: true }).click();
    await expect(row.getByText("다른 담당자 연락 완료\n내 후속 일정", { exact: true })).toBeVisible();
    await page.reload();
    await expect(row.getByText("다른 담당자 연락 완료\n내 후속 일정", { exact: true })).toBeVisible();
  });

  test(`상담 수신함은 200건 이후 메모·읽음·미확인 필터와 reload를 유지한다 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await gotoAndSettle(page, `${BASE}/workspace/settings/consult?page=5`);
    await expect(page.getByText("QA 문의 001", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "전체 205", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "미확인 5", exact: true })).toBeVisible();
    const pager = page.getByRole("navigation", { name: "상담 목록 페이지 상단", exact: true });
    for (const button of await pager.getByRole("button").all()) {
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: test.info().outputPath(`consult-pages-${width}.png`), animations: "disabled" });
    const row = page.getByRole("article", { name: "상담 요청 QA 문의 001", exact: true });
    await row.getByRole("button", { name: "수정", exact: true }).click();
    const memo = "연락 완료 — 긴 상담 메모와 다음 연락 일정도 보존합니다. ".repeat(5);
    await row.getByPlaceholder("처리 메모", { exact: true }).fill(memo);
    await expect(page.getByRole("button", { name: "이전 페이지", exact: true }).first()).toBeDisabled();
    await row.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`consult-editor-${width}.png`), animations: "disabled" });
    state.failPatch = true;
    await row.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("QA 저장 실패");
    await expect(row.getByPlaceholder("처리 메모", { exact: true })).toHaveValue(memo);
    state.failPatch = false;
    await row.getByRole("button", { name: "저장", exact: true }).click();
    await expect(row.getByText(memo.trim(), { exact: true })).toBeVisible();
    await page.reload();
    await expect(row.getByText(memo.trim(), { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "읽음으로 표시", exact: true }).click();
    await expect(page.getByRole("button", { name: "미확인 4", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "읽음으로 표시", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "미확인 4", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(4);
    await expect(page.getByText("QA 문의 001", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("article")).toHaveCount(4);
    expect(new URL(page.url()).searchParams.get("filter")).toBe("unread");
    expect(state.items.find((item) => item.id === 1001)?.admin_memo).toBe(memo);
    expect(state.reads.some((query) => query.includes("page=5") && query.includes("page_size=50"))).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`consult-inbox-${width}.png`), animations: "disabled" });
  });

  test(`상담 페이지 조회 실패는 이전 항목을 숨기고 같은 페이지에서 복구한다 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    await gotoAndSettle(page, `${BASE}/workspace/settings/consult`);
    await expect(page.getByText("QA 문의 205", { exact: true })).toBeVisible();
    state.failPage = 2;
    await page.getByRole("button", { name: "다음 페이지", exact: true }).first().click();
    await expect(page.getByRole("alert")).toContainText("QA 목록 조회 실패");
    await expect(page.getByText("QA 문의 205", { exact: true })).toHaveCount(0);
    state.failPage = 0;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByText("QA 문의 155", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("QA 문의 155", { exact: true })).toBeVisible();
    expect(state.patches).toBe(0);
  });
}
