/**
 * 테넌트 격리 검증 E2E
 * T1(hakwonplus) vs T2(tchul) 데이터 완전 격리 확인
 */
import { test, expect } from "../fixtures/strictTest";
import type { Browser } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { apiCall } from "../helpers/api";

const BASE_T1 = getBaseUrl("admin");
const BASE_T2 = getBaseUrl("tchul-admin");

test.describe("테넌트 격리 검증", () => {

  test("a) Tenant 1과 Tenant 2의 학생 ID가 겹치지 않는다", async ({ browser }) => {
    // T1
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();
    await loginViaUI(p1, "admin");
    const r1 = await apiCall(p1, "GET", "/students/?page_size=200");
    expect(r1.status).toBe(200);
    const ids1 = new Set((r1.body?.results || []).map((s: any) => s.id));
    expect(ids1.size).toBeGreaterThan(0);
    await ctx1.close();

    // T2
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await loginViaUI(p2, "tchul-admin");
    const r2 = await apiCall(p2, "GET", "/students/?page_size=200");
    expect(r2.status).toBe(200);
    const ids2 = new Set((r2.body?.results || []).map((s: any) => s.id));
    expect(ids2.size).toBeGreaterThan(0);
    await ctx2.close();

    // 교집합 = 0
    const overlap = [...ids1].filter((id) => ids2.has(id));
    expect(overlap).toEqual([]);
  });

  test("b) T1 관리자가 T2 학생 ID에 직접 접근하면 404/403", async ({ browser }) => {
    // T2 학생 ID 가져오기
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await loginViaUI(p2, "tchul-admin");
    const r2 = await apiCall(p2, "GET", "/students/?page_size=1");
    const t2sid = r2.body?.results?.[0]?.id;
    expect(t2sid).toBeTruthy();
    await ctx2.close();

    // T1 관리자로 T2 학생 접근 시도
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();
    await loginViaUI(p1, "admin");
    const r1 = await apiCall(p1, "GET", `/students/${t2sid}/`);
    // 404 or 403 — 절대 200이면 안 됨
    expect([403, 404]).toContain(r1.status);
    await ctx1.close();
  });

  test("c) T1 게시물에 T2 관리자가 접근 불가", async ({ browser }) => {
    // T1에서 게시물 생성
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();
    await loginViaUI(p1, "admin");
    const createResp = await apiCall(p1, "POST", "/community/posts/", {
      post_type: "notice", title: "[E2E] 격리테스트", content: "격리검증용", node_ids: [],
    });
    expect(createResp.status).toBe(201);
    const postId = createResp.body.id;

    // T2에서 접근 시도
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    await loginViaUI(p2, "tchul-admin");
    const accessResp = await apiCall(p2, "GET", `/community/posts/${postId}/`);
    expect([403, 404]).toContain(accessResp.status);
    await ctx2.close();

    // 정리
    await apiCall(p1, "DELETE", `/community/posts/${postId}/`);
    await ctx1.close();
  });

  test("d) 테넌트별 페이지 타이틀이 올바르다", async ({ page }) => {
    await page.goto("https://tchul.com");
    await page.waitForLoadState("domcontentloaded");
    expect(await page.title()).toContain("박철과학");

    await page.goto("https://hakwonplus.com");
    await page.waitForLoadState("domcontentloaded");
    const hpTitle = await page.title();
    expect(hpTitle).not.toContain("박철과학");

    await page.goto("https://sswe.co.kr");
    await page.waitForLoadState("domcontentloaded");
    expect(await page.title()).toContain("SSWE");
  });
});
