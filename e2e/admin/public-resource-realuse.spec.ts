/** Exact-artifact public resource journey in disposable development tenants only. */
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { expect, test } from "../fixtures/strictTest";
import { api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, loginAdmin,
  QA_ADMIN_PASSWORD, QA_ADMIN_USER, QA_BASE, QA_TENANT, STUDENT_PARENT_REALUSE_ENABLED } from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { installReleaseContextGuard, releaseBoundaryFromEnv, installReleaseRequestGuard } from "../helpers/releaseApiBoundary";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import { loginViaUI } from "../helpers/auth";

test.setTimeout(360_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
type Post = { id: number; title: string; files: Array<{ id: string; filename: string }> };

test.describe.serial("[real-use] 공개 보고서 본문 읽기", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the exact isolated development release boundary.");
  test("two publishers → PDF/HWPX/Office/original upload → anonymous article reading/reload/download → cross-publisher edit/delete", async ({ browser, request }, testInfo) => {
    assertQaStudentParentRuntime();
    const boundary = releaseBoundaryFromEnv(process.env)!;
    installReleaseRequestGuard(request, boundary);
    let access = "";
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    for (let page = 1; page <= 3; page += 1) {
      document.addPage([595, 842]).drawText(`QA PUBLIC RESOURCE PAGE ${page} OF 3`, { x: 40, y: 750, font });
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("QA");
    sheet.columns = [{ width: 24 }, { width: 12 }];
    sheet.addRow(["QA analysis", 90]);
    const archive = new JSZip(); archive.file("analysis.txt", "QA original analysis");
    const originals = [
      { name: "공개 보고서.PDF", mimeType: "application/pdf", buffer: Buffer.from(await document.save()) },
      { name: "한글 수식.hwp", mimeType: "application/octet-stream", buffer: await readFile(new URL("../fixtures/documents/public-resource-equation.hwp", import.meta.url)) },
      { name: "한글 자료.hwpx", mimeType: "application/octet-stream", buffer: await readFile(new URL("../fixtures/documents/public-resource-report.hwpx", import.meta.url)) },
      { name: "분석표.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) },
      { name: "묶음 자료.zip", mimeType: "application/octet-stream", buffer: await archive.generateAsync({ type: "nodebuffer" }) },
    ];
    const posts: Post[] = [];
    const contexts: Array<{ context: Awaited<ReturnType<typeof browser.newContext>>; guard: Awaited<ReturnType<typeof installReleaseContextGuard>>; strict: ReturnType<typeof attachStrictBrowserGuards> }> = [];
    async function open(width: number) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const guard = await installReleaseContextGuard(context, boundary);
      await context.addInitScript(({ tenant, origin }) => {
        if (location.origin !== origin) return;
        localStorage.setItem("tenant_code", tenant); sessionStorage.setItem("tenantCode", tenant);
      }, { tenant: QA_TENANT, origin: new URL(QA_BASE).origin });
      const page = await context.newPage(); const strict = attachStrictBrowserGuards(page);
      contexts.push({ context, guard, strict }); return page;
    }
    try {
      for (const [index, width] of [1366, 390].entries()) {
        const page = await open(width);
        await page.goto(`${QA_BASE}/landing/resources`);
        await page.getByRole("link", { name: "로그인", exact: true }).click();
        await page.getByTestId("login-username").fill(index ? "ymath-qa-resource-publisher" : QA_ADMIN_USER);
        await page.getByTestId("login-password").fill(QA_ADMIN_PASSWORD);
        const tokenResponse = page.waitForResponse((response) => response.request().method() === "POST"
          && new URL(response.url()).pathname === "/api/v1/token/", { timeout: 45_000 });
        await page.getByTestId("login-submit").click();
        const loginResponse = await tokenResponse;
        expect(loginResponse.status(), `POST /api/v1/token/ returned ${loginResponse.status()}: resource publisher login`).toBe(200);
        if (index === 0) {
          // Reuse the real UI login for cleanup instead of consuming another login quota slot.
          const tokens = await loginResponse.json() as { access?: unknown };
          expect(typeof tokens.access === "string" && tokens.access.length > 0, "Publisher login must return an access token").toBe(true);
          access = tokens.access as string;
        }
        await expect(page).toHaveURL(/\/landing\/resources$/, { timeout: 45_000 });
        await acknowledgeInitialAccountPromptsIfVisible(page);
        if (index) {
          // The publisher fixture has tenantRole=teacher, unlike QA_ADMIN_USER.
          // Prove guide access with the real account and the exact release bundle.
          for (const guide of [
            { width: 1366, path: "/workspace/guide", title: "출결 입력과 수업 마감", photoWidth: 1366 },
            { width: 390, path: "/workspace/mobile/guide", title: "모바일 출결 입력", photoWidth: 390 },
          ]) {
            await page.setViewportSize({ width: guide.width, height: 900 });
            if (guide.width === 390) {
              await page.goto(`${QA_BASE}/workspace/mobile`);
              await page.getByRole("button", { name: "메뉴", exact: true }).click();
              const navigation = page.getByRole("navigation", { name: "선생님 메뉴" });
              const support = navigation.getByRole("button", { name: /^지원/ });
              if (await support.getAttribute("aria-expanded") !== "true") await support.click();
              await navigation.getByRole("button", { name: "사용 가이드", exact: true }).click();
              await expect(page).toHaveURL(`${QA_BASE}/workspace/mobile/guide`);
            }
            const guideUrl = `${QA_BASE}${guide.path}?topic=attendance`;
            await page.goto(guideUrl);
            const article = page.getByRole("article", { name: guide.title });
            await expect(article).toBeVisible();
            // The public board does not mount ProtectedRoute's first-login prompts.
            // Complete them on the first workspace visit before using its controls.
            await acknowledgeInitialAccountPromptsIfVisible(page);
            const currentUserResponse = page.waitForResponse((response) => response.request().method() === "GET"
              && new URL(response.url()).pathname === "/api/v1/core/me/");
            await page.reload();
            const currentUser = await currentUserResponse;
            expect(currentUser.status()).toBe(200);
            expect(await currentUser.json()).toMatchObject({ tenantRole: "teacher", is_staff: true, is_superuser: false, first_login_guide_required: false });
            await expect(article).toBeVisible();
            await expect(page.getByRole("dialog", { name: "계정 안내" })).toBeHidden();
            await expect(page.getByRole("dialog", { name: "비밀번호 변경 권장" })).toBeHidden();
            const media = article.getByRole("region", { name: "화면으로 따라하기" });
            const photo = media.locator("figure img");
            const choices = media.getByRole("group", { name: "따라할 화면 선택" }).getByRole("button");
            await expect(choices).toHaveCount(4);
            for (const choice of await choices.all()) {
              await choice.click();
              await expect(choice).toHaveAttribute("aria-pressed", "true");
              await photo.scrollIntoViewIfNeeded();
              await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(guide.photoWidth);
            }
            await media.getByRole("button", { name: /사진 크게 보기$/ }).click();
            const dialog = page.getByRole("dialog", { name: /사진 확대$/ });
            await expect(dialog).toBeVisible();
            await expect.poll(() => dialog.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(guide.photoWidth);
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
            const summary = media.locator("summary");
            await summary.click();
            const video = media.locator("video");
            await video.evaluate((element: HTMLVideoElement) => element.scrollIntoView({ block: "center", behavior: "instant" }));
            await video.evaluate((element: HTMLVideoElement) => element.play());
            await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.2);
            await video.evaluate((element: HTMLVideoElement) => { element.currentTime = 5; element.textTracks[0].mode = "hidden"; });
            await expect.poll(() => video.evaluate((element: HTMLVideoElement) => !element.seeking && element.readyState >= 2 && element.currentTime >= 5)).toBe(true);
            await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.textTracks[0].cues?.length ?? 0)).toBe(4);
            await expect(media.getByRole("link", { name: "자막 포함 영상 내려받기 ↓" })).toHaveAttribute("download", /\.mp4$/);
            const downloading = page.waitForEvent("download");
            await media.getByRole("link", { name: "자막 포함 영상 내려받기 ↓" }).click();
            const download = await downloading;
            expect(await download.failure()).toBeNull();
            expect(download.suggestedFilename()).toMatch(/\.mp4$/);
            const downloadedVideo = await readFile((await download.path())!);
            expect(downloadedVideo.length).toBeGreaterThan(10_000);
            expect(downloadedVideo.subarray(4, 8).toString()).toBe("ftyp");
            await video.evaluate((element: HTMLVideoElement) => element.scrollIntoView({ block: "center", behavior: "instant" }));
            await expect(video).toBeInViewport({ ratio: 1 });
            await testInfo.attach(`authenticated-teacher-guide-${guide.width}-video`, { body: await video.screenshot(), contentType: "image/png" });
            await summary.click();
            await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
            await page.reload();
            await expect(page).toHaveURL(guideUrl);
            await expect(article).toBeVisible();
            await expect(choices.first()).toHaveAttribute("aria-pressed", "true");
            await photo.scrollIntoViewIfNeeded();
            await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(guide.photoWidth);
            await testInfo.attach(`authenticated-teacher-guide-${guide.width}-photo`, { body: await photo.screenshot(), contentType: "image/png" });
            await assertNoHorizontalOverflow(page);
          }
        }
        await page.goto(`${QA_BASE}/landing/resources`);
        await page.getByRole("link", { name: "글 올리기", exact: true }).click();
        await page.getByLabel("분류", { exact: true }).selectOption(index ? "analysis" : "matchup");
        const title = `QA 자료 공유 ${width}`;
        await page.getByLabel("제목", { exact: true }).fill(title);
        // A complete file is sufficient: no splitting, retyping or custom form.
        if (index) await page.getByRole("textbox", { name: "본문", exact: true }).fill("로그인 없이 읽는 첨부 보고서입니다.");
        await page.getByLabel("첨부 자료", { exact: true }).setInputFiles(originals);
        await expect(page.getByText("묶음 자료.zip", { exact: true })).toBeVisible({ timeout: 90_000 });
        await expect(page.getByRole("button", { name: "게시하기", exact: true })).toBeEnabled({ timeout: 180_000 });
        const preview = page.getByRole("region", { name: "방문자 읽기 화면", exact: true });
        await expect(page.getByRole("textbox", { name: "본문", exact: true })).toHaveValue(index ? "로그인 없이 읽는 첨부 보고서입니다." : "");
        const previewDocument = preview.getByRole("region", { name: "공개 보고서.PDF 본문", exact: true });
        await previewDocument.scrollIntoViewIfNeeded();
        await expect(previewDocument.getByTestId("resource-page-image")).toHaveCount(3, { timeout: 60_000 });
        const published = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/landing-public/resources/");
        await page.getByRole("button", { name: "게시하기", exact: true }).click();
        const response = await published; expect(response.status()).toBe(201);
        const post = await response.json() as Post; posts.push(post);
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await page.reload(); await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        if (index) {
          await page.goto(`${QA_BASE}/landing/resources/${posts[0].id}`);
          await page.getByRole("link", { name: "수정", exact: true }).click();
          await page.getByRole("textbox", { name: "본문", exact: true }).fill("다른 지정 게시자가 원본 첨부를 보존하며 수정했습니다.");
          const edited = page.waitForResponse((response) => response.request().method() === "PATCH"
            && new URL(response.url()).pathname === `/api/v1/landing-public/resources/${posts[0].id}/`);
          await page.getByRole("button", { name: "수정 내용 게시", exact: true }).click();
          expect((await edited).status()).toBe(200);
          // The editor textarea and preview contain the same text before navigation.
          // Verify the saved article, never the draft or its preview.
          await expect(page).toHaveURL(`${QA_BASE}/landing/resources/${posts[0].id}`);
          await expect(page.getByRole("article").getByText("다른 지정 게시자가 원본 첨부를 보존하며 수정했습니다.", { exact: true })).toBeVisible();
        }
        const visitor = await open(width);
        await visitor.goto(`${QA_BASE}/landing/resources/${post.id}`);
        await expect(visitor.getByRole("link", { name: "수정", exact: true })).toHaveCount(0);
        await visitor.reload(); await expect(visitor.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await expect(visitor.getByRole("button", { name: "PDF 미리보기", exact: true })).toHaveCount(0);
        const pdf = visitor.getByRole("region", { name: "공개 보고서.PDF 본문", exact: true });
        await pdf.scrollIntoViewIfNeeded();
        await expect(pdf.getByTestId("resource-page-image")).toHaveCount(3, { timeout: 60_000 });
        for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
          const documentPage = pdf.getByTestId("resource-page-image").nth(pageIndex);
          await documentPage.scrollIntoViewIfNeeded();
          await expect(documentPage).toHaveAttribute("data-render-status", "ready", { timeout: 60_000 });
          expect(await documentPage.locator("img").evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
          await expect(pdf).toContainText(`QA PUBLIC RESOURCE PAGE ${pageIndex + 1} OF 3`);
        }
        await pdf.getByRole("button", { name: "문서 확대", exact: true }).click();
        await expect(pdf.locator("output")).toHaveText("125%");
        await assertNoHorizontalOverflow(visitor);
        await pdf.getByRole("button", { name: "문서 축소", exact: true }).click();
        await pdf.getByRole("button", { name: "전체화면 보기", exact: true }).click();
        const viewer = visitor.getByRole("dialog");
        await expect(viewer.getByTestId("resource-viewer-page")).toHaveAttribute("data-render-status", "ready", { timeout: 60_000 });
        expect(await viewer.getByRole("region").evaluate((stage) => stage.scrollHeight <= stage.clientHeight + 1 && stage.scrollWidth <= stage.clientWidth + 1)).toBe(true);
        if (await viewer.getAttribute("data-controls-visible") === "false") await viewer.getByTestId("resource-viewer-page").click();
        await viewer.getByRole("button", { name: "다음 쪽", exact: true }).click();
        await expect(viewer.getByTestId("resource-viewer-page")).toHaveAttribute("data-page-number", "2");
        await expect(viewer.getByTestId("resource-viewer-page")).toHaveAttribute("data-render-status", "ready", { timeout: 60_000 });
        await expect(viewer).toContainText("QA PUBLIC RESOURCE PAGE 2 OF 3");
        if (await viewer.getAttribute("data-controls-visible") === "false") await viewer.getByTestId("resource-viewer-page").click();
        await viewer.getByRole("button", { name: "전체화면 닫기", exact: true }).click();
        await expect(viewer).toHaveCount(0);
        const hangul = visitor.getByRole("region", { name: "한글 자료.hwpx 본문", exact: true });
        await hangul.scrollIntoViewIfNeeded();
        await expect(hangul.locator('[data-testid="resource-page-image"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
        // PDF text layers may omit spaces while the original page remains correctly laid out.
        await expect.poll(async () => (await hangul.textContent())?.replace(/\s/g, "")).toContain("산화와환원");
        await expect(hangul).toContainText("85%");
        const equation = visitor.getByRole("region", { name: "한글 수식.hwp 본문", exact: true });
        await equation.scrollIntoViewIfNeeded();
        await expect(equation.locator('[data-testid="resource-page-image"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
        const spreadsheet = visitor.getByRole("region", { name: "분석표.xlsx 본문", exact: true });
        await spreadsheet.scrollIntoViewIfNeeded();
        await expect(spreadsheet.locator('[data-testid="resource-page-image"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
        await expect(spreadsheet).toContainText("QA analysis");
        await expect(visitor.getByRole("region", { name: "자료 다운로드", exact: true })).toBeVisible();
        for (const original of originals) {
          const row = visitor.getByText(original.name, { exact: true }).first().locator("..").locator("..");
          const downloading = visitor.waitForEvent("download");
          await row.getByRole("button", { name: /다운로드$/ }).click();
          const download = await downloading; expect(await download.failure()).toBeNull();
          expect(download.suggestedFilename()).toBe(original.name);
          expect(await readFile((await download.path())!)).toEqual(original.buffer);
        }
        if (index) {
          await visitor.goto(`${QA_BASE}/landing/resources/${posts[0].id}`);
          await visitor.reload();
          await expect(visitor.getByText("다른 지정 게시자가 원본 첨부를 보존하며 수정했습니다.", { exact: true })).toBeVisible();
          await expect(visitor.getByRole("link", { name: "수정", exact: true })).toHaveCount(0);
          await expect(visitor.getByRole("region", { name: "자료 다운로드", exact: true })).toBeVisible();
          for (const original of originals) await expect(visitor.getByText(original.name, { exact: true }).first()).toBeVisible();
          const original = originals[0];
          const row = visitor.getByText(original.name, { exact: true }).first().locator("..").locator("..");
          const downloading = visitor.waitForEvent("download");
          await row.getByRole("button", { name: /다운로드$/ }).click();
          const download = await downloading; expect(await download.failure()).toBeNull();
          expect(download.suggestedFilename()).toBe(original.name);
          expect(await readFile((await download.path())!)).toEqual(original.buffer);
        }
        await assertNoHorizontalOverflow(visitor);
        await visitor.screenshot({ path: testInfo.outputPath(`public-resource-${width}.png`), fullPage: true });
        if (!index) continue;
        await page.goto(`${QA_BASE}/landing/resources/${post.id}`);
        page.once("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "삭제", exact: true }).click();
        await expect(page).toHaveURL(/\/landing\/resources$/);
        expect((await api(request, "GET", `/landing-public/resources/${post.id}/`, "")).status).toBe(404);
        for (const file of post.files) expect((await api(request, "GET", `/landing-public/resource-files/${file.id}/`, "")).status).toBe(404);
      }
    } finally {
      for (const post of posts) {
        expect([204, 404]).toContain((await api(request, "DELETE", `/landing-public/resources/${post.id}/`, access)).status);
        expect((await api(request, "GET", `/landing-public/resources/${post.id}/`, "")).status).toBe(404);
      }
      for (const { context, guard, strict } of contexts) {
        await guard.beginClose(); await context.close();
        expect.soft(() => guard.assertClean()).not.toThrow();
        expect.soft(() => strict.assertZeroDefects()).not.toThrow();
      }
      // Soft-deleted original objects are preserved by product policy. The owning
      // scenario cleanup purges only this disposable tenant and proves R2/user zero.
    }
  });
  test("Word/PowerPoint/text/image originals → anonymous desktop/mobile reading and exact download", async ({ page, browser, request }) => {
    assertQaStudentParentRuntime();
    const access = (await loginAdmin(request)).access;
    const originals = [
      { name: "문서 원본.docx", mimeType: "application/octet-stream", buffer: await readFile(new URL("../fixtures/documents/public-resource-note.docx", import.meta.url)) },
      { name: "발표 원본.pptx", mimeType: "application/octet-stream", buffer: await readFile(new URL("../fixtures/documents/public-resource-slide.pptx", import.meta.url)) },
      { name: "읽어보기.txt", mimeType: "text/plain", buffer: Buffer.from("QA plain original: 42 / 100.") },
      { name: "합성 그래프.png", mimeType: "image/png", buffer: await readFile(new URL("../fixtures/documents/public-resource-bars.png", import.meta.url)) },
    ];
    let post: Post | undefined;
    const visitorContext = await browser.newContext({ serviceWorkers: "block" });
    await visitorContext.addInitScript(({ tenant, origin }) => {
      if (location.origin !== origin) return;
      localStorage.setItem("tenant_code", tenant); sessionStorage.setItem("tenantCode", tenant);
    }, { tenant: QA_TENANT, origin: new URL(QA_BASE).origin });
    try {
      await loginViaUI(page, "admin", { landingPath: "/landing/resources" });
      await page.getByRole("link", { name: "글 올리기", exact: true }).click();
      await page.getByLabel("제목", { exact: true }).fill("QA 원본 형식별 읽기");
      await page.getByLabel("첨부 자료", { exact: true }).setInputFiles(originals);
      await expect(page.getByText("합성 그래프.png", { exact: true })).toBeVisible({ timeout: 90_000 });
      await expect(page.getByRole("button", { name: "게시하기", exact: true })).toBeEnabled({ timeout: 180_000 });
      const published = page.waitForResponse((response) => response.request().method() === "POST"
        && new URL(response.url()).pathname === "/api/v1/landing-public/resources/");
      await page.getByRole("button", { name: "게시하기", exact: true }).click();
      const response = await published;
      expect(response.status()).toBe(201);
      post = await response.json() as Post;
      expect(post.files).toHaveLength(originals.length);
      const visitor = await visitorContext.newPage();
      for (const width of [1366, 390]) {
        await visitor.setViewportSize({ width, height: 900 });
        await visitor.goto(`${QA_BASE}/landing/resources/${post.id}`);
        await visitor.reload();
        await expect(visitor.getByRole("heading", { name: "QA 원본 형식별 읽기", exact: true })).toBeVisible();
        for (const [filename, title] of [["문서 원본.docx", "QA document original"], ["발표 원본.pptx", "QA slide original"]]) {
          const office = visitor.getByRole("region", { name: `${filename} 본문`, exact: true });
          await office.scrollIntoViewIfNeeded();
          await expect(office.locator('[data-testid="resource-page-image"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
          await expect(office).toContainText(title);
        }
        const text = visitor.getByRole("region", { name: "읽어보기.txt 본문", exact: true });
        await text.scrollIntoViewIfNeeded();
        await expect(text).toContainText("QA plain original: 42 / 100.");
        const graph = visitor.getByRole("region", { name: "합성 그래프.png 본문", exact: true });
        await graph.scrollIntoViewIfNeeded();
        const graphImage = graph.getByRole("img", { name: "첨부 이미지" });
        await expect(graphImage).toBeVisible();
        await expect.poll(() => graphImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 120 && image.naturalHeight === 60)).toBe(true);
        for (const original of originals) {
          const row = visitor.getByText(original.name, { exact: true }).first().locator("..").locator("..");
          const downloading = visitor.waitForEvent("download");
          await row.getByRole("button", { name: /다운로드$/ }).click();
          const download = await downloading;
          expect(await download.failure()).toBeNull();
          expect(download.suggestedFilename()).toBe(original.name);
          expect(await readFile((await download.path())!)).toEqual(original.buffer);
        }
        await assertNoHorizontalOverflow(visitor);
      }
    } finally {
      await visitorContext.close();
      if (post) {
        expect([204, 404]).toContain((await api(request, "DELETE", `/landing-public/resources/${post.id}/`, access)).status);
        expect((await api(request, "GET", `/landing-public/resources/${post.id}/`, "")).status).toBe(404);
      }
    }
  });
});
