// PATH: e2e/_local/admin/matchup-manual-crop-fullsave-prod.spec.ts
// 시험지 직접 자르기 풀 사이클 검증 (운영 hakwonplus.com).
//
// 검증 흐름:
//   1) 매치업 페이지 진입 → 시험지 doc 선택 → "직접 자르기" 버튼 클릭
//   2) ManualCropModal 노출 + 페이지 썸네일/캔버스 로드
//   3) 캔버스에 마우스 드래그로 박스 그리기
//   4) draft 인스펙터 노출 + 번호 입력
//   5) "저장" 버튼 클릭 → 토스트 + 모달 내 problem 목록에 추가
//   6) 모달 안에서 추가된 problem 삭제 (cleanup)
//
// 이전 spec (matchup-manual-crop-prod.spec.ts)은 모달 진입 + 박스 그리기까지만.
// 이 spec은 저장 + 백엔드 반영 + cleanup 풀 사이클.
//
// 주의: prod DB에 problem이 추가됨 → 반드시 삭제로 cleanup. 실패 시 수동 정리.

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const TEST_NUMBER = 988; // 일반적인 시험지 문항 번호 범위 밖 — 충돌 회피

test("시험지 직접 자르기 풀 사이클 — 박스 그리기 + 저장 + cleanup", async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaUI(page, "admin");
  await page.goto("https://hakwonplus.com/admin/storage/matchup", { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // E2E-CLEAN 시험지 doc 선택
  const testRow = page.locator('[data-testid="matchup-doc-row"]').filter({ hasText: "E2E-CLEAN" }).first();
  await expect(testRow).toBeVisible({ timeout: 15_000 });
  await testRow.click();
  await page.waitForTimeout(2000);
  console.log("✓ 시험지 doc 선택");

  // "직접 자르기" 버튼 클릭
  const cropBtn = page.locator('[data-testid="matchup-doc-manual-crop-btn"]');
  await expect(cropBtn).toBeVisible({ timeout: 10_000 });
  await cropBtn.click();
  console.log("✓ 직접 자르기 버튼 클릭");

  // 모달 노출 확인
  const modal = page.locator('[data-testid="matchup-manual-crop-modal"]');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  console.log("✓ ManualCropModal 노출");

  // 페이지 썸네일 + 캔버스 로드 대기
  const thumbs = page.locator('[data-testid="matchup-crop-page-thumb"]');
  await expect(thumbs.first()).toBeVisible({ timeout: 15_000 });
  console.log(`✓ 페이지 썸네일 ${await thumbs.count()}개 노출`);

  // 캔버스 노출 + 이미지 로드 대기
  const canvas = page.locator('[data-testid="matchup-crop-canvas"]');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500); // 캔버스 이미지 렌더 대기
  console.log("✓ 캔버스 + 페이지 이미지 로드");

  // 캔버스 위에 마우스 드래그 (30%~70%, 30%~60% 영역)
  const cb = await canvas.boundingBox();
  expect(cb).not.toBeNull();
  if (cb) {
    await page.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(cb.x + cb.width * 0.7, cb.y + cb.height * 0.6, { steps: 12 });
    await page.mouse.up();
  }
  await page.waitForTimeout(400);
  console.log("✓ 캔버스 마우스 드래그");

  // draft 박스 노출 + 8방향 핸들
  const draft = page.locator('[data-testid="matchup-crop-draft"]');
  await expect(draft).toBeVisible({ timeout: 5_000 });
  console.log("✓ draft 박스 노출");

  // 인스펙터 번호 입력 (TEST_NUMBER로 변경)
  const numberInput = page.locator('[data-testid="matchup-crop-number-input"]');
  await expect(numberInput).toBeVisible({ timeout: 5_000 });
  await numberInput.fill(String(TEST_NUMBER));
  console.log(`✓ 번호 입력 ${TEST_NUMBER}`);

  // 저장 버튼 클릭
  const saveBtn = page.locator('[data-testid="matchup-crop-save-btn"]');
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  console.log("✓ 저장 버튼 클릭");

  // 저장 완료 — 토스트 또는 problem 목록에 추가 확인
  // problem row가 모달의 "이 페이지" 목록에 등장
  const newRow = page.locator('[data-testid="matchup-crop-problem-row"]').filter({
    hasText: `${TEST_NUMBER}번`,
  });
  await expect(newRow).toBeVisible({ timeout: 15_000 });
  console.log(`✓ ${TEST_NUMBER}번 problem 모달 목록 등장`);

  // "수동" 라벨 확인 — meta.manual=true 표시
  await expect(newRow).toContainText(/수동/);
  console.log("✓ 수동 라벨 노출");

  await page.screenshot({
    path: "e2e/_local/screenshots/manual-crop-fullsave-after-save.png",
    fullPage: false,
  });

  // ── cleanup: 추가한 problem 삭제 ──
  const deleteBtn = newRow.locator("button").last();
  await deleteBtn.click();

  // 확인 다이얼로그 — "삭제" 버튼 클릭
  const confirmDeleteBtn = page.locator('button:has-text("삭제")').last();
  await expect(confirmDeleteBtn).toBeVisible({ timeout: 5_000 });
  await confirmDeleteBtn.click();
  await expect(newRow).not.toBeVisible({ timeout: 10_000 });
  console.log(`✓ ${TEST_NUMBER}번 problem cleanup 완료`);

  // ESC로 모달 닫기
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible({ timeout: 5_000 });
  console.log("✓ 모달 닫기");
});
