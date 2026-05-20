// 로그인 화면 홈페이지 버튼 시각 검수
// 6개 테넌트 테마(tchul/limglish/hakwonplus/ymath/sswe/dnb)에서:
// 1) hasLanding=true → 홈페이지 링크가 회원가입 옆에 노출 + .link 스타일 동일 적용
// 2) hasLanding=false → 링크 미노출
// 3) 각 테마의 --auth-accent 색이 홈페이지 / 회원가입에 동일하게 들어가는지 색상 일치 확인
import { test, expect, Page } from "@playwright/test";

const TENANTS = ["tchul", "limglish", "hakwonplus", "ymath", "sswe", "dnb"] as const;
const OUT = "C:/academy/_artifacts/sessions/login-button-verify-2026-05-11";

async function setupMocks(page: Page, tenantCode: string, hasLanding: boolean) {
  await page.route(
    (url) => url.pathname.includes("/core/program/"),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tenantCode,
          display_name: tenantCode,
          ui_config: { login_title: tenantCode },
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
  test(`[has_landing=true] ${tc} — 홈페이지 링크 노출 + 색상 일치`, async ({ page }) => {
    await setupMocks(page, tc, true);
    await page.goto(`http://localhost:5174/login/${tc}`);
    await page.waitForLoadState("networkidle");

    const homeLink = page.getByRole("link", { name: "홈페이지" });
    const signupBtn = page.getByRole("button", { name: "회원가입" });
    const pwBtn = page.getByRole("button", { name: "비밀번호 찾기" });

    await expect(signupBtn).toBeVisible();
    await expect(pwBtn).toBeVisible();
    await expect(homeLink).toBeVisible();

    const [homeColor, signupColor, pwColor] = await Promise.all([
      homeLink.evaluate((el) => getComputedStyle(el).color),
      signupBtn.evaluate((el) => getComputedStyle(el).color),
      pwBtn.evaluate((el) => getComputedStyle(el).color),
    ]);
    expect(homeColor).toBe(signupColor);
    expect(homeColor).toBe(pwColor);

    await page.screenshot({ path: `${OUT}/${tc}-with-landing.png`, fullPage: true });
    console.log(`[${tc}] color=${homeColor}`);
  });

  test(`[has_landing=false] ${tc} — 홈페이지 링크 미노출`, async ({ page }) => {
    await setupMocks(page, tc, false);
    await page.goto(`http://localhost:5174/login/${tc}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: "회원가입" })).toBeVisible();
    expect(await page.getByRole("link", { name: "홈페이지" }).count()).toBe(0);

    await page.screenshot({ path: `${OUT}/${tc}-no-landing.png`, fullPage: true });
  });
}
