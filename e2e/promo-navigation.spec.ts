import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

async function stubPromoBootstrap(page: Page) {
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
}

async function expectHashAligned(page: Page, id: string) {
  await expect.poll(async () => page.evaluate((targetId) => {
    const target = document.getElementById(targetId);
    const header = document.querySelector("[data-promo-header]");
    if (!target || !header) return false;
    const top = target.getBoundingClientRect().top;
    const headerBottom = header.getBoundingClientRect().bottom;
    return top >= headerBottom && top <= headerBottom + 40;
  }, id)).toBe(true);
}

test.describe("promo navigation", () => {
  test.beforeEach(async ({ page }) => {
    await stubPromoBootstrap(page);
  });

  test("review: feature aliases and the final topic show the selected location", async ({ page }) => {
    const navigation = page.getByRole("navigation", { name: "기능 바로가기" });
    for (const [alias, target] of [["student-video", "student-video-flow"], ["alimtalk", "communication"], ["academy-homepage", "academy-homepage-flow"], ["matchup-ppt", "matchup-ppt-flow"]]) {
      await page.goto(`${BASE}/promo/features#${alias}`);
      await expect(navigation.locator(`a[href="#${target}"]`)).toHaveAttribute("aria-current", "location");
      await expectHashAligned(page, alias);
    }
    await navigation.getByRole("link", { name: "그 밖의 운영 기능" }).click();
    await expect(page).toHaveURL(/#more-operations$/);
    await expect(navigation.locator('[aria-current="location"]')).toHaveCount(1);
    await expect(navigation.getByRole("link", { name: "그 밖의 운영 기능" })).toHaveAttribute("aria-current", "location");
  });

  test("review: short desktop keeps every feature topic reachable by keyboard", async ({ page }, info) => {
    await page.setViewportSize({ width: 1366, height: 400 });
    await page.goto(`${BASE}/promo/features#class-management`);
    const navigation = page.getByRole("navigation", { name: "기능 바로가기" });
    await expect.poll(() => navigation.evaluate(element => element.getBoundingClientRect().bottom <= innerHeight - 8)).toBe(true);
    const links = navigation.getByRole("link");
    await links.first().focus();
    for (let index = 1; index < await links.count(); index++) await page.keyboard.press("Tab");
    await expect(links.last()).toBeFocused();
    await expect(links.last()).toBeInViewport({ ratio: 0.99 });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#more-operations$/);
    await expectHashAligned(page, "more-operations");
    await page.screenshot({ path: info.outputPath("feature-topics-short-desktop.png") });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/promo/features#class-management`);
    await expectHashAligned(page, "class-management");
    await navigation.hover();
    const previousScroll = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 350);
    // Late anchor alignment must not undo an intentional scroll.
    // eslint-disable-next-line no-restricted-syntax -- Immediate polling passes before the delayed snap-back regression occurs.
    await page.waitForTimeout(1200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(previousScroll + 100);
  });

  for (const width of [390, 1366]) {
    test(`review: guide history reopens the exact reading page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}/promo/guide?role=admin&q=수납&guideBook=detail&guidePage=16`);
      const disclosure = page.locator("details").filter({ has: page.locator("summary", { hasText: "화면으로 기능 살펴보기" }) });
      const reader = page.getByRole("region", { name: "기능 둘러보기", exact: true });
      await reader.getByLabel("설명서 페이지").selectOption("17");
      await expect(page).toHaveURL(/guidePage=17/);
      await disclosure.locator(":scope > summary").click();
      await expect(disclosure).not.toHaveAttribute("open", "");
      await page.goBack();
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(reader.getByLabel("설명서 페이지")).toHaveValue("16");
      await expect(page.getByPlaceholder("기능, 화면 이름, 막힌 상황 검색")).toHaveValue("수납");
      await disclosure.locator(":scope > summary").click();
      await page.goForward();
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(reader.getByLabel("설명서 페이지")).toHaveValue("17");
      await page.reload();
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(reader.getByLabel("설명서 페이지")).toHaveValue("17");
      await disclosure.locator(":scope > summary").click();
      await page.getByPlaceholder("기능, 화면 이름, 막힌 상황 검색").fill("출결");
      await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("출결");
      await expect(disclosure).not.toHaveAttribute("open", "");
    });

    test(`review: an explicit close survives a pending reading-page update at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}/promo/guide?role=admin&guideBook=detail&guidePage=16`);
      const disclosure = page.locator("details").filter({ has: page.locator("summary", { hasText: "화면으로 기능 살펴보기" }) });
      // The selected page remains in the DOM while the native details is closed.
      const pageSelect = disclosure.getByLabel("설명서 페이지");
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(pageSelect).toHaveValue("16");
      // Keep both native actions in one task so React has not committed the new reading page before the close.
      await pageSelect.evaluate((element) => {
        const select = element as HTMLSelectElement;
        select.value = "17";
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.closest("details")!.querySelector<HTMLElement>(":scope > summary")!.click();
      });
      await expect(page).toHaveURL(/guidePage=17/);
      await expect(pageSelect).toHaveValue("17");
      await expect(disclosure).not.toHaveAttribute("open", "");
      await disclosure.locator(":scope > summary").focus();
      await page.keyboard.press("Enter");
      await expect(disclosure).toHaveAttribute("open", "");
      await page.keyboard.press("Space");
      await expect(disclosure).not.toHaveAttribute("open", "");
      await page.goBack();
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(pageSelect).toHaveValue("16");
      await page.goForward();
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(pageSelect).toHaveValue("17");
    });
  }

  test("aligns cross-page hash links below the fixed promo header", async ({ page }) => {
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });
    await page.locator('a[data-workflow-card="students"]').click();
    await expect(page).toHaveURL(/\/promo\/features#class-management$/);
    await expectHashAligned(page, "class-management");

    await page.goto(`${BASE}/promo/ai-grading`, { waitUntil: "load" });
    await page.getByRole("link", { name: "결과 안내 보기" }).click();
    await expect(page).toHaveURL(/\/promo\/features#communication$/);
    await expectHashAligned(page, "communication");
  });

  test("resets scroll on page navigation and closes mobile sidebar after route changes", async ({ page }) => {
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1400);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

    const pricingLink = page.locator('header nav[aria-label="프로모션 메뉴"] a[href="/promo/pricing"]');
    await expect(pricingLink).toHaveCount(1);
    await pricingLink.click();
    await expect(page).toHaveURL(/\/promo\/pricing$/);
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });

    const menuButton = page.locator('button[aria-controls="promo-mobile-sidebar"]');
    await menuButton.click();
    const sidebarFeaturesLink = page.locator('#promo-mobile-sidebar a[href="/promo/features"]');
    await expect(sidebarFeaturesLink).toHaveCount(1);
    await sidebarFeaturesLink.click();
    await expect(page).toHaveURL(/\/promo\/features$/);
    await expect(
      page.getByRole("heading", { name: "기능 소개" }),
    ).toBeVisible();

    await page.goto(`${BASE}/promo`, { waitUntil: "load" });
    await expect(menuButton).toHaveCount(1);
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    const sidebarPricingLink = page.locator('#promo-mobile-sidebar a[href="/promo/pricing"]');
    await expect(sidebarPricingLink).toHaveCount(1);
    await sidebarPricingLink.click();
    await expect(page).toHaveURL(/\/promo\/pricing$/);
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  for (const width of [390, 1100, 1366]) {
    test("opens the detailed guide and Instagram at " + width + "px", async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(BASE + "/promo", { waitUntil: "load" });
      const instagram = page.locator('header a[aria-label="인스타그램 @hakwon_p (새 창)"]');
      await expect(instagram).toBeVisible();
      await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/hakwon_p/");
      await expect(instagram).toHaveAttribute("target", "_blank");
      await expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
      // Keep this public navigation check offline and avoid depending on Instagram login.
      await page.context().route("https://www.instagram.com/hakwon_p/", route => route.fulfill({ status: 200, contentType: "text/html", body: "<title>학원플러스 Instagram</title>" }));
      const popupPromise = page.waitForEvent("popup");
      await instagram.click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL("https://www.instagram.com/hakwon_p/");
      await popup.close();
      await expect(page.getByRole("heading", { name: /수업 관리부터\s*학생의 복습까지/ })).toBeVisible();
      const screenshotPath = info.outputPath("promo-home-" + width + ".png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await info.attach("promo-home-" + width, { path: screenshotPath, contentType: "image/png" });
      await page.getByRole("link", { name: "43쪽 상세 가이드 보기" }).click();
      await expect(page.getByRole("heading", { name: "기능 상세 가이드", exact: true })).toBeVisible();
      const reader = page.getByRole("region", { name: "기능 둘러보기", exact: true });
      await expect(reader.getByRole("button", { name: "상세 설명 43쪽", exact: true })).toHaveAttribute("aria-pressed", "true");
      await reader.getByRole("button", { name: "엑셀 업로드", exact: true }).click();
      await expect(reader.getByLabel("설명서 페이지")).toHaveValue("16");
      await page.reload();
      await expect(reader.getByLabel("설명서 페이지")).toHaveValue("16");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }

  for (const width of [390, 1366]) {
    test("answers a question then opens the matching explanation at " + width + "px", async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(BASE + "/promo/faq#automatic-messages");
      const question = page.locator("#automatic-messages");
      await expect(question).toHaveAttribute("open", "");
      await expect(question).toContainText("승인 양식과 학원 설정");
      await question.getByRole("link", { name: "알림톡 발송 방식 보기" }).click();
      await expect(page).toHaveURL(/features#alimtalk-guide$/);
      const explanation = page.locator("#alimtalk-guide");
      await expect(explanation).toHaveAttribute("open", "");
      await expectHashAligned(page, "alimtalk-guide");
      await expect(explanation).toContainText("내 번호로 테스트 받아보기");
      await page.reload();
      await expect(explanation).toHaveAttribute("open", "");
      await explanation.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(explanation).not.toHaveAttribute("open", "");
      await page.keyboard.press("Enter");
      await expect(explanation).toHaveAttribute("open", "");
      await page.locator("#communication").getByRole("link", { name: "알림톡 발송 화면 보기" }).click();
      const reader = page.getByRole("region", { name: "기능 둘러보기", exact: true });
      await expect(reader.getByLabel("설명서 페이지")).toHaveValue("4");
      await page.goBack();
      await expect(explanation).toHaveAttribute("open", "");

      const screen = page.locator("#communication details").filter({ hasText: "실제 화면 보기" });
      await screen.locator("summary").click();
      const screenImage = screen.locator("img").first();
      await screenImage.scrollIntoViewIfNeeded();
      await screenImage.evaluate(async image => { await (image as HTMLImageElement).decode(); });
      await screenImage.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "실제 화면 크게 보기" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(screenImage).toBeFocused();

      await page.goto(BASE + "/promo/guide");
      const optionalScreens = page.locator("details").filter({ has: page.locator("summary", { hasText: "화면으로 기능 살펴보기" }) });
      await expect(optionalScreens).not.toHaveAttribute("open", "");
      await expect(page.getByPlaceholder("기능, 화면 이름, 막힌 상황 검색")).toBeInViewport();
      await page.goto(BASE + "/promo/guide?role=admin&q=수납");
      await expect(page.getByRole("navigation", { name: "주요 기능 이용 순서" }).getByRole("button").first()).toBeVisible();
      await expect(page.getByText("일치하는 안내가 없습니다.", { exact: false })).toHaveCount(0);
      await page.goto(BASE + "/promo/pricing#existing-contract");
      await expect(page.locator("#existing-contract")).toHaveAttribute("open", "");
      await page.reload();
      await expect(page.locator("#existing-contract").getByText("15만 9천원", { exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath("pricing-contract-" + width + ".png"), fullPage: true });
    });
  }
});
