import type { Page, Route } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

const manualIndexProposal = {
  id: 701,
  document_id: 91,
  page_number: 2,
  detected_problem_number: 4,
  status: "pending",
  ui_status_label: "검수 대기",
  bbox: null,
  image_key: "",
  confidence_label: "medium",
  conflict_type: null,
  user_message: null,
  can_approve: true,
  can_reject: true,
  promoted_problem_id: null,
  reviewed_at: null,
  created_at: "2026-07-20T09:00:00+09:00",
  proposal_kind: "manual_index",
  target_problem_id: 8801,
  proposed_text: "[E2E] 이차방정식의 두 근을 구하시오.",
  proposed_format: "essay",
};

const segmentationProposal = {
  ...manualIndexProposal,
  id: 702,
  proposal_kind: "segmentation",
  target_problem_id: null,
  proposed_text: null,
  proposed_format: null,
  detected_problem_number: 12,
};

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
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const fulfill = (body: unknown) => route.fulfill({
      status: 200,
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
        phone: null,
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/matchup/proposals/" && request.method() === "GET") {
      return fulfill({ proposals: [manualIndexProposal, segmentationProposal], total: 2, limit: 50, offset: 0 });
    }
    return fulfill({ count: 0, results: [] });
  });
}

test("manual_index 제안은 대상 문항·OCR 텍스트·형식을 표시하고 기존 분리 UI를 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await seedAuth(page);
  await mockApi(page);

  await page.goto(`${BASE}/admin/storage/proposals`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "AI 제안 검수" })).toBeVisible();
  const rows = page.getByTestId("proposal-review-row");
  await expect(rows).toHaveCount(2);

  const manualRow = rows.filter({ hasText: "문항 #8801" });
  await expect(manualRow.getByText("직접 자른 문항 OCR")).toBeVisible();
  await expect(manualRow.getByText("제안 형식 · essay")).toBeVisible();
  await expect(manualRow.getByText("[E2E] 이차방정식의 두 근을 구하시오.")).toBeVisible();
  await expect(manualRow.getByTestId("proposal-approve-button")).toBeEnabled();
  await expect(manualRow.getByTestId("proposal-reject-button")).toBeEnabled();

  const segmentationRow = rows.filter({ hasText: "Q12" });
  await expect(segmentationRow).toBeVisible();
  await expect(segmentationRow.getByTestId("proposal-approve-button")).toBeEnabled();
  await expect(segmentationRow.getByTestId("proposal-reject-button")).toBeEnabled();
});
