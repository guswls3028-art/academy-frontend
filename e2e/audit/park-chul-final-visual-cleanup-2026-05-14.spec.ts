// PATH: e2e/audit/park-chul-final-visual-cleanup-2026-05-14.spec.ts
// 최종 — detail 페이지 CTA 버튼 시각 검증 + 박철T 환경 잔존 E2E 게시물 cleanup.
/* eslint-disable no-restricted-syntax */

import { test, expect, request as pwRequest } from "@playwright/test";

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

test.describe.configure({ mode: "serial" });

test("최종 — detail 페이지 CTA 버튼 + iframe 시각 (desktop 1280)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${TCHUL}/landing/matchup-board/11`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(6000);  // PDF 로드 대기 길게
  await page.screenshot({ path: "_artifacts/pc-final-1-detail-desktop.png", fullPage: true });

  // CTA 버튼 확인
  const newTabBtn = page.getByText(/새 탭에서 열기/);
  const downloadBtn = page.getByText(/다운로드/);
  const newTabVisible = await newTabBtn.isVisible({ timeout: 3000 }).catch(() => false);
  const downloadVisible = await downloadBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log("CTA visible — 새 탭:", newTabVisible, "다운로드:", downloadVisible);
  expect(newTabVisible).toBe(true);
  expect(downloadVisible).toBe(true);

  // 새 탭 a href 검증 — pdf URL
  const newTabHref = await page.locator('a', { hasText: "새 탭에서 열기" }).first().getAttribute("href");
  console.log("새 탭 href:", newTabHref);
  expect(newTabHref).toContain("pdf");
  expect(newTabHref).toContain("tenant=tchul");

  await ctx.close();
});

test("최종 — detail 페이지 mobile (375px) viewport", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${TCHUL}/landing/matchup-board/11`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "_artifacts/pc-final-2-detail-mobile.png", fullPage: true });
  await ctx.close();
});

test("최종 — 새 탭 navigate (PDF stream 직접 진입)", async ({ browser }) => {
  // Playwright headless 는 PDF inline 을 download 처리 — production native browser 는 PDF viewer 사용.
  // 여기서는 HEAD 만 호출해서 Content-Disposition inline 검증.
  const ctx = await browser.newContext();
  const headResp = await ctx.request.fetch(`${API_BASE}/api/v1/landing-public/matchup-showcase/11/pdf/?tenant=tchul`, { method: "GET" });
  const cd = headResp.headers()["content-disposition"] || "";
  const ct = headResp.headers()["content-type"] || "";
  console.log("HEAD content-disposition:", cd, "content-type:", ct);
  expect(headResp.status()).toBe(200);
  expect(ct).toContain("pdf");
  // inline 이어야 mobile native PDF viewer 가 정상 렌더 (download attachment 면 학생 카톡에서 다운로드만 됨)
  expect(cd).toContain("inline");
  await ctx.close();
});

test("최종 — 박철T 환경 잔존 E2E 게시물 cleanup", async () => {
  const tokenResp = await pwRequest.newContext().then((ctx) => ctx.post(`${API_BASE}/api/v1/token/`, {
    data: {
      username: process.env.TCHUL_ADMIN_USER || "01035023313",
      password: process.env.TCHUL_ADMIN_PASS || "727258",
      tenant_code: "tchul",
    },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
  }));
  const access = (await tokenResp.json()).access;
  expect(access).toBeTruthy();

  const apiCtx = await pwRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "tchul" },
  });

  // staff list — 모든 status 포함
  const listResp = await apiCtx.get(`${API_BASE}/api/v1/landing-public/matchup-showcase/`);
  const data = await listResp.json();
  const e2eRows = (data.results || []).filter((r: { title: string }) => r.title.startsWith("[E2E"));
  console.log(`E2E rows to cleanup: ${e2eRows.length}`);

  for (const row of e2eRows) {
    const delResp = await apiCtx.delete(`${API_BASE}/api/v1/landing-public/matchup-showcase/${row.id}/`);
    console.log(`  destroyed #${row.id} status=${delResp.status()} title=${row.title.slice(0, 60)}`);
    expect([200, 204]).toContain(delResp.status());
  }

  await apiCtx.dispose();
});
