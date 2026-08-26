import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installMessagingApp(page: Page, initialEnabled: boolean) {
  let tenantEnabled = initialEnabled;
  const activationBodies: Array<Record<string, unknown>> = [];
  const template = {
    id: 684,
    category: "default",
    name: "홈페이지 변경 안내",
    subject: "",
    body: "홈페이지 주소가 변경되었습니다. 새 주소에서 영상을 수강해 주세요.",
    is_system: false,
    is_user_default: false,
    solapi_template_id: "",
    solapi_status: "",
    alimtalk_readiness: "envelope_selection_required",
    created_at: "2026-08-22T07:00:00Z",
    updated_at: "2026-08-22T07:00:00Z",
  };
  const configs = [
    {
      id: 1,
      trigger: "registration_approved_student",
      template: 684,
      template_name: template.name,
      template_subject: "",
      template_body: template.body,
      template_solapi_status: "APPROVED",
      effective_template_solapi_status: "APPROVED",
      effective_template_source: "owner_exact",
      effective_template_is_approved: true,
      effective_template_type: "registration_approved_student",
      enabled: true,
      message_mode: "alimtalk",
      minutes_before: null,
      delay_mode: "immediate",
      delay_value: null,
      show_actual_time: false,
      policy_mode: "SYSTEM_AUTO",
      implementation_status: "implemented",
      created_at: "2026-08-22T07:00:00Z",
      updated_at: "2026-08-22T07:00:00Z",
    },
  ];

  const access = localJwt();
  await page.addInitScript(({ accessToken }) => {
    localStorage.setItem("tenant_code", "hakwonplus");
    localStorage.setItem("access", accessToken);
    localStorage.setItem("refresh", `${accessToken}-refresh`);
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { accessToken: access });
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (pathname === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스" },
        feature_flags: {},
        is_active: true,
      });
    }
    if (pathname === "/token/" && request.method() === "POST") {
      return json({ access: localJwt(), refresh: `${localJwt()}-refresh` });
    }
    if (pathname === "/token/refresh/") {
      return json({ access: localJwt(), refresh: `${localJwt()}-refresh` });
    }
    if (pathname === "/core/me/") {
      return json({
        id: 12,
        username: "owner",
        name: "학원장",
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
        first_login_guide_required: false,
      });
    }
    if (pathname === "/messaging/info/" && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      activationBodies.push(body);
      tenantEnabled = Boolean(body.tenant_messaging_enabled);
    }
    if (pathname === "/messaging/info/") {
      return json({
        messaging_provider: "solapi",
        channel_source: "common_owner",
        resolved_pf_id: "PF-COMMON",
        delivery_policy: "common_alimtalk_only",
        alimtalk_available: tenantEnabled,
        tenant_messaging_enabled: tenantEnabled,
        messaging_ops_hold: false,
        can_manage_messaging: true,
        messaging_disabled: !tenantEnabled,
        messaging_disabled_reason: tenantEnabled
          ? ""
          : "이 학원의 알림톡 전체 사용이 꺼져 있습니다. 대표 또는 관리자가 다시 켤 수 있습니다.",
      });
    }
    if (pathname === "/messaging/auto-send/" && request.method() === "PATCH") {
      return json(configs);
    }
    if (pathname === "/messaging/auto-send/") return json(configs);
    if (pathname === "/messaging/templates/") return json([template]);
    if (pathname === "/students/") {
      return json({
        count: 1,
        page_size: 50,
        results: [{
          id: 910001,
          name: "모바일 확인 학생",
          phone: "01011112222",
          parent_phone: "01033334444",
          ps_number: "E2E-910001",
          omr_code: "910001",
          is_managed: true,
          school_type: "HIGH",
          high_school: "테스트고",
          high_school_class: "1",
          grade: 1,
          tags: [],
          enrollments: [],
          created_at: "2026-08-22T07:00:00Z",
        }],
      });
    }
    if (pathname === "/messaging/send/preflight/") {
      const body = request.postDataJSON() as { send_to?: "student" | "parent" };
      return json({
        ok: true,
        can_send: true,
        mode: "now",
        send_to: body.send_to || "parent",
        recipient: {
          selected: 1,
          resolved: 1,
          valid_phone: 1,
          skipped_no_phone: 0,
          duplicate_phone: 0,
          unique_phone: 1,
          invalid_or_deleted: 0,
          limit: 500,
        },
        template: {
          ok: true,
          source: "unified",
          name: "출석 안내 기본형",
          solapi_template_id: "E2E_TEMPLATE",
          solapi_status: "APPROVED",
          detail: "",
          uses_unified_template: true,
          template_type: "attendance",
        },
        preview_recipients: [],
        limits: {
          hourly_limit: 500,
          sent_last_hour: 0,
          remaining_this_hour: 500,
        },
        blockers: [],
        warnings: [],
      });
    }
    if (pathname === "/messaging/operations/status/") {
      return json({ risks: [] });
    }
    if (pathname === "/landing/has-published/") return json({ has_published: false });
    return json({ count: 0, next: null, previous: null, results: [] });
  });
  return activationBodies;
}

async function openMessaging(page: Page) {
  await page.goto(`${BASE}/workspace/message/auto-send`, {
    waitUntil: "commit",
    timeout: 60_000,
  });
}

test.use({ serviceWorkers: "block" });

test.describe("알림톡 전체 사용 운영 제어", () => {
  test("대표가 전체 상태를 직접 끄고 다시 켤 수 있는 구조를 확인한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const bodies = await installMessagingApp(page, true);
    await openMessaging(page);

    const switchControl = page.getByRole("switch", { name: "알림톡 전체 사용" });
    await expect(page.getByText("알림톡 전체 사용", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(switchControl).toBeChecked({ timeout: 60_000 });
    await switchControl.click();
    await expect(switchControl).not.toBeChecked();
    await expect(page.getByText(/현재 모든 알림톡이 멈춰 있습니다/)).toBeVisible();
    expect(bodies).toEqual([{ tenant_messaging_enabled: false }]);
    await page.screenshot({ path: "test-results/messaging-activation-desktop.png", fullPage: false });
  });

  test("390px에서도 중지 상태와 복구 토글이 잘리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMessagingApp(page, false);
    await openMessaging(page);

    const switchControl = page.getByRole("switch", { name: "알림톡 전체 사용" });
    await expect(switchControl).not.toBeChecked({ timeout: 60_000 });
    await expect(switchControl).toBeEnabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/messaging-activation-mobile-390.png", fullPage: false });
  });

  test("390px 알림톡 미리보기 모달은 첫 화면 안에서 바로 열린다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMessagingApp(page, true);
    await openMessaging(page);

    const previewButton = page.getByRole("button", { name: "미리보기" }).first();
    await expect(previewButton).toBeVisible({ timeout: 60_000 });
    await previewButton.click();

    const dialog = page.getByRole("dialog").last();
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeLessThanOrEqual(1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("390px 학생 알림톡 발송 모달은 포털에서도 첫 화면 안에서 바로 열린다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMessagingApp(page, true);
    await page.goto(`${BASE}/workspace/students/home`, {
      waitUntil: "commit",
      timeout: 60_000,
    });

    const studentCheckbox = page.getByRole("checkbox", { name: "모바일 확인 학생 선택" });
    await expect(studentCheckbox).toBeVisible({ timeout: 60_000 });
    await studentCheckbox.check();
    await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();

    const dialog = page.locator(".send-message-modal");
    await expect(dialog).toBeVisible();
    await expect(page.locator(".admin-modal-wrap")).toHaveCount(1);
    await expect.poll(async () => (await dialog.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
      .toBeLessThanOrEqual(1);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeLessThanOrEqual(1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1);
  });
});
