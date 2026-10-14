import { createServer, type Server } from "node:http";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/strictTest";
import type { ManagedVideo, PublicVideo, VideoContent } from "../src/landing/api/publicVideos";

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

async function prepare(page: Page, publisher = false, published = false, authenticated = publisher) {
  const state = { related: [] as PublicVideo[], capabilityFailure: false, canPublish: publisher, row: published ? managed() : null as ManagedVideo | null, hero: published ? ID : null as string | null, revision: published ? 1 : 0, conflict: false, unavailable: false, publicFailure: false, listFailure: false, deleteFailure: false, presentation: { title: "영상", description: "" } };
  const publicRow = () => state.row?.status === "published" ? { ...source, id: ID, ...state.row.published_content, published_at: "2026-10-14T00:00:00Z" } : null;
  server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    const headers = { "Access-Control-Allow-Origin": new URL(BASE).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", "Access-Control-Allow-Headers": request.headers["access-control-request-headers"] || "content-type, x-tenant-code, authorization" };
    const json = (body: unknown, status = 200) => { response.writeHead(status, { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(body)); };
    if (request.method === "OPTIONS") { response.writeHead(204, headers); response.end(); return; }
    if (url.pathname.endsWith("/core/program/")) return json({ tenantCode: "godmin", display_name: "신과함께", ui_config: {}, feature_flags: {}, is_active: true });
    if (url.pathname.endsWith("/core/me/")) return json({ id: 501, username: "qa-video-publisher", name: "QA 게시자", is_staff: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false });
    if (url.pathname.endsWith("/core/landing/has-published/")) return json({ has_published: false });
    const path = url.pathname.replace("/api/v1/landing-public/videos/", "");
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    if (path === "capabilities/") return state.capabilityFailure ? json({ detail: "권한 확인 실패" }, 503) : json({ can_publish: state.canPublish });
    if (path === "resolve/") return state.unavailable ? json({ detail: "유튜브 정보 확인 실패. 잠시 후 다시 시도해주세요." }, 503) : json({ ...source, format: "landscape" });
    if (path === "showcase/") return json({ hero: state.hero ? publicRow() : null, ...state.presentation });
    if (path === "manage/showcase/") {
      if (request.method === "PATCH") {
        if (body.expected_revision !== state.revision) return json({ detail: "다른 게시자가 설정을 변경했습니다." }, 409);
        state.presentation = { title: body.title, description: body.description }; state.revision++;
      }
      return json({ hero_video_id: state.hero, revision: state.revision, ...state.presentation });
    }
    if (path === "manage/" && request.method === "POST") {
      if (state.row) return json({ detail: "이미 등록된 영상입니다.", existing_id: ID }, 409);
      state.row = { ...managed(), status: "draft", draft_content: body.draft_content, published_content: null, revision: 1 };
      return json(state.row, 201);
    }
    if (path === "manage/") return state.listFailure ? json({ detail: "관리 목록을 불러오지 못했습니다." }, 503) : json({ count: state.row ? 1 : 0, results: state.row ? [state.row] : [], next: null });
    if (path === `manage/${ID}/` && request.method === "PATCH") {
      if (state.conflict && state.row) { state.conflict = false; state.row = { ...state.row, revision: state.row.revision + 1, draft_content: { ...initial, title: "다른 게시자의 최신 제목" } }; return json({ detail: "다른 게시자가 변경했습니다." }, 409); }
      if (state.row) state.row = { ...state.row, draft_content: body.draft_content, revision: state.row.revision + 1 };
      return json(state.row);
    }
    if (path === `manage/${ID}/` && request.method === "DELETE") {
      if (state.deleteFailure) return json({ detail: "삭제하지 못했습니다. 다시 시도해주세요." }, 503);
      if (state.row && (Number(url.searchParams.get("expected_revision")) !== state.row.revision || Number(url.searchParams.get("expected_showcase_revision")) !== state.revision)) return json({ detail: "다른 게시자가 변경했습니다." }, 409);
      state.row = null; if (state.hero) { state.hero = null; state.revision++; }
      response.writeHead(204, headers); response.end(); return;
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
    if (path === "") return state.publicFailure ? json({ detail: "목록을 불러오지 못했습니다." }, 503) : json({ count: (publicRow() ? 1 : 0) + state.related.length, results: [...(publicRow() ? [publicRow()] : []), ...state.related], next: null });
    const related = state.related.find((video) => path === `${video.id}/`);
    if (related) return json(related);
    if (path === `${ID}/`) return json(publicRow() || {}, publicRow() ? 200 : 404);
    return json({ detail: "Closed video mock: unmatched API" }, 404);
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing mock port");
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "godmin", user_id: 501 })}.sig`;
  await page.addInitScript(({ origin, token, authenticated }) => {
    localStorage.setItem("tenant_code", "godmin"); sessionStorage.setItem("tenantCode", "godmin");
    if (authenticated) { localStorage.setItem("access", token); localStorage.setItem("refresh", `${token}-refresh`); }
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, value, ...rest) { const url = new URL(String(value), location.href); return Reflect.apply(open, this, [method, url.pathname.startsWith("/api/v1/") ? `${origin}${url.pathname}${url.search}` : value, ...rest]); };
  }, { origin: `http://127.0.0.1:${address.port}`, token, authenticated });
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
    await noOverflow(page); await page.getByRole("link", { name: "← 영상 목록" }).click(); await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "영상 관리", exact: true })).toHaveCount(0);
  });

  test(`publisher draft/reload → public snapshot → conflict recovery → hide at ${width}px`, async ({ page }, testInfo) => {
    const state = await prepare(page, true); await page.setViewportSize({ width, height: 900 }); page.on("dialog", (dialog) => void dialog.accept());
    await page.goto(`${BASE}/landing/admin/videos/new`);
    await page.getByLabel("01 · YouTube 링크", { exact: true }).fill(source.canonical_url);
    await page.getByRole("button", { name: "영상 확인", exact: true }).click();
    await expect(page.getByLabel(/^제목/)).toHaveValue(source.source_title);
    await page.getByLabel(/^제목/).fill(initial.title); await page.getByLabel(/^한 줄 소개/).fill(initial.summary);
    await page.getByLabel("분류 · 선택", { exact: true }).fill("직접 정한 분류");
    // The URL changes before the new editor finishes its permission/data load.
    // Verify that saved state is displayed before testing a document reload.
    const loadedDraft = page.waitForResponse((response) => response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/v1/landing-public/videos/manage/${ID}/` && response.status() === 200);
    await page.getByRole("button", { name: "임시저장", exact: true }).click(); await expect(page).toHaveURL(`${BASE}/landing/admin/videos/${ID}`);
    await loadedDraft; await expect(page.getByLabel(/^제목/)).toHaveValue(initial.title);
    await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue(initial.title);
    await expect(page.getByLabel("분류 · 선택", { exact: true })).toHaveValue("직접 정한 분류");
    await page.getByLabel("홈페이지 대표 영상으로 표시", { exact: false }).check();
    await page.getByRole("button", { name: "공개하기", exact: true }).click(); await expect(page.getByRole("link", { name: "공개 화면 확인" })).toBeVisible();
    expect(state.row!.published_content!.title).toBe(initial.title); expect(state.hero).toBe(ID);
    expect(state.row!.published_content!.category_label).toBe("직접 정한 분류");
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

  test(`custom settings → reload/public → delete cancel/conflict/retry at ${width}px`, async ({ page }, testInfo) => {
    const state = await prepare(page, true, true); await page.setViewportSize({ width, height: 900 });
    state.listFailure = true;
    let acceptDelete = false;
    page.on("dialog", (dialog) => void (dialog.message().includes("영상을 삭제할까요") && !acceptDelete ? dialog.dismiss() : dialog.accept()));
    await page.goto(`${BASE}/landing/admin/videos`); await page.getByText("영상 영역 설정", { exact: true }).click();
    await page.getByLabel("영역 제목", { exact: true }).fill("직접 정한 영상 제목");
    await page.getByRole("textbox", { name: "영역 소개 · 선택", exact: true }).fill("사용자가 작성한 소개입니다.");
    await expect(page.getByText("관리 목록을 불러오지 못했습니다.", { exact: true })).toBeVisible();
    state.listFailure = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByRole("link").filter({ has: page.getByRole("heading", { name: initial.title, exact: true }) })).toBeVisible();
    await expect(page.getByLabel("영역 제목", { exact: true })).toHaveValue("직접 정한 영상 제목");
    await expect(page.getByRole("textbox", { name: "영역 소개 · 선택", exact: true })).toHaveValue("사용자가 작성한 소개입니다.");
    state.revision++; state.presentation.title = "다른 게시자의 영역 제목";
    await page.getByRole("button", { name: "영역 설정 저장", exact: true }).click();
    await expect(page.getByRole("heading", { name: "다른 게시자의 설정 변경이 있습니다" })).toBeVisible();
    await expect(page.getByLabel("영역 제목", { exact: true })).toHaveValue("직접 정한 영상 제목");
    await page.getByRole("button", { name: "최신 설정 확인", exact: true }).click();
    await expect(page.getByText("다른 게시자의 영역 제목", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "내 설정으로 이어서 수정" }).click();
    await page.getByRole("button", { name: "영역 설정 저장", exact: true }).click();
    await expect(page.getByRole("status", { name: "영역 설정 결과" })).toContainText("영상 영역 설정을 저장했습니다");
    await page.reload(); await page.getByText("영상 영역 설정", { exact: true }).click();
    await expect(page.getByLabel("영역 제목", { exact: true })).toHaveValue("직접 정한 영상 제목");
    await noOverflow(page); await testInfo.attach(`video-settings-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.goto(`${BASE}/landing`); await expect(page.locator("#video-highlights-title")).toHaveText("직접 정한 영상 제목");
    await page.goto(`${BASE}/landing/videos`); await expect(page.getByRole("heading", { name: "직접 정한 영상 제목", exact: true })).toBeVisible();
    await expect(page.getByText("사용자가 작성한 소개입니다.", { exact: true })).toBeVisible();
    await page.goto(`${BASE}/landing/admin/videos/${ID}`); await page.getByRole("button", { name: "영상 삭제", exact: true }).click();
    expect(state.row).not.toBeNull(); expect(state.hero).toBe(ID);
    acceptDelete = true; state.row!.revision++;
    await page.getByRole("button", { name: "영상 삭제", exact: true }).click();
    await expect(page.getByRole("heading", { name: "다른 게시자의 변경이 있습니다" })).toBeVisible();
    await page.getByRole("button", { name: "최신 상태 확인", exact: true }).click();
    await page.getByRole("button", { name: "최신 내용 불러오기", exact: true }).click();
    state.deleteFailure = true; await page.getByRole("button", { name: "영상 삭제", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("삭제하지 못했습니다");
    await expect(page.getByLabel(/^제목/)).toHaveValue(initial.title); expect(state.hero).toBe(ID);
    state.deleteFailure = false; await page.getByRole("button", { name: "영상 삭제", exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/landing/admin/videos`);
    await expect(page.getByRole("status", { name: "삭제 결과" })).toContainText("영상을 삭제했습니다");
    await expect(page.getByRole("heading", { name: "첫 영상을 등록해보세요" })).toBeVisible();
    expect(state.row).toBeNull(); expect(state.hero).toBeNull();
    await page.reload(); await expect(page.getByRole("heading", { name: "첫 영상을 등록해보세요" })).toBeVisible();
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
  await page.getByRole("button", { name: "다시 시도", exact: true }).click(); await expect(page.getByRole("heading", { name: "등록된 공개 영상이 없습니다" })).toBeVisible();
});

for (const width of [1366, 390]) {
  test(`homepage navigation → browse another video → publisher entry at ${width}px`, async ({ page }, testInfo) => {
    const state = await prepare(page, true, true); await page.setViewportSize({ width, height: 900 });
    const next: PublicVideo = { ...source, ...initial, id: "82222222-2222-4222-8222-222222222222", title: "다음에 볼 영상", summary: "", format: "vertical", youtube_video_id: "Q70aZV1TH1Y", canonical_url: "https://www.youtube.com/watch?v=Q70aZV1TH1Y", thumbnail_url: "https://i.ytimg.com/vi/Q70aZV1TH1Y/hqdefault.jpg", published_at: "2026-10-14T00:00:00Z" };
    state.related.push(next);
    await page.goto(`${BASE}/landing/videos/${ID}`);
    const nav = page.getByRole("navigation", { name: "홈페이지 주요 메뉴" });
    await expect(nav.getByRole("link", { name: "수업 철학", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "영상", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "로그인", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "영상 관리", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "영상 등록", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "이 영상 수정", exact: true })).toHaveAttribute("href", `/landing/admin/videos/${ID}`);
    const others = page.getByRole("complementary", { name: "다른 영상" });
    await others.getByRole("link").filter({ has: page.getByRole("heading", { name: next.title }) }).click();
    await expect(page.getByRole("heading", { name: next.title, level: 1 })).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(1); await expect(page.locator("iframe")).toHaveAttribute("src", /Q70aZV1TH1Y/);
    await page.reload(); await expect(page.getByRole("heading", { name: next.title, level: 1 })).toBeVisible();
    await noOverflow(page); await testInfo.attach(`video-browsing-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("link", { name: "영상 등록", exact: true }).click();
    await expect(page.getByLabel("01 · YouTube 링크", { exact: true })).toBeVisible();
    await nav.getByRole("link", { name: "수업 철학", exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/landing#philosophy`);
    await expect(page.locator("#philosophy-title")).toBeInViewport();
    await expect.poll(() => page.locator("#philosophy-title").evaluate((element) => element.getBoundingClientRect().top - document.querySelector("header")!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0);
  });
}

test("publisher permission retry, direct publish and persisted completion", async ({ page }) => {
  const state = await prepare(page, true); state.capabilityFailure = true;
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(`${BASE}/landing/videos`);
  await expect(page.getByRole("button", { name: "관리 권한 다시 확인" })).toBeVisible();
  await expect(page.getByRole("link", { name: "영상 등록", exact: true })).toHaveCount(0);
  state.capabilityFailure = false; await page.getByRole("button", { name: "관리 권한 다시 확인" }).click();
  await page.getByRole("link", { name: "영상 등록", exact: true }).click();
  await page.getByLabel("01 · YouTube 링크", { exact: true }).fill(source.canonical_url);
  await page.getByRole("button", { name: "영상 확인", exact: true }).click();
  await expect(page.getByLabel(/^제목/)).toHaveValue(source.source_title);
  await page.getByRole("button", { name: "공개하기", exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/landing/admin/videos/${ID}`);
  await expect(page.getByRole("status")).toContainText("공개했습니다");
  await expect(page.getByRole("link", { name: "공개 화면 확인" })).toBeVisible();
  await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue(source.source_title);
  expect(state.row?.status).toBe("published");
});

test("signed-in non-publisher cannot see publishing controls", async ({ page }) => {
  await prepare(page, false, true, true);
  await page.goto(`${BASE}/landing/videos/${ID}`);
  await expect(page.getByRole("link", { name: "내 학습 공간", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^(영상 등록|영상 관리|이 영상 수정)$/ })).toHaveCount(0);
  await page.goto(`${BASE}/landing/admin/videos/new`);
  await expect(page.getByRole("heading", { name: "이 계정에는 영상 게시 권한이 없습니다" })).toBeVisible();
  await expect(page.getByLabel("01 · YouTube 링크", { exact: true })).toHaveCount(0);
});
