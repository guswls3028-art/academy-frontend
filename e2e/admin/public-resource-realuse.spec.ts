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

test.describe.serial("[real-use] 공개 보고서 본문 읽기", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the exact isolated development release boundary.");
  test("two publishers → PDF/HWPX/Office/original upload → anonymous article reading/reload/download → cross-publisher edit/delete", async ({ browser, request }, testInfo) => {
    assertQaStudentParentRuntime();
    const boundary = releaseBoundaryFromEnv(process.env)!;
    installReleaseRequestGuard(request, boundary);
    const access = (await loginAdmin(request)).access;
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
        await page.getByTestId("login-submit").click();
        await expect(page).toHaveURL(/\/landing\/resources$/, { timeout: 45_000 });
        await acknowledgeInitialAccountPromptsIfVisible(page);
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
        await expect(previewDocument.getByTestId("matchup-pdf-page")).toHaveCount(3, { timeout: 60_000 });
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
          await page.getByRole("button", { name: "수정 내용 게시", exact: true }).click();
          await expect(page.getByText("다른 지정 게시자가 원본 첨부를 보존하며 수정했습니다.", { exact: true })).toBeVisible();
        }
        const visitor = await open(width);
        await visitor.goto(`${QA_BASE}/landing/resources/${post.id}`);
        await expect(visitor.getByRole("link", { name: "수정", exact: true })).toHaveCount(0);
        await visitor.reload(); await expect(visitor.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await expect(visitor.getByRole("button", { name: "PDF 미리보기", exact: true })).toHaveCount(0);
        const pdf = visitor.getByRole("region", { name: "공개 보고서.PDF 본문", exact: true });
        await pdf.scrollIntoViewIfNeeded();
        await expect(pdf.getByTestId("matchup-pdf-page")).toHaveCount(3, { timeout: 60_000 });
        for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
          const documentPage = pdf.getByTestId("matchup-pdf-page").nth(pageIndex);
          await documentPage.scrollIntoViewIfNeeded();
          await expect(documentPage).toHaveAttribute("data-render-status", "ready", { timeout: 60_000 });
          await expect(pdf).toContainText(`QA PUBLIC RESOURCE PAGE ${pageIndex + 1} OF 3`);
        }
        await pdf.getByRole("button", { name: "문서 확대", exact: true }).click();
        await expect(pdf.locator("output")).toHaveText("125%");
        await assertNoHorizontalOverflow(visitor);
        await pdf.getByRole("button", { name: "문서 축소", exact: true }).click();
        const hangul = visitor.getByRole("region", { name: "한글 자료.hwpx 본문", exact: true });
        await hangul.scrollIntoViewIfNeeded();
        await expect(hangul.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
        // PDF text layers may omit spaces while the original page remains correctly laid out.
        await expect.poll(async () => (await hangul.textContent())?.replace(/\s/g, "")).toContain("산화와환원");
        await expect(hangul).toContainText("85%");
        const equation = visitor.getByRole("region", { name: "한글 수식.hwp 본문", exact: true });
        await equation.scrollIntoViewIfNeeded();
        await expect(equation.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
        const spreadsheet = visitor.getByRole("region", { name: "분석표.xlsx 본문", exact: true });
        await spreadsheet.scrollIntoViewIfNeeded();
        await expect(spreadsheet.locator('[data-testid="matchup-pdf-page"][data-render-status="ready"]')).toHaveCount(1, { timeout: 60_000 });
        await expect(spreadsheet).toContainText("QA analysis");
        await visitor.getByText("원본 파일 · 5개", { exact: true }).click();
        for (const original of originals) {
          const row = visitor.getByText(original.name, { exact: true }).first().locator("..").locator("..");
          const downloading = visitor.waitForEvent("download");
          await row.getByRole("button", { name: "원본 다운로드", exact: true }).click();
          const download = await downloading; expect(await download.failure()).toBeNull();
          expect(download.suggestedFilename()).toBe(original.name);
          expect(await readFile((await download.path())!)).toEqual(original.buffer);
        }
        if (index) {
          await visitor.goto(`${QA_BASE}/landing/resources/${posts[0].id}`);
          await visitor.reload();
          await expect(visitor.getByText("다른 지정 게시자가 원본 첨부를 보존하며 수정했습니다.", { exact: true })).toBeVisible();
          await expect(visitor.getByRole("link", { name: "수정", exact: true })).toHaveCount(0);
          await visitor.getByText("원본 파일 · 5개", { exact: true }).click();
          for (const original of originals) await expect(visitor.getByText(original.name, { exact: true }).first()).toBeVisible();
          const original = originals[0];
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
        await guard.beginClose(); await context.close();
        expect.soft(() => guard.assertClean()).not.toThrow();
        expect.soft(() => strict.assertZeroDefects()).not.toThrow();
      }
      // Soft-deleted original objects are preserved by product policy. The owning
      // scenario cleanup purges only this disposable tenant and proves R2/user zero.
    }
  });
});
