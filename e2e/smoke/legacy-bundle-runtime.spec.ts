import { expect, test, type Page, type Route } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");
const NOTICE_TITLE = "구형 휴대폰에서도 수업 안내를 확인하세요";
const VIDEO_TITLE = "복습 영상 호환성 점검";

type Profile = { name: string; width: number; height: number; userAgent: string };
const profiles: Profile[] = [
  { name: "iOS 10.3 capability", width: 320, height: 568,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/603.1.30 Version/10.0 Mobile/14E277 Safari/602.1" },
  { name: "Android Chrome 64 capability", width: 360, height: 640,
    userAgent: "Mozilla/5.0 (Linux; Android 7.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.137 Mobile Safari/537.36" },
];

// This executes the real production SystemJS chunks in a current browser with
// selected APIs removed. It is neither UA-only testing nor physical-device proof.
async function installLegacyRuntime(page: Page, profile: Profile) {
  const scriptRequests: string[] = [];
  const stylesheetResponses: Array<{ url: string; status: number }> = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scriptRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith("-legacy.css")) {
      stylesheetResponses.push({ url: response.url(), status: response.status() });
    }
  });
  await page.setViewportSize({ width: profile.width, height: profile.height });
  await page.addInitScript(({ userAgent }) => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => userAgent });
    for (const name of ["fetch", "AbortController", "AbortSignal", "ResizeObserver", "IntersectionObserver", "TextEncoder", "TextDecoder", "queueMicrotask", "globalThis"]) {
      Reflect.deleteProperty(window, name);
    }
    for (const [target, name] of [
      [Object, "fromEntries"], [Promise, "allSettled"],
      [Promise.prototype, "finally"],
      [Array.prototype, "flat"], [Array.prototype, "flatMap"],
      [String.prototype, "replaceAll"], [crypto, "randomUUID"],
    ] as const) Object.defineProperty(target, name, { configurable: true, writable: true, value: undefined });
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = matchMedia(query);
      Object.defineProperty(result, "addEventListener", { configurable: true, value: undefined });
      Object.defineProperty(result, "removeEventListener", { configurable: true, value: undefined });
      return result;
    };
    const supports = CSS.supports.bind(CSS);
    CSS.supports = (...args: Parameters<typeof CSS.supports>) => (
      args.some((value) => /color-mix|oklch|:where|:is\(/.test(String(value)))
        ? false
        : supports(...args)
    );
  }, { userAgent: profile.userAgent });

  await page.route(`${new URL(BASE).origin}/**`, async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const response = await route.fetch();
    const html = await response.text();
    expect(html, "Run this contract against vite preview after pnpm build").toContain('id="vite-legacy-entry"');
    expect(html).toContain('id="vite-legacy-polyfill"');
    // Retain the generated legacy loader and every real asset. Remove module
    // execution/preloads and enable nomodule tags, as an old engine would.
    const legacyHtml = html
      .replace(/<script\b(?=[^>]*\btype=["']module["'])[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*>/gi, "")
      .replace(/\snomodule(?:=["'][^"']*["'])?/gi, "");
    await route.fulfill({ response, body: legacyHtml });
  });
  return { scriptRequests, stylesheetResponses };
}

async function installStudentApi(page: Page, role: "student" | "parent" = "student") {
  const access = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test`;
  const loginBodies: unknown[] = [];
  const studentScopes: string[] = [];
  const analyticsBodies: Array<{ events?: Array<{ event_id: string; event_type: string; view_id?: string }> }> = [];
  const notice = { id: 801, post_type: "notice", title: NOTICE_TITLE,
    content: "<p>수업 자료를 확인하고 복습 영상을 재생해 주세요.</p>",
    created_by: 1, created_at: "2026-09-13T00:00:00Z", mappings: [], attachments: [], status: "published" };
  const video = { id: 902, session_id: 802, enrollment_id: null, title: VIDEO_TITLE,
    status: "READY", source_type: "s3", duration: 600, progress: 0, completed: false,
    last_position: 0, allow_skip: true, max_speed: 1, show_watermark: false, access_mode: "FREE_REVIEW" };

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const headers = { "access-control-allow-origin": new URL(BASE).origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": request.headers()["access-control-request-headers"] || "authorization,content-type,x-tenant-code",
      "access-control-allow-methods": "GET,POST,OPTIONS" };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const selectedChild = request.headers()["x-student-id"];
    if (role === "parent" && path.startsWith("/student/")) {
      studentScopes.push(selectedChild || "missing");
      if (selectedChild !== "901" && selectedChild !== "902") return json({ detail: "자녀를 선택해 주세요." }, 403);
    }
    if (path === "/core/program/") return json({ tenantCode: "godmin", display_name: "신과함께", is_active: true,
      ui_config: { login_title: "신과함께" }, feature_flags: { product_usage_analytics_enabled: true } });
    if (path === "/core/landing/has-published/") return json({ has_published: false });
    if (path === "/token/") {
      loginBodies.push(request.postDataJSON());
      return json({ access, refresh: "legacy-smoke-refresh" });
    }
    if (path === "/core/me/") return json({ id: role === "parent" ? 910 : 901, username: `${role}.legacy`, name: "호환성 점검 계정",
      is_staff: false, is_superuser: false, tenantRole: role, must_change_password: false, first_login_guide_required: false,
      linkedStudents: role === "parent" ? [{ id: 901, name: "첫째 학생" }, { id: 902, name: "둘째 학생" }] : null });
    if (path === "/student/me/") return json({ id: role === "parent" ? Number(selectedChild) : 901,
      username: "student.legacy", name: role === "parent" ? selectedChild === "901" ? "첫째 학생" : "둘째 학생" : "호환성 점검 학생",
      isParentReadOnly: role === "parent", profile_photo_url: null });
    if (path === "/core/product-analytics/events/batch/") {
      analyticsBodies.push(request.postDataJSON());
      return json({ accepted: true });
    }
    if (path === "/student/dashboard/") return json({ notices: [notice], today_sessions: [], badges: {} });
    if (path === "/student/sessions/me/" || path === "/clinic/participants/" || path === "/community/posts/") return json([]);
    if (path === "/student/exams/") return json({ items: [] });
    if (path === "/student/grades/") return json({ exams: [], homeworks: [], exam_trend: [], lecture_options: [],
      exam_summary: { scored_count: 0, average_score_pct: null, latest_score_pct: null, change_pct_points: null, best_score_pct: null } });
    if (path === "/community/posts/notices/") return json([notice]);
    if (path === "/community/posts/801/") return json(notice);
    if (path === "/student/video/videos/902/playback/") return json({ video,
      hls_url: "https://cdn.example.test/legacy/master.m3u8", play_url: "https://cdn.example.test/legacy/master.m3u8",
      playback_token: "legacy-playback", playback_session_id: null,
      playback_expires_at: Math.floor(Date.now() / 1000) + 3600, policy_version: 1,
      policy: { access_mode: "FREE_REVIEW", monitoring_enabled: false, allow_seek: true,
        playback_rate: { max: 1, ui_control: true }, source: { type: "s3", provider: "uploaded" } } });
    if (path === "/student/video/sessions/802/videos/") return json({ items: [video] });
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/media/videos/public-session/") return json(null);
    return json({});
  });
  return { loginBodies, analyticsBodies, access, studentScopes };
}

async function login(page: Page, role: "student" | "parent" = "student") {
  await page.goto(`${BASE}/login/godmin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.getByRole("form", { name: "로그인 폼" })).toBeVisible({ timeout: 45_000 });
  const submitStyle = await page.getByTestId("login-submit").evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { height: rect.height, color: style.color, background: style.backgroundImage, fontSize: parseFloat(style.fontSize) };
  });
  expect(submitStyle.height).toBeGreaterThanOrEqual(40);
  expect(submitStyle.fontSize).toBeGreaterThanOrEqual(14);
  expect(submitStyle.color).toBe("rgb(255, 255, 255)");
  expect(submitStyle.background).toContain("gradient");
  await page.screenshot({ path: test.info().outputPath("legacy-login.png"), fullPage: true, animations: "disabled" });
  await page.getByTestId("login-username").fill(`${role}.legacy`);
  await page.getByTestId("login-password").fill("Case-Sensitive-Pw");
  await page.getByTestId("login-submit").click();
  if (role === "parent") {
    await expect(page.getByRole("heading", { name: "확인할 자녀를 선택해 주세요" })).toBeVisible();
    return;
  }
  await expect(page.getByRole("region", { name: "자주 쓰는 일" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "오늘은 급한 일이 없어요" })).toBeVisible();
  const studentStyle = await page.locator(".student-layout").evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor, height: element.getBoundingClientRect().height };
  });
  expect(studentStyle.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(studentStyle.color).not.toBe(studentStyle.background);
  expect(studentStyle.height).toBeGreaterThanOrEqual(500);
  await page.screenshot({ path: test.info().outputPath("legacy-home.png"), fullPage: true, animations: "disabled" });
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test.use({ serviceWorkers: "block" });

for (const profile of profiles) {
  test(`${profile.name}: production legacy chunks support login, notice navigation and persisted reload`, async ({ page }) => {
    const { scriptRequests: scripts, stylesheetResponses } = await installLegacyRuntime(page, profile);
    const api = await installStudentApi(page);
    await login(page);
    expect(api.loginBodies).toEqual([{ username: "student.legacy", password: "Case-Sensitive-Pw", tenant_code: "godmin" }]);
    await expectNoOverflow(page);

    await page.getByRole("link", { name: "공지", exact: true }).click();
    await expect(page).toHaveURL(/\/student\/notices$/);
    await expect(page.getByRole("heading", { name: "공지사항", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(NOTICE_TITLE) })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(NOTICE_TITLE) }).click();
    await expect(page.getByRole("heading", { name: NOTICE_TITLE })).toBeVisible();
    await expect(page.getByText("수업 자료를 확인하고 복습 영상을 재생해 주세요.")).toBeVisible();
    await expectNoOverflow(page);
    await page.screenshot({ path: test.info().outputPath("legacy-notice.png"), fullPage: true, animations: "disabled" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: NOTICE_TITLE })).toBeVisible({ timeout: 45_000 });
    await page.getByRole("link", { name: "목록으로 돌아가기" }).click();
    await expect(page.getByRole("link", { name: new RegExp(NOTICE_TITLE) })).toBeVisible();
    expect(api.loginBodies).toHaveLength(1);
    expect(await page.evaluate(() => {
      const generation = localStorage.getItem("academy:auth-active-generation:v1");
      const raw = generation && localStorage.getItem(`academy:auth-tokens:v1:${generation}`);
      return raw ? JSON.parse(raw).access : null;
    })).toBe(api.access);

    // Static stylesheet conversion does not cover Ant Design's runtime styles.
    // Open and edit the existing dialog, then cancel without submitting a report.
    await page.getByRole("button", { name: "프로필 메뉴" }).click();
    await page.getByRole("button", { name: "문제 신고", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "문제 신고" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").fill("구형 브라우저 입력 점검");
    await expect(dialog.getByRole("textbox")).toHaveValue("구형 브라우저 입력 점검");
    const modalStyles = await page.locator("style[data-css-hash]").allTextContents();
    const modalCss = modalStyles.filter((css) => css.includes(".ant-modal")).join("\n");
    expect(modalCss).not.toBe("");
    expect(modalCss).not.toContain(":where(");
    expect(modalCss).not.toMatch(/[;{]\s*inset(?:-(?:block|inline)(?:-start|-end)?)?\s*:/);
    const mask = await page.locator(".ant-modal-mask").boundingBox();
    expect(mask?.x).toBe(0);
    expect(mask?.y).toBe(0);
    expect(mask?.width).toBe(profile.width);
    expect(mask?.height).toBe(profile.height);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    await expect.poll(() => api.analyticsBodies.length).toBeGreaterThan(0);
    const screenView = api.analyticsBodies.flatMap((body) => body.events ?? []).find((event) => event.event_type === "screen_view");
    expect(screenView?.event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(await page.evaluate(() => typeof window.fetch)).toBe("function");
    expect(await page.evaluate(() => typeof window.AbortController)).toBe("function");
    expect(scripts.some((url) => /polyfills-legacy-.*\.js/.test(url))).toBe(true);
    expect(scripts.filter((url) => new URL(url).pathname.startsWith("/assets/")).every((url) => /-legacy[^/]*\.js/.test(url))).toBe(true);
    await expect(page.getByText("화면을 불러오지 못했어요")).toHaveCount(0);
    const stylesheets = await page.locator('link[rel="stylesheet"][href*="/assets/"]').evaluateAll((links) => (
      links.map((link) => (link as HTMLLinkElement).href)
    ));
    expect(stylesheets.length).toBeGreaterThan(0);
    expect(stylesheets.every((url) => url.endsWith("-legacy.css"))).toBe(true);
    expect(stylesheetResponses.length).toBeGreaterThan(0);
    expect(stylesheetResponses.every((response) => response.status === 200)).toBe(true);
    await expect.poll(() => page.locator('link[rel="stylesheet"][href*="/assets/"]').evaluateAll((links) => (
      links.every((link) => (link as HTMLLinkElement).sheet !== null)
    ))).toBe(true);
    await expectNoOverflow(page);
    await expect(page.locator("html")).toHaveAttribute("data-student-app", "true");
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.getByRole("button", { name: "프로필 메뉴" }).click();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page.getByRole("form", { name: "로그인 폼" })).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-student-app", "true");
  });
}

test("390px legacy parent selects and switches children, then reloads the same scoped home", async ({ page }) => {
  const profile = { ...profiles[0], width: 390, height: 844 };
  const { scriptRequests, stylesheetResponses } = await installLegacyRuntime(page, profile);
  const api = await installStudentApi(page, "parent");
  await login(page, "parent");
  expect(api.studentScopes).toEqual([]);
  expect(api.loginBodies).toEqual([{ username: "parent.legacy", password: "Case-Sensitive-Pw", tenant_code: "godmin" }]);
  const switcher = page.getByRole("tablist", { name: "자녀 선택" });
  await switcher.getByRole("tab", { name: "첫째 학생" }).click();
  await expect(page.getByRole("heading", { name: "첫째 학생 상태를 한눈에 볼게요" })).toBeVisible();
  await expect(page.getByRole("region", { name: "우리 아이 요약" }).getByText("안정", { exact: true })).toBeVisible();
  await expect(switcher.getByRole("tab", { name: "첫째 학생" })).toHaveAttribute("aria-selected", "true");
  await switcher.getByRole("tab", { name: "둘째 학생" }).click();
  await expect(page.getByRole("heading", { name: "둘째 학생 상태를 한눈에 볼게요" })).toBeVisible();
  await expect(page.getByRole("region", { name: "우리 아이 요약" }).getByText("안정", { exact: true })).toBeVisible();
  await expect(switcher.getByRole("tab", { name: "첫째 학생" })).toHaveAttribute("aria-selected", "false");
  expect(api.studentScopes).toContain("901");
  expect(api.studentScopes).toContain("902");
  expect(api.studentScopes).not.toContain("missing");
  const beforeReload = api.studentScopes.length;
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "둘째 학생 상태를 한눈에 볼게요" })).toBeVisible();
  await expect(page.getByRole("region", { name: "우리 아이 요약" }).getByText("안정", { exact: true })).toBeVisible();
  await expect(switcher.getByRole("tab", { name: "둘째 학생" })).toHaveAttribute("aria-selected", "true");
  expect(api.studentScopes.slice(beforeReload).length).toBeGreaterThan(0);
  expect(api.studentScopes.slice(beforeReload).every((id) => id === "902")).toBe(true);
  expect(api.loginBodies).toHaveLength(1);
  expect(scriptRequests.filter((url) => new URL(url).pathname.startsWith("/assets/")).every((url) => /-legacy[^/]*\.js/.test(url))).toBe(true);
  expect(stylesheetResponses.length).toBeGreaterThan(0);
  expect(stylesheetResponses.every((response) => response.status === 200)).toBe(true);
  await expectNoOverflow(page);
  await page.screenshot({ path: test.info().outputPath("legacy-parent-home390.png"), fullPage: true, animations: "disabled" });
});

test("legacy iOS native HLS contract starts and pauses without a play Promise or MediaSource", async ({ page }) => {
  const { scriptRequests: scripts } = await installLegacyRuntime(page, profiles[0]);
  await installStudentApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "MediaSource", { configurable: true, value: undefined });
    Object.defineProperty(window, "PointerEvent", { configurable: true, value: undefined });
    const canPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type) {
      return /mpegurl/i.test(type) ? "probably" : canPlayType.call(this, type);
    };
    // Older WebKit returns void. Media events stand in for physical decoding;
    // the real controller, access bootstrap and rendered controls still run.
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event("play"));
      this.dispatchEvent(new Event("playing"));
      return undefined as unknown as Promise<void>;
    };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event("pause")); };
  });
  await page.route("https://cdn.example.test/legacy/**", async (route) => {
    await new Promise<void>((resolve) => page.once("close", resolve));
    try { await route.abort(); } catch { /* Request closes with the page. */ }
  });
  await login(page);
  await page.goto(`${BASE}/student/video/play?video=902&session=802`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: VIDEO_TITLE })).toBeVisible({ timeout: 45_000 });
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", "https://cdn.example.test/legacy/master.m3u8");
  await video.evaluate((element) => {
    Object.defineProperty(element, "duration", { configurable: true, get: () => 600 });
    element.dispatchEvent(new Event("loadedmetadata"));
  });
  await page.getByRole("button", { name: "재생", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "일시정지", exact: true })).toBeVisible();
  const player = page.locator(".svpPlayerWrap");
  // The host engine still emits native PointerEvents even after its constructor
  // is removed. Dispatch only the click emitted by old WebKit for this boundary.
  const tapLeft = () => page.locator(".svpGestureLayer").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: rect.left + 8, clientY: rect.top + 8 }));
  });
  await tapLeft();
  await expect(player).toHaveClass(/svpPlayerWrap--controlsHidden/);
  await tapLeft();
  await expect(player).not.toHaveClass(/svpPlayerWrap--controlsHidden/);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(page.getByRole("button", { name: "재생", exact: true }).last()).toBeVisible();
  await video.evaluate((element) => {
    Object.defineProperty(element, "currentTime", { configurable: true, get: () => 125 });
    const hidden = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    if (hidden) Object.defineProperty(document, "hidden", hidden);
    else Reflect.deleteProperty(document, "hidden");
  });
  await expect.poll(() => page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.includes("student-video-position:902:enrollment:self"));
    return key ? JSON.parse(localStorage.getItem(key) || "null")?.pos : null;
  })).toBe(125);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: VIDEO_TITLE })).toBeVisible();
  await video.evaluate((element) => {
    Object.defineProperty(element, "duration", { configurable: true, get: () => 600 });
    element.dispatchEvent(new Event("loadedmetadata"));
  });
  await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBe(125);
  expect(scripts.filter((url) => /hls.*\.js/i.test(url))).toEqual([]);
  await expectNoOverflow(page);
});
