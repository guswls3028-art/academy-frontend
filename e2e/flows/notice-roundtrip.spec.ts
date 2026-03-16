/**
 * 공지 왕복 플로우 E2E
 * 선생 공지 작성(API) → 학생 목록에서 확인 → 학생 상세 진입 → 정리
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TS = Date.now();
const TITLE = `[E2E] 공지 ${TS}`;
const CONTENT = `E2E 자동 공지 테스트 본문 (${TS})`;

test.describe.serial("공지 왕복: 선생→학생", () => {
  let browser: Browser;
  let adminPage: Page;
  let studentPage: Page;
  let postId: number | null = null;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 선생이 공지를 작성한다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    await adminPage.goto(`${BASE}/admin/community/notice`);
    await adminPage.waitForLoadState("networkidle");

    const resp = await apiCall(adminPage, "POST", "/community/posts/", {
      post_type: "notice", title: TITLE, content: CONTENT, node_ids: [],
    });
    expect(resp.status).toBe(201);
    postId = resp.body.id;
  });

  test("2. 학생 공지 목록에 반영된다", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
    await loginViaUI(studentPage, "student");

    await studentPage.goto(`${BASE}/student/notices`);
    await studentPage.waitForLoadState("networkidle");

    const notice = studentPage.locator(`text=${TITLE}`).first();
    await expect(notice).toBeVisible({ timeout: 10000 });
  });

  test("3. 학생이 공지 상세에서 내용을 확인한다", async () => {
    await studentPage.locator(`text=${TITLE}`).first().click();
    await studentPage.waitForTimeout(1000);

    await expect(studentPage.locator("text=Not Found")).not.toBeVisible();
    await expect(studentPage.locator(`text=${CONTENT}`).first()).toBeVisible({ timeout: 5000 });
  });

  test.afterAll(async () => {
    if (postId && adminPage) {
      try { await apiCall(adminPage, "DELETE", `/community/posts/${postId}/`); } catch {}
    }
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
