import type { Page, Request } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";

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

test.describe("promo business readiness", () => {
  test.beforeEach(async ({ page }) => {
    await stubPromoBootstrap(page);
  });

  test("presents matchup evidence and classroom PPT as distinct workflows", async ({ page }) => {
    await page.goto(`${BASE}/promo?utm_source=teacher-referral&utm_campaign=matchup-ppt`, {
      waitUntil: "load",
    });

    await expect(
      page.getByRole("heading", { name: "수업은 선생님답게. 반복 운영은 한곳에서." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "내 자료로 데모 요청" }).first()).toBeVisible();
    await expect(page.getByText("제품 실화면", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/개포고 데모 데이터/)).toBeVisible();
    await expect(page.getByText(/수업자료를 바로 PPT로 만들어 리모컨으로 넘겨 쓰고 싶다/)).toBeVisible();
    await expect(page.getByText("서로 다른 두 기능")).toBeVisible();
    await expect(page).toHaveTitle("학원플러스 | 대치 강사·원장을 위한 학원 운영 SaaS");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${BASE}/promo`);

    const productImages = page.locator('img[src^="/promo/"]');
    await expect(productImages.first()).toBeVisible();
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("requires explicit privacy consent and preserves first-touch UTM data in the lead", async ({ page }) => {
    let request: Request | null = null;
    await page.route("**/api/v1/core/landing/consult/", async (route) => {
      request = route.request();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 321, ok: true }),
      });
    });

    await page.goto(`${BASE}/promo?utm_source=kakao&utm_medium=message&utm_campaign=teacher-ppt`, {
      waitUntil: "load",
    });
    await page.getByRole("link", { name: "내 자료로 데모 요청" }).first().click();
    await expect(page).toHaveURL(/\/promo\/demo$/);

    await page.getByLabel("이름 *").fill("홍길동");
    await page.getByLabel("소속/수업명 *").fill("대치 고2 수학");
    await page.getByLabel("연락처 *").fill("010-0000-0000");

    const consent = page.getByRole("checkbox", { name: /개인정보 수집·이용에 동의/ });
    await expect(consent).not.toBeChecked();
    await expect(consent).toHaveJSProperty("required", true);
    await consent.check();
    await page.getByRole("button", { name: "데모 요청하기" }).click();

    await expect(page.getByRole("heading", { name: "데모 요청이 접수되었습니다" })).toBeVisible();
    expect(request).not.toBeNull();
    const payload = request!.postDataJSON() as {
      message: string;
      source: string;
      privacy_agreed: boolean;
      privacy_policy_version: string;
    };
    expect(payload.source).toBe("promo-demo");
    expect(payload.privacy_agreed).toBe(true);
    expect(payload.privacy_policy_version).toBe("1.2");
    expect(payload.message).toContain("개인정보 수집·이용: 동의");
    expect(payload.message).toContain("utm_source=kakao");
    expect(payload.message).toContain("utm_medium=message");
    expect(payload.message).toContain("utm_campaign=teacher-ppt");
  });

  test("reserves intrinsic space for images across the promo journey", async ({ page }) => {
    const routes = [
      "/promo",
      "/promo/features",
      "/promo/matchup-ppt",
      "/promo/parent-trust",
      "/promo/ai-grading",
      "/promo/video-platform",
      "/promo/faq",
    ];

    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "load" });
      const images = page.locator("img");
      await expect(images.first()).toBeVisible();
      expect(
        await images.evaluateAll((elements) =>
          elements.every((image) => image.hasAttribute("width") && image.hasAttribute("height")),
        ),
        `${route} should declare intrinsic image dimensions`,
      ).toBe(true);
    }
  });

  test("keeps keyboard focus inside the open mobile menu and restores it on close", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });

    const trigger = page.locator('button[aria-controls="promo-mobile-sidebar"]');
    await trigger.click();
    const sidebar = page.getByRole("complementary", { name: "프로모션 사이드 메뉴" });
    const close = sidebar.getByRole("button", { name: "메뉴 닫기" });
    const brand = sidebar.getByRole("link", { name: "학원플러스 프로모션 홈" });
    const phone = sidebar.getByRole("link", { name: "전화 문의하기" });
    await expect(close).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(brand).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(phone).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(brand).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect(page.locator("#promo-mobile-sidebar")).toHaveAttribute("aria-hidden", "true");
  });
});
