/**
 * 매치업 시각 리뷰 v2 — 명시적 clip 영역으로 중요 부분 확대 캡처
 */
import { test } from "../fixtures/strictTest";
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

test("VR. 매치업 핵심 화면 핀포인트 캡처", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaUI(page, "admin");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // 1. 좌측 트리 풀샷 (768x800 area)
  await page.screenshot({
    path: path.join(SHOTS, "vr1-left-tree.png"),
    clip: { x: 280, y: 100, width: 460, height: 750 },
  });

  // 2. row hover — ··· 버튼 표시
  const row = page.locator("[data-testid='matchup-doc-row']").first();
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await page.waitForTimeout(500);
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
  await page.waitForTimeout(600);
  // 메뉴 popover 캡처 — fixed positioned, 캡처 영역 넓게
  await page.screenshot({
    path: path.join(SHOTS, "vr3-row-menu-full.png"),
    clip: { x: 280, y: 250, width: 600, height: 350 },
  });

  // 4. 카테고리 변경 sub-popover (centered modal)
  const catBtn = page.locator("[role='menuitem']").filter({ hasText: /카테고리 변경/ }).first();
  await catBtn.click();
  await page.waitForTimeout(700);
  // 중앙 정렬이라 viewport 중앙 캡처
  await page.screenshot({
    path: path.join(SHOTS, "vr4-category-popover.png"),
    clip: { x: 500, y: 250, width: 600, height: 500 },
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 5. 완료 doc 디테일 — 액션 버튼 헤더
  await row.click();
  await page.waitForTimeout(2500);
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
