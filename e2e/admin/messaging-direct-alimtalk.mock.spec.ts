import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5214").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type MessagingState = {
  available: boolean;
  failInfo: boolean;
  requests: Array<{ method: string; path: string }>;
};

async function installMocks(
  page: Page,
  options: { available?: boolean; failInfo?: boolean } = {},
): Promise<MessagingState> {
  const state: MessagingState = {
    available: options.available ?? true,
    failInfo: options.failInfo ?? false,
    requests: [],
  };

  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, localJwt());

  const json = (route: Route, body: unknown, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    state.requests.push({ method: request.method(), path });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (path === "/core/program/") {
      return json(route, {
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json(route, {
        id: 12,
        username: "owner",
        name: "관리자",
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
      });
    }
    if (path === "/messaging/info/") {
      if (state.failInfo) return json(route, { detail: "temporary failure" }, 503);
      return json(route, {
        alimtalk_available: state.available,
        delivery_policy: "common_alimtalk_only",
        messaging_provider: "solapi",
        messaging_disabled: !state.available,
        messaging_disabled_reason: state.available ? "" : "운영 중지 상태입니다.",
      });
    }
    if (path === "/messaging/send/preflight/" && request.method() === "POST") {
      const body = request.postDataJSON() as { send_to?: "student" | "parent" };
      const sendTo = body.send_to ?? "parent";
      return json(route, {
        ok: true,
        can_send: true,
        mode: "now",
        send_to: sendTo,
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
        preview_recipients: [{
          student_id: 41,
          student_name: "김알림",
          phone: sendTo === "student" ? "010****2222" : "010****4444",
          excluded: false,
          exclude_reason: "",
          full_message_body: "학원플러스입니다. 김알림 학생의 안내 사항입니다.",
        }],
        limits: {
          hourly_limit: 500,
          sent_last_hour: 0,
          remaining_this_hour: 500,
        },
        blockers: [],
        warnings: [],
      });
    }
    if (path === "/students/" && request.method() === "GET") {
      return json(route, {
        count: 1,
        page_size: 50,
        results: [{
          id: 41,
          name: "김알림",
          display_name: "김알림",
          ps_number: "0041",
          omr_code: "0041",
          student_phone: "01011112222",
          parent_phone: "01033334444",
          school: "통합고",
          grade: 2,
          is_active: true,
          custom_fields: {},
          tags: [],
          enrollments: [],
        }],
      });
    }
    if (path === "/students/custom-fields/") return json(route, []);
    if (path === "/messaging/templates/") return json(route, []);
    if (path === "/landing/has-published/") return json(route, { has_published: false });

    return json(route, { count: 0, next: null, previous: null, results: [] });
  });

  return state;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= window.innerWidth,
    root: document.documentElement.scrollWidth <= window.innerWidth,
  }))).toEqual({ body: true, root: true });
}

test.use({ serviceWorkers: "block" });

test("메시지 화면에서 학생 선택과 알림톡 발송창까지 정확한 경로로 이어진다", async ({ page }) => {
  const state = await installMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await gotoAndSettle(page, `${BASE}/workspace/message/templates`, { timeout: 30_000 });
  await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();

  await expect(page).toHaveURL(/\/workspace\/students\/home\?compose=alimtalk$/);
  await expect(page.getByRole("region", { name: "알림톡 발송 안내" })).toContainText(
    "알림톡을 보낼 학생을 선택하세요.",
  );
  await page.getByRole("checkbox", { name: "김알림 선택" }).check();
  await page.getByRole("button", { name: "알림톡 보내기", exact: true }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "알림톡 발송" })).toBeVisible();
  await expect.poll(() => state.requests.filter(
    ({ method, path }) => method === "POST" && path === "/messaging/send/preflight/",
  ).length).toBeGreaterThan(0);
  await expectNoHorizontalOverflow(page);
  expect(state.requests.filter(
    ({ method, path }) => method !== "GET" && path !== "/messaging/send/preflight/",
  )).toEqual([]);
});

test("알림톡 운영 중지 상태는 발송 진입을 비활성화하고 설정 안내만 제공한다", async ({ page }) => {
  const state = await installMocks(page, { available: false });
  await gotoAndSettle(page, `${BASE}/workspace/message/templates`, { timeout: 30_000 });

  const action = page.getByRole("button", { name: "알림톡 보내기", exact: true });
  await expect(action).toBeDisabled();
  await expect(action).toHaveAttribute("title", "운영 중지 상태입니다.");
  await expect(page.getByText("운영 중지 상태입니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "설정 보기" })).toHaveAttribute(
    "href",
    "/workspace/message/settings",
  );
  expect(state.requests.filter(({ method }) => method !== "GET")).toEqual([]);
});

test("알림톡 상태 조회 오류는 fail-closed로 막고 명시적 재확인 뒤에만 연다", async ({ page }) => {
  const state = await installMocks(page, { failInfo: true });
  await gotoAndSettle(page, `${BASE}/workspace/message/templates`, { timeout: 30_000 });

  const action = page.getByRole("button", { name: "알림톡 보내기", exact: true });
  await expect(action).toBeDisabled();
  const alert = page.getByRole("alert").filter({ hasText: "알림톡 상태를 불러오지 못했습니다." });
  await expect(alert).toBeVisible();

  state.failInfo = false;
  await alert.getByRole("button", { name: "다시 확인" }).click();
  await expect(action).toBeEnabled();
  await action.click();
  await expect(page).toHaveURL(/\/workspace\/students\/home\?compose=alimtalk$/);
  expect(state.requests.filter(({ method }) => method !== "GET")).toEqual([]);
});
