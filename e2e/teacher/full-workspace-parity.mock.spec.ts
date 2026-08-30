import fs from "node:fs";
import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
  ).toString("base64url");
  return `e30.${payload}.sig`;
}

type StaffRole = "owner" | "admin" | "teacher";

async function installWorkspaceMocks(
  page: Page,
  { role, payrollManager = false }: { role: StaffRole; payrollManager?: boolean },
) {
  const apiRequests: Array<{ method: string; path: string }> = [];

  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    localStorage.setItem("teacher:preferAdmin", "0");
  }, { access: fakeJwt(), refresh: fakeJwt() });

  const json = (route: Route, body: unknown) => route.fulfill({ json: body });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    apiRequests.push({ method: request.method(), path });

    if (path === "/core/program/") {
      return json(route, {
        tenantCode: "hakwonplus",
        display_name: "패리티 학원",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json(route, {
        id: role === "owner" ? 1 : role === "admin" ? 2 : 3,
        username: role,
        name: role === "owner" ? "원장" : role === "admin" ? "관리자" : "선생님",
        phone: null,
        is_staff: true,
        is_superuser: false,
        tenantRole: role,
        must_change_password: false,
      });
    }
    if (path === "/staffs/me/") {
      return json(route, {
        is_authenticated: true,
        is_superuser: false,
        is_staff: true,
        is_owner: role === "owner",
        is_payroll_manager: payrollManager,
        staff_id: role === "owner" ? 11 : 12,
        assigned_work_types: [],
      });
    }

    return json(route, { count: 0, results: [] });
  });

  return apiRequests;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= window.innerWidth,
    root: document.documentElement.scrollWidth <= window.innerWidth,
  }))).toEqual({ body: true, root: true });
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test("모바일 PC 버전 허브의 모든 정적 목적지는 executable canonical route다", () => {
  const source = fs.readFileSync(
    "src/app_teacher/domains/profile/pages/DesktopOnlyPage.tsx",
    "utf8",
  );
  const routeSources = {
    admin: fs.readFileSync("src/app_admin/app/AdminRouter.tsx", "utf8"),
    materials: fs.readFileSync("src/app_admin/domains/materials/MaterialsRoutes.tsx", "utf8"),
    staff: fs.readFileSync("src/app_admin/domains/staff/StaffRoutes.tsx", "utf8"),
    storage: fs.readFileSync("src/app_admin/domains/storage/StorageRoutes.tsx", "utf8"),
    tools: fs.readFileSync("src/app_admin/domains/tools/ToolsRoutes.tsx", "utf8"),
  };
  const inventory: Array<{
    path: string;
    source: keyof typeof routeSources;
    marker: string;
  }> = [
    { path: "/workspace/storage/matchup", source: "storage", marker: 'path="matchup/*"' },
    { path: "/workspace/storage/files", source: "storage", marker: 'path="files"' },
    { path: "/workspace/storage/hit-reports", source: "storage", marker: 'path="hit-reports"' },
    { path: "/workspace/storage/proposals", source: "storage", marker: 'path="proposals"' },
    { path: "/workspace/materials/sheets", source: "materials", marker: 'path="sheets"' },
    { path: "/workspace/students/requests", source: "admin", marker: 'path="requests"' },
    { path: "/workspace/students/deleted", source: "admin", marker: 'path="deleted"' },
    { path: "/workspace/lectures/past", source: "admin", marker: 'path="past"' },
    { path: "/workspace/fees/templates", source: "admin", marker: "FeesTemplatesTab" },
    { path: "/workspace/results/tree", source: "admin", marker: "ResultsTreePage" },
    { path: "/workspace/videos/tree", source: "admin", marker: "VideoTreePage" },
    { path: "/workspace/community/qna", source: "admin", marker: "QnaInboxPage" },
    { path: "/workspace/landing-public/inbox", source: "admin", marker: "LandingPublicInboxPage" },
    { path: "/workspace/settings/landing", source: "admin", marker: "LandingEditorPage" },
    { path: "/workspace/settings/consult", source: "admin", marker: "LandingConsultInboxPage" },
    { path: "/workspace/developer/flags", source: "admin", marker: "FeatureFlagsPage" },
    { path: "/workspace/staff/attendance", source: "staff", marker: 'path="attendance"' },
    { path: "/workspace/profile/attendance", source: "admin", marker: "ProfileAttendancePage" },
    { path: "/workspace/tools/ppt", source: "tools", marker: 'path="ppt"' },
    { path: "/workspace/tools/omr", source: "tools", marker: 'path="omr"' },
    { path: "/workspace/tools/problem-studio", source: "tools", marker: 'path="problem-studio"' },
    { path: "/workspace/tools/problem-review", source: "tools", marker: 'path="problem-review"' },
  ];

  for (const route of inventory) {
    expect(source).toContain(route.path);
    expect(routeSources[route.source]).toContain(route.marker);
  }
  expect(source).toContain("setPreferFullWorkspace(true)");
  expect(source).toContain("useFeesEnabled()");
  expect(source).toContain("staffMe?.is_payroll_manager");
  expect(source).toContain('feature.access === "owner"');
  expect(source).toContain('feature.access === "tenantAdmin"');
});

test("390px 원장은 검색과 전체 기능 링크를 쓰고 권한 밖 mutation은 만들지 않는다", async ({ page }) => {
  const apiRequests = await installWorkspaceMocks(page, { role: "owner" });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/desktop-only`, { timeout: 20_000 });

  await expect(page.getByRole("heading", { name: "PC 버전", exact: true })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "전체 기능 검색" });
  await expect(search).toBeVisible();
  await expect(page.getByRole("button", { name: /매치업 \(OCR\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /자료실 전체/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /홈페이지 편집/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /기능 플래그/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /수납 템플릿/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "자료·저장소", exact: true }).click();
  await expect(page.getByRole("button", { name: /매치업 \(OCR\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /성적 트리/ })).toHaveCount(0);
  await page.getByRole("button", { name: "전체", exact: true }).click();

  await search.fill("존재하지 않는 기능");
  await expect(page.getByRole("status").filter({ hasText: "검색 결과가 없어요" })).toBeVisible();
  await page.getByRole("button", { name: "검색 초기화" }).click();
  await search.fill("성적 트리");
  const resultTree = page.getByRole("button", { name: /성적 트리/ });
  await expect(resultTree).toBeVisible();
  await resultTree.focus();
  await expect(resultTree).toBeFocused();
  await resultTree.click();
  await expect(page).toHaveURL(/\/workspace\/results\/tree$/);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.getByRole("button", { name: "모바일 버전", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/mobile$/);

  expect(apiRequests.filter(({ method }) => method !== "GET")).toEqual([]);
});

test("390px 선생님은 공용 기능만 보고 관리자·원장·급여 경로는 보지 않는다", async ({ page }) => {
  await installWorkspaceMocks(page, { role: "teacher", payrollManager: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/desktop-only`, { timeout: 20_000 });

  await expect(page.getByRole("button", { name: /성적 트리/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /PPT 만들기/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /홈페이지 편집/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /수납 템플릿/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /기능 플래그/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /직원 급여 운영/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("Mac 데스크톱은 구형 모바일 강제값에 갇히지 않는다", async ({ page }) => {
  await installWorkspaceMocks(page, { role: "teacher" });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("workspace:preferFull:hakwonplus", "1");
    localStorage.setItem("teacher-app-view", "mobile");
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      get: () => "MacIntel",
    });
  });

  await gotoAndSettle(page, `${BASE}/workspace/dashboard`, { timeout: 20_000 });

  await expect(page.getByRole("button", { name: "사이드바 토글" })).toBeVisible();
  await expect(page.getByRole("button", { name: "메뉴 열기" })).toHaveCount(0);
  await expect(page.locator('aside[data-analytics-placement="admin.sidebar"]')).toBeVisible();
});

test("좁은 Mac 창의 선생님도 눈에 띄는 PC 버전 버튼으로 전환한다", async ({ page }) => {
  await installWorkspaceMocks(page, { role: "teacher" });
  await page.setViewportSize({ width: 980, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      get: () => "MacIntel",
    });
  });

  await gotoAndSettle(page, `${BASE}/workspace/mobile`, { timeout: 20_000 });
  await page.getByRole("button", { name: "메뉴", exact: true }).click();

  const pcVersion = page.getByRole("button", { name: "PC 버전", exact: true });
  await expect(pcVersion).toBeVisible();
  await pcVersion.click();
  await expect(page).toHaveURL(/\/workspace(?:\/dashboard)?$/);
  await expect.poll(() => page.evaluate(() => (
    localStorage.getItem("workspace:preferFull:hakwonplus")
  ))).toBe("1");
});

test("390px 급여 관리자는 직원 운영만 추가되고 원장·수납 권한은 넓어지지 않는다", async ({ page }) => {
  await installWorkspaceMocks(page, { role: "teacher", payrollManager: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/desktop-only`, { timeout: 20_000 });

  await expect(page.getByRole("button", { name: /직원 급여 운영/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /홈페이지 편집/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /수납 템플릿/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /기능 플래그/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("1366px 관리자는 관리자·수납 기능을 보되 대표원장·급여 기능은 보지 않는다", async ({ page }) => {
  await installWorkspaceMocks(page, { role: "admin", payrollManager: false });
  await page.setViewportSize({ width: 1366, height: 900 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/desktop-only`, { timeout: 20_000 });

  await expect(page.getByRole("searchbox", { name: "전체 기능 검색" })).toBeVisible();
  await expect(page.getByRole("button", { name: /홈페이지 편집/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /수납 템플릿/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /기능 플래그/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /직원 급여 운영/ })).toHaveCount(0);
  await page.getByRole("button", { name: "관리·도구", exact: true }).click();
  await expect(page.getByRole("button", { name: /PPT 만들기/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /성적 트리/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
