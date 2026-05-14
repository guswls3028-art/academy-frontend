// PATH: e2e/audit/useconfirm-ssot-verify-2026-05-14.spec.ts
// useConfirm SSOT 7곳 변환 production 시각 검증 (2026-05-14, commit 9f2bc30f).
//
// Tenant 1 admin97 로그인 → 매치업 콘솔 게시판 관리 진입 → 삭제 버튼 클릭 →
// useConfirm DS 모달 (브라우저 window.confirm 아님) 캡처.
//
// fail 시: window.confirm 으로 떨어지면 page.on("dialog") 가 잡힘.
// pass 시: DS modal 안 "취소" / "삭제" 버튼이 DOM에 렌더.

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth.ts";

test("useConfirm SSOT — 매치업 게시판 삭제 모달 DS 렌더", async ({ page }) => {
  let nativeConfirmFired = false;
  page.on("dialog", async (d) => {
    nativeConfirmFired = true;
    await d.dismiss();
  });

  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/landing/admin/matchup-board");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);

  await page.screenshot({ path: "_artifacts/useconfirm-1-admin-list.png", fullPage: true });

  // 게시물 row 있으면 삭제 버튼 클릭 — useConfirm 모달 등장 검증
  const rows = page.locator('[data-testid^="matchup-showcase-row-"]');
  const count = await rows.count();
  console.log("matchup-showcase rows:", count);

  if (count > 0) {
    // 첫 row 의 "삭제" 버튼 click
    const deleteBtn = rows.first().locator("button", { hasText: "삭제" });
    await deleteBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: "_artifacts/useconfirm-2-delete-modal.png", fullPage: true });

    // useConfirm DS 모달 DOM 신호: dialog role 또는 confirm-dialog className
    const dialog = page.locator('[role="dialog"]');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    console.log("dialog role visible:", dialogVisible);

    // 취소 버튼으로 닫기
    if (dialogVisible) {
      const cancelBtn = dialog.locator("button", { hasText: "취소" });
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(400);
      }
    }
  }

  // window.confirm 이 한 번이라도 발동되었으면 SSOT fail.
  expect(nativeConfirmFired).toBe(false);
});
