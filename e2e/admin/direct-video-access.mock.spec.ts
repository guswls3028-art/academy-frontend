import type { Locator, Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function jwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "tenant-one",
    user_id: 12,
  })}.sig`;
}

type Evidence = {
  studentSearches: number;
  grantBodies: unknown[];
  revokeBodies: unknown[];
  mutationPaths: string[];
};

async function installApp(page: Page): Promise<Evidence> {
  const evidence: Evidence = {
    studentSearches: 0,
    grantBodies: [],
    revokeBodies: [],
    mutationPaths: [],
  };
  let history: Array<Record<string, unknown>> = [];
  await page.clock.install({ time: new Date("2026-08-29T14:00:00.000Z") });
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt());

  const handler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (!["GET", "HEAD"].includes(request.method())) evidence.mutationPaths.push(path);

    if (path === "/core/program/") {
      return json({ tenantCode: "tenant-one", display_name: "테스트 학원", feature_flags: {}, is_active: true });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "admin",
        name: "테스트 관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/media/videos/901/stats/") {
      return json({
        video: {
          id: 901,
          session: 801,
          session_id: 801,
          title: "2학기 중간고사 해설",
          status: "READY",
          source_type: "file",
          duration: 600,
          created_at: "2026-08-29T20:00:00+09:00",
          view_count: 0,
          allow_skip: true,
          max_speed: 1,
          show_watermark: false,
          order: 1,
        },
        students: [{
          enrollment: 7001,
          student_id: 501,
          student_name: "기존수강생",
          progress: 0,
          completed: false,
          attendance_status: "UNSET",
          effective_rule: "free",
          access_mode: "FREE_REVIEW",
          school: "테스트고",
          grade: "2",
        }],
      });
    }
    if (path === "/media/videos/901/engagement/") return json({ view_count: 0, like_count: 0, comment_count: 0 });
    if (path === "/media/videos/901/comments/") return json({ comments: [], total: 0 });
    if (path === "/students/" && request.method() === "GET") {
      evidence.studentSearches += 1;
      return json({
        count: 1,
        page_size: 50,
        results: [{
          id: 502,
          name: "테스트학생",
          display_name: "테스트학생",
          ps_number: "MOCK-502",
          omr_code: "00000502",
          phone: null,
          parent_phone: null,
          school: "가상고",
          high_school: "가상고",
          grade: 2,
          gender: null,
          created_at: "2026-08-01T00:00:00+09:00",
          is_managed: true,
          account_state: "ACTIVE",
          school_type: "HIGH",
          tags: [],
          enrollments: [],
          custom_fields: {},
        }],
      });
    }
    if (path === "/media/direct-video-entitlements/" && request.method() === "GET") {
      return json({ count: history.length, next: null, previous: null, results: history });
    }
    if (path === "/media/direct-video-entitlements/" && request.method() === "POST") {
      const body = request.postDataJSON();
      evidence.grantBodies.push(body);
      const entitlement = {
        id: 3001,
        student_id: 502,
        student_name: "테스트학생",
        student_school: "가상고",
        student_grade: 2,
        video_id: 901,
        video_title: "2학기 중간고사 해설",
        lecture_title: "테스트 강의",
        state: "ACTIVE",
        reason: body.reason,
        granted_at: "2026-08-29T22:30:00+09:00",
        revoked_at: null,
        revoke_reason: "",
      };
      history = [entitlement];
      return json({ entitlement, created: true, changed: true }, 201);
    }
    if (path === "/media/direct-video-entitlements/3001/revoke/" && request.method() === "POST") {
      const body = request.postDataJSON();
      evidence.revokeBodies.push(body);
      history = history.map((item) => ({
        ...item,
        state: "REVOKED",
        revoked_at: "2026-08-29T22:35:00+09:00",
        revoke_reason: body.reason,
      }));
      return json({ entitlement: history[0], created: false, changed: true });
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/media/videos/public-session/") return json(null);
    return json([]);
  };

  await page.route("**/api/v1/**", handler);
  await page.context().route("**/api/v1/**", handler);
  return evidence;
}

async function expectRevokeCtaLayout(page: Page, direct: Locator): Promise<void> {
  const revokeButton = direct.getByRole("button", { name: "회수", exact: true });
  const label = revokeButton.locator(".ds-button__label");
  await expect(revokeButton).toBeVisible();
  await expect(revokeButton).toHaveText("회수");

  const metrics = await label.evaluate((element) => {
    const labelRect = element.getBoundingClientRect();
    const buttonRect = element.parentElement?.getBoundingClientRect();
    const rowRect = element.closest(".direct-video-access__revoke")?.getBoundingClientRect();
    return {
      labelClientWidth: element.clientWidth,
      labelScrollWidth: element.scrollWidth,
      labelLeft: labelRect.left,
      labelRight: labelRect.right,
      buttonLeft: buttonRect?.left ?? -1,
      buttonRight: buttonRect?.right ?? -1,
      rowLeft: rowRect?.left ?? -1,
      rowRight: rowRect?.right ?? -1,
      viewportWidth: window.innerWidth,
    };
  });
  expect(metrics.labelClientWidth, "회수 CTA 라벨 너비가 확보되어야 한다").toBeGreaterThan(0);
  expect(metrics.labelScrollWidth, "회수 CTA 라벨이 말줄임되지 않아야 한다").toBeLessThanOrEqual(metrics.labelClientWidth);
  expect(metrics.labelLeft).toBeGreaterThanOrEqual(metrics.buttonLeft - 1);
  expect(metrics.labelRight).toBeLessThanOrEqual(metrics.buttonRight + 1);
  expect(metrics.buttonLeft).toBeGreaterThanOrEqual(metrics.rowLeft - 1);
  expect(metrics.buttonRight).toBeLessThanOrEqual(metrics.rowRight + 1);
  expect(metrics.rowLeft).toBeGreaterThanOrEqual(-1);
  expect(metrics.rowRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
}

test.use({ serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");

test("검토 확인창은 취소에 시작하고 Escape와 취소 후 진입 버튼으로 복귀한다", async ({ page }) => {
  const evidence = await installApp(page);
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree?videoId=901&lectureId=701&sessionId=801`);
  await page.getByRole("region", { name: "학생 시청 현황" }).getByRole("button", { name: "권한 관리" }).click();
  await page.getByRole("button", { name: "수강 등록 없이 영상만" }).click();
  const direct = page.getByRole("region", { name: "수강 등록 없이 영상만" });
  await direct.getByRole("searchbox", { name: "개별 영상 권한 학생 검색" }).fill("테스트학생");
  await page.clock.runFor(350);
  await direct.getByRole("button", { name: /테스트학생.*로그인 가능/ }).click();
  await direct.getByPlaceholder("왜 수강 등록 없이 이 영상만 열어야 하는지 남겨 주세요.").fill("단일 보강 영상 제공 요청");
  const trigger = direct.getByRole("button", { name: "영상 1개 열기" });
  const dialog = page.getByRole("alertdialog", { name: "개별 영상 권한 승인" });
  const cancel = dialog.getByRole("button", { name: "취소" });
  const confirm = dialog.getByRole("button", { name: "영상 1개 열기" });
  for (const closeWithEscape of [true, false]) {
    await trigger.click();
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    if (closeWithEscape) await page.keyboard.press("Escape");
    else await cancel.click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(evidence.grantBodies).toEqual([]);
  }
  await trigger.click();
  await expect(cancel).toBeFocused();
  await trigger.evaluate((button) => button.remove());
  await cancel.click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toHaveCount(0);
  expect(evidence.grantBodies).toEqual([]);
  expect(evidence.revokeBodies).toEqual([]);
});

test("교직원은 명시 확인으로 영상 1개만 승인하고 사유와 함께 회수한다", async ({ page }) => {
  const evidence = await installApp(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await gotoAndSettle(
    page,
    `${BASE}/workspace/videos/tree?videoId=901&lectureId=701&sessionId=801`,
    { timeout: 45_000 },
  );

  await page.getByRole("region", { name: "학생 시청 현황" }).getByRole("button", { name: "권한 관리" }).click();
  await expect(page.getByRole("heading", { name: "시청 권한 관리" })).toBeVisible();
  await page.getByRole("button", { name: "수강 등록 없이 영상만" }).click();
  const direct = page.getByRole("region", { name: "수강 등록 없이 영상만" });
  await expect(direct.getByText("예외 권한", { exact: true })).toBeVisible();

  const search = direct.getByRole("searchbox", { name: "개별 영상 권한 학생 검색" });
  await search.fill("테");
  await page.clock.runFor(350);
  expect(evidence.studentSearches).toBe(0);
  await search.fill("테스트학생");
  await page.clock.runFor(350);
  await expect(direct.getByRole("button", { name: /테스트학생.*로그인 가능/ })).toBeVisible();
  expect(evidence.studentSearches).toBe(1);
  await direct.getByRole("button", { name: /테스트학생.*로그인 가능/ }).click();
  await direct.getByPlaceholder("왜 수강 등록 없이 이 영상만 열어야 하는지 남겨 주세요.").fill("단일 보강 영상 제공 요청");
  await direct.getByRole("button", { name: "영상 1개 열기" }).click();

  const grantDialog = page.getByRole("alertdialog", { name: "개별 영상 권한 승인" });
  await expect(grantDialog.getByText("현재 영상 1개 · 무료 복습", { exact: true })).toBeVisible();
  await expect(grantDialog.getByText("생성하지 않음", { exact: true })).toBeVisible();
  await grantDialog.getByRole("button", { name: "영상 1개 열기" }).click();
  await expect(direct.getByText("사용 중", { exact: true })).toBeVisible();
  expect(evidence.grantBodies).toEqual([{
    student_id: 502,
    video_id: 901,
    reason: "단일 보강 영상 제공 요청",
    confirmed_regrant: false,
  }]);

  await expectRevokeCtaLayout(page, direct);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("region", { name: "학생 시청 현황" }).getByRole("button", { name: "권한 관리" }).click();
  await page.getByRole("button", { name: "수강 등록 없이 영상만" }).click();
  await expect(direct.getByText("사용 중", { exact: true })).toBeVisible();
  await expectRevokeCtaLayout(page, direct);

  await direct.getByRole("textbox", { name: "테스트학생 회수 사유" }).fill("보강 제공 종료");
  await direct.getByRole("button", { name: "회수", exact: true }).click();
  const revokeDialog = page.getByRole("alertdialog", { name: "개별 영상 권한 회수" });
  await expect(revokeDialog.getByText("보강 제공 종료", { exact: true })).toBeVisible();
  await revokeDialog.getByRole("button", { name: "권한 회수" }).click();
  await expect(direct.getByText("회수됨", { exact: true })).toBeVisible();
  await expect(direct.getByText("회수 사유: 보강 제공 종료", { exact: true })).toBeVisible();
  expect(evidence.revokeBodies).toEqual([{ reason: "보강 제공 종료" }]);
  expect(evidence.mutationPaths.filter((path) => (
    path.includes("enrollment")
    || path.includes("attendance")
    || path.includes("fee")
    || path.includes("notification")
  ))).toEqual([]);

  await expect(direct).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});
