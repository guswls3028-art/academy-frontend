import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

const initialSections = [
  { type: "hero", enabled: true, order: 0, title: "메인 배너" },
  { type: "features", enabled: true, order: 1, title: "특징 소개" },
  { type: "contact", enabled: true, order: 2, title: "문의 정보" },
  { type: "about", enabled: false, order: 3, title: "소개" },
  { type: "faq", enabled: false, order: 4, title: "자주 묻는 질문" },
];

function landingResponse(sections = initialSections) {
  return {
    template_key: "minimal_tutor",
    is_published: false,
    draft_config: {
      brand_name: "학원플러스",
      tagline: "학생의 성장을 함께 봅니다",
      subtitle: "학원 소개",
      primary_color: "#2563EB",
      hero_image_url: "",
      logo_url: "",
      cta_text: "상담 신청",
      cta_link: "/landing/consult",
      contact: { phone: "02-123-4567", email: "", address: "서울" },
      sections,
    },
    published_config: null,
    updated_at: "2026-08-23T09:00:00+09:00",
  };
}

async function installLandingEditor(page: Page) {
  let current = landingResponse();
  const saveBodies: Array<Record<string, unknown>> = [];
  const access = localJwt();
  await page.addInitScript(({ accessToken }) => {
    localStorage.setItem("tenant_code", "hakwonplus");
    localStorage.setItem("access", accessToken);
    localStorage.setItem("refresh", `${accessToken}-refresh`);
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { accessToken: access });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (pathname === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: { login_title: "학원플러스" },
        feature_flags: {},
        is_active: true,
      });
    }
    if (pathname === "/core/me/") {
      return json({
        id: 12,
        username: "owner",
        name: "학원장",
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
        first_login_guide_required: false,
      });
    }
    if (pathname === "/core/landing/templates/") {
      return json({
        templates: [{
          key: "minimal_tutor",
          name: "미니멀 튜터",
          description: "간결한 학원 소개",
          mood: "clean",
          preview_color: "#2563EB",
        }],
      });
    }
    if (pathname === "/core/landing/admin/" && request.method() === "PUT") {
      const body = request.postDataJSON() as Record<string, unknown>;
      saveBodies.push(body);
      current = {
        ...current,
        draft_config: body.draft_config as typeof current.draft_config,
      };
      return json(current);
    }
    if (pathname === "/core/landing/admin/") return json(current);
    if (pathname === "/core/landing/has-published/") return json({ has_published: false });
    return json({ count: 0, next: null, previous: null, results: [] });
  });
  return saveBodies;
}

async function activeTypes(page: Page): Promise<string[]> {
  return page
    .getByTestId("landing-section-organizer")
    .locator("ol [data-section-type]")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.sectionType || ""));
}

test.use({ serviceWorkers: "block" });

test.describe("홈페이지 모듈 순서 편집", () => {
  test("현재 공개 흐름과 모듈 라이브러리를 구분하고 저장 후 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const saveBodies = await installLandingEditor(page);
    await page.goto(`${BASE}/workspace/settings/landing`, { waitUntil: "domcontentloaded" });

    const organizer = page.getByTestId("landing-section-organizer");
    await expect(organizer).toBeVisible({ timeout: 60_000 });
    await expect(organizer.getByRole("heading", { name: "현재 보이는 모듈" })).toBeVisible();
    await expect(organizer.getByRole("heading", { name: "모듈 라이브러리" })).toBeVisible();
    await expect(organizer).toContainText("3개 모듈 사용 중");
    expect(await activeTypes(page)).toEqual(["hero", "features", "contact"]);

    await organizer.getByRole("button", { name: "특징 소개 아래로 이동" }).click();
    expect(await activeTypes(page)).toEqual(["hero", "contact", "features"]);
    const aboutLibraryCard = organizer.locator('article[data-section-type="about"]');
    await aboutLibraryCard.getByRole("button", { name: "홈페이지에 추가" }).click();
    expect(await activeTypes(page)).toEqual(["hero", "contact", "features", "about"]);
    await organizer.locator('li[data-section-type="hero"]').getByRole("button", { name: "홈페이지에서 빼기" }).click();
    expect(await activeTypes(page)).toEqual(["contact", "features", "about"]);
    await expect(organizer.locator('article[data-section-type="hero"]')).toBeVisible();

    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("저장되었습니다")).toBeVisible();
    expect(saveBodies).toHaveLength(1);
    const savedConfig = saveBodies[0].draft_config as { sections: Array<{ type: string; enabled: boolean; order: number }> };
    expect(savedConfig.sections.map(({ type, enabled, order }) => ({ type, enabled, order }))).toEqual([
      { type: "contact", enabled: true, order: 0 },
      { type: "features", enabled: true, order: 1 },
      { type: "about", enabled: true, order: 2 },
      { type: "hero", enabled: false, order: 3 },
      { type: "faq", enabled: false, order: 4 },
    ]);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("landing-section-organizer")).toBeVisible({ timeout: 60_000 });
    expect(await activeTypes(page)).toEqual(["contact", "features", "about"]);
    await page.screenshot({ path: "test-results/landing-editor-sections/active-flow-1366.png", fullPage: true });
  });

  test("390px에서도 공개 순서와 추가 동작이 가로로 잘리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installLandingEditor(page);
    await page.goto(`${BASE}/workspace/settings/landing`, { waitUntil: "domcontentloaded" });

    const organizer = page.getByTestId("landing-section-organizer");
    await expect(organizer).toBeVisible({ timeout: 60_000 });
    await expect(organizer.locator('li[data-section-type="features"]')).toBeVisible();
    await expect(organizer.locator('article[data-section-type="about"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await organizer.locator('article[data-section-type="about"]').getByRole("button", { name: "홈페이지에 추가" }).click();
    await expect(organizer.locator('li[data-section-type="about"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/landing-editor-sections/mobile-390.png", fullPage: true });
  });
});
