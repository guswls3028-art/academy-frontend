import type { Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "tchul",
    user_id: 12,
  })}.sig`;
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", json });
}

test("showcase status failure blocks publish until an explicit retry succeeds", async ({ page }) => {
  const access = localJwt();
  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
    localStorage.setItem("tenant_code", "tchul");
    sessionStorage.setItem("tenantCode", "tchul");
  }, { token: access });

  let publishCalls = 0;
  let showcaseListCalls = 0;
  let showcaseStatusAvailable = false;
  let legacyToggleCalls = 0;
  let published = false;
  const report = {
    id: 101,
    document_id: 301,
    document_title: "2026 언남고 1학기 중간고사 생명과학",
    document_category: "생명과학",
    author_id: 12,
    author_name: "박철T",
    title: "언남고 생명과학 2026 1학기 기말고사",
    status: "submitted",
    submitted_at: "2026-08-05T16:00:00+09:00",
    exam_count: 10,
    curated_count: 8,
    curated_progress: 100,
    hit_count: 8,
    hit_rate: 80,
    has_share_token: false,
    created_at: "2026-08-05T15:00:00+09:00",
    updated_at: "2026-08-05T16:00:00+09:00",
  };
  const card = {
    id: 501,
    title: report.document_title,
    description: "",
    status: "published",
    published_at: "2026-08-05T16:20:00+09:00",
    published_until: null,
    snapshot_at: "2026-08-05T16:20:00+09:00",
    snapshot_meta: {
      document_title: report.document_title,
      author_name: report.author_name,
      hit_rate: 0.8,
      hit_count: 8,
      counted_entries: 10,
    },
    view_count: 0,
    expired: false,
    visible: true,
    hit_report_id_ref: report.id,
    pdf_url: "/api/v1/landing-public/matchup-showcase/501/pdf/?tenant=tchul",
    preview_url: "/api/v1/landing-public/matchup-showcase/501/preview/?tenant=tchul",
  };

  const handleApi = async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (pathname.endsWith("/core/program/")) {
      await fulfillJson(route, {
        tenantCode: "tchul",
        display_name: "박철과학",
        ui_config: { login_title: "박철과학" },
        feature_flags: {},
        is_active: true,
      });
      return;
    }
    if (pathname.endsWith("/core/me/")) {
      await fulfillJson(route, {
        id: 12,
        username: "tchul-owner",
        name: "박철T",
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
        first_login_guide_required: false,
      });
      return;
    }
    if (pathname.endsWith("/matchup/hit-reports/") && request.method() === "GET") {
      await fulfillJson(route, {
        reports: [report],
        summary: { total: 1, submitted: 1, drafts: 0, avg_hit_rate: 80, total_hit: 8, total_exam: 10 },
      });
      return;
    }
    if (pathname.endsWith("/landing-public/matchup-showcase/publish/") && request.method() === "POST") {
      publishCalls += 1;
      expect(request.postDataJSON()).toEqual({ hit_report_id: 101, title: report.document_title });
      published = true;
      await fulfillJson(route, card, 201);
      return;
    }
    if (pathname.endsWith("/landing-public/matchup-showcase/") && request.method() === "GET") {
      showcaseListCalls += 1;
      // Keep every initial read failed regardless of dev-only remounts. The test
      // opens the mock boundary only immediately before the explicit retry.
      if (!showcaseStatusAvailable) {
        await fulfillJson(route, { detail: "temporary unavailable" }, 503);
        return;
      }
      await fulfillJson(route, { count: published ? 1 : 0, results: published ? [card] : [] });
      return;
    }
    if (pathname.includes("/hit-report-toggle/")) {
      legacyToggleCalls += 1;
      await fulfillJson(route, {});
      return;
    }
    await fulfillJson(route, { count: 0, results: [] });
  };
  await page.route("**/api/v1/**", handleApi);
  await page.context().route("**/api/v1/**", handleApi);

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}/workspace/storage/hit-reports`, { waitUntil: "domcontentloaded", timeout: 120_000 });

  await expect(page.getByRole("heading", { name: /적중 보고서/ })).toBeVisible();
  const action = page.getByTestId("hit-report-showcase-action");
  await expect(page.getByRole("alert")).toContainText("자료실 공개 상태를 확인하지 못했습니다");
  await expect(action).toBeDisabled();
  expect(publishCalls).toBe(0);

  const failedListCalls = showcaseListCalls;
  showcaseStatusAvailable = true;
  await page.getByRole("button", { name: "자료실 상태 다시 확인" }).click();
  await expect.poll(() => showcaseListCalls).toBeGreaterThan(failedListCalls);
  await expect(action).toContainText("자료실 게시");
  await expect(action).toBeEnabled();
  await expect(action).toHaveAttribute("data-showcase-on", "false");
  await action.click();

  await expect.poll(() => publishCalls).toBe(1);
  await expect(action).toContainText("자료실 게시됨");
  await expect(action).toHaveAttribute("data-showcase-on", "true");
  await expect(page.getByTestId("hit-report-board-preview-strip")).toContainText("1건 게시 중");
  expect(legacyToggleCalls).toBe(0);

  const mobilePage = await page.context().newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(`${BASE}/workspace/storage/hit-reports`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const mobileAction = mobilePage.getByTestId("hit-report-showcase-action");
  await expect(mobileAction).toBeVisible();
  await expect(mobileAction).toBeEnabled();
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await mobilePage.close();

  await action.click();
  await expect(page).toHaveURL(/\/landing\/matchup-board\?manage=1$/);
  expect(publishCalls).toBe(1);
  expect(legacyToggleCalls).toBe(0);
});
