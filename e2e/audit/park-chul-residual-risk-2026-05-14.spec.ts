// PATH: e2e/audit/park-chul-residual-risk-2026-05-14.spec.ts
// 박철T 학원장 잔존 risk 2건 직접 검증.
// - #6 hit-report row click → preview modal → 수정
// - #7 매치업 카드 hover 시각 (학원장 한 달 호소 지점)
/* eslint-disable no-restricted-syntax */

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth.ts";

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";

test.describe.configure({ mode: "serial" });

test("박철T #6 — hit-report row click → preview modal 캡처", async ({ page }) => {
  await loginViaUI(page, "tchul-admin");
  await page.goto(`${TCHUL}/admin/storage/hit-reports`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "_artifacts/pc-r-1-list.png", fullPage: false });

  // table row 또는 list item — 실제 DOM 구조 dump
  const rowSelectors = [
    "tbody tr",
    "[data-testid^='hit-report-row']",
    "[role='row']:not(:first-child)",
    ".hit-report-card, .report-row, .report-list-item",
    "li[data-id], div[data-report-id]",
  ];
  let foundSel = "";
  for (const sel of rowSelectors) {
    const count = await page.locator(sel).count();
    console.log(`selector "${sel}": ${count}`);
    if (count > 0) { foundSel = sel; break; }
  }

  if (!foundSel) {
    // page DOM dump — row 찾는 hint
    const dump = await page.evaluate(() => {
      const candidates = document.querySelectorAll("[data-id], [data-report-id], tr, [role='row'], [class*='row'], [class*='Row']");
      return Array.from(candidates).slice(0, 5).map((el) => ({
        tag: el.tagName,
        cls: (el.className || "").toString().slice(0, 80),
        text: (el.textContent || "").trim().slice(0, 60),
      }));
    });
    console.log("DOM hint:", JSON.stringify(dump, null, 2));
  } else {
    const firstRow = page.locator(foundSel).first();
    // 본문 cell 클릭 (action buttons 회피)
    const titleCell = firstRow.locator("td, [role='cell']").nth(1);
    const target = (await titleCell.count()) > 0 ? titleCell : firstRow;
    await target.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "_artifacts/pc-r-2-preview-modal.png", fullPage: false });
    // iframe (PDF) 또는 modal heading 확인
    const iframeCount = await page.locator("iframe").count();
    const modalHeadingVisible = await page.getByText(/적중 보고서|미리보기|읽기 전용|Preview/).first().isVisible({ timeout: 2000 }).catch(() => false);
    const editBtn = page.getByRole("button", { name: /수정/ }).first();
    const editVisible = await editBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log("preview modal — iframe:", iframeCount, "heading:", modalHeadingVisible, "edit btn:", editVisible);
  }
});

test("박철T #7 — public landing 매치업 카드 hover 시각 검증", async ({ page }) => {
  await page.goto(`${TCHUL}/landing`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // 매치업 카드/카루셀 위치 찾기 (hero 아래 적중 사례 영역)
  const matchupCards = page.locator('[class*="matchup"], [data-testid*="matchup"], [class*="carousel"] [class*="card"]');
  const cardCount = await matchupCards.count();
  console.log("매치업 카드 count:", cardCount);

  // hero 매치업 카드 (5/11 78%) 직접 capture
  await page.screenshot({ path: "_artifacts/pc-r-3-matchup-default.png", clip: { x: 0, y: 0, width: 1280, height: 700 } });

  // hover trigger
  if (cardCount > 0) {
    await matchupCards.first().hover({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: "_artifacts/pc-r-4-matchup-hover.png", clip: { x: 0, y: 0, width: 1280, height: 700 } });
  } else {
    // hero 자체 hover
    await page.locator("body").hover({ position: { x: 800, y: 350 } });
    await page.waitForTimeout(700);
    await page.screenshot({ path: "_artifacts/pc-r-4-matchup-hover.png", clip: { x: 0, y: 0, width: 1280, height: 700 } });
  }

  // computed style 측정 — visible bounding rect + opacity 등 deformation 검사
  const matchupDiag = await page.evaluate(() => {
    const all = document.querySelectorAll('[class*="matchup"], [class*="MatchupCard"], [class*="hit-report"]');
    return Array.from(all).slice(0, 3).map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const cs = window.getComputedStyle(el as HTMLElement);
      return {
        cls: (el.className || "").toString().slice(0, 100),
        rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
        transform: cs.transform,
        opacity: cs.opacity,
        overflow: cs.overflow,
      };
    });
  });
  console.log("matchup diag:", JSON.stringify(matchupDiag, null, 2));
});
