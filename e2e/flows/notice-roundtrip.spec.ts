/**
 * 공지 왕복 플로우 E2E
 * 선생 공지 작성(API) → 학생 목록에서 확인 → 학생 상세 진입 → 정리
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

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

    await gotoAndSettle(adminPage, `${BASE}/admin/community/notice`, { timeout: 45_000 });

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
  });

  test.afterAll(async () => {
    if (postId && adminPage) {
      try {
        await apiCall(adminPage, "DELETE", `/community/posts/${postId}/`);
      } catch (error) {
        console.warn("[notice-roundtrip] cleanup skipped", error);
      }
    }
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
