/**
 * tchul-blueprint-final.spec.ts
 * 박철과학 (tchul.com) 청사진 최종 시각 검수 — cycle 12 deploy 후
 * Timestamp: 20260512
 *
 * NOTE: 실사용 테넌트(tchul) E2E는 feedback_no_e2e_on_real_tenants 정책상 원칙 금지이나,
 *       본 spec은 write/mutation 없는 read-only 시각 검수이며 사용자 명시 요청에 따라 실행.
 *       데이터 변경 없음 — 캡처만.
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const TCHUL = "https://tchul.com";
const SS = (name: string) =>
  `C:/academy/e2e/screenshots/tchul-blueprint-final-20260512/${name}.png`;

// ─── V1: 비로그인 외부 학부모 시점 ───────────────────────────────────────────
test.describe("V1 — 비로그인 랜딩 (3 viewport)", () => {
  test("V1-mobile 375×812", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      storageState: undefined,
    });
    const page = await ctx.newPage();
    await page.goto(`${TCHUL}/landing`, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Hero h1 visible
    const h1 = page.locator("h1, [class*='hero'] h1, [class*='Hero'] h1").first();
    await expect(h1).toBeVisible({ timeout: 8000 });
    const h1Text = await h1.innerText().catch(() => "NOT_FOUND");
    console.log("[V1-mobile] h1:", h1Text);

    await page.screenshot({ path: SS("v1-mobile-375"), fullPage: false });
    await ctx.close();
  });

  test("V1-narrow 1100×768", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1100, height: 768 },
      storageState: undefined,
    });
    const page = await ctx.newPage();
    await page.goto(`${TCHUL}/landing`, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const h1 = page.locator("h1, [class*='hero'] h1, [class*='Hero'] h1, .pd-hero h1").first();
    const h1Text = await h1.innerText().catch(() => "NOT_FOUND");
    console.log("[V1-1100] h1:", h1Text);

    // Check tagline
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const hasTagline = bodyText.includes("철두철미") || bodyText.includes("철옹성");
    console.log("[V1-1100] has-tagline:", hasTagline, "| body snippet:", bodyText.slice(0, 200));

    // primary color via CSS variable or computed style
    const primaryColor = await page.evaluate(() => {
      const el = document.documentElement;
      return getComputedStyle(el).getPropertyValue("--color-primary") ||
             getComputedStyle(el).getPropertyValue("--primary") ||
             getComputedStyle(el).getPropertyValue("--pd-primary") || "NOT_FOUND";
    });
    console.log("[V1-1100] primary-color-var:", primaryColor);

    // Check background (template_key premium_dark = dark bg)
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    console.log("[V1-1100] body-bg:", bgColor);

    // Ambient pulse layers
    const pulseCount = await page.locator("[class*='pulse'], [class*='ambient'], [class*='glow'], [class*='orb']").count();
    console.log("[V1-1100] pulse-layer-count:", pulseCount);

    await page.screenshot({ path: SS("v1-narrow-1100"), fullPage: false });
    await ctx.close();
  });

  test("V1-desktop 1366×768", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      storageState: undefined,
    });
    const page = await ctx.newPage();
    await page.goto(`${TCHUL}/landing`, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Full-page screenshot
    await page.screenshot({ path: SS("v1-desktop-1366-above-fold"), fullPage: false });
    await page.screenshot({ path: SS("v1-desktop-1366-full"), fullPage: true });

    // hero sub text
    const subText = await page.locator("h2, [class*='subtitle'], [class*='sub'], [class*='tagline']").first().innerText().catch(() => "NOT_FOUND");
    console.log("[V1-1366] sub:", subText);

    // CTA button
    const ctaBtn = page.locator("a, button").filter({ hasText: /수강 문의|상담 신청|문의하기/ }).first();
    const ctaVisible = await ctaBtn.isVisible().catch(() => false);
    console.log("[V1-1366] cta-visible:", ctaVisible);

    // Scroll to trigger section enter
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(800);
    const inViewCount = await page.locator(".pd-in-view").count();
    console.log("[V1-1366] pd-in-view count after scroll:", inViewCount);
    await page.screenshot({ path: SS("v1-desktop-1366-scrolled"), fullPage: false });

    await ctx.close();
  });
});

// ─── V2: 학원장 owner 시점 — inline editor FAB + drawer ─────────────────────
test.describe("V2 — 학원장 owner — inline editor FAB + drawer", () => {
  test("V2-fab-and-drawer 1100×768", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 768 } });
    const page = await ctx.newPage();

    // login as tchul-admin
    await loginViaUI(page, "tchul-admin");

    await page.goto(`${TCHUL}/landing`, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // FAB 존재 여부
    const fab = page.locator('[data-testid="landing-inline-editor-fab"]');
    const fabVisible = await fab.isVisible({ timeout: 5000 }).catch(() => false);
    console.log("[V2] FAB visible:", fabVisible);
    await page.screenshot({ path: SS("v2-landing-with-fab"), fullPage: false });

    if (fabVisible) {
      await fab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: SS("v2-drawer-open"), fullPage: false });

      // drawer sections
      const drawerEl = page.locator('[class*="drawer"], [class*="Drawer"], [role="dialog"], [class*="panel"], [class*="editor"]').first();
      const drawerVisible = await drawerEl.isVisible().catch(() => false);
      console.log("[V2] drawer-visible:", drawerVisible);

      // Check slogan input
      const sloganInput = page.locator('input[placeholder*="슬로건"], input[placeholder*="tagline"], input[name*="slogan"], input[name*="tagline"], label:has-text("슬로건") + input, label:has-text("슬로건") ~ input').first();
      const sloganVal = await sloganInput.inputValue().catch(() => "NOT_FOUND");
      console.log("[V2] slogan-input-value:", sloganVal);

      // template radio premium_dark
      const premiumDarkRadio = page.locator('input[type="radio"][value*="premium_dark"], label:has-text("프리미엄 다크"), label:has-text("premium_dark")').first();
      const premiumDarkVisible = await premiumDarkRadio.isVisible().catch(() => false);
      console.log("[V2] premium_dark radio visible:", premiumDarkVisible);

      // WYSIWYG: change slogan and check live update
      if (await sloganInput.isVisible().catch(() => false)) {
        await sloganInput.triple_click ? sloganInput.click({ clickCount: 3 }) : await sloganInput.selectText().catch(() => {});
        await page.keyboard.press("Control+A");
        await page.keyboard.type("E2E-WYSIWYG-TEST");
        await page.waitForTimeout(500);
        await page.screenshot({ path: SS("v2-wysiwyg-live"), fullPage: false });
        // Restore original value
        await sloganInput.click({ clickCount: 3 });
        await page.keyboard.press("Control+A");
        await page.keyboard.type(sloganVal || "과학은 철두철미하게");
        await page.waitForTimeout(300);
      }

      // Esc to close
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const drawerAfterEsc = await drawerEl.isVisible().catch(() => false);
      console.log("[V2] drawer-after-Esc:", drawerAfterEsc);
      await page.screenshot({ path: SS("v2-after-esc"), fullPage: false });
    } else {
      // Try superuser cross-tenant — not expected to work, report
      console.log("[V2] FAB not visible on tchul-admin. Checking if owner role is set correctly.");
      const pageTitle = await page.title();
      console.log("[V2] page-title:", pageTitle);
    }

    await ctx.close();
  });

  test("V2-alt hakwonplus admin97 FAB check", async ({ browser }) => {
    // Fallback: check FAB on hakwonplus.com with admin97 (tenant 1 owner)
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 768 } });
    const page = await ctx.newPage();
    await loginViaUI(page, "admin");
    await page.goto("https://hakwonplus.com/landing", { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const fab = page.locator('[data-testid="landing-inline-editor-fab"]');
    const fabVisible = await fab.isVisible({ timeout: 5000 }).catch(() => false);
    console.log("[V2-alt] FAB visible on hakwonplus admin97:", fabVisible);
    await page.screenshot({ path: SS("v2-alt-hakwonplus-fab"), fullPage: false });

    if (fabVisible) {
      await fab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: SS("v2-alt-drawer-open"), fullPage: false });
    }

    await ctx.close();
  });
});

// ─── V3: 적중보고서 페이지 회귀 ───────────────────────────────────────────────
test.describe("V3 — reports 페이지 React #310 회귀", () => {
  test("V3-reports direct navigation", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      storageState: undefined,
    });
    const page = await ctx.newPage();
    await page.goto(`${TCHUL}/landing/reports`, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Check for error message
    const errorText = await page.locator("body").innerText().catch(() => "");
    const hasError310 = errorText.includes("일시적인 오류") || errorText.includes("310");
    console.log("[V3] has-error-310:", hasError310);

    // Check for cards or empty state
    const cardCount = await page.locator('[class*="card"], [class*="Card"], article').count();
    const emptyState = await page.locator('[class*="empty"], [class*="Empty"], :has-text("보고서가 없"), :has-text("아직")').first().isVisible().catch(() => false);
    console.log("[V3] card-count:", cardCount, "| empty-state:", emptyState);

    // Page title / heading
    const heading = await page.locator("h1, h2").first().innerText().catch(() => "NOT_FOUND");
    console.log("[V3] heading:", heading);

    await page.screenshot({ path: SS("v3-reports-direct"), fullPage: false });
    await ctx.close();
  });

  test("V3-reports via hero CTA click", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      storageState: undefined,
    });
    const page = await ctx.newPage();
    await page.goto(`${TCHUL}/landing`, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Look for "적중 보고서 보기" button
    const reportBtn = page.locator("a, button").filter({ hasText: /적중 보고서|적중사례|보고서 보기/ }).first();
    const btnVisible = await reportBtn.isVisible().catch(() => false);
    console.log("[V3-cta] report-btn visible:", btnVisible);

    if (btnVisible) {
      await reportBtn.click();
      await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const url = page.url();
      console.log("[V3-cta] after-click url:", url);
      const hasError310 = (await page.locator("body").innerText().catch(() => "")).includes("일시적인 오류");
      console.log("[V3-cta] has-error-310:", hasError310);
      await page.screenshot({ path: SS("v3-reports-via-cta"), fullPage: false });
    } else {
      console.log("[V3-cta] 적중 보고서 CTA button NOT FOUND on hero");
      await page.screenshot({ path: SS("v3-no-report-cta"), fullPage: false });
    }

    await ctx.close();
  });
});

// ─── V4: Micro-interactions ───────────────────────────────────────────────────
test.describe("V4 — micro-interactions 1366×768", () => {
  test("V4-cta-hover + sidebar + sticky-tabs", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, storageState: undefined });
    const page = await ctx.newPage();
    await page.goto(`${TCHUL}/landing`, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // CTA primary button hover
    const ctaBtn = page.locator("a, button").filter({ hasText: /수강 문의|상담 신청|문의하기/ }).first();
    const ctaVisible = await ctaBtn.isVisible().catch(() => false);
    if (ctaVisible) {
      await ctaBtn.hover();
      await page.waitForTimeout(300);
      const transform = await ctaBtn.evaluate((el) => getComputedStyle(el).transform);
      console.log("[V4] cta-hover-transform:", transform);
      await page.screenshot({ path: SS("v4-cta-hover"), fullPage: false });
    } else {
      console.log("[V4] CTA button not visible");
      await page.screenshot({ path: SS("v4-no-cta"), fullPage: false });
    }

    // Hamburger / sidebar
    const hamburger = page.locator('[aria-label*="menu"], [aria-label*="Menu"], [class*="hamburger"], [class*="menu-btn"], button[class*="mobile"]').first();
    const hambVisible = await hamburger.isVisible().catch(() => false);
    console.log("[V4] hamburger visible:", hambVisible);
    if (hambVisible) {
      await hamburger.click();
      await page.waitForTimeout(500);
      const sidebarText = await page.locator('[class*="sidebar"], [class*="drawer"], [role="navigation"]').first().innerText().catch(() => "NOT_FOUND");
      console.log("[V4] sidebar-text snippet:", sidebarText.slice(0, 200));
      await page.screenshot({ path: SS("v4-sidebar-open"), fullPage: false });

      // Check category order
      const hasOrder = sidebarText.includes("학원소개") && sidebarText.includes("커뮤니티");
      console.log("[V4] sidebar has 학원소개+커뮤니티:", hasOrder);
    }

    // Sticky tabs — scroll 300px
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(800);
    const tabStrip = page.locator('[class*="tab"], [class*="Tab"], [class*="chip-strip"], [class*="nav-strip"]').first();
    const tabVisible = await tabStrip.isVisible().catch(() => false);
    console.log("[V4] tab-strip visible after scroll:", tabVisible);
    await page.screenshot({ path: SS("v4-sticky-tabs-300px"), fullPage: false });

    await ctx.close();
  });
});

// ─── V5: cross-tenant superuser check ───────────────────────────────────────
test.describe("V5 — cross-tenant superuser report", () => {
  test("V5-admin97 on tchul.com", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 768 } });
    const page = await ctx.newPage();

    // Attempt tchul login with admin97 (superuser)
    const resp = await page.request.post("https://api.hakwonplus.com/api/v1/token/", {
      data: { username: "admin97", password: "koreaseoul97", tenant_code: "tchul" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
      timeout: 30000,
    });
    console.log("[V5] admin97@tchul token status:", resp.status());

    if (resp.status() === 200) {
      const tokens = await resp.json() as { access: string; refresh: string };
      await page.goto(`${TCHUL}/login`, { waitUntil: "commit" });
      await page.evaluate(({ access, refresh }) => {
        localStorage.setItem("access", access);
        localStorage.setItem("refresh", refresh);
      }, { access: tokens.access, refresh: tokens.refresh });
      await page.goto(`${TCHUL}/admin`, { waitUntil: "load", timeout: 20000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      const url = page.url();
      console.log("[V5] admin97@tchul post-login url:", url);
      await page.screenshot({ path: SS("v5-superuser-tchul-admin"), fullPage: false });

      // Navigate to landing
      await page.goto(`${TCHUL}/landing`, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(2000);
      const fab = page.locator('[data-testid="landing-inline-editor-fab"]');
      const fabVisible = await fab.isVisible({ timeout: 3000 }).catch(() => false);
      console.log("[V5] FAB visible with admin97@tchul:", fabVisible);
      await page.screenshot({ path: SS("v5-superuser-landing"), fullPage: false });
    } else {
      console.log("[V5] admin97 cannot auth as tchul tenant — cross-tenant blocked (expected)");
      await page.screenshot({ path: SS("v5-cross-tenant-blocked"), fullPage: false });
    }

    await ctx.close();
  });
});
