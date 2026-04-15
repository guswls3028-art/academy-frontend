/**
 * TYPE: UI-DRIVEN
 *
 * Notice UI Create E2E
 * Admin creates notice via actual UI clicks -> student sees it in notices page.
 * Cleanup via apiCall.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();
const TITLE = `[E2E] UI 공지 ${TS}`;
const CONTENT = `E2E UI-driven 공지 본문 테스트입니다. (${TS})`;

test.describe.serial("공지 UI 작성: 선생 UI -> 학생 확인", () => {
  let browser: Browser;
  let adminPage: Page;
  let studentPage: Page;
  let createdPostId: number | null = null;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test("1. 선생이 공지 페이지에서 UI로 공지를 작성한다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    // Navigate to notice admin page with scope=all so the list and create button appear
    await adminPage.goto(`${BASE}/admin/community/notice?scope=all`);
    await adminPage.waitForLoadState("networkidle");

    // Click the "+ 추가" button to open the create pane
    const addBtn = adminPage.locator('button').filter({ hasText: "+ 추가" }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Verify the create pane header appeared
    await expect(adminPage.locator("text=새 공지 작성")).toBeVisible({ timeout: 5000 });

    // Fill title — the input has placeholder "공지 제목을 입력하세요"
    const titleInput = adminPage.locator('input[placeholder="공지 제목을 입력하세요"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(TITLE);

    // Fill content via TipTap ProseMirror editor
    // The NoticeCreatePane uses RichTextEditor which renders .ProseMirror contenteditable
    const editor = adminPage.locator('.ProseMirror[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    await adminPage.keyboard.type(CONTENT);

    // Click "등록" button (the submit button in cms-form__actions)
    // There are two buttons: "취소" (secondary) and "등록" (primary)
    // We target the primary intent button with text "등록"
    const submitBtn = adminPage.locator('.cms-form__actions button').filter({ hasText: "등록" }).first();
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // Verify success toast "공지가 등록되었습니다."
    const toast = adminPage.locator("text=공지가 등록되었습니다.");
    await expect(toast).toBeVisible({ timeout: 10000 });

    // Extract the post ID from the API for cleanup
    // After creation, the list should refresh. We search the list via API.
    await adminPage.waitForTimeout(1000);
    const listResp = await apiCall(adminPage, "GET", "/community/posts/?post_type=notice&page_size=50");
    const posts = listResp.body?.results || listResp.body || [];
    const target = posts.find((p: any) => p.title === TITLE);
    if (target) {
      createdPostId = target.id;
    }
  });

  test("2. 학생 공지 목록에서 작성된 공지가 보인다", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
    await loginViaUI(studentPage, "student");

    await studentPage.goto(`${BASE}/student/notices`);
    await studentPage.waitForLoadState("networkidle");

    // The notice title should appear in the list
    const notice = studentPage.locator(`text=${TITLE}`).first();
    await expect(notice).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    // Cleanup: delete the created post via API
    if (createdPostId && adminPage) {
      try {
        await apiCall(adminPage, "DELETE", `/community/posts/${createdPostId}/`);
      } catch {
        /* cleanup failure is not test failure */
      }
    }
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
