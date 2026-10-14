import { createServer, type Server } from "node:http";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";
import type { ManagedVideo, VideoContent } from "../src/landing/api/publicVideos";

const BASE = (process.env.E2E_LANDING_BASE_URL || process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const ID = "81111111-1111-4111-8111-111111111111";
const initial: VideoContent = { title: "통합과학 잘하는 학생들의 공통점", summary: "신민T의 과학 이야기", category: "interview", format: "landscape" };
const source = { youtube_video_id: "xgjL2HyrdFM", canonical_url: "https://www.youtube.com/watch?v=xgjL2HyrdFM", thumbnail_url: "https://i.ytimg.com/vi/xgjL2HyrdFM/hqdefault.jpg", source_title: "두각 INSIDE 인터뷰", channel_title: "두각학원" };
function managed(): ManagedVideo { return { ...source, id: ID, draft_content: initial, published_content: initial, status: "published", revision: 2, metadata_ready: true }; }
let server: Server | undefined;
test.afterEach(async () => {
  const current = server; server = undefined;
  if (current) await new Promise<void>((resolve, reject) => {
    current.close((error) => error ? reject(error) : resolve());
    current.closeAllConnections();
  });
});

async function prepare(page: Page, publisher = false, published = false) {
  const state = { row: published ? managed() : null as ManagedVideo | null, hero: published ? ID : null as string | null, revision: published ? 1 : 0, conflict: false, unavailable: false, publicFailure: false };
  const publicRow = () => state.row?.status === "published" ? { ...source, id: ID, ...state.row.published_content, published_at: "2026-10-14T00:00:00Z" } : null;
  server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    const headers = { "Access-Control-Allow-Origin": new URL(BASE).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS", "Access-Control-Allow-Headers": request.headers["access-control-request-headers"] || "content-type, x-tenant-code, authorization" };
    const json = (body: unknown, status = 200) => { response.writeHead(status, { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); };
    if (request.method === "OPTIONS") { response.writeHead(204, headers); response.end(); return; }
    if (url.pathname.endsWith("/core/program/")) return json({ tenantCode: "godmin", display_name: "신과함께", ui_config: {}, feature_flags: {}, is_active: true });
    if (url.pathname.endsWith("/core/me/")) return json({ id: 501, username: "qa-video-publisher", name: "QA 게시자", is_staff: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false });
    if (url.pathname.endsWith("/core/landing/has-published/")) return json({ has_published: false });
    const path = url.pathname.replace("/api/v1/landing-public/videos/", "");
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    if (path === "capabilities/") return json({ can_publish: publisher });
    if (path === "resolve/") return state.unavailable ? json({ detail: "유튜브 정보 확인 실패. 잠시 후 다시 시도해주세요." }, 503) : json({ ...source, format: "landscape" });
    if (path === "showcase/") return json({ hero: state.hero ? publicRow() : null });
    if (path === "manage/showcase/") return json({ hero_video_id: state.hero, revision: state.revision });
    if (path === "manage/" && request.method === "POST") {
      if (state.row) return json({ detail: "이미 등록된 영상입니다.", existing_id: ID }, 409);
      state.row = { ...managed(), status: "draft", draft_content: body.draft_content, published_content: null, revision: 1 };
      return json(state.row, 201);
    }
    if (path === "manage/") return json({ count: state.row ? 1 : 0, results: state.row ? [state.row] : [], next: null });
    if (path === `manage/${ID}/` && request.method === "PATCH") {
      if (state.conflict && state.row) { state.conflict = false; state.row = { ...state.row, revision: state.row.revision + 1, draft_content: { ...initial, title: "다른 게시자의 최신 제목" } }; return json({ detail: "다른 게시자가 변경했습니다." }, 409); }
      if (state.row) state.row = { ...state.row, draft_content: body.draft_content, revision: state.row.revision + 1 };
      return json(state.row);
    }
    if (path === `manage/${ID}/publish/` || path === `manage/${ID}/unpublish/`) {
      if (!state.row) return json({}, 404);
      if (body.expected_showcase_revision !== state.revision || body.expected_revision !== state.row.revision) return json({ detail: "최신 상태를 확인해주세요." }, 409);
      if (state.unavailable && path.endsWith("/publish/")) return json({ detail: "유튜브 정보 확인 실패. 저장된 초안은 유지됩니다." }, 503);
      state.row = { ...state.row, status: path.endsWith("/unpublish/") ? "unpublished" : "published", published_content: { ...state.row.draft_content }, revision: state.row.revision + 1 };
      const hero = state.row.status === "published" && body.set_as_hero ? ID : null;
      if (state.hero !== hero) { state.hero = hero; state.revision++; }
      return json({ video: state.row, showcase_revision: state.revision });
    }
    if (path === `manage/${ID}/`) return json(state.row || {}, state.row ? 200 : 404);
    if (path === "") return state.publicFailure ? json({ detail: "목록을 불러오지 못했습니다." }, 503) : json({ count: publicRow() ? 1 : 0, results: publicRow() ? [publicRow()] : [], next: null });
    if (path === `${ID}/`) return json(publicRow() || {}, publicRow() ? 200 : 404);
    return json({ detail: "Closed video mock: unmatched API" }, 404);
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing mock port");
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "godmin", user_id: 501 })}.sig`;
  await page.addInitScript(({ origin, token, publisher }) => {
    localStorage.setItem("tenant_code", "godmin"); sessionStorage.setItem("tenantCode", "godmin");
    if (publisher) { localStorage.setItem("access", token); localStorage.setItem("refresh", `${token}-refresh`); }
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, value, ...rest) { const url = new URL(String(value), location.href); return Reflect.apply(open, this, [method, url.pathname.startsWith("/api/v1/") ? `${origin}${url.pathname}${url.search}` : value, ...rest]); };
  }, { origin: `http://127.0.0.1:${address.port}`, token, publisher });
  await page.route("https://www.youtube.com/embed/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Mock native player boundary</title><button>Play</button>" }));
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#276756"/></svg>' }));
  return state;
}

async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true); }

for (const width of [1366, 390]) {
  test(`public hero → single native player → close and detail/Shorts at ${width}px`, async ({ page }, testInfo) => {
    const state = await prepare(page, false, true); await page.setViewportSize({ width, height: 900 });
    if (width === 390) await page.addInitScript(() => {
      if (typeof HTMLDialogElement !== "undefined") Object.defineProperty(HTMLDialogElement.prototype, "showModal", { value: undefined, configurable: true });
    });
    await page.goto(`${BASE}/landing`);
    const headline = page.locator("#godmin-hero-title strong");
    await expect(headline).toBeVisible();
    await expect.poll(() => headline.evaluate((element) => element.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(element).lineHeight))).toBeLessThan(1.1);
    const trigger = page.getByRole("button", { name: `${initial.title} 영상 열기`, exact: true });
    await expect(trigger).toBeVisible(); await trigger.click();
    const frame = page.getByRole("dialog").locator("iframe"); await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute("src", /autoplay=0/); await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    await noOverflow(page); await page.getByRole("button", { name: "영상 닫기" }).click(); await expect(page.locator("iframe")).toHaveCount(0); await expect(trigger).toBeFocused();
    await testInfo.attach(`video-home-${width}`, { body: await page.screenshot({ fullPage: false }), contentType: "image/png" });
    state.row!.published_content = { ...initial, format: "vertical" };
    await page.goto(`${BASE}/landing/videos/${ID}`); await expect(page.locator("iframe")).toHaveCount(1);
    const bounds = await page.locator("iframe").boundingBox(); expect(bounds!.width).toBeGreaterThanOrEqual(200); expect(bounds!.height).toBeGreaterThan(bounds!.width);
    await expect(page.getByRole("link", { name: "YouTube에서 보기 · 좋아요" })).toHaveAttribute("href", source.canonical_url);
    await noOverflow(page); await page.getByRole("link", { name: "← 영상 모아보기" }).click(); await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "영상 관리", exact: true })).toHaveCount(0);
  });

  test(`publisher draft/reload → public snapshot → conflict recovery → hide at ${width}px`, async ({ page }, testInfo) => {
    const state = await prepare(page, true); await page.setViewportSize({ width, height: 900 }); page.on("dialog", (dialog) => void dialog.accept());
    await page.goto(`${BASE}/landing/admin/videos/new`);
    await page.getByLabel("01 · YouTube 링크", { exact: true }).fill(source.canonical_url);
    await page.getByRole("button", { name: "영상 확인", exact: true }).click();
    await expect(page.getByLabel(/^제목/)).toHaveValue(source.source_title);
    await page.getByLabel(/^제목/).fill(initial.title); await page.getByLabel(/^한 줄 소개/).fill(initial.summary);
    // The URL changes before the new editor finishes its permission/data load.
    // Verify that saved state is displayed before testing a document reload.
    const loadedDraft = page.waitForResponse((response) => response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/v1/landing-public/videos/manage/${ID}/` && response.status() === 200);
    await page.getByRole("button", { name: "임시저장", exact: true }).click(); await expect(page).toHaveURL(`${BASE}/landing/admin/videos/${ID}`);
    await loadedDraft; await expect(page.getByLabel(/^제목/)).toHaveValue(initial.title);
    await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue(initial.title);
    await page.getByLabel("홈페이지 대표 영상으로 표시", { exact: false }).check();
    await page.getByRole("button", { name: "공개하기", exact: true }).click(); await expect(page.getByRole("link", { name: "공개 화면 확인" })).toBeVisible();
    expect(state.row!.published_content!.title).toBe(initial.title); expect(state.hero).toBe(ID);
    await page.getByLabel(/^제목/).fill("내가 수정한 초안"); await page.getByRole("button", { name: "임시저장", exact: true }).click(); await expect(page.getByRole("status")).toContainText("임시저장했습니다");
    expect(state.row!.published_content!.title).toBe(initial.title);
    state.conflict = true; await page.getByLabel(/^제목/).fill("입력을 지켜주세요"); await page.getByRole("button", { name: "임시저장", exact: true }).click();
    await expect(page.getByRole("heading", { name: "다른 게시자의 변경이 있습니다" })).toBeVisible(); await expect(page.getByLabel(/^제목/)).toHaveValue("입력을 지켜주세요");
    await page.getByRole("button", { name: "최신 상태 확인", exact: true }).click(); await expect(page.getByText("다른 게시자의 최신 제목", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "내 입력으로 이어서 수정" }).click(); await page.getByRole("button", { name: "수정 내용 공개", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("공개했습니다"); expect(state.row!.published_content!.title).toBe("입력을 지켜주세요");
    await noOverflow(page); await testInfo.attach(`video-editor-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("button", { name: "비공개로 전환", exact: true }).click(); await expect(page.getByRole("status")).toContainText("비공개로 전환했습니다"); expect(state.hero).toBeNull();
    await page.goto(`${BASE}/landing/videos/${ID}`); await expect(page.getByRole("alert")).toContainText("공개 중인 영상을 찾을 수 없습니다");
  });
}

test("lookup failure retains manual draft and public list error has retry", async ({ page }) => {
  const state = await prepare(page, true); state.unavailable = true;
  await page.goto(`${BASE}/landing/admin/videos/new`); await page.getByLabel("01 · YouTube 링크", { exact: true }).fill(source.canonical_url);
  await page.getByRole("button", { name: "영상 확인", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("유튜브 정보 확인 실패");
  await page.getByLabel(/^제목/).fill("직접 입력한 제목");
  const loadedDraft = page.waitForResponse((response) => response.request().method() === "GET"
    && new URL(response.url()).pathname === `/api/v1/landing-public/videos/manage/${ID}/` && response.status() === 200);
  await page.getByRole("button", { name: "임시저장", exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/landing/admin/videos/${ID}`); await loadedDraft;
  await expect(page.getByLabel(/^제목/)).toHaveValue("직접 입력한 제목");
  await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue("직접 입력한 제목");
  state.publicFailure = true; await page.goto(`${BASE}/landing/videos`); await expect(page.getByRole("alert")).toBeVisible(); state.publicFailure = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click(); await expect(page.getByRole("heading", { name: "새로운 이야기를 준비하고 있습니다" })).toBeVisible();
});
