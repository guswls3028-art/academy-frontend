/**
 * 매치업 패치 시각 리뷰 — Tenant 1
 *
 * 사용자가 직접 보는 화면 그대로 캡처 + 검증.
 * 패치 항목별로 분리된 PNG로 저장 → AI가 시각적으로 확인.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = getBaseUrl("admin");
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-visual-review-2026-04-30");
fs.mkdirSync(SHOTS, { recursive: true });

test.describe.configure({ mode: "serial" });

test.describe("매치업 시각 리뷰", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("V1. 좌측 트리 — 글로벌 카운트 + 검색", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // 좌측 패널 캡처 (left tree only)
    const leftPanel = page.locator("aside, [class*='treeNav'], [class*='matchup-tree']").first();
    await page.screenshot({ path: path.join(SHOTS, "v1a-landing-full.png"), fullPage: false });

    // 좌측 트리 줌 — 카운트 칩 + 글로벌 합계 보이도록
    await page.locator("[data-testid='matchup-doc-search']").click().catch(() => null);
    await page.screenshot({
      path: path.join(SHOTS, "v1b-counts-zoom.png"),
      clip: { x: 200, y: 100, width: 380, height: 400 },
    });
  });

  test("V2. 검색 hint — 필터 결과 N건", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const search = page.locator("[data-testid='matchup-doc-search']");
    if (await search.count() > 0) {
      await search.fill("matchup");
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SHOTS, "v2-search-hint.png"),
        clip: { x: 200, y: 100, width: 380, height: 400 },
      });
    }
  });

  test("V3. 행 hover — 휴지통/··· 노출", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const row = page.locator("[data-testid='matchup-doc-row']").first();
    if (await row.count() === 0) {
      test.skip(true, "doc 없음");
      return;
    }
    await row.scrollIntoViewIfNeeded();

    // hover 전
    await page.locator("body").click({ position: { x: 100, y: 50 } });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SHOTS, "v3a-no-hover.png"),
      clip: { x: 200, y: 200, width: 380, height: 100 },
    });

    // hover 후
    await row.hover();
    await page.waitForTimeout(500);  // delay 반영
    await page.screenshot({
      path: path.join(SHOTS, "v3b-hovered.png"),
      clip: { x: 200, y: 200, width: 380, height: 100 },
    });
  });

  test("V4. ··· 메뉴 — 4 항목 (이름/intent/카테고리/삭제)", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const row = page.locator("[data-testid='matchup-doc-row']").first();
    if (await row.count() === 0) { test.skip(true, "doc 없음"); return; }

    await row.hover();
    await page.waitForTimeout(400);
    await row.locator("[data-testid='matchup-doc-row-more']").click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SHOTS, "v4-row-menu.png"), fullPage: false });
  });

  test("V5. 카테고리 변경 sub-popover", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const row = page.locator("[data-testid='matchup-doc-row']").first();
    if (await row.count() === 0) { test.skip(true, "doc 없음"); return; }

    await row.hover();
    await page.waitForTimeout(400);
    await row.locator("[data-testid='matchup-doc-row-more']").click();
    await page.waitForTimeout(400);

    const catBtn = page.locator("[role='menuitem']").filter({ hasText: /카테고리 변경/ }).first();
    await catBtn.click();
    await page.waitForTimeout(700);

    await page.screenshot({ path: path.join(SHOTS, "v5-category-popover.png"), fullPage: false });
  });

  test("V6. 완료 doc 디테일 — 액션 버튼 + 카운트", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // 완료 chip
    const doneChip = page.locator("button, label").filter({ hasText: /완료\s*\d+/ }).first();
    if (await doneChip.count() > 0) {
      await doneChip.click();
      await page.waitForTimeout(800);
    }

    const row = page.locator("[data-testid='matchup-doc-row']").first();
    if (await row.count() === 0) { test.skip(true, "완료 doc 없음"); return; }
    await row.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SHOTS, "v6-done-doc-detail.png"), fullPage: false });
  });

  test("V7. 처리중 doc — PDF disabled + 단계 체크리스트", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const procChip = page.locator("button, label").filter({ hasText: /처리중\s*\d+/ }).first();
    if (await procChip.count() === 0) {
      test.skip(true, "처리중 doc 없음 (Tenant 1 idle)");
      return;
    }
    await procChip.click();
    await page.waitForTimeout(800);

    const row = page.locator("[data-testid='matchup-doc-row']").first();
    if (await row.count() === 0) { test.skip(true, "처리중 doc 없음"); return; }
    await row.click();
    await page.waitForTimeout(2500);

    await page.screenshot({ path: path.join(SHOTS, "v7-processing-doc.png"), fullPage: false });
  });
});
