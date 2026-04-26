/**
 * UI/UX after-fix 캡처 — 1차 개선 후 변경된 도메인 랜딩만 재촬영
 * 출력: e2e/reports/uiux-after-fix/{slug}.png
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

test.setTimeout(180_000);

const BASE = getBaseUrl("admin");

const CHANGED: { slug: string; path: string; title: string }[] = [
  { slug: "00-dashboard",            path: "/admin/dashboard",            title: "대시보드 (재구성)" },
  { slug: "70-materials-sheets",     path: "/admin/materials/sheets",     title: "자료실 시험지 (ID 컬럼 제거)" },
  { slug: "71-storage",              path: "/admin/storage",              title: "AI · 저장소 (이름 변경)" },
  { slug: "75-fees",                 path: "/admin/fees",                 title: "수납 (KPI 클릭)" },
  { slug: "80-message-templates",    path: "/admin/message/templates",    title: "메시지 템플릿 (CTA 명료화)" },
  { slug: "95-community-settings",   path: "/admin/community/settings",   title: "커뮤니티 설정 (이동 버튼)" },
  { slug: "D0-settings-profile",     path: "/admin/settings/profile",     title: "프로필 (운영모드 제거)" },
  { slug: "D1-settings-organization",path: "/admin/settings/organization",title: "학원 정보 (운영모드 추가)" },
];

test("admin landings — after-fix capture", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUI(page, "admin");

  for (const L of CHANGED) {
    const url = `${BASE}${L.path}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `e2e/reports/uiux-after-fix/${L.slug}.png`,
        fullPage: true,
      });
      console.log(`[OK]   ${L.slug}  ${L.title}`);
    } catch (e) {
      console.log(`[FAIL] ${L.slug}  ${(e as Error).message}`);
      await page.screenshot({
        path: `e2e/reports/uiux-after-fix/${L.slug}__error.png`,
        fullPage: true,
      }).catch(() => {});
    }
  }

  expect(true).toBe(true);
});
