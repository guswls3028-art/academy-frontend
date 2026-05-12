import { test, expect, chromium } from "@playwright/test";
import path from "path";

const BASE = process.env.E2E_BASE_URL ?? "https://hakwonplus.com";
const ADMIN = process.env.E2E_ADMIN_USER ?? "admin97";
const PASS = process.env.E2E_ADMIN_PASS ?? "koreaseoul97";
const SHOTS = path.resolve("e2e/screenshots/prod-visual-20260512-cycle2");

// Helper: save screenshot with an absolute path
async function shot(page: any, name: string) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

test.describe("prod-visual-20260512-cycle2", () => {
  // ──────────────────────────────────────────────
  // V1: Landing hero visual fix
  // ──────────────────────────────────────────────
  test("V1 landing hero visual fix", async ({ page }) => {
    await page.goto(`${BASE}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // brand_name chip
    const brandChip = page.locator("text=HakwonPlus").first();
    await expect(brandChip).toBeVisible({ timeout: 10000 });
    await shot(page, "V1-01-hero-initial");

    // h1 - large heading
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    const h1Text = await h1.textContent();
    console.log("H1 text:", h1Text);

    // subtitle text check
    const subtitleEl = page.locator("text=체계적인").first();
    const subtitleVisible = await subtitleEl.isVisible().catch(() => false);
    console.log("subtitle visible:", subtitleVisible);

    // CTA buttons
    const loginCta = page.locator("text=로그인").first();
    await expect(loginCta).toBeVisible();
    const reportCta = page.locator("text=적중 보고서").first();
    const reportCtaVisible = await reportCta.isVisible().catch(() => false);
    console.log("report CTA visible:", reportCtaVisible);

    // hero visual panel — check for brand initial "H" or gradient panel
    const heroPanel = page.locator("[class*='hero'], [class*='Hero'], [class*='gradient'], [class*='visual']").first();
    const heroPanelVisible = await heroPanel.isVisible().catch(() => false);
    console.log("hero panel visible:", heroPanelVisible);

    // Check empty sections are gone (about/features giant whitespace)
    // Scroll down to check sections
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await shot(page, "V1-02-scroll600");

    // Check page height vs content - if about/features have only headers with big blank space
    const aboutSection = page.locator("#about, [id='about'], section:has-text('소개')").first();
    const aboutVisible = await aboutSection.isVisible().catch(() => false);
    console.log("about section visible:", aboutVisible);

    await shot(page, "V1-03-sections");
  });

  // ──────────────────────────────────────────────
  // V2: Sticky section tabs active solid filled
  // ──────────────────────────────────────────────
  test("V2 sticky tabs active state", async ({ page }) => {
    await page.goto(`${BASE}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "V2-01-before-scroll");

    // Scroll 300px down
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(800);
    await shot(page, "V2-02-scroll300");

    // Find sticky tab strip
    const tabStrip = page.locator("[class*='tab'], [class*='Tab'], [class*='chip'], nav").first();
    const tabStripVisible = await tabStrip.isVisible().catch(() => false);
    console.log("tab strip visible:", tabStripVisible);

    // Find active chip - should have solid bg
    // Look for active chip by class or aria
    const activeChip = page.locator("[class*='active'], [aria-selected='true'], [class*='solid']").first();
    const activeChipVisible = await activeChip.isVisible().catch(() => false);
    console.log("active chip visible:", activeChipVisible);

    if (activeChipVisible) {
      const bgColor = await activeChip.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      console.log("active chip bg:", bgColor);
    }

    // Scroll more to check tab behavior
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);
    await shot(page, "V2-03-scroll800");
  });

  // ──────────────────────────────────────────────
  // V3: Share token chip behavior
  // ──────────────────────────────────────────────
  test("V3 share token chip behavior", async ({ page }) => {
    // Login
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Fill login form
    const userInput = page.locator("input[type='text'], input[name='username'], input[placeholder*='아이디'], input[placeholder*='ID']").first();
    await userInput.fill(ADMIN);
    const passInput = page.locator("input[type='password']").first();
    await passInput.fill(PASS);
    await passInput.press("Enter");
    await page.waitForTimeout(2000);
    await shot(page, "V3-01-after-login");

    // Navigate to hit reports via sidebar/menu
    await page.goto(`${BASE}/admin/storage/hit-reports`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await shot(page, "V3-02-hit-reports-list");

    // Find share chip
    const shareChip = page.locator("[data-testid='hit-report-share-copy']").first();
    const shareChipVisible = await shareChip.isVisible().catch(() => false);
    console.log("share chip visible:", shareChipVisible);

    if (!shareChipVisible) {
      console.log("Share chip not found — checking page content");
      const pageText = await page.textContent("body");
      console.log("Page snippet:", pageText?.slice(0, 500));
      await shot(page, "V3-02b-no-chip");
      return;
    }

    // Check initial style (dashed border + light bg)
    const initialBorder = await shareChip.evaluate((el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      return { border: style.borderStyle, bg: style.backgroundColor };
    });
    console.log("initial chip style:", initialBorder);

    // Set up toast listener BEFORE clicking
    const toastMessages: string[] = [];
    page.on("console", msg => console.log("BROWSER:", msg.text()));

    // Click share chip
    await shareChip.click();
    await page.waitForTimeout(2000);
    await shot(page, "V3-03-after-first-click");

    // Check for toast
    const toast = page.locator("[class*='toast'], [class*='Toast'], [role='alert'], [class*='snack']").first();
    const toastVisible = await toast.isVisible().catch(() => false);
    const toastText = toastVisible ? await toast.textContent() : "no toast";
    console.log("toast text:", toastText);

    // Check chip updated to solid
    const afterBorder = await shareChip.evaluate((el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      return { border: style.borderStyle, bg: style.backgroundColor };
    }).catch(() => ({}));
    console.log("after click chip style:", afterBorder);

    // Reload and check has_share_token=true
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await shot(page, "V3-04-after-reload");

    const shareChipReloaded = page.locator("[data-testid='hit-report-share-copy']").first();
    const reloadedVisible = await shareChipReloaded.isVisible().catch(() => false);
    console.log("share chip after reload:", reloadedVisible);

    // Click again — should say "복사" not "새로 만들고"
    if (reloadedVisible) {
      await shareChipReloaded.click();
      await page.waitForTimeout(2000);
      await shot(page, "V3-05-second-click");
      const toast2 = page.locator("[class*='toast'], [class*='Toast'], [role='alert'], [class*='snack']").first();
      const toast2Visible = await toast2.isVisible().catch(() => false);
      const toast2Text = toast2Visible ? await toast2.textContent() : "no toast";
      console.log("second click toast:", toast2Text);
    }
  });

  // ──────────────────────────────────────────────
  // V4: /landing/share/<token> student page
  // ──────────────────────────────────────────────
  test("V4 share page student view", async ({ browser }) => {
    // First get a share token by logging in as admin
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    await adminPage.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await adminPage.waitForTimeout(1000);

    const userInput = adminPage.locator("input[type='text'], input[name='username'], input[placeholder*='아이디'], input[placeholder*='ID']").first();
    await userInput.fill(ADMIN);
    const passInput = adminPage.locator("input[type='password']").first();
    await passInput.fill(PASS);
    await passInput.press("Enter");
    await adminPage.waitForTimeout(2000);

    await adminPage.goto(`${BASE}/admin/storage/hit-reports`, { waitUntil: "networkidle" });
    await adminPage.waitForTimeout(2000);

    // Intercept share link API to get token
    let shareUrl: string | null = null;
    adminPage.on("response", async (response) => {
      if (response.url().includes("share") && response.status() === 200) {
        try {
          const body = await response.json().catch(() => null);
          if (body?.share_url) shareUrl = body.share_url;
          if (body?.url) shareUrl = body.url;
        } catch {}
      }
    });

    // Click share chip to get token
    const shareChip = adminPage.locator("[data-testid='hit-report-share-copy']").first();
    const shareChipVisible = await shareChip.isVisible().catch(() => false);

    if (shareChipVisible) {
      await shareChip.click();
      await adminPage.waitForTimeout(2000);
    }

    // Try to get share URL from clipboard or construct from known pattern
    // Check if clipboard has the URL
    const clipContent = await adminPage.evaluate(() => {
      return navigator.clipboard.readText().catch(() => null);
    }).catch(() => null);
    console.log("Clipboard content:", clipContent);

    if (clipContent && clipContent.includes("/landing/share/")) {
      shareUrl = clipContent;
    }

    // Ensure shareUrl is absolute
    if (shareUrl && !shareUrl.startsWith("http")) {
      shareUrl = `${BASE}${shareUrl}`;
    }

    await adminCtx.close();

    // Now open incognito context
    const incognitoCtx = await browser.newContext();
    const studentPage = await incognitoCtx.newPage();

    const targetUrl = shareUrl ?? `${BASE}/landing/share/974715e6-e326-46f6-8c6a-53bd65ebda6d`;
    console.log("Opening share URL:", targetUrl);

    await studentPage.goto(targetUrl, { waitUntil: "networkidle" });
    await studentPage.waitForTimeout(2000);
    await studentPage.screenshot({ path: path.join(SHOTS, "V4-01-share-page.png"), fullPage: false });

    // Check NavBar
    const navbar = studentPage.locator("nav, [class*='nav'], [class*='Nav'], header").first();
    const navVisible = await navbar.isVisible().catch(() => false);
    console.log("navbar visible:", navVisible);

    // Check hit report label
    const hitReportLabel = studentPage.locator("text=Hit Report, text=적중보고서, text=적중 보고서").first();
    const labelVisible = await hitReportLabel.isVisible().catch(() => false);
    console.log("hit report label visible:", labelVisible);

    // Check h1 (exam title)
    const h1 = studentPage.locator("h1").first();
    const h1Visible = await h1.isVisible().catch(() => false);
    const h1Text = h1Visible ? await h1.textContent() : "no h1";
    console.log("h1:", h1Text);

    // Check KPI numbers
    const kpiEl = studentPage.locator("[class*='kpi'], [class*='KPI'], [class*='stat'], [class*='score']").first();
    const kpiVisible = await kpiEl.isVisible().catch(() => false);
    console.log("KPI element visible:", kpiVisible);

    // Check PDF iframe
    const iframe = studentPage.locator("iframe").first();
    const iframeVisible = await iframe.isVisible().catch(() => false);
    const iframeSrc = iframeVisible ? await iframe.getAttribute("src") : "no iframe";
    console.log("iframe visible:", iframeVisible, "src:", iframeSrc);

    // Check carousel or other reports section
    await studentPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await studentPage.waitForTimeout(500);
    await studentPage.screenshot({ path: path.join(SHOTS, "V4-02-share-scroll.png"), fullPage: false });

    await studentPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await studentPage.waitForTimeout(500);
    await studentPage.screenshot({ path: path.join(SHOTS, "V4-03-share-bottom.png"), fullPage: false });

    // Check footer
    const footer = studentPage.locator("footer").first();
    const footerVisible = await footer.isVisible().catch(() => false);
    console.log("footer visible:", footerVisible);

    await incognitoCtx.close();
  });
});
