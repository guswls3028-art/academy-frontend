import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { assertInteractiveSurface } from "../helpers/assertInteractiveSurface";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function jwt(userId: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: userId,
  })}.sig`;
}

const ADMIN_ACCESS = jwt(12);
const SUPPORT_ACCESS = jwt(99);

type MockEvidence = {
  activityQueries: string[];
  screenRecords: Array<{ authorization: string; body: Record<string, unknown> }>;
  supportEnds: Array<{ path: string; authorization: string }>;
};

async function installApp(page: Page): Promise<MockEvidence> {
  const evidence: MockEvidence = { activityQueries: [], screenRecords: [], supportEnds: [] };
  await installTenantOneInitScript(page);
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, ADMIN_ACCESS);

  const handleApi = async (route: Route) => {
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
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      const isSupport = request.headers().authorization === `Bearer ${SUPPORT_ACCESS}`;
      return json(isSupport ? {
        id: 99,
        username: "SUPPORT99",
        name: "지원학생",
        is_staff: false,
        is_superuser: false,
        tenantRole: "student",
        must_change_password: true,
        first_login_guide_required: true,
      } : {
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/students/1001/") {
      return json({
        id: 1001,
        name: "지원학생",
        ps_number: "SUPPORT99",
        is_managed: true,
        tags: [],
        enrollments: [],
      });
    }
    if (path === "/students/1001/support-session/" && request.method() === "POST") {
      return json({
        access: SUPPORT_ACCESS,
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        session_id: "11111111-1111-4111-8111-111111111111",
        student: { id: 1001, name: "지원학생" },
      });
    }
    if (path === "/students/1001/activities/" && request.method() === "GET") {
      evidence.activityQueries.push(url.search);
      const results = [{
        id: 1,
        occurred_at: "2026-08-22T01:09:00+09:00",
        category: "login",
        label: "학생 로그인",
        actor_mode: "student",
        device_class: "mobile",
        screen_id: "",
        actor_label: "학생 본인",
        target_label: "",
        evidence_id: "ACT-1",
      }];
      if (url.searchParams.get("include_support") === "1") {
        results.push({
          id: 2,
          occurred_at: "2026-08-22T01:10:00+09:00",
          category: "video",
          label: "영상 재생 화면 열기",
          actor_mode: "support",
          device_class: "mobile",
          screen_id: "student.video.player",
          actor_label: "김선생",
          target_label: "중간고사 해설 영상",
          evidence_id: "ACT-2",
        });
      }
      return json({
        student: { id: 1001, name: "지원학생" },
        results,
        count: results.length,
        total_count: results.length,
        has_more: false,
        days: Number(url.searchParams.get("days") || 30),
        include_support: url.searchParams.get("include_support") === "1",
        query: url.searchParams.get("q") || "",
      });
    }
    if (
      request.method() === "POST"
      && (
        path === "/students/me/support-session/end/"
        || /^\/students\/1001\/support-sessions\/[0-9a-f-]+\/end\/$/.test(path)
      )
    ) {
      evidence.supportEnds.push({
        path,
        authorization: request.headers().authorization || "",
      });
      return json({ ended: true });
    }
    if (path === "/students/me/activity/" && request.method() === "POST") {
      evidence.screenRecords.push({
        authorization: request.headers().authorization || "",
        body: request.postDataJSON() as Record<string, unknown>,
      });
      return json({ accepted: true }, 202);
    }
    if (path === "/student/dashboard/") {
      return json({
        today_sessions: [],
        upcoming_sessions: [],
        assignments: [],
        exams: [],
        notices: [],
        badges: {},
        tenant_info: null,
      });
    }
    if (path === "/students/me/") {
      return json({ id: 1001, name: "지원학생", ps_number: "SUPPORT99" });
    }
    if (path === "/staffs/currently-working/") return json([]);
    return json({ count: 0, next: null, previous: null, results: [] });
  };

  // Keep the page-owned mock explicit for the route-mock safety guard, and
  // add the same handler at context scope for the separate popup Page.
  await page.route("**/api/v1/**", handleApi);
  await page.context().route("**/api/v1/**", handleApi);

  return evidence;
}

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");

test("학생 활동은 대리보기를 기본 제외하고 팝업 토큰은 교직원 세션과 분리된다", async ({ page }) => {
  const evidence = await installApp(page);
  await gotoAndSettle(page, `${BASE}/workspace/students/1001`, { timeout: 45_000 });

  const overlay = page.getByTestId("student-detail-overlay");
  await expect(overlay).toBeVisible();
  await overlay.getByRole("tab", { name: "활동 감사 로그인 · 열람" }).click();

  const activityPanel = overlay.getByRole("region", { name: "학생 활동 감사" });
  await expect(activityPanel.getByText("학생 로그인", { exact: true })).toBeVisible();
  await expect(activityPanel.getByText("영상 재생 화면 열기", { exact: true })).toHaveCount(0);
  await assertInteractiveSurface(
    page,
    activityPanel,
    activityPanel.getByRole("checkbox", { name: "교직원 대리보기 포함" }),
  );

  await activityPanel.getByRole("checkbox", { name: "교직원 대리보기 포함" }).check();
  await expect(activityPanel.getByText("영상 재생 화면 열기", { exact: true })).toBeVisible();
  await activityPanel.getByLabel("기록 검색").fill("중간고사");
  await activityPanel.getByRole("button", { name: "검색", exact: true }).click();
  await expect.poll(() => evidence.activityQueries.some((query) => query.includes("q=%EC%A4%91%EA%B0%84%EA%B3%A0%EC%82%AC"))).toBe(true);
  await activityPanel.getByText("영상 재생 화면 열기", { exact: true }).click();
  await expect(activityPanel.getByText("중간고사 해설 영상", { exact: true })).toBeVisible();
  await expect(activityPanel.getByText("ACT-2", { exact: true })).toBeVisible();
  expect(evidence.activityQueries.some((query) => query.includes("include_support=0"))).toBe(true);
  expect(evidence.activityQueries.some((query) => query.includes("include_support=1"))).toBe(true);
  if (process.env.CAPTURE_STUDENT_SUPPORT === "1") {
    await activityPanel.screenshot({ path: "test-results/student-support-activity-mobile.png" });
  }

  await page.setViewportSize({ width: 1366, height: 900 });
  const desktopOverlay = page.getByTestId("student-detail-overlay");
  await desktopOverlay.getByRole("tab", { name: "활동 감사 로그인 · 열람" }).click();
  await expect(desktopOverlay.getByRole("region", { name: "학생 활동 감사" })).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
  if (process.env.CAPTURE_STUDENT_SUPPORT === "1") {
    await page.screenshot({ path: "test-results/student-support-activity-desktop.png", fullPage: false });
  }
  await page.setViewportSize({ width: 390, height: 844 });

  const popupPromise = page.waitForEvent("popup");
  await overlay.getByRole("button", { name: "학생 화면 보기" }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/\/student\/dashboard\?supportPreview=1$/, { timeout: 30_000 });
  await expect(popup.getByText("교직원 대리보기", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(popup.getByText(/지원학생 화면/)).toBeVisible();
  await expect(popup.getByText(/\d{2}:\d{2} 남음/)).toBeVisible();

  const storage = await popup.evaluate(() => {
    const store = window.localStorage;
    const activeGeneration = store.getItem("academy:auth-active-generation:v1");
    const activeRaw = activeGeneration
      ? store.getItem(`academy:auth-tokens:v1:${activeGeneration}`)
      : null;
    const activeEnvelope = activeRaw
      ? JSON.parse(activeRaw) as { access?: string }
      : null;
    return {
      windowName: window.name,
      legacyAccess: store.getItem("access"),
      activeAccess: activeEnvelope?.access ?? null,
      supportAccess: sessionStorage.getItem("hplus_student_support_access"),
    };
  });
  expect(storage).toEqual({
    windowName: "",
    legacyAccess: null,
    activeAccess: ADMIN_ACCESS,
    supportAccess: SUPPORT_ACCESS,
  });
  await expect.poll(() => evidence.screenRecords.length).toBeGreaterThan(0);
  expect(evidence.screenRecords[0]).toEqual({
    authorization: `Bearer ${SUPPORT_ACCESS}`,
    body: { screen_id: "student.dashboard.home", device_class: "mobile" },
  });
  if (process.env.CAPTURE_STUDENT_SUPPORT === "1") {
    await popup.screenshot({ path: "test-results/student-support-popup-mobile.png", fullPage: true });
  }

  const closed = popup.waitForEvent("close");
  await popup.getByRole("button", { name: "보기 종료" }).click();
  await closed;
  await expect.poll(() => evidence.supportEnds.length).toBeGreaterThan(0);
  expect(evidence.supportEnds.some((item) => (
    item.path === "/students/me/support-session/end/"
    && item.authorization === `Bearer ${SUPPORT_ACCESS}`
  ))).toBe(true);
  await expect(overlay).toBeVisible();
  const restoredAdminAccess = await page.evaluate(() => {
    const store = window.localStorage;
    const activeGeneration = store.getItem("academy:auth-active-generation:v1");
    const activeRaw = activeGeneration
      ? store.getItem(`academy:auth-tokens:v1:${activeGeneration}`)
      : null;
    if (!activeRaw) return null;
    return (JSON.parse(activeRaw) as { access?: string }).access ?? null;
  });
  expect(restoredAdminAccess).toBe(ADMIN_ACCESS);
});
