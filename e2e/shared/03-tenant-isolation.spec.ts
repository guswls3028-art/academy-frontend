/**
 * Tenant Isolation E2E Tests
 *
 * CRITICAL: These tests verify the absolute tenant isolation boundary.
 * Cross-tenant data leakage is a security violation (CLAUDE.md §B).
 *
 * Uses separate browser contexts for each tenant to simulate
 * fully independent sessions with different auth tokens.
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE_T1 = getBaseUrl("admin");
const BASE_T2 = getBaseUrl("tchul-admin");

test.describe("테넌트 격리 검증", () => {

  test("a) Tenant 1과 Tenant 2의 학생 목록에 공통 ID가 없다", async ({ browser }) => {
    // --- Tenant 1: fetch all student IDs ---
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await loginViaUI(page1, "admin");

    // Navigate so API calls work in correct origin
    await page1.goto(`${BASE_T1}/admin/dashboard`);
    await page1.waitForLoadState("networkidle");

    const resp1 = await apiCall(page1, "GET", "/students/?page_size=200");
    expect(resp1.status).toBe(200);
    const students1 = resp1.body?.results || resp1.body || [];
    const ids1 = new Set(students1.map((s: any) => s.id));

    // Must have at least 1 student to make the test meaningful
    expect(ids1.size).toBeGreaterThan(0);

    await ctx1.close();

    // --- Tenant 2: fetch all student IDs ---
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await loginViaUI(page2, "tchul-admin");

    await page2.goto(`${BASE_T2}/admin/dashboard`);
    await page2.waitForLoadState("networkidle");

    const resp2 = await apiCall(page2, "GET", "/students/?page_size=200");
    expect(resp2.status).toBe(200);
    const students2 = resp2.body?.results || resp2.body || [];
    const ids2 = new Set(students2.map((s: any) => s.id));

    expect(ids2.size).toBeGreaterThan(0);

    await ctx2.close();

    // --- ISOLATION CHECK: zero overlap ---
    const overlap: number[] = [];
    for (const id of ids1) {
      if (ids2.has(id)) overlap.push(id);
    }
    expect(
      overlap,
      `TENANT ISOLATION VIOLATION: ${overlap.length} shared student IDs: [${overlap.join(", ")}]`,
    ).toHaveLength(0);
  });

  test("b) Tenant 1 관리자가 Tenant 2 학생 ID에 직접 접근하면 404 또는 403을 받는다", async ({ browser }) => {
    // --- Tenant 2: get a student ID ---
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await loginViaUI(page2, "tchul-admin");

    await page2.goto(`${BASE_T2}/admin/dashboard`);
    await page2.waitForLoadState("networkidle");

    const resp2 = await apiCall(page2, "GET", "/students/?page_size=10");
    expect(resp2.status).toBe(200);
    const students2 = resp2.body?.results || resp2.body || [];
    expect(students2.length).toBeGreaterThan(0);
    const tenant2StudentId = students2[0].id;

    await ctx2.close();

    // --- Tenant 1: try to access that student directly ---
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await loginViaUI(page1, "admin");

    await page1.goto(`${BASE_T1}/admin/dashboard`);
    await page1.waitForLoadState("networkidle");

    const crossResp = await apiCall(page1, "GET", `/students/${tenant2StudentId}/`);

    // Must be 404 or 403 — NOT 200
    expect(
      [403, 404],
      `TENANT ISOLATION VIOLATION: T1 admin got status ${crossResp.status} for T2 student ${tenant2StudentId}`,
    ).toContain(crossResp.status);

    await ctx1.close();
  });

  test("c) Tenant 1에서 생성한 게시물에 Tenant 2 관리자가 접근할 수 없다", async ({ browser }) => {
    const TIMESTAMP = Date.now();
    let createdPostId: number | null = null;

    // --- Tenant 1: create a post ---
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await loginViaUI(page1, "admin");

    await page1.goto(`${BASE_T1}/admin/dashboard`);
    await page1.waitForLoadState("networkidle");

    const createResp = await apiCall(page1, "POST", "/community/posts/", {
      title: `[E2E-ISO] Isolation Test ${TIMESTAMP}`,
      content: `Tenant isolation test — should not be visible cross-tenant (${TIMESTAMP})`,
      post_type: "notice",
    });
    expect(createResp.status).toBe(201);
    createdPostId = createResp.body?.id;
    expect(createdPostId).toBeTruthy();

    // --- Tenant 2: try to access T1's post ---
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await loginViaUI(page2, "tchul-admin");

    await page2.goto(`${BASE_T2}/admin/dashboard`);
    await page2.waitForLoadState("networkidle");

    const crossResp = await apiCall(page2, "GET", `/community/posts/${createdPostId}/`);

    // Must NOT be 200
    expect(
      crossResp.status,
      `TENANT ISOLATION VIOLATION: T2 admin accessed T1 post ${createdPostId} with status ${crossResp.status}`,
    ).not.toBe(200);
    expect([403, 404]).toContain(crossResp.status);

    await ctx2.close();

    // --- Cleanup: delete the T1 post ---
    try {
      if (createdPostId) {
        const delResp = await apiCall(page1, "DELETE", `/community/posts/${createdPostId}/`);
        // 204 or 200 = deleted, 404 = already gone — all fine
        expect([200, 204, 404]).toContain(delResp.status);
      }
    } catch {
      // Cleanup failure should not fail the test
    }

    await ctx1.close();
  });

  test("d) 각 테넌트 도메인의 페이지 타이틀이 서로의 브랜드를 포함하지 않는다", async ({ browser }) => {
    // --- tchul.com must show 박철과학 ---
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto("https://tchul.com");
    await page1.waitForLoadState("domcontentloaded");
    const tchulTitle = await page1.title();
    expect(tchulTitle).toContain("박철과학");
    await ctx1.close();

    // --- hakwonplus.com must NOT show 박철과학 ---
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto("https://hakwonplus.com");
    await page2.waitForLoadState("domcontentloaded");
    const hpTitle = await page2.title();
    expect(hpTitle).not.toContain("박철과학");
    await ctx2.close();

    // --- sswe.co.kr must show SSWE ---
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    await page3.goto("https://sswe.co.kr");
    await page3.waitForLoadState("domcontentloaded");
    const ssweTitle = await page3.title();
    expect(ssweTitle).toContain("SSWE");
    await ctx3.close();
  });
});
