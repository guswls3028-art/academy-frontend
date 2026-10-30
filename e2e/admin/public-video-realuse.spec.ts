/** Full publication journey in an isolated, disposable development tenant. */
import { expect, test } from "../fixtures/strictTest";
import { api, assertNoHorizontalOverflow, assertQaStudentParentRuntime,
  QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_TENANT, STUDENT_PARENT_REALUSE_ENABLED } from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { emitReleaseTestFailure, installReleaseContextGuard, installReleaseRequestGuard, releaseBoundaryFromEnv, type PublicVideoJourneyStage, type PublicVideoPlaybackObservation } from "../helpers/releaseApiBoundary";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import type { ManagedVideo, VideoShowcase } from "../../src/landing/api/publicVideos";

function readPublicVideoPlayback(node: Element, { initialTime, expectedId }: { initialTime: number; expectedId: string }) {
  const video = node as HTMLVideoElement;
  const moviePlayer = video.closest("#movie_player") as (Element & {
    getPlayerState?: () => unknown; getVideoData?: () => { video_id?: unknown };
  }) | null;
  const playing = !video.paused && !video.ended && video.readyState >= 2
    && video.videoWidth > 0 && video.videoHeight > 0 && Number.isFinite(video.currentTime)
    && video.currentTime > initialTime + 1 && moviePlayer !== null
    && !moviePlayer.classList.contains("ad-showing") && !moviePlayer.classList.contains("ad-interrupting");
  const paused = video.paused;
  try {
    const finiteTime = (value: number) => Number.isFinite(value) && value >= 0 && value <= 604800 ? value : null;
    const playerState = moviePlayer?.getPlayerState?.();
    const playerError = moviePlayer?.querySelector(".ytp-error");
    const errorVisible = !!playerError && playerError.getBoundingClientRect().width > 0
      && playerError.getBoundingClientRect().height > 0 && getComputedStyle(playerError).visibility !== "hidden";
    const errorText = errorVisible ? playerError?.textContent ?? "" : "";
    const snapshot: PublicVideoPlaybackObservation = {
      paused: video.paused, ended: video.ended, readyState: video.readyState, networkState: video.networkState,
      width: video.videoWidth, height: video.videoHeight, currentTime: finiteTime(video.currentTime),
      initialTime: finiteTime(initialTime), duration: finiteTime(video.duration), mediaError: video.error?.code ?? null,
      adShowing: moviePlayer?.classList.contains("ad-showing") ?? false,
      adInterrupting: moviePlayer?.classList.contains("ad-interrupting") ?? false,
      playerState: playerState === -1 || playerState === 0 || playerState === 1 || playerState === 2 || playerState === 3 || playerState === 5 ? playerState : null,
      identityMatches: typeof moviePlayer?.getVideoData === "function" ? moviePlayer.getVideoData()?.video_id === expectedId : null,
      errorVisible, errorClass: /confirm.*not a bot|로봇|봇이 아님/i.test(errorText) ? "bot-check"
        : /unavailable|사용할 수 없/i.test(errorText) ? "unavailable"
          : /embedding|다른 웹사이트/i.test(errorText) ? "embedding-disabled" : errorText.trim() ? "other" : "none",
    };
    return { snapshot, playing, paused };
  } catch {
    // Optional provider diagnostics must not change either playback assertion.
    return { snapshot: undefined, playing, paused };
  }
}

test.setTimeout(240_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
test.describe("[real-use] public video publishing", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires exact isolated development release boundary.");
  test("two publishers customize → register/reload → publish → edit/hide → delete → re-register", async ({ browser, request }, testInfo) => {
    assertQaStudentParentRuntime();
    const boundary = releaseBoundaryFromEnv(process.env)!; installReleaseRequestGuard(request, boundary);
    let access = "";
    const owned: string[] = [];
    const publishers: Array<Awaited<ReturnType<typeof open>>> = [];
    const contexts: Array<{ context: Awaited<ReturnType<typeof browser.newContext>>; guard: Awaited<ReturnType<typeof installReleaseContextGuard>>; strict: ReturnType<typeof attachStrictBrowserGuards> }> = [];
    let journeyStage: PublicVideoJourneyStage = "publisher-login";
    let playbackObservation: PublicVideoPlaybackObservation | undefined;
    let activeVisitor: Awaited<ReturnType<typeof open>> | undefined;
    let activeWidth: number | undefined;
    async function open(width: number) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const guard = await installReleaseContextGuard(context, boundary);
      await context.addInitScript(({ tenant, origin }) => { if (location.origin === origin) { localStorage.setItem("tenant_code", tenant); sessionStorage.setItem("tenantCode", tenant); } }, { tenant: QA_TENANT, origin: new URL(QA_BASE).origin });
      const page = await context.newPage(); const strict = attachStrictBrowserGuards(page); contexts.push({ context, guard, strict });
      page.on("dialog", (dialog) => void dialog.accept()); return page;
    }
    try {
      for (const [index, width] of [1366, 390].entries()) {
        playbackObservation = undefined;
        activeVisitor = undefined;
        activeWidth = width;
        journeyStage = "publisher-login";
        const page = await open(width); await page.goto(`${QA_BASE}/landing/videos`);
        await page.getByRole("link", { name: "로그인", exact: true }).click();
        await page.getByTestId("login-username").fill(index ? "ymath-qa-resource-publisher" : QA_ADMIN_USER);
        await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
        const tokenResponse = page.waitForResponse((response) => response.request().method() === "POST"
          && new URL(response.url()).pathname === "/api/v1/token/", { timeout: 45_000 });
        await page.getByTestId("login-submit").click();
        const loginResponse = await tokenResponse;
        expect(loginResponse.status(), `POST /api/v1/token/ returned ${loginResponse.status()}: publisher login`).toBe(200);
        if (index === 0) {
          // Reuse the real UI login for API checks/cleanup without another login quota slot.
          const tokens = await loginResponse.json() as { access?: unknown };
          expect(typeof tokens.access === "string" && tokens.access.length > 0, "Publisher login must return an access token").toBe(true);
          access = tokens.access as string;
        }
        await expect(page).toHaveURL(/\/landing\/videos$/, { timeout: 45_000 }); await acknowledgeInitialAccountPromptsIfVisible(page);
        await page.goto(`${QA_BASE}/landing/videos`); await page.getByRole("link", { name: "영상 관리", exact: true }).click();
        publishers.push(page);
        journeyStage = "showcase-edit";
        await page.getByText("영상 영역 설정", { exact: true }).click();
        if (index) await expect(page.getByLabel("영역 제목", { exact: true })).toHaveValue("QA 영상 자료 1366");
        await page.getByLabel("영역 제목", { exact: true }).fill(`QA 영상 자료 ${width}`);
        await page.getByRole("textbox", { name: "영역 소개 · 선택", exact: true }).fill("게시자가 직접 정한 영상 소개입니다.");
        await page.getByRole("button", { name: "영역 설정 저장", exact: true }).click();
        await expect(page.getByRole("status", { name: "영역 설정 결과" })).toContainText("영상 영역 설정을 저장했습니다");
        await page.reload(); await page.getByText("영상 영역 설정", { exact: true }).click();
        await expect(page.getByLabel("영역 제목", { exact: true })).toHaveValue(`QA 영상 자료 ${width}`);
        await assertNoHorizontalOverflow(page); await page.screenshot({ path: testInfo.outputPath(`video-settings-${width}.png`), fullPage: true });
        journeyStage = "video-register";
        await page.getByRole("link", { name: "새 영상 등록", exact: true }).click();
        await page.getByLabel("01 · YouTube 링크", { exact: true }).fill(index ? "https://youtube.com/shorts/Q70aZV1TH1Y" : "https://youtu.be/xgjL2HyrdFM");
        await page.getByRole("button", { name: "영상 확인", exact: true }).click();
        await expect(page.getByRole("status")).toContainText("영상을 확인했습니다", { timeout: 30_000 });
        const title = `QA 영상 이야기 ${width}`; await page.getByLabel(/^제목/).fill(title);
        await page.getByLabel(/^한 줄 소개/).fill("격리 개발환경에서 공개와 초안 보존을 확인합니다.");
        await page.getByLabel("분류 · 선택", { exact: true }).fill(`직접 정한 분류 ${width}`);
        const created = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/landing-public/videos/manage/");
        const editorReady = page.waitForResponse((response) => response.request().method() === "GET" && response.status() === 200
          && /^\/api\/v1\/landing-public\/videos\/manage\/[a-f0-9-]+\/$/.test(new URL(response.url()).pathname));
        await page.getByRole("button", { name: "임시저장", exact: true }).click();
        const response = await created; expect(response.status()).toBe(201); const row = await response.json() as ManagedVideo; owned.push(row.id);
        await expect(page).toHaveURL(`${QA_BASE}/landing/admin/videos/${row.id}`); await editorReady;
        await expect(page.getByLabel(/^제목/)).toHaveValue(title);
        await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue(title);
        await expect(page.getByLabel("분류 · 선택", { exact: true })).toHaveValue(`직접 정한 분류 ${width}`);
        expect((await api(request, "GET", `/landing-public/videos/${row.id}/`, "")).status).toBe(404);
        journeyStage = "video-publish";
        await page.getByLabel("홈페이지 대표 영상으로 표시", { exact: false }).check();
        await page.getByRole("button", { name: "공개하기", exact: true }).click(); await expect(page.getByRole("status")).toContainText("공개했습니다", { timeout: 30_000 });
        const hero = await api<{ hero: { id: string } }>(request, "GET", "/landing-public/videos/showcase/", ""); expect(hero.body.hero.id).toBe(row.id);
        journeyStage = "public-catalog";
        const visitor = await open(width); await visitor.goto(`${QA_BASE}/landing/videos`);
        await expect(visitor.getByRole("heading", { name: `QA 영상 자료 ${width}`, exact: true })).toBeVisible();
        await expect(visitor.getByText("게시자가 직접 정한 영상 소개입니다.", { exact: true })).toBeVisible();
        await visitor.getByRole("navigation", { name: "영상 종류" }).getByRole("button", { name: index ? "Shorts" : "동영상", exact: true }).click();
        await visitor.getByRole("button", { name: "인기순", exact: true }).click();
        await expect(visitor.getByText(/^YouTube 조회수 [\d,]+회$/).first()).toBeVisible({ timeout: 30_000 });
        await visitor.reload();
        await expect(visitor.getByRole("button", { name: "인기순", exact: true })).toHaveAttribute("aria-pressed", "true");
        await visitor.getByRole("button", { name: "오래된순", exact: true }).click();
        await visitor.getByRole("textbox", { name: "영상 검색", exact: true }).fill(title);
        await visitor.getByRole("button", { name: "검색", exact: true }).click();
        await expect(visitor.getByRole("heading", { level: 3 })).toHaveCount(1);
        journeyStage = "public-detail";
        await visitor.getByRole("link").filter({ has: visitor.getByRole("heading", { name: title, level: 3, exact: true }) }).click();
        await expect(visitor.getByRole("heading", { name: title, exact: true })).toBeVisible(); await visitor.reload(); await expect(visitor.locator("iframe")).toHaveCount(1);
        await expect(visitor.getByText(`직접 정한 분류 ${width}`, { exact: true })).toBeVisible();
        await expect(visitor.locator("iframe")).toHaveAttribute("src", /autoplay=0/); await expect(visitor.getByRole("link", { name: "YouTube에서 보기 · 좋아요" })).toBeVisible();
        const embedUrl = new URL(await visitor.locator("iframe").getAttribute("src") ?? "");
        expect(embedUrl.origin).toBe("https://www.youtube.com");
        expect(embedUrl.pathname).toBe(`/embed/${row.youtube_video_id}`);
        journeyStage = "player-ready";
        const player = visitor.frameLocator("iframe");
        const playButton = player.getByRole("button", { name: /^(?:Play(?: video)?|동영상 재생|재생)(?: \(k\))?$/i }).filter({ visible: true }).first();
        await expect(playButton).toBeVisible({ timeout: 30_000 });
        await expect(player.locator(".ytp-error")).toBeHidden();
        activeVisitor = visitor;
        journeyStage = "player-playing";
        await playButton.click();
        const media = player.locator("#movie_player video.html5-main-video").first();
        const startedAt = await media.evaluate((node) => (node as HTMLVideoElement).currentTime);
        expect(Number.isFinite(startedAt)).toBe(true);
        const readPlayback = () => media.evaluate(readPublicVideoPlayback, { initialTime: startedAt, expectedId: row.youtube_video_id });
        await expect.poll(async () => {
          const result = await readPlayback(); playbackObservation = result.snapshot; return result.playing;
        }, { timeout: 30_000 }).toBe(true);
        playbackObservation = undefined;
        journeyStage = "player-paused";
        await player.locator("#movie_player").hover();
        await player.getByRole("button", { name: /^(?:Pause|일시중지|일시 중지)(?: ?\(k\))?$/i }).filter({ visible: true }).first().click();
        await expect.poll(async () => {
          const result = await readPlayback(); playbackObservation = result.snapshot; return result.paused;
        }).toBe(true);
        await expect(player.locator(".ytp-error")).toBeHidden();
        await assertNoHorizontalOverflow(visitor); await visitor.screenshot({ path: testInfo.outputPath(`public-video-${width}.png`), fullPage: true, animations: "disabled" });
        journeyStage = "public-catalog";
        await visitor.getByRole("link", { name: "← 영상 목록", exact: true }).click(); await expect(visitor.locator("iframe")).toHaveCount(0);
        await expect(visitor.getByRole("textbox", { name: "영상 검색", exact: true })).toHaveValue(title);
        await expect(visitor.getByRole("button", { name: "오래된순", exact: true })).toHaveAttribute("aria-pressed", "true");
        await visitor.getByRole("button", { name: "검색 지우기", exact: true }).click();
        journeyStage = "video-edit";
        await page.goto(`${QA_BASE}/landing/videos/${row.id}`);
        await expect(page.getByRole("link", { name: "로그인", exact: true })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "영상 관리", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "영상 등록", exact: true })).toBeVisible();
        await page.getByRole("link", { name: "이 영상 수정", exact: true }).click();
        await expect(page.getByLabel(/^제목/)).toHaveValue(title);
        if (index) {
          // The second exact publisher edits the first publisher's saved video.
          await page.goto(`${QA_BASE}/landing/admin/videos/${owned[0]}`);
          await page.getByLabel(/^제목/).fill("다른 게시자가 편집한 영상"); await page.getByRole("button", { name: "임시저장", exact: true }).click();
          await expect(page.getByRole("status")).toContainText("임시저장했습니다");
          expect((await api<{ title: string }>(request, "GET", `/landing-public/videos/${owned[0]}/`, "")).body.title).toBe("QA 영상 이야기 1366");
          await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue("다른 게시자가 편집한 영상");
          await page.getByRole("button", { name: "수정 내용 공개", exact: true }).click(); await expect(page.getByRole("status")).toContainText("공개했습니다", { timeout: 30_000 });
          expect((await api<{ title: string }>(request, "GET", `/landing-public/videos/${owned[0]}/`, "")).body.title).toBe("다른 게시자가 편집한 영상");
          journeyStage = "video-hide";
          await page.getByRole("button", { name: "비공개로 전환", exact: true }).click(); await expect(page.getByRole("status")).toContainText("비공개로 전환했습니다");
          expect((await api(request, "GET", `/landing-public/videos/${owned[0]}/`, "")).status).toBe(404);
          expect((await api<{ hero: { id: string } }>(request, "GET", "/landing-public/videos/showcase/", "")).body.hero.id).toBe(row.id);
        }
        await assertNoHorizontalOverflow(page); await page.screenshot({ path: testInfo.outputPath(`video-studio-${width}.png`), fullPage: true });
      }
      for (const [index, page] of publishers.entries()) {
        journeyStage = "video-delete";
        const deletedId = owned[index];
        await page.goto(`${QA_BASE}/landing/admin/videos/${deletedId}`);
        await page.getByRole("button", { name: "영상 삭제", exact: true }).click();
        await expect(page).toHaveURL(`${QA_BASE}/landing/admin/videos`);
        await expect(page.getByRole("status", { name: "삭제 결과" })).toContainText("영상을 삭제했습니다");
        await page.reload(); await expect(page.locator(`a[href="/landing/admin/videos/${deletedId}"]`)).toHaveCount(0);
        expect((await api(request, "GET", `/landing-public/videos/${deletedId}/`, "")).status).toBe(404);
        expect((await api(request, "GET", `/landing-public/videos/manage/${deletedId}/`, access)).status).toBe(404);
        if (index) expect((await api<{ hero: null }>(request, "GET", "/landing-public/videos/showcase/", "")).body.hero).toBeNull();
        journeyStage = "video-reregister";
        await page.getByRole("link", { name: "새 영상 등록", exact: true }).click();
        await page.getByLabel("01 · YouTube 링크", { exact: true }).fill(index ? "https://youtube.com/shorts/Q70aZV1TH1Y" : "https://youtu.be/xgjL2HyrdFM");
        await page.getByLabel(/^제목/).fill(`다시 등록한 영상 ${index}`);
        const recreated = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/landing-public/videos/manage/");
        const ready = page.waitForResponse((response) => response.request().method() === "GET" && response.status() === 200 && /^\/api\/v1\/landing-public\/videos\/manage\/[a-f0-9-]+\/$/.test(new URL(response.url()).pathname));
        await page.getByRole("button", { name: "임시저장", exact: true }).click();
        const replacementResponse = await recreated; expect(replacementResponse.status()).toBe(201);
        const replacement = await replacementResponse.json() as ManagedVideo; owned.push(replacement.id); expect(replacement.id).not.toBe(deletedId);
        await ready; await expect(page.getByLabel(/^제목/)).toHaveValue(`다시 등록한 영상 ${index}`);
        await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue(`다시 등록한 영상 ${index}`);
        await assertNoHorizontalOverflow(page);
      }
    } catch (error) {
      emitReleaseTestFailure(error, "public-video-primary", undefined, journeyStage, playbackObservation);
      if (activeVisitor && activeWidth && ["player-playing", "player-paused"].includes(journeyStage)) {
        try { await activeVisitor.screenshot({ path: testInfo.outputPath(`public-video-${activeWidth}.png`), fullPage: true, animations: "disabled", timeout: 3_000 }); }
        catch { /* Keep the original failure even if its final public frame is unavailable. */ }
      }
      throw error;
    } finally {
      // Only IDs created in this disposable QA tenant are removed. Its tenant
      // cascade then removes deletion tombstones/events and proves tenant/user zero.
      for (const id of owned) {
        const current = await api<ManagedVideo>(request, "GET", `/landing-public/videos/manage/${id}/`, access);
        if (current.status === 404) { expect((await api(request, "GET", `/landing-public/videos/${id}/`, "")).status).toBe(404); continue; }
        const showcase = await api<VideoShowcase>(request, "GET", "/landing-public/videos/manage/showcase/", access);
        expect(current.status).toBe(200); expect(showcase.status).toBe(200);
        expect((await api(request, "DELETE", `/landing-public/videos/manage/${id}/?expected_revision=${current.body.revision}&expected_showcase_revision=${showcase.body.revision}`, access)).status).toBe(204);
        expect((await api(request, "GET", `/landing-public/videos/${id}/`, "")).status).toBe(404);
      }
      for (const { context, guard, strict } of contexts) {
        await guard.beginClose(); await context.close(); expect.soft(() => guard.assertClean()).not.toThrow(); expect.soft(() => strict.assertZeroDefects()).not.toThrow();
      }
    }
  });
});
