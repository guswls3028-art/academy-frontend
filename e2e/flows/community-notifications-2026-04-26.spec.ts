/**
 * 커뮤니티 in-app 알림 카운트 검증 (2026-04-26)
 * - 학생 상담 등록 → 관리자 헤더 종 카운터에 "답변 대기 상담" 노출
 * - 관리자 답변 → 학생 알림 페이지에 "상담 답변" 노출 + 클릭 시 상세 진입
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE = getBaseUrl("admin");
const TIMESTAMP = Date.now();
const C_TITLE = `[E2E-NOTIF] 상담 알림 ${TIMESTAMP}`;
const C_CONTENT = `상담 본문 ${TIMESTAMP}`;
const A_CONTENT = `상담 답변 ${TIMESTAMP}`;

test.describe.serial("커뮤니티 알림 — counsel pending/답변", () => {
  let browser: Browser;
  let studentPage: Page;
  let adminPage: Page;
  let postId: number | null = null;

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 학생이 상담 신청 → 관리자 헤더 알림 항목 '답변 대기 상담' 노출", async () => {
    const sCtx = await browser.newContext();
    studentPage = await sCtx.newPage();
    await loginViaUI(studentPage, "student");

    const resp = await apiCall(studentPage, "POST", "/community/posts/", {
      post_type: "counsel",
      title: C_TITLE,
      content: C_CONTENT,
      node_ids: [],
      category_label: "진로 상담",
    });
    expect(resp.status).toBe(201);
    postId = resp.body.id;

    const aCtx = await browser.newContext();
    adminPage = await aCtx.newPage();
    await loginViaUI(adminPage, "admin");

    // 헤더 종 클릭 → 드롭다운 노출. 알림 카운터는 60초~2분 폴링이라 추가 새로고침 시도.
    await adminPage.goto(`${BASE}/admin`);
    await adminPage.waitForLoadState("networkidle");

    // 최대 3회 재시도: 폴링 주기 우회를 위해 새로고침 + 종 클릭
    let found = false;
    for (let attempt = 0; attempt < 3 && !found; attempt++) {
      if (attempt > 0) {
        await adminPage.waitForTimeout(15_000);
        await adminPage.reload();
        await adminPage.waitForLoadState("networkidle");
      }
      const bell = adminPage.getByRole("button", { name: "알림" }).first();
      await bell.click();
      try {
        await expect(adminPage.locator("text=답변 대기 상담").first()).toBeVisible({ timeout: 10_000 });
        found = true;
      } catch {
        await adminPage.keyboard.press("Escape").catch(() => {});
      }
    }
    expect(found, "관리자 헤더 드롭다운에 '답변 대기 상담' 항목 노출").toBeTruthy();
  });

  test("2. 관리자 답변 등록", async () => {
    expect(postId).toBeTruthy();
    const replyResp = await apiCall(adminPage, "POST", `/community/posts/${postId}/replies/`, {
      content: A_CONTENT,
    });
    expect(replyResp.status).toBe(201);
  });

  test("3. 학생 알림 페이지 → '상담 답변' 섹션에 신규 카드 노출 + 상세 진입", async () => {
    await studentPage.goto(`${BASE}/student/notifications`);
    await studentPage.waitForLoadState("networkidle");
    await studentPage.waitForTimeout(1500);

    const counselSection = studentPage.locator("h3", { hasText: /상담 답변/ });
    await expect(counselSection).toBeVisible({ timeout: 15_000 });

    const counselCard = studentPage.locator(`text=${C_TITLE}`).first();
    await expect(counselCard).toBeVisible({ timeout: 10_000 });
    await counselCard.click();

    // 상담 상세 진입 후 답변 본문 확인
    await expect(studentPage.locator(`text=${A_CONTENT}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(studentPage.locator("text=/선생님 답변/")).toBeVisible({ timeout: 5_000 });
  });

  test.afterAll(async () => {
    if (postId && adminPage) {
      try { await apiCall(adminPage, "DELETE", `/community/posts/${postId}/`); } catch { /* cleanup */ }
    }
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
