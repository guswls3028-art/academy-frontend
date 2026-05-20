/**
 * tchul read-only 시각 캡처 — 데이터 변경 절대 금지.
 * 처리중 doc 클릭 + 스크린샷만. CRUD/INSERT/UPDATE/DELETE 0.
 *
 * Tenant 1에는 처리중 doc 0건이라 P0-1 disabled / P0-2 단계 / P3 skeleton 시각 검증 불가.
 * tchul에는 항상 처리중 doc이 있어 read-only 캡처로 보충.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const BASE = getBaseUrl("tchul-admin");
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-visual-review-2026-04-30");
fs.mkdirSync(SHOTS, { recursive: true });

async function waitForMatchupReady(page: Page): Promise<void> {
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-doc-row']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-upload-button']").count()) > 0,
    { timeoutMs: 10_000, description: "tchul matchup page ready" },
  ).catch(() => {});
}

async function waitForProcessingDetail(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-doc-hit-report-btn']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-problem-card']").count()) > 0 ||
      (await page.getByText(/처리 중|분석 중|단계|체크/).count()) > 0,
    { timeoutMs: 10_000, description: "processing document detail settled" },
  ).catch(() => {});
}

test("VR-TCHUL. read-only 처리중 doc 시각 캡처", async ({ page }) => {
  test.setTimeout(60_000);
  await loginViaUI(page, "tchul-admin");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
  await waitForMatchupReady(page);

  // 처리중 chip 클릭 → 처리중 doc 목록만 표시
  const procChip = page.locator("button, label").filter({ hasText: /처리중\s*\d+/ }).first();
  if (await procChip.count() === 0) {
    test.skip(true, "처리중 doc 없음");
    return;
  }
  await procChip.click();
  await waitForMatchupReady(page);

  const row = page.locator("[data-testid='matchup-doc-row']").first();
  if (await row.count() === 0) {
    test.skip(true, "처리중 row 없음");
    return;
  }
  await row.click();
  await waitForProcessingDetail(page);

  // 1. 처리중 doc 디테일 풀샷 — 단계 체크리스트 + 스피너 + 액션 버튼들
  await page.screenshot({
    path: path.join(SHOTS, "tchul-vr1-processing-full.png"),
    fullPage: false,
  });

  // 2. 액션 버튼 헤더 (자동 적중 PDF disabled 회색 확인)
  await page.screenshot({
    path: path.join(SHOTS, "tchul-vr2-actions-header.png"),
    clip: { x: 750, y: 180, width: 850, height: 80 },
  });

  // 3. 단계 체크리스트 + 스피너
  await page.screenshot({
    path: path.join(SHOTS, "tchul-vr3-stage-checklist.png"),
    clip: { x: 730, y: 260, width: 500, height: 500 },
  });

  // 4. PDF 버튼 hover로 tooltip 노출
  const pdfBtn = page.locator("[data-testid='matchup-doc-hit-report-btn']");
  if (await pdfBtn.count() > 0) {
    const box = await pdfBtn.boundingBox();
    if (box) {
      await pdfBtn.hover();
      await expect(page.locator("[role='tooltip']").first()).toBeVisible({ timeout: 3000 }).catch(() => {});
      await page.screenshot({
        path: path.join(SHOTS, "tchul-vr4-pdf-tooltip.png"),
        clip: {
          x: Math.max(0, box.x - 50),
          y: Math.max(0, box.y - 10),
          width: 400,
          height: 80,
        },
      });
    }
  }

  // 5. processing 상태에서 problems가 있다면 ("처리 중" 뱃지)
  const problemCard = page.locator("[data-testid='matchup-problem-card']").first();
  if (await problemCard.count() > 0) {
    await problemCard.scrollIntoViewIfNeeded();
    const box = await problemCard.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(SHOTS, "tchul-vr5-skeleton-card.png"),
        clip: {
          x: Math.max(0, box.x - 10),
          y: Math.max(0, box.y - 10),
          width: Math.min(400, box.width + 20),
          height: box.height + 20,
        },
      });
    }
  }
});
