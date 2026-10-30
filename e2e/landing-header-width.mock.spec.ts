import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const BRAND = "Ymath 실사용 복제 검증 아카데미 교육센터";
const ROLES = [
  { role: "admin", label: "관리실", destination: "/workspace" },
  { role: "student", label: "내 학생앱", destination: "/student" },
  { role: "parent", label: "학부모 페이지", destination: "/student" },
] as const;

async function installScenario(page: Page, role: string) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "tchul", user_id: 12 })).toString("base64url");
  const token = `e30.${payload}.sig`;
  await page.addInitScript(({ token }) => {
    localStorage.setItem("tenant_code", "tchul");
    sessionStorage.setItem("tenantCode", "tchul");
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, { token });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const headers = {
      "access-control-allow-origin": BASE,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    const json = (body: unknown) => route.fulfill({ status: 200, headers, json: body });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/token/refresh/") return json({ access: token, refresh: `${token}-refresh` });
    if (path === "/core/program/") return json({ tenantCode: "tchul", display_name: BRAND, ui_config: {}, feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "qa-layout", name: "검증 계정", is_staff: role === "admin", is_superuser: false, tenantRole: role, linkedStudents: null, must_change_password: false });
    if (path === "/core/landing/public/") return json({
      has_landing: true, template_key: "premium_dark",
      config: { brand_name: BRAND, template_key: "premium_dark", tagline: "검증 학원", cta_text: "수강 문의", cta_link: "/login", contact: { inquiries: [] }, sections: [] },
    });
    if (path === "/core/landing/has-published/") return json({ has_published: true });
    if (path === "/community/posts/4401/") return json({
      id: 4401, post_type: "board", title: "사진 저장 확인", content: "<p>학원 커뮤니티 상세를 확인합니다.</p>",
      created_by: 12, created_by_display: "검증 선생님", author_role: "staff", created_at: "2026-10-30T00:00:00Z",
      replies_count: 0, mappings: [], attachments: [],
    });
    if (path === "/community/posts/4401/replies/") return json([]);
    if (path === "/community/posts/4401/neighbors/") return json({ prev: null, next: null });
    return json({ count: 0, next: null, results: [] });
  });
}

async function assertHeader(page: Page, label: string, destination: string) {
  const nav = page.locator("nav").first();
  const brand = page.getByTestId("landing-nav-brand");
  await expect(brand).toBeVisible();
  await expect(brand).toHaveAttribute("title", BRAND);
  await expect(brand).toHaveAttribute("href", "/landing");
  await expect(nav.getByTestId("landing-nav-myconsole")).toHaveText(label);
  await expect(nav.getByTestId("landing-nav-myconsole")).toHaveAttribute("href", destination);
  for (const control of [nav.getByTestId("landing-nav-burger"), nav.getByTestId("landing-nav-myconsole")]) {
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) - 19);
  }
  expect(await page.locator("html").evaluate((html) => html.scrollWidth - html.clientWidth)).toBeLessThanOrEqual(1);
}

for (const { role, label, destination } of ROLES) for (const width of [1366, 390]) {
  test(`긴 학원명과 ${role} 이동 버튼은 ${width}px에서 메뉴·새로고침 후에도 화면 안에 남는다`, async ({ page }, info) => {
    test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(BASE), "합성 route-mock 로컬 검증 전용");
    await page.setViewportSize({ width, height: 900 });
    await installScenario(page, role);
    await page.goto(`${BASE}/landing/community/board/posts/4401`);
    await expect(page.getByRole("heading", { name: "사진 저장 확인", exact: true })).toBeVisible();
    await assertHeader(page, label, destination);
    if (width === 1366) for (const key of ["about", "community", "matchup", "guide", "service"]) {
      await expect(page.getByTestId(`landing-nav-top-${key}`)).toBeInViewport();
    }
    await page.reload();
    await assertHeader(page, label, destination);
    await page.getByTestId("landing-nav-burger").click();
    const panel = page.getByRole("dialog", { name: "전체 메뉴", exact: true });
    await expect(panel.getByText(BRAND, { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "메뉴 닫기", exact: true })).toBeVisible();
    expect(await panel.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await panel.getByRole("button", { name: "메뉴 닫기", exact: true }).click();
    await expect(panel).toBeHidden();
    await page.getByTestId("landing-nav-burger").click();
    await panel.getByRole("button", { name: "자유게시판", exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/landing/board`);
    await expect(page.getByRole("heading", { name: "학원 가족이 함께 쓰는 자유게시판", exact: true })).toBeVisible();
    await assertHeader(page, label, destination);
    await info.attach(`landing-header-${role}-${width}.png`, { body: await page.screenshot(), contentType: "image/png" });
  });
}