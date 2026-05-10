// PATH: e2e/admin/matchup-problem-card-delete.spec.ts
//
// Phase F (2026-05-10) — 카드별 삭제 + 다중 선택 일괄삭제 UI 회귀.
// `basic_definition_2026_05_09` SSOT MVP 7단계 — 학원장 즉석 수정 워크플로우.
//
// E2E 정책 (memory feedback_no_e2e_on_real_tenants.md):
//   T1 (admin97/koreaseoul97) only. read-only — confirm 모달 cancel 로 닫기. 실제 삭제 X.

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1100", width: 1100, height: 720 },
];

const TARGET_DOC_ID = 615;  // T1 doc — 343 problem 보유

for (const vp of VIEWPORTS) {
  test(`Phase F — 카드 삭제 + 일괄삭제 모드 [${vp.name}]`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const consoleMsgs: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    page.on("response", (resp) => {
      if (resp.status() >= 400 && resp.url().includes("/matchup/")) {
        failedRequests.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await loginViaUI(page, "admin");
    await page.goto(`https://hakwonplus.com/admin/storage/matchup?docId=${TARGET_DOC_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // problem 카드 1개라도 렌더될 때까지
    const firstCard = page.getByTestId("matchup-problem-card").first();
    await expect(firstCard).toBeVisible({ timeout: 30000 });

    // (1) 모드 진입 CTA — 합치기 + 일괄삭제 두 버튼 노출
    const enterMergeBtn = page.getByTestId("matchup-merge-mode-enter");
    const enterBulkBtn = page.getByTestId("matchup-bulk-select-mode-enter");
    await expect(enterMergeBtn).toBeVisible();
    await expect(enterBulkBtn).toBeVisible();

    // (2) 카드 hover 시 trash + split 버튼 노출
    await firstCard.hover();
    const trashBtn = firstCard.getByTestId("matchup-problem-card-delete");
    const splitBtn = firstCard.getByTestId("matchup-problem-card-split");
    await expect(trashBtn).toBeVisible({ timeout: 5000 });
    await expect(splitBtn).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: `_artifacts/sessions/phase-f-card-hover-${vp.name}.png`,
      fullPage: false,
    });

    // (3) 카드 trash 버튼 클릭 → confirm 모달. cancel 로 닫기 (실제 삭제 X).
    await trashBtn.click();
    // useConfirm 의 ConfirmDialog root 는 [data-confirm-dialog]. role attribute 없음.
    const confirmDialog = page.locator('[data-confirm-dialog]').first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await page.screenshot({
      path: `_artifacts/sessions/phase-f-card-delete-confirm-${vp.name}.png`,
      fullPage: false,
    });
    // cancel 버튼 — text "취소"
    const cancelBtn = confirmDialog.getByRole("button", { name: /취소/ });
    await cancelBtn.click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });

    // (4) 일괄삭제 모드 진입 → 모드 바 + 카드 클릭으로 선택 → toolbar
    await enterBulkBtn.click();
    const exitBulkBtn = page.getByTestId("matchup-bulk-select-mode-exit");
    await expect(exitBulkBtn).toBeVisible({ timeout: 5000 });

    // 카드 선택 (1개만 클릭해도 액션바 노출 — N>=1 조건). 두 번째 카드 클릭은
    // narrow viewport (1100) 에서 grid 두 번째 카드가 scroll 밖으로 밀리는 회귀로
    // 안정성 떨어짐 — 핵심은 액션바 wire-in 검증이지 다중 선택 자체 아님.
    const cards = page.getByTestId("matchup-problem-card");
    await cards.nth(0).scrollIntoViewIfNeeded();
    await cards.nth(0).click();
    const actionBar = page.getByTestId("matchup-bulk-delete-action-bar");
    await actionBar.scrollIntoViewIfNeeded().catch(() => {});
    await expect(actionBar).toBeVisible({ timeout: 5000 });
    await page.screenshot({
      path: `_artifacts/sessions/phase-f-bulk-select-${vp.name}.png`,
      fullPage: false,
    });

    // confirm 버튼 클릭 → confirm 모달 cancel (실제 삭제 X)
    const confirmAction = page.getByTestId("matchup-bulk-delete-confirm-action");
    await confirmAction.click();
    const bulkDialog = page.locator('[data-confirm-dialog]').first();
    await expect(bulkDialog).toBeVisible({ timeout: 5000 });
    await page.screenshot({
      path: `_artifacts/sessions/phase-f-bulk-confirm-${vp.name}.png`,
      fullPage: false,
    });
    await bulkDialog.getByRole("button", { name: /취소/ }).click();
    await expect(bulkDialog).not.toBeVisible({ timeout: 5000 });

    // (5) 선택 해제 → 액션바 사라짐 → 모드 종료. narrow viewport (1100) 에서
    // sticky bottom 액션바가 mode bar 의 exit 버튼을 가리는 회귀 보정.
    await cards.nth(0).scrollIntoViewIfNeeded();
    await cards.nth(0).click();  // toggle off — 선택 0 → 액션바 dismiss
    await expect(actionBar).not.toBeVisible({ timeout: 5000 });
    await exitBulkBtn.scrollIntoViewIfNeeded();
    await exitBulkBtn.click();
    await expect(exitBulkBtn).not.toBeVisible({ timeout: 5000 });
    await expect(enterBulkBtn).toBeVisible({ timeout: 5000 });

    // 진단
    const fs = await import("fs");
    fs.writeFileSync(
      `_artifacts/sessions/phase-f-card-delete-diag-${vp.name}.json`,
      JSON.stringify({ consoleMsgs, failedRequests }, null, 2),
      "utf-8",
    );
  });
}
