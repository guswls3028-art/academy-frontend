import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";
import path from "path";
import fs from "fs";
import { gotoAndSettle } from "./helpers/wait";

const BASE = process.env.E2E_BASE_URL ?? "https://hakwonplus.com";
const SHOTS = path.resolve("e2e/screenshots/prod-visual-20260512-cycle3");

fs.mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function shotFull(page: Page, name: string) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function waitForNetworkQuiet(page: Page, timeout = 8000): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

async function scrollToPageBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(
    () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 2,
    undefined,
    { timeout: 3000 },
  ).catch(() => {});
  await waitForNetworkQuiet(page, 5000);
}

// ─────────────────────────────────────────────────────────────
// [A] Landing hero + empty section regression
// ─────────────────────────────────────────────────────────────
test("[A] Landing hero + empty section regression", async ({ page }) => {
  await gotoAndSettle(page, `${BASE}/landing`, { timeout: 30000 });

  // Brand chip visible
  const brandChip = page.locator("text=HakwonPlus").first();
  const brandChipVisible = await brandChip.isVisible().catch(() => false);
  console.log("[A] brand chip visible:", brandChipVisible);

  // Hero area screenshot
  await shot(page, "A-01-hero-top");

  // Tagline fallback — check h1 or tagline text
  const h1 = page.locator("h1").first();
  const h1Visible = await h1.isVisible().catch(() => false);
  const h1Text = await h1.textContent().catch(() => "");
  console.log("[A] h1 visible:", h1Visible, "text:", h1Text?.trim().substring(0, 80));

  // Secondary CTA "적중 보고서" or similar
  const secondaryCta = page.locator("a, button").filter({ hasText: /보고서|시작|상담|문의/ }).first();
  const secondaryCtaVisible = await secondaryCta.isVisible().catch(() => false);
  console.log("[A] secondary CTA visible:", secondaryCtaVisible);

  // Brand initial panel "H"
  const brandInitPanel = page.locator("text=H").filter({ hasText: /^H$/ }).first();
  const brandInitVisible = await brandInitPanel.isVisible().catch(() => false);
  console.log("[A] brand initial 'H' visible:", brandInitVisible);

  // "ACADEMY · MANAGEMENT · SAAS" text
  const saasText = page.locator("text=SAAS").first();
  const saasTextVisible = await saasText.isVisible().catch(() => false);
  console.log("[A] ACADEMY·MANAGEMENT·SAAS visible:", saasTextVisible);

  // Scroll down and check for empty sections (header-only sections with 200px blank)
  await scrollToPageBottom(page);
  await shotFull(page, "A-02-landing-full-scroll");

  // Check if any empty sections (only header, no body) are visible
  // These would appear as section title + large empty space
  const allSections = await page.locator("section, [class*='section'], [class*='Section']").all();
  console.log("[A] total sections found:", allSections.length);

  // Check for visibility of sections with very small height (empty body)
  let emptySectionCount = 0;
  for (const section of allSections) {
    const box = await section.boundingBox();
    const isVisible = await section.isVisible();
    if (isVisible && box && box.height < 80 && box.height > 0) {
      const text = await section.textContent().catch(() => "");
      console.log("[A] WARN tiny visible section h=", box.height, "text:", text?.substring(0, 50));
      emptySectionCount++;
    }
  }
  console.log("[A] tiny visible sections (potential empty):", emptySectionCount);

  // Check specific sections by their known titles
  const sectionsToCheck = ["소개", "프로그램", "수업 특징", "자주 묻는 질문"];
  for (const title of sectionsToCheck) {
    const titleEl = page.locator(`text=${title}`).first();
    const isTitleVisible = await titleEl.isVisible().catch(() => false);
    if (isTitleVisible) {
      // If the title is visible, check if there's meaningful content near it
      const titleBox = await titleEl.boundingBox();
      console.log(`[A] Section "${title}" title visible at y=${titleBox?.y?.toFixed(0)}`);
    } else {
      console.log(`[A] Section "${title}" title NOT visible (correctly hidden if empty)`);
    }
  }

  await shot(page, "A-03-after-scroll");
});

// ─────────────────────────────────────────────────────────────
// [B] Hit report console — share chip toast + dashed→solid
// ─────────────────────────────────────────────────────────────
test("[B] Hit report share chip toast + style", async ({ page }) => {
  await loginViaUI(page, "admin");
  await waitForNetworkQuiet(page);

  // Navigate to hit-reports via sidebar
  // Try sidebar navigation first
  const sidebarHitReport = page.locator("a[href*='hit-report'], a[href*='storage']").filter({ hasText: /적중|보고서/ }).first();
  const sidebarVisible = await sidebarHitReport.isVisible().catch(() => false);

  if (sidebarVisible) {
    await sidebarHitReport.click();
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  } else {
    // Direct navigation as fallback
    await page.goto(`${BASE}/admin/storage/hit-reports`, { waitUntil: "networkidle", timeout: 20000 });
  }
  await waitForNetworkQuiet(page);
  await shot(page, "B-01-hit-reports-list");

  // Find a row with 🔗 share chip (active/published)
  const shareChip = page.locator("[class*='chip'], [class*='Chip'], button, span")
    .filter({ hasText: /🔗|공유|링크/ })
    .first();
  const shareChipVisible = await shareChip.isVisible().catch(() => false);
  console.log("[B] share chip visible:", shareChipVisible);

  if (!shareChipVisible) {
    // Try alternate selectors
    const linkChip = page.locator("text=공유 링크").first();
    const linkChipAlt = await linkChip.isVisible().catch(() => false);
    console.log("[B] '공유 링크' text visible:", linkChipAlt);
    await shot(page, "B-02-no-share-chip");
    return;
  }

  // Check initial style (dashed border expected for active link)
  const chipStyle = await shareChip.evaluate((el: Element) => {
    const computed = window.getComputedStyle(el);
    return {
      borderStyle: computed.borderStyle,
      border: computed.border,
      className: (el as HTMLElement).className,
    };
  });
  console.log("[B] chip initial style:", JSON.stringify(chipStyle));

  // Click share chip
  const toast = page.locator("text=공유 링크를 복사했습니다").first();
  await shareChip.click();
  await toast.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

  // Check toast appears
  const toastVisible = await toast.isVisible().catch(() => false);
  console.log("[B] toast visible:", toastVisible);
  await shot(page, "B-03-after-chip-click");

  // Check toast count — should be exactly 1 (not duplicated)
  const toastCount = await page.locator("text=공유 링크를 복사했습니다").count();
  console.log("[B] toast count (expect 1):", toastCount);

  // Wait for toast to disappear and check chip style change
  await toast.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  const chipStyleAfter = await shareChip.evaluate((el: Element) => {
    const computed = window.getComputedStyle(el);
    return {
      borderStyle: computed.borderStyle,
      border: computed.border,
    };
  });
  console.log("[B] chip style after click:", JSON.stringify(chipStyleAfter));
  await shot(page, "B-04-chip-after");

  expect(toastVisible).toBe(true);
  expect(toastCount).toBe(1);
});

// ─────────────────────────────────────────────────────────────
// [C] Board admin bulk action
// ─────────────────────────────────────────────────────────────
test("[C] Board admin bulk action", async ({ page }) => {
  await loginViaUI(page, "admin");
  await waitForNetworkQuiet(page);

  // Navigate to community/board via sidebar or direct
  const sidebarCommunity = page.locator("a[href*='community']").filter({ hasText: /커뮤니티|게시판/ }).first();
  const commVisible = await sidebarCommunity.isVisible().catch(() => false);

  if (commVisible) {
    await sidebarCommunity.click();
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  } else {
    await page.goto(`${BASE}/admin/community/board`, { waitUntil: "networkidle", timeout: 20000 });
  }
  await waitForNetworkQuiet(page);
  await shot(page, "C-01-board-page");

  // Check select-all checkbox
  const selectAll = page.locator("[data-testid='board-select-all']");
  const selectAllVisible = await selectAll.isVisible().catch(() => false);
  console.log("[C] select-all checkbox visible:", selectAllVisible);

  // Check row checkboxes
  const rowCheckboxes = page.locator("[data-testid='board-post-checkbox']");
  const rowCount = await rowCheckboxes.count();
  console.log("[C] row checkboxes count:", rowCount);

  await shot(page, "C-02-checkboxes");

  if (rowCount === 0) {
    console.log("[C] No row checkboxes found — checking if any posts exist");
    const postRows = await page.locator("tr, [class*='row'], [class*='Row']").count();
    console.log("[C] generic rows found:", postRows);
    await shot(page, "C-03-no-posts");
    return;
  }

  // Click first 2-3 row checkboxes
  const clickCount = Math.min(rowCount, 3);
  for (let i = 0; i < clickCount; i++) {
    const checkbox = rowCheckboxes.nth(i);
    await checkbox.click();
    await expect(checkbox).toBeChecked({ timeout: 2000 }).catch(() => {});
  }
  console.log("[C] clicked", clickCount, "checkboxes");

  const bulkBar = page.locator("[data-testid='board-bulk-bar']");
  await bulkBar.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  await shot(page, "C-04-after-checkbox-click");

  // Bulk bar should appear
  const bulkBarVisible = await bulkBar.isVisible().catch(() => false);
  console.log("[C] bulk bar visible:", bulkBarVisible);

  if (bulkBarVisible) {
    // Check "N건 선택" text
    const selectedCount = await bulkBar.locator("text=/\\d+건 선택/").first().isVisible().catch(() => false);
    console.log("[C] 'N건 선택' text in bulk bar:", selectedCount);

    // Check action buttons
    const publishBtn = await bulkBar.locator("text=/게시|공개/").first().isVisible().catch(() => false);
    const draftBtn = await bulkBar.locator("text=/임시저장|임시/").first().isVisible().catch(() => false);
    const archiveBtn = await bulkBar.locator("text=/보관|아카이브/").first().isVisible().catch(() => false);
    const clearBtn = await bulkBar.locator("text=/선택해제|해제/").first().isVisible().catch(() => false);
    console.log("[C] bulk actions - publish:", publishBtn, "draft:", draftBtn, "archive:", archiveBtn, "clear:", clearBtn);
    await shot(page, "C-05-bulk-bar");
  }

  // Escape to clear selection
  await page.keyboard.press("Escape");
  await bulkBar.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  const bulkBarAfterEsc = await bulkBar.isVisible().catch(() => false);
  console.log("[C] bulk bar after Escape:", bulkBarAfterEsc);
  await shot(page, "C-06-after-escape");

  expect(selectAllVisible || rowCount > 0).toBe(true);
  expect(bulkBarVisible).toBe(true);
});

// ─────────────────────────────────────────────────────────────
// [D] Share token page (incognito) + carousel
// ─────────────────────────────────────────────────────────────
test("[D] Share token student page + carousel", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  const TOKEN_URL = `${BASE}/landing/share/974715e6-e326-46f6-8c6a-53bd65ebda6d`;

  try {
    await gotoAndSettle(page, TOKEN_URL, { timeout: 30000 });
    await shot(page, "D-01-share-page-initial");

    // NavBar visible
    const navbar = page.locator("nav, [class*='nav'], [class*='Nav'], header").first();
    const navbarVisible = await navbar.isVisible().catch(() => false);
    console.log("[D] NavBar visible:", navbarVisible);

    // Brand chip
    const brandChip = page.locator("text=HakwonPlus").first();
    const brandChipVisible = await brandChip.isVisible().catch(() => false);
    console.log("[D] brand chip visible:", brandChipVisible);

    // KPI stats section
    const kpiSection = page.locator("[class*='kpi'], [class*='KPI'], [class*='stat'], [class*='Stat']").first();
    const kpiVisible = await kpiSection.isVisible().catch(() => false);
    console.log("[D] KPI section visible:", kpiVisible);

    // PDF iframe
    const pdfIframe = page.locator("iframe").first();
    const pdfIframeVisible = await pdfIframe.isVisible().catch(() => false);
    console.log("[D] PDF iframe visible:", pdfIframeVisible);
    if (pdfIframeVisible) {
      const src = await pdfIframe.getAttribute("src");
      console.log("[D] iframe src:", src?.substring(0, 100));
    }

    // CTA buttons: 학원 홈 / 다른 보고서 둘러보기
    const homeCtaEl = page.locator("text=/학원 홈|홈으로/").first();
    const homeCtaVisible = await homeCtaEl.isVisible().catch(() => false);
    console.log("[D] '학원 홈' CTA visible:", homeCtaVisible);

    const otherReportsCtaEl = page.locator("text=/다른 보고서|다른 적중|둘러보기/").first();
    const otherReportsCtaVisible = await otherReportsCtaEl.isVisible().catch(() => false);
    console.log("[D] '다른 보고서 둘러보기' CTA visible:", otherReportsCtaVisible);

    // Carousel - "다른 적중 사례"
    const carousel = page.locator("[class*='carousel'], [class*='Carousel'], [class*='slider']").first();
    const carouselVisible = await carousel.isVisible().catch(() => false);
    console.log("[D] carousel visible:", carouselVisible);

    // Carousel cards
    if (carouselVisible) {
      const cards = await carousel.locator("[class*='card'], [class*='Card'], article, li").all();
      console.log("[D] carousel cards count:", cards.length);
    } else {
      // May not be registered — check for section heading
      const carouselHeading = page.locator("text=/다른 적중|적중 사례/").first();
      const headingVisible = await carouselHeading.isVisible().catch(() => false);
      console.log("[D] carousel heading visible:", headingVisible, "(not registered = expected hidden)");
    }

    await shotFull(page, "D-02-share-page-full");

    // Scroll down to check full page
    await scrollToPageBottom(page);
    await shot(page, "D-03-share-page-bottom");

    // Verify page didn't redirect to login
    const currentUrl = page.url();
    console.log("[D] final URL:", currentUrl);
    const isLoginPage = currentUrl.includes("/login");
    console.log("[D] redirected to login (should be false):", isLoginPage);

    expect(isLoginPage).toBe(false);
    expect(navbarVisible || brandChipVisible).toBe(true);
  } finally {
    await context.close();
  }
});
