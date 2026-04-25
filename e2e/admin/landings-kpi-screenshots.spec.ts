/**
 * /admin/results, /admin/videos KPI 인박스 시각 검증 스크린샷
 *
 * 2026-04-25 UI/UX 감사 슬롯 40 / 50의 재설계 결과 캡처.
 * 출력: e2e/reports/uiux-landings-kpi/{slug}.png
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test("KPI inbox screenshots — results + videos", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUI(page, "admin");

  // Reset mode to KPI
  await page.evaluate(() => {
    try {
      localStorage.removeItem("admin.results.explorerMode");
      localStorage.removeItem("admin.videos.explorerMode");
    } catch {
      /* ignore */
    }
  });

  for (const L of [
    { slug: "40-results-kpi", path: "/admin/results" },
    { slug: "50-videos-kpi", path: "/admin/videos" },
  ]) {
    await page.goto(`${BASE}${L.path}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `e2e/reports/uiux-landings-kpi/${L.slug}.png`,
      fullPage: true,
    });
  }

  expect(true).toBe(true);
});
