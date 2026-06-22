import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { waitForRenderSettled } from "../helpers/wait";

function resolveLocalBase(): string {
  const explicit = process.env.E2E_PROMO_BASE_URL || process.env.E2E_LOCAL_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const e2eBase = process.env.E2E_BASE_URL || "";
  try {
    const host = new URL(e2eBase).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return e2eBase.replace(/\/+$/, "");
    }
  } catch {
    // Fall through to the default local dev server.
  }

  return "http://127.0.0.1:5174";
}

const BASE = resolveLocalBase();

const PROMO_ROUTES = [
  "/promo",
  "/promo/parent-trust",
  "/promo/features",
  "/promo/ai-grading",
  "/promo/video-platform",
  "/promo/pricing",
  "/promo/faq",
  "/promo/contact",
  "/promo/demo",
  "/promo/landing-samples",
] as const;

const MOBILE_MENU_ROUTES = [
  "/promo",
  "/promo/parent-trust",
  "/promo/features",
  "/promo/video-platform",
  "/promo/pricing",
  "/promo/contact",
] as const;

type VisibleLink = {
  href: string;
  label: string;
  targetPath: string;
  targetHash: string;
};

async function stubPromoBootstrap(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("tenant_code", "9999");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    try {
      sessionStorage.setItem("tenantCode", "9999");
    } catch {
      // Storage can be blocked in embedded browser contexts.
    }
  });

  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "9999",
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });

  await page.route("**/api/v1/core/landing/has-published/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ has_landing: false }) });
  });

  await page.route("**/api/v1/core/landing/testimonial/public/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });

  await page.route("**/api/v1/landing-public/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/summary/")
      ? { count: 0, average: 0, distribution: {} }
      : { count: 0, next: null, previous: null, results: [] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function gotoAndAssert(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await waitForRenderSettled(page);
  const url = new URL(page.url());
  expect(url.pathname, `direct route should stay on ${path}`).toBe(path);
}

async function getVisibleInternalLinks(page: Page): Promise<VisibleLink[]> {
  const currentUrl = page.url();
  const baseOrigin = new URL(BASE).origin;
  const links = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((anchor) => {
      const el = anchor as HTMLAnchorElement;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        href: el.getAttribute("href") || "",
        text: (el.textContent || "").replace(/\s+/g, " ").trim(),
        ariaLabel: el.getAttribute("aria-label") || "",
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.pointerEvents !== "none",
      };
    }),
  );

  return links.flatMap((link) => {
    if (!link.visible || !link.href) return [];
    if (link.ariaLabel.includes("전화 문의")) return [];

    const target = new URL(link.href, currentUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") return [];
    if (target.origin !== baseOrigin) return [];

    const allowed =
      target.pathname.startsWith("/promo") ||
      target.pathname === "/privacy" ||
      target.pathname === "/terms" ||
      target.pathname === "/login";
    if (!allowed) return [];

    return [{
      href: link.href,
      label: link.text || link.ariaLabel || link.href,
      targetPath: target.pathname,
      targetHash: target.hash,
    }];
  });
}

async function getDistinctVisibleInternalLinks(page: Page): Promise<VisibleLink[]> {
  const seen = new Set<string>();
  const links = await getVisibleInternalLinks(page);
  return links.filter((link) => {
    const key = `${link.targetPath}${link.targetHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getVisibleInternalLinkHandles(page: Page, sourceUrl: string) {
  const baseOrigin = new URL(BASE).origin;
  const handles = await page.locator("a[href]").elementHandles();
  const result: Array<{ handle: (typeof handles)[number]; link: VisibleLink }> = [];

  for (const handle of handles) {
    const info = await handle.evaluate((el) => {
      const anchor = el as HTMLAnchorElement;
      const rect = anchor.getBoundingClientRect();
      const style = window.getComputedStyle(anchor);
      return {
        href: anchor.getAttribute("href") || "",
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        ariaLabel: anchor.getAttribute("aria-label") || "",
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.pointerEvents !== "none",
      };
    });

    if (!info.visible || !info.href || info.ariaLabel.includes("전화 문의")) continue;
    const target = new URL(info.href, sourceUrl);
    if (target.origin !== baseOrigin) continue;
    const allowed =
      target.pathname.startsWith("/promo") ||
      target.pathname === "/privacy" ||
      target.pathname === "/terms" ||
      target.pathname === "/login";
    if (!allowed) continue;

    result.push({
      handle,
      link: {
        href: info.href,
        label: info.text || info.ariaLabel || info.href,
        targetPath: target.pathname,
        targetHash: target.hash,
      },
    });
  }

  return result;
}

async function clickAndAssertTarget(page: Page, link: VisibleLink, sourcePath: string) {
  await gotoAndAssert(page, sourcePath);
  const handles = await getVisibleInternalLinkHandles(page, page.url());
  const target = handles.find(
    (entry) => entry.link.targetPath === link.targetPath && entry.link.targetHash === link.targetHash,
  );
  expect(target, `click target should exist on ${sourcePath}: ${link.label} (${link.href})`).toBeTruthy();

  await target!.handle.click({ timeout: 8_000 });
  await waitForRenderSettled(page);

  const after = new URL(page.url());
  expect(after.pathname, `${sourcePath} -> ${link.label} (${link.href})`).toBe(link.targetPath);
  expect(after.hash, `${sourcePath} -> ${link.label} (${link.href}) hash`).toBe(link.targetHash);
}

test.describe("promo route navigation", () => {
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    await stubPromoBootstrap(page);
  });

  test("renders every canonical promo route directly", async ({ page }) => {
    for (const route of PROMO_ROUTES) {
      await gotoAndAssert(page, route);
    }
  });

  test("clicks every distinct visible internal desktop route target on every promo route", async ({ page }) => {
    for (const sourcePath of PROMO_ROUTES) {
      await gotoAndAssert(page, sourcePath);
      const links = await getDistinctVisibleInternalLinks(page);
      expect(links.length, `${sourcePath} should expose click targets`).toBeGreaterThan(0);

      for (const link of links) {
        await clickAndAssertTarget(page, link, sourcePath);
      }
    }
  });

  test("opens promo login in-place instead of leaving the promo route", async ({ page }) => {
    await gotoAndAssert(page, "/promo");

    await page.getByTestId("promo-login-open").click();
    await expect(page.getByPlaceholder("아이디")).toBeVisible();
    await expect(page.getByPlaceholder("비밀번호")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/promo");
  });

  test("keeps landing sample previews inert inside the promo route", async ({ page }) => {
    await gotoAndAssert(page, "/promo/landing-samples");

    await page.getByRole("button", { name: /Minimal Tutor/ }).click();
    const canvas = page.getByTestId("landing-sample-preview-canvas");
    await expect(canvas).toBeVisible();

    const previewPath = new URL(page.url()).pathname;
    expect(previewPath).toBe("/promo/landing-samples");

    await canvas.locator('a[href="/landing"]').first().click();
    await waitForRenderSettled(page);
    expect(new URL(page.url()).pathname).toBe("/promo/landing-samples");

    await canvas.locator('a[href="/login"]').first().click();
    await waitForRenderSettled(page);
    expect(new URL(page.url()).pathname).toBe("/promo/landing-samples");

    const footerRouteButton = canvas.locator("footer button").filter({ hasText: "자유게시판" }).first();
    if (await footerRouteButton.isVisible().catch(() => false)) {
      await footerRouteButton.click();
      await waitForRenderSettled(page);
      expect(new URL(page.url()).pathname).toBe("/promo/landing-samples");
    }
  });

  test("clicks every mobile promo tab and sidebar route", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const targetPath of MOBILE_MENU_ROUTES) {
      await gotoAndAssert(page, "/promo");
      await page.locator(`nav[aria-label="프로모션 빠른 메뉴"] a[href="${targetPath}"]`).click();
      await waitForRenderSettled(page);
      expect(new URL(page.url()).pathname, `mobile tab -> ${targetPath}`).toBe(targetPath);
    }

    for (const targetPath of MOBILE_MENU_ROUTES) {
      await gotoAndAssert(page, "/promo");
      await page.getByRole("button", { name: "메뉴 열기" }).click();
      await expect(page.getByRole("complementary", { name: "프로모션 사이드 메뉴" })).toBeVisible();
      await page.locator(`#promo-mobile-sidebar a[href="${targetPath}"]`).first().click();
      await waitForRenderSettled(page);
      expect(new URL(page.url()).pathname, `mobile sidebar -> ${targetPath}`).toBe(targetPath);
    }
  });
});
