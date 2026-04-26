/**
 * 설정 메뉴 정밀 검사 — 운영 환경
 *
 * 1) 사이드바 스크롤 fix 확인 (작은 화면 / 1024x600에서 하단 메뉴 도달 가능)
 * 2) /admin/settings 5개 서브 페이지 풀페이지 캡처 (1440x900)
 * 3) 프로필 페이지에서 현재 사용자(admin97) role 라벨 캡처
 *
 * 출력: e2e/reports/settings-review-2026-04-27/*.png
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

test.setTimeout(180_000);

const BASE = getBaseUrl("admin");

const SETTINGS_PAGES: { slug: string; path: string; title: string }[] = [
  { slug: "01-profile",      path: "/admin/settings/profile",      title: "프로필" },
  { slug: "02-organization", path: "/admin/settings/organization", title: "학원 정보" },
  { slug: "03-appearance",   path: "/admin/settings/appearance",   title: "테마" },
  { slug: "04-billing",      path: "/admin/settings/billing",      title: "결제 / 구독" },
  { slug: "05-landing",      path: "/admin/settings/landing",      title: "랜딩페이지" },
];

test("settings menu — full audit + small-viewport scroll check", async ({ page }) => {
  // ── 1. Login at standard desktop viewport ──
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUI(page, "admin");

  // ── 2. 5개 페이지 풀페이지 캡처 ──
  for (const p of SETTINGS_PAGES) {
    const url = `${BASE}${p.path}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `e2e/reports/settings-review-2026-04-27/${p.slug}.png`,
        fullPage: true,
      });
      console.log(`[OK]   ${p.slug}  ${p.title}`);
    } catch (e) {
      console.log(`[FAIL] ${p.slug}  ${(e as Error).message}`);
      await page.screenshot({
        path: `e2e/reports/settings-review-2026-04-27/${p.slug}__error.png`,
        fullPage: true,
      }).catch(() => {});
    }
  }

  // ── 3. 프로필 페이지 — 역할 라벨 텍스트 추출 ──
  await page.goto(`${BASE}/admin/settings/profile`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const roleText = await page.locator("body").innerText();
  const roleMatch = roleText.match(/(대표|강사|조교)/);
  console.log(`[ROLE] currently displayed: ${roleMatch ? roleMatch[0] : "(unknown)"}`);

  // ── 4. 작은 화면 (1024x600) 사이드바 스크롤 검증 ──
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // 사이드바 풀 캡처
  await page.screenshot({
    path: `e2e/reports/settings-review-2026-04-27/sidebar-1024x600-initial.png`,
    fullPage: false,
  });

  // 사이드바 내부 스크롤 컨테이너 확인
  const scrollInfo = await page.evaluate(() => {
    const aside = document.querySelector("aside.sidebar.sidebar-shell");
    const scroll = document.querySelector(".sidebar-scroll");
    if (!aside || !scroll) return { found: false };
    return {
      found: true,
      asideHeight: (aside as HTMLElement).offsetHeight,
      scrollHeight: (scroll as HTMLElement).scrollHeight,
      clientHeight: (scroll as HTMLElement).clientHeight,
      overflowY: getComputedStyle(scroll as HTMLElement).overflowY,
      overflowing: (scroll as HTMLElement).scrollHeight > (scroll as HTMLElement).clientHeight,
    };
  });
  console.log("[SIDEBAR]", JSON.stringify(scrollInfo));

  // 사이드바 끝까지 스크롤
  await page.evaluate(() => {
    const el = document.querySelector(".sidebar-scroll");
    if (el) (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `e2e/reports/settings-review-2026-04-27/sidebar-1024x600-scrolled-bottom.png`,
    fullPage: false,
  });

  // 사이드바 모든 nav-item 의 표시/위치 확인
  const items = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".sidebar-shell .nav-item"));
    return els.map((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return {
        label: (el as HTMLElement).innerText.trim(),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        href: (el as HTMLAnchorElement).getAttribute("href"),
        inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
      };
    });
  });
  console.log("[NAV ITEMS]", JSON.stringify(items, null, 2));

  expect(scrollInfo.found).toBe(true);
});
