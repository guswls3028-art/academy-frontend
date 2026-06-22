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

  await page.route("**/api/v1/core/landing/public/**", async (route) => {
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
    await page.goto(`${BASE}/landing`, { waitUntil: "load" });
    await waitForRenderSettled(page);

    await expect(page).toHaveURL(/\/landing$/);
    await expect(page.getByRole("heading", { name: "구조 리팩토링 검증" })).toBeVisible();
    await expect(page.getByTestId("landing-hero-primary-cta")).toBeVisible();
  });

  test("renders a nested landing page without falling through to root auth redirects", async ({ page }) => {
    await page.goto(`${BASE}/landing/about`, { waitUntil: "load" });
    await waitForRenderSettled(page);

    await expect(page).toHaveURL(/\/landing\/about$/);
    await expect(page.getByRole("heading", { name: "테스트 아카데미 소개" })).toBeVisible();
    await expect(page.getByRole("link", { name: /적중 보고서/ }).first()).toBeVisible();
  });
});
