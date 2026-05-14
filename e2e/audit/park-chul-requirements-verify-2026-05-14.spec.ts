// PATH: e2e/audit/park-chul-requirements-verify-2026-05-14.spec.ts
// 박철T 학원장(Tenant 2 tchul.com) 14 요청 production 실 검증.
//
// "매치업 올리고 싶어용 / 외부 공개 링크 / 사이드바 수정하기 / PC PDF 업로드 /
// 헤더 라우트 / 학원소개·가이드 / read-only preview / matchup hover 시각" 등
// 본 세션 cycle 누적 작업이 실제로 박철T 환경에서 보이는지 캡처.
/* eslint-disable no-restricted-syntax */

import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth.ts";

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";

test.describe.configure({ mode: "serial" });

test("박철T 요청 — Tenant 2 public landing 확인 (비로그인)", async ({ page }) => {
  await page.goto(`${TCHUL}/landing`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_artifacts/pc-1-tchul-landing.png", fullPage: true });

  // 헤더 메뉴 — 학원소개 / 매치업 / 커뮤니티 / 가이드 항목
  const headerText = (await page.locator("nav, header").first().textContent({ timeout: 5000 }).catch(() => "")) ?? "";
  console.log("헤더 텍스트:", headerText.slice(0, 200));

  // 매치업 게시판 link 검증
  const matchupNav = page.locator('a[href*="/landing/matchup-board"], a:has-text("매치업")');
  const matchupNavCount = await matchupNav.count();
  console.log("매치업 nav link count:", matchupNavCount);

  // 학원소개 / 가이드 dedicated route 진입 가능 확인
  await page.goto(`${TCHUL}/landing/about`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "_artifacts/pc-2-about.png", fullPage: true });
  const aboutHas = (await page.content()).includes("학원");
  console.log("about page loaded:", aboutHas);

  await page.goto(`${TCHUL}/landing/guide`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "_artifacts/pc-3-guide.png", fullPage: true });

  // 매치업 게시판 public list
  await page.goto(`${TCHUL}/landing/matchup-board`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "_artifacts/pc-4-matchup-board-public.png", fullPage: true });
});

test("박철T 요청 — tchul-admin 로그인 후 사이드바 수정하기 + 매치업 admin", async ({ page }) => {
  await loginViaUI(page, "tchul-admin");
  await page.goto(`${TCHUL}/landing`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_artifacts/pc-5-tchul-landing-owner.png", fullPage: true });

  // 사이드바 햄버거 button 클릭 → "수정하기 (학원장)" 카테고리 노출 확인
  const hamburger = page.locator("button[aria-label*='메뉴'], button:has-text('☰'), button.hamburger").first();
  const hbVisible = await hamburger.isVisible({ timeout: 3000 }).catch(() => false);
  if (hbVisible) {
    await hamburger.click();
    await page.waitForTimeout(700);
  } else {
    // mobile menu 또는 다른 button (햄버거 icon)
    const altHb = page.locator('button[aria-label="메뉴 열기"], button.landing-hamburger, button[aria-label="Open menu"]').first();
    if (await altHb.isVisible({ timeout: 2000 }).catch(() => false)) {
      await altHb.click();
      await page.waitForTimeout(700);
    }
  }
  await page.screenshot({ path: "_artifacts/pc-6-tchul-sidebar.png", fullPage: true });

  // "수정하기" 텍스트 존재 확인
  const hasEditCategory = await page.getByText(/수정하기/).first().isVisible({ timeout: 3000 }).catch(() => false);
  console.log("'수정하기' 카테고리 visible:", hasEditCategory);

  // /landing/admin/matchup-board 직접 진입 — 학원장 admin 페이지
  await page.goto(`${TCHUL}/landing/admin/matchup-board`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "_artifacts/pc-7-tchul-admin-matchup.png", fullPage: true });
  const adminHeader = await page.locator("h1").first().textContent({ timeout: 5000 }).catch(() => "");
  console.log("admin header:", adminHeader);
  expect(adminHeader).toContain("매치업 적중보고서 게시판");

  // 박철T tchul tenant 의 매치업 admin row 개수
  const rows = page.locator('[data-testid^="matchup-showcase-row-"]');
  const rowCount = await rows.count();
  console.log("tchul matchup admin rows:", rowCount);
});

test("박철T 요청 — 매치업 콘솔 (선생앱) row click → read-only preview + 수정", async ({ page }) => {
  await loginViaUI(page, "tchul-admin");
  await page.goto(`${TCHUL}/admin/storage/hit-reports`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "_artifacts/pc-8-hit-reports-list.png", fullPage: true });

  // 헤더 "+ PDF 업로드 게시" + "게시판 관리" 버튼 (owner only)
  const uploadBtn = page.getByRole("button", { name: /\+ PDF 업로드 게시|PDF 업로드|업로드 게시/ }).first();
  const adminLink = page.getByRole("link", { name: /게시판 관리|매치업 게시판/ }).first();
  const uploadBtnVisible = await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false);
  const adminLinkVisible = await adminLink.isVisible({ timeout: 3000 }).catch(() => false);
  console.log("owner upload btn:", uploadBtnVisible, "admin link:", adminLinkVisible);

  // 첫 row click → read-only preview modal (수정 누르면 편집기)
  const firstRow = page.locator("tbody tr, [data-testid^='hit-report-row']").first();
  if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "_artifacts/pc-9-preview-modal.png", fullPage: true });
    // "수정 →" 버튼 존재
    const editBtn = page.getByRole("button", { name: /수정/ }).first();
    const editVisible = await editBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log("preview '수정' button visible:", editVisible);
  } else {
    console.log("⚠ hit-report row 없음 — 박철T tchul 환경 데이터 fetch 실패 또는 빈 상태");
  }
});
