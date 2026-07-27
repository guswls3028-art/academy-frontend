import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "./fixtures/strictTest";
import { onRequestGet } from "../functions/[[path]]";

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

test("known tenant teacher and student manifests use only that tenant's icons", async () => {
  const teacher = await manifestRequest("tchul.com", "/teacher-manifest.json");
  const student = await manifestRequest("tchul.com", "/student-manifest.json");
  const teacherManifest = await teacher.json() as {
    name: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string }>;
  };
  const studentManifest = await student.json() as {
    name: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string }>;
  };

  expect(teacherManifest.name).toBe("박철 과학 선생님");
  expect(teacherManifest.start_url).toBe("/teacher");
  expect(teacherManifest.icons).toEqual([
    expect.objectContaining({ src: "/tenants/tchul/pwa-192.png", sizes: "192x192" }),
    expect.objectContaining({ src: "/tenants/tchul/pwa-512.png", sizes: "512x512" }),
  ]);
  expect(studentManifest.name).toBe("박철 과학 학생");
  expect(studentManifest.start_url).toBe("/student");
  expect(JSON.stringify(studentManifest)).not.toContain("hakwonplus");
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
    expect(manifest.name).toBe("새봄학원 선생님");
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
  expect(manifest.scope).toBe("/dev");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual([
    expect.objectContaining({
      src: "/tenants/hakwonplus/pwa-192.png",
      sizes: "192x192",
    }),
    expect.objectContaining({
      src: "/tenants/hakwonplus/pwa-512.png",
      sizes: "512x512",
    }),
  ]);
});
