import { readFileSync } from "node:fs";
import { onRequestGet } from "../functions/[[path]].ts";
import { PROMO_META } from "../src/app_promo/domains/landing/promoMeta";
import { expect, test } from "./fixtures/strictTest";
import { ADMIN_WORKFLOWS } from "../src/shared/ui/guide/content/adminWorkflows";
import { TEACHER_WORKFLOWS } from "../src/shared/ui/guide/content/teacherWorkflows";
import { STUDENT_WORKFLOWS } from "../src/shared/ui/guide/content/studentWorkflows";
import type { GuideMediaSource } from "../src/shared/ui/guide/guideMediaData";
import { verifyFeatureGuideImages } from "./helpers/featureGuideEvidence";
const featureBooks = JSON.parse(readFileSync(new URL("../src/shared/ui/guide/content/feature-guide-books.json", import.meta.url), "utf8")) as typeof import("../src/shared/ui/guide/content/feature-guide-books.json").default;

const mediaCatalog = JSON.parse(readFileSync(new URL("../src/shared/ui/guide/content/guide-media.json", import.meta.url), "utf8")) as Record<string, GuideMediaSource>;
const findGuideMedia = (scope: string, topic: string) => mediaCatalog[`${scope}/${topic}`];

test("Cloudflare public guide supports direct reading URLs and canonical metadata without widening promo routes", async () => {
  const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 404 });
  const documentRequest = (pathname: string) => onRequestGet({
    request: new Request(`https://hakwonplus.com${pathname}`),
    env: { ASSETS: { fetch: async () => new Response(indexHtml, {
      status: 200, headers: { "Content-Type": "text/html; charset=utf-8" },
    }) } },
  } as never);
  try {
    for (const pathname of [
      "/promo/guide",
      "/promo/guide?role=teacher&topic=today&q=%ED%95%99%EC%83%9D",
    ]) {
      const response = await documentRequest(pathname);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<title>${PROMO_META["/promo/guide"].title}</title>`);
      expect(html).toContain(`<meta name="description" content="${PROMO_META["/promo/guide"].description}" />`);
      expect(html).toContain(`<meta property="og:title" content="${PROMO_META["/promo/guide"].title}" />`);
      expect(html).toContain('<link rel="canonical" href="https://hakwonplus.com/promo/guide" />');
      expect(html).toContain('<meta property="og:url" content="https://hakwonplus.com/promo/guide" />');
    }
    const redirect = await documentRequest("/promo/guide/?role=teacher&q=attendance");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Location")).toBe("https://hakwonplus.com/promo/guide?role=teacher&q=attendance");
    const redirected = await documentRequest("/promo/guide?role=teacher&q=attendance");
    expect(redirected.status).toBe(200);
    expect(await redirected.text()).toContain('<link rel="canonical" href="https://hakwonplus.com/promo/guide" />');
    const sitemap = await documentRequest("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain("<loc>https://hakwonplus.com/promo/features/tour</loc>");
    expect(xml.match(/<loc>https:\/\/hakwonplus\.com\/promo\/guide<\/loc>/g)).toHaveLength(1);
    expect(xml).not.toContain("/promo/guide?");
    const tour = await documentRequest("/promo/features/tour?guideBook=detail&guidePage=23");
    expect(tour.status).toBe(200);
    const tourHtml = await tour.text();
    expect(tourHtml).toContain(`<title>${PROMO_META["/promo/features/tour"].title}</title>`);
    expect(tourHtml).toContain('<link rel="canonical" href="https://hakwonplus.com/promo/features/tour" />');
    expect((await documentRequest("/promo/features/tour/?guidePage=2")).headers.get("Location")).toBe("https://hakwonplus.com/promo/features/tour?guidePage=2");
    for (const pathname of ["/promo/guide/not-a-route", "/promo/not-a-route", "/promo/features/tour/not-a-route"]) {
      expect((await documentRequest(pathname)).status).toBe(404);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

test("feature books contain 5/43 complete hashed image pages and optional valid PDFs", () => {
  expect(featureBooks.summary.pages).toHaveLength(5);
  expect(featureBooks.detail.pages).toHaveLength(43);
  for (const book of [featureBooks.summary, featureBooks.detail]) {
    for (const page of book.pages) {
      for (const src of [page.src, page.largeSrc]) {
        expect(src).toMatch(/^\/feature-guides\/20261025\/[a-z]+-\d+-\d+-[a-f0-9]{12}\.webp$/);
        const data = readFileSync(new URL(`../public${src}`, import.meta.url));
        expect(data.subarray(0, 4).toString()).toBe("RIFF");
        expect(data.subarray(8, 12).toString()).toBe("WEBP");
        expect(data.byteLength).toBeLessThan(400_000);
      }
      expect(page.bytes.small).toBeLessThan(100_000);
      for (const src of [page.fallbackSrc, page.fallbackLargeSrc]) {
        const data = readFileSync(new URL(`../public${src}`, import.meta.url));
        expect(data.subarray(0, 2).toString("hex")).toBe("ffd8");
        expect(data.byteLength).toBeLessThan(600_000);
      }
    }
    expect(readFileSync(new URL(`../public${book.pdf}`, import.meta.url)).subarray(0, 5).toString()).toBe("%PDF-");
  }
});

for (const width of [390, 1366]) {
  test(`feature image reader loads one page, restores position and enlarges at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const requested: string[] = [];
    page.on("request", (request) => { if (request.url().includes("/feature-guides/")) requested.push(request.url()); });
    await page.goto(`${BASE}/promo/features`);
    await expect(page.getByRole("link", { name: "기능 둘러보기 →", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await info.attach(`feature-tour-entry-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await page.getByRole("link", { name: "기능 둘러보기 →", exact: true }).click();
    const reader = page.getByRole("region", { name: "기능 둘러보기", exact: true });
    await expect(reader.getByRole("img")).toHaveCount(1);
    await reader.getByRole("img").scrollIntoViewIfNeeded();
    await expect.poll(() => reader.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    expect(requested.length).toBeGreaterThan(0);
    expect(requested.every((url) => /summary-01-.*\.webp$/.test(url))).toBeTruthy();
    expect(requested.some((url) => url.endsWith(".pdf"))).toBeFalsy();
    // An unsupported picture source must still render the JPEG fallback.
    await reader.locator("picture source").evaluate((source: HTMLSourceElement) => { source.type = "image/unsupported"; });
    await expect.poll(() => reader.getByRole("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.currentSrc.endsWith(".jpg"))).toBeTruthy();
    await reader.getByRole("button", { name: "다음 쪽 →" }).click();
    await expect(reader.getByLabel("설명서 페이지")).toHaveValue("2");
    const enlarge = reader.getByRole("button", { name: "글씨 크게 보기 ↗" });
    await enlarge.click();
    const dialog = page.getByRole("dialog", { name: "설명서 글씨 확대" });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2200);
    await info.attach(`feature-reader-enlarged-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(enlarge).toBeFocused();
    await reader.getByRole("button", { name: "상세 설명 43쪽" }).click();
    await reader.getByRole("navigation", { name: "핵심 기능 바로 읽기" }).getByRole("button", { name: "정오표·문항별 채점" }).click();
    await expect(reader.getByLabel("설명서 페이지")).toHaveValue("23");
    await page.reload();
    await expect(reader.getByLabel("설명서 페이지")).toHaveValue("23");
    await page.goBack();
    await expect(reader.getByLabel("설명서 페이지")).toHaveValue("1");
    await reader.getByLabel("설명서 페이지").selectOption("43");
    await expect(reader.getByRole("button", { name: "다음 쪽 →" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await reader.getByLabel("설명서 페이지").scrollIntoViewIfNeeded();
    await info.attach(`feature-reader-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    const pdf = await page.request.get(`${BASE}${featureBooks.summary.pdf}`);
    expect(pdf.ok()).toBeTruthy();
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await verifyFeatureGuideImages(page, info, `candidate-feature-reader-${width}`);
  });
}

test("feature reader recovers invalid image and preserves guide search parameters", async ({ page }) => {
  let fail = true;
  await page.route("**/feature-guides/**/*.webp", (route) => fail
    ? route.fulfill({ status: 200, contentType: "image/webp", body: "invalid image" }) : route.continue());
  await page.goto(`${BASE}/promo/guide?role=teacher&topic=attendance&q=출결&guideBook=detail&guidePage=bad`);
  const reader = page.getByRole("region", { name: "기능 둘러보기", exact: true });
  await reader.locator("figure").scrollIntoViewIfNeeded();
  await expect(reader.getByText(/설명서 이미지를 불러오지 못했습니다/)).toBeVisible();
  fail = false;
  await reader.getByRole("button", { name: "이미지 다시 불러오기" }).click();
  await expect.poll(() => reader.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await reader.getByRole("button", { name: "다음 쪽 →" }).click();
  const params = new URL(page.url()).searchParams;
  expect(params.get("role")).toBe("teacher");
  expect(params.get("topic")).toBe("attendance");
  expect(params.get("q")).toBe("출결");
  await reader.locator("summary").click();
  await expect(reader.getByRole("heading", { name: "현재 제공하는 기능" })).toHaveCount(4);
  await expect(reader.getByRole("heading", { name: "도입 시 추가 검수" })).toHaveCount(4);
  await expect(reader.getByRole("heading", { name: "맞춤 개발 협의" })).toHaveCount(4);
});

test("Cloudflare guide videos preserve byte ranges and missing media never returns an app shell", async () => {
  const request = new Request("https://hakwonplus.com/guide-media/example/walkthrough.mp4", { headers: { Range: "bytes=0-3" } });
  const partial = await onRequestGet({ request, env: { ASSETS: { fetch: async (incoming: Request) => {
    expect(incoming.headers.get("Range")).toBe("bytes=0-3");
    return new Response("ftyp", { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-3/100", "Accept-Ranges": "bytes" } });
  } } } } as never);
  expect(partial.status).toBe(206);
  expect(partial.headers.get("Content-Range")).toBe("bytes 0-3/100");
  expect(await partial.text()).toBe("ftyp");
  for (const [file, mime] of [["walkthrough.mp4", "video/mp4"], ["captions.vtt", "text/vtt; charset=utf-8"], ["summary.pdf", "application/pdf"], ["page.webp", "image/webp"], ["page.jpg", "image/jpeg"]]) {
    const missing = await onRequestGet({
      request: new Request(`https://hakwonplus.com/guide-media/missing/${file}`),
      env: { ASSETS: { fetch: async () => new Response("<html>SPA fallback</html>", { headers: { "Content-Type": "text/html" } }) } },
    } as never);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Content-Type")).toBe(mime);
    expect(missing.headers.get("Cache-Control")).toContain("no-store");
    expect(await missing.text()).not.toContain("<html>");
  }
});
const GUIDES = [
  { role: "admin", label: "관리자·선생님", articles: ADMIN_WORKFLOWS },
  { role: "teacher", label: "직원·강사", articles: TEACHER_WORKFLOWS },
  { role: "student", label: "학생", articles: STUDENT_WORKFLOWS },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/core/program/**", (route) => route.fulfill({
    json: { tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true },
  }));
});

test("published guide media has complete local files and known role/topic owners", async () => {
  const owners = Object.fromEntries(GUIDES.map((guide) => [guide.role, guide.articles.map((item) => item.id)]));
  expect(Object.keys(mediaCatalog).length).toBeGreaterThanOrEqual(11);
  for (const key of Object.keys(mediaCatalog)) {
    const [role, topic] = key.split("/");
    expect(owners[role]).toContain(topic);
    const media = findGuideMedia(role, topic)!;
    expect(media.screens.length).toBeGreaterThanOrEqual(2);
    expect(media.video).toBeDefined();
    for (const screen of media.screens) {
      expect(screen.alt).toContain(screen.title);
      const bytes = readFileSync(new URL(`../public${screen.src}`, import.meta.url));
      expect(bytes.subarray(0, 2).toString("hex")).toBe("ffd8");
    }
    const bytes = readFileSync(new URL(`../public${media.video!.src}`, import.meta.url));
    expect(bytes.subarray(4, 8).toString()).toBe("ftyp");
    expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
    const captions = readFileSync(new URL(`../public${media.video!.captions}`, import.meta.url), "utf8");
    expect(captions).toMatch(/^WEBVTT/);
    for (const screen of media.screens) expect(captions).toContain(screen.title);
  }
});

for (const width of [1366, 390]) {
  for (const { role, topic } of [
    { role: "admin", topic: "register-student" },
    { role: "teacher", topic: "attendance" },
    { role: "student", topic: "submit-assignment" },
  ]) {
    test(`visual guide ${role} supports photos, captions, downloads and reload at ${width}px`, async ({ page }, info) => {
      const media = findGuideMedia(role, topic)!;
      expect(media).toBeDefined();
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}/promo/guide?role=${role}&topic=${topic}`);
      const viewer = page.getByRole("region", { name: "화면으로 따라하기" });
      await expect(viewer).toBeVisible();
      const photo = viewer.locator("figure img");
      await photo.scrollIntoViewIfNeeded();
      await expect.poll(() => photo.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
      await expect(viewer.getByRole("button", { name: "← 이전 화면", exact: true })).toBeDisabled();
      await viewer.getByRole("button", { name: "다음 화면 →", exact: true }).click();
      await expect(viewer.locator("figcaption")).toContainText(media.screens[1].title);
      const enlarge = viewer.getByRole("button", { name: `${media.screens[1].title} 사진 크게 보기` });
      await enlarge.click();
      const dialog = page.getByRole("dialog", { name: `${media.screens[1].title} 사진 확대` });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("link", { name: "사진 파일 내려받기" })).toHaveAttribute("download", `${media.title} - 2 ${media.screens[1].title}.jpg`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
      await info.attach(`guide-photo-${role}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(enlarge).toBeFocused();
      await viewer.locator("summary").click();
      const video = viewer.locator("video");
      await video.evaluate((node: HTMLVideoElement) => node.play());
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.2);
      await expect(video).toHaveAttribute("controls", "");
      expect(await video.evaluate((node: HTMLVideoElement) => node.videoHeight)).toBeGreaterThan(0);
      await video.scrollIntoViewIfNeeded();
      await info.attach(`guide-video-${role}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
      await expect(video.locator("track")).toHaveAttribute("src", media.video!.captions);
      await video.evaluate((node: HTMLVideoElement) => { node.textTracks[0].mode = "hidden"; });
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.textTracks[0].cues?.length ?? 0)).toBe(media.screens.length);
      const download = page.waitForEvent("download");
      await viewer.getByRole("link", { name: "자막 포함 영상 내려받기 ↓" }).click();
      expect((await download).suggestedFilename()).toBe(`${media.title}.mp4`);
      await viewer.locator("summary").click();
      await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
      await page.reload();
      expect(new URL(page.url()).searchParams.get("topic")).toBe(topic);
      await expect(viewer.locator("figcaption")).toContainText(media.screens[0].title);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
      await viewer.scrollIntoViewIfNeeded();
      await info.attach(`guide-media-${role}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    });
  }
}

test("visual guide opens the original photo when native dialog is unavailable", async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(HTMLDialogElement.prototype, "showModal", { value: undefined }));
  const media = findGuideMedia("teacher", "attendance")!;
  await page.goto(`${BASE}/promo/guide?role=teacher&topic=attendance`);
  await expect(page.getByRole("dialog")).toBeHidden();
  const opened = context.waitForEvent("page");
  await page.getByRole("button", { name: `${media.screens[0].title} 사진 크게 보기` }).click();
  const original = await opened;
  await expect(original).toHaveURL(`${BASE}${media.screens[0].src}`);
  await original.close();
  await expect(page.getByRole("region", { name: "화면으로 따라하기" })).toBeVisible();
});

test("visual guide keeps written instructions and recovers failed image and video requests", async ({ page }) => {
  const media = findGuideMedia("admin", "register-student")!;
  let failImage = true;
  let failVideo = true;
  await page.route(`**${media.screens[0].src}`, (route) => failImage
    ? route.fulfill({ status: 503, body: "Temporarily unavailable" }) : route.continue());
  await page.route(`**${media.video!.src}`, (route) => failVideo
    ? route.fulfill({ status: 503, body: "Temporarily unavailable" }) : route.continue());
  await page.goto(`${BASE}/promo/guide?topic=register-student`);
  const viewer = page.getByRole("region", { name: "화면으로 따라하기" });
  await viewer.scrollIntoViewIfNeeded();
  await expect(viewer.getByText(/사진을 불러오지 못했습니다/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "순서대로 따라하기", exact: true })).toBeVisible();
  failImage = false;
  await viewer.getByRole("button", { name: "사진 다시 불러오기" }).click();
  await expect.poll(() => viewer.locator("figure img").evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await viewer.locator("summary").click();
  await viewer.locator("video").evaluate((node: HTMLVideoElement) => { node.preload = "auto"; node.load(); });
  await expect(viewer.getByText(/영상을 불러오지 못했습니다/)).toBeVisible();
  failVideo = false;
  await viewer.getByRole("button", { name: "영상 다시 불러오기" }).click();
  await viewer.locator("video").evaluate((node: HTMLVideoElement) => node.play());
  await expect.poll(() => viewer.locator("video").evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.2);
});

for (const width of [1366, 390]) {
  test(`guide inquiry preserves context and complete questions through retry at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const article = ADMIN_WORKFLOWS.find((item) => item.id === "fees")!;
    const tracking = new URLSearchParams(Object.fromEntries(
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((key) => [key, "u".repeat(120)]),
    ));
    const payloads: Array<{ message: string; interest: string; privacy_agreed: boolean }> = [];
    await page.route("**/api/v1/core/landing/consult/", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers().authorization).toBeUndefined();
      payloads.push(route.request().postDataJSON());
      await route.fulfill(payloads.length === 1
        ? { status: 429, json: { detail: "너무 빠른 요청입니다. 잠시 후 다시 시도해주세요." } }
        : { status: 201, json: { id: 1, ok: true } });
    });
    await page.goto(`${BASE}/promo/guide?topic=fees&${tracking}`);
    const body = page.getByRole("article", { name: article.title, exact: true });
    await body.getByRole("link", { name: "이 기능 문의하기" }).click();
    expect([...new URL(page.url()).searchParams.keys()]).toEqual(["guideRole", "guideTopic"]);
    await page.reload();
    await expect(page.getByRole("combobox")).toHaveValue("기능 문의");
    await expect(page.locator("textarea")).toHaveValue(`[관리자·선생님 · ${article.title}]\n이 기능에 대해 문의드립니다.\n`);
    await expect(page.getByRole("link", { name: "읽던 가이드 보기" })).toHaveAttribute("href", "/promo/guide?role=admin&topic=fees");
    const question = `[${article.title}]`.padEnd(1488, "가") + "END-QUESTION";
    await page.locator("textarea").fill(question);
    await page.getByLabel("이름 *", { exact: true }).fill("가이드 문의 QA");
    await page.getByLabel("연락처 *", { exact: true }).fill("010-0000-0000");
    await expect(page.locator("textarea")).toHaveValue(question);
    await page.getByRole("checkbox", { name: /개인정보 수집/ }).check();
    await page.getByRole("button", { name: "문의 보내기", exact: true }).click();
    const error = page.getByRole("alert");
    await expect(error).toHaveText("너무 빠른 요청입니다. 잠시 후 다시 시도해주세요.");
    await expect(error).toBeFocused();
    await expect(page.locator("textarea")).toHaveValue(question);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].message).toContain(question);
    expect(payloads[0].message.length).toBeLessThanOrEqual(2000);
    expect(payloads[0].privacy_agreed).toBe(true);
    expect(payloads[0].interest).toBe("기능 문의");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await testInfo.attach(`guide-inquiry-recovery-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await page.getByRole("button", { name: "문의 보내기", exact: true }).click();
    await expect(page.getByRole("heading", { name: "문의가 접수되었습니다", exact: true })).toBeFocused();
    expect(payloads).toHaveLength(2);
    expect(payloads[1]).toEqual(payloads[0]);
  });

  test(`anonymous full guide keeps role content, recovery and reading position at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/promo/guide`);
    for (const guide of GUIDES) {
      await page.getByRole("group", { name: "가이드 이용 역할" }).getByRole("button", { name: guide.label, exact: true }).click();
      await expect(page.getByRole("heading", { name: `${guide.label} 사용 가이드`, exact: true })).toBeVisible();
      const contents = page.getByRole("navigation", { name: "주요 기능 이용 순서" });
      await expect(contents.getByRole("button")).toHaveCount(guide.articles.length);
      const article = guide.articles[0];
      await page.getByRole("searchbox").fill(article.title);
      await contents.getByRole("button").filter({ hasText: article.title }).first().press("Enter");
      const body = page.getByRole("article", { name: article.title, exact: true });
      await expect(body).toBeVisible();
      await expect(page.getByRole("searchbox")).toHaveValue(article.title);
      expect(new URL(page.url()).searchParams.get("q")).toBe(article.title);
      await expect(body.locator("ol")).toHaveCSS("list-style-type", "decimal");
      await expect(body.locator("ul").first()).toHaveCSS("list-style-type", "disc");
      for (const step of article.steps) {
        await expect(body.getByRole("heading", { name: step.title, exact: true })).toBeVisible();
        await expect(body.getByText(step.description, { exact: true })).toBeVisible();
      }
      await expect(body.getByRole("heading", { name: "여기까지 확인하면 완료" })).toBeVisible();
      for (const item of article.completion) await expect(body.getByText(item, { exact: true })).toBeVisible();
      const recovery = article.troubleshooting[0];
      await body.locator("summary").filter({ hasText: recovery.title }).click();
      await expect(body.getByText(recovery.description, { exact: true })).toBeVisible();
      await testInfo.attach(`public-guide-${guide.role}-${width}-recovery`, {
        body: await body.locator("details[open]").first().screenshot(), contentType: "image/png",
      });
      await expect(page.locator('main a[href^="/workspace"], main a[href^="/student"], main a[href^="/teacher"], main a[href^="/admin"]')).toHaveCount(0);
      await page.reload();
      await expect(body).toBeVisible();
      await expect(page.getByRole("searchbox")).toHaveValue(article.title);
      expect(new URL(page.url()).searchParams.get("topic")).toBe(article.id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await body.getByRole("heading", { level: 2 }).scrollIntoViewIfNeeded();
      await expect(body.getByRole("heading", { level: 2 })).toBeInViewport();
      await testInfo.attach(`public-guide-${guide.role}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    }
    await page.getByRole("searchbox").fill("없는안내-검색복구-qa");
    await expect(page.getByText("일치하는 안내가 없습니다. 검색어를 줄이거나 다른 분류를 선택해 주세요.")).toBeVisible();
    await page.getByRole("button", { name: "검색 초기화", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "주요 기능 이용 순서" }).getByRole("button")).toHaveCount(STUDENT_WORKFLOWS.length);
    await page.goto(`${BASE}/promo/guide?role=teacher&topic=missing-topic`);
    await page.getByRole("button", { name: "전체 가이드 보기", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "주요 기능 이용 순서" }).getByRole("button")).toHaveCount(TEACHER_WORKFLOWS.length);
  });

  test(`promo entry explains onboarding, planned payments and callback at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/promo`);
    await expect(page.getByText(/개발자가 직접 프로그램을 소개하고 직원·강사분들께/)).toBeVisible();
    await expect(page.getByText(/원비·교재비 온라인 결제 기능은 도입 예정입니다/)).toBeVisible();
    await expect(page.getByText(/현재는 온라인 결제를 지원하지 않으며/)).toBeVisible();
    const guideLink = page.getByRole("link", { name: "전체 사용 가이드 보기", exact: true });
    await guideLink.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await testInfo.attach(`promo-guidance-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await guideLink.click();
    await expect(page.getByRole("heading", { name: "관리자·선생님 사용 가이드" })).toBeVisible();
    await page.getByRole("link", { name: "도입 전 자주 묻는 질문 →" }).click();
    await expect(page.getByText(/원비·교재비 온라인 결제 기능은 도입 예정입니다/)).toBeVisible();
    await page.goto(`${BASE}/promo/contact`);
    await expect(page.getByText("통화 연결이 어려울 경우 문자를 남겨주시면 확인 후 연락드리겠습니다.")).toBeVisible();
    await expect(page.getByRole("link", { name: "전화 문의하기" }).first()).toContainText("010-3121-7466");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });
}

test("inquiry resolves only known role/topic pairs and ignores untrusted URL text", async ({ page }) => {
  for (const guide of GUIDES) {
    const article = guide.articles[0];
    await page.goto(`${BASE}/promo/contact?guideRole=${guide.role}&guideTopic=${article.id}`);
    await expect(page.locator("textarea")).toHaveValue(`[${guide.label} · ${article.title}]\n이 기능에 대해 문의드립니다.\n`);
  }
  for (const query of [
    "guideRole=__proto__&guideTopic=fees",
    "guideRole=admin&guideTopic=https%3A%2F%2Fexample.com",
    "guideRole=student&guideTopic=missing&title=%3Cscript%3E&returnTo=https%3A%2F%2Fexample.com",
  ]) {
    await page.goto(`${BASE}/promo/contact?${query}`);
    await expect(page.locator("textarea")).toHaveValue("");
    await expect(page.getByRole("combobox")).toHaveValue("가격 문의");
    await expect(page.getByRole("link", { name: "읽던 가이드 보기" })).toHaveCount(0);
  }
});

test("demo retains the request after rejection and focuses the successful retry result", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/v1/core/landing/consult/", async (route) => {
    attempts++;
    expect(route.request().postDataJSON().message).toContain("데모 확인 QA");
    await route.fulfill(attempts === 1
      ? { status: 400, json: { detail: ["연락처를 다시 확인해주세요."] } }
      : { status: 201, json: { id: 2, ok: true } });
  });
  await page.goto(`${BASE}/promo/demo`);
  await page.getByLabel("이름 *", { exact: true }).fill("데모 QA");
  await page.getByLabel("소속/수업명 *", { exact: true }).fill("QA 수업");
  await page.getByLabel("연락처 *", { exact: true }).fill("010-0000-0000");
  await page.locator("textarea").fill("데모 확인 QA");
  await page.getByRole("checkbox", { name: /개인정보 수집/ }).check();
  await page.getByRole("button", { name: "데모 요청하기", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("연락처를 다시 확인해주세요.");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.locator("textarea")).toHaveValue("데모 확인 QA");
  await page.getByLabel("연락처 *", { exact: true }).fill("010-0000-0001");
  await page.getByRole("button", { name: "데모 요청하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "데모 요청이 접수되었습니다", exact: true })).toBeFocused();
  expect(attempts).toBe(2);
});
