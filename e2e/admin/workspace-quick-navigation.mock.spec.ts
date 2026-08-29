import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seed(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "빠른 이동 route-mock 검증은 로컬 서버 전용",
  );
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

async function installApi(page: Page) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/token/refresh/") {
      const access = localJwt();
      return json({ access, refresh: `${access}-refresh` });
    }
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: false,
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
        phone: null,
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/staffs/me/") return json({ id: 12, is_payroll_manager: true });
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/lectures/attendance/arrival-overview/") {
      return json({
        today: "2026-08-12",
        range_end: "2026-08-18",
        range_days: 7,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
        items: [],
      });
    }
    if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
    return json({ count: 0, results: [] });
  });
}

test.describe("업무 화면 빠른 이동", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await installApi(page);
    await installLocalAuthApiStubs(page);
  });

  test("데스크톱에서 검색·키보드 이동·최근 사용을 복원한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "빠른 이동" })).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: "빠른 이동" });
    await expect(dialog).toBeVisible();

    const search = dialog.getByRole("textbox", { name: "메뉴 검색" });
    await expect(search).toBeFocused();
    await search.fill("매뉴얼");
    await expect(dialog.getByRole("button", { name: /가이드 메인/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/\/workspace\/guide(?:\/|$)/);

    await expect(page.getByRole("button", { name: "빠른 이동" })).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(dialog.getByRole("heading", { name: "최근 사용" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /가이드 메인/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.reload();
    await expect(page.getByRole("button", { name: "빠른 이동" })).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(dialog.getByRole("heading", { name: "최근 사용" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /가이드 메인/ }).first()).toBeVisible();
  });

  test("390px에서 중복 홈 대신 빠른 이동을 제공하고 가로 넘침이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("tc-topbar-go-dashboard")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "빠른 이동" })).toBeVisible();
    await page.getByRole("button", { name: "빠른 이동" }).focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "빠른 이동" });
    const search = dialog.getByRole("textbox", { name: "메뉴 검색" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "빠른 이동 닫기" })).toBeVisible();
    await search.fill("시험 묶음");
    await expect(dialog.getByRole("button", { name: /시험 묶음 자료·메시지/ })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      dialog: document.querySelector("[data-testid='quick-navigation-dialog']")?.scrollWidth ?? 0,
    }));
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
    expect(overflow.dialog).toBeLessThanOrEqual(overflow.viewport);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
