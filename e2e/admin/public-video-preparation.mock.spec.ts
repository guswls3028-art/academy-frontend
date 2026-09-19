import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const SESSION = { lecture_id: 9101, session_id: 9102 };
const FAILURE = "공개 영상 공간을 준비하지 못했습니다. 다시 시도해 주세요.";

async function installApp(page: Page, role: "admin" | "teacher") {
  const state = {
    prepared: false, readFails: false, failNextPrepare: true,
    videoListFails: false, videoListReads: 0,
    videoListWait: null as Promise<void> | null,
    prepares: 0, uploads: 0, completes: 0, youtube: 0,
    folders: [] as Array<{ id: number; name: string; session_id: number; parent_id: null; order: number }>,
    videos: [] as Array<Record<string, unknown>>,
    unexpected: [] as string[],
  };
  await installTenantOneInitScript(page);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, token);
  await page.route("https://i.ytimg.com/**", (route) => route.fulfill({
    contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"/>',
  }));
  await page.route(`${BASE}/mock-public-video-upload`, (route) => route.fulfill({ status: 200, body: "ok" }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "학원플러스", feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: role, name: "검증 선생님", is_staff: true, is_superuser: false, tenantRole: role, must_change_password: false });
    if (path === "/media/videos/public-session/") {
      expect(request.headers()["x-tenant-code"]).toBe("hakwonplus");
      if (method === "GET") return state.readFails ? json({ detail: FAILURE }, 503) : json(state.prepared ? SESSION : null);
      if (method === "POST") {
        state.prepares += 1;
        if (state.failNextPrepare) {
          state.failNextPrepare = false;
          return json({ detail: FAILURE, code: "public_video_session_failed" }, 503);
        }
        state.prepared = true;
        return json(SESSION);
      }
    }
    if (path === "/media/videos/folders/") {
      if (method === "GET") return json(state.folders);
      if (method === "POST") {
        const data = request.postDataJSON();
        expect(state.prepared).toBe(true);
        expect(data.session_id).toBe(SESSION.session_id);
        const folder = { id: 9110, name: data.name, session_id: data.session_id, parent_id: null, order: 1 };
        state.folders.push(folder);
        return json(folder, 201);
      }
    }
    if (path === "/media/videos/" && method === "GET") {
      state.videoListReads += 1;
      if (state.videoListWait) await state.videoListWait;
      return state.videoListFails ? json({ detail: "목록 조회 실패" }, 503) : json(state.videos);
    }
    if (path === "/media/videos/youtube/" && method === "POST") {
      const data = request.postDataJSON();
      expect(state.prepared).toBe(true);
      expect(data.session).toBe(SESSION.session_id);
      state.youtube += 1;
      const video = { id: 9201, session_id: SESSION.session_id, title: data.title, source_type: "youtube", youtube_video_id: "VnqgmOJaMGc", status: "READY" };
      state.videos.push(video);
      return json({ video }, 201);
    }
    if (path === "/media/videos/upload/init/" && method === "POST") {
      expect(state.prepared).toBe(true);
      expect(request.postDataJSON().session).toBe(SESSION.session_id);
      state.uploads += 1;
      return json({ video: { id: 9202 }, upload_url: `${BASE}/mock-public-video-upload`, file_key: "mock-only" }, 201);
    }
    if (path === "/media/videos/9202/upload/complete/" && method === "POST") {
      state.completes += 1;
      state.videos.push({ id: 9202, session_id: SESSION.session_id, title: "first-video", source_type: "s3", status: "UPLOADED" });
      return json({ id: 9202 });
    }
    if (method === "GET" && ["/lectures/lectures/", "/lectures/sessions/", "/staffs/currently-working/", "/results/admin/clinic-targets/"].includes(path)) return json([]);
    const shellReads: Record<string, unknown> = {
      "/staffs/me/": { id: 12, is_working: false, work_types: [] },
      "/core/og-meta/": { title: "학원플러스", description: "공개 영상 검증" },
      "/clinic/participants/": [],
      "/community/admin/posts/": { count: 0, results: [] },
      "/students/registration_requests/": { count: 0, results: [] },
      "/submissions/submissions/pending/": { count: 0, results: [] },
      "/results/admin/teacher-dashboard-counts/": {},
      "/community/admin/reports/pending-count/": { count: 0 },
      "/community/notifications/unread-count/": { count: 0 },
      "/lectures/attendance/arrival-overview/": { students: [], sessions: [], summary: {} },
    };
    if (method === "GET" && Object.hasOwn(shellReads, path)) return json(shellReads[path]);
    state.unexpected.push(`${method} ${path}`);
    return json({ detail: "Unexpected local fixture request" }, 404);
  });
  return state;
}

async function openPublicFolder(page: Page) {
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });
  await page.getByText("전체공개영상", { exact: true }).first().click();
}

async function assertViewport(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test.use({ serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "Local route-mock only");

for (const width of [390, 1366]) {
  test(`teacher list initial failure retries once and survives reload at ${width}px`, async ({ page }, info) => {
    const state = await installApp(page, "teacher");
    state.videoListFails = true;
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/videos`, { timeout: 45_000 });
    const failure = page.getByRole("alert").filter({ hasText: "영상 목록을 불러오지 못했습니다" });
    await expect(failure).toBeVisible();
    await expect(page.getByText("등록된 영상이 없습니다", { exact: true })).toBeHidden();
    await assertViewport(page, width);
    await page.screenshot({ path: info.outputPath(`teacher-list-error-${width}.png`) });
    state.videoListFails = false;
    state.videos.push({ id: 9203, title: "기존 수업 영상", status: "READY", source_type: "s3" });
    let releaseRead!: () => void;
    state.videoListWait = new Promise<void>((resolve) => { releaseRead = resolve; });
    const reads = state.videoListReads;
    try {
      await failure.getByRole("button", { name: "다시 시도", exact: true }).click();
      await expect.poll(() => state.videoListReads).toBe(reads + 1);
      const retrying = page.getByRole("button", { name: "다시 불러오는 중…", exact: true });
      await expect(retrying).toBeDisabled();
      await expect(retrying).toHaveAttribute("aria-busy", "true");
      await retrying.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      expect(state.videoListReads).toBe(reads + 1);
      await expect(page.getByText("등록된 영상이 없습니다", { exact: true })).toBeHidden();
    } finally { releaseRead(); }
    await expect(page.getByText("기존 수업 영상", { exact: true })).toBeVisible();
    await expect(failure).toBeHidden();
    await page.reload();
    await expect(page.getByText("기존 수업 영상", { exact: true })).toBeVisible();
    await assertViewport(page, width);
    await page.screenshot({ path: info.outputPath(`teacher-list-recovered-${width}.png`) });
    expect(state.prepares).toBe(0);
    expect(state.unexpected).toEqual([]);
  });

  test(`teacher list successful zero alone shows empty at ${width}px`, async ({ page }, info) => {
    const state = await installApp(page, "teacher");
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/videos`, { timeout: 45_000 });
    await expect(page.getByText("등록된 영상이 없습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("영상 목록을 불러오지 못했습니다", { exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toBeHidden();
    await assertViewport(page, width);
    await page.screenshot({ path: info.outputPath(`teacher-list-empty-${width}.png`) });
    expect(state.prepares).toBe(0);
    expect(state.unexpected).toEqual([]);
  });

  test(`teacher list refresh failure keeps cards and recovers new data at ${width}px`, async ({ page }, info) => {
    const state = await installApp(page, "teacher");
    state.failNextPrepare = false;
    state.videos.push({ id: 9203, title: "기존 수업 영상", status: "READY", source_type: "s3" });
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/videos`, { timeout: 45_000 });
    await expect(page.getByText("기존 수업 영상", { exact: true })).toBeVisible();
    state.videoListFails = true;
    await page.getByRole("button", { name: "링크 추가", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "YouTube 링크 추가" });
    await dialog.getByLabel("영상 제목").fill("새 수업 영상");
    await dialog.getByLabel("YouTube URL").fill("https://youtu.be/VnqgmOJaMGc");
    await dialog.getByRole("button", { name: "링크 추가", exact: true }).click();
    await expect(dialog).toBeHidden();
    const failure = page.getByRole("alert").filter({ hasText: "영상 목록을 새로 불러오지 못했습니다" });
    await expect(failure).toBeVisible();
    await expect(failure).toContainText("마지막으로 불러온 목록을 표시하고 있습니다");
    await expect(page.getByText("기존 수업 영상", { exact: true })).toBeVisible();
    await expect(page.getByText("새 수업 영상", { exact: true })).toBeHidden();
    await expect(page.getByText("등록된 영상이 없습니다", { exact: true })).toBeHidden();
    await assertViewport(page, width);
    await page.screenshot({ path: info.outputPath(`teacher-list-stale-${width}.png`) });
    state.videoListFails = false;
    await failure.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(failure).toBeHidden();
    await expect(page.getByText("새 수업 영상", { exact: true })).toBeVisible();
    await expect(page.getByText("기존 수업 영상", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("새 수업 영상", { exact: true })).toBeVisible();
    await expect(page.getByText("기존 수업 영상", { exact: true })).toBeVisible();
    expect(state.youtube).toBe(1);
    expect(state.unexpected).toEqual([]);
  });

  test(`admin preparation failure preserves folder input and retries successfully at ${width}px`, async ({ page }, info) => {
    const state = await installApp(page, "admin");
    await page.setViewportSize({ width, height: 900 });
    await openPublicFolder(page);
    await expect(page.getByRole("button", { name: "영상 추가", exact: true })).toBeEnabled();
    expect(state.prepares).toBe(0);
    await page.getByRole("button", { name: "폴더 생성", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const name = dialog.getByPlaceholder("폴더 이름을 입력하세요");
    await name.fill("첫 공개 폴더");
    await dialog.getByRole("button", { name: "생성", exact: true }).click();
    await expect(page.getByText(FAILURE, { exact: true })).toBeVisible();
    await expect(name).toHaveValue("첫 공개 폴더");
    expect(state.folders).toEqual([]);
    await dialog.getByRole("button", { name: "생성", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("첫 공개 폴더", { exact: true })).toBeVisible();
    expect(state.prepares).toBe(2);
    await page.reload();
    await page.getByRole("navigation", { name: "영상 폴더 트리" }).getByRole("button", { name: /전체공개영상/ }).click();
    await expect(page.getByText("첫 공개 폴더", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "영상 추가", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(state.prepares).toBe(3);
    await assertViewport(page, width);
    await page.getByRole("dialog").evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    await page.screenshot({ path: info.outputPath(`admin-${width}.png`) });
    expect(state.unexpected).toEqual([]);
  });

  test(`admin read failure is recoverable and never becomes an empty success at ${width}px`, async ({ page }) => {
    const state = await installApp(page, "admin");
    state.readFails = true;
    await page.setViewportSize({ width, height: 900 });
    await openPublicFolder(page);
    await expect(page.getByText("영상 목록을 불러오지 못했습니다", { exact: true })).toBeVisible();
    await expect(page.getByText("등록된 영상이 없습니다", { exact: true })).toBeHidden();
    expect(state.prepares).toBe(0);
    state.readFails = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(page.getByRole("button", { name: "영상 추가", exact: true })).toBeEnabled();
    expect(state.prepares).toBe(0);
    expect(state.unexpected).toEqual([]);
  });

  test(`teacher YouTube preparation retains input, retries, and survives reload at ${width}px`, async ({ page }, info) => {
    const state = await installApp(page, "teacher");
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/videos`, { timeout: 45_000 });
    await page.getByRole("button", { name: "링크 추가", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "YouTube 링크 추가" });
    await dialog.getByLabel("영상 제목").fill("첫 공개 링크 영상");
    await dialog.getByLabel("YouTube URL").fill("https://youtu.be/VnqgmOJaMGc");
    expect(state.prepares).toBe(0);
    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    const submitBounds = await dialog.getByRole("button", { name: "링크 추가", exact: true }).boundingBox();
    expect(submitBounds).not.toBeNull();
    expect(submitBounds!.y + submitBounds!.height).toBeLessThanOrEqual(900);
    await page.screenshot({ path: info.outputPath(`teacher-dialog-${width}.png`) });
    await dialog.getByRole("button", { name: "링크 추가", exact: true }).click();
    await expect(page.getByText(FAILURE, { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("영상 제목")).toHaveValue("첫 공개 링크 영상");
    await expect(dialog.getByLabel("YouTube URL")).toHaveValue("https://youtu.be/VnqgmOJaMGc");
    expect(state.youtube).toBe(0);
    await dialog.getByRole("button", { name: "링크 추가", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("첫 공개 링크 영상", { exact: true })).toBeVisible();
    expect(state.prepares).toBe(2);
    expect(state.youtube).toBe(1);
    await page.reload();
    await expect(page.getByText("첫 공개 링크 영상", { exact: true })).toBeVisible();
    await assertViewport(page, width);
    await page.screenshot({ path: info.outputPath(`teacher-${width}.png`) });
    expect(state.unexpected).toEqual([]);
  });

  test(`teacher file preparation failure can retry the same file at ${width}px`, async ({ page }) => {
    const state = await installApp(page, "teacher");
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/videos`, { timeout: 45_000 });
    const input = page.locator('input[type="file"]');
    const file = { name: "first-video.mp4", mimeType: "video/mp4", buffer: Buffer.from("fixture-only") };
    await input.setInputFiles(file);
    await expect(page.getByText(FAILURE, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "영상 업로드", exact: true }).first()).toBeEnabled();
    expect(state.uploads).toBe(0);
    await input.setInputFiles(file);
    await expect(page.getByText("first-video", { exact: true })).toBeVisible();
    expect(state.prepares).toBe(2);
    expect(state.uploads).toBe(1);
    expect(state.completes).toBe(1);
    await page.reload();
    await expect(page.getByText("first-video", { exact: true })).toBeVisible();
    expect(state.unexpected).toEqual([]);
  });
}
