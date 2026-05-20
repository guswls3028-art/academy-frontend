// 어드민 상담 수신함 + honeypot 검증.
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const PROD = "https://tchul.com";
const OUT = "C:/academy/_artifacts/sessions/tchul-landing-2026-05-11";

test.describe("어드민 상담 수신함 + honeypot", () => {
  test("학원장 진입 — settings 사이드바에 '상담 수신함' + 페이지 캡처", async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
    await gotoAndSettle(page, `${PROD}/admin/settings/consult`, { timeout: 20_000 });
    await expect(page.getByText(/^상담 수신함/).first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/v8-admin-inbox.png`, fullPage: true });

    const heading = await page.getByText(/^상담 수신함/).count();
    const navItem = await page.getByRole("link", { name: /상담 수신함/ }).count();
    const filterAll = await page.getByRole("button", { name: /전체/ }).count();
    const filterUnread = await page.getByRole("button", { name: /미확인/ }).count();
    console.log(JSON.stringify({ heading, navItem, filterAll, filterUnread }));
    expect(heading).toBeGreaterThanOrEqual(1);
    expect(navItem).toBeGreaterThanOrEqual(1);
  });

  test("honeypot field — 페이지에 안 보임 (display 영역 0)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/landing`, { waitUntil: "networkidle" });
    const honeypot = page.locator('input[name="website"]').first();
    await expect(honeypot).toBeAttached({ timeout: 10_000 });
    // bounding box 면적 0 (off-screen)
    const box = await honeypot.boundingBox();
    console.log("HONEYPOT_BOX:", JSON.stringify(box));
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(0); // x is off-screen to the left.
    await ctx.close();
  });

  test("honeypot 봇 시뮬 — 백엔드가 silent reject + DB 안 박힘", async ({ request }) => {
    const before = await request.get("https://api.hakwonplus.com/api/v1/core/landing/admin/consult/", {
      headers: { "X-Tenant-Code": "tchul" },
    });
    // unauth는 401 — 단지 endpoint 살아있는지만 확인
    console.log("LIST_BEFORE_STATUS:", before.status());

    // 봇 시뮬: website 채움
    const botRes = await request.post("https://api.hakwonplus.com/api/v1/core/landing/consult/", {
      data: { name: "BOT", phone: "02-9999-0000", website: "http://spam.example", source: "honeypot-test" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
    });
    const botBody = await botRes.text();
    console.log("BOT_RES:", botRes.status(), botBody.slice(0, 100));
    expect(botRes.status()).toBe(201);
    expect(botBody).toContain('"id":0'); // honeypot trap → id 0 (DB 안 박힘)
  });
});
