// 최종 v3 — 갤러리/외부인 시점/SEO/통합 NavBar/개인 폰 가드 검증.
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("최종 v3 검수", () => {
  test("/landing/reports 갤러리 — 통산 KPI + 카드 그리드", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await gotoAndSettle(page, `${PROD}/landing/reports`, { timeout: 20_000 });
    await expect(page.getByText("통산 적중률")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('a[href*="/landing/reports/"]').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/v6-gallery-desktop.png`, fullPage: true });

    const totalRate = await page.getByText("통산 적중률").count();
    const cumulative = await page.getByText("누적 보고서").count();
    const totalHit = await page.getByText("총 적중 / 전체 문항").count();
    const cards = await page.locator('a[href*="/landing/reports/"]').count();
    console.log(JSON.stringify({ totalRate, cumulative, totalHit, cards }));
    expect(totalRate).toBeGreaterThanOrEqual(1);
    expect(cards).toBeGreaterThanOrEqual(2);
    await ctx.close();
  });

  test("hit_reports 섹션 하단 '모두 보기 →' 진입", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await gotoAndSettle(page, `${PROD}/landing`, { timeout: 20_000 });
    const allLink = page.getByText("적중 사례 모두 보기");
    await expect(allLink).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForURL(/\/landing\/reports$/, { timeout: 15_000 }),
      allLink.click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await expect(page.getByText("통산 적중률")).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/landing/reports");
    await ctx.close();
  });

  test("외부인 시점 토글 — admin로그인 후 ?preview=public", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await gotoAndSettle(page, `${PROD}/landing?preview=public`, { timeout: 20_000 });
    await expect(page.getByText("외부 학부모 시점 미리보기")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("학원장 시점으로 돌아가기")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/v6-preview-public-banner.png`, clip: { x: 0, y: 0, width: 1920, height: 200 } });
    const banner = await page.getByText("외부 학부모 시점 미리보기").count();
    const restoreBtn = await page.getByText("학원장 시점으로 돌아가기").count();
    const fab = await page.getByText("홈페이지 꾸미기").count();
    console.log(JSON.stringify({ banner, restoreBtn, fab }));
    expect(banner).toBeGreaterThanOrEqual(1);
    expect(restoreBtn).toBeGreaterThanOrEqual(1);
    expect(fab).toBe(0); // preview 모드면 fab 숨김
  });

  test("SEO OG 메타 — head 검사", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await gotoAndSettle(page, `${PROD}/landing`, { timeout: 20_000 });
    await page.waitForFunction(
      () => document.title.includes("박철")
        && !!document.querySelector('meta[property="og:title"]')
        && !!document.querySelector('meta[name="twitter:card"]'),
      null,
      { timeout: 10_000 },
    );
    const meta = await page.evaluate(() => {
      const get = (sel: string) => (document.querySelector(sel) as HTMLMetaElement | null)?.content || "";
      return {
        title: document.title,
        desc: get('meta[name="description"]'),
        ogTitle: get('meta[property="og:title"]'),
        ogDesc: get('meta[property="og:description"]'),
        ogType: get('meta[property="og:type"]'),
        ogUrl: get('meta[property="og:url"]'),
        twitterCard: get('meta[name="twitter:card"]'),
      };
    });
    console.log(JSON.stringify(meta));
    expect(meta.title).toContain("박철");
    expect(meta.ogTitle).toBeTruthy();
    expect(meta.ogType).toBe("website");
    expect(meta.twitterCard).toBe("summary_large_image");
    await ctx.close();
  });

  test("백엔드 cta_link 개인 폰 가드 — admin save with tel:01... → 400", async ({ request }) => {
    // tchul-admin 토큰
    const tokRes = await request.post("https://api.hakwonplus.com/api/v1/token/", {
      data: { username: "01035023313", password: "727258", tenant_code: "tchul" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
    });
    expect(tokRes.status()).toBe(200);
    const tok = await tokRes.json() as { access: string };
    // 개인 폰 cta_link 시도 → 400 reject 기대
    const putRes = await request.put("https://api.hakwonplus.com/api/v1/core/landing/admin/", {
      data: { template_key: "premium_dark", draft_config: { brand_name: "박철 과학", cta_link: "tel:01012345678", sections: [] } },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul", Authorization: `Bearer ${tok.access}` },
    });
    const body = await putRes.text();
    console.log("CTA_GUARD_STATUS:", putRes.status(), body.slice(0, 200));
    expect(putRes.status()).toBe(400);
    expect(body).toContain("개인 휴대폰");
  });
});
