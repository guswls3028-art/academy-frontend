import { onRequestGet } from "../../functions/[[path]].ts";
import { expect, test, type Page } from "../fixtures/strictTest";

const local = new URL(process.env.E2E_BASE_URL || "http://127.0.0.1:5174");
const defaultIcon = "/tenants/hakwonplus/apple-touch-icon.png?v=20261119";
const uploadedIcon = "/uploads/qa-touch-192.png";
const uploadedIconBytes = "/tenants/hakwonplus/pwa-192.png?v=20261119";
const unknownHostFallback = "/teacher-icons/icon-192.svg";

type Role = "student" | "parent";
type Metadata = "default" | "upload" | "unavailable";

async function openStudent(
  page: Page,
  origin: URL,
  role: Role,
  metadata: Metadata,
  waitForBrowserMetadata?: Promise<void>,
) {
  const tenantCode = origin.hostname === "tchul.com" ? "tchul" : "hakwonplus";
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: tenantCode,
    user_id: 771,
  })).toString("base64url");
  await page.addInitScript(({ token, code }) => {
    if (location.pathname !== "/student/guide") return;
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
  }, { token: `e30.${payload}.spec`, code: tenantCode });

  function brandMetadata() {
    return metadata === "unavailable"
      ? new Response(null, { status: 503 })
      : Response.json({
        title: "학원플러스",
        favicon: metadata === "upload" ? uploadedIcon : "/tenants/hakwonplus/favicon.png?v=20261119",
        ...(metadata === "upload" ? { apple_touch_icon: uploadedIcon, pwa_icon_192: uploadedIcon } : {}),
      });
  }

  const browserMetadataRequests: string[] = [];
  let initialDocument = "";
  await page.routeWebSocket("**/*", () => {});
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) {
      const headers = {
        "access-control-allow-origin": origin.origin,
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      switch (url.pathname) {
        case "/api/v1/core/og-meta/": {
          browserMetadataRequests.push(url.searchParams.get("hostname") ?? "");
          await waitForBrowserMetadata;
          const response = brandMetadata();
          return route.fulfill({
            status: response.status,
            contentType: "application/json",
            body: await response.text(),
            headers,
          });
        }
        case "/api/v1/core/program/":
          return route.fulfill({ json: { tenantCode, display_name: tenantCode === "tchul" ? "박철 과학" : "학원플러스", ui_config: {}, feature_flags: {}, is_active: true }, headers });
        case "/api/v1/core/me/":
          return route.fulfill({ json: {
            id: 771, username: "touch-icon-qa", name: "테스트 계정",
            is_staff: false, is_superuser: false, tenantRole: role, must_change_password: false,
            first_login_guide_required: false,
            linkedStudents: role === "parent" ? [{ id: 701, name: "첫째" }, { id: 702, name: "둘째" }] : [],
          }, headers });
        case "/api/v1/students/me/activity/":
          return route.fulfill({ status: 204, headers });
        default:
          return route.fulfill({ json: {}, headers });
      }
    }
    if (url.origin !== origin.origin || request.method() !== "GET") return route.abort();
    const upstreamPath = url.pathname === uploadedIcon ? uploadedIconBytes : url.pathname + url.search;
    const upstream = await page.request.get(new URL(upstreamPath, local).href, { maxRedirects: 0 });
    if (!request.isNavigationRequest()) return route.fulfill({ response: upstream });

    // Use the Vite-served index (including transformed module URLs) as Pages' asset.
    // The browser itself stays on the real host name but no request leaves the loopback fixture.
    const raw = await upstream.text();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const metadataUrl = new URL(String(input));
      expect(metadataUrl.pathname).toBe("/api/v1/core/og-meta/");
      // The Pages fallback supplies the default document without storing synthetic
      // metadata for the apex, which is also used by the uploaded-icon test.
      return metadata === "default" ? new Response(null, { status: 404 }) : brandMetadata();
    };
    try {
      const response = await onRequestGet({
        request: new Request(url),
        env: { ASSETS: { fetch: async () => new Response(raw, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }) } },
      } as never);
      initialDocument = await response.text();
      // The executable app is Vite's dev entry. Deployment's own CSP is independently
      // covered by the Pages contract; this test exercises the actual returned head and route.
      return route.fulfill({ status: response.status, contentType: "text/html; charset=utf-8", body: initialDocument });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await page.goto(new URL("/student/guide", origin).href);
  return { browserMetadataRequests, initialDocument };
}

async function readIcon(page: Page, href: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url);
    const image = new Image();
    image.src = url;
    await image.decode();
    return [response.headers.get("content-type"), image.naturalWidth, image.naturalHeight];
  }, href);
}

test.use({ serviceWorkers: "block" });
test.beforeEach(() => {
  test.skip(!["127.0.0.1", "localhost"].includes(local.hostname), "Requires loopback Vite assets");
});

test("학원플러스 학생은 서버의 180px 아이콘을 유지하고 별도 브랜드 조회를 하지 않는다", async ({ page }) => {
  const fixture = await openStudent(page, new URL("https://hakwonplus.com"), "student", "default");
  expect(fixture.initialDocument).toContain(`rel="apple-touch-icon" href="${defaultIcon}" sizes="180x180"`);
  await expect(page.getByRole("heading", { name: "수업부터 제출과 결과까지" })).toBeVisible();
  const icon = page.locator('head link[rel="apple-touch-icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", defaultIcon);
  await expect(icon).toHaveAttribute("sizes", "180x180");
  expect(await readIcon(page, defaultIcon)).toEqual(["image/png", 180, 180]);
  expect(fixture.browserMetadataRequests).toEqual([]);
});

test("학원플러스 학생은 서버의 192px 업로드 아이콘을 유지한다", async ({ page }) => {
  const fixture = await openStudent(page, new URL("https://hakwonplus.com"), "student", "upload");
  expect(fixture.initialDocument).toContain(`<link rel="apple-touch-icon" href="${uploadedIcon}" />`);
  await expect(page.getByRole("heading", { name: "수업부터 제출과 결과까지" })).toBeVisible();
  const icon = page.locator('head link[rel="apple-touch-icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", uploadedIcon);
  await expect(icon).not.toHaveAttribute("sizes", /.+/);
  expect(await readIcon(page, uploadedIcon)).toEqual(["image/png", 192, 192]);
  expect(fixture.browserMetadataRequests).toEqual([]);
});

test("학원플러스 학부모는 자녀 선택 뒤에도 서버의 업로드 아이콘을 유지한다", async ({ page }) => {
  const fixture = await openStudent(page, new URL("https://www.hakwonplus.com"), "parent", "upload");
  expect(fixture.initialDocument).toContain(`<link rel="apple-touch-icon" href="${uploadedIcon}" />`);
  await expect(page.getByRole("heading", { name: "확인할 자녀를 선택해 주세요" })).toBeVisible();
  await page.getByRole("tab", { name: "둘째" }).click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  await expect(page.getByRole("tab", { name: "둘째" })).toHaveAttribute("aria-selected", "true");
  const icon = page.locator('head link[rel="apple-touch-icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", uploadedIcon);
  await expect(icon).not.toHaveAttribute("sizes", /.+/);
  await page.reload();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  await expect(page.getByRole("tab", { name: "둘째" })).toHaveAttribute("aria-selected", "true");
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", uploadedIcon);
  await expect(icon).not.toHaveAttribute("sizes", /.+/);
  expect(fixture.browserMetadataRequests).toEqual([]);
  await page.getByRole("button", { name: "프로필 메뉴" }).click();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("link", { name: "기능 살펴보기" })).toBeVisible();
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", uploadedIcon);
  await expect(icon).not.toHaveAttribute("sizes", /.+/);
});

test("다른 학원의 학생 화면은 해당 학원의 기본 아이콘을 사용한다", async ({ page }) => {
  const fixture = await openStudent(page, new URL("https://tchul.com"), "student", "unavailable");
  expect(fixture.initialDocument).not.toContain('<link rel="apple-touch-icon"');
  await expect(page.getByRole("heading", { name: "수업부터 제출과 결과까지" })).toBeVisible();
  const icon = page.locator('head link[rel="apple-touch-icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", "/tenants/tchul/apple-touch-icon.png");
  expect(fixture.browserMetadataRequests).toEqual([]);
});

test("등록되지 않은 개발 호스트의 브랜드 조회 실패는 크기 없는 기본 아이콘으로 복구한다", async ({ page }) => {
  const fixture = await openStudent(page, local, "student", "unavailable");
  expect(fixture.initialDocument).not.toContain('<link rel="apple-touch-icon"');
  await expect(page.getByRole("heading", { name: "수업부터 제출과 결과까지" })).toBeVisible();
  await expect.poll(() => fixture.browserMetadataRequests.length).toBeGreaterThan(0);
  expect(new Set(fixture.browserMetadataRequests)).toEqual(new Set([local.hostname]));
  const icon = page.locator('head link[rel="apple-touch-icon"]');
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", unknownHostFallback);
  await expect(icon).not.toHaveAttribute("sizes", /.+/);
});

test("등록되지 않은 개발 호스트에서 늦게 받은 192px 업로드 아이콘에 크기를 단정하지 않는다", async ({ page }) => {
  let releaseMetadata!: () => void;
  const pending = new Promise<void>((resolve) => { releaseMetadata = resolve; });
  const fixture = await openStudent(page, local, "student", "upload", pending);
  const icon = page.locator('head link[rel="apple-touch-icon"]');
  try {
    expect(fixture.initialDocument).not.toContain('<link rel="apple-touch-icon"');
    await expect(page.getByRole("heading", { name: "수업부터 제출과 결과까지" })).toBeVisible();
    await expect.poll(() => fixture.browserMetadataRequests.length).toBeGreaterThan(0);
    expect(new Set(fixture.browserMetadataRequests)).toEqual(new Set([local.hostname]));
    await expect(icon).toHaveAttribute("href", unknownHostFallback);
    await expect(icon).not.toHaveAttribute("sizes", /.+/);
  } finally {
    releaseMetadata();
  }
  await expect(icon).toHaveCount(1);
  await expect(icon).toHaveAttribute("href", uploadedIcon);
  await expect(icon).not.toHaveAttribute("sizes", /.+/);
  expect(await readIcon(page, uploadedIcon)).toEqual(["image/png", 192, 192]);
});
