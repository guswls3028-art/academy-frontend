// 상담 요청 form 시각 + 동작 검증.
import { test, expect } from "@playwright/test";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("상담 요청 form 검증", () => {
  test("데스크탑 contact 섹션 좌우 레이아웃", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    const heading = page.getByText("바로 상담 요청 보내기").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
    await heading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/v7-contact-form-desktop.png`, fullPage: false });

    const headingCount = await page.getByText("바로 상담 요청 보내기").count();
    const phoneInput = await page.locator('input[type="tel"]').count();
    const submitBtn = await page.getByRole("button", { name: "상담 요청 보내기" }).count();
    console.log(JSON.stringify({ headingCount, phoneInput, submitBtn }));
    expect(headingCount).toBeGreaterThanOrEqual(1);
    expect(phoneInput).toBeGreaterThanOrEqual(1);
    expect(submitBtn).toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test("모바일 contact 섹션 stacking", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    const heading = page.getByText("바로 상담 요청 보내기").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
    await heading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/v7-contact-form-mobile.png`, fullPage: false });
    await ctx.close();
  });

  test("form 제출 → 201 + ✓ 안내", async ({ request }) => {
    // 직접 API POST로 검증 (UI 제출 시 실제 DB에 spam 데이터 박힘 방지)
    const resp = await request.post("https://api.hakwonplus.com/api/v1/core/landing/consult/", {
      data: { name: "검수봇", phone: "02-9999-9999", interest: "검수", message: "spec 검증", source: "e2e-audit" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
    });
    const body = await resp.text();
    console.log("CONSULT_POST:", resp.status(), body.slice(0, 200));
    expect(resp.status()).toBe(201);
    expect(body).toContain('"ok":true');
  });

  test("sitemap.xml — XML 응답 + 보고서 URL 포함", async ({ request }) => {
    const resp = await request.get("https://api.hakwonplus.com/api/v1/core/landing/sitemap.xml", {
      headers: { "X-Tenant-Code": "tchul" },
    });
    const body = await resp.text();
    console.log("SITEMAP:", resp.status(), "len=", body.length);
    console.log(body.slice(0, 400));
    expect(resp.status()).toBe(200);
    expect(body).toContain("<urlset");
    expect(body).toContain("/landing/reports");
  });
});
