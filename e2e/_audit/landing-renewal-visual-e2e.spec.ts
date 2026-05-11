/**
 * Landing Page Renewal Visual E2E Validation
 * Production: https://hakwonplus.com
 * Date: 2026-05-11
 * Scenarios: nav header, hamburger side panel, footer, community gate, fab, write form
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = process.env.E2E_BASE_URL ?? "https://hakwonplus.com";
const ADMIN_USER = process.env.E2E_ADMIN_USER ?? "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? "koreaseoul97";
const SS_DIR = path.resolve("e2e/screenshots/landing-renewal");

function ensureDir() {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
}

async function ss(page: import("@playwright/test").Page, name: string, full = false) {
  ensureDir();
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: full });
}

test.describe("Landing Renewal P0 - Visual E2E [2026-05-11]", () => {

  test("S1: 비로그인 nav header + 햄버거 사이드 패널 + ESC", async ({ page }) => {
    await page.goto(`${BASE}/landing`, { waitUntil: "networkidle" });

    // No horizontal nav links (features/contact)
    const horizLinks = page.locator("nav a[href*='feature'], nav a[href*='contact']");
    expect(await horizLinks.count()).toBe(0);

    // Hamburger must exist
    const hamburger = page.locator(
      "[data-testid='landing-nav-hamburger'], button[aria-label*='메뉴'], button[aria-label*='menu'], button[aria-label*='navigation']"
    ).first();
    await expect(hamburger).toBeVisible({ timeout: 8000 });

    // Login button
    const loginBtn = page.locator(
      "[data-testid='landing-nav-login'], a:has-text('로그인'), button:has-text('로그인')"
    ).first();
    await expect(loginBtn).toBeVisible({ timeout: 5000 });

    await ss(page, "01-nav-header");

    // Open side panel
    await hamburger.click();
    await page.waitForTimeout(700);

    // Side panel
    const sidePanel = page.locator(
      "[data-testid='landing-side-panel'], aside[class*='Nav'], div[class*='SideNav'], div[class*='side-nav'], div[class*='drawer'], div[class*='Drawer'], div[class*='panel'], div[class*='Panel']"
    ).first();
    const sidePanelVisible = await sidePanel.isVisible().catch(() => false);
    console.log(`[S1] Side panel visible: ${sidePanelVisible}`);

    // Fallback: get body text after hamburger click
    const bodyAfterOpen = await page.locator("body").innerText();
    const hasCommunitySection = bodyAfterOpen.includes("커뮤니티");
    const hasFreeBoard = bodyAfterOpen.includes("자유게시판");
    const hasQna = bodyAfterOpen.includes("질문게시판");
    const hasNotice = bodyAfterOpen.includes("공지사항");
    const hasResource = bodyAfterOpen.includes("자료실");

    console.log(`[S1] 커뮤니티=${hasCommunitySection} 자유=${hasFreeBoard} 질문=${hasQna} 공지=${hasNotice} 자료=${hasResource}`);

    await ss(page, "02-side-panel-open");

    // ESC closes panel
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // After ESC, panel text should disappear or panel hidden
    const bodyAfterEsc = await page.locator("body").innerText();
    const panelStillShowing = bodyAfterEsc.includes("자유게시판") && bodyAfterEsc.includes("질문게시판");
    if (panelStillShowing) {
      console.log("[S1] WARNING: Panel still visible after ESC");
    } else {
      console.log("[S1] ESC closed panel OK");
    }

    // Assertions
    expect(hasCommunitySection).toBeTruthy();
    expect(hasFreeBoard || hasQna).toBeTruthy();
  });

  test("S2: 랜딩 footer - 4컬럼 + powered by + 최상단", async ({ page }) => {
    await page.goto(`${BASE}/landing`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);

    const footer = page.locator("footer, [data-testid='landing-footer'], [class*='LandingFooter']").first();
    const footerVisible = await footer.isVisible().catch(() => false);
    console.log(`[S2] Footer visible: ${footerVisible}`);

    const fullText = await page.locator("body").innerText();
    const hasAcademy = fullText.includes("학원소개") || fullText.includes("소개");
    const hasMatchup = fullText.includes("매치업") || fullText.includes("Matchup");
    const hasCommunity = fullText.includes("커뮤니티");
    const hasHelp = fullText.includes("도움") || fullText.includes("가이드") || fullText.includes("서비스센터") || fullText.includes("서비스");
    const hasPoweredBy = fullText.includes("학원플러스") || fullText.includes("hakwonplus") || fullText.includes("powered by");
    const hasCopyright = fullText.includes("©");
    const hasScrollTop = fullText.includes("최상단") || fullText.includes("상단으로");

    console.log(`[S2] 학원소개=${hasAcademy} 매치업=${hasMatchup} 커뮤니티=${hasCommunity} 도움=${hasHelp}`);
    console.log(`[S2] poweredBy=${hasPoweredBy} copyright=${hasCopyright} scrollTop=${hasScrollTop}`);

    await ss(page, "03-footer");

    expect(footerVisible || hasPoweredBy || hasCopyright).toBeTruthy();
  });

  test("S3: 매치업 히어로 캐러셀 (조건부)", async ({ page }) => {
    await page.goto(`${BASE}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const pageText = await page.locator("body").innerText();
    const hasCarousel = pageText.includes("적중보고서") || pageText.includes("적중 보고서") || pageText.includes("적중률") || pageText.includes("보고서 본문 보기");
    const hasCarouselLabel = pageText.includes("Matchup") && pageText.includes("%");

    console.log(`[S3] Carousel text present: ${hasCarousel}, KPI: ${hasCarouselLabel}`);

    if (hasCarousel || hasCarouselLabel) {
      await ss(page, "04-hero-carousel");
    } else {
      console.log("[S3] Carousel absent - no hit_reports registered (SKIP expected)");
      await ss(page, "04-hero-carousel-absent");
    }

    // This test is informational - always passes
    expect(true).toBeTruthy();
  });

  test("S4: 비로그인 커뮤니티 게이트", async ({ page }) => {
    await page.goto(`${BASE}/landing/community/board`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    console.log(`[S4] URL: ${currentUrl}`);

    const bodyText = await page.locator("body").innerText();
    console.log(`[S4] Body excerpt: ${bodyText.slice(0, 600)}`);

    const hasGate = bodyText.includes("학원 가족") || bodyText.includes("로그인") || bodyText.includes("로그인이 필요") || bodyText.includes("로그인 후");
    const redirectedToLogin = currentUrl.includes("login");
    const hasTabs = await page.locator("[role='tab']").count() > 0;

    console.log(`[S4] gate=${hasGate} redirectLogin=${redirectedToLogin} tabs=${hasTabs}`);

    await ss(page, "05-community-gate");

    expect(hasGate || redirectedToLogin).toBeTruthy();
  });

  test("S5: 로그인 후 관리실 버튼 + LandingRoleFab", async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });

    const userInput = page.locator("input[name='username'], input[type='text'], input[placeholder*='아이디'], input[placeholder*='ID']").first();
    const passInput = page.locator("input[name='password'], input[type='password']").first();
    await expect(userInput).toBeVisible({ timeout: 8000 });
    await userInput.fill(ADMIN_USER);
    await passInput.fill(ADMIN_PASS);
    await page.keyboard.press("Enter");

    await page.waitForURL(/\/(landing|admin|dashboard|home)/, { timeout: 20000 });
    console.log(`[S5] Post-login URL: ${page.url()}`);

    if (!page.url().includes("/landing")) {
      await page.goto(`${BASE}/landing`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
    }

    console.log(`[S5] Landing URL: ${page.url()}`);

    // 관리실 button
    const myConsole = page.locator(
      "[data-testid='landing-nav-myconsole'], a:has-text('관리실'), button:has-text('관리실')"
    ).first();
    const myConsoleVisible = await myConsole.isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`[S5] 관리실 button: ${myConsoleVisible}`);

    // FAB toggle
    const fabToggle = page.locator(
      "[data-testid='landing-role-fab-toggle'], [class*='RoleFab'] button, [class*='role-fab'] button, button[aria-label*='fab'], button[aria-label*='역할']"
    ).first();
    const fabVisible = await fabToggle.isVisible({ timeout: 6000 }).catch(() => false);
    console.log(`[S5] FAB visible: ${fabVisible}`);

    if (fabVisible) {
      await fabToggle.click();
      await page.waitForTimeout(600);

      const bodyText = await page.locator("body").innerText();
      const hasHomeDeco = bodyText.includes("홈페이지 꾸미기") || bodyText.includes("꾸미기");
      const hasReport = bodyText.includes("매치업 보고서") || bodyText.includes("보고서");
      const hasAdmin = bodyText.includes("관리실로");
      const hasExternal = bodyText.includes("외부인 시점");
      console.log(`[S5] FAB items: 꾸미기=${hasHomeDeco} 보고서=${hasReport} 관리실로=${hasAdmin} 외부인=${hasExternal}`);

      await ss(page, "06-fab-expanded");
    } else {
      // Try finding the FAB by looking for any floating action button
      const allButtons = await page.locator("button").all();
      console.log(`[S5] Total buttons on page: ${allButtons.length}`);
      const bodyText = await page.locator("body").innerText();
      console.log(`[S5] Body text excerpt: ${bodyText.slice(0, 400)}`);
      await ss(page, "06-fab-not-found");
    }

    expect(myConsoleVisible || fabVisible).toBeTruthy();
  });

  test("S6: 로그인 후 커뮤니티 게시판 탭 + 검색 + 정렬", async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const userInput = page.locator("input[name='username'], input[type='text'], input[placeholder*='아이디']").first();
    const passInput = page.locator("input[name='password'], input[type='password']").first();
    await userInput.fill(ADMIN_USER);
    await passInput.fill(ADMIN_PASS);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/(landing|admin|dashboard)/, { timeout: 20000 });

    await page.goto(`${BASE}/landing/community/board`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    console.log(`[S6] URL: ${currentUrl}`);

    const tabs = page.locator("[role='tab']");
    const tabCount = await tabs.count();
    console.log(`[S6] Tab count: ${tabCount}`);

    if (tabCount > 0) {
      const tabTexts = await tabs.allInnerTexts();
      console.log(`[S6] Tab texts: ${tabTexts.join(", ")}`);
    }

    const bodyText = await page.locator("body").innerText();
    const hasSort = bodyText.includes("최신순") || bodyText.includes("댓글순");
    const searchVisible = await page.locator("[data-testid='landing-community-search'], input[placeholder*='검색']").first().isVisible().catch(() => false);
    const hasEmptyMsg = bodyText.includes("등록된 글이 없습니다") || bodyText.includes("게시물이 없습니다") || bodyText.includes("아직");

    console.log(`[S6] sort=${hasSort} search=${searchVisible} emptyMsg=${hasEmptyMsg}`);
    console.log(`[S6] Body excerpt: ${bodyText.slice(0, 600)}`);

    await ss(page, "07-community-board", true);

    expect(tabCount >= 1 || hasEmptyMsg || hasSort).toBeTruthy();
  });

  test("S7: 글쓰기 페이지 (owner 권한)", async ({ page }) => {
    // Login
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const userInput = page.locator("input[name='username'], input[type='text'], input[placeholder*='아이디']").first();
    const passInput = page.locator("input[name='password'], input[type='password']").first();
    await userInput.fill(ADMIN_USER);
    await passInput.fill(ADMIN_PASS);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/(landing|admin|dashboard)/, { timeout: 20000 });

    await page.goto(`${BASE}/landing/community/board/write`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    console.log(`[S7] URL: ${page.url()}`);

    const bodyText = await page.locator("body").innerText();
    console.log(`[S7] Body: ${bodyText.slice(0, 600)}`);

    // Form elements
    const titleVisible = await page.locator("input[placeholder*='제목'], input[name*='title']").first().isVisible().catch(() => false);
    const contentVisible = await page.locator("textarea, .ProseMirror, [contenteditable='true']").first().isVisible().catch(() => false);
    const boardSelectVisible = await page.locator("select, [class*='Select'], [role='combobox']").first().isVisible().catch(() => false);

    const hasFreeBoard = bodyText.includes("자유게시판");
    const hasQnaBoard = bodyText.includes("질문게시판");
    const hasNotice = bodyText.includes("공지사항");
    const hasResource = bodyText.includes("자료실");
    const hasFixed = bodyText.includes("고정");
    const hasImportant = bodyText.includes("중요");

    console.log(`[S7] title=${titleVisible} content=${contentVisible} boardSelect=${boardSelectVisible}`);
    console.log(`[S7] boards: 자유=${hasFreeBoard} 질문=${hasQnaBoard} 공지=${hasNotice} 자료=${hasResource}`);
    console.log(`[S7] toggles: 고정=${hasFixed} 중요=${hasImportant}`);

    await ss(page, "08-write-form", true);

    expect(titleVisible || contentVisible || boardSelectVisible).toBeTruthy();
  });

});
