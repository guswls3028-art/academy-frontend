import type { Page, Route } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("access", "x.eyJleHAiOjQxMDI0NDQ4MDB9.y");
    localStorage.setItem("refresh", "e2e-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  });
}

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const fulfill = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (path === "/core/program/") {
      return fulfill({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return fulfill({
        id: 1,
        username: "e2e-admin",
        name: "E2E 관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/lectures/lectures/") {
      return fulfill({
        results: [{
          id: 21,
          tenant: 1,
          title: "접근성 강의",
          name: "접근성 강의",
          subject: "MATH",
          is_active: true,
          is_system: false,
          created_at: "2026-07-20T09:00:00+09:00",
          updated_at: "2026-07-20T09:00:00+09:00",
        }],
      });
    }
    if (path === "/lectures/sessions/") {
      return fulfill({
        results: [{
          id: 31,
          lecture: 21,
          order: 1,
          title: "1차시",
          display_label: "1차시",
          created_at: "2026-07-20T09:00:00+09:00",
          updated_at: "2026-07-20T09:00:00+09:00",
        }],
      });
    }
    if (path === "/media/videos/public-session/") {
      return fulfill({ session_id: 99, lecture_id: 98 });
    }
    if (path === "/media/videos/folders/") {
      return fulfill([]);
    }
    if (path === "/media/videos/" && url.searchParams.get("session") === "31") {
      return fulfill({
        results: [{
          id: 301,
          session_id: 31,
          title: "접근성 영상",
          source_type: "youtube",
          file_key: "",
          duration: 125,
          order: 1,
          status: "READY",
          allow_skip: true,
          max_speed: 2,
          show_watermark: false,
          hls_path: null,
          created_at: "2026-07-20T09:00:00+09:00",
          updated_at: "2026-07-20T09:00:00+09:00",
          view_count: 12,
        }],
      });
    }
    return fulfill({ count: 0, results: [] });
  });
}

test("영상 추가와 상세 카드가 실제 버튼이며 키보드로 상세 화면을 연다", async ({ page }) => {
  await seedAuth(page);
  await mockApi(page);

  await page.goto(`${BASE}/admin/videos/tree`, { waitUntil: "domcontentloaded" });

  const addButton = page.locator('button[title="영상 추가"]');
  await expect(addButton).toHaveCount(1);
  await expect(addButton).toBeVisible();

  const detailButton = page.getByRole("button", { name: "접근성 영상 상세 보기" });
  await expect(detailButton).toHaveCount(1);
  await expect(detailButton).toBeVisible();
  await detailButton.focus();
  await expect(detailButton).toBeFocused();
  await detailButton.press("Enter");

  await expect(page).toHaveURL(/videoId=301/);
  await expect(page).toHaveURL(/lectureId=21/);
  await expect(page).toHaveURL(/sessionId=31/);
});
