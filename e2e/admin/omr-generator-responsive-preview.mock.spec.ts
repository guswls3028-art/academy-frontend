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
    if (path === "/tools/omr/pdf/") {
      return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4\n%%EOF\n" });
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
  await expect(page.getByRole("radio", { name: "서술형만" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "단답형만" })).toHaveCount(0);
  await expect(page.getByText("서술형 작성 공간", { exact: true })).toBeVisible();

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

for (const width of [1366, 390]) {
  test(`${width}px 이전 미리보기 응답을 버리고 최신 선택으로 출력·재시도한다`, async ({ page }) => {
    await seed(page);
    await installApi(page);
    type PreviewParams = { mc_count: number; essay_count: number; essay_score_grid?: string; exam_title: string };
    type Match = (params: PreviewParams) => boolean;
    const holds: Array<{ match: Match; receive: (route: Route) => void }> = [];
    const hold = (match: Match) => new Promise<Route>(receive => holds.push({ match, receive }));
    const show = (route: Route, label: string) => route.fulfill({ contentType: "text/html", body: `<p>${label}</p>` });
    await page.route("**/tools/omr/preview/", async route => {
      const index = holds.findIndex(item => item.match(route.request().postDataJSON()));
      if (index >= 0) holds.splice(index, 1)[0].receive(route);
      else await show(route, "현재 답안지");
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${BASE}/workspace/tools/omr`);
    const frame = page.locator('iframe[title="OMR 답안지 미리보기"]');
    const sheet = frame.contentFrame();
    await expect(sheet.getByText("현재 답안지")).toBeVisible();

    const previous = hold(params => params.essay_count === 0);
    await page.getByRole("radio", { name: "객관식만", exact: true }).click();
    await expect(frame).toHaveCount(0);
    const oldRoute = await previous;
    const latest = hold(params => params.mc_count === 0 && params.essay_score_grid === "paper");
    await page.getByRole("radio", { name: "서술형만", exact: true }).click();
    await expect(page.getByRole("radiogroup", { name: "서술형 교사 채점란" }).getByRole("radio", { name: "사용", exact: true })).toBeChecked();
    await show(oldRoute, "폐기된 이전 구성");
    await (await oldRoute.request().response())?.finished();
    const latestRoute = await latest;
    await expect(frame).toHaveCount(0);

    const pdf = page.waitForRequest(request => request.url().endsWith("/tools/omr/pdf/"));
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "OMR PDF 다운로드" }).click();
    expect((await pdf).postDataJSON()).toEqual(latestRoute.request().postDataJSON());
    expect(await (await download).failure()).toBeNull();
    await latestRoute.fulfill({ status: 400, contentType: "application/json", body: "{}" });
    await expect(sheet.getByText("미리보기를 불러올 수 없습니다.")).toBeVisible();
    const retry = hold(() => true);
    await page.getByRole("button", { name: "미리보기 새로고침" }).click();
    const retryRoute = await retry;
    expect(retryRoute.request().postDataJSON()).toEqual(latestRoute.request().postDataJSON());
    await expect(frame).toHaveCount(0);
    await show(retryRoute, "다시 불러온 답안지");
    await expect(sheet.getByText("다시 불러온 답안지")).toBeVisible();

    const leaving = hold(params => params.exam_title === "이전 화면");
    await page.getByRole("textbox", { name: "시험명" }).fill("이전 화면");
    const leavingRoute = await leaving;
    await page.getByRole("tab", { name: "타이머", exact: true }).click();
    await expect(page).toHaveURL(/\/tools\/stopwatch$/);
    await page.getByRole("tab", { name: "OMR 생성", exact: true }).click();
    await expect(sheet.getByText("현재 답안지")).toBeVisible();
    await show(leavingRoute, "닫은 화면의 답안지");
    await (await leavingRoute.request().response())?.finished();
    await expect(sheet.getByText("현재 답안지")).toBeVisible();
  });

  test(`${width}px 독립 생성기에서 별도 선택 없이 수기 채점란 PDF를 받는다`, async ({ page }) => {
    await seed(page);
    await installApi(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${BASE}/workspace/tools/omr`);
    const preview = page.waitForRequest(request => request.url().endsWith("/tools/omr/preview/") && request.postDataJSON()?.mc_count === 0 && request.postDataJSON()?.essay_score_grid === "paper");
    await page.getByRole("radio", { name: "서술형만" }).click();
    const option = page.getByRole("radiogroup", { name: "서술형 교사 채점란" });
    await expect(option.getByRole("radio", { name: "사용", exact: true })).toBeChecked();
    const params = (await preview).postDataJSON();
    const pdf = page.waitForRequest(request => request.url().endsWith("/tools/omr/pdf/"));
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "OMR PDF 다운로드" }).click();
    expect((await pdf).postDataJSON()).toEqual(params);
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    await option.getByRole("radio", { name: "사용 안 함", exact: true }).click();
    await expect(option.getByRole("radio", { name: "사용 안 함" })).toBeChecked();
  });
}
