import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "./fixtures/strictTest";
import { onRequestGet } from "../functions/[[path]].ts";
import {
  getTenantCodeFromHostname,
  getTenantDefByHostname,
  getTenantHeaderCssVars,
} from "../src/shared/tenant";

function manifestRequest(host: string, pathname: string) {
  return onRequestGet({
    request: new Request(`https://${host}${pathname}`),
    env: {
      ASSETS: {
        fetch: async () => new Response("not used", { status: 404 }),
      },
    },
  } as never);
}

function documentRequest(host: string, pathname: string) {
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  return onRequestGet({
    request: new Request(`https://${host}${pathname}`),
    env: {
      ASSETS: {
        fetch: async () => new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
      },
    },
  } as never);
}

test("known tenant teacher and student manifests use only that tenant's icons", async () => {
  const teacher = await manifestRequest("tchul.com", "/teacher-manifest.json");
  const student = await manifestRequest("tchul.com", "/student-manifest.json");
  const teacherManifest = await teacher.json() as {
    name: string;
    id: string;
    start_url: string;
    scope: string;
    icons: Array<{ src: string; sizes: string }>;
  };
  const studentManifest = await student.json() as {
    name: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string }>;
  };

  expect(teacherManifest.name).toBe("박철 과학 모바일 업무");
  expect(teacherManifest.id).toBe("/teacher");
  expect(teacherManifest.start_url).toBe("/workspace/mobile");
  expect(teacherManifest.scope).toBe("/workspace/mobile");
  expect(teacherManifest.icons).toEqual([
    expect.objectContaining({ src: "/tenants/tchul/pwa-192.png", sizes: "192x192" }),
    expect.objectContaining({ src: "/tenants/tchul/pwa-512.png", sizes: "512x512" }),
  ]);
  expect(studentManifest.name).toBe("박철 과학 학생");
  expect(studentManifest.start_url).toBe("/student");
  expect(JSON.stringify(studentManifest)).not.toContain("hakwonplus");
});

test("godmin host resolves its registry, PWA metadata, and committed icons", async ({ page }) => {
  const entryHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  const teacher = await manifestRequest("godmin.kr", "/teacher-manifest.json");
  const student = await manifestRequest("www.godmin.kr", "/student-manifest.json");
  const teacherManifest = await teacher.json() as {
    name: string;
    short_name: string;
    theme_color: string;
    background_color: string;
    icons: Array<{ src: string; sizes: string }>;
  };
  const studentManifest = await student.json() as {
    name: string;
    icons: Array<{ src: string; sizes: string }>;
  };

  expect(getTenantCodeFromHostname("godmin.kr")).toEqual({
    ok: true,
    code: "godmin",
    source: "hostname",
  });
  const godmin = getTenantDefByHostname("www.godmin.kr");
  expect(godmin?.branding.headerLogoUrl).toBe("/tenants/godmin/icon.png");
  expect(getTenantHeaderCssVars(godmin?.branding)).toEqual({
    "--tenant-header-surface": "#e4f7ef",
    "--tenant-header-surface-soft": "#d2f0e2",
    "--tenant-header-foreground": "#24483d",
    "--tenant-header-accent": "#147a62",
  });
  expect(teacherManifest.name).toBe("신과함께 모바일 업무");
  expect(teacherManifest.short_name).toBe("신과함께");
  expect(teacherManifest.theme_color).toBe("#147a62");
  expect(teacherManifest.background_color).toBe("#e4f7ef");
  expect(teacherManifest.icons).toEqual([
    expect.objectContaining({ src: "/tenants/godmin/pwa-192.png", sizes: "192x192" }),
    expect.objectContaining({ src: "/tenants/godmin/pwa-512.png", sizes: "512x512" }),
  ]);
  expect(studentManifest.name).toBe("신과함께 학생");
  expect(JSON.stringify(studentManifest)).not.toContain("hakwonplus");
  expect(entryHtml).toContain('"godmin.kr":       { t: "신과함께"');
  expect(entryHtml).toContain('"www.godmin.kr":   { t: "신과함께"');
  expect(entryHtml).toContain('tc: "#147a62"');
  await page.route("https://godmin.kr/**", async (route) => {
    if (route.request().resourceType() === "document") {
      await route.fulfill({
        body: entryHtml,
        contentType: "text/html; charset=utf-8",
        status: 200,
      });
      return;
    }
    const contentType = route.request().resourceType() === "script"
      ? "application/javascript"
      : "text/plain";
    await route.fulfill({ body: "", contentType, status: 200 });
  });
  await page.goto("https://godmin.kr/login", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("신과함께");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "신과함께");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "신과함께");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#147a62");
  for (const filename of [
    "logo.png",
    "icon.png",
    "favicon.png",
    "og-image.png",
    "apple-touch-icon.png",
    "pwa-192.png",
    "pwa-512.png",
  ]) {
    expect(readFileSync(resolve(process.cwd(), "public", "tenants", "godmin", filename)).length)
      .toBeGreaterThan(0);
  }
});

test("custom tenant manifest consumes uploaded branding without HakwonPlus fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    title: "새봄학원",
    pwa_icon_192: "https://cdn.example.com/tenant/new/logo.png",
    pwa_icon_512: "https://cdn.example.com/tenant/new/logo.png",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  try {
    const response = await manifestRequest("new-academy.example", "/teacher-manifest.json");
    const manifest = await response.json() as {
      name: string;
      short_name: string;
      icons: Array<{ src: string; sizes: string }>;
    };
    expect(manifest.name).toBe("새봄학원 모바일 업무");
    expect(manifest.short_name).toBe("새봄학원");
    expect(manifest.icons[0]).toEqual(expect.objectContaining({
      src: "https://cdn.example.com/tenant/new/logo.png",
      sizes: "any",
    }));
    expect(JSON.stringify(manifest)).not.toContain("학원플러스");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("developer service worker preserves other app caches and focuses only dev clients", () => {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

  expect(source).toContain('key.startsWith("hakwonplus-shell-")');
  expect(source).toContain('url.pathname.startsWith("/dev")');
  expect(source).toContain('self.location.hostname === "dev.hakwonplus.com"');
  expect(source).toContain('IS_DEV_CONSOLE_ORIGIN ? "/dev/inbox" : "/landing"');
  expect(source).not.toContain("keys.filter((k) => k !== CACHE_NAME)");
});

test("developer manifest is an isolated installable app with HakwonPlus icons", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/dev-manifest.json"), "utf8"),
  ) as {
    name: string;
    id: string;
    start_url: string;
    scope: string;
    display: string;
    icons: Array<{ src: string; sizes: string }>;
  };

  expect(manifest.name).toContain("학원플러스");
  expect(manifest.id).toBe("/dev/inbox");
  expect(manifest.start_url).toBe("/dev/inbox");
  expect(manifest.scope).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual([
    expect.objectContaining({
      src: "/tenants/hakwonplus/pwa-192.png?v=20260727",
      sizes: "192x192",
    }),
    expect.objectContaining({
      src: "/tenants/hakwonplus/pwa-512.png?v=20260727",
      sizes: "512x512",
    }),
  ]);
});

test("developer custom domain is canonical, non-indexable, and tenant-bound", async () => {
  const root = await manifestRequest("dev.hakwonplus.com", "/");
  expect(root.status).toBe(308);
  expect(root.headers.get("Location")).toBe("https://dev.hakwonplus.com/dev/inbox");

  const legacy = await manifestRequest("hakwonplus.com", "/dev/inbox?from=legacy");
  expect(legacy.status).toBe(308);
  expect(legacy.headers.get("Location")).toBe(
    "https://dev.hakwonplus.com/dev/inbox?from=legacy",
  );

  const robots = await manifestRequest("dev.hakwonplus.com", "/robots.txt");
  expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");

  const document = await documentRequest("dev.hakwonplus.com", "/dev/inbox");
  const html = await document.text();
  expect(document.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  expect(html).toContain("<title>학원플러스 콘솔</title>");
  expect(html).toContain('<link rel="manifest" href="/dev-manifest.json" />');
  expect(html).toContain('apple-mobile-web-app-title" content="학원플러스 콘솔"');
  expect(html).toContain(
    '<link rel="apple-touch-icon" href="/tenants/hakwonplus/apple-touch-icon.png?v=20260727" />',
  );

  expect(getTenantCodeFromHostname("dev.hakwonplus.com")).toEqual({
    ok: true,
    code: "hakwonplus",
    source: "hostname",
  });
});

test("public product updates route is edge-allowlisted and indexable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 404 });
  try {
    const document = await documentRequest("hakwonplus.com", "/promo/updates");
    const html = await document.text();

    expect(document.status).toBe(200);
    expect(html).toContain("<title>업데이트 소식 | 학원플러스</title>");
    expect(html).toContain(
      '<link rel="canonical" href="https://hakwonplus.com/promo/updates" />',
    );

    const sitemap = await manifestRequest("hakwonplus.com", "/sitemap.xml");
    expect(await sitemap.text()).toContain(
      "<loc>https://hakwonplus.com/promo/updates</loc>",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("security headers allow the exact API host used by public Matchup PDF frames", async () => {
  const document = await documentRequest("tchul.com", "/landing/matchup-board/16");
  const csp = document.headers.get("Content-Security-Policy") || "";
  const staticHeaders = readFileSync(resolve(process.cwd(), "public/_headers"), "utf8");

  expect(csp).toContain(
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://api.hakwonplus.com",
  );
  expect(staticHeaders).toContain(
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://api.hakwonplus.com",
  );
  const frameDirective = csp.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("frame-src ")) || "";
  expect(frameDirective.split(/\s+/)).not.toContain("https:");
});

test("deployment gate owns the developer custom domain lifecycle", () => {
  const workflow = readFileSync(
    resolve(process.cwd(), ".github/workflows/quality-gate.yml"),
    "utf8",
  );

  expect(workflow).toContain('DOMAIN="dev.hakwonplus.com"');
  expect(workflow).toContain("/pages/projects/${CLOUDFLARE_PROJECT_NAME}/domains");
  expect(workflow).toContain("/zones/${ZONE_ID}/dns_records");
  expect(workflow).toContain("DNS_TARGET=$(jq -r '.result.subdomain // empty'");
  expect(workflow).toContain('proxied: false');
  expect(workflow).toContain('DOMAIN_AGE_SECONDS');
  expect(workflow).toContain('Recreated stale pending ${DOMAIN} association.');
  expect(workflow).toContain('https://${DOMAIN}/');
  expect(workflow).toContain("Verify developer console domain isolation");
});
