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

  test("presents the operating system first and groups the four core strengths", async ({ page }) => {
    await page.goto(`${BASE}/promo?utm_source=teacher-referral&utm_campaign=matchup-ppt`, {
      waitUntil: "load",
    });

    await expect(
      page.getByRole("heading", { name: "학원의 수업과 운영을 한 흐름으로 관리합니다." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "내 학원 기준으로 확인" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "프로그램의 중심은 매일 반복되는 학원 관리입니다" })).toBeVisible();

    const categoryTabs = page.getByRole("tablist", { name: "학원플러스 핵심 기능" });
    const autoplayToggle = page.getByRole("button", { name: "자동 전환 멈춤" });
    await expect(autoplayToggle).toHaveAttribute("aria-pressed", "false");
    await autoplayToggle.click();
    await expect(page.getByRole("button", { name: "자동 전환 켜기" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "내 학원 기준으로 확인" }).first().focus();
    // eslint-disable-next-line no-restricted-syntax -- prove pause persists across the 5.6s autoplay boundary
    await page.waitForTimeout(5_800);
    await expect(categoryTabs.getByRole("tab", { name: /영상 수업/ })).toHaveAttribute("aria-selected", "true");
    await expect(categoryTabs.getByRole("tab", { name: /알림톡 안내/ })).toBeVisible();
    await expect(categoryTabs.getByRole("tab", { name: /자료 제작/ })).toBeVisible();
    await expect(categoryTabs.getByRole("tab", { name: /학원 홈페이지/ })).toBeVisible();

    await categoryTabs.getByRole("tab", { name: /영상 수업/ }).focus();
    await page.keyboard.press("End");
    await expect(categoryTabs.getByRole("tab", { name: /학원 홈페이지/ })).toBeFocused();
    await expect(categoryTabs.getByRole("tab", { name: /학원 홈페이지/ })).toHaveAttribute("aria-selected", "true");

    await categoryTabs.getByRole("tab", { name: /학원 홈페이지/ }).click();
    await expect(page.getByRole("tabpanel").getByRole("heading", { name: "우리 학원에 맞는 홈페이지를 함께 운영합니다" })).toBeVisible();
    await expect(page.getByRole("tabpanel").getByRole("link", { name: "홈페이지 형식 보기" })).toBeVisible();

    await categoryTabs.getByRole("tab", { name: /자료 제작/ }).click();
    await expect(page.getByRole("tabpanel").getByRole("heading", { name: "반복되는 수업자료 작업을 줄입니다" })).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText(/PDF 문항을 자동으로 나누거나 문제·개념별로 준비한 이미지/)).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText(/매치업에서는 실제 시험과 시험 전에 다룬 자료/)).toBeVisible();

    await expect(page).toHaveTitle("학원플러스 | 학원의 수업과 운영을 한 흐름으로");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${BASE}/promo`);

    const productImages = page.locator('img[src^="/promo/"]');
    await expect(productImages.first()).toBeVisible();
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(5600);

    await page.goto(`${BASE}/promo/matchup-ppt`, { waitUntil: "load" });
    await expect(page.getByText(/매치업은 실제 시험과 우리 학원 사전 대비 자료를 비교/).first()).toBeVisible();
    await expect(page.getByText(/PPT 생성기는 자료를 PDF 문항으로 나누거나 준비한 이미지별로 배치해/).first()).toBeVisible();
  });

  test("orders the full feature guide around operations, video, communication, homepage, then tools", async ({ page }) => {
    await page.goto(`${BASE}/promo/features`, { waitUntil: "load" });

    await expect(
      page.getByRole("heading", { name: "학원 운영의 기본과 네 가지 핵심 영역을 나눠서 확인하세요" }),
    ).toBeVisible();
    await expect(page.getByText("학원 운영 대시보드", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "학원 홈페이지", exact: true })).toBeVisible();

    const positions = await page.evaluate(() => {
      const findTop = (id: string) => document.getElementById(id)?.getBoundingClientRect().top ?? Number.MAX_SAFE_INTEGER;
      return {
        video: findTop("student-video-flow"),
        communication: findTop("communication"),
        website: findTop("academy-homepage-flow"),
        tools: findTop("matchup-ppt-flow"),
      };
    });
    expect(positions.video).toBeLessThan(positions.communication);
    expect(positions.communication).toBeLessThan(positions.website);
    expect(positions.website).toBeLessThan(positions.tools);
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
    await page.getByRole("link", { name: "내 학원 기준으로 확인" }).first().click();
    await expect(page).toHaveURL(/\/promo\/demo$/);

    await page.getByLabel("이름 *").fill("홍길동");
    await page.getByLabel("소속/수업명 *").fill("대치 고2 수학");
    await page.getByLabel("연락처 *").fill("010-0000-0000");

    const consent = page.getByRole("checkbox", { name: /개인정보 수집·이용에 동의/ });
    await expect(consent).not.toBeChecked();
    await expect(consent).toHaveJSProperty("required", true);
    await expect(
      page.getByText(
        /이름, 소속\/수업명, 연락처\(필수\).*이메일, 담당 수강생 수, 현재 수업 관리 방식, 관심 기능, 요청 사항, 유입 정보\(선택\)/,
      ),
    ).toBeVisible();
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

    await page.goto(`${BASE}/promo/contact`, { waitUntil: "load" });
    await expect(
      page.getByText(
        /이름, 연락처, 문의 유형, 문의 내용\(필수\).*이메일, 소속\/수업명, 담당 수강생 수, 유입 정보\(선택\)/,
      ),
    ).toBeVisible();
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

  test("describes grading and the continuing August price without unsupported promises", async ({ page }) => {
    await page.goto(`${BASE}/promo/ai-grading`, { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "정답이 명확한 문항은 자동으로, 서술형은 선생님이 직접 채점합니다" }),
    ).toBeVisible();
    await expect(
      page.getByText(/서술형 답안은 선생님이 확인하고 점수를 확정합니다/).first(),
    ).toBeVisible();
    await expect(page.getByText(/일부 수학 단답형.*0~999 정수/).first()).toBeVisible();
    await expect(page.getByText("정답이 숫자인 단답형", { exact: true })).toHaveCount(0);

    await page.goto(`${BASE}/promo/pricing`, { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "8월에 가입하면 월 159,000원이 계속 적용됩니다" }),
    ).toBeVisible();
    await expect(page.getByText(/서비스를 이용하는 동안 월 159,000원이 계속 적용/).first()).toBeVisible();
    await expect(page.getByText(/선착순|마감 임박|지금 신청/)).toHaveCount(0);
  });

  test("uses calm academy language across every promotion page", async ({ page }) => {
    const routes = [
      "/promo",
      "/promo/features",
      "/promo/matchup-ppt",
      "/promo/parent-trust",
      "/promo/ai-grading",
      "/promo/video-platform",
      "/promo/pricing",
      "/promo/faq",
      "/promo/contact",
      "/promo/demo",
    ];

    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "load" });
      const copy = await page.locator("body").innerText();
      expect(copy, `${route} should avoid software-industry wording`).not.toMatch(
        /SaaS|제품 UI|제품 화면|표준 기능|좌석 과금|단일 요금제|도입 범위/,
      );
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

  test("places the mobile menu on the left and scrolls its contents on a short screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 667 });
    await page.goto(`${BASE}/promo`, { waitUntil: "load" });

    const trigger = page.locator('button[aria-controls="promo-mobile-sidebar"]');
    const headerBrand = page.locator("header").getByRole("link", { name: "학원플러스 프로모션 홈" });
    const [triggerBox, brandBox] = await Promise.all([trigger.boundingBox(), headerBrand.boundingBox()]);
    expect(triggerBox).not.toBeNull();
    expect(brandBox).not.toBeNull();
    expect(triggerBox!.x).toBeLessThan(brandBox!.x);
    expect(triggerBox!.x).toBeLessThan(40);

    await trigger.click();
    const scrollRegion = page.getByTestId("promo-mobile-sidebar-scroll");
    await expect(scrollRegion).toHaveCSS("overflow-y", "auto");
    expect(
      await scrollRegion.evaluate((element) => element.scrollHeight > element.clientHeight),
      "short mobile sidebar should have scrollable content",
    ).toBe(true);

    await scrollRegion.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(
      page.locator("#promo-mobile-sidebar").getByRole("link", { name: "전화 문의하기" }),
    ).toBeVisible();
  });
});
