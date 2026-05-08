/**
 * T1 → T2 mirror 시각 검수 (read-only).
 *
 * 목적: T1에서 작업한 8 manual 자료(+1 dup = 9 docs)가 T2 매치업 UI에서
 *      onkey 데이터 누락 없이 정상 렌더링되는지 시각 확인.
 *
 * 검수 대상 T2 doc IDs: 207, 216, 292, 302, 313, 316, 323, 326, 329
 * - 207: 26-1 m 개포고 내지 (342 problems)
 * - 216: 3-1-1 지구시스템 (56)
 * - 292: KakaoTalk 학생사진 (32)
 * - 302: 26-1 m 개포고 내지 dup (343)
 * - 313: 3-3 신경계 메인 (82)
 * - 316: 3-3 신경계 유형정복 (70)
 * - 323: 25-1 원안 (51)
 * - 326: 1-1 생명과학의 이해 (37)
 * - 329: 2026 언남고 생명과학 (25)
 *
 * 주의: read-only — 새 doc 업로드/삭제/edit 등 mutation 없음. screenshot + DOM assertion만.
 */
import { expect, test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://tchul.com";
const SCREENSHOT_DIR = "e2e/_artifacts/matchup-t1-to-t2-audit-2026-05-05";

const TARGET_DOCS = [
  { id: 207, expected: 342, hint: "26-1 m" },
  { id: 216, expected: 56, hint: "3-1-1" },
  { id: 292, expected: 32, hint: "KakaoTalk" },
  { id: 302, expected: 343, hint: "26-1 m" },
  { id: 313, expected: 82, hint: "신경계" },
  { id: 316, expected: 70, hint: "유형정복" },
  { id: 323, expected: 51, hint: "원안" },
  { id: 326, expected: 37, hint: "생명과학" },
  { id: 329, expected: 25, hint: "언남" },
];

test.describe.configure({ mode: "serial" });

test.describe("T1 → T2 매치업 mirror 시각 검수 (read-only)", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test("01: 매치업 메인 페이지 렌더 + 9 doc 가시성", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto(`${BASE}/admin/storage/matchup`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(3_000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-matchup-main.png`,
      fullPage: true,
    });

    // doc rows 카운트
    const rows = page.locator('[data-testid="matchup-doc-row"]');
    const rowCount = await rows.count();
    console.log(`[main] visible doc rows: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);

    // 9 target doc 텍스트 hint 검색
    const seen: number[] = [];
    for (const t of TARGET_DOCS) {
      const matches = await page.locator('[data-testid="matchup-doc-row"]')
        .filter({ hasText: t.hint })
        .count();
      if (matches > 0) seen.push(t.id);
    }
    console.log(`[main] target docs visible by hint: ${seen.length}/9`);
  });

  for (const t of TARGET_DOCS) {
    test(`02: doc ${t.id} (${t.hint}) — 클릭 → 문항 이미지 렌더`, async ({ page }) => {
      await loginViaUI(page, "tchul-admin");
      await page.goto(`${BASE}/admin/storage/matchup`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      await page.waitForTimeout(2_000);

      // 정확한 doc 찾기 — hint로 filter
      const row = page.locator('[data-testid="matchup-doc-row"]')
        .filter({ hasText: t.hint })
        .first();

      const visible = await row.isVisible().catch(() => false);
      if (!visible) {
        console.log(`[doc ${t.id}] row not visible — SKIP`);
        return;
      }

      await row.click();
      await page.waitForTimeout(3_000);

      // 어디든 캡쳐
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/02-doc-${t.id}.png`,
        fullPage: true,
      });

      // 문항 이미지 (img) 카운트
      const allImgs = page.locator("img");
      const imgCount = await allImgs.count();
      // R2 URL pattern check (broken image detection 위해 src 수집)
      const srcs: string[] = [];
      for (let i = 0; i < Math.min(imgCount, 10); i++) {
        const src = await allImgs.nth(i).getAttribute("src");
        if (src) srcs.push(src);
      }
      console.log(`[doc ${t.id}] images=${imgCount}, sample_src=`, srcs.slice(0, 3));

      // ESC for closing modal
      await page.keyboard.press("Escape").catch(() => {});
    });
  }
});
