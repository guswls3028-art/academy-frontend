/**
 * 매치업 시각 리뷰 v2 — 명시적 clip 영역으로 중요 부분 확대 캡처
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const BASE = getBaseUrl("admin");
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-visual-review-2026-04-30");
fs.mkdirSync(SHOTS, { recursive: true });

async function waitForMatchupReady(page: Page): Promise<void> {
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-doc-row']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-upload-button']").count()) > 0,
    { timeoutMs: 10_000, description: "matchup page ready" },
  ).catch(() => {});
}

async function waitForDocDetail(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await waitForCondition(
    async () =>
      (await page.locator("[data-testid='matchup-doc-more-menu-trigger']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-intent-toggle']").count()) > 0 ||
      (await page.locator("[data-testid='matchup-problem-card']").count()) > 0,
    { timeoutMs: 10_000, description: "matchup document detail settled" },
  ).catch(() => {});
}

test.describe.configure({ mode: "serial" });

test("VR. 매치업 핵심 화면 핀포인트 캡처", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaUI(page, "admin");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoAndSettle(page, `${BASE}/admin/storage/matchup`, { timeout: 30_000 });
  await waitForMatchupReady(page);

  // 1. 좌측 트리 풀샷 (768x800 area)
  await page.screenshot({
    path: path.join(SHOTS, "vr1-left-tree.png"),
    clip: { x: 280, y: 100, width: 460, height: 750 },
  });

  // 2. row hover — ··· 버튼 표시
  const row = page.locator("[data-testid='matchup-doc-row']").first();
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await row.locator("[data-testid='matchup-doc-row-more']").waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  const rowBox = await row.boundingBox();
  if (rowBox) {
    await page.screenshot({
      path: path.join(SHOTS, "vr2-row-hover.png"),
      clip: {
        x: Math.max(0, rowBox.x - 20),
        y: Math.max(0, rowBox.y - 10),
        width: Math.min(500, rowBox.width + 40),
        height: rowBox.height + 20,
      },
    });
  }

  // 3. ··· 메뉴 열림
  await row.locator("[data-testid='matchup-doc-row-more']").click();
  await expect(page.locator("[role='menuitem']").filter({ hasText: /카테고리 변경/ }).first()).toBeVisible({ timeout: 5000 });
  // 메뉴 popover 캡처 — fixed positioned, 캡처 영역 넓게
  await page.screenshot({
    path: path.join(SHOTS, "vr3-row-menu-full.png"),
    clip: { x: 280, y: 250, width: 600, height: 350 },
  });

  // 4. 카테고리 변경 sub-popover (centered modal)
  const catBtn = page.locator("[role='menuitem']").filter({ hasText: /카테고리 변경/ }).first();
  await catBtn.click();
  await expect(page.getByRole("dialog", { name: "카테고리 변경" })).toBeVisible({ timeout: 5000 });
  // 중앙 정렬이라 viewport 중앙 캡처
  await page.screenshot({
    path: path.join(SHOTS, "vr4-category-popover.png"),
    clip: { x: 500, y: 250, width: 600, height: 500 },
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "카테고리 변경" })).toHaveCount(0, { timeout: 3000 });
  await page.keyboard.press("Escape");
  await expect(page.locator("[role='menuitem']").filter({ hasText: /카테고리 변경/ })).toHaveCount(0, { timeout: 3000 });

  // 5. 완료 doc 디테일 — 액션 버튼 헤더
  await row.click();
  await waitForDocDetail(page);
  await page.screenshot({
    path: path.join(SHOTS, "vr5-doc-header.png"),
    clip: { x: 750, y: 180, width: 850, height: 80 },
  });

  // 6. 우측 탭 (유사문제 / 자료별 매치)
  await page.screenshot({
    path: path.join(SHOTS, "vr6-right-tabs.png"),
    clip: { x: 1100, y: 250, width: 500, height: 500 },
  });

  // 7. 처리중 doc 디테일이 있다면 단계 체크리스트 캡처 — Tenant 1 idle이라 skip
});
