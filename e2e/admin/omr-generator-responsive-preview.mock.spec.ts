import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const OMR_RATIO = 297 / 210;

const OMR_PREVIEW_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; }
    .omr { width: 297mm; height: 210mm; background: #fff; border: 2px solid #111; }
  </style>
</head>
<body><main class="omr">OMR ANSWER SHEET</main></body>
</html>`;

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seed(page: Page) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "OMR 반응형 회귀는 로컬 route-mock 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

async function installApi(page: Page) {
  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "omr_visual_admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === "/tools/omr/preview/") {
      return route.fulfill({ status: 200, contentType: "text/html", body: OMR_PREVIEW_HTML });
    }
    return json({ count: 0, results: [] });
  });
}

async function expectFittedPreview(page: Page) {
  const preview = page.getByRole("region", { name: "OMR 답안지 미리보기" });
  const frame = page.locator('iframe[title="OMR 답안지 미리보기"]');
  await expect(frame).toBeVisible({ timeout: 30_000 });

  await expect.poll(async () => frame.evaluate((element) => {
    const iframe = element as HTMLIFrameElement;
    const preview = iframe.parentElement;
    const frameRect = iframe.getBoundingClientRect();
    return preview ? Math.abs(frameRect.width - preview.clientWidth) : Number.POSITIVE_INFINITY;
  })).toBeLessThanOrEqual(2);

  const metrics = await preview.evaluate((element) => {
    const iframe = element.querySelector("iframe") as HTMLIFrameElement;
    const previewRect = element.getBoundingClientRect();
    const frameRect = iframe.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      previewRatio: previewRect.width / previewRect.height,
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
      previewWidth: previewRect.width,
      previewHeight: previewRect.height,
      previewClientWidth: element.clientWidth,
      previewClientHeight: element.clientHeight,
    };
  });

  expect(metrics.documentOverflow).toBeLessThanOrEqual(1);
  expect(metrics.previewRatio).toBeCloseTo(OMR_RATIO, 2);
  expect(Math.abs(metrics.frameWidth - metrics.previewClientWidth)).toBeLessThanOrEqual(2);
  expect(Math.abs(metrics.frameHeight - metrics.previewClientHeight)).toBeLessThanOrEqual(2);

  const innerMetrics = await page
    .frameLocator('iframe[title="OMR 답안지 미리보기"]')
    .locator("html")
    .evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
  expect(innerMetrics.scrollWidth - innerMetrics.width).toBeLessThanOrEqual(1);
  expect(innerMetrics.scrollHeight - innerMetrics.height).toBeLessThanOrEqual(1);
}

test("OMR 미리보기는 데스크톱과 모바일에서 A4 전체를 한 화면에 맞춘다", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await seed(page);
  await installApi(page);

  const viewports = [
    { width: 1100, height: 800 },
    { width: 1366, height: 900 },
    { width: 390, height: 844 },
  ];
  await page.setViewportSize(viewports[0]);
  await page.goto(`${BASE}/workspace/tools/omr`, { waitUntil: "domcontentloaded", timeout: 60_000 });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectFittedPreview(page);

    if (viewport.width !== 1100) {
      if (viewport.width === 390) {
        await page.getByRole("region", { name: "OMR 답안지 미리보기" }).scrollIntoViewIfNeeded();
      }
      await page.screenshot({
        path: testInfo.outputPath(`omr-preview-${viewport.width}.png`),
        fullPage: viewport.width !== 390,
      });
    }
  }
});
