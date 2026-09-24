import type { Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

test.use({ serviceWorkers: "block", strictBrowserAutoAssert: false });

test("auto-send keeps a failed draft across navigation and serializes newer edits", async ({ page }) => {
  test.setTimeout(90_000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript(({ access }) => {
    localStorage.setItem("tenant_code", "hakwonplus");
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { access: token });

  const config = {
    id: 1, trigger: "withdrawal_complete", template: 42, template_name: "퇴원 안내",
    template_body: "퇴원 안내", template_solapi_status: "APPROVED",
    effective_template_solapi_status: "APPROVED", effective_template_source: "owner_exact",
    effective_template_is_approved: true, enabled: true, message_mode: "alimtalk",
    minutes_before: null, delay_mode: "delay_minutes", delay_value: 30,
    show_actual_time: false, policy_mode: "AUTO_DEFAULT", implementation_status: "implemented",
  };
  let fail = true;
  let holdSecond = false;
  let releaseSecond: (() => void) | undefined;
  const writes: number[] = [];
  let active = 0;
  let maxActive = 0;
  let providerCalls = 0;
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "owner", name: "학원장", is_staff: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false });
    if (path === "/messaging/info/") return json({ alimtalk_available: true, tenant_messaging_enabled: true, messaging_ops_hold: false, can_manage_messaging: true, messaging_disabled: false });
    if (path === "/messaging/auto-send/" && request.method() === "PATCH") {
      const body = request.postDataJSON() as { configs: Array<{ delay_value: number }> };
      writes.push(body.configs[0].delay_value);
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (holdSecond && writes.length === 2) await new Promise<void>((resolve) => { releaseSecond = resolve; });
      active -= 1;
      if (fail) { fail = false; return json({ detail: "잠시 후 다시 시도해 주세요." }, 503); }
      config.delay_value = body.configs[0].delay_value;
      return json([config]);
    }
    if (path === "/messaging/auto-send/") return json([config]);
    if (path === "/messaging/templates/") return json([]);
    if (path.includes("/send/") || path.includes("/provider/")) providerCalls += 1;
    return json({ count: 0, results: [] });
  });

  await page.goto(`${BASE}/workspace/message/auto-send`, { waitUntil: "commit", timeout: 60_000 });
  const timing = page.locator('input[type="number"]').first();
  await expect(timing).toHaveValue("30", { timeout: 30_000 });
  await timing.fill("45");
  await page.getByText("문구 편집", { exact: true }).first().click();
  await expect.poll(() => writes.length).toBe(1);
  await page.getByText("자동발송", { exact: true }).first().click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("alert")).toContainText("잠시 후 다시 시도해 주세요.");
  await expect(page.locator('input[type="number"]').first()).toHaveValue("45");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

  holdSecond = true;
  await page.getByRole("button", { name: "다시 저장" }).click();
  await expect.poll(() => writes.length).toBe(2);
  await page.locator('input[type="number"]').first().fill("55");
  releaseSecond?.();
  await expect.poll(() => writes.length).toBe(3);
  await expect.poll(() => config.delay_value).toBe(55);
  expect(writes).toEqual([45, 45, 55]);
  expect(maxActive).toBe(1);
  expect(providerCalls).toBe(0);
  await page.reload({ waitUntil: "commit", timeout: 60_000 });
  await expect(page.locator('input[type="number"]').first()).toHaveValue("55");
});
