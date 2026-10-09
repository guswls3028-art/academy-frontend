import { test, expect } from "../fixtures/strictTest";
import type { Page, Route } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL
  || process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5175";

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 101,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

async function installTeacherMocks(page: Page, options: {
  qnaPending?: number;
  videoFailed?: number;
  registrationStatus?: 200 | 503;
} = {}) {
  let registrationStatus = options.registrationStatus ?? 200;
  const mutations: string[] = [];
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(body),
    });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (request.method() !== "GET" && path !== "/token/refresh/") {
      mutations.push(`${request.method()} ${path}`);
    }
    if (path === "/core/program/") return json({
      tenantCode: "hakwonplus", display_name: "테스트 학원", ui_config: {},
      feature_flags: {}, is_active: true,
    });
    if (path === "/core/me/") return json({
      id: 101, username: "teacher", name: "선생님", phone: null,
      is_staff: true, is_superuser: false, tenantRole: "teacher",
    });
    if (path === "/community/admin/posts/") {
      const results = url.searchParams.get("post_type") === "qna"
        ? Array.from({ length: options.qnaPending ?? 0 }, (_, index) => ({
          id: 880_000 + index, replies_count: 0, author_role: "student",
          category_label: "question",
        })) : [];
      return json({ count: results.length, results });
    }
    if (path === "/students/registration_requests/") return registrationStatus === 503
      ? json({ detail: "temporary failure" }, 503) : json({ count: 0, results: [] });
    if (path === "/clinic/participants/") return json({ count: 0, results: [] });
    if (path === "/submissions/submissions/pending/") return json([]);
    if (path === "/results/admin/teacher-dashboard-counts/") return json({ video_failed: options.videoFailed ?? 0, qna_pending: options.qnaPending ?? 0, counsel_pending: 0, submission_pending: 0 });
    if (path === "/community/admin/reports/pending-count/") return json({ count: 0 });
    if (path === "/community/notifications/unread-count/") return json({ count: 0 });
    if (path === "/lectures/attendance/arrival-overview/") return json({
      generated_at: "2026-09-28T09:00:00+09:00", today: "2026-09-28",
      tomorrow: "2026-09-29", range_end: "2026-10-05", range_days: 7,
      soon_window_minutes: 60,
      summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, overdue: 0, time_unset: 0 },
      items: [],
    });
    return json({ count: 0, results: [] });
  });
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", access);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    localStorage.setItem("teacher:preferAdmin", "0");
  }, fakeJwt());
  return { mutations, setRegistrationStatus: (status: 200 | 503) => { registrationStatus = status; } };
}

test.describe("선생님 업데이트 안내의 도움말 이동", () => {
  test.use({ serviceWorkers: "block" });

  test("390px 도움말에서 패치노트를 열고 읽음 상태가 유지되며 종은 업무 0건이다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { mutations } = await installTeacherMocks(page);
    await page.context().route("**/promo/updates**", (route) => route.fulfill({
      status: 200, contentType: "text/html", body: "<h1>업데이트 소식</h1>",
    }));
    await page.goto(`${BASE}/workspace/mobile/notifications`, { waitUntil: "load" });
    await expect(page.getByRole("button", { name: "알림", exact: true })).toBeVisible();
    await expect(page.getByText("처리할 업무 알림이 없습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("새 제품 업데이트", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^총 \d+건$/)).toHaveCount(0);

    const guide = page.getByRole("button", { name: "가이드북, 새 제품 업데이트" });
    await guide.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "선생님 가이드북" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /대시보드에서 시작/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "선생님 전체 가이드" })).toBeVisible();
    const updateLink = dialog.getByRole("link", { name: /새 제품 업데이트.*패치노트 보기/ });
    await expect(updateLink).toHaveAttribute("href", /\/promo\/updates#latest-update$/);
    await expect(updateLink).toHaveAttribute("target", "_blank");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(guide).toBeFocused();
    await guide.click();
    const [popup] = await Promise.all([page.waitForEvent("popup"), updateLink.click()]);
    await expect(popup).toHaveURL(/\/promo\/updates#latest-update$/);
    await popup.close();
    await expect(page.getByRole("button", { name: "가이드북", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "가이드북", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "알림", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "가이드북", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "알림", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    const drawer = page.getByRole("navigation", { name: "선생님 메뉴" });
    await drawer.getByRole("button", { name: /지원/ }).click();
    await expect(drawer.getByText("사용 가이드", { exact: true })).toBeVisible();
    await expect(drawer.getByText("업데이트 소식", { exact: true })).toHaveCount(0);
    expect(mutations).toEqual([]);
  });

  test("1366px 업무·오류 알림은 업데이트 읽음과 무관하게 남고 재시도된다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const mocks = await installTeacherMocks(page, {
      qnaPending: 2, videoFailed: 1, registrationStatus: 503,
    });
    await page.goto(`${BASE}/workspace/mobile/notifications`, { waitUntil: "load" });
    await expect(page.getByRole("button", { name: "알림 일부 확인 필요" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("일부 업무 알림을 불러오지 못했습니다");
    await expect(page.getByText("답변 대기 질문", { exact: true })).toBeVisible();
    await expect(page.getByText("영상 인코딩 실패", { exact: true })).toBeVisible();
    await expect(page.getByText("새 제품 업데이트", { exact: true })).toHaveCount(0);
    mocks.setRegistrationStatus(200);
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByRole("button", { name: "알림 3건" })).toBeVisible();
    await expect(page.getByText("총 3건", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(mocks.mutations).toEqual([]);
  });
});
