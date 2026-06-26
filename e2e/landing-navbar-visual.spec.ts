/**
 * Landing NavBar Visual Validation (2026-05-11)
 *
 * nexon dnfm 스타일 hamburger nav 재설계 검증.
 * Target: public landing production tenant.
 *
 * 실행: npx playwright test e2e/landing-navbar-visual.spec.ts
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { getBaseUrl, loginViaUI } from "./helpers/auth";

const BASE = getBaseUrl("tchul-admin");
const SS = "e2e/screenshots";

async function loginAdmin(page: Page) {
  await loginViaUI(page, "tchul-admin");
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1: 비로그인 /landing → hamburger + side panel
// ─────────────────────────────────────────────────────────────────────────────
test("1. 비로그인 /landing — hamburger + side panel", async ({ page }) => {
  // 완전 새 컨텍스트: 아무 인증 정보 없는 상태에서 /landing 직접 진입.
  // TCHUL 공개 랜딩 도메인이므로 SPA가 tenant를 도메인에서 자동 해석한다.
  await page.goto(`${BASE}/landing`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // 로그인 페이지로 리디렉트됐는지 확인
  const url = page.url();
  if (url.includes("/login")) {
    console.log(`  [DIAGNOSE] Redirected to login: ${url} — landing API returned has_landing:false for this context`);
    await page.screenshot({ path: `${SS}/1_REDIRECTED_TO_LOGIN.png` });
    throw new Error(`FAIL: /landing redirected to login. Tenant landing not accessible. URL: ${url}`);
  }

  await page.screenshot({ path: `${SS}/1a_landing_unauthenticated.png` });
  console.log(`  Page URL after goto: ${url}`);

  // 1a. Hamburger button visible
  const burger = page.locator("[data-testid=landing-nav-burger]");
  await expect(burger).toBeVisible({ timeout: 10_000 });
  console.log("[PASS] 1a: hamburger button [data-testid=landing-nav-burger] visible");

  // 1b. Login button visible (비로그인 상태 → 로그인 버튼만, 역할 메뉴 없음)
  const loginBtn = page.locator("[data-testid=landing-nav-login]");
  await expect(loginBtn).toBeVisible({ timeout: 5_000 });
  console.log("[PASS] 1b: login button [data-testid=landing-nav-login] visible");

  // 1c. Side panel closed by default
  const sidePanel = page.locator('[role=dialog][aria-label="전체 메뉴"]');
  await expect(sidePanel).not.toBeVisible();
  console.log("[PASS] 1c: side panel not visible by default");

  // 1d. Hamburger click → side panel slides in
  await burger.click();
  await expect(sidePanel).toBeVisible({ timeout: 5_000 });
  console.log("[PASS] 1d: side panel visible after hamburger click");

  // 1e. Panel geometry: left-side drawer ≤ 380px
  const box = await sidePanel.boundingBox();
  console.log(`  Panel bounding box: ${JSON.stringify(box)}`);
  if (box) {
    expect(box.x).toBeLessThanOrEqual(10);
    expect(box.width).toBeLessThanOrEqual(390);
    console.log(`[PASS] 1e: panel x=${box.x}px, width=${box.width}px (left-side drawer)`);
  }

  await page.screenshot({ path: `${SS}/1b_landing_side_panel_open.png` });

  // 1f. Category headers
  const catEls = sidePanel.locator("div").filter({ hasText: /^(매치업|학원소개|커뮤니티|가이드|서비스센터)$/ });
  const cats = await catEls.allTextContents();
  console.log(`  Category headers: ${JSON.stringify(cats)}`);
  expect(cats).toContain("커뮤니티");
  console.log("[PASS] 1f: 커뮤니티 category header present");

  // 1g. Community items × 4
  for (const [key, label] of [
    ["board", "자유게시판"],
    ["qna", "질문게시판"],
    ["notice", "공지사항"],
    ["materials", "자료실"],
  ] as const) {
    const el = sidePanel.locator(`[data-testid=landing-nav-item-community-${key}]`);
    await expect(el).toBeVisible({ timeout: 5_000 });
    console.log(`[PASS] 1g: "${label}" community item visible`);
  }

  // 1h. Footer: CTA + 이미 회원이신가요 로그인
  const footerCta = sidePanel.locator("a").filter({ hasText: /수강|상담|문의/ }).first();
  const ctaV = await footerCta.isVisible().catch(() => false);
  console.log(`[${ctaV ? "PASS" : "WARN"}] 1h: footer CTA visible=${ctaV}`);

  const footerLogin = sidePanel.locator("a, span").filter({ hasText: /이미 회원이신가요/ }).first();
  const loginV = await footerLogin.isVisible().catch(() => false);
  console.log(`[${loginV ? "PASS" : "WARN"}] 1h-2: footer '이미 회원이신가요? 로그인' visible=${loginV}`);

  // 1i. ESC closes panel
  await page.keyboard.press("Escape");
  await expect(sidePanel).not.toBeVisible({ timeout: 5_000 });
  console.log("[PASS] 1i: ESC closes side panel");

  await page.screenshot({ path: `${SS}/1c_landing_panel_closed_esc.png` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2: 로그인 후 nav myconsole + LandingRoleFab
// ─────────────────────────────────────────────────────────────────────────────
test("2. 로그인 — nav myconsole + LandingRoleFab", async ({ page }) => {
  await loginAdmin(page);
  // fab 닫힘 상태 보장
  await page.evaluate(() => { localStorage.setItem("landing-fab-open", "0"); });

  await page.goto(`${BASE}/landing`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const url = page.url();
  if (url.includes("/login")) {
    await page.screenshot({ path: `${SS}/2_REDIRECTED_TO_LOGIN.png` });
    throw new Error(`FAIL: /landing redirected to login after auth. URL: ${url}`);
  }

  await page.screenshot({ path: `${SS}/2a_landing_loggedin.png` });

  // 2a. myconsole link visible
  const myconsole = page.locator("[data-testid=landing-nav-myconsole]");
  await expect(myconsole).toBeVisible({ timeout: 10_000 });
  const roleLabel = await myconsole.textContent();
  console.log(`[PASS] 2a: myconsole visible — "${roleLabel?.trim()}"`);

  // 2b. LandingRoleFab toggle visible
  const fabToggle = page.locator("[data-testid=landing-role-fab-toggle]");
  await expect(fabToggle).toBeVisible({ timeout: 10_000 });
  console.log("[PASS] 2b: LandingRoleFab toggle visible");

  // 2c. Click fab → expand
  await fabToggle.click();
  await expect(page.locator("[data-testid=landing-fab-admin-console]")).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: `${SS}/2b_landing_fab_open.png` });

  // 2d. Owner actions
  for (const [testid, label] of [
    ["landing-fab-landing-edit", "홈페이지 꾸미기"],
    ["landing-fab-matchup-console", "매치업 보고서"],
    ["landing-fab-admin-console", "관리실로"],
  ] as const) {
    const el = page.locator(`[data-testid=${testid}]`);
    const v = await el.isVisible().catch(() => false);
    console.log(`[${v ? "PASS" : "FAIL"}] 2d: fab action "${label}" visible=${v}`);
    expect(v, `fab action "${label}" should be visible`).toBe(true);
  }

  // 2e. 외부인 시점으로 보기 button
  const previewBtn = page.locator("button").filter({ hasText: /외부인 시점/ });
  const previewV = await previewBtn.isVisible().catch(() => false);
  console.log(`[${previewV ? "PASS" : "FAIL"}] 2e: "외부인 시점으로 보기" visible=${previewV}`);
  expect(previewV).toBe(true);

  // 2f. 매치업 보고서 → /admin/storage/hit-reports
  const matchupLink = page.locator("[data-testid=landing-fab-matchup-console]");
  await matchupLink.click();
  await page.waitForURL(/\/admin\/storage\/hit-reports/, { timeout: 15_000 });
  console.log(`[PASS] 2f: navigated to ${page.url()}`);
  await page.screenshot({ path: `${SS}/2c_after_matchup_nav.png` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3: /landing/reports — 동일 NavBar + LandingRoleFab
// ─────────────────────────────────────────────────────────────────────────────
test("3. /landing/reports — 동일 NavBar + LandingRoleFab", async ({ page }) => {
  await loginAdmin(page);

  await page.goto(`${BASE}/landing/reports`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const url = page.url();
  if (url.includes("/login")) {
    await page.screenshot({ path: `${SS}/3_REDIRECTED.png` });
    throw new Error(`FAIL: /landing/reports redirected. URL: ${url}`);
  }

  // 3a. Hamburger visible on reports page
  const burger = page.locator("[data-testid=landing-nav-burger]");
  await expect(burger).toBeVisible({ timeout: 10_000 });
  console.log("[PASS] 3a: hamburger visible on /landing/reports");

  // 3b. Click → side panel with categories
  await burger.click();
  const sidePanel = page.locator('[role=dialog][aria-label="전체 메뉴"]');
  await expect(sidePanel).toBeVisible({ timeout: 5_000 });

  const cats = await sidePanel.locator("div").filter({ hasText: /^(매치업|학원소개|커뮤니티|가이드|서비스센터)$/ }).allTextContents();
  console.log(`  Reports page categories: ${JSON.stringify(cats)}`);
  expect(cats).toContain("커뮤니티");
  console.log("[PASS] 3b: side panel with categories on /landing/reports");

  await page.screenshot({ path: `${SS}/3a_reports_nav_panel.png` });
  await page.keyboard.press("Escape");
  await expect(sidePanel).not.toBeVisible({ timeout: 5_000 });

  // 3c. LandingRoleFab visible
  const fabToggle = page.locator("[data-testid=landing-role-fab-toggle]");
  await expect(fabToggle).toBeVisible({ timeout: 10_000 });
  console.log("[PASS] 3c: LandingRoleFab visible on /landing/reports");

  await page.screenshot({ path: `${SS}/3b_reports_fab.png` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4: Cross-page hash scroll /landing/reports → /landing#section
// ─────────────────────────────────────────────────────────────────────────────
test("4. Cross-page hash scroll /landing/reports → /landing#section", async ({ page }) => {
  await loginAdmin(page);

  await page.goto(`${BASE}/landing/reports`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const burger = page.locator("[data-testid=landing-nav-burger]");
  await burger.click();

  const sidePanel = page.locator('[role=dialog][aria-label="전체 메뉴"]');
  await expect(sidePanel).toBeVisible({ timeout: 5_000 });

  // section 타입 nav item 찾기 (features / instructor_profile / programs / faq / contact 등)
  const sectionSelectors = [
    { target: "features", selector: "[data-testid=landing-nav-item-about-features]" },
    { target: "instructor_profile", selector: "[data-testid=landing-nav-item-about-instructor_profile]" },
    { target: "programs", selector: "[data-testid=landing-nav-item-about-programs]" },
    { target: "process_timeline", selector: "[data-testid=landing-nav-item-about-process_timeline]" },
    { target: "management_system", selector: "[data-testid=landing-nav-item-about-management_system]" },
    { target: "faq", selector: "[data-testid=landing-nav-item-guide-faq]" },
    { target: "contact", selector: "[data-testid=landing-nav-item-service-contact]" },
    { target: "testimonials", selector: "[data-testid=landing-nav-item-service-testimonials]" },
  ];

  let clickedLabel: string | null = null;
  let clickedTarget: string | null = null;
  for (const { target, selector } of sectionSelectors) {
    const el = sidePanel.locator(selector);
    if (await el.isVisible().catch(() => false)) {
      clickedLabel = (await el.textContent())?.trim() ?? selector;
      clickedTarget = target;
      console.log(`  4: clicking section item "${clickedLabel}" (${selector})`);
      await el.click();
      break;
    }
  }

  if (!clickedLabel) {
    // 학원소개 섹션 없는 tenant → community route로 fallback
    console.log("  [INFO] 4: No 학원소개/가이드 sections enabled, testing community route nav");
    const boardBtn = sidePanel.locator("[data-testid=landing-nav-item-community-board]");
    if (await boardBtn.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/landing/board", { timeout: 10_000 }),
        boardBtn.click(),
      ]);
      const afterUrl = page.url();
      console.log(`  [PASS fallback] 4: community board nav from reports → ${afterUrl}`);
      await page.screenshot({ path: `${SS}/4a_cross_page_community.png` });
    }
    return;
  }

  // 섹션 클릭 → /landing 으로 이동 + 해당 section scroll
  await page.waitForURL((url) => url.pathname === "/landing", { timeout: 10_000 });
  const afterUrl = page.url();
  await page.waitForFunction(
    (target) => {
      const section = document.querySelector(`section[data-stype="${target}"]`);
      if (!section) return false;
      const rect = section.getBoundingClientRect();
      return window.scrollY > 0 || (rect.top >= 0 && rect.top < window.innerHeight);
    },
    clickedTarget,
    { timeout: 5_000 },
  );
  const scrollY = await page.evaluate(() => window.scrollY);
  console.log(`[PASS] 4: navigated to ${afterUrl}, scrollY=${scrollY} (section "${clickedLabel}")`);
  expect(afterUrl).toContain("/landing");

  await page.screenshot({ path: `${SS}/4a_cross_page_hash_scroll.png` });
});
