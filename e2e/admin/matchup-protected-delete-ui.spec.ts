/**
 * Matchup protected delete UI regression.
 *
 * Mock-route only: verifies manual/manual_owner_pinned problems are shown as
 * protected in bulk-select and range-delete flows without touching real data.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Route } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const DOC_ID = 990101;

const documentPayload = {
  id: DOC_ID,
  title: "[E2E] protected delete UI",
  category: "[E2E]",
  subject: "수학",
  grade_level: "고1",
  original_name: "protected-delete.pdf",
  size_bytes: 1024,
  content_type: "application/pdf",
  status: "done",
  ai_job_id: "",
  problem_count: 3,
  error_message: "",
  inventory_file_id: 1,
  created_at: "2026-06-21T00:00:00Z",
  updated_at: "2026-06-21T00:00:00Z",
  meta: {
    source_type: "academy_workbook",
    upload_intent: "academy_workbook",
    indexable: true,
    paper_type_summary: { primary: "clean_pdf_dual", distribution: { clean_pdf_dual: 1 } },
  },
};

const problemsPayload = [
  {
    id: 991001,
    document_id: DOC_ID,
    number: 1,
    text: "자동분리 문항",
    image_key: "",
    meta: {},
    created_at: "2026-06-21T00:00:00Z",
  },
  {
    id: 991002,
    document_id: DOC_ID,
    number: 2,
    text: "직접 자른 문항",
    image_key: "",
    meta: { manual: true },
    created_at: "2026-06-21T00:00:00Z",
  },
  {
    id: 991003,
    document_id: DOC_ID,
    number: 3,
    text: "보고서 선별 문항",
    image_key: "",
    meta: { manual_owner_pinned: true },
    created_at: "2026-06-21T00:00:00Z",
  },
];

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("access", "e2e-access");
    localStorage.setItem("refresh", "e2e-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  });
}

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const fulfillJson = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (path === "/core/program/") {
      return fulfillJson({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return fulfillJson({
        id: 1,
        username: "e2e-admin",
        name: "E2E Admin",
        phone: null,
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/matchup/documents/" && req.method() === "GET") {
      return fulfillJson([documentPayload]);
    }
    if (path === "/matchup/problems/" && req.method() === "GET") {
      return fulfillJson(problemsPayload);
    }
    if (/^\/matchup\/problems\/\d+\/similar\/$/.test(path)) {
      return fulfillJson({ results: [] });
    }
    if (path === `/matchup/documents/${DOC_ID}/hit-report-draft/`) {
      return fulfillJson({
        report: {
          id: 1,
          document_id: DOC_ID,
          document_title: documentPayload.title,
          document_category: documentPayload.category,
          author_id: 1,
          author_name: "E2E Admin",
          title: "draft",
          summary: "",
          status: "draft",
          submitted_at: null,
          submitted_by_name: "E2E Admin",
          entries: [],
          created_at: "2026-06-21T00:00:00Z",
          updated_at: "2026-06-21T00:00:00Z",
        },
        entries: [],
      });
    }
    if (path === `/matchup/documents/${DOC_ID}/bulk-delete-problems/` && req.method() === "POST") {
      return fulfillJson({
        deleted: 1,
        ids: [991001],
        preserved_manual: 2,
        preserved_protected: 2,
      });
    }
    if (path === "/matchup/categories/") {
      return fulfillJson([]);
    }
    if (path === "/matchup/hit-reports/board-preview/") {
      return fulfillJson({ reports: [], total_published: 0 });
    }
    if (path === "/results/admin/clinic-targets/") {
      return fulfillJson([]);
    }
    return fulfillJson({});
  });
}

test.describe("matchup protected delete UI", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(`${BASE}/admin/storage/matchup?docId=${DOC_ID}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("matchup-problem-card")).toHaveCount(3);
  });

  test("bulk-select disables deletion when only protected problems are selected", async ({ page }) => {
    await page.getByTestId("matchup-bulk-select-mode-enter").click();
    await page.getByTestId("matchup-problem-card").nth(1).click();
    await page.getByTestId("matchup-problem-card").nth(2).click();

    await expect(page.getByTestId("matchup-bulk-delete-protected-hint")).toContainText("보호 문항 2개 제외");
    const confirmButton = page.getByTestId("matchup-bulk-delete-confirm-action");
    await expect(confirmButton).toContainText("0개 삭제");
    await expect(confirmButton).toBeDisabled();
  });

  test("range delete preview excludes manual and owner-pinned problems", async ({ page }) => {
    await page.getByTestId("matchup-doc-more-menu-trigger").click();
    await page.getByTestId("matchup-doc-bulk-delete-menu-item").click();
    await page.getByTestId("matchup-bulk-delete-input").fill("1-3");

    const preview = page.getByTestId("matchup-bulk-delete-preview");
    await expect(preview).toContainText("1개 삭제 예정");
    await expect(preview).toContainText("보호 문항 2개는 삭제에서 제외됩니다");
  });
});
