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

test.setTimeout(360_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
type Post = { id: number; title: string; files: Array<{ id: string; filename: string }> };

test.describe.serial("[real-use] 공개 자료 원본 공유", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the exact isolated development release boundary.");
  test("two publishers → PDF/HWPX/Office/original upload → anonymous download/reload → cross-publisher edit/delete", async ({ browser, request }, testInfo) => {
    assertQaStudentParentRuntime();
    const boundary = releaseBoundaryFromEnv(process.env)!;
    installReleaseRequestGuard(request, boundary);
    const access = (await loginAdmin(request)).access;
    const document = await PDFDocument.create(); const pdfPage = document.addPage([595, 842]);
    pdfPage.drawText("QA PUBLIC RESOURCE", { x: 40, y: 750, font: await document.embedFont(StandardFonts.Helvetica) });
    const hwpx = new JSZip(); hwpx.file("mimetype", "application/hwp+zip");
    hwpx.file("Contents/content.hpf", "<package/>"); hwpx.file("Contents/header.xml", "<head/>"); hwpx.file("Contents/section0.xml", "<sec/>");
    const workbook = new ExcelJS.Workbook(); workbook.addWorksheet("QA").addRow(["QA analysis", 90]);
    const archive = new JSZip(); archive.file("analysis.txt", "QA original analysis");
    const originals = [
      { name: "공개 보고서.PDF", mimeType: "application/pdf", buffer: Buffer.from(await document.save()) },
      { name: "한글 자료.hwpx", mimeType: "application/octet-stream", buffer: await hwpx.generateAsync({ type: "nodebuffer" }) },
      { name: "분석표.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) },
      { name: "묶음 자료.zip", mimeType: "application/octet-stream", buffer: await archive.generateAsync({ type: "nodebuffer" }) },
      { name: "README", mimeType: "text/plain", buffer: Buffer.from("QA extensionless original") },
    ];
    const posts: Post[] = [];
    const contexts: Array<{ context: Awaited<ReturnType<typeof browser.newContext>>; guard: Awaited<ReturnType<typeof installReleaseContextGuard>>; strict: ReturnType<typeof attachStrictBrowserGuards> }> = [];
    async function open(width: number) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const guard = await installReleaseContextGuard(context, boundary);
      await context.addInitScript((tenant) => { localStorage.setItem("tenant_code", tenant); sessionStorage.setItem("tenantCode", tenant); }, QA_TENANT);
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
        await page.getByTestId("login-submit").click();
        await expect(page).toHaveURL(/\/landing\/resources$/, { timeout: 45_000 });
        await acknowledgeInitialAccountPromptsIfVisible(page);
        await page.goto(`${QA_BASE}/landing/resources`);
        await page.getByRole("link", { name: "자료 올리기", exact: true }).click();
        await page.getByLabel("분류", { exact: true }).selectOption(index ? "analysis" : "matchup");
        const title = `QA 자료 공유 ${width}`;
        await page.getByLabel("제목", { exact: true }).fill(title);
        await page.getByLabel("설명", { exact: true }).fill("로그인 없이 원본을 내려받는 합성 자료입니다.");
        await page.getByLabel("첨부 자료", { exact: true }).setInputFiles(originals);
        await expect(page.getByText("README", { exact: true })).toBeVisible({ timeout: 90_000 });
        const published = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/landing-public/resources/");
        await page.getByRole("button", { name: "게시하기", exact: true }).click();
        const response = await published; expect(response.status()).toBe(201);
        const post = await response.json() as Post; posts.push(post);
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await page.reload(); await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        if (index) {
          await page.goto(`${QA_BASE}/landing/resources/${posts[0].id}`);
          await page.getByRole("link", { name: "수정", exact: true }).click();
          await page.getByLabel("설명", { exact: true }).fill("다른 지정 게시자가 원본 첨부를 보존하며 수정했습니다.");
          await page.getByRole("button", { name: "수정 내용 게시", exact: true }).click();
          await expect(page.getByText("다른 지정 게시자가 원본 첨부를 보존하며 수정했습니다.", { exact: true })).toBeVisible();
        }
        const visitor = await open(width);
        await visitor.goto(`${QA_BASE}/landing/resources/${post.id}`);
        await expect(visitor.getByRole("link", { name: "수정", exact: true })).toHaveCount(0);
        await visitor.reload(); await expect(visitor.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await visitor.getByRole("button", { name: "PDF 미리보기", exact: true }).click();
        await expect(visitor.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
        for (const original of originals) {
          const row = visitor.getByText(original.name, { exact: true }).first().locator("..").locator("..");
          const downloading = visitor.waitForEvent("download");
          await row.getByRole("button", { name: "원본 다운로드", exact: true }).click();
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
        await guard.beginClose(); await context.close(); guard.assertClean(); strict.assertClean();
      }
      // Soft-deleted original objects are preserved by product policy. The owning
      // scenario cleanup purges only this disposable tenant and proves R2/user zero.
    }
  });
});
