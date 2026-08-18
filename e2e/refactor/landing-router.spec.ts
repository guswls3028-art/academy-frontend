import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { waitForRenderSettled } from "../helpers/wait";

function resolveLocalBase(): string {
  const explicit = process.env.E2E_LANDING_BASE_URL || process.env.E2E_LOCAL_BASE_URL;
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

function localJwt(userId: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "dnb",
    user_id: userId,
  })}.sig`;
}

const landingConfig = {
  brand_name: "테스트 아카데미",
  tagline: "구조 리팩토링 검증",
  subtitle: "랜딩 route island가 공개 홈과 하위 페이지를 독립적으로 렌더합니다.",
  primary_color: "#2563EB",
  hero_image_url: "",
  logo_url: "",
  cta_text: "상담 문의",
  cta_link: "#contact",
  contact: {
    phone: "02-0000-0000",
    email: "test@example.com",
    address: "서울시 테스트구",
  },
  sections: [
    {
      type: "hero",
      enabled: true,
      order: 1,
      title: "구조 리팩토링 검증",
      description: "라우터 분리 검증용 히어로",
    },
    {
      type: "features",
      enabled: true,
      order: 2,
      title: "검증 포인트",
      items: [
        {
          icon: "check",
          title: "독립 라우터",
          description: "AppRouter가 랜딩 페이지 묶음을 직접 소유하지 않습니다.",
        },
      ],
    },
    {
      type: "contact",
      enabled: true,
      order: 3,
      title: "문의",
    },
  ],
  template_key: "minimal_tutor",
};

async function stubLandingPublic(page: Page, config = landingConfig) {
  await page.route("**/api/v1/core/landing/public/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        has_landing: true,
        template_key: "minimal_tutor",
        config,
      }),
    });
  });
}

async function stubLandingBootstrap(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("tenant_code", "dnb");
    try { sessionStorage.setItem("tenantCode", "dnb"); } catch { /* ignore */ }
  });

  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "dnb",
        display_name: "테스트 아카데미",
        ui_config: { login_title: "테스트 아카데미" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });

  await stubLandingPublic(page);

  await page.route("**/api/v1/core/landing/testimonial/public/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route("**/api/v1/landing-public/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/reviews/summary/")
      ? { count: 0, average: 0, distribution: {} }
      : { count: 0, next: null, previous: null, results: [] };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("landing route island", () => {
  test.beforeEach(async ({ page }) => {
    await stubLandingBootstrap(page);
  });

  test("renders the public landing home through the isolated router", async ({ page }) => {
    await page.goto(`${BASE}/landing`, { waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page);

    await expect(page).toHaveURL(/\/landing$/);
    await expect(page.getByRole("heading", { name: "구조 리팩토링 검증" })).toBeVisible();
    await expect(page.getByTestId("landing-hero-primary-cta")).toBeVisible();
  });

  test("recovers the public home from one transient landing API failure", async ({ page }) => {
    let attempts = 0;
    await page.unroute("**/api/v1/core/landing/public/**");
    await page.route("**/api/v1/core/landing/public/**", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "temporarily unavailable" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          has_landing: true,
          template_key: "minimal_tutor",
          config: landingConfig,
        }),
      });
    });

    await page.goto(`${BASE}/landing`, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/landing$/);
    await expect(page.getByRole("heading", { name: "구조 리팩토링 검증" })).toBeVisible();
    expect(attempts).toBe(2);
  });

  test("keeps a repeated landing API failure distinct from an unpublished home", async ({ page }, testInfo) => {
    let attempts = 0;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.unroute("**/api/v1/core/landing/public/**");
    await page.route("**/api/v1/core/landing/public/**", async (route) => {
      attempts += 1;
      if (attempts <= 3) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "temporarily unavailable" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          has_landing: true,
          template_key: "minimal_tutor",
          config: landingConfig,
        }),
      });
    });

    await page.goto(`${BASE}/landing`, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/landing$/);
    await expect(page.getByRole("heading", { name: "홈페이지 연결이 잠시 원활하지 않습니다" })).toBeVisible();
    const retryButton = page.getByRole("button", { name: "다시 불러오기" });
    const compactMetrics = await page.evaluate(() => ({
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(compactMetrics).toEqual({ overflow: 0, viewportWidth: 390 });
    const retryButtonBox = await retryButton.boundingBox();
    expect(retryButtonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    const screenshotPath = testInfo.outputPath("landing-connection-error-390.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach("landing-connection-error-390.png", { path: screenshotPath, contentType: "image/png" });

    await page.setViewportSize({ width: 1366, height: 900 });
    await expect(page.getByRole("heading", { name: "홈페이지 연결이 잠시 원활하지 않습니다" })).toBeVisible();
    const desktopOverflow = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    );
    expect(desktopOverflow).toBe(0);
    const desktopScreenshotPath = testInfo.outputPath("landing-connection-error-1366.png");
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    await testInfo.attach("landing-connection-error-1366.png", { path: desktopScreenshotPath, contentType: "image/png" });

    await retryButton.click();
    await expect(page.getByRole("heading", { name: "구조 리팩토링 검증" })).toBeVisible();
    await expect(page).toHaveURL(/\/landing$/);
    expect(attempts).toBe(4);
  });

  test("still sends an intentionally unpublished home to login", async ({ page }) => {
    await page.unroute("**/api/v1/core/landing/public/**");
    await page.route("**/api/v1/core/landing/public/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_landing: false, config: null }),
      });
    });

    await page.goto(`${BASE}/landing`, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("renders a nested landing page without falling through to root auth redirects", async ({ page }) => {
    await page.goto(`${BASE}/landing/about`, { waitUntil: "load" });
    await waitForRenderSettled(page);

    await expect(page).toHaveURL(/\/landing\/about$/);
    await expect(page.getByRole("heading", { name: "테스트 아카데미 소개" })).toBeVisible();
    await expect(page.getByRole("link", { name: /적중 보고서/ }).first()).toBeVisible();
  });

  test("restores a community draft only for the exact tenant and user", async ({ page }) => {
    const token = localJwt(12);
    await page.addInitScript(({ access }) => {
      const savedAt = Date.now();
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", `${access}-refresh`);
      localStorage.setItem("landing-community-draft:board", JSON.stringify({
        title: "소유자를 알 수 없는 기존 초안",
        content: "현재 사용자에게 자동 복원하면 안 됩니다.",
        board: "board",
        savedAt,
      }));
      localStorage.setItem("landing-community-draft:board:other:user:12", JSON.stringify({
        title: "다른 학원 초안",
        content: "테넌트가 다릅니다.",
        board: "board",
        savedAt,
      }));
      localStorage.setItem("landing-community-draft:board:dnb:user:13", JSON.stringify({
        title: "다른 사용자 초안",
        content: "계정이 다릅니다.",
        board: "board",
        savedAt,
      }));
      localStorage.setItem("landing-community-draft:board:dnb:user:12", JSON.stringify({
        title: "현재 사용자 초안",
        content: "이 내용만 안전하게 복원합니다.",
        board: "board",
        savedAt,
      }));
    }, { access: token });
    await page.route("**/api/v1/core/me/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 12,
          username: "dnb-teacher",
          name: "담당 강사",
          is_staff: true,
          is_superuser: false,
          tenantRole: "teacher",
          must_change_password: false,
          first_login_guide_required: false,
        }),
      });
    });

    await page.goto(`${BASE}/landing/community/board/write`, { waitUntil: "load" });
    await expect(page.getByText("작성 중이던 글이 있어요. 이어 작성할까요?", { exact: false })).toBeVisible();
    await expect(page.getByText("현재 사용자 초안", { exact: false })).toBeVisible();
    await expect(page.getByText("다른 학원 초안", { exact: false })).toHaveCount(0);
    await expect(page.getByText("다른 사용자 초안", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "이어 작성", exact: true }).click();

    const title = page.getByTestId("landing-community-write-title");
    const content = page.getByTestId("landing-community-write-content");
    await expect(title).toHaveValue("현재 사용자 초안");
    await expect(content).toHaveValue("이 내용만 안전하게 복원합니다.");
    await title.fill("현재 사용자 수정 초안");

    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem("landing-community-draft:board:dnb:user:12");
      return raw ? JSON.parse(raw).title : null;
    })).toBe("현재 사용자 수정 초안");
    const untouched = await page.evaluate(() => ({
      legacy: JSON.parse(localStorage.getItem("landing-community-draft:board") || "null")?.title,
      otherTenant: JSON.parse(localStorage.getItem("landing-community-draft:board:other:user:12") || "null")?.title,
      otherUser: JSON.parse(localStorage.getItem("landing-community-draft:board:dnb:user:13") || "null")?.title,
    }));
    expect(untouched).toEqual({
      legacy: "소유자를 알 수 없는 기존 초안",
      otherTenant: "다른 학원 초안",
      otherUser: "다른 사용자 초안",
    });
  });

  test("scopes a 24-hour notice dismissal to the exact tenant notice", async ({ page }) => {
    const firstNotice = {
      enabled: true,
      title: "첫 번째 운영 공지",
      content: "오늘 수업 일정을 확인해 주세요.",
      link: "/landing/about",
    };
    await page.unroute("**/api/v1/core/landing/public/**");
    await stubLandingPublic(page, { ...landingConfig, notice_popup: firstNotice });
    await page.addInitScript(() => {
      localStorage.setItem(
        "landing-notice-popup-skip",
        String(Date.now() + 24 * 60 * 60 * 1000),
      );
    });

    await page.goto(`${BASE}/landing`, { waitUntil: "load" });
    await expect(page.getByRole("dialog", { name: "학원 공지" })).toBeVisible();
    await expect(page.getByRole("heading", { name: firstNotice.title })).toBeVisible();
    await page.getByTestId("landing-notice-popup-skip").click();

    const scopedKeys = await page.evaluate(() => Object.keys(localStorage));
    expect(scopedKeys.some((key) => (
      key.startsWith("landing-notice-popup-skip:") && key.endsWith(":dnb")
    ))).toBe(true);

    await page.reload({ waitUntil: "load" });
    await expect(page.getByRole("dialog", { name: "학원 공지" })).toHaveCount(0);

    await page.unroute("**/api/v1/core/landing/public/**");
    await stubLandingPublic(page, {
      ...landingConfig,
      notice_popup: { ...firstNotice, title: "수정된 새 운영 공지" },
    });
    await page.reload({ waitUntil: "load" });

    await expect(page.getByRole("heading", { name: "수정된 새 운영 공지" })).toBeVisible();
  });
});
