/**
 * 공지 왕복 플로우 E2E
 * 선생 공지 작성·수정·사진 첨부(UI) → 학생 조회·새로고침 → 정리
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import { productionWriteOptInSkipReason } from "../helpers/safety";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

const BASE = getBaseUrl("admin");
const PRODUCTION_WRITE_BLOCK = productionWriteOptInSkipReason(getApiBaseUrl());
const TS = Date.now();
const TITLE = `[E2E] 공지 ${TS}`;
const CONTENT = `E2E 자동 공지 테스트 본문 (${TS})`;
const IMAGE_NAME = `qa-notice-correction-${TS}.png`;

test.describe.serial("공지 왕복: 선생→학생", () => {
  test.skip(Boolean(PRODUCTION_WRITE_BLOCK), PRODUCTION_WRITE_BLOCK ?? "");

  let browser: Browser;
  let adminPage: Page;
  let studentPage: Page;
  let postId: number | null = null;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 선생이 공지를 작성한다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    await gotoAndSettle(adminPage, `${BASE}/workspace/community/notice`, { timeout: 45_000 });

    await adminPage.getByRole("button", { name: "+ 추가", exact: true }).click();
    await adminPage.getByPlaceholder("공지 제목을 입력하세요").fill(TITLE);
    await adminPage.locator(".ProseMirror").fill(CONTENT);
    const created = adminPage.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/community/posts/");
    await adminPage.getByRole("button", { name: "등록", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    postId = (await response.json()).id;
    await expect(adminPage.getByText("공지가 등록되었습니다.")).toBeVisible();
    await adminPage.locator(".cms-list-card").filter({ hasText: TITLE }).click();
    await adminPage.getByRole("button", { name: "수정", exact: true }).click();
    await adminPage.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: IMAGE_NAME, mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
    await expect(adminPage.getByAltText(`${IMAGE_NAME} 미리보기`)).toBeVisible();
    await adminPage.getByRole("button", { name: "저장", exact: true }).click();
    await expect(adminPage.getByText("내용이 저장되었습니다.")).toBeVisible();
    for (const width of [1366, 390]) {
      await adminPage.setViewportSize({ width, height: 900 });
      await adminPage.reload();
      const image = adminPage.getByRole("region", { name: "첨부파일", exact: true }).getByAltText(IMAGE_NAME);
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      expect(await adminPage.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    const persisted = await apiCall(adminPage, "GET", `/community/posts/${postId}/`);
    expect(persisted.status).toBe(200);
    expect(persisted.body.attachments).toHaveLength(1);
    expect(persisted.body.attachments[0].original_name).toBe(IMAGE_NAME);
  });

  test("2. 학생 공지 목록에 반영된다", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
    await loginViaUI(studentPage, "student");

    const notice = studentPage.locator(`text=${TITLE}`).first();
    await waitForCondition(
      async () => {
        await gotoAndSettle(studentPage, `${BASE}/student/notices`, { timeout: 45_000 });
        return notice.isVisible().catch(() => false);
      },
      { timeoutMs: 60_000, intervalMs: 3000, description: "student notice list reflects created notice" },
    );
    await expect(notice).toBeVisible({ timeout: 5_000 });
  });

  test("3. 학생이 공지 상세에서 내용을 확인한다", async () => {
    await studentPage.locator(`text=${TITLE}`).first().click();
    await studentPage.waitForLoadState("load");

    await expect(studentPage.locator("text=Not Found")).not.toBeVisible();
    const content = studentPage.locator(`text=${CONTENT}`).first();
    await expect(content).toBeVisible({ timeout: 8000 });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    await studentPage.reload();
    const image = studentPage.getByAltText(IMAGE_NAME, { exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test.afterAll(async () => {
    try {
      if (postId && adminPage) {
        const cleanupResp = await apiCall(adminPage, "DELETE", `/community/posts/${postId}/`);
        expect(
          [200, 204],
          `공지 E2E cleanup failed for post ${postId}: HTTP ${cleanupResp.status}`,
        ).toContain(cleanupResp.status);
      }
    } finally {
      await studentPage?.context()?.close();
      await adminPage?.context()?.close();
    }
  });
});
