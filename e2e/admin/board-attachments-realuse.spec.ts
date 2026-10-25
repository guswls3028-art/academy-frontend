/** Photo actions use the exact release bundle and disposable development tenants. */
import { expect, test } from "../fixtures/strictTest";
import { api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, expectApi, installQaStudentParentBoundary,
  loginAdmin, loginApi, QA_BASE, QA_STUDENT_PASSWORD, seedBrowserAuth, STUDENT_PARENT_REALUSE_ENABLED } from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import type { Page } from "@playwright/test";

test.setTimeout(360_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
const photo = (name: string) => ({ name, mimeType: "image/png", buffer: png });
const isCreate = (path: string) => (response: { url(): string; request(): { method(): string } }) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/v1${path}`;

async function verifyImages(page: Page, count: number, selector: string) {
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    const images = page.locator(selector);
    await expect(images).toHaveCount(count);
    for (let i = 0; i < count; i += 1) {
      await expect(images.nth(i)).toBeVisible();
      await expect.poll(() => images.nth(i).evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
    await assertNoHorizontalOverflow(page);
  }
}

test.describe("[real-use] board attachment persistence", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the exact isolated development release boundary.");

  test("board/materials create and edit photos → desktop/390px reload → student access; mobile teacher upload", async ({ page, request }) => {
    assertQaStudentParentRuntime();
    const guard = await installQaStudentParentBoundary(page, request);
    const admin = await loginAdmin(request);
    const student = await loginApi(request, process.env.E2E_STUDENT_USER!, QA_STUDENT_PASSWORD);
    await seedBrowserAuth(page, admin);
    const owned: number[] = [];
    try {
      for (const kind of ["board", "materials"] as const) {
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto(`${QA_BASE}/workspace/community/${kind}`);
        await acknowledgeInitialAccountPromptsIfVisible(page);
        await page.getByRole("button", { name: kind === "board" ? "+ 글쓰기" : "+ 자료 등록", exact: true }).click();
        await page.getByPlaceholder(kind === "board" ? "게시물 제목을 입력하세요" : "자료 제목을 입력하세요").fill(`qa-${kind}-photo-${Date.now()}`);
        await page.locator(".ProseMirror").fill("사진 첨부 작성과 수정을 확인합니다.");
        await page.locator('.rich-editor input[accept="image/*"]').setInputFiles(photo(`qa-${kind}-first.png`));
        const created = page.waitForResponse(isCreate("/community/posts/"));
        await page.getByRole("button", { name: "등록", exact: true }).click();
        const response = await created;
        expect(response.status()).toBe(201);
        const id = Number((await response.json()).id); owned.push(id);
        await expect(page.getByText("첨부파일 (1/10)", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "수정", exact: true }).click();
        await page.locator('.rich-editor input[accept="image/*"]').setInputFiles(photo(`qa-${kind}-second.png`));
        await page.getByRole("button", { name: kind === "board" ? "내용 저장" : "저장", exact: true }).click();
        await expect(page.getByText("내용이 저장되었습니다.", { exact: true })).toBeVisible();
        await verifyImages(page, 2, ".notice-attach__image");
        const read = await expectApi<{ attachments: unknown[] }>(request, "GET", `/community/posts/${id}/`, student.access);
        expect(read.attachments).toHaveLength(2);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${QA_BASE}/workspace/mobile/comms`);
      await page.getByRole("button", { name: "공지사항 작성", exact: true }).click();
      const sheet = page.getByRole("dialog", { name: "공지사항 작성" });
      await sheet.getByPlaceholder("공지사항 제목").fill(`qa-mobile-photo-${Date.now()}`);
      await sheet.locator(".ProseMirror").fill("모바일 편집기 사진 저장 확인");
      await sheet.locator('.rich-editor input[accept="image/*"]').setInputFiles(photo("qa-mobile.png"));
      const created = page.waitForResponse(isCreate("/community/posts/"));
      await sheet.getByRole("button", { name: "공지사항 등록", exact: true }).click();
      const id = Number((await (await created).json()).id); owned.push(id);
      await expect(sheet).toBeHidden();
      await page.goto(`${QA_BASE}/workspace/mobile/comms?tab=notice&id=${id}`);
      await page.getByRole("button", { name: "게시글 작업 메뉴" }).click();
      await page.getByRole("button", { name: "편집", exact: true }).click();
      await page.locator('.rich-editor input[accept="image/*"]').setInputFiles(photo("qa-mobile-edit.png"));
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await expect(page.getByText("첨부파일 2개", { exact: true })).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText("첨부파일 2개", { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      const read = await expectApi<{ attachments: unknown[] }>(request, "GET", `/community/posts/${id}/`, student.access);
      expect(read.attachments).toHaveLength(2);
      await page.goto(`${QA_BASE}/workspace/community/notice?id=${id}`);
      await verifyImages(page, 2, ".notice-attach__image");
    } finally {
      for (const id of owned) expect((await api(request, "DELETE", `/community/posts/${id}/`, admin.access)).status).toBe(204);
      guard.assertClean();
    }
  });

  test("public board and review photos → author edit → desktop/390px reload → approved public read", async ({ page, request }) => {
    assertQaStudentParentRuntime();
    const guard = await installQaStudentParentBoundary(page, request);
    const admin = await loginAdmin(request);
    // Publish only this disposable tenant's generated landing configuration.
    await expectApi(request, "PUT", "/core/landing/admin/", admin.access, {});
    await expectApi(request, "POST", "/core/landing/publish/", admin.access, {});
    const student = await loginApi(request, process.env.E2E_STUDENT_USER!, QA_STUDENT_PASSWORD);
    await seedBrowserAuth(page, student);
    const owned: Array<{ kind: string; id: number }> = [];
    try {
      await page.goto(`${QA_BASE}/landing/board/write`);
      await page.getByTestId("board-write-title").fill(`qa-public-photo-${Date.now()}`);
      await page.locator(".ProseMirror").fill("공개 게시판 사진 저장 확인");
      await page.locator('.rich-editor input[accept="image/*"]').setInputFiles(photo("qa-public.png"));
      const created = page.waitForResponse(isCreate("/landing-public/board/"));
      await page.getByTestId("board-write-submit").click();
      const result = await created; expect(result.status()).toBe(201);
      const id = Number((await result.json()).id); owned.push({ kind: "board", id });
      await expect(page).toHaveURL(`${QA_BASE}/landing/board/${id}`);
      await verifyImages(page, 1, ".public-photos__gallery img");
      await page.goto(`${QA_BASE}/landing/board/${id}/edit`);
      await page.getByTestId("board-edit-title").fill("qa-public-photo 수정 확인");
      await page.getByTestId("board-edit-submit").click();
      await expect(page).toHaveURL(`${QA_BASE}/landing/board/${id}`);
      await verifyImages(page, 1, ".public-photos__gallery img");
      expect((await api(request, "GET", `/landing-public/board/${id}/`, "")).status).toBe(200);

      await page.goto(`${QA_BASE}/landing/reviews/write`);
      await page.getByTestId("review-write-content").fill("격리 개발환경에서 수강후기 사진 저장과 조회를 검증합니다.");
      await page.getByLabel("사진 첨부", { exact: true }).setInputFiles(photo("qa-review.png"));
      const reviewCreated = page.waitForResponse(isCreate("/landing-public/reviews/"));
      await page.getByTestId("review-write-submit").click();
      const reviewResult = await reviewCreated; expect(reviewResult.status()).toBe(201);
      const reviewId = Number((await reviewResult.json()).id); owned.push({ kind: "reviews", id: reviewId });
      await expect(page).toHaveURL(`${QA_BASE}/landing/reviews/${reviewId}`);
      await verifyImages(page, 1, ".public-photos__gallery img");
      expect((await api(request, "GET", `/landing-public/reviews/${reviewId}/`, "")).status).toBe(404);
      await expectApi(request, "POST", `/landing-public/reviews/${reviewId}/moderate/`, admin.access, { status: "approved" });
      const approved = await expectApi<{ photos: string[] }>(request, "GET", `/landing-public/reviews/${reviewId}/`, "");
      expect(approved.photos).toHaveLength(1);
    } finally {
      for (const { kind, id } of owned) expect((await api(request, "DELETE", `/landing-public/${kind}/${id}/`, admin.access)).status).toBe(204);
      guard.assertClean();
    }
  });
});
