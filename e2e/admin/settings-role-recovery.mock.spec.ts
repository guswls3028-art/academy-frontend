import { expect, test } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
test.use({ serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local route mocks only");

async function setup(page: Page, role: string, superuser: boolean, failure?: "tenant" | "legal") {
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((token) => { localStorage.setItem("access", token); localStorage.setItem("refresh", `${token}-refresh`); }, jwt);
  const state = { failedRead: failure, failSave: false, patches: 0, consultReads: 0, bankReads: 0, tenantReads: 0 };
  let tenant = { name: "QA 학원", phone: "", headquarters_phone: "02-0000-0000", academies: [{ name: "기존 본원", phone: "02-0000-0000" }, { name: "기존 분원", phone: "02-0000-0001" }], og_title: "기존 소개", og_description: "기존 설명", og_image_url: "", pass_label: "", fail_label: "" };
  let legal = { company_name: "기존 사업자", representative: "기존 대표", business_number: "", ecommerce_number: "", address: "", support_email: "", support_phone: "", privacy_officer_name: "", privacy_officer_contact: "", terms_version: "1", privacy_version: "1", effective_date: "2026-10-09" };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "QA 학원", feature_flags: {}, ui_config: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "qa-settings", name: "QA 담당자", tenantRole: role, is_staff: true, is_superuser: superuser, must_change_password: false });
    if (path === "/core/tenant-info/" || path === "/core/legal-config/") {
      const kind = path.includes("tenant-info") ? "tenant" : "legal";
      if (request.method() === "PATCH") {
        state.patches += 1;
        if (state.failSave) return json({ detail: "잠시 후 다시 저장하세요." }, 503);
        if (kind === "tenant") tenant = { ...tenant, ...request.postDataJSON() };
        else legal = { ...legal, ...request.postDataJSON() };
      } else {
        if (kind === "tenant") state.tenantReads += 1;
        if (state.failedRead === kind) return json({ detail: "조회 실패" }, 503);
      }
      return json(kind === "tenant" ? tenant : legal);
    }
    if (path === "/core/subscription/") return json({ plan: "all", plan_display: "전체 기능", monthly_price: 180000, original_price: 180000, subscription_status: "active", subscription_status_display: "이용 중", is_subscription_active: true, billing_mode: "INVOICE_REQUEST", tenant_name: "QA 학원", tenant_code: "hakwonplus" });
    if (path === "/billing/bank-transfer/") {
      state.bankReads += 1;
      return json({ bank_account: { enabled: false }, billing_mode: "INVOICE_REQUEST", business_profile: null, invoices: [], notices: [] });
    }
    if (path === "/core/landing/admin/consult/") { state.consultReads += 1; return json({ items: [], summary: { total: 3, unread: 3 } }); }
    if (path === "/students/account-password-settings/") return json({ student_mode: "phone", parent_mode: "phone", student_fixed_password: "", parent_fixed_password: "" });
    if (path === "/core/student-grade-report-layout/") return json({ version: 2, sections: [] });
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: 0, qna_pending: 0, counsel_pending: 0, submission_pending: 0 });
    if (path === "/lectures/attendance/arrival-overview/") return json({ generated_at: "2026-10-09T09:00:00+09:00", soon_window_minutes: 60, today: "2026-10-09", tomorrow: "2026-10-10", range_end: "2026-10-15", range_days: 7, summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 }, items: [] });
    if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
    return json({ count: 0, results: [] });
  });
  return { state, tenant: () => tenant, legal: () => legal };
}

for (const width of [1366, 390]) {
  for (const [role, superuser] of [["owner", false], ["admin", true], ["teacher", true], ["staff", true]] as const) {
    test(`설정 현재 학원 역할 ${role} global=${superuser} ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const { state } = await setup(page, role, superuser);
      await page.goto(`${BASE}/workspace/settings/organization`);
      const nav = page.getByRole("navigation", { name: "설정 메뉴" });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("link", { name: "결제 / 구독", exact: true })).toHaveCount(role === "owner" ? 1 : 0);
      await expect(nav.getByRole("link", { name: "홈페이지", exact: true })).toHaveCount(role === "owner" || role === "admin" ? 1 : 0);
      await expect(page.getByRole("button", { name: "학원 추가", exact: true })).toHaveCount(role === "owner" ? 1 : 0);
      if (role === "owner") await expect(page.getByText("기존 본원 · 02-0000-0000", { exact: true })).toBeVisible();
      else await expect(page.getByText("학원 정보는 대표 계정에서만 수정할 수 있습니다.")).toBeVisible();
      if (role === "owner" || role === "admin") await expect.poll(() => state.consultReads).toBeGreaterThan(0);
      else expect(state.consultReads).toBe(0);
      await page.goto(`${BASE}/workspace/settings/billing`);
      await expect(page.getByRole("heading", { name: "결제 / 구독", exact: true })).toBeVisible();
      if (role === "owner") await expect.poll(() => state.bankReads).toBeGreaterThan(0);
      else {
        await expect(page.getByText("결제 방식 변경과 결제 정보 관리는 학원 소유자 계정에서 할 수 있습니다.")).toBeVisible();
        expect(state.bankReads).toBe(0);
      }
      expect(state.patches).toBe(0);
      await page.screenshot({ path: testInfo.outputPath(`settings-role-${role}-${width}.png`), fullPage: true });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
  }

  test(`학원 조회 실패와 저장 실패 복구 ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await setup(page, "owner", false, "tenant");
    await page.goto(`${BASE}/workspace/settings/organization`);
    await expect(page.getByText("학원 정보를 불러오지 못했습니다.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "학원 추가", exact: true })).toHaveCount(0);
    expect(api.state.patches).toBe(0);
    api.state.failedRead = undefined;
    await page.getByRole("button", { name: "학원 정보 다시 불러오기", exact: true }).click();
    await expect(page.getByText("기존 분원 · 02-0000-0001", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "수정", exact: true }).first().click();
    await page.getByRole("textbox", { name: "학원명", exact: true }).fill("수정 본원");
    api.state.failSave = true;
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("저장에 실패했습니다.", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "학원명", exact: true })).toHaveValue("수정 본원");
    api.state.failSave = false;
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("수정 본원 · 02-0000-0000", { exact: true })).toBeVisible();
    expect(api.tenant().academies.map((item) => item.name)).toEqual(["수정 본원", "기존 분원"]);
    await page.reload();
    await expect(page.getByText("수정 본원 · 02-0000-0000", { exact: true })).toBeVisible();
    await expect(page.getByText("기존 분원 · 02-0000-0001", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`settings-recovery-${width}.png`), fullPage: true });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });

  test(`법적 고지 조회 실패 후 기존값 보존 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await setup(page, "owner", false, "legal");
    await page.goto(`${BASE}/workspace/settings/organization`);
    await expect(page.getByText("법적 고지 정보를 불러오지 못했습니다.", { exact: true })).toBeVisible();
    expect(api.state.patches).toBe(0);
    api.state.failedRead = undefined;
    await page.getByRole("button", { name: "법적 고지 다시 불러오기", exact: true }).click();
    await expect(page.getByText("기존 사업자", { exact: true })).toBeVisible();
    await expect(page.getByText("기존 대표", { exact: true })).toBeVisible();
    expect(api.legal().company_name).toBe("기존 사업자");
  });

  test(`다른 설정 저장 중 입력 초안 보존 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await setup(page, "owner", false);
    await page.goto(`${BASE}/workspace/settings/organization`);
    const og = page.getByRole("heading", { name: "카카오톡 미리보기", exact: true }).locator("..").locator("xpath=following-sibling::section[1]");
    await og.getByRole("button", { name: "수정", exact: true }).click();
    await og.getByPlaceholder("비워두면 학원명 사용", { exact: true }).fill("작성 중인 새 소개");
    const labels = page.getByRole("heading", { name: "합/불 라벨", exact: true }).locator("..").locator("xpath=following-sibling::section[1]");
    await labels.getByRole("button", { name: "수정", exact: true }).click();
    await labels.getByPlaceholder("합격", { exact: true }).fill("통과");
    await page.getByRole("button", { name: "수정", exact: true }).first().click();
    await page.getByRole("textbox", { name: "학원명", exact: true }).fill("수정 본원");
    const academySave = page.getByRole("button", { name: "저장", exact: true }).first();
    await academySave.click();
    await expect(page.getByText("수정 본원 · 02-0000-0000", { exact: true })).toBeVisible();
    await expect(og.getByPlaceholder("비워두면 학원명 사용", { exact: true })).toHaveValue("작성 중인 새 소개");
    await og.getByRole("button", { name: "저장", exact: true }).click();
    await expect.poll(() => api.tenant().og_title).toBe("작성 중인 새 소개");
    await expect(labels.getByPlaceholder("합격", { exact: true })).toHaveValue("통과");
    await labels.getByRole("button", { name: "저장", exact: true }).click();
    await expect.poll(() => api.tenant().pass_label).toBe("통과");
    await page.reload();
    await expect(page.getByText("수정 본원 · 02-0000-0000", { exact: true })).toBeVisible();
    await expect(page.getByText("기존 분원 · 02-0000-0001", { exact: true })).toBeVisible();
    await expect(page.getByText("작성 중인 새 소개", { exact: true }).first()).toBeVisible();
  });
}
