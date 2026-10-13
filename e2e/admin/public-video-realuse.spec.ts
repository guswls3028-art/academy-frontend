/** Full publication journey in an isolated, disposable development tenant. */
import { expect, test } from "../fixtures/strictTest";
import { api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, loginAdmin,
  QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_TENANT, STUDENT_PARENT_REALUSE_ENABLED } from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { installReleaseContextGuard, installReleaseRequestGuard, releaseBoundaryFromEnv } from "../helpers/releaseApiBoundary";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import type { ManagedVideo, VideoShowcase } from "../../src/landing/api/publicVideos";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
test.describe("[real-use] public video publishing", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires exact isolated development release boundary.");
  test("two publishers register → draft reload → publish/hero → anonymous detail → edit snapshot → hide", async ({ browser, request }, testInfo) => {
    assertQaStudentParentRuntime();
    const boundary = releaseBoundaryFromEnv(process.env)!; installReleaseRequestGuard(request, boundary);
    const access = (await loginAdmin(request)).access;
    const owned: string[] = [];
    const contexts: Array<{ context: Awaited<ReturnType<typeof browser.newContext>>; guard: Awaited<ReturnType<typeof installReleaseContextGuard>>; strict: ReturnType<typeof attachStrictBrowserGuards> }> = [];
    async function open(width: number) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const guard = await installReleaseContextGuard(context, boundary);
      await context.addInitScript(({ tenant, origin }) => { if (location.origin === origin) { localStorage.setItem("tenant_code", tenant); sessionStorage.setItem("tenantCode", tenant); } }, { tenant: QA_TENANT, origin: new URL(QA_BASE).origin });
      const page = await context.newPage(); const strict = attachStrictBrowserGuards(page); contexts.push({ context, guard, strict });
      page.on("dialog", (dialog) => void dialog.accept()); return page;
    }
    try {
      for (const [index, width] of [1366, 390].entries()) {
        const page = await open(width); await page.goto(`${QA_BASE}/landing/videos`);
        await page.getByRole("link", { name: "로그인", exact: true }).click();
        await page.getByTestId("login-username").fill(index ? "ymath-qa-resource-publisher" : QA_ADMIN_USER);
        await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD); await page.getByTestId("login-submit").click();
        await expect(page).toHaveURL(/\/landing\/videos$/, { timeout: 45_000 }); await acknowledgeInitialAccountPromptsIfVisible(page);
        await page.goto(`${QA_BASE}/landing/videos`); await page.getByRole("link", { name: "영상 관리", exact: true }).click();
        await page.getByRole("link", { name: "새 영상 등록", exact: true }).click();
        await page.getByLabel("01 · YouTube 링크", { exact: true }).fill(index ? "https://youtube.com/shorts/Q70aZV1TH1Y" : "https://youtu.be/xgjL2HyrdFM");
        await page.getByRole("button", { name: "영상 확인", exact: true }).click();
        await expect(page.getByRole("status")).toContainText("영상을 확인했습니다", { timeout: 30_000 });
        const title = `QA 영상 이야기 ${width}`; await page.getByLabel(/^제목/).fill(title);
        await page.getByLabel(/^한 줄 소개/).fill("격리 개발환경에서 공개와 초안 보존을 확인합니다.");
        const created = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/landing-public/videos/manage/");
        await page.getByRole("button", { name: "임시저장", exact: true }).click();
        const response = await created; expect(response.status()).toBe(201); const row = await response.json() as ManagedVideo; owned.push(row.id);
        await expect(page).toHaveURL(`${QA_BASE}/landing/admin/videos/${row.id}`); await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue(title);
        expect((await api(request, "GET", `/landing-public/videos/${row.id}/`, "")).status).toBe(404);
        await page.getByLabel("홈페이지 대표 영상으로 표시", { exact: false }).check();
        await page.getByRole("button", { name: "공개하기", exact: true }).click(); await expect(page.getByRole("status")).toContainText("공개했습니다", { timeout: 30_000 });
        const hero = await api<{ hero: { id: string } }>(request, "GET", "/landing-public/videos/showcase/", ""); expect(hero.body.hero.id).toBe(row.id);
        const visitor = await open(width); await visitor.goto(`${QA_BASE}/landing/videos/${row.id}`);
        await expect(visitor.getByRole("heading", { name: title, exact: true })).toBeVisible(); await visitor.reload(); await expect(visitor.locator("iframe")).toHaveCount(1);
        await expect(visitor.locator("iframe")).toHaveAttribute("src", /autoplay=0/); await expect(visitor.getByRole("link", { name: "YouTube에서 보기 · 좋아요" })).toBeVisible();
        await assertNoHorizontalOverflow(visitor); await visitor.screenshot({ path: testInfo.outputPath(`public-video-${width}.png`), fullPage: true });
        await visitor.getByRole("link", { name: "← 영상 모아보기", exact: true }).click(); await expect(visitor.locator("iframe")).toHaveCount(0);
        if (index) {
          // The second exact publisher edits the first publisher's saved video.
          await page.goto(`${QA_BASE}/landing/admin/videos/${owned[0]}`);
          await page.getByLabel(/^제목/).fill("다른 게시자가 편집한 영상"); await page.getByRole("button", { name: "임시저장", exact: true }).click();
          await expect(page.getByRole("status")).toContainText("임시저장했습니다");
          expect((await api<{ title: string }>(request, "GET", `/landing-public/videos/${owned[0]}/`, "")).body.title).toBe("QA 영상 이야기 1366");
          await page.reload(); await expect(page.getByLabel(/^제목/)).toHaveValue("다른 게시자가 편집한 영상");
          await page.getByRole("button", { name: "수정 내용 공개", exact: true }).click(); await expect(page.getByRole("status")).toContainText("공개했습니다", { timeout: 30_000 });
          expect((await api<{ title: string }>(request, "GET", `/landing-public/videos/${owned[0]}/`, "")).body.title).toBe("다른 게시자가 편집한 영상");
          await page.getByRole("button", { name: "비공개로 전환", exact: true }).click(); await expect(page.getByRole("status")).toContainText("비공개로 전환했습니다");
          expect((await api(request, "GET", `/landing-public/videos/${owned[0]}/`, "")).status).toBe(404);
          expect((await api<{ hero: { id: string } }>(request, "GET", "/landing-public/videos/showcase/", "")).body.hero.id).toBe(row.id);
        }
        await assertNoHorizontalOverflow(page); await page.screenshot({ path: testInfo.outputPath(`video-studio-${width}.png`), fullPage: true });
      }
    } finally {
      // No product delete exists. Hide only these owned QA rows; the scenario's
      // tenant cascade then removes videos/showcase/events and proves tenant/user zero.
      for (const id of owned) {
        const current = await api<ManagedVideo>(request, "GET", `/landing-public/videos/manage/${id}/`, access);
        const showcase = await api<VideoShowcase>(request, "GET", "/landing-public/videos/manage/showcase/", access);
        expect(current.status).toBe(200); expect(showcase.status).toBe(200);
        expect((await api(request, "POST", `/landing-public/videos/manage/${id}/unpublish/`, access, {
          expected_revision: current.body.revision, expected_showcase_revision: showcase.body.revision,
        })).status).toBe(200);
        expect((await api(request, "GET", `/landing-public/videos/${id}/`, "")).status).toBe(404);
      }
      for (const { context, guard, strict } of contexts) {
        await guard.beginClose(); await context.close(); expect.soft(() => guard.assertClean()).not.toThrow(); expect.soft(() => strict.assertZeroDefects()).not.toThrow();
      }
    }
  });
});
