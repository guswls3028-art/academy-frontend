/**
 * 상담 신청 왕복 플로우 E2E (2026-04-26)
 *
 * 학생 상담 등록(API) → 관리자 inbox 표시 + 학생 컨텍스트 패널 + 답변하기 CTA →
 * 관리자 답변(API) → 학생 상세에서 답변 확인
 * Tenant 1 (hakwonplus)
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TIMESTAMP = Date.now();
const C_TITLE = `[E2E] 상담 신청 ${TIMESTAMP}`;
const C_CONTENT = `E2E 상담 본문 (${TIMESTAMP})`;
const A_CONTENT = `E2E 상담 답변 (${TIMESTAMP})`;

type CounselPost = { id?: number; title?: string; post_type?: string };

function e2eAdminCredentials(): { username: string; password: string; tenant: string } {
  const username = process.env.E2E_ADMIN_USER;
  const password = process.env.E2E_ADMIN_PASS;
  if (!username || !password) throw new Error("Missing E2E admin credentials for counsel cleanup");
  return { username, password, tenant: "hakwonplus" };
}

async function cleanupCounselPosts(page: Page, explicitIds: number[]): Promise<void> {
  const { username, password, tenant } = e2eAdminCredentials();
  const tokenResp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username, password, tenant_code: tenant },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": tenant },
    timeout: 60_000,
  });
  if (!tokenResp.ok()) return;

  const { access } = await tokenResp.json() as { access: string };
  const headers = { Authorization: `Bearer ${access}`, "X-Tenant-Code": tenant };
  const ids = new Set(explicitIds);

  const listResp = await page.request.get(
    `${API_BASE}/api/v1/community/posts/?post_type=counsel&page_size=500&q=${encodeURIComponent(C_TITLE)}`,
    { headers },
  );
  if (listResp.ok()) {
    const body = await listResp.json() as CounselPost[] | { results?: CounselPost[]; items?: CounselPost[] };
    const rows = Array.isArray(body) ? body : (body.results || body.items || []);
    for (const post of rows) {
      if (typeof post.id === "number" && post.title === C_TITLE && post.post_type === "counsel") {
        ids.add(post.id);
      }
    }
  }

  for (const id of ids) {
    await page.request.delete(`${API_BASE}/api/v1/community/posts/${id}/`, { headers }).catch(() => undefined);
  }
}

test.describe.serial("상담 왕복: 학생→관리자→학생", () => {
  let browser: Browser;
  let studentPage: Page;
  let adminPage: Page;
  let postId: number | null = null;
  const createdPostIds: number[] = [];

  test.beforeAll(async ({ browser: b }) => { browser = b; });

  test("1. 학생이 상담을 신청한다 (API)", async () => {
    const ctx = await browser.newContext();
    studentPage = await ctx.newPage();
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
    createdPostIds.push(postId);
  });

  test("2. 관리자 상담 인박스에 학생 신청이 보인다", async () => {
    const ctx = await browser.newContext();
    adminPage = await ctx.newPage();
    await loginViaUI(adminPage, "admin");

    await gotoAndSettle(adminPage, `${BASE}/admin/community/counsel`, { timeout: 20_000 });

    const card = adminPage.locator(`text=${C_TITLE}`).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
  });

  test("3. 카드 클릭 → 답변하기 CTA + 학생 컨텍스트 패널 노출", async () => {
    const card = adminPage.locator(`text=${C_TITLE}`).first();
    await card.click();
    await adminPage.waitForLoadState("networkidle");

    // 답변하기 CTA (replies_count = 0이므로 노출)
    await expect(adminPage.getByRole("button", { name: /답변하기/ })).toBeVisible();

    // 학생 컨텍스트 패널 + 카테고리/연락처 표시
    const studentPanel = adminPage.locator(".qna-inbox__student-panel").first();
    await expect(studentPanel.locator(".qna-inbox__student-panel-label")).toBeVisible();
    await expect(studentPanel.locator(".qna-inbox__student-detail")).toContainText("진로 상담");
    await expect(studentPanel.locator(".counsel-student-contact-link").first()).toBeVisible();
  });

  test("4. 관리자가 답변을 등록한다 (API)", async () => {
    expect(postId).toBeTruthy();
    const replyResp = await apiCall(adminPage, "POST", `/community/posts/${postId}/replies/`, {
      content: A_CONTENT,
    });
    expect(replyResp.status).toBe(201);
  });

  test("5. 학생이 상담 상세에서 답변을 확인한다", async () => {
    await gotoAndSettle(studentPage, `${BASE}/student/community`, { timeout: 20_000 });

    // 상담 탭 클릭
    const counselTab = studentPage.locator("button").filter({ hasText: /^상담$/ }).first();
    await counselTab.waitFor({ state: "visible", timeout: 10000 });
    await counselTab.click();

    const myCounsel = studentPage.locator(`text=${C_TITLE}`).first();
    await expect(myCounsel).toBeVisible({ timeout: 15000 });
    await myCounsel.click();

    // "선생님 답변" 라벨 통일 검증
    await expect(studentPage.locator("text=/선생님 답변/")).toBeVisible({ timeout: 10000 });

    // 답변 본문 확인
    await expect(studentPage.locator(`text=${A_CONTENT}`).first()).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    let cleanupContext: Awaited<ReturnType<Browser["newContext"]>> | null = null;
    const cleanupPage = adminPage || studentPage || await (async () => {
      cleanupContext = await browser.newContext();
      return cleanupContext.newPage();
    })();

    if (cleanupPage) {
      try { await cleanupCounselPosts(cleanupPage, createdPostIds); } catch { /* cleanup */ }
    }
    await cleanupContext?.close();
    await studentPage?.context()?.close();
    await adminPage?.context()?.close();
  });
});
