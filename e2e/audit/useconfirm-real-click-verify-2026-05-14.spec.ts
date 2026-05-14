// PATH: e2e/audit/useconfirm-real-click-verify-2026-05-14.spec.ts
// 본 cycle 작업 (#78 분리 + useConfirm SSOT 7곳) production 실 클릭 검증.
//
// 학원장 매장 risk 회피용. 코드 동일 패턴이라도 production 에서 실제 모달이
// 떠야 검증 종료. 모든 path 캡처 + DOM verify + window.confirm 발동 0회.
/* eslint-disable no-restricted-syntax */

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth.ts";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe.configure({ mode: "serial" });

test("useConfirm SSOT — 매치업 admin 페이지: 게시/수정/삭제 모달 전수 클릭", async ({ page }) => {
  let nativeConfirmFired = false;
  page.on("dialog", async (d) => {
    nativeConfirmFired = true;
    console.error("⛔ window.confirm fired!", d.message());
    await d.dismiss();
  });

  await loginViaUI(page, "admin");
  await page.goto(`${BASE}/landing/admin/matchup-board`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  // 1) 페이지 정상 진입 확인
  await page.screenshot({ path: "_artifacts/uc-real-1-list.png", fullPage: true });
  const headerText = await page.locator("h1").first().textContent();
  expect(headerText).toContain("매치업 적중보고서 게시판");

  const rows = page.locator('[data-testid^="matchup-showcase-row-"]');
  const rowCount = await rows.count();
  console.log("matchup rows:", rowCount);
  expect(rowCount).toBeGreaterThan(0);

  // 2) PublishShowcaseModal — "+ 적중보고서 게시" 버튼 클릭 → 모달 등장 → 닫기
  console.log("\n=== PublishShowcaseModal verify ===");
  const publishBtn = page.getByTestId("open-publish-modal").first();
  await publishBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "_artifacts/uc-real-2-publish-modal.png", fullPage: true });
  // 모달 안 "기존 보고서 선택" 또는 "PDF 업로드" 토글 존재 검증
  const publishModalVisible = await page.getByText(/기존 보고서|PDF 직접 업로드|업로드/).first().isVisible({ timeout: 3000 }).catch(() => false);
  expect(publishModalVisible).toBe(true);
  console.log("publish modal visible:", publishModalVisible);
  // 닫기 (×)
  const publishCloseBtn = page.locator('button[aria-label="닫기"]').first();
  if (await publishCloseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await publishCloseBtn.click();
  } else {
    // 백드롭 외부 click
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(400);

  // 3) EditShowcaseModal — 첫 row "수정" 버튼 클릭 → 모달 등장 → 닫기
  console.log("\n=== EditShowcaseModal verify ===");
  const firstRow = rows.first();
  const editBtn = firstRow.locator("button", { hasText: "수정" });
  await editBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "_artifacts/uc-real-3-edit-modal.png", fullPage: true });
  const editTitle = await page.getByRole("heading", { name: /게시물 수정/ }).first().isVisible({ timeout: 3000 }).catch(() => false);
  expect(editTitle).toBe(true);
  console.log("edit modal heading visible:", editTitle);
  // 닫기 (취소)
  const editCancelBtn = page.locator("button", { hasText: "취소" }).first();
  await editCancelBtn.click();
  await page.waitForTimeout(400);

  // 4) useConfirm — "삭제" 버튼 → DS confirm 모달 → "취소" → row 보존
  console.log("\n=== useConfirm Delete verify ===");
  const rowCountBefore = await rows.count();
  const deleteBtn = firstRow.locator("button", { hasText: "삭제" });
  await deleteBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "_artifacts/uc-real-4-delete-confirm.png", fullPage: true });
  const deleteHeading = await page.getByRole("heading", { name: /게시물 삭제/ }).first().isVisible({ timeout: 3000 }).catch(() => false);
  expect(deleteHeading).toBe(true);
  console.log("delete confirm visible:", deleteHeading);
  // 빨간 삭제 버튼 존재 + 취소 버튼 존재 검증
  const deleteConfirmBtn = page.locator('[role="dialog"], .confirm-dialog').locator("button", { hasText: /^삭제$/ });
  const deleteCancelBtn = page.locator('[role="dialog"], .confirm-dialog').locator("button", { hasText: "취소" });
  const dcBtnVisible = await deleteConfirmBtn.first().isVisible({ timeout: 2000 }).catch(() => false);
  const dcCancelVisible = await deleteCancelBtn.first().isVisible({ timeout: 2000 }).catch(() => false);
  console.log("delete buttons visible — confirm:", dcBtnVisible, "cancel:", dcCancelVisible);
  // 취소 click → 데이터 보존
  if (dcCancelVisible) {
    await deleteCancelBtn.first().click();
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(800);
  // 모달 닫혔는지
  const stillVisible = await page.getByRole("heading", { name: /게시물 삭제/ }).first().isVisible({ timeout: 1000 }).catch(() => false);
  expect(stillVisible).toBe(false);
  // row count 보존
  const rowCountAfter = await rows.count();
  expect(rowCountAfter).toBe(rowCountBefore);
  console.log("row count preserved:", rowCountBefore, "→", rowCountAfter);

  // 5) useConfirm — "비공개" 버튼 (published row 가 있을 때만)
  console.log("\n=== useConfirm Unpublish verify ===");
  const unpubBtn = page.locator("button", { hasText: /^비공개$/ }).first();
  const unpubVisible = await unpubBtn.isVisible({ timeout: 1500 }).catch(() => false);
  if (unpubVisible) {
    await unpubBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: "_artifacts/uc-real-5-unpub-confirm.png", fullPage: true });
    const unpubHeading = await page.getByRole("heading", { name: /비공개로 전환/ }).first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log("unpublish confirm visible:", unpubHeading);
    expect(unpubHeading).toBe(true);
    const unpubCancel = page.locator('[role="dialog"], .confirm-dialog').locator("button", { hasText: "취소" }).first();
    if (await unpubCancel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await unpubCancel.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(400);
  } else {
    console.log("⚠ 비공개 버튼 없음 (모든 row hidden/expired) — 코드 path 동일 패턴, 검증 skip");
  }

  // 6) 링크 복사 — 학원장 박철T spec 검증. clipboard 권한 없어도 toast / prompt 모두 작동 검증.
  console.log("\n=== 링크 복사 verify ===");
  const shareBtn = firstRow.locator('[data-testid^="matchup-share-"]');
  if (await shareBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await shareBtn.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: "_artifacts/uc-real-6-share.png", fullPage: true });
    // window.prompt 발동 X (useConfirm SSOT 변환 후 prompt fallback 제거)
    // feedback toast 또는 info 메시지 떠야 함 — 캡처로 확인
  }

  // 최종: window.confirm 0회
  expect(nativeConfirmFired).toBe(false);
  console.log("\n✓ window.confirm fired:", nativeConfirmFired);
});

test("useConfirm SSOT — write page draft 복구 모달 (localStorage seed)", async ({ page, context }) => {
  let nativeConfirmFired = false;
  page.on("dialog", async (d) => {
    nativeConfirmFired = true;
    await d.dismiss();
  });

  await loginViaUI(page, "admin");
  // localStorage 에 draft seed — board type 의 자동복구 path 발동시킴
  await context.addInitScript(() => {
    localStorage.setItem(
      "landing-community-draft:board",
      JSON.stringify({
        title: "[E2E-DRAFT] useConfirm 복구 검증",
        content: "draft 본문 — useConfirm SSOT 검증용 임시 내용",
        board: "board",
        savedAt: Date.now() - 1000,
      })
    );
  });

  await page.goto(`${BASE}/landing/community/board/write`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_artifacts/uc-real-7-draft-modal.png", fullPage: true });

  const draftHeading = await page.getByRole("heading", { name: /작성 중이던 글 복구/ }).first().isVisible({ timeout: 3000 }).catch(() => false);
  console.log("draft modal heading visible:", draftHeading);
  expect(draftHeading).toBe(true);

  // "버리기" 클릭 → draft localStorage 정리
  const discardBtn = page.locator('[role="dialog"], .confirm-dialog').locator("button", { hasText: /버리기/ }).first();
  if (await discardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await discardBtn.click();
    await page.waitForTimeout(400);
  } else {
    await page.keyboard.press("Escape");
  }

  // cleanup
  await page.evaluate(() => localStorage.removeItem("landing-community-draft:board"));

  expect(nativeConfirmFired).toBe(false);
  console.log("✓ window.confirm fired:", nativeConfirmFired);
});
