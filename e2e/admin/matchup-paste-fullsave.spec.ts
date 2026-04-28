// PATH: e2e/admin/matchup-paste-fullsave.spec.ts
// 시험지 직접 자르기 — Ctrl+V paste 풀 사이클 검증 (운영).
//
// 검증 흐름:
//   1) 매치업 페이지 → 시험지 doc 선택 → "직접 자르기" 모달 진입
//   2) 가짜 image clipboard 만들어 paste 이벤트 dispatch
//   3) paste preview 패널 노출
//   4) 번호 입력 → 저장
//   5) modal problem 목록에 추가 + 수동 라벨
//   6) cleanup (삭제)

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const TEST_NUMBER = 989;

test("Ctrl+V paste 풀 사이클 — 클립보드 이미지 → 저장 + cleanup", async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/storage/matchup", { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const testRow = page.locator('[data-testid="matchup-doc-row"]').filter({ hasText: "E2E-CLEAN" }).first();
  await expect(testRow).toBeVisible({ timeout: 15_000 });
  await testRow.click();
  await page.waitForTimeout(1500);

  const cropBtn = page.locator('[data-testid="matchup-doc-manual-crop-btn"]');
  await cropBtn.click();
  const modal = page.locator('[data-testid="matchup-manual-crop-modal"]');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2000);
  console.log("✓ ManualCropModal 진입");

  // ── 가짜 image clipboard 만들어 paste 이벤트 dispatch ──
  // 간단한 1x1 PNG (base64) 만들고 ClipboardEvent로 발사.
  await page.evaluate(() => {
    // 100x100 빨간 PNG
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 100, 100);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "test.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const event = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    }, "image/png");
  });
  await page.waitForTimeout(800);

  // paste preview 노출
  const preview = page.locator('[data-testid="matchup-paste-preview"]');
  await expect(preview).toBeVisible({ timeout: 5_000 });
  console.log("✓ paste preview 노출");

  // 번호 입력
  const numberInput = page.locator('[data-testid="matchup-paste-number-input"]');
  await numberInput.fill(String(TEST_NUMBER));
  console.log(`✓ 번호 입력 ${TEST_NUMBER}`);

  // 저장
  const saveBtn = page.locator('[data-testid="matchup-paste-save-btn"]');
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  console.log("✓ 저장 버튼 클릭");

  // 저장 결과 확인 — problem 목록에 추가
  const newRow = page.locator('[data-testid="matchup-crop-problem-row"]').filter({
    hasText: `${TEST_NUMBER}번`,
  });
  await expect(newRow).toBeVisible({ timeout: 15_000 });
  console.log(`✓ ${TEST_NUMBER}번 problem 목록 등장`);
  await expect(newRow).toContainText(/수동/);
  console.log("✓ 수동 라벨 노출");

  await page.screenshot({
    path: "e2e/_local/screenshots/manual-paste-fullsave-after-save.png",
    fullPage: false,
  });

  // cleanup
  const deleteBtn = newRow.locator("button").last();
  await deleteBtn.click();
  const confirmBtn = page.locator('button:has-text("삭제")').last();
  await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
  await confirmBtn.click();
  await expect(newRow).not.toBeVisible({ timeout: 10_000 });
  console.log(`✓ ${TEST_NUMBER}번 cleanup 완료`);

  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible({ timeout: 5_000 });
});
