/**
 * TYPE: UI-DRIVEN
 *
 * QnA UI Reply E2E
 * Student creates question (via API to ensure data exists) ->
 * Admin replies via actual QnA inbox UI clicks ->
 * Student sees the answer.
 * Cleanup via apiCall.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();
const Q_TITLE = `[E2E] UI QnA 질문 ${TS}`;
const Q_CONTENT = `E2E 자동 테스트 질문 — 관리자 UI 답변 확인용 (${TS})`;
const A_CONTENT = `[E2E] UI 답변입니다. 확인 부탁드립니다. (${TS})`;

test.describe.serial("QnA UI 답변: 학생질문 -> 선생 UI 답변 -> 학생 확인", () => {
  let browser: Browser;
  let adminPage: Page;
  let studentPage: Page;
  let questionId: number | null = null;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test("1. 학생이 질문을 등록한다 (API-assisted setup)", async () => {
    // Login as student first to get auth token for API call
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
    await loginViaUI(studentPage, "student");

    // Create the question via API to guarantee reliable data setup
    const resp = await apiCall(studentPage, "POST", "/community/posts/", {
      post_type: "qna",
      title: Q_TITLE,
      content: Q_CONTENT,
      node_ids: [],
    });
    expect(resp.status).toBe(201);
    questionId = resp.body.id;
  });

  test("2. 선생이 QnA 목록에서 질문을 찾고 UI로 답변한다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    // Navigate to QnA inbox — scope=all to show all questions
    await adminPage.goto(`${BASE}/admin/community/qna?scope=all`);
    await adminPage.waitForLoadState("networkidle");

    // Find the E2E question in the list (it appears as a qna-inbox__card)
    const questionCard = adminPage.locator(`.qna-inbox__card`).filter({ hasText: Q_TITLE }).first();
    await expect(questionCard).toBeVisible({ timeout: 15000 });

    // Click the question card to open the thread view
    await questionCard.click();

    // Verify the thread opened — the title should appear in the thread header
    await expect(adminPage.locator('.qna-inbox__thread-title').filter({ hasText: Q_TITLE })).toBeVisible({ timeout: 5000 });

    // Fill the reply in the composer textarea
    const replyTextarea = adminPage.locator('.qna-inbox__composer textarea');
    await expect(replyTextarea).toBeVisible({ timeout: 5000 });
    await replyTextarea.fill(A_CONTENT);

    // Click "답변 등록" button
    const sendBtn = adminPage.locator('button').filter({ hasText: "답변 등록" }).first();
    await expect(sendBtn).toBeEnabled({ timeout: 3000 });
    await sendBtn.click();

    // Verify success toast containing "답변이 등록되었습니다"
    const toast = adminPage.locator("text=답변이 등록되었습니다");
    await expect(toast).toBeVisible({ timeout: 10000 });
  });

  test("3. 학생이 질문 상세에서 답변을 확인한다", async () => {
    // Navigate student to community page, QnA tab
    await studentPage.goto(`${BASE}/student/community`);
    await studentPage.waitForLoadState("networkidle");

    // Click QnA tab
    const qnaTab = studentPage.locator("button").filter({ hasText: "QnA" }).first();
    if (await qnaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qnaTab.click();
      await studentPage.waitForTimeout(500);
    }

    // Find the question in the list
    const myQuestion = studentPage.locator(`text=${Q_TITLE}`).first();
    await expect(myQuestion).toBeVisible({ timeout: 10000 });
    await myQuestion.click();
    await studentPage.waitForTimeout(1500);

    // Verify the answer content is visible in the detail view
    const answer = studentPage.locator(`text=${A_CONTENT}`).first();
    await expect(answer).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    // Cleanup: delete the question via API (this also removes replies)
    if (questionId && adminPage) {
      try {
        await apiCall(adminPage, "DELETE", `/community/posts/${questionId}/`);
      } catch {
        /* cleanup failure is not test failure */
      }
    }
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
