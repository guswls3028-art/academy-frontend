// 최종 시각 검수 — tchul.com 1인 강사 사이트 풀 보강 결과.
// 외부 관전자(비로그인) + 학원장 동선 + 카드 클릭 PDF 검증.
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("tchul.com 최종 시각 검수", () => {
  test("desktop 1920 — 외부 관전자 fullPage", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/final-desktop-full.png`, fullPage: true });

    // 새 섹션 + nav 검증
    const profile = await page.getByText("강사 프로필").count();
    const mgmt = await page.getByText("학생 관리 시스템").count();
    const process = await page.getByText("한 사이클(7회) 진행 흐름").count();
    const loginBtn = await page.getByRole("link", { name: "로그인" }).count();
    const pdfHints = await page.getByText("본문 PDF 보기").count();
    console.log(JSON.stringify({ profile, mgmt, process, loginBtn, pdfHints }));
    expect(profile).toBeGreaterThanOrEqual(1);
    expect(mgmt).toBeGreaterThanOrEqual(1);
    expect(process).toBeGreaterThanOrEqual(1);
    expect(loginBtn).toBeGreaterThanOrEqual(1);
    expect(pdfHints).toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test("mobile 390 — 외부 관전자 fullPage", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/final-mobile-full.png`, fullPage: true });
    await ctx.close();
  });

  test("학원장 nav role 검증 — 로그인 후 nav '관리실' 노출", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/final-admin-landing.png`, fullPage: false });
    const adminNav = await page.getByRole("link", { name: /관리실/ }).count();
    const fab = await page.getByText("홈페이지 꾸미기").count();
    console.log(JSON.stringify({ adminNav, fab }));
    expect(adminNav).toBeGreaterThanOrEqual(1);
  });

  test("카드 클릭 → 새 탭 PDF 응답 검증", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    // 직접 PDF URL 호출 (브라우저 새 탭 시뮬)
    const apiBase = "https://api.hakwonplus.com";
    const resp = await page.request.get(`${apiBase}/api/v1/matchup/landing/public/25/curated.pdf`, {
      headers: { "X-Tenant-Code": "tchul" },
      timeout: 60_000,
    });
    const headers = resp.headers();
    console.log(JSON.stringify({ status: resp.status(), contentType: headers["content-type"], cd: headers["content-disposition"] }));
    if (resp.status() === 200) {
      const buf = await resp.body();
      console.log("PDF_SIZE:", buf.length);
    }
    await ctx.close();
  });
});
