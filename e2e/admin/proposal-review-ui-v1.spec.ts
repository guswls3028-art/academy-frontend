/**
 * Stage 6.3A-FE — Proposal Review UI v1 smoke.
 *
 * 검증 범위 (사용자 directive):
 *  - Proposal list 렌더 (또는 빈 상태 카피)
 *  - 내부 필드(engine / model_version / paper_type / analysis_version_key /
 *    raw_response / tenant_id) 미노출
 *  - can_approve=false → 승인 버튼 disabled
 *  - number_conflict / manual_overlap 메시지 표시
 *  - bbox 수정 / merge / split / batch approve UI 부재
 *
 * 백엔드 응답을 route mock 으로 주입 — Tenant 1 의 실데이터를 변경하지 않음.
 */
import { test, expect, type Route } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

const SAMPLE_PROPOSALS = [
  {
    id: 9001,
    document_id: 321,
    page_number: 2,
    detected_problem_number: 5,
    status: "pending",
    ui_status_label: "🟡 검수 대기",
    bbox: { x: 0.1, y: 0.2, w: 0.4, h: 0.3 },
    image_key: "",
    confidence_label: "high",
    conflict_type: null,
    user_message: null,
    can_approve: true,
    can_reject: true,
    promoted_problem_id: null,
    reviewed_at: null,
    created_at: "2026-05-07T03:00:00Z",
  },
  {
    id: 9002,
    document_id: 321,
    page_number: 3,
    detected_problem_number: 7,
    status: "needs_review",
    ui_status_label: "⚠️ 검수 필수",
    bbox: { x: 0.1, y: 0.5, w: 0.4, h: 0.3 },
    image_key: "",
    confidence_label: "low",
    conflict_type: "number_conflict",
    user_message: "번호 충돌 — 번호 수정 또는 거절이 필요합니다",
    can_approve: false,
    can_reject: true,
    promoted_problem_id: null,
    reviewed_at: null,
    created_at: "2026-05-07T03:01:00Z",
  },
  {
    id: 9003,
    document_id: 321,
    page_number: 4,
    detected_problem_number: 11,
    status: "needs_review",
    ui_status_label: "⚠️ 검수 필수",
    bbox: { x: 0.2, y: 0.1, w: 0.3, h: 0.2 },
    image_key: "",
    confidence_label: "medium",
    conflict_type: "manual_overlap",
    user_message: "기존 수동 문항과 겹쳐 자동 승인할 수 없습니다",
    can_approve: false,
    can_reject: true,
    promoted_problem_id: null,
    reviewed_at: null,
    created_at: "2026-05-07T03:02:00Z",
  },
];

async function mockProposalRoutes(page: import("@playwright/test").Page) {
  await page.route(`${API_BASE}/api/v1/matchup/proposals/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    // POST /api/v1/matchup/proposals/<id>/approve|reject — 단순 echo 갱신
    const m = url.pathname.match(/\/proposals\/(\d+)\/(approve|reject)\/?$/);
    if (m && method === "POST") {
      const id = Number(m[1]);
      const action = m[2];
      const target = SAMPLE_PROPOSALS.find((p) => p.id === id);
      if (!target) {
        await route.fulfill({ status: 404, body: JSON.stringify({ detail: "not found" }) });
        return;
      }
      const updated = {
        ...target,
        status: action === "approve" ? "approved" : "rejected",
        ui_status_label: action === "approve" ? "🟢 승인 완료" : "🔴 거절",
        can_approve: false,
        can_reject: false,
        promoted_problem_id: action === "approve" ? 555 : null,
        reviewed_at: "2026-05-07T03:10:00Z",
      };
      const body = action === "approve"
        ? { proposal: updated, promoted_problem_id: 555 }
        : { proposal: updated };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      return;
    }

    // GET /api/v1/matchup/proposals/ — list
    if (method === "GET" && /\/proposals\/?$/.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          proposals: SAMPLE_PROPOSALS,
          total: SAMPLE_PROPOSALS.length,
          limit: 50,
          offset: 0,
        }),
      });
      return;
    }

    await route.continue();
  });
}

test.describe("Proposal Review UI v1", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await mockProposalRoutes(page);
  });

  test("리스트가 렌더되고 내부 raw 필드가 노출되지 않는다", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/proposals`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("proposal-review-page")).toBeVisible({ timeout: 10000 });

    const rows = page.getByTestId("proposal-review-row");
    await expect(rows).toHaveCount(3);

    // 사용자 노출 카피
    await expect(page.getByText("자동 분리 검수")).toBeVisible();
    await expect(page.getByText("Q5", { exact: false })).toBeVisible();
    await expect(page.getByText("page 2", { exact: false })).toBeVisible();

    // 절대 노출 금지 키워드
    const html = await page.content();
    for (const forbidden of [
      "model_version",
      "analysis_version_key",
      "raw_response",
      "tenant_id",
      "reviewed_by_id",
      "engine\":",
      "paper_type",
    ]) {
      expect(html, `forbidden raw key '${forbidden}' rendered to user`).not.toContain(forbidden);
    }
  });

  test("can_approve=false 행은 승인 버튼이 disabled 상태로 표시된다", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/proposals`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("proposal-review-page")).toBeVisible({ timeout: 10000 });

    const conflictRow = page.locator(
      "[data-testid='proposal-review-row'][data-conflict-type='number_conflict']",
    );
    await expect(conflictRow).toHaveCount(1);
    await expect(conflictRow.getByTestId("proposal-approve-button")).toBeDisabled();
    // 거절은 가능
    await expect(conflictRow.getByTestId("proposal-reject-button")).toBeEnabled();
  });

  test("number_conflict / manual_overlap 메시지가 사용자 친화적으로 표시된다", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/proposals`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("proposal-review-page")).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator("[data-testid='proposal-user-message'][data-conflict-type='number_conflict']"),
    ).toContainText("번호 충돌");
    await expect(
      page.locator("[data-testid='proposal-user-message'][data-conflict-type='manual_overlap']"),
    ).toContainText("기존 수동 문항과 겹쳐");
  });

  test("범위 외 UI(bbox 수정 / merge / split / batch approve)가 존재하지 않는다", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/proposals`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("proposal-review-page")).toBeVisible({ timeout: 10000 });

    // v1 스코프 외 UI testid 부재 검증
    for (const forbidden of [
      "proposal-bbox-editor",
      "proposal-number-editor",
      "proposal-merge-button",
      "proposal-split-button",
      "proposal-batch-approve",
      "proposal-bulk-action",
    ]) {
      await expect(page.getByTestId(forbidden)).toHaveCount(0);
    }
  });
});
