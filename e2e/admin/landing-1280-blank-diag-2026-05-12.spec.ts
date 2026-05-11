/**
 * P0-2 진단 — tchul.com/landing 1280 viewport 빈 화면 (2026-05-12).
 *
 * 시각 캡처 1280-06-landing-page.png 가 완전 흰 화면. 1366/1920 정상.
 * 학원장 노트북/태블릿 환경 깨짐. read-only diag — 추측 없이 evaluate 로 dump.
 */
import { expect, test } from "@playwright/test";

test.describe("landing 1280 빈 화면 진단", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("console errors + DOM dump + body bounding rect", async ({ page }) => {
    const consoleMsgs: { type: string; text: string }[] = [];
    const failedRequests: { url: string; failure?: string }[] = [];

    page.on("console", (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on("requestfailed", (req) => {
      failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
    });
    page.on("pageerror", (err) => {
      consoleMsgs.push({ type: "pageerror", text: err.message });
    });

    await page.goto("https://tchul.com/landing", {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(5000);

    // DOM 상태 dump
    const dom = await page.evaluate(() => {
      const root = document.getElementById("root") || document.body;
      const bodyText = (document.body.innerText || "").slice(0, 500);
      const rootHtmlLen = root ? root.innerHTML.length : 0;
      const rootChildCount = root ? root.children.length : 0;
      const visibleEls = Array.from(document.querySelectorAll("body *")).filter((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length;
      const computedBodyBg = getComputedStyle(document.body).backgroundColor;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      return {
        bodyText, rootHtmlLen, rootChildCount, visibleEls,
        computedBodyBg, viewportW, viewportH,
        url: location.href,
        documentReadyState: document.readyState,
      };
    });

    console.log("[DOM DUMP]", JSON.stringify(dom, null, 2));
    console.log(`[CONSOLE] ${consoleMsgs.length} msgs`);
    consoleMsgs.slice(0, 20).forEach((m, i) => console.log(`  ${i}: [${m.type}] ${m.text.slice(0, 200)}`));
    console.log(`[REQUEST FAILED] ${failedRequests.length}`);
    failedRequests.slice(0, 10).forEach((r, i) => console.log(`  ${i}: ${r.url} (${r.failure})`));

    await page.screenshot({
      path: "e2e/_artifacts/matchup-portal-visual-2026-05-12/diag-1280-landing-blank.png",
      fullPage: true,
    });

    // sanity 검증 — 빈 화면 의심 시 fail (1280 viewport 깨짐 신호)
    expect(dom.visibleEls).toBeGreaterThan(10);
  });
});
