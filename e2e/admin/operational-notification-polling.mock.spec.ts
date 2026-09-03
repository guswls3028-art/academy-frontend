import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { waitForCondition } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page) {
  let registrationRequests = 0;
  let videoFailedRequests = 0;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/students/registration_requests/") {
      registrationRequests += 1;
      return json({
        code: "self_registration_disabled",
        detail: "이 학원은 운영정책상 학생 회원가입을 사용하지 않습니다.",
      }, 403);
    }
    if (path === "/results/admin/teacher-dashboard-counts/") {
      videoFailedRequests += 1;
      return json({ video_failed: 0 });
    }
    if (path === "/lectures/attendance/arrival-overview/") {
      return json({
        today: "2026-09-03",
        tomorrow: "2026-09-04",
        range_end: "2026-09-10",
        range_days: 7,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
        items: [],
      });
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
    return json({ count: 0, results: [] });
  });

  return {
    registrationRequests: () => registrationRequests,
    videoFailedRequests: () => videoFailedRequests,
  };
}

test.use({ serviceWorkers: "block" });
test.skip(
  !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
  "운영 알림 폴링 route-mock 검증은 로컬 dev 서버 전용",
);

test("자가가입 비활성 응답은 한 번만 확인하고 나머지 운영 알림만 계속 갱신한다", async ({ page }) => {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);

    const originalSetInterval = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => (
      originalSetInterval(handler, timeout && timeout >= 20_000 ? 120 : timeout, ...args)
    )) as typeof window.setInterval;
  }, localJwt());
  const api = await installApi(page);

  await page.goto(`${BASE}/workspace/tools/stopwatch`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await expect(page.getByRole("region", { name: "안전한 PC 타이머" })).toBeVisible({ timeout: 30_000 });
  await expect.poll(api.registrationRequests, { timeout: 5_000 }).toBe(1);
  await waitForCondition(
    async () => api.videoFailedRequests() > 1,
    {
      timeoutMs: 5_000,
      intervalMs: 50,
      description: "다른 운영 알림 소스의 두 번째 폴링",
    },
  );

  expect(api.registrationRequests()).toBe(1);
});
