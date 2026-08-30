import fs from "node:fs";
import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";
import {
  parseMobileWorkspaceReturnPath,
  resolveFullWorkspaceDestination,
} from "../../src/core/router/workspaceRoutes";

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
type MockOptions = {
  role?: StaffRole;
  userId?: number;
  examSessionIds?: number[];
  sessionOverrides?: Record<number, Record<string, unknown>>;
  communityPosts?: Array<Record<string, unknown>>;
};

async function installWorkspaceMocks(page: Page, options: MockOptions = {}) {
  const role = options.role ?? "teacher";
  const userId = options.userId ?? (role === "owner" ? 1 : role === "admin" ? 2 : 3);
  const apiRequests: Array<{ method: string; path: string }> = [];

  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", "hakwonplus");
    localStorage.setItem("teacher:preferAdmin", "0");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { access: fakeJwt(), refresh: fakeJwt() });

  const json = (route: Route, body: unknown) => route.fulfill({ json: body });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    apiRequests.push({ method: request.method(), path });

    if (request.method() !== "GET") {
      return json(route, { detail: "read-only parity test" });
    }
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
        id: userId,
        username: `${role}-${userId}`,
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
        is_payroll_manager: role !== "teacher",
        staff_id: userId + 100,
        assigned_work_types: [],
      });
    }
    if (path === "/students/41/") {
      return json(route, {
        id: 41,
        name: "패리티 학생",
        display_name: "패리티 학생",
        ps_number: "0041",
        omr_code: "0041",
        student_phone: null,
        parent_phone: null,
        school: null,
        school_class: null,
        major: null,
        grade: 2,
        gender: null,
        registered_at: "2026-08-25T00:00:00Z",
        is_managed: true,
        custom_fields: {},
        school_type: "HIGH",
        tags: [],
        enrollments: [],
      });
    }
    if (path === "/exams/50/") {
      return json(route, {
        id: 50,
        title: "다중 차시 시험",
        max_score: 100,
        pass_score: 60,
        is_active: true,
        updated_at: "2026-08-25T00:00:00Z",
        session_ids: options.examSessionIds ?? [11, 12],
      });
    }
    const sessionMatch = path.match(/^\/lectures\/sessions\/(\d+)\/$/);
    if (sessionMatch) {
      const sessionId = Number(sessionMatch[1]);
      return json(route, {
        id: sessionId,
        lecture: sessionId === 11 ? 201 : 202,
        order: sessionId === 11 ? 1 : 2,
        display_label: sessionId === 11 ? "1차시" : "2차시",
        title: sessionId === 11 ? "기초 확인" : "심화 확인",
        ...(options.sessionOverrides?.[sessionId] ?? {}),
      });
    }
    if (path === "/community/posts/") {
      return json(route, { count: options.communityPosts?.length ?? 0, results: options.communityPosts ?? [] });
    }

    return json(route, { count: 0, results: [] });
  });

  return apiRequests;
}

async function openContextualPcVersion(page: Page) {
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  const support = page.getByRole("button", { name: /지원/ });
  if (await support.isVisible()) await support.click();
  await page.getByRole("button", { name: "PC 버전", exact: true }).last().click();
}

async function returnToMobileVersion(page: Page) {
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  await page.getByRole("button", { name: "모바일 버전", exact: true }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= window.innerWidth,
    root: document.documentElement.scrollWidth <= window.innerWidth,
  }))).toEqual({ body: true, root: true });
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test("동적 모바일 경로는 현재 executable canonical route만 가리킨다", () => {
  const adminRouter = fs.readFileSync("src/app_admin/app/AdminRouter.tsx", "utf8");
  const teacherRouter = fs.readFileSync("src/app_teacher/app/TeacherRouter.tsx", "utf8");
  const mappings: Array<[string, string]> = [
    ["/workspace/mobile/students/41", "/workspace/students/41"],
    ["/workspace/mobile/classes/7", "/workspace/lectures/7"],
    ["/workspace/mobile/classes/7/sessions/11", "/workspace/lectures/7/sessions/11/attendance"],
    ["/workspace/mobile/attendance/11", "/workspace/sessions/11/attendance"],
    ["/workspace/mobile/scores/11", "/workspace/sessions/11/scores"],
    ["/workspace/mobile/exams/50", "/workspace/exams/50"],
    ["/workspace/mobile/exams/50?sessionId=12", "/workspace/exams/50?sessionId=12"],
    ["/workspace/mobile/videos/9", "/workspace/videos/9"],
    ["/workspace/mobile/comms?tab=qna&id=5", "/workspace/community/qna?id=5"],
    ["/workspace/mobile/comms?tab=notices&id=5", "/workspace/community/notice?id=5"],
    ["/workspace/mobile/comms?tab=counsel&id=5", "/workspace/community/counsel?id=5"],
    ["/workspace/mobile/comms?tab=board&id=5", "/workspace/community/board?id=5"],
    ["/workspace/mobile/comms?tab=materials&id=5", "/workspace/community/materials?id=5"],
    ["/workspace/mobile/comms?tab=requests", "/workspace/students/requests"],
    ["/workspace/mobile/staff/8", "/workspace/staff/8"],
    ["/workspace/mobile/profile", "/workspace/settings/profile"],
    ["/workspace/mobile/my-records", "/workspace/profile/attendance"],
  ];
  const rejected = [
    "https://evil.example/workspace/mobile/profile",
    "//evil.example/workspace/mobile/profile",
    "/workspace/mobile/students/0",
    "/workspace/mobile/students/-1",
    "/workspace/mobile/students/1?next=/workspace/mobile/profile",
    "/workspace/mobile/students/%2e%2e",
    "/workspace/mobile/profile#stale",
    "/workspace/mobile/exams/50?sessionId=0",
    "/workspace/mobile/exams/50?sessionId=12&sessionId=13",
    "/workspace/mobile/comms?tab=qna&id=0",
    "/workspace/mobile/comms?tab=requests&id=5",
    "/workspace/mobile/comms?tab=qna&id=5&extra=1",
  ];

  for (const [mobile, canonical] of mappings) {
    expect(parseMobileWorkspaceReturnPath(mobile)).toBe(mobile);
    expect(resolveFullWorkspaceDestination(mobile)).toBe(canonical);
  }
  for (const candidate of rejected) {
    expect(parseMobileWorkspaceReturnPath(candidate)).toBeNull();
    expect(resolveFullWorkspaceDestination(candidate)).toBeNull();
  }
  expect(adminRouter).toContain('path="sessions/:sessionId/:workflow"');
  expect(adminRouter).toContain('path="exams/:examId"');
  expect(teacherRouter).toContain('<RoleGuard allow={["owner", "admin"]}><StaffDetailPage /></RoleGuard>');
});

test("390px 선생님은 학생 상세를 PC canonical로 열고 같은 모바일 상세로 한 번만 돌아온다", async ({ page }) => {
  const apiRequests = await installWorkspaceMocks(page, { role: "teacher", userId: 3 });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/students/41`, { timeout: 20_000 });

  await expect(page.getByRole("heading", { name: "학생 상세" })).toBeVisible();
  await openContextualPcVersion(page);
  await expect(page).toHaveURL(/\/workspace\/students\/41$/);
  await expectNoHorizontalOverflow(page);

  await returnToMobileVersion(page);
  await expect(page).toHaveURL(/\/workspace\/mobile\/students\/41$/);
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("workspace:mobileReturn:")).length)).toBe(0);
  expect(apiRequests.filter(({ method }) => method !== "GET")).toEqual([]);
});

test("복귀 context는 계정별로 격리되고 hostile·stale 값은 소비 후 모바일 홈으로 닫힌다", async ({ page }) => {
  await installWorkspaceMocks(page, { role: "teacher", userId: 3 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const now = Date.now();
    localStorage.setItem("workspace:preferFull:hakwonplus", "1");
    sessionStorage.setItem("workspace:mobileReturn:v1:hakwonplus:99", JSON.stringify({ path: "/workspace/mobile/students/99", savedAt: now }));
    sessionStorage.setItem("workspace:mobileReturn:v1:hakwonplus:3", JSON.stringify({ path: "https://evil.example/workspace/mobile", savedAt: now }));
  });
  await gotoAndSettle(page, `${BASE}/workspace/dashboard`, { timeout: 20_000 });

  await returnToMobileVersion(page);
  await expect(page).toHaveURL(/\/workspace\/mobile$/);
  expect(await page.evaluate(() => sessionStorage.getItem("workspace:mobileReturn:v1:hakwonplus:3"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("workspace:mobileReturn:v1:hakwonplus:99"))).not.toBeNull();

  await page.evaluate(() => {
    sessionStorage.setItem("workspace:mobileReturn:v1:hakwonplus:3", JSON.stringify({ path: "/workspace/mobile/profile", savedAt: 1 }));
  });
  await gotoAndSettle(page, `${BASE}/workspace/dashboard`, { timeout: 20_000 });
  await returnToMobileVersion(page);
  await expect(page).toHaveURL(/\/workspace\/mobile$/);
  expect(await page.evaluate(() => sessionStorage.getItem("workspace:mobileReturn:v1:hakwonplus:3"))).toBeNull();
});

test("다중 차시 시험은 자동 추론하지 않고 선택·포커스·Escape·정확 복귀를 보장한다", async ({ page }) => {
  const apiRequests = await installWorkspaceMocks(page, { examSessionIds: [11, 12] });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/exams/50`, { timeout: 20_000 });
  await openContextualPcVersion(page);

  await expect(page).toHaveURL(/\/workspace\/exams\/50$/);
  await expect(page.getByRole("heading", { name: "시험을 진행한 차시를 선택해 주세요" })).toBeVisible();
  const firstChoice = page.getByRole("button", { name: /1차시.*기초 확인/ });
  await expect(firstChoice).toBeFocused();
  await expectNoHorizontalOverflow(page);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/workspace\/mobile\/exams\/50$/);
  await openContextualPcVersion(page);
  await page.getByRole("button", { name: /2차시.*심화 확인/ }).click();
  await expect(page).toHaveURL(/\/workspace\/lectures\/202\/sessions\/12\/exams\?examId=50$/);
  await returnToMobileVersion(page);
  await expect(page).toHaveURL(/\/workspace\/mobile\/exams\/50$/);
  expect(apiRequests.filter(({ method }) => method !== "GET")).toEqual([]);
});

test("session-id alias는 authoritative lecture가 없으면 추측 없이 명시 오류를 보인다", async ({ page }) => {
  const apiRequests = await installWorkspaceMocks(page, {
    sessionOverrides: { 11: { id: 11, lecture: 0 } },
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await gotoAndSettle(page, `${BASE}/workspace/sessions/11/scores`, { timeout: 20_000 });

  await expect(page).toHaveURL(/\/workspace\/sessions\/11\/scores$/);
  await expect(page.getByText("차시 정보를 확인할 수 없습니다")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(apiRequests.filter(({ method }) => method !== "GET")).toEqual([]);
});

test("커뮤니티 detail id는 authoritative 탭 목록에 있을 때만 열린다", async ({ page }) => {
  await installWorkspaceMocks(page, {
    communityPosts: [{
      id: 5,
      title: "확인된 질문",
      content: "질문 내용",
      post_type: "qna",
      author_role: "student",
      created_at: "2026-08-25T00:00:00Z",
      replies_count: 0,
    }],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/comms?tab=qna&id=999`, { timeout: 20_000 });

  await expect(page.getByText("확인된 질문")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Q&A" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspace\/mobile\/comms\?tab=qna$/);

  await page.getByText("확인된 질문").click();
  await expect(page).toHaveURL(/\/workspace\/mobile\/comms\?tab=qna&id=5$/);
  await expect(page.getByRole("heading", { name: "Q&A" })).toBeVisible();
});

test("직원 detail PC 전환은 기존 owner/admin 모바일 guard를 그대로 둔다", async ({ page }) => {
  const teacherRequests = await installWorkspaceMocks(page, { role: "teacher", userId: 3 });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/staff/41`, { timeout: 20_000 });
  await expect(page.getByText("접근 권한이 없습니다")).toBeVisible();
  expect(teacherRequests.filter(({ method }) => method !== "GET")).toEqual([]);
});

for (const [role, userId] of [["owner", 1], ["admin", 2]] as const) {
  test(`${role}는 기존 모바일 직원 detail guard를 통과한다`, async ({ page }) => {
    const apiRequests = await installWorkspaceMocks(page, { role, userId });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/staff/41`, { timeout: 20_000 });

    await expect.poll(() => apiRequests.some(({ method, path }) => (
      method === "GET" && path === "/staffs/41/"
    ))).toBe(true);
    await expect(page.getByText("접근 권한이 없습니다")).toHaveCount(0);
    expect(apiRequests.filter(({ method }) => method !== "GET")).toEqual([]);
  });
}
