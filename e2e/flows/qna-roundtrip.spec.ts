/**
 * QnA 왕복 플로우 E2E
 *
 * 학생 질문 등록(API) → 선생 확인 → 선생 답변(API) → 학생 답변 확인
 * Tenant 1 (hakwonplus) 검증용 테넌트
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TIMESTAMP = Date.now();
const Q_TITLE = `[E2E] QnA 테스트 질문 ${TIMESTAMP}`;
const Q_CONTENT = `E2E 자동 테스트 — 답변 확인용 (${TIMESTAMP})`;
const A_CONTENT = `E2E 답변입니다. 확인해주세요. (${TIMESTAMP})`;

test.describe.serial("QnA 왕복: 학생→선생→학생", () => {
  let browser: Browser;
  let studentPage: Page;
  let adminPage: Page;
  let postId: number | null = null;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test("1. 학생이 QnA 질문을 등록한다 (API)", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
    await loginViaUI(studentPage, "student");

    // API로 질문 등록 (UI 조작 없이 안정적)
    const resp = await apiCall(studentPage, "POST", "/community/posts/", {
      post_type: "qna", title: Q_TITLE, content: Q_CONTENT, node_ids: [],
    });
    expect(resp.status).toBe(201);
    postId = resp.body.id;
  });

  test("2. 선생 QnA 목록에 학생 질문이 보인다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    // QnA 페이지 이동
    await adminPage.goto(`${BASE}/admin/community/qna`);
    await adminPage.waitForLoadState("load");

    // 학생이 등록한 질문 찾기
    const question = adminPage.locator(`text=${Q_TITLE}`).first();
    await expect(question).toBeVisible({ timeout: 30_000 });
  });

  test("3. 선생이 답변을 등록한다 (API)", async () => {
    expect(postId).toBeTruthy();

    // API로 답변 등록
    const replyResp = await apiCall(adminPage, "POST", `/community/posts/${postId}/replies/`, {
      content: A_CONTENT,
    });
    expect(replyResp.status).toBe(201);
  });

  test("4. 학생이 질문 상세에서 답변을 확인한다", async () => {
    // 학생 커뮤니티 페이지로 이동
    await studentPage.goto(`${BASE}/student/community`);
    await studentPage.waitForLoadState("load");
    await studentPage.waitForTimeout(2000);

    // QnA 탭 클릭
    const qnaTab = studentPage.locator("button").filter({ hasText: "QnA" }).first();
    await qnaTab.waitFor({ state: "visible", timeout: 10000 });
    await qnaTab.click();
    await studentPage.waitForTimeout(2000);

    // 내 질문 찾기
    const myQuestion = studentPage.locator(`text=${Q_TITLE}`).first();
    await expect(myQuestion).toBeVisible({ timeout: 15000 });
    await myQuestion.click();
    await studentPage.waitForTimeout(3000);

    // 답변 내용 확인
    const answer = studentPage.locator(`text=${A_CONTENT}`).first();
    await expect(answer).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    // Cleanup: E2E 테스트 글 삭제
    if (postId && adminPage) {
      try { await apiCall(adminPage, "DELETE", `/community/posts/${postId}/`); } catch { /* cleanup failure is not test failure */ }
    }
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
