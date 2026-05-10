// 6개 테마의 link 색을 실제로 확인
// localhost 라우팅 한계 우회: setAttribute로 data-tenant를 강제 주입한 뒤 색 비교
// 검증: 회원가입(button) === 홈페이지(a) === 비밀번호찾기(button) — 모두 같은 테마 색
import { test, expect, Page } from "@playwright/test";

const TENANTS = ["tchul", "limglish", "hakwonplus", "ymath", "sswe", "dnb"] as const;
const OUT = "C:/academy/_artifacts/sessions/login-theme-verify-2026-05-11";

async function setupMocks(page: Page, hasLanding: boolean) {
  await page.route(
    (url) => url.pathname.includes("/core/program/"),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tenantCode: "9999",
          display_name: "test",
          ui_config: {
            login_title: "테스트",
            logo_url: "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="400" height="200" fill="%23eef"/><text x="200" y="120" text-anchor="middle" font-size="40" fill="%2300695c">LOGO</text></svg>'),
          },
          feature_flags: {},
          is_active: true,
        }),
      });
    },
  );
  await page.route(
    (url) => url.pathname.includes("/core/landing/has-published/"),
    async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ has_published: hasLanding }) });
    },
  );
  await page.route(
    (url) => url.pathname.includes("/auth/me/"),
    async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    },
  );
}

for (const tc of TENANTS) {
  test(`${tc} — 6개 테마 색 일치 (홈페이지 a === 회원가입 button === 비밀번호찾기 button)`, async ({ page }) => {
    await setupMocks(page, true);
    await page.goto(`http://localhost:5174/login`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // localhost 라우팅 한계로 paramCode가 안 잡힘. setAttribute로 강제 주입 → CSS 셀렉터 평가는 정상 동작
    await page.evaluate((tenant) => {
      const root = document.querySelector('[data-app="auth"]') as HTMLElement | null;
      if (root) root.setAttribute("data-tenant", tenant);
    }, tc);
    await page.waitForTimeout(200);

    const colors = await page.evaluate(() => {
      const home = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.trim() === "홈페이지") as HTMLElement | null;
      const signup = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "회원가입") as HTMLElement | null;
      const pw = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "비밀번호 찾기") as HTMLElement | null;
      return {
        home: home ? getComputedStyle(home).color : "missing",
        signup: signup ? getComputedStyle(signup).color : "missing",
        pw: pw ? getComputedStyle(pw).color : "missing",
      };
    });
    console.log(`[${tc}]`, JSON.stringify(colors));

    expect(colors.home).not.toBe("missing");
    expect(colors.signup).not.toBe("missing");
    expect(colors.pw).not.toBe("missing");
    expect(colors.home).toBe(colors.signup);
    expect(colors.home).toBe(colors.pw);

    await page.screenshot({ path: `${OUT}/${tc}.png`, clip: { x: 0, y: 200, width: 1920, height: 700 } });
  });
}

// 모바일에서 로고 중앙 정렬 회귀 방지 (tchul 90vw → 100% 픽스)
test("모바일 tchul — 로고 중앙 정렬 + 카드 좌측 치우침 없음", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await setupMocks(page, true);
  await page.goto(`http://localhost:5174/login`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const root = document.querySelector('[data-app="auth"]') as HTMLElement | null;
    if (root) root.setAttribute("data-tenant", "tchul");
    // 로고 src 강제 (UI 검수용 placeholder svg)
    const img = document.querySelector('img[class*="logo"]') as HTMLImageElement | null;
    if (img) img.src = "data:image/svg+xml;utf8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="400" height="200" fill="%23eef" /><text x="200" y="120" text-anchor="middle" font-size="40" fill="%2300695c">TCHUL LOGO</text></svg>'
    );
  });
  await page.waitForTimeout(300);

  const layout = await page.evaluate(() => {
    const card = document.querySelector('div[class*="center"]') as HTMLElement | null;
    const img = document.querySelector('img[class*="logo"]') as HTMLImageElement | null;
    if (!card || !img) return null;
    const c = card.getBoundingClientRect();
    const i = img.getBoundingClientRect();
    const cardCenter = c.left + c.width / 2;
    const imgCenter = i.left + i.width / 2;
    return { cardLeft: c.left, cardWidth: c.width, imgLeft: i.left, imgWidth: i.width, cardCenter, imgCenter, delta: Math.abs(cardCenter - imgCenter), imgOverflow: i.right > c.right || i.left < c.left };
  });
  console.log("[mobile tchul]", JSON.stringify(layout));
  expect(layout).not.toBeNull();
  expect(layout!.imgOverflow).toBe(false);
  expect(layout!.delta).toBeLessThan(2);

  await page.screenshot({ path: `${OUT}/mobile-tchul.png`, fullPage: false });
  await ctx.close();
});
